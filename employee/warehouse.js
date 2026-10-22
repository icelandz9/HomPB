// ========== ผู้ใช้ปัจจุบัน (เชื่อมกับ Login ภายหลัง) ==========
const me = {
  name: "ฝ่ายคลังสินค้า",
  email: "stock@hompb.com",
  role: "ฝ่ายคลังสินค้า",
};

// ========== สิทธิ์ของฝ่ายคลัง: M = จัดการ, V = ดูอย่างเดียว ==========
const ACL = { overview: "V", products: "M", orders: "V" };
const PAGES = [
  ["overview", "ภาพรวม", "▦"],
  ["products", "สินค้า & สต๊อก", "◫"],
  ["orders", "คำสั่งซื้อ", "☰"],
];
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
const LOW = 10; // ต่ำกว่าหรือเท่ากับค่านี้ถือว่า "ใกล้หมด"

// ========== ข้อมูล (ว่างไว้ก่อน ค่อยเชื่อม API/ฐานข้อมูลภายหลัง) ==========
let products = []; // {id,name,zone,price,qty,desc}
let orders = []; // {id,items,status,date}  (ฝ่ายคลังเห็นแค่นี้)
let movements = []; // ประวัติการปรับสต๊อก [เวลา, รหัส, ชื่อ, จำนวนที่ปรับ, เหตุผล, คงเหลือใหม่, ผู้ทำ]
let editIdx = null; // แถวที่กำลังแก้รายละเอียด

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
      ? '<span class="pill w">ใกล้หมด</span>'
      : '<span class="pill o">ปกติ</span>';
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
  window.scrollTo(0, 0);
}

// ========== เนื้อหาแต่ละหน้า ==========
const VIEWS = {
  // ---- ภาพรวม (ดูอย่างเดียว) ----
  overview() {
    const k = (l, v) => `<div class="kpi"><p>${l}</p><b>${v}</b></div>`;
    return `<div class="kpis">
${k("สินค้าทั้งหมด", products.length)}
${k("สินค้าใกล้หมด (≤" + LOW + ")", products.filter((p) => p.qty > 0 && p.qty <= LOW).length)}
${k("สินค้าหมดสต๊อก", products.filter((p) => p.qty <= 0).length)}
</div>`;
  },

  // ---- สินค้า & สต๊อก (จัดการได้) ----
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
            rowsHtml(),
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
          "mrow",
        ),
      )
    );
  },

  // ---- คำสั่งซื้อ (ดูอย่างเดียว ไม่แสดงที่อยู่/ยอดเงิน) ----
  orders() {
    const rows = orders
      .map(
        (o) =>
          `<tr><td><b>${o.id}</b></td><td>${esc(o.items)}</td><td>${esc(o.status)}</td><td>${o.date}</td></tr>`,
      )
      .join("");
    return card(
      "คำสั่งซื้อ",
      "ดูอย่างเดียว · ใช้ตรวจสอบสินค้าที่ต้องเตรียม",
      table(["คำสั่งซื้อ", "สินค้า", "สถานะ", "วันที่"], rows),
    );
  },
};

// ========== ตารางสินค้า (กรองได้) ==========
function rowsHtml() {
  const q = ($("#fq")?.value || "").trim().toLowerCase(),
    z = $("#fz")?.value || "",
    s = $("#fs")?.value || "";
  return products
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)) &&
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
<td>${p.id}</td><td><b>${esc(p.name)}</b></td><td>${p.zone}</td><td>${baht(p.price)}</td>
<td><b>${p.qty}</b></td><td>${stockPill(p.qty)}</td>
<td><input class="num" type="number" id="ad${i}" placeholder="+10 / -3" aria-label="ปรับจำนวน"></td>
<td><select id="rs${i}">${REASONS.map((r) => `<option>${r}</option>`).join("")}</select></td>
<td><div class="acts"><button class="btn sm" onclick="adjust(${i})">ปรับ</button><button class="btn line sm" onclick="startEdit(${i})">แก้ไข</button><button class="btn line sm" onclick="delP(${i})">ลบ</button></div></td></tr>`,
    )
    .join("");
}
function renderRows() {
  const html = rowsHtml();
  $("#prow").innerHTML =
    html || '<tr><td class="empty" colspan="9">ไม่พบสินค้า</td></tr>';
}

// ========== ฟอร์มแก้ไขรายละเอียดสินค้า ==========
function editForm() {
  const p = products[editIdx];
  return card(
    "แก้ไขรายละเอียดสินค้า " + p.id,
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

// ========== ฟังก์ชันจัดการสินค้า (จุดที่ต้องเชื่อม API ภายหลัง) ==========
function addMove(p, delta, reason) {
  movements.unshift([
    new Date().toLocaleString("th-TH"),
    p.id,
    p.name,
    delta,
    reason,
    p.qty,
    me.email,
  ]);
}
function addP() {
  if (!guard("products")) return;
  const n = $("#np").value.trim(),
    c = +$("#nc").value,
    q = +$("#nq").value || 0;
  if (!n || !c) {
    toast("กรอกชื่อสินค้าและราคาก่อน");
    return;
  }
  const id = "p" + (Math.max(0, ...products.map((p) => +p.id.slice(1))) + 1);
  const p = {
    id,
    name: n,
    zone: $("#nz").value,
    price: c,
    qty: q,
    desc: $("#nd").value.trim(),
  };
  products.push(p);
  if (q > 0) addMove(p, q, "เพิ่มสินค้าใหม่");
  go("products");
  toast("เพิ่มสินค้าแล้ว");
}
function adjust(i) {
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
  p.qty += d;
  addMove(p, d, $("#rs" + i).value);
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
function saveEdit() {
  if (!guard("products")) return;
  const p = products[editIdx],
    n = $("#en").value.trim(),
    c = +$("#ec").value;
  if (!n || !c) {
    toast("กรอกชื่อสินค้าและราคาก่อน");
    return;
  }
  p.name = n;
  p.zone = $("#ez").value;
  p.price = c;
  p.desc = $("#ed").value.trim();
  editIdx = null;
  go("products");
  toast("บันทึกแล้ว");
}
function delP(i) {
  if (!guard("products")) return;
  if (!confirm('ลบสินค้า "' + products[i].name + '" ใช่หรือไม่?')) return;
  products.splice(i, 1);
  editIdx = null;
  go("products");
  toast("ลบสินค้าแล้ว");
}

// ========== เริ่มทำงาน ==========
$("#tn").textContent = me.name;
$("#te").textContent = me.email;
go("overview");
