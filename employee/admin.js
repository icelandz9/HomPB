// ========== ผู้ใช้ปัจจุบัน (ได้จาก requireStaff ตอนเริ่มทำงาน) ==========
let me = null;
const BRAND = "ฝ่ายบริการลูกค้า HomPB"; // ชื่อที่ลูกค้าเห็นในแชท (ไม่แสดงชื่อพนักงาน)

// ========== ตำแหน่ง และสิทธิ์ (M = จัดการ, V = ดูอย่างเดียว) ==========
const ROLES = {
  admin: "Admin",
  warehouse: "ฝ่ายคลังสินค้า",
  accounting: "ฝ่ายบัญชี",
  shipping: "ฝ่ายจัดส่ง",
  sales: "ฝ่ายบริการลูกค้า-ฝ่ายขาย",
};
const PAGES = [
  ["overview", "ภาพรวม", "▦"],
  ["products", "สินค้า & สต๊อก", "◫"],
  ["orders", "คำสั่งซื้อ", "☰"],
  ["finance", "การเงิน & ชำระเงิน", "▭"],
  ["shipping", "จัดส่ง & ที่อยู่ลูกค้า", "⛟"],
  ["chat", "แชทลูกค้า", "✉"],
  ["users", "ผู้ใช้ & ระบบ", "♙"],
];
// ตารางสิทธิ์ทุกฝ่าย (ใช้แสดงในหน้าภาพรวม และใช้ตอนทำระบบสิทธิ์จริง)
const ACL = {
  admin: {
    overview: "M",
    products: "M",
    orders: "M",
    finance: "M",
    shipping: "M",
    chat: "M",
    users: "M",
  },
  warehouse: { overview: "V", products: "M", orders: "V" },
  accounting: { overview: "V", orders: "V", finance: "M" },
  shipping: { overview: "V", orders: "V", shipping: "M" },
  sales: { overview: "V", products: "V", orders: "V", chat: "M" },
};
const ZONES = [
  "ห้องนอน",
  "ห้องน้ำ",
  "ห้องนั่งเล่น",
  "ห้องครัว",
  "เครื่องใช้ไฟฟ้า",
];
const REASONS = [
  "รับสินค้าเข้า",
  "สินค้าเสียหาย",
  "นับสต๊อกใหม่",
  "คืนสินค้า",
  "อื่น ๆ",
];
const STATUSES = ["รอจัดส่ง", "กำลังจัดส่ง", "จัดส่งสำเร็จ", "ส่งไม่สำเร็จ"];
// สถานะใน shipments → ภาษาไทย
const SHIP_STATUS = {
  preparing: "รอจัดส่ง",
  in_transit: "กำลังจัดส่ง",
  delivered: "จัดส่งสำเร็จ",
  failed: "ส่งไม่สำเร็จ",
};
const CARRIERS = [
  "ไปรษณีย์ไทย",
  "Flash Express",
  "J&T Express",
  "Kerry Express",
  "อื่น ๆ",
];
const QUICK = [
  "สวัสดีค่ะ ยินดีให้บริการค่ะ",
  "รบกวนขอเลขคำสั่งซื้อด้วยนะคะ",
  "ขอบคุณที่ติดต่อมานะคะ มีอะไรให้ช่วยเพิ่มเติมไหมคะ",
];
const LOW = 10; // ต่ำกว่าหรือเท่ากับค่านี้ถือว่า "ใกล้หมด"

const STOCK_REASON = {
  order: "ลูกค้าสั่งซื้อ",
  cancel: "ยกเลิกคำสั่งซื้อ",
  adjust: "ปรับสต๊อก",
  return: "รับคืนสินค้า",
};

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

const CHAT_STATUS = {
  waiting_staff: "รอรับเรื่อง",
  in_progress: "กำลังคุย",
  closed: "ปิดแล้ว",
};

// action ใน audit_logs (trigger ใน security.sql เป็นคนเขียน) → ภาษาไทย
const AUDIT_ACTION = {
  "profile.access_change": "เปลี่ยนสิทธิ์บัญชี",
  "stock.adjust": "ปรับสต๊อก",
  "variant.price": "เปลี่ยนราคา",
  "store.update": "แก้ข้อมูลร้าน",
  "refund.approved": "อนุมัติคืนเงิน",
  "refund.rejected": "ไม่อนุมัติคืนเงิน",
  "refund.paid": "โอนคืนเงินแล้ว",
  "return.restocked": "รับของคืนเข้าสต๊อก",
  "return.not_restocked": "ของคืนใช้ไม่ได้",
};

// ========== ข้อมูล (โหลดจาก Supabase) ==========
let products = []; // {id,variantId,sku,name,zone,price,qty,desc}
let orders = []; // {id,code,cust,phone,items,amt,addr,status,date}
let payments = []; // {id,orderId,code,date,amt,attempt,slipUrl,status:'pending'|'approved'|'rejected',note,reviewedAt,reviewedBy}
let refunds = []; // {id,orderId,code,amt,reason,detail,status,slipUrl,date,approvedAt,approvedBy}
let shipments = []; // งานจัดส่ง {orderId,code,name,phone,addr,items,date,status,carrier,track,handledBy,shippedAt,deliveredAt}
let chats = []; // {id,customer,status,order,waiting,lastAt,msgs:[{from:'cus'|'staff',text,img,time}]}
let staff = []; // บัญชีพนักงาน {id,name,email,role,active}
let movements = []; // ประวัติปรับสต๊อก [เวลา,รหัส,ชื่อ,ปรับ,เหตุผล,คงเหลือใหม่,ผู้ทำ]
let catId = {}; // ใช้แปลงชื่อโซนเป็น id ของหมวดหมู่ {ชื่อโซน: id}
let shipHist = []; // ประวัติจัดส่ง [เวลา,คำสั่งซื้อ,สถานะ,ขนส่ง,เลขพัสดุ,ผู้ทำ] (สร้างจาก shipped_at / delivered_at)
let logs = []; // บันทึกการทำงานของระบบ [เวลา,ผู้ทำ,การกระทำ,รายละเอียด] จาก audit_logs (ดูอย่างเดียว)

// ตัวแปรสถานะหน้าจอ
let cur = "overview",
  editIdx = null,
  refundRejectIdx = null, // แถวคำขอคืนเงินที่กำลังบันทึกเหตุผลไม่อนุมัติ
  rejectIdx = null,
  active = null,
  draft = "",
  busy = false; // กันกดปุ่มซ้ำระหว่างรอ server

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
const lv = (p) => ACL[me.role][p];
const canM = (p) => lv(p) === "M";
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
function stockPill(q) {
  return q <= 0
    ? '<span class="pill r">หมดสต๊อก</span>'
    : q <= LOW
      ? '<span class="pill w">ใกล้หมด</span>'
      : '<span class="pill o">ปกติ</span>';
}
const thDate = (d) => (d ? new Date(d).toLocaleString("th-TH") : "-");
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
// ผู้ทำรายการ: id → ชื่อพนักงาน (ไม่มีชื่อใช้อีเมล)
const actor = (id) => {
  if (!id) return "-";
  const s = staff.find((x) => x.id === id);
  return s ? s.name || s.email : "ไม่ทราบชื่อ";
};
// signed URL ของไฟล์ใน bucket private (หมดอายุใน 1 ชั่วโมง)
async function signedUrls(bucket, paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map((x) => [x.path, x.signedUrl]));
}
function shipPill(s) {
  return s === "จัดส่งสำเร็จ"
    ? `<span class="pill o">${s}</span>`
    : s === "กำลังจัดส่ง"
      ? `<span class="pill w">${s}</span>`
      : `<span class="pill r">${s}</span>`;
}

// พนักงานทุกคน (Admin อ่าน profiles ได้ทั้งหมด) ใช้ในหน้าผู้ใช้ และแปลง id → ชื่อในตารางประวัติ
async function loadStaff() {
  const { data, error } = await sb
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .neq("role", "customer")
    .order("role");
  if (error) return toast("โหลดรายชื่อพนักงานไม่สำเร็จ: " + errText(error));
  staff = data.map((x) => ({
    id: x.id,
    name: x.full_name || "",
    email: x.email,
    role: x.role,
    active: x.is_active,
  }));
}

// บันทึกการทำงานของระบบ 50 รายการล่าสุด (trigger เขียนให้เอง หน้าเว็บอ่านอย่างเดียว)
async function loadLogs() {
  const { data, error } = await sb
    .from("audit_logs")
    .select("created_at, actor_id, action, target_id, detail")
    .order("id", { ascending: false })
    .limit(50);
  if (error) return toast("โหลดบันทึกระบบไม่สำเร็จ: " + errText(error));
  logs = data.map((x) => [
    thDate(x.created_at),
    x.actor_id ? actor(x.actor_id) : "ระบบ", // ไม่มีคนทำ = ระบบทำเอง เช่น ยกเลิกคำสั่งซื้อที่หมดเวลา
    AUDIT_ACTION[x.action] || x.action,
    auditDetail(x),
  ]);
}
// detail (jsonb) → ข้อความสั้นๆ แต่ละ action เก็บไม่เหมือนกัน (ดู security.sql)
function auditDetail(x) {
  const d = x.detail || {};
  const pair = (a) => (Array.isArray(a) ? a : [a, a]); // [ค่าเก่า, ค่าใหม่]
  if (x.action === "profile.access_change") {
    const [r0, r1] = pair(d.role),
      [a0, a1] = pair(d.is_active),
      who = actor(x.target_id);
    const parts = [];
    if (r0 !== r1) parts.push(`${ROLES[r0] || r0} → ${ROLES[r1] || r1}`);
    if (a0 !== a1) parts.push(a1 ? "เปิดบัญชี" : "ปิดบัญชี");
    return `${who}: ${parts.join(", ") || "-"}`;
  }
  if (x.action === "stock.adjust")
    return `${d.sku} ${d.change_qty > 0 ? "+" : ""}${d.change_qty} (คงเหลือ ${d.stock_qty})`;
  if (x.action === "variant.price") {
    const [p0, p1] = pair(d.price);
    return `${d.sku} ${baht(p0)} → ${baht(p1)}`;
  }
  if (x.action.startsWith("refund."))
    return `${baht(d.amount)} · ${REFUND_REASON[d.reason] || d.reason || "-"}`;
  if (x.action.startsWith("return.")) return `จำนวน ${d.quantity}`;
  return "-";
}

async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select(
      "id, name, description, product_variants (id, sku, price, stock_qty), product_categories (categories (name))",
    )

    .eq("is_active", true);
  if (error) {
    toast("โหลดสินค้าไม่สำเร็จ: " + errText(error));
    return;
  }

  const { data: cats } = await sb.from("categories").select("id, name");
  catId = Object.fromEntries((cats || []).map((c) => [c.name, c.id]));

  products = data.map((p) => {
    const v = p.product_variants[0] || {}; // 1 สินค้า = 1 variant
    return {
      id: p.id,
      variantId: v.id, // ใช้ตอนปรับสต๊อก
      sku: v.sku || "-",
      name: p.name,
      zone: p.product_categories[0]?.categories?.name || "-",
      price: v.price || 0,
      qty: v.stock_qty || 0,
      desc: p.description || "",
    };
  });

  // ประวัติสต๊อก 50 รายการล่าสุด (ชื่อ stockLogs เพราะ logs ใช้กับบันทึกระบบแล้ว)
  const { data: stockLogs } = await sb
    .from("stock_logs")
    .select("variant_id, change_qty, reason, actor_id, created_at")
    .order("id", { ascending: false })
    .limit(50);

  const byVariant = Object.fromEntries(products.map((x) => [x.variantId, x]));
  movements = (stockLogs || [])
    .filter((m) => byVariant[m.variant_id]) // ข้ามสินค้าที่ลบไปแล้ว
    .map((m) => {
      const pr = byVariant[m.variant_id];
      return [
        new Date(m.created_at).toLocaleString("th-TH"),
        pr.sku,
        pr.name,
        m.change_qty,
        STOCK_REASON[m.reason] || m.reason,
        "-",
        actor(m.actor_id),
      ];
    });
}

// คำสั่งซื้อ: Admin อ่าน orders ตรงได้ จึงได้ที่อยู่และยอดเงินด้วย
async function loadOrders() {
  const { data, error } = await sb
    .from("orders")
    .select(
      "id, order_no, status, total_amount, shipping_address, created_at, order_items ( product_name, quantity )",
    )
    .order("created_at", { ascending: false });
  if (error) return toast("โหลดคำสั่งซื้อไม่สำเร็จ: " + errText(error));

  orders = data.map((x) => {
    const a = x.shipping_address || {};
    return {
      id: x.id, // uuid ใช้ตอนเรียก rpc
      code: "HPB" + x.order_no, // แสดงให้คนอ่าน
      cust: a.recipient_name || "-",
      phone: a.phone || "",
      items:
        x.order_items
          .map((i) => `${i.product_name} ×${i.quantity}`)
          .join(", ") || "-",
      amt: x.total_amount,
      addr:
        [a.address_line, a.subdistrict, a.district, a.province, a.postcode]
          .filter(Boolean)
          .join(" ") || "-",
      status: ORDER_STATUS[x.status] || x.status,
      date: new Date(x.created_at).toLocaleString("th-TH"),
    };
  });
}

// การเงิน: สลิป + คำขอคืนเงิน (ต้องโหลดหลัง loadOrders เพราะใช้เลข HPB)
async function loadPayments() {
  const [p, r] = await Promise.all([
    sb.from("payments").select("*").order("uploaded_at", { ascending: false }),
    sb.from("refunds").select("*").order("requested_at", { ascending: false }),
  ]);
  if (p.error || r.error)
    return toast("โหลดข้อมูลการเงินไม่สำเร็จ: " + errText(p.error || r.error));

  const code = Object.fromEntries(orders.map((o) => [o.id, o.code]));
  const [slipUrl, refundSlipUrl] = await Promise.all([
    signedUrls(
      "slips",
      p.data.map((x) => x.slip_path),
    ),
    signedUrls(
      "refund-slips",
      r.data.filter((x) => x.slip_path).map((x) => x.slip_path),
    ),
  ]);

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

// งานจัดส่ง: เหมือน delivery.js แต่ Admin เห็นทุกงาน ไม่ต้องกดรับงาน
async function loadShipments() {
  const { data, error } = await sb
    .from("shipments")
    .select(
      "order_id, carrier, tracking_no, status, handled_by, shipped_at, delivered_at, orders ( order_no, shipping_address, created_at, order_items ( product_name, quantity ) )",
    );
  if (error) return toast("โหลดงานจัดส่งไม่สำเร็จ: " + errText(error));

  shipments = data
    .filter((x) => x.orders)
    .map((x) => {
      const o = x.orders,
        a = o.shipping_address || {};
      return {
        orderId: x.order_id, // uuid ใช้ตอนเรียก rpc
        code: "HPB" + o.order_no, // แสดงให้คนอ่าน
        name: a.recipient_name || "-",
        phone: a.phone || "-",
        addr:
          [a.address_line, a.subdistrict, a.district, a.province, a.postcode]
            .filter(Boolean)
            .join(" ") || "-",
        items: o.order_items
          .map((i) => `${i.product_name} ×${i.quantity}`)
          .join(", "),
        date: new Date(o.created_at).toLocaleString("th-TH"),
        status: SHIP_STATUS[x.status] || x.status,
        carrier: x.carrier || "",
        track: x.tracking_no || "",
        handledBy: x.handled_by, // null = ยังไม่มีคนรับ
        shippedAt: x.shipped_at,
        deliveredAt: x.delivered_at,
      };
    })
    .sort((a, b) => b.code.localeCompare(a.code, undefined, { numeric: true }));

  // ประวัติ: สร้างจากเวลาเริ่มส่ง / ส่งถึง ที่ฐานข้อมูลบันทึกไว้
  shipHist = [];
  shipments.forEach((x) => {
    if (x.shippedAt)
      shipHist.push([
        x.shippedAt,
        x.code,
        "กำลังจัดส่ง",
        x.carrier,
        x.track,
        actor(x.handledBy),
      ]);
    if (x.deliveredAt)
      shipHist.push([
        x.deliveredAt,
        x.code,
        "จัดส่งสำเร็จ",
        x.carrier,
        x.track,
        actor(x.handledBy),
      ]);
  });
  shipHist.sort((a, b) => new Date(b[0]) - new Date(a[0])); // ใหม่สุดขึ้นก่อน
  shipHist.forEach((h) => (h[0] = thDate(h[0])));
}

async function loadChats() {
  const [c, m] = await Promise.all([
    sb
      .from("conversations")
      .select("id, customer_id, order_id, status, created_at")
      .order("created_at", { ascending: false }),
    sb
      .from("messages")
      .select("conversation_id, sender_type, body, image_path, created_at")
      .order("created_at"),
  ]);
  if (c.error || m.error)
    return toast("โหลดแชทไม่สำเร็จ: " + errText(c.error || m.error));

  const ids = [...new Set(c.data.map((x) => x.customer_id))];
  const [{ data: profs }, img] = await Promise.all([
    ids.length
      ? sb.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] },
    signedUrls(
      "chat-images",
      m.data.filter((x) => x.image_path).map((x) => x.image_path),
    ),
  ]);
  const custName = Object.fromEntries(
    (profs || []).map((x) => [x.id, x.full_name || x.email]),
  );
  const orderCode = Object.fromEntries(orders.map((o) => [o.id, o.code]));

  // จัดกลุ่มข้อความตามห้อง
  const msgs = {};
  for (const x of m.data) {
    (msgs[x.conversation_id] ||= []).push({
      from: x.sender_type === "customer" ? "cus" : "staff",
      text: x.body || "",
      img: x.image_path ? img[x.image_path] : null,
      at: x.created_at,
      time: new Date(x.created_at).toLocaleString("th-TH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  chats = c.data
    .map((x) => {
      const ms = msgs[x.id] || [];
      const last = ms[ms.length - 1];
      return {
        id: x.id,
        customer: custName[x.customer_id] || "ลูกค้า",
        status: x.status,
        order: x.order_id ? orderCode[x.order_id] || "-" : null,
        msgs: ms,
        lastAt: last ? last.at : x.created_at,
        // รอตอบ = ห้องยังไม่ปิด และยังไม่มีใครรับ หรือข้อความล่าสุดมาจากลูกค้า
        waiting:
          x.status !== "closed" &&
          (x.status === "waiting_staff" || last?.from === "cus"),
      };
    })
    .sort(
      (a, b) =>
        (a.status === "closed") - (b.status === "closed") ||
        b.lastAt.localeCompare(a.lastAt),
    );
}

// มีข้อความหรือห้องใหม่ → โหลดแชทใหม่ แล้ววาดหน้าใหม่เฉพาะหน้าที่แสดงแชท
let reloadTimer = null;
function listenChats() {
  const refresh = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      await loadChats();
      if (cur === "chat" || cur === "overview") {
        if ($("#cm")) draft = $("#cm").value; // เก็บข้อความที่พิมพ์ค้างไว้
        go(cur);
      }
    }, 300);
  };
  sb.channel("admin-chat")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      refresh,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      refresh,
    )
    .subscribe();
}

// โหลดใหม่ทั้งหมดหลังทำรายการ (อนุมัติสลิปแล้วสถานะคำสั่งซื้อก็เปลี่ยนด้วย)
async function reload() {
  await Promise.all([loadProducts(), loadOrders(), loadShipments()]);
  await loadPayments();
  await loadChats(); // ใช้เลข HPB จาก orders
  await loadLogs(); // ปรับสต๊อก แก้ราคา คืนเงิน ก็มีบันทึกใหม่
  go(cur);
}

// ========== เปลี่ยนหน้า (เมนูแสดงตามสิทธิ์) ==========
function go(p) {
  if (!lv(p)) p = "overview";
  cur = p;
  $("#nav").innerHTML = PAGES.filter((x) => lv(x[0]))
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
    `<h1>${t}</h1><p class="who">${ROLES[me.role]} · สิทธิ์: ${canM(p) ? "จัดการ" : "ดูอย่างเดียว"}</p>` +
    VIEWS[p]();
  if (same)
    filters.forEach(([id, v]) => {
      const e = document.getElementById(id);
      if (e) e.value = v;
    });
  const m = $(".msgs");
  if (m) m.scrollTop = m.scrollHeight;
  window.scrollTo(0, 0);
}
// อัปเดตเฉพาะตารางตอนพิมพ์ค้นหา/เปลี่ยนตัวกรอง
function renderRows() {
  const fn = { products: prodRows, finance: payRows, shipping: shipRows }[cur];
  const el = $("#prow");
  if (el)
    el.innerHTML =
      fn() || '<tr><td class="empty" colspan="12">ไม่พบรายการ</td></tr>';
}

// ========== เนื้อหาแต่ละหน้า ==========
const VIEWS = {
  // ---- ภาพรวม (KPI + ตารางสิทธิ์) ----
  overview() {
    const k = (l, v) => `<div class="kpi"><p>${l}</p><b>${v}</b></div>`;
    const sum = (list, f) =>
      list.filter(f).reduce((a, x) => a + Number(x.amt), 0);
    const heads = ["ตำแหน่ง", ...PAGES.slice(1).map((p) => p[1])];
    const rows = Object.keys(ROLES)
      .map(
        (r) =>
          `<tr class="${r === "admin" ? "k" : ""}"><td><b>${ROLES[r]}</b></td>${PAGES.slice(
            1,
          )
            .map((p) => {
              const v = ACL[r][p[0]];
              return `<td>${v === "M" ? "จัดการ" : v === "V" ? "ดูอย่างเดียว" : "—"}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("");
    return (
      `<div class="kpis">
${k("คำสั่งซื้อทั้งหมด", orders.length)}
${k("สลิปรอตรวจสอบ", payments.filter((p) => p.status === "pending").length)}
${k("แชทที่รอตอบ", chats.filter((c) => c.waiting).length)}
${k("ยอดที่ยืนยันแล้ว", baht(sum(payments, (p) => p.status === "approved")))}
${k("ยอดที่คืนเงินแล้ว", baht(sum(refunds, (r) => r.status === "paid")))}
${k("รอจัดส่ง", shipments.filter((s) => s.status === "รอจัดส่ง").length)}
${k("สินค้าใกล้หมด (≤" + LOW + ")", products.filter((p) => p.qty > 0 && p.qty <= LOW).length)}
${k("สินค้าหมดสต๊อก", products.filter((p) => p.qty <= 0).length)}
</div>` +
      card(
        "สิทธิ์การเข้าถึงตามตำแหน่ง",
        "แต่ละตำแหน่งเข้าถึงข้อมูลต่างกัน · Admin เข้าถึงได้ทั้งหมด",
        table(heads, rows),
      )
    );
  },

  // ---- สินค้า & สต๊อก (ฝ่ายคลัง) ----
  products() {
    return (
      (editIdx !== null ? editForm() : "") +
      card(
        "สินค้าและสต๊อก",
        "ปรับจำนวน: ใส่ + เพื่อเพิ่ม หรือ − เพื่อลด แล้วเลือกเหตุผล",
        `<div class="filters">
<div><label for="fq">ค้นหาสินค้า</label><input id="fq" placeholder="ชื่อหรือรหัสสินค้า" oninput="renderRows()"></div>
<div><label for="fz">โซน</label><select id="fz" onchange="renderRows()"><option value="">ทุกโซน</option>${ZONES.map((z) => `<option>${z}</option>`).join("")}</select></div>
<div><label for="fs">สถานะสต๊อก</label><select id="fs" onchange="renderRows()"><option value="">ทั้งหมด</option><option value="ok">ปกติ</option><option value="low">ใกล้หมด</option><option value="out">หมดสต๊อก</option></select></div>
</div>` +
          table(
            [
              "รหัส",
              "ชื่อสินค้า",
              "โซน",
              "ราคา (฿)",
              "คงเหลือ",
              "สถานะ",
              "ปรับจำนวน (+/−)",
              "เหตุผล",
              "การดำเนินการ",
            ],
            prodRows(),
            "prow",
          ),
      ) +
      card(
        "เพิ่มสินค้าใหม่",
        "",
        `
<div class="form">
<div><label for="np">ชื่อสินค้า</label><input id="np"></div>
<div><label for="nz">โซน</label><select id="nz">${ZONES.map((z) => `<option>${z}</option>`).join("")}</select></div>
<div><label for="nc">ราคา (฿)</label><input id="nc" type="number" min="0"></div>
<div><label for="nq">จำนวน</label><input id="nq" type="number" min="0"></div>
</div><br>
<label for="nd">รายละเอียด</label><input id="nd"><br><br>
<button class="btn" onclick="addP()">เพิ่มสินค้า</button>`,
        1,
      ) +
      card(
        "ประวัติการปรับสต๊อก",
        "ติดตามการเปลี่ยนแปลงของสต๊อก",
        table(
          [
            "เวลา",
            "รหัส",
            "สินค้า",
            "ปรับ",
            "เหตุผล",
            "คงเหลือใหม่",
            "ผู้ทำรายการ",
          ],
          movements
            .slice(0, 50)
            .map(
              (m) =>
                `<tr><td>${m[0]}</td><td>${m[1]}</td><td>${esc(m[2])}</td><td>${m[3] > 0 ? "+" : ""}${m[3]}</td><td>${esc(m[4])}</td><td>${m[5]}</td><td>${esc(m[6])}</td></tr>`,
            )
            .join(""),
        ),
      )
    );
  },

  // ---- คำสั่งซื้อ (Admin เห็นครบทุกคอลัมน์) ----
  orders() {
    const rows = orders
      .map(
        (o) =>
          `<tr><td><b>${o.code}</b></td><td>${esc(o.cust)}<br><small class="muted">${esc(o.phone || "")}</small></td><td>${esc(o.items)}</td><td>${baht(o.amt)}</td><td>${esc(o.addr)}</td><td>${esc(o.status)}</td><td>${o.date}</td></tr>`,
      )
      .join("");
    return card(
      "คำสั่งซื้อทั้งหมด",
      "",
      table(
        [
          "คำสั่งซื้อ",
          "ลูกค้า",
          "สินค้า",
          "ยอดเงิน",
          "ที่อยู่",
          "สถานะ",
          "วันที่",
        ],
        rows,
      ),
    );
  },

  // ---- การเงิน & ชำระเงิน (ฝ่ายบัญชี) ----
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
            payRows(),
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

  // ---- จัดส่ง & ที่อยู่ลูกค้า (ฝ่ายจัดส่ง) ----
  shipping() {
    return (
      card(
        "งานจัดส่ง",
        "แสดงเฉพาะคำสั่งซื้อที่ชำระเงินแล้ว · อัปเดตแล้วลูกค้าเห็นทันที",
        `<div class="filters">
<div><label for="fq">ค้นหา</label><input id="fq" placeholder="เลขคำสั่งซื้อ / ชื่อ / เบอร์" oninput="renderRows()"></div>
<div><label for="fs">สถานะ</label><select id="fs" onchange="renderRows()"><option value="">ทั้งหมด</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}</select></div>
</div>` +
          table(
            [
              "คำสั่งซื้อ",
              "ผู้รับ & ที่อยู่",
              "สถานะการจัดส่ง",
              "ขนส่ง",
              "เลขพัสดุ",
              "",
            ],
            shipRows(),
            "prow",
          ),
      ) +
      card(
        "ประวัติการอัปเดตจัดส่ง",
        "บันทึกทุกครั้งที่เปลี่ยนสถานะหรือเลขพัสดุ",
        table(
          ["เวลา", "คำสั่งซื้อ", "สถานะ", "ขนส่ง", "เลขพัสดุ", "ผู้ทำรายการ"],
          shipHist
            .slice(0, 50)
            .map(
              (h) =>
                `<tr><td>${h[0]}</td><td>${h[1]}</td><td>${esc(h[2])}</td><td>${esc(h[3] || "-")}</td><td>${esc(h[4] || "-")}</td><td>${esc(h[5])}</td></tr>`,
            )
            .join(""),
        ),
      )
    );
  },

  // ---- แชทลูกค้า (ฝ่ายบริการลูกค้า-ฝ่ายขาย) ----
  chat() {
    const intro = `<div class="note">ลูกค้าจะเห็นข้อความของคุณในชื่อ “${BRAND}” โดยไม่แสดงชื่อพนักงาน</div>`;
    const list = chats.length
      ? chats
          .map((c) => {
            const last = c.msgs[c.msgs.length - 1];
            return `<button class="cl${c.id === active ? " on" : ""}" onclick="openChat('${c.id}')">
<div class="row"><b>${esc(c.customer)}</b>${chatPill(c)}</div>
<small>${last ? esc(last.text || "[รูปภาพ]") : ""}</small></button>`;
          })
          .join("")
      : '<div class="note muted">ยังไม่มีแชทจากลูกค้า</div>';
    return (
      intro +
      `<div class="chat"><div class="clist">${list}</div>${chatWindow()}</div>`
    );
  },

  // ---- ผู้ใช้ & ระบบ (จัดการบัญชีพนักงาน + log) ----
  users() {
    const rows = staff
      .map((s, i) => {
        // บัญชีตัวเอง: ห้ามเปลี่ยนตำแหน่ง/ปิดบัญชี ไม่อย่างนั้นจะล็อกตัวเองออกจากระบบ
        const self = s.id === me.id;
        const roleCell = self
          ? ROLES[s.role]
          : `<select id="ro${i}" aria-label="ตำแหน่ง" onchange="setRole(${i})">${Object.entries(ROLES)
              .map((r) => `<option value="${r[0]}"${r[0] === s.role ? " selected" : ""}>${r[1]}</option>`)
              .join("")}</select>`;
        const action = self
          ? '<span class="muted">คุณ</span>'
          : `<button class="btn line sm" onclick="toggleActive(${i})">${s.active ? "ปิดบัญชี" : "เปิดบัญชี"}</button>`;
        return `<tr${s.active ? "" : ' class="muted"'}><td><b>${esc(s.name || "-")}</b></td><td>${esc(s.email)}</td><td>${roleCell}</td>
<td>${s.active ? '<span class="pill o">ใช้งาน</span>' : '<span class="pill r">ปิดแล้ว</span>'}</td><td>${action}</td></tr>`;
      })
      .join("");

    return (
      card(
        "บัญชีพนักงาน",
        "เฉพาะ Admin",
        table(["ชื่อ", "อีเมล", "ตำแหน่ง", "สถานะ", ""], rows),
      ) +
      card(
        "เพิ่มบัญชีพนักงาน",
        "",
        `
<div class="form">
<div><label for="un">ชื่อ</label><input id="un"></div>
<div><label for="ue">อีเมลบริษัท</label><input id="ue" type="email" placeholder="ชื่อ@hompb.com"></div>
<div><label for="ur">ตำแหน่ง</label><select id="ur">${Object.entries(ROLES)
          .map((r) => `<option value="${r[0]}">${r[1]}</option>`)
          .join("")}</select></div>
<div><label for="up">รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว)</label><div class="pw"><input id="up" type="password" autocomplete="new-password">
<button id="eye" class="eye" type="button" aria-label="แสดงรหัสผ่าน" aria-pressed="false" onclick="togglePw()">
<svg class="i-show" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
<svg class="i-hide" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>
</button></div></div>
</div><br>
<button class="btn" onclick="addU()">เพิ่มพนักงาน</button>`,
        1,
      ) +
      card(
        "บันทึกการทำงานของระบบ",
        "ดูได้อย่างเดียว · ไม่สามารถแก้หรือลบ",
        table(
          ["เวลา", "ผู้ทำ", "การกระทำ", "รายละเอียด"],
          logs
            .map(
              (l) =>
                `<tr><td>${l[0]}</td><td>${esc(l[1])}</td><td>${esc(l[2])}</td><td class="muted">${esc(l[3])}</td></tr>`,
            )
            .join(""),
        ),
      )
    );
  },
};

// ========== แถวของตาราง ==========
function prodRows() {
  const q = ($("#fq")?.value || "").trim().toLowerCase(),
    z = $("#fz")?.value || "",
    s = $("#fs")?.value || "";
  return products
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)) &&
        (!z || p.zone === z) &&
        (!s ||
          (s === "out"
            ? p.qty <= 0
            : s === "low"
              ? p.qty > 0 && p.qty <= LOW
              : p.qty > LOW)),
    )
    .map(
      ({ p, i }) => `<tr>
<td>${p.sku}</td><td><b>${esc(p.name)}</b></td><td>${p.zone}</td><td>${baht(p.price)}</td><td><b>${p.qty}</b></td><td>${stockPill(p.qty)}</td>
<td><input class="num" type="number" id="ad${i}" placeholder="+10 / -3" aria-label="ปรับจำนวน"></td>
<td><select id="rs${i}">${REASONS.map((r) => `<option>${r}</option>`).join("")}</select></td>
<td><div class="acts"><button class="btn sm" onclick="adjust(${i})">ปรับ</button><button class="btn line sm" onclick="startEdit(${i})">แก้ไข</button><button class="btn line sm" onclick="recommend(${i})">แนะนำในแชท</button><button class="btn line sm" onclick="delP(${i})">ลบ</button></div></td></tr>`,
    )
    .join("");
}
function payRows() {
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

function historyRows() {
  const h = [
    ...payments
      .filter((p) => p.reviewedAt)
      .map((p) => [
        p.reviewedAt,
        p.code,
        p.status === "approved" ? "อนุมัติยอด" : "ไม่ผ่าน",
        p.amt,
        p.note,
        actor(p.reviewedBy),
      ]),
    ...refunds
      .filter((r) => r.approvedAt)
      .map((r) => [
        r.approvedAt,
        r.code,
        r.status === "rejected" ? "ไม่อนุมัติคืนเงิน" : "อนุมัติคืนเงิน",
        r.amt,
        r.reason,
        actor(r.approvedBy),
      ]),
  ].sort((a, b) => new Date(b[0]) - new Date(a[0]));
  return h
    .slice(0, 50)
    .map(
      (x) =>
        `<tr><td>${thDate(x[0])}</td><td>${x[1]}</td><td>${esc(x[2])}</td><td>${baht(x[3])}</td><td>${esc(x[4] || "-")}</td><td>${esc(x[5])}</td></tr>`,
    )
    .join("");
}
function shipRows() {
  const q = ($("#fq")?.value || "").trim().toLowerCase(),
    s = $("#fs")?.value || "";
  return shipments
    .map((x, i) => ({ x, i }))
    .filter(
      ({ x }) =>
        (!q ||
          x.code.toLowerCase().includes(q) ||
          x.name.toLowerCase().includes(q) ||
          x.phone.includes(q)) &&
        (!s || x.status === s),
    )
    .map(
      ({ x, i }) => `<tr>
<td><b>${x.code}</b><br><small class="muted">${x.date}</small></td>
<td>${esc(x.name)} · ${esc(x.phone)}<br><small class="muted">${esc(x.addr)}</small><br><small class="muted">${esc(x.items)}</small></td>
<td><select id="ss${i}" aria-label="สถานะการจัดส่ง">${STATUSES.map((t) => `<option${t === x.status ? " selected" : ""}>${t}</option>`).join("")}</select><br><span style="display:inline-block;margin-top:6px">${shipPill(x.status)}</span></td>
<td><select id="cr${i}" aria-label="ขนส่ง"><option value="">เลือกขนส่ง</option>${CARRIERS.map((c) => `<option${c === x.carrier ? " selected" : ""}>${c}</option>`).join("")}</select></td>
<td><input id="tk${i}" value="${esc(x.track || "")}" placeholder="เลขพัสดุ" aria-label="เลขพัสดุ"></td>
<td><div class="acts"><button class="btn sm" onclick="saveS(${i})">บันทึก</button><button class="btn line sm" onclick="copyAddr(${i})">คัดลอกที่อยู่</button></div></td></tr>`,
    )
    .join("");
}

// ========== ฟอร์มแก้ไขสินค้า / ไม่ผ่าน / คืนเงิน ==========
function editForm() {
  const p = products[editIdx];
  return card(
    "แก้ไขรายละเอียดสินค้า " + p.sku,
    "",
    `
<div class="form">
<div><label for="en">ชื่อสินค้า</label><input id="en" value="${esc(p.name)}"></div>
<div><label for="ez">โซน</label><select id="ez">${ZONES.map((z) => `<option${z === p.zone ? " selected" : ""}>${z}</option>`).join("")}</select></div>
<div><label for="ec">ราคา (฿)</label><input id="ec" type="number" min="0" value="${p.price}"></div>
</div><br>
<label for="ed">รายละเอียด</label><input id="ed" value="${esc(p.desc || "")}"><br><br>
<button class="btn" onclick="saveEdit()">บันทึก</button> <button class="btn line" onclick="cancelEdit()">ยกเลิก</button>`,
    1,
  );
}
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

// ========== หน้าต่างแชท ==========
const activeChat = () => chats.find((c) => c.id === active);
function chatPill(c) {
  if (c.status === "closed") return '<span class="pill">ปิดแล้ว</span>';
  return c.waiting
    ? '<span class="pill w">รอตอบ</span>'
    : '<span class="pill o">ตอบแล้ว</span>';
}
function chatWindow() {
  const c = activeChat();
  if (!c)
    return `<div class="cw"><div class="msgs"><p class="muted">เลือกแชทจากรายการด้านซ้าย</p></div></div>`;
  const msgs = c.msgs
    .map((m) => {
      const mine = m.from === "staff";
      const who = mine ? BRAND : "ลูกค้า";
      const body =
        (m.img
          ? `<a href="${m.img}" target="_blank" rel="noopener"><img src="${m.img}" alt="รูปจากแชท"></a>`
          : "") + esc(m.text);
      return `<small class="${mine ? "r" : ""}">${who} · ${m.time}</small><div class="bub${mine ? " me" : ""}">${body}</div>`;
    })
    .join("");
  const closed = c.status === "closed";
  return `<div class="cw">
<header><div>${esc(c.customer)}<small>${CHAT_STATUS[c.status]}${c.order ? " · คำสั่งซื้อ " + c.order : ""}</small></div>${closed ? "" : '<button class="btn line sm" onclick="closeChat()">ปิดแชท</button>'}</header>
<div class="msgs">${msgs || '<p class="muted">ยังไม่มีข้อความ</p>'}</div>
${
  closed
    ? '<div class="cin muted">แชทนี้ปิดแล้ว</div>'
    : `<div class="quick">${QUICK.map((q, i) => `<button class="btn line sm" onclick="useQuick(${i})">${esc(q.slice(0, 18))}…</button>`).join("")}</div>
<div class="cin"><textarea id="cm" rows="2" placeholder="ตอบลูกค้า…" aria-label="ข้อความตอบลูกค้า" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}">${esc(draft)}</textarea><button class="btn" id="sendBtn" onclick="send()">ส่ง</button></div>`
}
</div>`;
}

// ========== สินค้า: จัดการ (copy จาก warehouse.js) ==========
async function addP() {
  if (!guard("products")) return;
  const n = $("#np").value.trim(),
    c = +$("#nc").value,
    q = +$("#nq").value || 0,
    zone = $("#nz").value,
    d = $("#nd").value.trim();
  if (!n || !c) {
    toast("กรอกชื่อสินค้าและราคาก่อน");
    return;
  }

  // 1) products → ได้ id กลับมา
  const { data: p, error: e1 } = await sb
    .from("products")
    .insert({ name: n, description: d })
    .select("id")
    .single();
  if (e1) return toast("เพิ่มไม่สำเร็จ: " + errText(e1));

  // product_variants (SKU ห้ามซ้ำ สร้างจากเวลา)
  const sku = "HPB-" + Date.now().toString(36).toUpperCase();
  const { error: e2 } = await sb
    .from("product_variants")
    .insert({ product_id: p.id, sku, price: c, stock_qty: q });
  if (e2) return toast("เพิ่มราคา/สต๊อกไม่สำเร็จ: " + errText(e2));

  // product_categories (โซน)
  if (catId[zone]) {
    await sb
      .from("product_categories")
      .insert({ product_id: p.id, category_id: catId[zone] });
  }

  await Promise.all([loadProducts(), loadLogs()]);
  go("products");
  toast("เพิ่มสินค้าแล้ว");
}
async function adjust(i) {
  if (!guard("products")) return;
  const d = parseInt($("#ad" + i).value, 10);
  if (!d) {
    toast("ใส่จำนวนที่ต้องการปรับ เช่น 10 หรือ -3");
    return;
  }
  const p = products[i];
  if (p.qty + d < 0) {
    toast("ลดแล้วสต๊อกติดลบไม่ได้");
    return;
  }

  // บันทึกลงฐานข้อมูล (trigger จะเขียน stock_logs ให้เอง)
  const { error } = await sb
    .from("product_variants")
    .update({ stock_qty: p.qty + d })
    .eq("id", p.variantId);
  if (error) {
    toast("ปรับไม่สำเร็จ: " + errText(error));
    return;
  }

  await Promise.all([loadProducts(), loadLogs()]); // โหลดยอดล่าสุดจาก server (+ บันทึกระบบ)
  go("products");
  toast("ปรับสต๊อกแล้ว");
}
function startEdit(i) {
  if (!guard("products")) return;
  editIdx = i;
  go("products");
}
function cancelEdit() {
  editIdx = null;
  go("products");
}
async function saveEdit() {
  if (!guard("products")) return;
  const p = products[editIdx],
    n = $("#en").value.trim(),
    c = +$("#ec").value,
    zone = $("#ez").value,
    d = $("#ed").value.trim();
  if (!n || !c) {
    toast("กรอกชื่อสินค้าและราคาก่อน");
    return;
  }
  // 1) ชื่อ + รายละเอียด
  const { error: e1 } = await sb
    .from("products")
    .update({ name: n, description: d })
    .eq("id", p.id);
  if (e1) return toast("บันทึกไม่สำเร็จ: " + errText(e1));

  // 2) ราคา
  const { error: e2 } = await sb
    .from("product_variants")
    .update({ price: c })
    .eq("id", p.variantId);
  if (e2) return toast("บันทึกราคาไม่สำเร็จ: " + errText(e2));

  // 3) โซน: ลบของเก่า แล้วใส่ใหม่ (เฉพาะตอนเปลี่ยนโซน)
  if (zone !== p.zone) {
    await sb.from("product_categories").delete().eq("product_id", p.id);
    if (catId[zone]) {
      await sb
        .from("product_categories")
        .insert({ product_id: p.id, category_id: catId[zone] });
    }
  }

  editIdx = null;
  await Promise.all([loadProducts(), loadLogs()]);
  go("products");
  toast("บันทึกแล้ว");
}
async function delP(i) {
  if (!guard("products")) return;
  if (!confirm('ลบสินค้า "' + products[i].name + '" ใช่หรือไม่?')) return;

  const { error } = await sb
    .from("products")
    .update({ is_active: false })
    .eq("id", products[i].id);
  if (error) return toast("ลบไม่สำเร็จ: " + errText(error));

  editIdx = null;
  await Promise.all([loadProducts(), loadLogs()]);
  go("products");
  toast("ลบสินค้าแล้ว");
}

// ========== การเงิน: จัดการ (เหมือน accounting.js) ==========
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
  if (
    !confirm(
      "อนุมัติคืนเงิน " +
        refunds[i].code +
        " ยอด " +
        baht(refunds[i].amt) +
        " ใช่หรือไม่?",
    )
  )
    return;
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

// ========== จัดส่ง: จัดการ ==========
async function saveS(i) {
  if (!guard("shipping") || busy) return;
  const x = shipments[i],
    st = $("#ss" + i).value,
    cr = $("#cr" + i).value,
    tk = $("#tk" + i).value.trim();
  // เริ่มส่งแล้วต้องมีขนส่งและเลขพัสดุ
  if (st !== "รอจัดส่ง" && (!cr || !tk)) {
    toast("เลือกขนส่งและใส่เลขพัสดุก่อนเปลี่ยนสถานะ");
    return;
  }
  // แปลงภาษาไทยกลับเป็นรหัส เช่น "กำลังจัดส่ง" → "in_transit"
  const code = Object.keys(SHIP_STATUS).find((k) => SHIP_STATUS[k] === st);

  // Admin ไม่ต้องรับงานก่อน ถ้ายังไม่มีคนรับ ระบบตั้งให้เป็นงานของ Admin เอง
  await callRpc(
    "update_shipment",
    {
      p_order_id: x.orderId,
      p_status: code,
      p_carrier: cr || null,
      p_tracking_no: tk || null,
    },
    "บันทึกแล้ว",
  );
}
function copyAddr(i) {
  const x = shipments[i],
    t = `${x.name} ${x.phone}\n${x.addr}`;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => toast("คัดลอกที่อยู่แล้ว"))
    .catch(() => toast("คัดลอกไม่ได้ ลองเลือกข้อความเอง"));
}

// ========== แชท: จัดการ (เหมือน service.js) ==========
function openChat(id) {
  draft = "";
  active = id;
  go("chat");
}
function useQuick(i) {
  $("#cm").value = QUICK[i];
  $("#cm").focus();
}
async function send() {
  if (!guard("chat")) return;
  const c = activeChat();
  if (!c) return toast("เลือกแชทก่อน");
  const v = $("#cm").value.trim();
  if (!v) return;
  $("#sendBtn").disabled = true;

  // ข้อความบันทึกเป็น sender_type = staff ลูกค้าเห็นเป็นชื่อ BRAND ไม่เห็นชื่อพนักงาน
  const { error } = await sb.from("messages").insert({
    conversation_id: c.id,
    sender_type: "staff",
    sender_id: me.id,
    body: v,
  });
  if (error) {
    $("#sendBtn").disabled = false;
    return toast("ส่งไม่สำเร็จ: " + errText(error));
  }

  // ห้องที่ยังไม่มีคนรับ → รับเรื่องเป็นของเรา
  if (c.status === "waiting_staff") {
    const { error: e2 } = await sb
      .from("conversations")
      .update({ status: "in_progress", staff_id: me.id })
      .eq("id", c.id);
    if (e2) toast("อัปเดตสถานะแชทไม่สำเร็จ: " + errText(e2));
  }

  draft = "";
  await loadChats();
  go("chat");
}
async function closeChat() {
  if (!guard("chat")) return;
  const c = activeChat();
  if (
    !c ||
    !confirm(`ปิดแชทกับ ${c.customer}? ลูกค้าจะส่งข้อความในห้องนี้ต่อไม่ได้`)
  )
    return;
  const { error } = await sb
    .from("conversations")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", c.id);
  if (error) return toast("ปิดแชทไม่สำเร็จ: " + errText(error));
  draft = "";
  await loadChats();
  go("chat");
  toast("ปิดแชทแล้ว");
}
// ปุ่มแนะนำสินค้า: ใส่ข้อมูลสินค้าเป็นร่างข้อความในแชทที่เปิดอยู่
function recommend(i) {
  const c = activeChat();
  if (!c || c.status === "closed") {
    toast("เลือกแชทที่ยังไม่ปิดก่อน แล้วค่อยกดแนะนำสินค้า");
    go("chat");
    return;
  }
  const p = products[i];
  draft = `แนะนำ “${p.name}” ค่ะ ราคา ${baht(p.price)}${p.desc ? " · " + p.desc : ""}${p.qty <= 0 ? " (ขณะนี้สินค้าหมดชั่วคราว)" : ""}`;
  go("chat");
  toast("ใส่ข้อความแนะนำสินค้าให้แล้ว แก้ไขก่อนส่งได้");
}
// ========== ผู้ใช้: จัดการ ==========
// ปุ่มลูกตา: สลับแสดง/ซ่อนรหัสผ่าน (เหมือนหน้า login)
function togglePw() {
  const show = $("#up").type === "password";
  $("#up").type = show ? "text" : "password";
  $("#eye").setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
  $("#eye").setAttribute("aria-pressed", String(show));
}
// เพิ่มพนักงาน: ต้องสร้างบัญชีที่ Edge Function create-staff (ฝั่ง server)
// ห้ามใช้ sb.auth.signUp() เพราะ Admin จะหลุดไปเป็นบัญชีใหม่ และบัญชีใหม่ได้ role customer
async function addU() {
  if (!guard("users") || busy) return;
  const full_name = $("#un").value.trim(),
    email = $("#ue").value.trim().toLowerCase(),
    role = $("#ur").value,
    password = $("#up").value;
  if (!full_name || !email || password.length < 6) {
    toast("กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 6 ตัว");
    return;
  }
  if (staff.some((s) => s.email === email)) {
    toast("อีเมลนี้มีในระบบแล้ว");
    return;
  }
  busy = true;
  const { error } = await sb.functions.invoke("create-staff", {
    body: { email, full_name, role, password },
  });
  busy = false;
  if (error) {
    // ยังไม่ได้ deploy: server ตอบ 404 โดยไม่มี CORS เบราว์เซอร์เลยบล็อกเป็น FunctionsFetchError
    // (error สีแดง "blocked by CORS policy" ใน console มาจากกรณีนี้)
    if (error.name === "FunctionsFetchError" || error.context?.status === 404)
      return toast("ติดต่อระบบเพิ่มพนักงานไม่ได้ (Edge Function create-staff ยังไม่ได้ deploy หรือเน็ตหลุด)");
    // ข้อความภาษาไทยจาก Edge Function อยู่ใน body ของ response เช่น "อีเมลนี้มีบัญชีอยู่แล้ว"
    const msg = await error.context?.json?.().then((b) => b.error).catch(() => null);
    return toast("เพิ่มพนักงานไม่สำเร็จ: " + (msg || errText(error)));
  }
  await Promise.all([loadStaff(), loadLogs()]);
  go("users");
  toast("เพิ่มพนักงานแล้ว");
}
// เปลี่ยนตำแหน่ง (ระบบบันทึก audit_logs ให้เอง)
async function setRole(i) {
  if (!guard("users")) return;
  const s = staff[i],
    role = $("#ro" + i).value;
  if (role === s.role) return;
  if (
    !confirm(`เปลี่ยน ${s.name || s.email} เป็น ${ROLES[role]} ใช่หรือไม่?`)
  ) {
    $("#ro" + i).value = s.role; // ยกเลิก → คืนค่าเดิมใน dropdown
    return;
  }
  const { error } = await sb.from("profiles").update({ role }).eq("id", s.id);
  if (error) return toast("เปลี่ยนตำแหน่งไม่สำเร็จ: " + errText(error));
  await Promise.all([loadStaff(), loadLogs()]);
  go("users");
  toast("เปลี่ยนตำแหน่งแล้ว");
}
// ปิด/เปิดบัญชี: ลบ profile ไม่ได้ ใช้ is_active แทน (ปิดแล้วเข้าระบบไม่ได้ทันที)
async function toggleActive(i) {
  if (!guard("users")) return;
  const s = staff[i],
    next = !s.active;
  if (!confirm(`${next ? "เปิด" : "ปิด"}บัญชี ${s.email} ใช่หรือไม่?`)) return;
  const { error } = await sb
    .from("profiles")
    .update({ is_active: next })
    .eq("id", s.id);
  if (error) return toast("บันทึกไม่สำเร็จ: " + errText(error));
  await Promise.all([loadStaff(), loadLogs()]);
  go("users");
  toast(next ? "เปิดบัญชีแล้ว" : "ปิดบัญชีแล้ว");
}

// ========== เริ่มทำงาน ==========
(async () => {
  me = await requireStaff("admin");
  $("#tn").textContent = me.full_name || ROLE_NAME[me.role];
  $("#te").textContent = me.email;
  await loadStaff(); // ต้องมาก่อน เพราะตารางประวัติใช้ actor()
  await loadLogs();
  await Promise.all([loadProducts(), loadOrders(), loadShipments()]);
  await loadPayments();
  await loadChats(); // ใช้เลข HPB จาก orders
  listenChats();
  go("overview");
})();
