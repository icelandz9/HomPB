// ========== orders.html (คำสั่งซื้อของฉัน: ชำระเงิน แนบสลิป ติดตามพัสดุ ขอคืนเงิน) ==========
// ?id=... เปิดคำสั่งซื้อนั้นไว้ด้านบน (มาจากหน้าตะกร้าหลังสั่งซื้อ)

let orders = [];
let store = null; // บัญชีธนาคาร + QR (ลูกค้าที่ล็อกอินอ่าน store_settings ได้)
const SHIP = { preparing: "รอจัดส่ง", in_transit: "กำลังจัดส่ง", delivered: "ส่งถึงแล้ว", failed: "ส่งไม่สำเร็จ" };
const REFUND = { requested: "รอพิจารณา", approved: "อนุมัติแล้ว รอโอนคืน", rejected: "ไม่อนุมัติ", paid: "โอนคืนแล้ว" };
const REASON = { cancel_before_ship: "ยกเลิกก่อนส่ง", damaged: "สินค้าชำรุด", wrong_item: "ส่งสินค้าผิด" };
const one = (x) => (Array.isArray(x) ? x[0] : x) || null; // shipment ต่อ 1 คำสั่งซื้อ
let refundFor = null; // id คำสั่งซื้อที่เปิดฟอร์มขอคืนสินค้าอยู่

// จำนวนที่ยังขอคืนได้ของแต่ละรายการ = จำนวนที่สั่ง - จำนวนในคำขอคืนที่ยังไม่ถูกปฏิเสธ
// (เงื่อนไขเดียวกับ request_refund ในฐานข้อมูล) คืนค่า { order_item_id: จำนวนที่เหลือ }
function refundableQty(o) {
  const used = {};
  for (const r of o.refunds || []) {
    if (r.status === "rejected") continue;
    for (const ri of r.refund_items || []) used[ri.order_item_id] = (used[ri.order_item_id] || 0) + ri.quantity;
  }
  const left = {};
  for (const i of o.order_items || []) left[i.id] = Math.max(0, i.quantity - (used[i.id] || 0));
  return left;
}

async function load() {
  const [{ data, error }, { data: s }] = await Promise.all([
    sb
      .from("orders")
      .select(
        "id, order_no, status, subtotal, shipping_fee, total_amount, shipping_address, payment_due_at, created_at, order_items (id, product_name, variant_name, unit_price, quantity), payments (attempt_no, status, reject_reason, uploaded_at), shipments (status, method, carrier, tracking_no, shipped_at, delivered_at), refunds (id, amount, reason, status, detail, requested_at, refund_items (order_item_id, quantity))",
      )
      .order("created_at", { ascending: false }),
    sb.from("store_settings").select("store_name, bank_name, bank_account_no, bank_account_name, promptpay_qr_path").single(),
  ]);
  if (error) return toast("โหลดคำสั่งซื้อไม่สำเร็จ: " + errText(error), true);
  orders = data;
  store = s;
  if (s?.promptpay_qr_path) {
    const { data: u } = await sb.storage.from("store").createSignedUrl(s.promptpay_qr_path, 3600);
    store.qrUrl = u?.signedUrl || "";
  }
}

function steps(o) {
  const order = ["pending_payment", "awaiting_approval", "approved", "shipping", "delivered"];
  const at = order.indexOf(o.status);
  const names = ["สั่งซื้อ", "แนบสลิป", "ชำระแล้ว", "จัดส่ง", "ได้รับของ"];
  return at < 0 ? "" : `<div class="steps">${names.map((n, i) => `<span class="${i <= at ? "done" : ""}">${n}</span>`).join("")}</div>`;
}

function payBox(o) {
  const last = [...(o.payments || [])].sort((a, b) => b.attempt_no - a.attempt_no)[0];
  const rejected = last?.status === "rejected";
  if (o.status !== "pending_payment") return "";
  return `<div class="pay-box">
  ${store?.qrUrl ? `<img src="${esc(store.qrUrl)}" alt="QR พร้อมเพย์">` : `<span class="muted">ยังไม่มี QR</span>`}
  <div style="display:grid;gap:8px">
    ${rejected ? `<p class="pill bad">สลิปครั้งที่ ${last.attempt_no} ไม่ผ่าน: ${esc(last.reject_reason || "-")} · ส่งใหม่ได้อีก ${2 - last.attempt_no} ครั้ง</p>` : ""}
    <b>โอน ${baht(o.total_amount)}</b>
    ${store?.bank_account_no ? `<span>${esc(store.bank_name || "")} ${esc(store.bank_account_no)}<br><span class="muted">${esc(store.bank_account_name || store.store_name || "")}</span></span>` : ""}
    ${o.payment_due_at ? `<span class="muted">โอนภายใน ${thDate(o.payment_due_at)} ไม่อย่างนั้นคำสั่งซื้อจะถูกยกเลิก</span>` : ""}
    <div class="field"><label for="slip-${o.id}">แนบสลิป (JPG/PNG/PDF ไม่เกิน 5 MB)</label><input id="slip-${o.id}" type="file" accept="image/jpeg,image/png,application/pdf"></div>
    <div><button type="button" class="btn" onclick="sendSlip('${o.id}', this)">ส่งสลิป</button></div>
  </div>
</div>`;
}

function shipInfo(o) {
  const s = one(o.shipments);
  if (!s) return "";
  return `<p>${ic("truck", 18)} ${SHIP[s.status] || s.status}${s.carrier ? ` · ${esc(s.carrier)}` : ""}${s.tracking_no ? ` · เลขพัสดุ <b>${esc(s.tracking_no)}</b>` : ""}${s.method === "store_truck" ? " · ส่งด้วยรถของร้าน" : ""}</p>`;
}

function refundInfo(o) {
  const names = Object.fromEntries((o.order_items || []).map((i) => [i.id, i.product_name]));
  return (o.refunds || [])
    .map((r) => {
      const items = (r.refund_items || []).map((ri) => `${esc(names[ri.order_item_id] || "สินค้า")} × ${ri.quantity}`).join(", ");
      return `<p>คืนเงิน ${baht(r.amount)} (${REASON[r.reason] || r.reason}) · <span class="pill ${r.status === "rejected" ? "bad" : r.status === "paid" ? "ok" : "warn"}">${REFUND[r.status] || r.status}</span>${items ? `<br><span class="muted">${items}</span>` : ""}</p>`;
    })
    .join("");
}

function actions(o) {
  const s = one(o.shipments);
  const open = (o.refunds || []).some((r) => r.status !== "rejected");
  const left = refundableQty(o);
  const btns = [`<a class="btn btn-ghost sm" href="${site("chat.html?order=" + o.id)}">${ic("chat", 16)}แชทเรื่องคำสั่งซื้อนี้</a>`];
  if (!open && o.status === "approved" && (!s || s.status === "preparing"))
    btns.push(`<button type="button" class="btn btn-ghost sm" onclick="askRefund('${o.id}', 'cancel_before_ship')">ยกเลิกคำสั่งซื้อ (คืนเงิน)</button>`);
  // ขอคืนได้หลายครั้ง ตราบที่ยังมีชิ้นที่คืนได้เหลืออยู่
  if (o.status === "delivered" && refundFor !== o.id && Object.values(left).some((n) => n > 0))
    btns.push(`<button type="button" class="btn btn-ghost sm" onclick="openRefund('${o.id}')">ขอคืนเงิน / คืนสินค้า</button>`);
  return `<div class="acts-row">${btns.join("")}</div>`;
}

// ฟอร์มขอคืนสินค้าหลังได้รับของ: เลือกจำนวนคืนของแต่ละรายการ เหตุผล รายละเอียด
function refundForm(o) {
  if (refundFor !== o.id) return "";
  const left = refundableQty(o);
  const rows = o.order_items
    .filter((i) => left[i.id] > 0)
    .map(
      (i) => `<label class="rf-row">
    <span>${esc(i.product_name)}${i.variant_name && i.variant_name !== "มาตรฐาน" ? ` (${esc(i.variant_name)})` : ""}<br><span class="muted">${baht(i.unit_price)} / ชิ้น · คืนได้อีก ${left[i.id]} ชิ้น</span></span>
    <input type="number" inputmode="numeric" min="0" max="${left[i.id]}" value="0" data-item="${i.id}" data-price="${i.unit_price}" oninput="refundTotal('${o.id}')" aria-label="จำนวนที่คืน ${esc(i.product_name)}">
  </label>`,
    )
    .join("");
  return `<form class="refund-form" id="rf-${o.id}" onsubmit="sendRefund(event, '${o.id}')">
  <h3>ขอคืนเงิน / คืนสินค้า</h3>
  <p class="muted">ใส่จำนวนที่จะคืนของแต่ละรายการ รายการที่ไม่คืนใส่ 0</p>
  <div class="rf-items">${rows}</div>
  <fieldset class="rf-reason"><legend>เหตุผล</legend>
    <label><input type="radio" name="reason" value="damaged" checked> สินค้าชำรุด</label>
    <label><input type="radio" name="reason" value="wrong_item"> ส่งสินค้าผิด</label>
  </fieldset>
  <div class="field"><label for="rf-detail-${o.id}">อธิบายเพิ่มเติม (ไม่บังคับ)</label><textarea id="rf-detail-${o.id}" rows="2" maxlength="500"></textarea></div>
  <p>ยอดคืนโดยประมาณ <b class="num" id="rf-total-${o.id}">${baht(0)}</b> <span class="muted">(ไม่รวมค่าส่ง ฝ่ายบัญชีจะยืนยันยอดอีกครั้ง)</span></p>
  <div class="acts-row"><button type="submit" class="btn">ส่งคำขอคืน</button><button type="button" class="btn btn-ghost" onclick="closeRefund()">ยกเลิก</button></div>
</form>`;
}

function openRefund(orderId) {
  refundFor = orderId;
  render();
  $("#rf-" + orderId)?.scrollIntoView({ block: "nearest" });
}

function closeRefund() {
  refundFor = null;
  render();
}

// อ่านจำนวนจากฟอร์ม (ตัดค่าที่เกินหรือติดลบให้อยู่ในช่วงที่คืนได้)
function refundPicks(orderId) {
  return [...document.querySelectorAll(`#rf-${orderId} input[data-item]`)]
    .map((el) => ({ el, qty: Math.min(Math.max(0, Math.floor(Number(el.value) || 0)), Number(el.max)) }))
    .filter((x) => x.qty > 0);
}

function refundTotal(orderId) {
  const sum = refundPicks(orderId).reduce((t, x) => t + Number(x.el.dataset.price) * x.qty, 0);
  $("#rf-total-" + orderId).textContent = baht(sum);
}

async function sendRefund(ev, orderId) {
  ev.preventDefault();
  const form = ev.target;
  const picks = refundPicks(orderId);
  if (!picks.length) return toast("เลือกจำนวนที่จะคืนอย่างน้อย 1 ชิ้น", true);
  const btn = form.querySelector("[type=submit]");
  btn.disabled = true;
  const { error } = await sb.rpc("request_refund", {
    p_order_id: orderId,
    p_reason: form.reason.value,
    p_items: picks.map((x) => ({ order_item_id: x.el.dataset.item, quantity: x.qty })),
    p_detail: $("#rf-detail-" + orderId).value.trim() || null,
  });
  if (error) {
    btn.disabled = false;
    return toast(errText(error), true);
  }
  refundFor = null;
  toast("ส่งคำขอคืนเงินแล้ว รอฝ่ายบัญชีพิจารณา");
  await load();
  render();
}

function render() {
  const focus = param("id");
  if (!orders.length) {
    $("#main").innerHTML = `<h1>คำสั่งซื้อของฉัน</h1><div class="empty-state">${ic("truck", 48)}<p>ยังไม่มีคำสั่งซื้อ</p><a class="btn" href="${site("index.html")}">เลือกซื้อสินค้า</a></div>`;
    return;
  }
  const sorted = [...orders].sort((a, b) => (b.id === focus) - (a.id === focus));
  $("#main").innerHTML =
    `<h1>คำสั่งซื้อของฉัน</h1>` +
    sorted
      .map((o) => {
        const a = o.shipping_address || {};
        return `<article class="panel order" id="o-${o.id}">
  <div class="order-head"><span class="acts-row"><b>HPB${o.order_no}</b> ${pill(ORDER_STATUS[o.status] || [o.status, "neutral"])}</span><span class="muted">${thDate(o.created_at)}</span></div>
  ${steps(o)}
  <div class="order-items">${o.order_items.map((i) => `<span>${esc(i.product_name)}${i.variant_name && i.variant_name !== "มาตรฐาน" ? ` (${esc(i.variant_name)})` : ""} × ${i.quantity} · <span class="num">${baht(i.unit_price * i.quantity)}</span></span>`).join("")}
    <span class="muted">ค่าส่ง ${baht(o.shipping_fee)} · <b>รวม ${baht(o.total_amount)}</b></span></div>
  <p class="muted">ส่งถึง ${esc(a.recipient_name || "")} ${esc(a.phone || "")} · ${esc([a.address_line, a.subdistrict, a.district, a.province, a.postcode].filter(Boolean).join(" "))}</p>
  ${payBox(o)}${shipInfo(o)}${refundInfo(o)}${actions(o)}${refundForm(o)}
</article>`;
      })
      .join("");
  if (focus) $("#o-" + focus)?.scrollIntoView({ block: "start" });
}

// แนบสลิป: อัปโหลดไป slips/{user_id}/{order_id}/เวลา.นามสกุล แล้วเรียก submit_payment
async function sendSlip(orderId, btn) {
  const file = $("#slip-" + orderId).files[0];
  if (!file) return toast("เลือกไฟล์สลิปก่อน", true);
  const types = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
  if (!types[file.type]) return toast("สลิปต้องเป็น JPG, PNG หรือ PDF", true);
  if (file.size > 5 * 1024 * 1024) return toast("สลิปต้องไม่เกิน 5 MB", true);
  btn.disabled = true;
  const path = `${me.id}/${orderId}/${Date.now()}.${types[file.type]}`;
  const { error: e1 } = await sb.storage.from("slips").upload(path, file);
  if (e1) {
    btn.disabled = false;
    return toast("อัปโหลดสลิปไม่สำเร็จ: " + errText(e1), true);
  }
  const { error } = await sb.rpc("submit_payment", { p_order_id: orderId, p_slip_path: path });
  if (error) {
    btn.disabled = false;
    return toast(errText(error), true);
  }
  toast("ส่งสลิปแล้ว รอฝ่ายบัญชีตรวจ");
  await load();
  render();
}

// ยกเลิกก่อนส่ง: คืนเงินทั้งคำสั่งซื้อ (p_items = null คือทุกชิ้น)
// ขอคืนหลังได้รับของ (เลือกรายชิ้น) ใช้ฟอร์ม refundForm / sendRefund
async function askRefund(orderId, reason) {
  if (!confirm("ยกเลิกคำสั่งซื้อนี้และขอคืนเงินใช่หรือไม่?")) return;
  const { error } = await sb.rpc("request_refund", { p_order_id: orderId, p_reason: reason, p_detail: null });
  if (error) return toast(errText(error), true);
  toast("ส่งคำขอคืนเงินแล้ว รอฝ่ายบัญชีพิจารณา");
  await load();
  render();
}

(async () => {
  await renderHeader();
  if (!needCustomer()) {
    if (me) $("#main").innerHTML = '<div class="empty-state"><p>บัญชีพนักงานไม่มีคำสั่งซื้อ</p></div>';
    return;
  }
  await load();
  render();
})();
