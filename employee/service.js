// ========== ผู้ใช้ปัจจุบัน (เชื่อมกับ Login ภายหลัง) ==========
const me = {
  name: "ฝ่ายบริการลูกค้า-ฝ่ายขาย",
  email: "cs@hompb.com",
  role: "ฝ่ายบริการลูกค้า-ฝ่ายขาย",
};
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
// ข้อความสำเร็จรูป (แก้ได้ตามต้องการ)
const QUICK = [
  "สวัสดีค่ะ ยินดีให้บริการค่ะ",
  "รบกวนขอเลขคำสั่งซื้อด้วยนะคะ",
  "ขอบคุณที่ติดต่อมานะคะ มีอะไรให้ช่วยเพิ่มเติมไหมคะ",
];

// ========== ข้อมูล (ว่างไว้ก่อน ค่อยเชื่อม API/ฐานข้อมูลภายหลัง) ==========
let products = []; // {id,name,zone,price,qty,desc}  (อ่านอย่างเดียว)
let orders = []; // {id,cust,items,status,date}    (ไม่มีที่อยู่/ยอดเงิน)
// chats: [{id,customer,open:true|false, msgs:[{from:'cus'|'bot'|'staff',text,time}]}]
let chats = [];
let active = null; // ลำดับแชทที่เปิดอยู่
let draft = ""; // ร่างข้อความ (เช่น จากปุ่มแนะนำสินค้า)

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
  toast("เชื่อมปุ่มออกจากระบบกับหน้า Login ภายหลัง");
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

// ========== เปลี่ยนหน้า (เมนูแสดงตามสิทธิ์) ==========
function go(p) {
  if (!ACL[p]) p = "overview";
  $("#nav").innerHTML = PAGES.filter((x) => ACL[x[0]])
    .map(
      (x) =>
        `<button class="${x[0] === p ? "on" : ""}" onclick="go('${x[0]}')"><span aria-hidden="true">${x[2]}</span>${x[1]}</button>`,
    )
    .join("");
  const t = PAGES.find((x) => x[0] === p)[1];
  $("#pg").innerHTML =
    `<h1>${t}</h1><p class="who">${me.role} · สิทธิ์: ${canM(p) ? "จัดการ" : "ดูอย่างเดียว"}</p>` +
    VIEWS[p]();
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
${k("แชทที่รอตอบ", chats.filter((c) => c.open).length)}
${k("แชททั้งหมด", chats.length)}
${k("สินค้าที่มีขาย", products.filter((p) => p.qty > 0).length)}
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
          `<tr><td><b>${o.id}</b></td><td>${esc(o.cust)}</td><td>${esc(o.items)}</td><td>${esc(o.status)}</td><td>${o.date}</td></tr>`,
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
          .map((c, i) => {
            const last = c.msgs[c.msgs.length - 1];
            return `<button class="cl${i === active ? " on" : ""}" onclick="openChat(${i})">
<div class="row"><b>${esc(c.customer)}</b>${c.open ? '<span class="pill w">รอตอบ</span>' : '<span class="pill o">ตอบแล้ว</span>'}</div>
<small>${last ? esc(last.text) : ""}</small></button>`;
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
function chatWindow() {
  if (active === null || !chats[active])
    return `<div class="cw"><div class="msgs"><p class="muted">เลือกแชทจากรายการด้านซ้าย</p></div></div>`;
  const c = chats[active];
  const msgs = c.msgs
    .map((m) => {
      const who =
        m.from === "cus" ? "ลูกค้า" : m.from === "bot" ? "บอท HomPB" : BRAND;
      const mine = m.from === "staff";
      return `<small class="${mine ? "r" : ""}">${who}${m.time ? " · " + m.time : ""}</small><div class="bub${mine ? " me" : ""}">${esc(m.text)}</div>`;
    })
    .join("");
  return `<div class="cw">
<header>${esc(c.customer)}<small>${c.open ? "รอเจ้าหน้าที่ตอบ" : "ตอบแล้ว"}</small></header>
<div class="msgs">${msgs}</div>
<div class="quick">${QUICK.map((q, i) => `<button class="btn line sm" onclick="useQuick(${i})">${esc(q.slice(0, 18))}…</button>`).join("")}</div>
<div class="cin"><textarea id="cm" rows="2" placeholder="ตอบลูกค้า…" aria-label="ข้อความตอบลูกค้า" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}">${esc(draft)}</textarea><button class="btn" onclick="send()">ส่ง</button></div>
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
          p.id.toLowerCase().includes(q)) &&
        (!z || p.zone === z),
    )
    .map(
      ({
        p,
        i,
      }) => `<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${p.zone}</td><td>${baht(p.price)}</td><td>${stockPill(p.qty)}</td><td class="muted">${esc(p.desc || "-")}</td>
<td><button class="btn sm" onclick="recommend(${i})">แนะนำในแชท</button></td></tr>`,
    )
    .join("");
}
function renderRows() {
  $("#prow").innerHTML =
    rowsHtml() || '<tr><td class="empty" colspan="7">ไม่พบสินค้า</td></tr>';
}

// ========== ฟังก์ชันแชท (จุดที่ต้องเชื่อม API ภายหลัง) ==========
function openChat(i) {
  draft = "";
  active = i;
  go("chat");
}
function useQuick(i) {
  $("#cm").value = QUICK[i];
  $("#cm").focus();
}
function send() {
  if (!guard("chat")) return;
  const v = $("#cm").value.trim();
  if (!v) return;
  if (active === null || !chats[active]) {
    toast("เลือกแชทก่อน");
    return;
  }
  chats[active].msgs.push({
    from: "staff",
    text: v,
    time: new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
  chats[active].open = false;
  draft = "";
  // TODO: ส่งข้อความไปให้ฝั่งลูกค้า (ใช้ชื่อ BRAND ไม่ส่งชื่อพนักงาน)
  go("chat");
}
// ปุ่มแนะนำสินค้า: ใส่ข้อมูลสินค้าเป็นร่างข้อความในแชทที่เปิดอยู่
function recommend(i) {
  if (active === null || !chats[active]) {
    toast("เลือกแชทลูกค้าก่อน แล้วค่อยกดแนะนำสินค้า");
    go("chat");
    return;
  }
  const p = products[i];
  draft = `แนะนำ “${p.name}” ค่ะ ราคา ${baht(p.price)}${p.desc ? " · " + p.desc : ""}${p.qty <= 0 ? " (ขณะนี้สินค้าหมดชั่วคราว)" : ""}`;
  go("chat");
  toast("ใส่ข้อความแนะนำสินค้าให้แล้ว แก้ไขก่อนส่งได้");
}

// ========== เริ่มทำงาน ==========
$("#tn").textContent = me.name;
$("#te").textContent = me.email;
go("overview");
