// ========== orders.html (คำสั่งซื้อของฉัน: ชำระเงิน แนบสลิป ติดตามพัสดุ ขอคืนเงิน) ==========
// ?id=... เปิดคำสั่งซื้อนั้นไว้ด้านบน (มาจากหน้าตะกร้าหลังสั่งซื้อ)

let orders = [];
let store = null; // บัญชีธนาคาร + QR (ลูกค้าที่ล็อกอินอ่าน store_settings ได้)
const SHIP = { preparing: "รอจัดส่ง", in_transit: "กำลังจัดส่ง", delivered: "ส่งถึงแล้ว", failed: "ส่งไม่สำเร็จ" };
const REFUND = { requested: "รอพิจารณา", approved: "อนุมัติแล้ว รอโอนคืน", rejected: "ไม่อนุมัติ", paid: "โอนคืนแล้ว" };
const REASON = { cancel_before_ship: "ยกเลิกก่อนส่ง", damaged: "สินค้าชำรุด", wrong_item: "ส่งสินค้าผิด" };
const one = (x) => (Array.isArray(x) ? x[0] : x) || null; // shipment ต่อ 1 คำสั่งซื้อ

async function load() {
  const [{ data, error }, { data: s }] = await Promise.all([
    sb
      .from("orders")
      .select(
        "id, order_no, status, subtotal, shipping_fee, total_amount, shipping_address, payment_due_at, created_at, order_items (id, product_name, variant_name, unit_price, quantity), payments (attempt_no, status, reject_reason, uploaded_at), shipments (status, method, carrier, tracking_no, shipped_at, delivered_at), refunds (amount, reason, status, detail, requested_at)",
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
  return (o.refunds || [])
    .map((r) => `<p>คืนเงิน ${baht(r.amount)} (${REASON[r.reason] || r.reason}) · <span class="pill ${r.status === "rejected" ? "bad" : r.status === "paid" ? "ok" : "warn"}">${REFUND[r.status] || r.status}</span></p>`)
    .join("");
}

function actions(o) {
  const s = one(o.shipments);
  const open = (o.refunds || []).some((r) => r.status !== "rejected");
  const btns = [`<a class="btn btn-ghost sm" href="${site("chat.html?order=" + o.id)}">${ic("chat", 16)}แชทเรื่องคำสั่งซื้อนี้</a>`];
  if (!open && o.status === "approved" && (!s || s.status === "preparing"))
    btns.push(`<button type="button" class="btn btn-ghost sm" onclick="askRefund('${o.id}', 'cancel_before_ship')">ยกเลิกคำสั่งซื้อ (คืนเงิน)</button>`);
  if (!open && o.status === "delivered")
    btns.push(`<button type="button" class="btn btn-ghost sm" onclick="askRefund('${o.id}')">ขอคืนเงิน / คืนสินค้า</button>`);
  return `<div class="acts-row">${btns.join("")}</div>`;
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
  ${payBox(o)}${shipInfo(o)}${refundInfo(o)}${actions(o)}
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

// ขอคืนเงินทั้งคำสั่งซื้อ (request_refund) ยกเลิกก่อนส่ง หรือ หลังได้รับของ (ชำรุด/ส่งผิด)
async function askRefund(orderId, reason) {
  if (!reason) {
    const pick = prompt("เหตุผลที่ขอคืน พิมพ์ 1 = สินค้าชำรุด, 2 = ส่งสินค้าผิด");
    if (pick === null) return;
    reason = pick.trim() === "2" ? "wrong_item" : pick.trim() === "1" ? "damaged" : "";
    if (!reason) return toast("พิมพ์ 1 หรือ 2", true);
  } else if (!confirm("ยกเลิกคำสั่งซื้อนี้และขอคืนเงินใช่หรือไม่?")) return;
  const detail = reason === "cancel_before_ship" ? null : prompt("อธิบายเพิ่มเติม (ไม่บังคับ)") || null;
  const { error } = await sb.rpc("request_refund", { p_order_id: orderId, p_reason: reason, p_detail: detail });
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
