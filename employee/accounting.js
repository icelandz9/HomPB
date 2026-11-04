// ========== ผู้ใช้ปัจจุบัน (ได้จาก requireStaff ตอนเริ่มทำงาน) ==========
let me = null; // { id, email, full_name, role }

// ========== สิทธิ์ของฝ่ายบัญชี: M = จัดการ, V = ดูอย่างเดียว ==========
const ACL = { overview: "V", orders: "V", finance: "M" };
const PAGES = [
  ["overview", "ภาพรวม", "▦"],
  ["orders", "คำสั่งซื้อ", "☰"],
  ["finance", "การเงิน & ชำระเงิน", "▭"],
];

// ========== ข้อมูล (โหลดจาก Supabase ใน loadData) ==========
// payments: {id,orderId,code,date,amt,attempt,slipUrl,status:'pending'|'approved'|'rejected',note,reviewedAt,reviewedBy}
let payments = [];
// orders: {id,code,cust,items,amt,status,date}  (อ่านจาก view orders_for_staff ไม่มีที่อยู่)
let orders = [];
// refunds: {id,orderId,code,amt,reason,detail,status:'requested'|'approved'|'rejected'|'paid',slipUrl,date,approvedAt,approvedBy}
let refunds = [];
let rejectIdx = null; // แถวสลิปที่กำลังบันทึกเหตุผลไม่ผ่าน
let refundRejectIdx = null; // แถวคำขอคืนเงินที่กำลังบันทึกเหตุผลไม่อนุมัติ
let busy = false; // กันกดปุ่มซ้ำระหว่างรอ server

const ORDER_STATUS = {
  pending_payment: "รอชำระเงิน",
  awaiting_approval: "รอตรวจสลิป",
  approved: "ชำระแล้ว",
  shipping: "กำลังจัดส่ง",
  delivered: "ส่งถึงแล้ว",
  cancelled: "ยกเลิก",
  refunded: "คืนเงินแล้ว",
};
const REFUND_REASON = {
  cancel_before_ship: "ยกเลิกก่อนส่ง",
  damaged: "สินค้าชำรุด",
  wrong_item: "ส่งสินค้าผิด",
};

// ========== ฟังก์ชันช่วย ==========
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const baht = (n) => "฿" + Number(n).toLocaleString("th-TH");
const canM = (p) => ACL[p] === "M";
const thDate = (d) => (d ? new Date(d).toLocaleString("th-TH") : "-");
const orderCode = (no) => "HPB" + no;
function toast(t) {
  const e = document.createElement("div");
  e.className = "toast";
  e.textContent = t;
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 2200);
}
function logout() {
  staffLogout();
}
function guard(p) {
  if (!canM(p)) {
    toast("คุณไม่มีสิทธิ์ดำเนินการนี้");
    return false;
  }
  return true;
}
function card(title, note, body, pad) {
  return `<div class="card"><div class="ch"><h2>${title}</h2><span>${note || ""}</span></div>${pad ? `<div class="cb">${body}</div>` : body}</div>`;
}
function table(heads, rowsHtml, id) {
  return `<div class="tw"><table><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr><tbody${id ? ` id="${id}"` : ""}>${rowsHtml || `<tr><td class="empty" colspan="${heads.length}">ยังไม่มีข้อมูล</td></tr>`}</tbody></table></div>`;
}
function payPill(s) {
  return (
    {
      pending: '<span class="pill w">รอตรวจสอบ</span>',
      approved: '<span class="pill o">ยืนยันแล้ว</span>',
      rejected: '<span class="pill r">ไม่ผ่าน</span>',
    }[s] || esc(s)
  );
}
function refundPill(s) {
  return (
    {
      requested: '<span class="pill w">รอพิจารณา</span>',
      approved: '<span class="pill w">อนุมัติแล้ว รอโอนคืน</span>',
      rejected: '<span class="pill r">ไม่อนุมัติ</span>',
      paid: '<span class="pill o">โอนคืนแล้ว</span>',
    }[s] || esc(s)
  );
}
// ผู้ทำรายการ: พนักงานคนอื่นอ่านอีเมลไม่ได้ (RLS ของ profiles) แสดงเฉพาะของตัวเอง
const actor = (id) => (id && id === me.id ? me.email : id ? "พนักงานคนอื่น" : "-");
// signed URL ของไฟล์ใน bucket private (หมดอายุใน 1 ชั่วโมง ต้องรีเฟรชหน้าถ้าเปิดค้างนาน)
async function signedUrls(bucket, paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map((x) => [x.path, x.signedUrl]));
}

// ========== โหลดข้อมูลจาก Supabase ==========
// orders ตารางจริงมีที่อยู่ลูกค้า ฝ่ายบัญชีอ่านไม่ได้ (RLS) จึงอ่านจาก view orders_for_staff แล้วจับคู่เอง
async function loadData() {
  const [o, p, r, it] = await Promise.all([
    sb.from("orders_for_staff").select("*").order("created_at", { ascending: false }),
    sb.from("payments").select("*").order("uploaded_at", { ascending: false }),
    sb.from("refunds").select("*").order("requested_at", { ascending: false }),
    sb.from("order_items").select("order_id, product_name, variant_name, quantity"),
  ]);
  const err = o.error || p.error || r.error || it.error;
  if (err) {
    toast("โหลดข้อมูลไม่สำเร็จ: " + errText(err));
    return;
  }

  // ชื่อลูกค้า (ฝ่ายบัญชีเห็นเฉพาะลูกค้าที่มีคำสั่งซื้อ ตาม can_view_profile)
  const userIds = [...new Set(o.data.map((x) => x.user_id))];
  const { data: profs } = userIds.length
    ? await sb.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const custName = Object.fromEntries((profs || []).map((x) => [x.id, x.full_name]));

  const items = {};
  for (const x of it.data) {
    (items[x.order_id] ||= []).push(`${x.product_name} (${x.variant_name}) ×${x.quantity}`);
  }
  const code = Object.fromEntries(o.data.map((x) => [x.id, orderCode(x.order_no)]));

  const [slipUrl, refundSlipUrl] = await Promise.all([
    signedUrls("slips", p.data.map((x) => x.slip_path)),
    signedUrls("refund-slips", r.data.filter((x) => x.slip_path).map((x) => x.slip_path)),
  ]);

  orders = o.data.map((x) => ({
    id: x.id,
    code: code[x.id],
    cust: custName[x.user_id] || "-",
    items: (items[x.id] || []).join(", ") || "-",
    amt: x.total_amount,
    status: ORDER_STATUS[x.status] || x.status,
    date: thDate(x.created_at),
  }));
  payments = p.data.map((x) => ({
    id: x.id,
    orderId: x.order_id,
    code: code[x.order_id] || "-",
    date: thDate(x.uploaded_at),
    amt: x.amount,
    attempt: x.attempt_no,
    slipUrl: slipUrl[x.slip_path] || "",
    status: x.status,
    note: x.reject_reason || "",
    reviewedAt: x.reviewed_at,
    reviewedBy: x.reviewed_by,
  }));
  refunds = r.data.map((x) => ({
    id: x.id,
    orderId: x.order_id,
    code: code[x.order_id] || "-",
    amt: x.amount,
    reason: REFUND_REASON[x.reason] || x.reason,
    detail: x.detail || "",
    status: x.status,
    slipUrl: refundSlipUrl[x.slip_path] || "",
    date: thDate(x.requested_at),
    approvedAt: x.approved_at,
    approvedBy: x.approved_by,
  }));
}

// ========== เปลี่ยนหน้า (เมนูแสดงตามสิทธิ์) ==========
let cur = "overview";
function go(p) {
  if (!ACL[p]) p = "overview";
  cur = p;
  $("#nav").innerHTML = PAGES.filter((x) => ACL[x[0]])
    .map(
      (x) =>
        `<button class="${x[0] === p ? "on" : ""}" onclick="go('${x[0]}')"><span aria-hidden="true">${x[2]}</span>${x[1]}</button>`,
    )
    .join("");
  const t = PAGES.find((x) => x[0] === p)[1];
  // ช่องค้นหา/ตัวกรอง: วาดหน้าเดิมซ้ำ (เช่น หลังกดบันทึก) เก็บค่าไว้ / เปลี่ยนหน้า ล้างทิ้ง
  // (ตารางอ่านค่าจากช่องเดิมก่อนวางหน้าใหม่ ถ้าไม่ทำ ตารางจะกรองอยู่แต่ช่องว่าง)
  const same = $("#pg").dataset.page === p;
  const filters = [...document.querySelectorAll("#pg .filters input, #pg .filters select")].map((e) => {
    const v = e.value;
    if (!same) e.value = "";
    return [e.id, v];
  });
  $("#pg").dataset.page = p;
  $("#pg").innerHTML =
    `<h1>${t}</h1><p class="who">${ROLE_NAME[me.role]} · สิทธิ์: ${canM(p) ? "จัดการ" : "ดูอย่างเดียว"}</p>` +
    VIEWS[p]();
  if (same)
    filters.forEach(([id, v]) => {
      const e = document.getElementById(id);
      if (e) e.value = v;
    });
  window.scrollTo(0, 0);
}
// โหลดข้อมูลใหม่หลังทำรายการ แล้ววาดหน้าเดิม
async function reload() {
  await loadData();
  go(cur);
}

// ========== เนื้อหาแต่ละหน้า ==========
const VIEWS = {
  // ---- ภาพรวม (ดูอย่างเดียว) ----
  overview() {
    const k = (l, v) => `<div class="kpi"><p>${l}</p><b>${v}</b></div>`;
    const sum = (list, f) =>
      list.filter(f).reduce((a, x) => a + Number(x.amt), 0);
    return `<div class="kpis">
${k("สลิปรอตรวจสอบ", payments.filter((p) => p.status === "pending").length)}
${k("ยอดที่ยืนยันแล้ว", baht(sum(payments, (p) => p.status === "approved")))}
${k("ยอดรอตรวจสอบ", baht(sum(payments, (p) => p.status === "pending")))}
${k("คำขอคืนเงินรอพิจารณา", refunds.filter((r) => r.status === "requested").length)}
${k("ยอดที่คืนเงินแล้ว", baht(sum(refunds, (r) => r.status === "paid")))}
</div>`;
  },

  // ---- คำสั่งซื้อ (ดูอย่างเดียว เห็นยอดเงิน ไม่เห็นที่อยู่) ----
  orders() {
    const rows = orders
      .map(
        (o) =>
          `<tr><td><b>${o.code}</b></td><td>${esc(o.cust)}</td><td>${esc(o.items)}</td><td>${baht(o.amt)}</td><td>${esc(o.status)}</td><td>${o.date}</td></tr>`,
      )
      .join("");
    return card(
      "คำสั่งซื้อ",
      "ดูอย่างเดียว · ที่อยู่ลูกค้าเห็นได้เฉพาะฝ่ายจัดส่ง",
      table(
        ["คำสั่งซื้อ", "ลูกค้า", "สินค้า", "ยอดเงิน", "สถานะ", "วันที่"],
        rows,
      ),
    );
  },

  // ---- การเงิน & ชำระเงิน (จัดการได้) ----
  finance() {
    return (
      (rejectIdx !== null ? rejectForm() : "") +
      (refundRejectIdx !== null ? refundRejectForm() : "") +
      card(
        "ตรวจสอบการชำระเงิน",
        "ข้อมูลการเงินเป็นความลับ · เข้าถึงได้เฉพาะ Admin และฝ่ายบัญชี",
        `<div class="filters">
<div><label for="fq">ค้นหาคำสั่งซื้อ</label><input id="fq" placeholder="เช่น HPB1001" oninput="renderRows()"></div>
<div><label for="fs">สถานะ</label><select id="fs" onchange="renderRows()">
<option value="">ทั้งหมด</option><option value="pending">รอตรวจสอบ</option><option value="approved">ยืนยันแล้ว</option><option value="rejected">ไม่ผ่าน</option></select></div>
</div>` +
          table(
            [
              "คำสั่งซื้อ",
              "ยอดเงิน",
              "หลักฐานการโอน",
              "สถานะ",
              "หมายเหตุ",
              "การดำเนินการ",
            ],
            rowsHtml(),
            "prow",
          ),
      ) +
      card(
        "คำขอคืนเงิน",
        "ลูกค้าเป็นผู้ขอ · อนุมัติแล้วโอนคืน แล้วแนบหลักฐาน",
        table(
          ["คำสั่งซื้อ", "ยอดคืน", "เหตุผล", "สถานะ", "การดำเนินการ"],
          refundRowsHtml(),
        ),
      ) +
      card(
        "ประวัติการดำเนินการ",
        "อนุมัติ / ไม่ผ่าน สลิป และคำขอคืนเงิน",
        table(
          [
            "เวลา",
            "คำสั่งซื้อ",
            "การดำเนินการ",
            "จำนวนเงิน",
            "หมายเหตุ",
            "ผู้ทำรายการ",
          ],
          historyRows(),
        ),
      )
    );
  },
};

// ========== ตารางการชำระเงิน (กรองได้) ==========
function rowsHtml() {
  const q = ($("#fq")?.value || "").trim().toLowerCase(),
    s = $("#fs")?.value || "";
  return payments
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!q || p.code.toLowerCase().includes(q)) && (!s || p.status === s),
    )
    .map(
      ({ p, i }) => `<tr>
<td><b>${p.code}</b><br><small class="muted">${p.date} · ครั้งที่ ${p.attempt}</small></td>
<td>${baht(p.amt)}</td>
<td>${p.slipUrl ? `<a href="${esc(p.slipUrl)}" target="_blank" rel="noopener" style="color:var(--text)">ดูสลิป</a>` : "-"}</td>
<td>${payPill(p.status)}</td>
<td class="muted">${esc(p.note || "-")}</td>
<td>${
        p.status === "pending"
          ? `<div class="acts"><button class="btn sm" onclick="approve(${i})">ยืนยัน</button><button class="btn line sm" onclick="startReject(${i})">ไม่ผ่าน</button></div>`
          : '<span class="muted">ดำเนินการแล้ว</span>'
      }</td></tr>`,
    )
    .join("");
}
function renderRows() {
  $("#prow").innerHTML =
    rowsHtml() || '<tr><td class="empty" colspan="6">ไม่พบรายการ</td></tr>';
}

// ========== ตารางคำขอคืนเงิน ==========
function refundRowsHtml() {
  return refunds
    .map(
      (r, i) => `<tr>
<td><b>${r.code}</b><br><small class="muted">${r.date}</small></td>
<td>${baht(r.amt)}</td>
<td>${esc(r.reason)}${r.detail ? `<br><small class="muted">${esc(r.detail)}</small>` : ""}</td>
<td>${refundPill(r.status)}</td>
<td>${
        r.status === "requested"
          ? `<div class="acts"><button class="btn sm" onclick="approveRefund(${i})">อนุมัติ</button><button class="btn line sm" onclick="startRefundReject(${i})">ไม่อนุมัติ</button></div>`
          : r.status === "approved"
            ? `<label for="rf${i}">หลักฐานการโอนคืน</label><input id="rf${i}" type="file" accept="image/jpeg,image/png,application/pdf"><br><br><button class="btn sm" onclick="markPaid(${i})">บันทึกโอนคืนแล้ว</button>`
            : r.slipUrl
              ? `<a href="${esc(r.slipUrl)}" target="_blank" rel="noopener" style="color:var(--text)">ดูหลักฐาน</a>`
              : '<span class="muted">ดำเนินการแล้ว</span>'
      }</td></tr>`,
    )
    .join("");
}

// ========== ประวัติ (สร้างจากสลิปที่ตรวจแล้ว และคำขอคืนเงินที่พิจารณาแล้ว) ==========
function historyRows() {
  const h = [
    ...payments
      .filter((p) => p.reviewedAt)
      .map((p) => [p.reviewedAt, p.code, p.status === "approved" ? "อนุมัติยอด" : "ไม่ผ่าน", p.amt, p.note, actor(p.reviewedBy)]),
    ...refunds
      .filter((r) => r.approvedAt)
      .map((r) => [r.approvedAt, r.code, r.status === "rejected" ? "ไม่อนุมัติคืนเงิน" : "อนุมัติคืนเงิน", r.amt, r.reason, actor(r.approvedBy)]),
  ].sort((a, b) => new Date(b[0]) - new Date(a[0]));
  return h
    .slice(0, 50)
    .map(
      (x) =>
        `<tr><td>${thDate(x[0])}</td><td>${x[1]}</td><td>${esc(x[2])}</td><td>${baht(x[3])}</td><td>${esc(x[4] || "-")}</td><td>${esc(x[5])}</td></tr>`,
    )
    .join("");
}

// ========== ฟอร์มไม่ผ่าน / ไม่อนุมัติคืนเงิน ==========
function rejectForm() {
  const p = payments[rejectIdx];
  return card(
    "ไม่ผ่านการตรวจสอบ " + p.code,
    p.attempt === 1
      ? "ครั้งที่ 1: ลูกค้าอัปโหลดสลิปใหม่ได้อีก 1 ครั้ง"
      : "ครั้งที่ 2: คำสั่งซื้อจะถูกยกเลิกและคืนสต็อก",
    `
<label for="rj">เหตุผล (ลูกค้าจะเห็นข้อความนี้)</label>
<input id="rj" placeholder="เช่น ยอดโอนไม่ตรง / สลิปไม่ชัดเจน"><br><br>
<button class="btn" onclick="reject()">ยืนยันไม่ผ่าน</button> <button class="btn line" onclick="cancelForm()">ยกเลิก</button>`,
    1,
  );
}
function refundRejectForm() {
  const r = refunds[refundRejectIdx];
  return card(
    "ไม่อนุมัติคืนเงิน " + r.code,
    "ยอดที่ขอ " + baht(r.amt),
    `
<label for="rrj">เหตุผล (ลูกค้าจะเห็นข้อความนี้)</label>
<input id="rrj" placeholder="เช่น เลยระยะเวลาขอคืน / ไม่พบความเสียหาย"><br><br>
<button class="btn" onclick="rejectRefund()">ยืนยันไม่อนุมัติ</button> <button class="btn line" onclick="cancelForm()">ยกเลิก</button>`,
    1,
  );
}
function cancelForm() {
  rejectIdx = null;
  refundRejectIdx = null;
  go("finance");
}

// ========== เรียกฟังก์ชันใน backend (functions.sql) ==========
// rpc แล้วโหลดข้อมูลใหม่ ถ้า error แสดง toast และไม่เปลี่ยนอะไร
async function callRpc(name, args, okText) {
  if (busy) return false;
  busy = true;
  const { error } = await sb.rpc(name, args);
  busy = false;
  if (error) {
    toast(errText(error));
    return false;
  }
  toast(okText);
  await reload();
  return true;
}

// ---- ตรวจสลิป: review_payment ----
async function approve(i) {
  if (!guard("finance")) return;
  if (!confirm("ยืนยันยอด " + payments[i].code + " ใช่หรือไม่?")) return;
  await callRpc(
    "review_payment",
    { p_payment_id: payments[i].id, p_approve: true },
    "อนุมัติยอดแล้ว คำสั่งซื้อส่งต่อให้ฝ่ายจัดส่ง",
  );
}
function startReject(i) {
  if (!guard("finance")) return;
  rejectIdx = i;
  refundRejectIdx = null;
  go("finance");
}
async function reject() {
  if (!guard("finance")) return;
  const why = $("#rj").value.trim();
  if (!why) {
    toast("กรอกเหตุผลก่อน");
    return;
  }
  const p = payments[rejectIdx];
  rejectIdx = null;
  await callRpc(
    "review_payment",
    { p_payment_id: p.id, p_approve: false, p_reject_reason: why },
    "บันทึกแล้ว",
  );
}

// ---- คำขอคืนเงิน: review_refund / mark_refund_paid ----
async function approveRefund(i) {
  if (!guard("finance")) return;
  if (!confirm("อนุมัติคืนเงิน " + refunds[i].code + " ยอด " + baht(refunds[i].amt) + " ใช่หรือไม่?")) return;
  await callRpc(
    "review_refund",
    { p_refund_id: refunds[i].id, p_approve: true },
    "อนุมัติแล้ว โอนคืนแล้วแนบหลักฐาน",
  );
}
function startRefundReject(i) {
  if (!guard("finance")) return;
  refundRejectIdx = i;
  rejectIdx = null;
  go("finance");
}
async function rejectRefund() {
  if (!guard("finance")) return;
  const why = $("#rrj").value.trim();
  if (!why) {
    toast("กรอกเหตุผลก่อน");
    return;
  }
  const r = refunds[refundRejectIdx];
  refundRejectIdx = null;
  await callRpc(
    "review_refund",
    { p_refund_id: r.id, p_approve: false, p_note: why },
    "บันทึกแล้ว",
  );
}
// อัปโหลดหลักฐานไป refund-slips/{order_id}/ชื่อไฟล์ ก่อน แล้วค่อยเรียก mark_refund_paid
async function markPaid(i) {
  if (!guard("finance") || busy) return;
  const r = refunds[i];
  const file = $("#rf" + i).files[0];
  if (!file) {
    toast("เลือกไฟล์หลักฐานการโอนคืนก่อน");
    return;
  }
  // ตั้งชื่อไฟล์ใหม่ (ชื่อภาษาไทยหรือมีช่องว่างใช้เป็น path ใน Storage ไม่ได้)
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${r.orderId}/${Date.now()}.${ext}`;
  busy = true;
  const { error } = await sb.storage
    .from("refund-slips")
    .upload(path, file, { upsert: false });
  busy = false;
  if (error) {
    toast("อัปโหลดไม่สำเร็จ: " + errText(error));
    return;
  }
  await callRpc(
    "mark_refund_paid",
    { p_refund_id: r.id, p_slip_path: path },
    "บันทึกโอนคืนแล้ว",
  );
}

// ========== เริ่มทำงาน ==========
(async () => {
  me = await requireStaff("accounting");
  $("#tn").textContent = me.full_name || ROLE_NAME[me.role];
  $("#te").textContent = me.email;
  $("#pg").innerHTML = '<p class="muted">กำลังโหลดข้อมูล...</p>';
  await loadData();
  go("overview");
})();
