// ========== ผู้ใช้ปัจจุบัน (เชื่อมกับ Login ภายหลัง) ==========
let me = null; // ได้ค่าจริงตอนเริ่มทำงาน (ดูท้ายไฟล์)

// ========== สิทธิ์ของฝ่ายจัดส่ง: M = จัดการ, V = ดูอย่างเดียว ==========
const ACL = { overview: "V", orders: "V", shipping: "M" };
const PAGES = [
  ["overview", "ภาพรวม", "▦"],
  ["orders", "คำสั่งซื้อ", "☰"],
  ["shipping", "จัดส่ง & ที่อยู่ลูกค้า", "⛟"],
];
const STATUSES = ["รอจัดส่ง", "กำลังจัดส่ง", "จัดส่งสำเร็จ", "ส่งไม่สำเร็จ"];
const CARRIERS = [
  "ไปรษณีย์ไทย",
  "Flash Express",
  "J&T Express",
  "Kerry Express",
  "อื่น ๆ",
];

// สถานะใน shipments → ภาษาไทย
const SHIP_STATUS = {
  preparing: "รอจัดส่ง",
  in_transit: "กำลังจัดส่ง",
  delivered: "จัดส่งสำเร็จ",
  failed: "ส่งไม่สำเร็จ",
};

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

// ========== โหลดข้อมูลจาก Supabase ==========
// ดึง shipments พร้อม orders (ที่อยู่ลูกค้า) และ order_items ในคำขอเดียว
// RLS: ฝ่ายจัดส่งเห็นเฉพาะงานของตัวเอง + งานที่ยังไม่มีคนรับ
async function loadData() {
  const { data, error } = await sb
    .from("shipments")
    .select(
      "order_id, carrier, tracking_no, status, handled_by, shipped_at, delivered_at,orders ( order_no, shipping_address, created_at, order_items ( product_name, quantity ) )",
    );
  if (error) return toast("โหลดงานจัดส่งไม่สำเร็จ: " + errText(error));

  shipments = data
    .filter((x) => x.orders)
    .map((x) => {
      const o = x.orders,
        a = o.shipping_address || {};
      return {
        orderId: x.order_id, // uuid ใช้ตอนเรียก RPC
        code: "HPB" + o.order_no, // แสดงให้คนอ่าน
        name: a.recipient_name || "-",
        phone: a.phone || "-",
        addr: [
          a.address_line,
          a.subdistrict,
          a.district,
          a.province,
          a.postcode,
        ].join(" "),
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
    });

  // หน้า "คำสั่งซื้อ" ใช้ข้อมูลชุดเดียวกับงานจัดส่ง
  orders = shipments.map((x) => ({
    id: x.code,
    name: x.name,
    phone: x.phone,
    items: x.items,
    addr: x.addr,
    status: x.status,
    date: x.date,
  }));

  // ประวัติ: สร้างจากเวลาเริ่มส่ง / ส่งถึง ที่ฐานข้อมูลบันทึกไว้
  history = [];
  shipments.forEach((x) => {
    const who = x.handledBy ? me.full_name || "ฉัน" : "-";
    if (x.shippedAt)
      history.push([
        x.shippedAt,
        x.code,
        "กำลังจัดส่ง",
        x.carrier,
        x.track,
        who,
      ]);
    if (x.deliveredAt)
      history.push([
        x.deliveredAt,
        x.code,
        "จัดส่งสำเร็จ",
        x.carrier,
        x.track,
        who,
      ]);
  });
  history.sort((a, b) => new Date(b[0]) - new Date(a[0])); // ใหม่สุดขึ้นก่อน
  history.forEach((h) => (h[0] = new Date(h[0]).toLocaleString("th-TH")));
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
          x.code.toLowerCase().includes(q) ||
          x.name.toLowerCase().includes(q) ||
          x.phone.includes(q)) &&
        (!s || x.status === s),
    )
    .map(
      ({ x, i }) => `<tr>
<td><b>${x.code}</b><br><small class="muted">${x.date}</small></td>
<td>${esc(x.name)} · ${esc(x.phone)}<br><small class="muted">${esc(x.addr)}</small><br><small class="muted">${esc(x.items)}</small></td>
<td><select id="ss${i}" aria-label="สถานะการจัดส่ง">${STATUSES.map((s) => `<option${s === x.status ? " selected" : ""}>${s}</option>`).join("")}</select><br><span style="display:inline-block;margin-top:6px">${shipPill(x.status)}</span></td>
<td><select id="cr${i}" aria-label="ขนส่ง"><option value="">เลือกขนส่ง</option>${CARRIERS.map((c) => `<option${c === x.carrier ? " selected" : ""}>${c}</option>`).join("")}</select></td>
<td><input id="tk${i}" value="${esc(x.track || "")}" placeholder="เลขพัสดุ" aria-label="เลขพัสดุ"></td>
<td><div class="acts">${x.handledBy ? `<button class="btn sm" onclick="saveS(${i})">บันทึก</button>` : `<button class="btn sm" onclick="claim(${i})">รับงาน</button>`}<button class="btn line sm" onclick="copyAddr(${i})">คัดลอกที่อยู่</button></div></td></tr>`,
    )
    .join("");
}
function renderRows() {
  $("#prow").innerHTML =
    rowsHtml() || '<tr><td class="empty" colspan="6">ไม่พบรายการ</td></tr>';
}

// ========== ฟังก์ชันจัดการจัดส่ง (จุดที่ต้องเชื่อม API ภายหลัง) ==========
// รับงาน: งานนี้จะเป็นของเรา คนอื่นในฝ่ายจะไม่เห็นอีก
async function claim(i) {
  if (!guard("shipping")) return;
  const { error } = await sb.rpc("claim_shipment", {
    p_order_id: shipments[i].orderId,
  });
  if (error) return toast("รับงานไม่สำเร็จ: " + errText(error));

  await loadData();
  go("shipping");
  toast("รับงานแล้ว");
}
async function saveS(i) {
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

  // แปลงภาษาไทยกลับเป็นรหัส เช่น "กำลังจัดส่ง" → "in_transit"
  const code = Object.keys(SHIP_STATUS).find((k) => SHIP_STATUS[k] === st);

  const { error } = await sb.rpc("update_shipment", {
    p_order_id: x.orderId,
    p_status: code,
    p_carrier: cr || null,
    p_tracking_no: tk || null,
  });
  if (error) return toast("บันทึกไม่สำเร็จ: " + errText(error));

  await loadData();
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
(async () => {
  me = await requireStaff("shipping");
  $("#tn").textContent = me.full_name || ROLE_NAME[me.role];
  $("#te").textContent = me.email;
  await loadData();
  go("overview");
})();
