// ========== ผู้ใช้ปัจจุบัน (ได้จาก requireStaff ตอนเริ่มทำงาน) ==========
let me = null;
const BRAND = "ฝ่ายบริการลูกค้า HomPB"; // ชื่อที่ลูกค้าเห็น (ไม่แสดงชื่อพนักงาน)

// ========== สิทธิ์ของฝ่ายนี้: M = จัดการ, V = ดูอย่างเดียว ==========
const ACL = { overview: "V", products: "V", orders: "V", chat: "M" };
const PAGES = [
  ["overview", "ภาพรวม", "▦"],
  ["products", "สินค้า & สต๊อก", "◫"],
  ["orders", "คำสั่งซื้อ", "☰"],
  ["chat", "แชทลูกค้า", "✉"],
];
const ZONES = [
  "ห้องนอน",
  "ห้องน้ำ",
  "ห้องนั่งเล่น",
  "ห้องครัว",
  "เครื่องใช้ไฟฟ้า",
];
const LOW = 10;

const ORDER_STATUS = {
  pending_payment: "รอชำระเงิน",
  awaiting_approval: "รอตรวจสลิป",
  approved: "ชำระแล้ว",
  shipping: "กำลังจัดส่ง",
  delivered: "ส่งถึงแล้ว",
  cancelled: "ยกเลิก",
  refunded: "คืนเงินแล้ว",
};

// ข้อความสำเร็จรูป (แก้ได้ตามต้องการ)
const QUICK = [
  "สวัสดีค่ะ ยินดีให้บริการค่ะ",
  "รบกวนขอเลขคำสั่งซื้อด้วยนะคะ",
  "ขอบคุณที่ติดต่อมานะคะ มีอะไรให้ช่วยเพิ่มเติมไหมคะ",
];

const CHAT_STATUS = {
  waiting_staff: "รอรับเรื่อง",
  in_progress: "กำลังคุย",
  closed: "ปิดแล้ว",
};

// ========== ข้อมูล (โหลดจาก Supabase) ==========
let products = []; // {id,sku,name,zone,price,qty,desc}  (อ่านอย่างเดียว)
let orders = []; // {id,code,cust,items,status,date}    (ไม่มีที่อยู่/ยอดเงิน)
// chats: [{id,customer,status,order,waiting, msgs:[{from:'cus'|'staff',text,img,time}]}]
let chats = [];
let active = null; // id ของแชทที่เปิดอยู่
let draft = ""; // ร่างข้อความ (เช่น จากปุ่มแนะนำสินค้า)
let cur = "overview"; // หน้าที่เปิดอยู่ (ใช้ตอนมีข้อความใหม่เข้ามา)

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
      ? '<span class="pill w">เหลือน้อย</span>'
      : '<span class="pill o">มีสินค้า</span>';
}

// ========== โหลดข้อมูลจาก Supabase ==========
// สินค้า: เหมือน warehouse.js แต่ไม่ดึง stock_logs (ฝ่ายขายอ่านไม่ได้)
async function loadProducts() {
  const { data, error } = await sb
    .from("products")
    .select(
      "id, name, description, product_variants (sku, price, stock_qty), product_categories (categories (name))",
    )
    .eq("is_active", true);
  if (error) return toast("โหลดสินค้าไม่สำเร็จ: " + errText(error));

  products = data.map((p) => {
    const v = p.product_variants[0] || {}; // 1 สินค้า = 1 variant
    return {
      id: p.id,
      sku: v.sku || "-",
      name: p.name,
      zone: p.product_categories[0]?.categories?.name || "-",
      price: v.price || 0,
      qty: v.stock_qty || 0,
      desc: p.description || "",
    };
  });
}

// คำสั่งซื้อ: ตาราง orders มีที่อยู่ ฝ่ายขายอ่านไม่ได้ จึงใช้ view orders_for_staff
async function loadOrders() {
  const [o, it] = await Promise.all([
    sb
      .from("orders_for_staff")
      .select("id, order_no, user_id, status, created_at")
      .order("created_at", { ascending: false }),
    sb.from("order_items").select("order_id, product_name, quantity"),
  ]);
  if (o.error || it.error)
    return toast("โหลดคำสั่งซื้อไม่สำเร็จ: " + errText(o.error || it.error));

  // ชื่อลูกค้า: ฝ่ายขายเห็นเฉพาะลูกค้าที่เคยแชท คนอื่นแสดง "-"
  const ids = [...new Set(o.data.map((x) => x.user_id))];
  const { data: profs } = ids.length
    ? await sb.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const custName = Object.fromEntries(
    (profs || []).map((x) => [x.id, x.full_name]),
  );

  // จัดกลุ่มสินค้าตามคำสั่งซื้อ
  const items = {};
  for (const x of it.data) {
    (items[x.order_id] ||= []).push(`${x.product_name} ×${x.quantity}`);
  }

  orders = o.data.map((x) => ({
    id: x.id,
    code: "HPB" + x.order_no,
    cust: custName[x.user_id] || "-",
    items: (items[x.id] || []).join(", ") || "-",
    status: ORDER_STATUS[x.status] || x.status,
    date: new Date(x.created_at).toLocaleString("th-TH"),
  }));
}

// รูปในแชทอยู่ใน bucket ส่วนตัว ต้องขอลิงก์ชั่วคราวก่อน (เหมือน accounting.js)
async function signedUrls(bucket, paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map((x) => [x.path, x.signedUrl]));
}

// แชท: ห้องที่ยังไม่ปิดขึ้นก่อน แล้วเรียงตามข้อความล่าสุด
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
  const reload = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      await loadChats();
      if (cur === "chat" || cur === "overview") {
        if ($("#cm")) draft = $("#cm").value; // เก็บข้อความที่พิมพ์ค้างไว้
        go(cur);
      }
    }, 300);
  };
  sb.channel("service-chat")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, reload)
    .subscribe();
}

// ========== เปลี่ยนหน้า (เมนูแสดงตามสิทธิ์) ==========
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
  const m = $(".msgs");
  if (m) m.scrollTop = m.scrollHeight;
  window.scrollTo(0, 0);
}

// ========== เนื้อหาแต่ละหน้า ==========
const VIEWS = {
  // ---- ภาพรวม (ดูอย่างเดียว) ----
  overview() {
    const k = (l, v) => `<div class="kpi"><p>${l}</p><b>${v}</b></div>`;
    return `<div class="kpis">
${k("แชทที่รอตอบ", chats.filter((c) => c.waiting).length)}
${k("แชทที่ยังไม่ปิด", chats.filter((c) => c.status !== "closed").length)}
${k("สินค้าที่มีขาย", products.filter((p) => p.qty > 0).length)}
${k("คำสั่งซื้อทั้งหมด", orders.length)}
</div>`;
  },

  // ---- สินค้า & สต๊อก (ดูอย่างเดียว ไว้แนะนำลูกค้า) ----
  products() {
    return card(
      "สินค้า",
      'ดูอย่างเดียว · กด "แนะนำในแชท" เพื่อส่งข้อมูลสินค้าไปเป็นร่างข้อความ',
      `<div class="filters">
<div><label for="fq">ค้นหาสินค้า</label><input id="fq" placeholder="ชื่อหรือรหัสสินค้า" oninput="renderRows()"></div>
<div><label for="fz">โซน</label><select id="fz" onchange="renderRows()"><option value="">ทุกโซน</option>${ZONES.map((z) => `<option>${z}</option>`).join("")}</select></div>
</div>` +
        table(
          ["รหัส", "ชื่อสินค้า", "โซน", "ราคา (฿)", "สถานะ", "รายละเอียด", ""],
          rowsHtml(),
          "prow",
        ),
    );
  },

  // ---- คำสั่งซื้อ (ดูอย่างเดียว ไม่แสดงที่อยู่/ยอดเงิน) ----
  orders() {
    const rows = orders
      .map(
        (o) =>
          `<tr><td><b>${o.code}</b></td>
        <td>${esc(o.cust)}</td>
        <td>${esc(o.items)}</td>
        <td>${esc(o.status)}</td>
        <td>${o.date}</td></tr>`,
      )
      .join("");
    return card(
      "คำสั่งซื้อ",
      "ดูอย่างเดียว · ที่อยู่เห็นได้เฉพาะฝ่ายจัดส่ง ยอดเงินเห็นได้เฉพาะฝ่ายบัญชี",
      table(["คำสั่งซื้อ", "ลูกค้า", "สินค้า", "สถานะ", "วันที่"], rows),
    );
  },

  // ---- แชทลูกค้า (จัดการได้) ----
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
};

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

// ========== ตารางสินค้า (กรองได้) ==========
function rowsHtml() {
  const q = ($("#fq")?.value || "").trim().toLowerCase(),
    z = $("#fz")?.value || "";
  return products
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)) &&
        (!z || p.zone === z),
    )
    .map(
      ({
        p,
        i,
      }) => `<tr><td>${p.sku}</td><td><b>${esc(p.name)}</b></td><td>${p.zone}</td><td>${baht(p.price)}</td><td>${stockPill(p.qty)}</td><td class="muted">${esc(p.desc || "-")}</td>
<td><button class="btn sm" onclick="recommend(${i})">แนะนำในแชท</button></td></tr>`,
    )
    .join("");
}
function renderRows() {
  $("#prow").innerHTML =
    rowsHtml() || '<tr><td class="empty" colspan="7">ไม่พบสินค้า</td></tr>';
}

// ========== ฟังก์ชันแชท ==========
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
  if (!c || !confirm(`ปิดแชทกับ ${c.customer}? ลูกค้าจะส่งข้อความในห้องนี้ต่อไม่ได้`))
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

// ========== เริ่มทำงาน ==========
(async () => {
  me = await requireStaff("sales");
  $("#tn").textContent = me.full_name || ROLE_NAME[me.role];
  $("#te").textContent = me.email;
  await Promise.all([loadProducts(), loadOrders()]);
  await loadChats(); // ใช้เลขคำสั่งซื้อจาก orders
  listenChats();
  go("overview");
})();
