// ========== ผู้ใช้ปัจจุบัน (เชื่อมกับ Login ภายหลัง) ==========
const me = { name: "ฝ่ายจัดส่ง", email: "ship@hompb.com", role: "ฝ่ายจัดส่ง" };

// ========== สิทธิ์ของฝ่ายจัดส่ง: M = จัดการ, V = ดูอย่างเดียว ==========
const ACL = { overview: "V", orders: "V", shipping: "M" };
const PAGES = [
  ["overview", "ภาพรวม", "▦"],
  ["orders", "คำสั่งซื้อ", "☰"],
  ["shipping", "จัดส่ง & ที่อยู่ลูกค้า", "⛟"],
];
const STATUSES = ["รอจัดส่ง", "กำลังจัดส่ง", "จัดส่งสำเร็จ"];
const CARRIERS = [
  "ไปรษณีย์ไทย",
  "Flash Express",
  "J&T Express",
  "Kerry Express",
  "อื่น ๆ",
];

// ========== ข้อมูล (ว่างไว้ก่อน ค่อยเชื่อม API/ฐานข้อมูลภายหลัง) ==========
// shipments: เฉพาะคำสั่งซื้อที่ชำระเงินแล้ว
// {orderId,name,phone,addr,items,date,status,carrier,track}
let shipments = [];
// orders: {id,name,phone,items,addr,status,date}  (ไม่มียอดเงิน)
let orders = [];
// history: [เวลา, คำสั่งซื้อ, สถานะใหม่, ขนส่ง, เลขพัสดุ, ผู้ทำ]
let history = [];

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
function shipPill(s) {
  return s === "จัดส่งสำเร็จ"
    ? `<span class="pill o">${s}</span>`
    : s === "กำลังจัดส่ง"
      ? `<span class="pill w">${s}</span>`
      : `<span class="pill r">${s}</span>`;
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
    const n = (s) => shipments.filter((x) => x.status === s).length;
    return `<div class="kpis">
${k("งานจัดส่งทั้งหมด", shipments.length)}
${k("รอจัดส่ง", n("รอจัดส่ง"))}
${k("กำลังจัดส่ง", n("กำลังจัดส่ง"))}
${k("จัดส่งสำเร็จ", n("จัดส่งสำเร็จ"))}
</div>`;
  },

  // ---- คำสั่งซื้อ (ดูอย่างเดียว เห็นที่อยู่ ไม่เห็นยอดเงิน) ----
  orders() {
    const rows = orders
      .map(
        (o) =>
          `<tr><td><b>${o.id}</b></td><td>${esc(o.name)}</td><td>${esc(o.phone)}</td><td>${esc(o.items)}</td><td>${esc(o.addr)}</td><td>${esc(o.status)}</td><td>${o.date}</td></tr>`,
      )
      .join("");
    return card(
      "คำสั่งซื้อ",
      "ดูอย่างเดียว · ยอดเงินเห็นได้เฉพาะ Admin และฝ่ายบัญชี",
      table(
        [
          "คำสั่งซื้อ",
          "ผู้รับ",
          "เบอร์โทร",
          "สินค้า",
          "ที่อยู่",
          "สถานะ",
          "วันที่",
        ],
        rows,
      ),
    );
  },

  // ---- จัดส่ง & ที่อยู่ลูกค้า (จัดการได้) ----
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
            rowsHtml(),
            "prow",
          ),
      ) +
      card(
        "ประวัติการอัปเดตจัดส่ง",
        "บันทึกทุกครั้งที่เปลี่ยนสถานะหรือเลขพัสดุ",
        table(
          ["เวลา", "คำสั่งซื้อ", "สถานะ", "ขนส่ง", "เลขพัสดุ", "ผู้ทำรายการ"],
          history
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
};

// ========== ตารางงานจัดส่ง (กรองได้) ==========
function rowsHtml() {
  const q = ($("#fq")?.value || "").trim().toLowerCase(),
    s = $("#fs")?.value || "";
  return shipments
    .map((x, i) => ({ x, i }))
    .filter(
      ({ x }) =>
        (!q ||
          x.orderId.toLowerCase().includes(q) ||
          x.name.toLowerCase().includes(q) ||
          x.phone.includes(q)) &&
        (!s || x.status === s),
    )
    .map(
      ({ x, i }) => `<tr>
<td><b>${x.orderId}</b><br><small class="muted">${x.date}</small></td>
<td>${esc(x.name)} · ${esc(x.phone)}<br><small class="muted">${esc(x.addr)}</small><br><small class="muted">${esc(x.items)}</small></td>
<td><select id="ss${i}" aria-label="สถานะการจัดส่ง">${STATUSES.map((s) => `<option${s === x.status ? " selected" : ""}>${s}</option>`).join("")}</select><br><span style="display:inline-block;margin-top:6px">${shipPill(x.status)}</span></td>
<td><select id="cr${i}" aria-label="ขนส่ง"><option value="">เลือกขนส่ง</option>${CARRIERS.map((c) => `<option${c === x.carrier ? " selected" : ""}>${c}</option>`).join("")}</select></td>
<td><input id="tk${i}" value="${esc(x.track || "")}" placeholder="เลขพัสดุ" aria-label="เลขพัสดุ"></td>
<td><div class="acts"><button class="btn sm" onclick="saveS(${i})">บันทึก</button><button class="btn line sm" onclick="copyAddr(${i})">คัดลอกที่อยู่</button></div></td></tr>`,
    )
    .join("");
}
function renderRows() {
  $("#prow").innerHTML =
    rowsHtml() || '<tr><td class="empty" colspan="6">ไม่พบรายการ</td></tr>';
}

// ========== ฟังก์ชันจัดการจัดส่ง (จุดที่ต้องเชื่อม API ภายหลัง) ==========
function saveS(i) {
  if (!guard("shipping")) return;
  const x = shipments[i],
    st = $("#ss" + i).value,
    cr = $("#cr" + i).value,
    tk = $("#tk" + i).value.trim();
  // เริ่มส่งแล้วต้องมีขนส่งและเลขพัสดุ
  if (st !== "รอจัดส่ง" && (!cr || !tk)) {
    toast("เลือกขนส่งและใส่เลขพัสดุก่อนเปลี่ยนสถานะ");
    return;
  }
  x.status = st;
  x.carrier = cr;
  x.track = tk;
  history.unshift([
    new Date().toLocaleString("th-TH"),
    x.orderId,
    st,
    cr,
    tk,
    me.email,
  ]);
  // TODO: ส่งสถานะ/เลขพัสดุไปให้ฝั่งลูกค้าเห็น
  go("shipping");
  toast("บันทึกแล้ว");
}
function copyAddr(i) {
  const x = shipments[i],
    t = `${x.name} ${x.phone}\n${x.addr}`;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => toast("คัดลอกที่อยู่แล้ว"))
    .catch(() => toast("คัดลอกไม่ได้ ลองเลือกข้อความเอง"));
}

// ========== เริ่มทำงาน ==========
$("#tn").textContent = me.name;
$("#te").textContent = me.email;
go("overview");
