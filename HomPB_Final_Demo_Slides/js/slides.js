/* HomPB slides: สร้างกล่อง SQL, Traceability, ER, Data Dictionary และการเลื่อนสไลด์ (ต้องโหลด sql-data.js ก่อน) */
/* ---------- แยกบล็อกตามบรรทัด -- @@ ---------- */
const GROUPS = {A:"A โครงสร้าง",B:"B ฟีเจอร์",R:"R รายงาน",J:"J JOIN",C:"C constraint",D:"D ON DELETE",E:"E ACID",G:"G RLS",S:"S SQL Injection",X:"X EXPLAIN"};
const BLOCKS = {}; const ORDER = [];
(function parse(){
  const lines = SQL_TEXT.split("\n"); let cur = null;
  const close = () => { if (!cur) return; while (cur.lines.length && cur.lines[cur.lines.length-1].trim() === "") cur.lines.pop(); cur.sql = cur.lines.join("\n"); BLOCKS[cur.code] = cur; ORDER.push(cur.code); cur = null; };
  for (const ln of lines) {
    const m = ln.match(/^-- @@ (\S+) (.*)$/);
    if (m) { close(); cur = {code:m[1], title:m[2], lines:[ln], desc:[], inHead:true}; continue; }
    if (!cur) continue;
    if (/^-- =====/.test(ln)) { close(); continue; }
    if (cur.inHead) {
      if (/^--\s+\S/.test(ln) && !/^-- ----/.test(ln)) cur.desc.push(ln.replace(/^--\s*/, ""));
      else cur.inHead = false;
    }
    cur.lines.push(ln);
  }
  close();
})();

/* ผลที่ต้องเห็น: comment หัวบล็อก + ผลทดสอบจริง */
const RESULT = {
  D1:"บน schema ปัจจุบัน: ERROR 23503 ที่ stock_logs_variant_id_fkey เพราะ variant มีประวัติใน stock_logs (RESTRICT) ทั้ง transaction ไม่ลบอะไร",
  D2:"บน schema ปัจจุบัน: ERROR 23503 ที่ stock_logs_variant_id_fkey (RESTRICT) ถ้าตัวเลือกนั้นมีประวัติสต็อก ส่วน order_items.variant_id เองยังเป็น SET NULL",
  D3:"ERROR 23503 orders.user_id เป็น NO ACTION",
  C5:"บน schema ปัจจุบัน: ไม่ error เพราะตาราง shipments ไม่มี CHECK นี้ (บล็อกจบด้วย rollback ข้อมูลไม่เปลี่ยน) กฎ carrier + tracking_no บังคับอยู่ในฟังก์ชัน update_shipment() แทน",
  B11:"คืน 1 ใน 2 ชิ้น สถานะยัง delivered · คืนครบเป็น refunded",
  B12:"return_status = no_return",
  E1:"ERROR 23514 ที่ update ตัวที่ 2 แล้ว select ตรวจได้ 0 แถว (สต็อกเท่าเดิมทุกตัว)",
  E2:"UPDATE 0 แถว ไม่ error ไม่ติดลบ",
  E3:"แท็บ B รอ lock ประมาณ 4 วินาที แล้วได้ 0 แถว",
  E4:"read committed",
  S1:"leaked_rows = 3 (ตามข้อมูลตัวอย่างที่ทดสอบ)",
  S2:"rows = 0",
  G3:"ERROR 42501 แก้ role, is_active หรือ email ได้เฉพาะ Admin (trigger on_profile_update)",
  J1:"10 แถว (limit 10) จากสินค้าตัวอย่างใน seed_products.sql · ดูตารางในสไลด์ 15",
  J2:"5 ห้อง: ห้องครัว 35 · ห้องนอน 35 · ห้องนั่งเล่น 34 · ห้องน้ำ 34 · เครื่องใช้ไฟฟ้า 26 สินค้า",
  J3:"1 แถวต่อ role ที่มีผู้ใช้ จำนวนขึ้นกับข้อมูลจริงใน Supabase",
  J4:"1 แถวต่อรายการสินค้าในคำสั่งซื้อล่าสุด · ยังไม่มีการส่ง = shipment_status เป็น null",
  G5:"บน schema ปัจจุบัน: ERROR 42501 permission denied for table payments เพราะ security.sql revoke delete ของตารางเงินและ log จาก authenticated ไว้อีกชั้น (แน่นกว่า 0 แถว)",
};
function expectText(b){
  const parts = [];
  if (b.desc.length) parts.push(b.desc.join(" "));
  else parts.push(b.title);
  if (RESULT[b.code]) parts.push("ผลทดสอบ: " + RESULT[b.code]);
  if (b.code[0] === "G") parts.push("ต้องรันบน Supabase จริงที่เปิด RLS แล้ว");
  if (b.code[0] === "X") parts.push("แผนและเวลา: รันสดตอนนำเสนอ");
  if (b.code[0] === "C" && b.code !== "C5") parts.push("ตั้งใจให้ error ตามรหัสในชื่อบล็อก");
  return parts;
}

/* ---------- syntax highlight (สร้าง DOM ด้วย textContent) ---------- */
const KW = new Set(("select from where and or not in is null insert into values update set delete returning begin commit rollback create table temp as with case when then else end group by order limit union all exists distinct over partition left join on conflict do nothing filter show prepare execute deallocate explain analyze local role drop if interval true false like ilike desc asc count sum min max json_agg json_build_object string_agg coalesce now date_trunc make_interval gen_random_uuid to_jsonb set_config pg_sleep text drop").split(" "));
function highlight(pre, text){
  pre.textContent = "";
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z_0-9]*)|([\s\S])/g;
  let m, buf = "";
  const flush = () => { if (buf) { pre.appendChild(document.createTextNode(buf)); buf = ""; } };
  const span = (cls, t) => { flush(); const s = document.createElement("span"); s.className = cls; s.textContent = t; pre.appendChild(s); };
  while ((m = re.exec(text))) {
    if (m[1]) span("cm", m[1]);
    else if (m[2]) span("str", m[2]);
    else if (m[3]) span("num", m[3]);
    else if (m[4] && KW.has(m[4].toLowerCase())) span("kw", m[4]);
    else buf += m[0];
  }
  flush();
}

/* ---------- toast + copy ---------- */
const toast = document.getElementById("toast"); let toastT;
function showToast(msg){ toast.querySelector("span").textContent = msg; toast.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("show"), 1800); }
async function copyText(t, msg = "คัดลอกคำสั่ง SQL แล้ว"){
  try { await navigator.clipboard.writeText(t); }
  catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  showToast(msg);
}
document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => {
  const el = document.getElementById(b.dataset.copy);
  copyText([...el.querySelectorAll("li")].map((li) => li.textContent.trim()).join("\n"), "คัดลอกเอกสารอ้างอิงแล้ว");
}));
/* จอเล็ก: ตาราง .stack-sm แสดงเป็นรายการ ใส่ชื่อคอลัมน์ให้ทุกช่องจาก thead */
document.querySelectorAll("table.stack-sm").forEach((t) => {
  const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
  t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => td.setAttribute("data-label", heads[i] || "")));
});
const icon = (id) => { const s = document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("class","i"); const u = document.createElementNS("http://www.w3.org/2000/svg","use"); u.setAttribute("href","#"+id); s.appendChild(u); return s; };

/* sql-box: หัวกล่อง + ปุ่มคัดลอก + tab bar */
function sqlBox(codes, opts = {}){
  const box = document.createElement("div"); box.className = "sql-box";
  const head = document.createElement("div"); head.className = "sql-head";
  const title = document.createElement("div"); title.className = "sql-title";
  const btn = document.createElement("button"); btn.className = "copy"; btn.type = "button"; btn.append(icon("i-copy"), document.createTextNode("คัดลอก SQL"));
  head.append(title, btn); box.appendChild(head);
  let bar = null;
  if (codes.length > 1) { bar = document.createElement("div"); bar.className = "sql-tabs-bar"; bar.setAttribute("role","tablist"); box.appendChild(bar); }
  const pre = document.createElement("pre"); pre.className = "sql"; box.appendChild(pre);
  let current = "";
  const show = (code) => {
    const b = BLOCKS[code]; if (!b) return;
    const sql = opts.text || b.sql; current = sql;
    title.textContent = ""; const bb = document.createElement("b"); bb.textContent = opts.label || b.code; title.append(bb, document.createTextNode(opts.titleText || b.title)); title.title = b.title;
    highlight(pre, sql);
    if (bar) bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", x.dataset.code === code));
    if (opts.onShow) opts.onShow(b);
  };
  if (bar) codes.forEach((c) => { const t = document.createElement("button"); t.type = "button"; t.setAttribute("role","tab"); t.dataset.code = c; t.textContent = c; t.title = BLOCKS[c] ? BLOCKS[c].title : c; t.onclick = () => show(c); bar.appendChild(t); });
  btn.onclick = () => copyText(current);
  show(codes[0]);
  box.show = show;
  return box;
}
document.querySelectorAll(".sql-tabs").forEach((el) => el.appendChild(sqlBox(el.dataset.blocks.split(","))));

/* E3 แยกเป็น 2 กล่อง แท็บ A / แท็บ B */
(function(){
  const lines = BLOCKS.E3.sql.split("\n");
  const ia = lines.findIndex((l) => l.startsWith("-- ---- แท็บ A"));
  const ib = lines.findIndex((l) => l.startsWith("-- ---- แท็บ B"));
  const ic = lines.findIndex((l) => l.startsWith("-- ---- คืนสต็อก"));
  const a = lines.slice(ia + 1, ib).filter((l) => l !== "--").join("\n");
  const b = lines.slice(ib + 1, ic).filter((l) => l !== "--").map((l) => l.replace(/^-- /, "")).join("\n");
  const wrap = document.getElementById("e3pair");
  wrap.append(sqlBox(["E3"], {text:a, label:"E3 · A", titleText:"แท็บ A รันก่อน"}), sqlBox(["E3"], {text:b, label:"E3 · B", titleText:"แท็บ B ภายใน 10 วิ"}));
  const n = document.createElement("p"); n.className = "tiny muted"; n.style.gridColumn = "1 / -1";
  n.textContent = "แท็บ B ตัด -- หน้าบรรทัดจากบล็อก E3 ต้นฉบับ คำสั่งไม่เปลี่ยน · เปลี่ยน 'RC-2L' เป็น sku จริงที่ตั้ง stock_qty = 1 ไว้ · คืนสต็อกหลังโชว์ด้วยบรรทัดท้ายบล็อก E3 ในคลัง SQL";
  wrap.appendChild(n);
  /* บรรทัดตัดสต็อกจาก B6 ขั้นที่ 3 */
  const b6 = BLOCKS.B6.sql.split("\n"); const s = b6.findIndex((l) => l.startsWith("update product_variants v"));
  highlight(document.getElementById("condUpdate"), b6.slice(s, s + 6).join("\n"));
})();

/* ---------- JOIN demo (slide 15): output จากการรันจริงบน PostgreSQL ในเครื่อง (PGlite + schema + seed_products.sql) ---------- */
const JOIN_OUT = {
  J1:{note:"INNER JOIN 4 ตาราง ได้ 1 แถวต่อ 1 ตัวเลือกสินค้าในแต่ละห้อง · สินค้าที่ไม่มีหมวดหรือไม่มีตัวเลือกจะไม่ขึ้น · แสดง 10 แถวแรก (limit 10)",
    cols:["room","product","sku","option","price","stock_qty"],
    rows:[["ห้องครัว","กระชอนกรองสแตนเลส","HPB-KITCHEN-026","มาตรฐาน","290.00",20],["ห้องครัว","กระทะทอด","HPB-KITCHEN-017","มาตรฐาน","790.00",20],["ห้องครัว","กาน้ำร้อนไฟฟ้าคอห่าน","HPB-KITCHEN-008","มาตรฐาน","1290.00",20],["ห้องครัว","ชั้นวางขวดเครื่องเทศ","HPB-KITCHEN-019","มาตรฐาน","590.00",20],["ห้องครัว","ชาม","HPB-KITCHEN-001","มาตรฐาน","89.00",20],["ห้องครัว","ชุดตะหลิวทัพพีซิลิโคน","HPB-KITCHEN-030","มาตรฐาน","490.00",20],["ห้องครัว","ชุดถ้วยตวงช้อนตวง","HPB-KITCHEN-033","มาตรฐาน","290.00",20],["ห้องครัว","ซิงค์ล้างจานสแตนเลส","HPB-KITCHEN-006","มาตรฐาน","3990.00",10],["ห้องครัว","ตะหลิว","HPB-KITCHEN-002","มาตรฐาน","129.00",20],["ห้องครัว","ตู้เย็น2ประตู","HPB-KITCHEN-003","มาตรฐาน","24900.00",10]]},
  J2:{note:"LEFT JOIN + GROUP BY ได้ 1 แถวต่อ 1 ห้อง ถ้าห้องไหนยังไม่มีสินค้าจะยังขึ้นและได้ products = 0, price_from = null (INNER JOIN จะทำให้ห้องนั้นหายไป)",
    cols:["id","room","products","variants","price_from"],
    rows:[[1,"ห้องครัว",35,35,"89.00"],[2,"ห้องนอน",35,35,"290.00"],[3,"ห้องนั่งเล่น",34,34,"190.00"],[4,"ห้องน้ำ",34,34,"59.00"],[5,"เครื่องใช้ไฟฟ้า",26,26,"590.00"]]},
  J3:{note:"ตัวอย่างจากบัญชีทดสอบ 5 บัญชีในเครื่อง (ข้อมูลจริงบน Supabase จะต่างไป) · ทุก role มาจากตาราง profiles ตารางเดียว join กับ auth.users ด้วย id เดียวกัน (1:1)",
    cols:["role","users","active","first_signup"],
    rows:[["admin",1,1,"2026-11-20"],["warehouse",1,1,"2026-11-20"],["accounting",1,1,"2026-11-20"],["customer",2,2,"2026-11-20"]]},
  J4:{note:"ตัวอย่างจากคำสั่งซื้อทดสอบ 1 รายการ (2 ชิ้น อัปสลิปแล้ว ยังไม่ส่ง) · ได้ 1 แถวต่อ 1 รายการสินค้า · shipment ยังไม่มีเลยเป็น null เพราะใช้ LEFT JOIN ถ้าใช้ INNER JOIN จะได้ 0 แถว",
    cols:["order_no","status","customer","product_name","variant_name","quantity","unit_price","total_amount","attempt_no","payment_status","shipment_status","tracking_no"],
    rows:[[1,"awaiting_approval","ลูกค้า ทดสอบ","กระชอนกรองสแตนเลส","มาตรฐาน",1,"290.00","429.00",1,"pending",null,null],[1,"awaiting_approval","ลูกค้า ทดสอบ","ชาม","มาตรฐาน",1,"89.00","429.00",1,"pending",null,null]]},
};
(function(){
  const host = document.getElementById("joinBox"); if (!host) return;
  const out = document.getElementById("joinOut"), note = document.getElementById("joinNote"), count = document.getElementById("joinCount");
  const render = (b) => {
    const d = JOIN_OUT[b.code]; if (!d) return;
    out.textContent = "";
    const thead = out.createTHead().insertRow(); d.cols.forEach((c) => { const th = document.createElement("th"); th.textContent = c; thead.appendChild(th); });
    const tb = out.createTBody();
    d.rows.forEach((r) => { const tr = tb.insertRow(); r.forEach((v) => { const td = tr.insertCell(); if (v === null) { td.textContent = "null"; td.className = "null"; } else td.textContent = v; }); });
    count.textContent = "· " + d.rows.length + " แถว";
    note.textContent = d.note;
  };
  host.appendChild(sqlBox(["J1","J2","J3","J4"], {onShow: render}));
})();

/* ---------- Index table ---------- */
const IDX = [
  ["payments (status)","คิวสลิปรอตรวจของฝ่ายบัญชี","X1 R5"],
  ["orders (user_id)","คำสั่งซื้อของฉัน (ลูกค้า)","X2"],
  ["messages (conversation_id, created_at)","โหลดแชทในห้องเรียงตามเวลา","X3 B13"],
  ["orders (status)","dashboard นับตามสถานะ","R4"],
  ["orders (payment_due_at) WHERE status = 'pending_payment'","cancel_expired_orders() ผ่าน pg_cron","B9"],
  ["order_items (order_id)","รายการสินค้าในคำสั่งซื้อ","R2"],
  ["order_status_history (order_id, created_at)","timeline สถานะคำสั่งซื้อ","B14"],
  ["product_categories (category_id)","สินค้าตามห้อง หน้าแรก","B2"],
  ["product_variants (product_id)","ตัวเลือกของสินค้า","B4"],
  ["product_images (product_id)","รูปของสินค้า","B4"],
  ["addresses (user_id)","สมุดที่อยู่ของลูกค้า","-"],
  ["UNIQUE addresses (user_id) WHERE is_default","ที่อยู่หลัก 1 ที่ต่อคน","C9"],
  ["refunds (order_id)","คำขอคืนเงินของคำสั่งซื้อ","B11"],
  ["refund_items (order_item_id)","จำนวนที่คืนไปแล้วต่อชิ้น","B11"],
  ["shipments (status)","คิวรอส่งของฝ่ายจัดส่ง","R5"],
  ["UNIQUE shipments (carrier, tracking_no) WHERE tracking_no IS NOT NULL","เลขพัสดุไม่ซ้ำในขนส่งเดียวกัน","B10"],
  ["conversations (customer_id)","ห้องแชทของลูกค้า","B13"],
  ["conversations (status)","แชทรอตอบของฝ่ายขาย","R5"],
  ["stock_logs (variant_id, created_at)","ประวัติสต็อกของตัวเลือก","B14"],
  ["audit_logs (created_at)","Admin ดู log ล่าสุด","-"],
];
(function(){ const bodies = document.querySelectorAll(".idx-table tbody"), half = Math.ceil(IDX.length / bodies.length);
  IDX.forEach(([i,u,b], n) => { const tb = bodies[Math.floor(n / half)]; const tr = document.createElement("tr"); [i,u,b].forEach((t,k) => { const td = document.createElement("td"); if (k === 0) { const c = document.createElement("code"); c.textContent = t; td.appendChild(c); } else td.textContent = t; if (k === 2) td.className = "mono"; tr.appendChild(td); }); tb.appendChild(tr); });
})();

/* ---------- ER ---------- */
const ER = [
  ["ผู้ใช้","#8A5A12",[["profiles",["PK id → auth.users","role app_role","is_active"]],["addresses",["PK id","FK user_id","UQ is_default (partial)"]]]],
  ["สินค้า","#2F5D8A",[["categories",["PK id","UQ name"]],["products",["PK id","delivery_method"]],["product_categories",["PK FK product_id","PK FK category_id"]],["product_variants",["PK id","FK product_id","UQ sku","price ≥ 0 · stock_qty ≥ 0"]],["product_images",["PK id","FK product_id"]],["favorites",["PK FK user_id","PK FK product_id"]],["cart_items",["PK FK user_id","PK FK variant_id","quantity > 0"]]]],
  ["คำสั่งซื้อและเงิน","#2D6A55",[["orders",["PK id","UQ order_no","FK user_id","shipping_address jsonb"]],["order_items",["PK id","FK order_id","FK variant_id (null ได้)","unit_price snapshot"]],["order_status_history",["PK id","FK order_id","FK actor_id"]],["payments",["PK id","FK order_id","UQ (order_id, attempt_no)"]],["refunds",["PK id","FK order_id","FK approved_by"]],["refund_items",["PK id","FK refund_id","FK order_item_id","UQ (refund_id, order_item_id)"]]]],
  ["จัดส่งและแชท","#A8323E",[["shipments",["PK id","FK UQ order_id","FK handled_by","carrier · tracking_no"]],["conversations",["PK id","FK customer_id","FK staff_id","FK order_id"]],["messages",["PK id","FK conversation_id","FK sender_id"]]]],
  ["ร้านและ log","#56605A",[["store_settings",["PK id boolean (แถวเดียว)","payment_window_hours"]],["stock_logs",["PK id","FK variant_id","FK order_id","reason CHECK"]],["audit_logs",["PK id","FK actor_id"]]]],
];
(function(){ const er = document.getElementById("er");
  ER.forEach(([name,color,tables]) => {
    const col = document.createElement("div"); col.className = "er-col"; col.style.setProperty("--c", color);
    const h = document.createElement("h3"); h.style.background = color; h.textContent = name + " · " + tables.length; col.appendChild(h);
    tables.forEach(([t, cols]) => { const d = document.createElement("div"); d.className = "er-t"; const b = document.createElement("b"); b.textContent = t; d.appendChild(b); const ul = document.createElement("ul");
      cols.forEach((c) => { const li = document.createElement("li"); const mm = c.match(/^((?:PK |FK |UQ )+)(.*)$/); if (mm) { const k = document.createElement("span"); k.className = "k"; k.textContent = mm[1].trim(); li.append(k, document.createTextNode(" " + mm[2])); } else li.textContent = c; ul.appendChild(li); });
      d.appendChild(ul); col.appendChild(d); });
    er.appendChild(col);
  });
})();

/* ---------- Privacy matrix ---------- */
const ROLES = ["Admin","คลัง","จัดส่ง","ขาย","บัญชี","ลูกค้า","ผู้เยี่ยมชม"];
const E = "p-emerald", Bl = "p-blue", Y = "p-brass", N = "p-crimson", X = [N,"✕"];
const MATRIX = [
  ["profiles",[[E,"R U"],[Bl,"ตัวเอง"],[Y,"ลูกค้าในงาน"],[Y,"ลูกค้าที่แชท"],[Y,"ตามงาน"],[Bl,"R U ตัวเอง"],X]],
  ["addresses",[[E,"CRUD"],X,X,X,X,[Bl,"CRUD ตัวเอง"],X]],
  ["สินค้า ราคา รูป หมวด",[[E,"C R U"],[E,"C R U"],[E,"R"],[E,"R"],[E,"R"],[E,"R"],[E,"R"]]],
  ["stock_qty · sku",[[E,"R U"],[E,"R U"],[E,"R"],[E,"R"],X,[Y,"มี/หมด"],[Y,"มี/หมด"]]],
  ["orders",[[E,"R"],[Y,"view"],[Bl,"งานตัวเอง"],[Y,"view"],[Y,"view"],[Bl,"C R ตัวเอง"],X]],
  ["shipping_address",[[E,"R"],X,[Bl,"งานตัวเอง"],X,X,[Bl,"ตัวเอง"],X]],
  ["payments (สลิป)",[[E,"R U"],X,X,X,[E,"R U"],[Bl,"C R ตัวเอง"],X]],
  ["refunds",[[E,"R U"],[Y,"ตรวจของคืน"],X,[Y,"ไม่มี slip_path"],[E,"R U"],[Bl,"C R ตัวเอง"],X]],
  ["shipments",[[E,"R"],[E,"R"],[Bl,"R U งานตัวเอง"],[E,"R"],[E,"R"],[Bl,"R ตัวเอง"],X]],
  ["แชท",[[E,"R U"],X,X,[E,"R U ตอบ"],X,[Bl,"C R ตัวเอง"],X]],
  ["logs",[[Y,"R เท่านั้น"],[Y,"R stock_logs"],X,X,X,X,X]],
];
(function(){ const t = document.getElementById("matrix"); const th = document.createElement("thead"); const hr = document.createElement("tr");
  ["ข้อมูล",...ROLES].forEach((r) => { const h = document.createElement("th"); h.textContent = r; hr.appendChild(h); }); th.appendChild(hr); t.appendChild(th);
  const tb = document.createElement("tbody");
  MATRIX.forEach(([row, cells]) => { const tr = document.createElement("tr"); const td0 = document.createElement("td"); td0.className = "tiny"; td0.textContent = row; tr.appendChild(td0);
    cells.forEach(([cls, txt]) => { const td = document.createElement("td"); const p = document.createElement("span"); p.className = "pill " + cls; p.textContent = txt; td.appendChild(p); tr.appendChild(td); });
    tb.appendChild(tr); });
  t.appendChild(tb);
})();

/* ---------- Traceability ---------- */
const FR = [
  {id:"FR-01",who:"ลูกค้า, พนักงาน",t:"สมัคร ล็อกอิน ออกจากระบบ (พนักงานใช้บัญชีที่ Admin สร้าง)",br:"BR3, BR4",ent:"auth.users 1:1 profiles",db:"profiles (id PK = FK auth.users, role app_role, is_active) · trigger handle_new_user, sync_user_email · on_profile_update กันแก้ role ตัวเอง",ui:"auth/login.html · auth/register.html · auth/forgot.html · Supabase Auth (signUp / signInWithPassword)",imp:"ถ้า 1 คนมีได้หลาย role ต้องแยก role ออกเป็นตาราง M:N และแก้ current_user_role() กับ policy ทุกตัว"},
  {id:"FR-02",who:"ทุกคน",t:"ดู ค้นหาสินค้าตามหมวดห้อง ดูรายละเอียดและตัวเลือก ไม่ต้องล็อกอิน",br:"BR3",ent:"products M:N categories · products 1:N product_variants, product_images",db:"policy SELECT สินค้าให้ anon · view variants_public ซ่อน sku และ stock_qty · index product_categories(category_id)",ui:"index.html · zone.html · search.html · product.html",imp:"ถ้าสินค้าอยู่ได้หมวดเดียว ดู Impact กรณี (ข)"},
  {id:"FR-03",who:"ลูกค้า",t:"สั่งซื้อจากตะกร้า (ต้องล็อกอิน)",br:"BR3",ent:"profiles 1:N orders · orders 1:N order_items",db:"orders.shipping_address jsonb · order_items snapshot ชื่อและราคา · CHECK subtotal / total ≥ 0 · RPC place_order() security definer",ui:"cart.html → rpc place_order",imp:"ถ้าคิดค่าส่งต่อชิ้น ต้องแก้ place_order() และ store_settings.shipping_fee"},
  {id:"FR-04",who:"ลูกค้า",t:"จัดการตะกร้าและรายการโปรด",br:"-",ent:"profiles 1:N cart_items, favorites",db:"cart_items PK (user_id, variant_id) · CHECK quantity > 0 · favorites PK (user_id, product_id) · RLS เฉพาะเจ้าของ",ui:"cart.html · favorites.html · ปุ่มหัวใจในการ์ดสินค้า",imp:"ถ้าให้ผู้เยี่ยมชมมีตะกร้า ต้องเก็บฝั่ง browser หรือให้ user_id ว่างได้"},
  {id:"FR-05",who:"ลูกค้า",t:"จ่ายผ่าน QR พร้อมเพย์ แนบสลิป ไม่ผ่านอัปโหลดใหม่ได้ 1 ครั้ง",br:"BR6",ent:"orders 1:N payments (สูงสุด 2)",db:"payments CHECK attempt_no IN (1,2) · UNIQUE (order_id, attempt_no) · Storage private (สลิป) · store_settings.reupload_window_hours",ui:"orders.html → rpc submit_payment",imp:"อัปสลิปได้ 3 ครั้ง ดู Impact กรณี (ค)"},
  {id:"FR-06",who:"ลูกค้า",t:"ติดตามสถานะคำสั่งซื้อและการจัดส่ง",br:"-",ent:"orders 1:N order_status_history · orders 1:0..1 shipments",db:"trigger log_order_status · index order_status_history(order_id, created_at) · shipments.tracking_no",ui:"orders.html",imp:"แบ่งส่งหลายรอบ ดู Impact กรณี (ก)"},
  {id:"FR-07",who:"ลูกค้า, ฝ่ายขาย",t:"แชทกับฝ่ายบริการ (ลูกค้าเห็นชื่อ \"ฝ่ายบริการ\") แบบ Realtime",br:"-",ent:"profiles 1:N conversations · conversations 1:N messages",db:"messages CHECK body หรือ image_path · conversation_status enum · index messages(conversation_id, created_at) · Realtime",ui:"chat.html · employee/service.html",imp:"ถ้าให้ลูกค้าเห็นชื่อพนักงาน ต้องเปิดคอลัมน์ชื่อใน policy / view ซึ่งขัดกับ Privacy level"},
  {id:"FR-08",who:"-",t:"(ยกเลิก 15 ต.ค. เดิมคือจัดการ FAQ ของบอท)",br:"-",ent:"-",db:"ไม่มีตาราง faq_entries แล้ว",ui:"-",imp:"-"},
  {id:"FR-09",who:"บัญชี, Admin",t:"ตรวจสลิป อนุมัติหรือปฏิเสธพร้อมเหตุผล",br:"BR6",ent:"orders 1:N payments",db:"payments.status (pending / approved / rejected) · reject_reason · reviewed_by SET NULL · index payments(status)",ui:"employee/accounting.html → rpc review_payment",imp:"ถ้าต้องอนุมัติ 2 คน ต้องเพิ่มตารางผู้อนุมัติ และแก้ review_payment()"},
  {id:"FR-10",who:"ระบบ",t:"ยกเลิกอัตโนมัติเมื่อไม่โอนในเวลาหรือสลิปไม่ผ่านครั้งที่ 2",br:"BR6",ent:"orders · order_items · stock_logs",db:"orders.payment_due_at · partial index orders(payment_due_at) WHERE pending_payment · store_settings.payment_window_hours · cancel_expired_orders()",ui:"pg_cron (ไม่มีหน้าจอ) · ลูกค้าเห็นผลใน orders.html",imp:"เปลี่ยนเวลาโอนแก้ที่ store_settings ได้เลยโดยไม่ต้องแก้โค้ด"},
  {id:"FR-11",who:"ลูกค้า, บัญชี, Admin",t:"ขอคืนเงินทั้งคำสั่งซื้อหรือบางชิ้น อนุมัติ แนบสลิปโอนคืน",br:"BR8",ent:"orders 1:N refunds · refunds 1:N refund_items · order_items 1:N refund_items",db:"refund_items UNIQUE (refund_id, order_item_id) · trigger set_no_return, set_order_refunded · RPC request_refund, review_refund, mark_refund_paid",ui:"orders.html · employee/accounting.html",imp:"ถ้าคืนเป็นเครดิตร้านแทนเงิน ต้องเพิ่มตารางเครดิต และสถานะใหม่ใน refund_status"},
  {id:"FR-12",who:"ระบบ",t:"ตัดสต็อกตอนสั่งซื้อ คืนสต็อกเมื่อยกเลิก",br:"BR7",ent:"product_variants 1:N stock_logs",db:"CHECK stock_qty ≥ 0 · UPDATE … WHERE stock_qty >= n · stock_logs reason IN (order, cancel, adjust, return) · trigger after_stock_change",ui:"cart.html (place_order) · ยกเลิกผ่าน cancel_expired_orders / review_refund",imp:"ถ้าจองสต็อกตอนใส่ตะกร้า ต้องเพิ่มเวลาหมดอายุใน cart_items และ job คืนสต็อก"},
  {id:"FR-13",who:"คลัง, Admin",t:"จัดการสินค้า ตัวเลือก ราคา รูป หมวด วิธีส่ง ปรับสต็อก",br:"BR7",ent:"products 1:N product_variants, product_images · products M:N categories",db:"sku UNIQUE · delivery_method enum · policy INSERT / UPDATE ให้ admin, warehouse · trigger after_price_change (audit)",ui:"employee/warehouse.html · Storage รูปสินค้า",imp:"ถ้าเพิ่มวิธีส่งใหม่ ต้องเพิ่มค่าใน enum delivery_method"},
  {id:"FR-14",who:"คลัง, Admin",t:"ตรวจสภาพของคืนก่อนเข้าสต็อก",br:"BR7, BR8",ent:"refund_items",db:"return_status enum (pending_check / restocked / not_restocked / no_return) · checked_by · RPC check_return · trigger after_return_check",ui:"employee/warehouse.html",imp:"ถ้าต้องถ่ายรูปของคืน ต้องเพิ่มคอลัมน์รูปใน refund_items และ bucket"},
  {id:"FR-15",who:"ลูกค้า",t:"บันทึกที่อยู่ได้หลายที่ เลือก 1 ที่ต่อคำสั่งซื้อ",br:"BR5",ent:"profiles 1:N addresses",db:"partial UNIQUE addresses(user_id) WHERE is_default · orders.shipping_address jsonb snapshot",ui:"profile/profile.html · cart.html",imp:"ถ้า 1 คำสั่งซื้อส่งหลายที่อยู่ ต้องย้ายที่อยู่ไปอยู่ระดับ shipments"},
  {id:"FR-16",who:"จัดส่ง, Admin",t:"รับงาน ใส่ขนส่งและเลขพัสดุ อัปเดตสถานะ",br:"BR5",ent:"orders 1:0..1 shipments",db:"shipments order_id UNIQUE · update_shipment() บังคับ carrier + tracking_no · UNIQUE (carrier, tracking_no) · is_my_shipping_job() · RPC claim_shipment, update_shipment",ui:"employee/delivery.html",imp:"แบ่งส่งหลายรอบ ดู Impact กรณี (ก)"},
  {id:"FR-17",who:"Admin",t:"สร้างบัญชีพนักงาน กำหนด role ปิดบัญชีแทนการลบ",br:"BR2, BR4",ent:"auth.users 1:1 profiles",db:"profiles.role, is_active · Edge Function create-staff (service_role) · trigger after_profile_access_change (audit)",ui:"employee/admin.html",imp:"ถ้าให้หัวหน้าฝ่ายสร้างบัญชีเอง ต้องแก้สิทธิ์ใน create-staff และ policy profiles"},
  {id:"FR-18",who:"Admin",t:"ตั้งค่าร้าน QR เลขบัญชี เวลาทำการ ชั่วโมงยกเลิกอัตโนมัติ",br:"BR2",ent:"store_settings (แถวเดียว)",db:"id boolean CHECK · payment_window_hours / reupload_window_hours default 24 · view store_public · trigger after_store_settings_update, set_updated_by",ui:"employee/admin.html",imp:"ถ้ามีหลายสาขา store_settings ต้องเป็นหลายแถว และ orders ต้องมี branch_id"},
  {id:"FR-19",who:"Admin",t:"ดู log (แก้/ลบไม่ได้)",br:"BR2",ent:"audit_logs · stock_logs · order_status_history",db:"มีแค่ policy SELECT · ไม่มี policy UPDATE / DELETE · index audit_logs(created_at)",ui:"employee/admin.html",imp:"ถ้าต้องเก็บ log นานหลายปี ควรแบ่ง partition ตามเดือน"},
  {id:"FR-20",who:"ทุกตำแหน่ง",t:"เห็นเมนูและข้อมูลตาม role (RBAC)",br:"BR1",ent:"profiles.role (app_role)",db:"current_user_role() · has_role() · RLS 21 ตาราง 33 policy · view orders_for_staff, refunds_for_sales",ui:"ทุกหน้า: หน้าเว็บซ่อนเมนู แต่สิทธิ์จริงบังคับที่ฐานข้อมูล",imp:"เพิ่ม role ใหม่ ต้องเพิ่มค่าใน app_role และไล่แก้ policy ที่ใช้ has_role()"},
];
(function(){
  const list = document.getElementById("frList"), q = document.getElementById("frSearch");
  const steps = [["1","Business Rule","br"],["2","Entity / Cardinality","ent"],["3","Table · Column · Constraint · Trigger · RLS","db"],["4","หน้าจอ UI + RPC","ui"],["5","Impact ถ้ากฎเปลี่ยน","imp"]];
  let cur = FR[0].id;
  const pick = (id) => { cur = id; const f = FR.find((x) => x.id === id);
    document.getElementById("frId").textContent = f.id + " · BR: " + f.br;
    document.getElementById("frTitle").textContent = f.t;
    document.getElementById("frWho").textContent = "ใคร: " + f.who;
    const box = document.getElementById("frSteps"); box.textContent = "";
    steps.forEach(([n, h, k]) => { const d = document.createElement("div"); d.className = "step"; const nn = document.createElement("div"); nn.className = "num"; nn.textContent = n; const c = document.createElement("div"); const hh = document.createElement("h4"); hh.textContent = h; const p = document.createElement("p"); p.textContent = f[k]; if (k === "db" || k === "ent") p.className = "mono"; c.append(hh, p); d.append(nn, c); box.appendChild(d); });
    list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b.dataset.id === id)); };
  const render = () => { const s = q.value.trim().toLowerCase(); list.textContent = "";
    FR.filter((f) => !s || [f.id,f.t,f.who,f.br,f.ent,f.db,f.ui].join(" ").toLowerCase().includes(s)).forEach((f) => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.id = f.id; const bb = document.createElement("b"); bb.textContent = f.id; b.append(bb, document.createTextNode(f.t)); b.onclick = () => pick(f.id); b.setAttribute("aria-current", f.id === cur); list.appendChild(b); }); };
  q.addEventListener("input", render); render(); pick(cur);
})();

/* ---------- คลัง SQL ---------- */
(function(){
  const list = document.getElementById("libList"), q = document.getElementById("libSearch"), boxWrap = document.getElementById("libBox"), exp = document.getElementById("libExpect");
  document.getElementById("libCount").textContent = ORDER.length + " บล็อก";
  const box = sqlBox([ORDER[0]], {onShow:(b) => { exp.textContent = ""; expectText(b).forEach((t) => { const p = document.createElement("p"); p.textContent = t; p.style.marginTop = "4px"; exp.appendChild(p); }); }});
  boxWrap.appendChild(box);
  let cur = ORDER[0];
  const pick = (c) => { cur = c; box.show(c); list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b.dataset.code === c)); };
  const render = () => { const s = q.value.trim().toLowerCase(); list.textContent = ""; let last = "";
    ORDER.filter((c) => !s || (c + " " + BLOCKS[c].title + " " + BLOCKS[c].desc.join(" ")).toLowerCase().includes(s)).forEach((c) => {
      const g = c[0]; if (g !== last) { last = g; const h = document.createElement("div"); h.className = "wb-group"; h.textContent = GROUPS[g] || g; list.appendChild(h); }
      const b = document.createElement("button"); b.type = "button"; b.dataset.code = c; const bb = document.createElement("b"); bb.textContent = c; b.append(bb, document.createTextNode(BLOCKS[c].title)); b.onclick = () => pick(c); b.setAttribute("aria-current", c === cur); list.appendChild(b); }); };
  q.addEventListener("input", render); render(); pick(cur);
})();

/* ---------- Data Dictionary ---------- */
const DD = [
 {n:"profiles",g:"ผู้ใช้",p:"ข้อมูลบัญชีของทุกคนในระบบ ทั้งลูกค้าและพนักงาน 1 แถวต่อ 1 บัญชี ผูกกับ auth.users ของ Supabase (รหัสผ่านไม่ได้อยู่ที่นี่ อยู่ใน auth.users แบบ hash)",ex:"สร้างอัตโนมัติด้วย trigger handle_new_user ตอนสมัคร role เริ่มต้นเป็น customer",
  c:[["id","uuid PK","รหัสผู้ใช้ เท่ากับ auth.users.id"],["email","text","อีเมลล็อกอิน (sync จาก auth.users ด้วย trigger sync_user_email)"],["full_name","text","ชื่อ-นามสกุลจริง"],["display_name","text","ชื่อที่แสดงในเว็บ (ไม่บังคับ)"],["phone","text","เบอร์โทร"],["role","app_role","ตำแหน่ง: admin / warehouse / shipping / sales / accounting / customer"],["is_active","boolean","เปิด/ปิดบัญชี (ปิดแทนการลบ)"],["created_at","timestamptz","วันที่สมัคร"]],
  r:["auth.users 1:1 profiles (ON DELETE CASCADE)","1:N addresses, orders, cart_items, favorites, conversations","trigger on_profile_update: คนที่ไม่ใช่ Admin แก้ role / is_active / email ตัวเองไม่ได้","trigger after_profile_access_change เก็บ audit เมื่อ role หรือ is_active เปลี่ยน"],
  a:"อ่าน: ตัวเอง, Admin, พนักงานที่มีงานเกี่ยวข้อง (can_view_profile) · แก้: ตัวเอง (ยกเว้น role, is_active, email) และ Admin · ลบ: ไม่มีใคร",u:"auth/register.html · profile/profile.html · employee/admin.html"},
 {n:"addresses",g:"ผู้ใช้",p:"สมุดที่อยู่จัดส่งของลูกค้า 1 คนมีได้หลายที่ และตั้งที่อยู่หลักได้ 1 ที่",ex:"ตอนสั่งซื้อ ที่อยู่ที่เลือกจะถูกคัดลอก (snapshot) ไปเก็บใน orders.shipping_address",
  c:[["id","uuid PK","รหัสที่อยู่"],["user_id","uuid FK","เจ้าของที่อยู่ → profiles"],["recipient_name","text","ชื่อผู้รับ"],["phone","text","เบอร์ผู้รับ"],["address_line","text","บ้านเลขที่ ถนน"],["subdistrict","text","ตำบล/แขวง"],["district","text","อำเภอ/เขต"],["province","text","จังหวัด"],["postcode","text","รหัสไปรษณีย์"],["is_default","boolean","เป็นที่อยู่หลักไหม"],["created_at","timestamptz","วันที่เพิ่ม"]],
  r:["profiles 1:N addresses (CASCADE)","partial UNIQUE (user_id) WHERE is_default = ที่อยู่หลัก 1 ที่ต่อคน","index addresses(user_id)"],
  a:"เจ้าของและ Admin เท่านั้น (ทุกคำสั่ง) · ฝ่ายจัดส่งไม่เห็นตารางนี้ เห็นแค่ shipping_address ในคำสั่งซื้อของงานตัวเอง",u:"profile/profile.html · cart.html"},
 {n:"categories",g:"สินค้า",p:"หมวดสินค้าแบ่งตามห้อง เช่น ห้องครัว ห้องนอน ห้องน้ำ",ex:"seed_products.sql สร้างหมวดห้องไว้ให้",
  c:[["id","bigint PK (identity)","รหัสหมวด"],["name","text UNIQUE","ชื่อหมวด ห้ามซ้ำ"]],
  r:["categories M:N products ผ่าน product_categories"],
  a:"อ่าน: ทุกคนรวมผู้เยี่ยมชม · เขียน: Admin, คลัง",u:"index.html · zone.html · employee/warehouse.html"},
 {n:"products",g:"สินค้า",p:"ข้อมูลหลักของสินค้า 1 ชิ้น (ชื่อ คำอธิบาย วิธีส่ง) ราคาและสต็อกแยกไปอยู่ที่ตัวเลือก (product_variants)",ex:"เช่น \"หม้อหุงข้าว\" 1 แถว มีตัวเลือก 1.0L / 1.8L เป็นคนละแถวใน product_variants",
  c:[["id","uuid PK","รหัสสินค้า"],["name","text","ชื่อสินค้า"],["description","text","รายละเอียด"],["is_active","boolean","เปิดขายไหม (เลิกขายใช้ false แทนการลบ)"],["delivery_method","delivery_method","วิธีส่ง: store_truck (รถร้าน) / carrier (บริษัทขนส่ง)"],["created_at","timestamptz","วันที่เพิ่ม"],["updated_at","timestamptz","แก้ล่าสุด (trigger set_updated_at)"]],
  r:["1:N product_variants, product_images (CASCADE)","M:N categories ผ่าน product_categories"],
  a:"อ่าน: ทุกคนเห็นสินค้าที่เปิดขาย พนักงานเห็นทั้งหมด · เพิ่ม/แก้: Admin, คลัง · ลบ: ไม่มีสิทธิ์ (revoke delete)",u:"index.html · product.html · employee/warehouse.html"},
 {n:"product_categories",g:"สินค้า",p:"ตารางเชื่อมสินค้ากับหมวด (M:N) สินค้า 1 ชิ้นอยู่ได้หลายห้อง",ex:"เช่น ไมโครเวฟอยู่ทั้งห้องครัวและเครื่องใช้ไฟฟ้า",
  c:[["product_id","uuid PK FK","สินค้า → products"],["category_id","bigint PK FK","หมวด → categories"]],
  r:["PK คู่ (product_id, category_id) กันจับคู่ซ้ำ","ลบสินค้าหรือหมวด แถวเชื่อมหายตาม (CASCADE)","index product_categories(category_id)"],
  a:"อ่าน: ทุกคน · เขียน: Admin, คลัง",u:"zone.html (กรองตามห้อง)"},
 {n:"product_variants",g:"สินค้า",p:"ตัวเลือกของสินค้า (ขนาด สี รุ่น) เก็บราคาและจำนวนสต็อก เป็นหน่วยที่ลูกค้าใส่ตะกร้าและสั่งซื้อจริง",ex:"place_order() ตัดสต็อกที่ตารางนี้ด้วย UPDATE … WHERE stock_qty >= n",
  c:[["id","uuid PK","รหัสตัวเลือก"],["product_id","uuid FK","เป็นตัวเลือกของสินค้าไหน"],["sku","text UNIQUE","รหัสสินค้าภายในคลัง ห้ามซ้ำ"],["name","text","ชื่อตัวเลือก (default 'มาตรฐาน')"],["price","numeric(10,2)","ราคาขาย CHECK ≥ 0"],["stock_qty","integer","จำนวนคงเหลือ CHECK ≥ 0"],["is_active","boolean","เปิดขายตัวเลือกนี้ไหม"]],
  r:["products 1:N product_variants (CASCADE)","1:N cart_items, order_items (SET NULL), stock_logs (RESTRICT)","trigger after_stock_change: คลัง/Admin แก้สต็อกเอง → เขียน stock_logs 'adjust' + audit","trigger after_price_change: เก็บราคาเก่า/ใหม่ใน audit_logs"],
  a:"ตารางจริง: Admin, คลัง, จัดส่ง, ขาย อ่านได้ · เพิ่ม/แก้: Admin, คลัง · ลูกค้าและผู้เยี่ยมชมอ่านผ่าน view variants_public (ไม่มี sku และ stock_qty เห็นแค่ in_stock)",u:"product.html · cart.html · employee/warehouse.html"},
 {n:"product_images",g:"สินค้า",p:"รูปของสินค้า 1 สินค้ามีได้หลายรูป เรียงลำดับได้",ex:"ไฟล์รูปจริงอยู่ใน Supabase Storage ตารางนี้เก็บแค่ path",
  c:[["id","uuid PK","รหัสรูป"],["product_id","uuid FK","รูปของสินค้าไหน"],["image_path","text","path ของไฟล์ใน Storage"],["sort_order","integer","ลำดับการแสดง (0 = รูปแรก)"]],
  r:["products 1:N product_images (CASCADE)","index product_images(product_id)"],
  a:"อ่าน: ทุกคน · เขียน: Admin, คลัง",u:"product.html · employee/warehouse.html"},
 {n:"favorites",g:"สินค้า",p:"รายการโปรด (กดหัวใจ) ของลูกค้า",ex:"กดหัวใจซ้ำไม่เกิดแถวซ้ำ เพราะ PK คู่",
  c:[["user_id","uuid PK FK","ลูกค้า"],["product_id","uuid PK FK","สินค้าที่ชอบ"],["created_at","timestamptz","วันที่กด"]],
  r:["PK (user_id, product_id)","ลบลูกค้าหรือสินค้า แถวหายตาม (CASCADE)"],
  a:"เจ้าของและ Admin เท่านั้น",u:"favorites.html · ปุ่มหัวใจในการ์ดสินค้า"},
 {n:"cart_items",g:"สินค้า",p:"ตะกร้าสินค้าของลูกค้า 1 แถวต่อ 1 ตัวเลือก",ex:"กดใส่ตะกร้าซ้ำ = เพิ่ม quantity (on conflict do update) ล้างตะกร้าหลัง place_order()",
  c:[["user_id","uuid PK FK","ลูกค้า"],["variant_id","uuid PK FK","ตัวเลือกสินค้า"],["quantity","integer","จำนวน CHECK > 0"],["added_at","timestamptz","เวลาที่ใส่ตะกร้า"]],
  r:["PK (user_id, variant_id)","CASCADE ทั้งสองฝั่ง"],
  a:"เจ้าของและ Admin เท่านั้น",u:"cart.html"},
 {n:"orders",g:"คำสั่งซื้อและเงิน",p:"คำสั่งซื้อ 1 ครั้งของลูกค้า เก็บยอดเงิน สถานะ และที่อยู่จัดส่งแบบ snapshot",ex:"สร้างผ่าน place_order() เท่านั้น ลูกค้า INSERT ตรงไม่ได้",
  c:[["id","uuid PK","รหัสคำสั่งซื้อ"],["order_no","bigint UNIQUE (identity)","เลขคำสั่งซื้อที่แสดงให้ลูกค้า เรียงตามลำดับ"],["user_id","uuid FK","ลูกค้าเจ้าของคำสั่งซื้อ"],["status","order_status","pending_payment → awaiting_approval → approved → shipping → delivered / cancelled / refunded"],["shipping_address","jsonb","สำเนาที่อยู่ ณ ตอนสั่ง (แก้สมุดที่อยู่ทีหลังไม่กระทบ)"],["subtotal","numeric(10,2)","ยอดสินค้า CHECK ≥ 0"],["shipping_fee","numeric(10,2)","ค่าส่ง CHECK ≥ 0"],["total_amount","numeric(10,2)","ยอดรวม CHECK ≥ 0"],["payment_due_at","timestamptz","กำหนดโอน = เวลาสั่ง + payment_window_hours"],["created_at","timestamptz","เวลาสั่ง"],["updated_at","timestamptz","แก้ล่าสุด"]],
  r:["profiles 1:N orders (NO ACTION: ลบลูกค้าที่มีคำสั่งซื้อไม่ได้)","1:N order_items, order_status_history, payments, refunds · 1:0..1 shipments","trigger log_order_status เขียนประวัติทุกครั้งที่ status เปลี่ยน","index orders(user_id), orders(status), partial orders(payment_due_at) WHERE pending_payment"],
  a:"อ่าน: เจ้าของ, Admin, จัดส่ง (งานตัวเอง) · คลัง ขาย บัญชี อ่านผ่าน view orders_for_staff (ไม่มี shipping_address) · เขียน: ผ่าน RPC เท่านั้น",u:"cart.html · orders.html · employee/*"},
 {n:"order_items",g:"คำสั่งซื้อและเงิน",p:"รายการสินค้าในคำสั่งซื้อ เก็บสำเนาชื่อและราคา ณ ตอนสั่ง",ex:"เปลี่ยนราคาหรือลบตัวเลือกภายหลัง ประวัติการขายยังถูกต้อง",
  c:[["id","uuid PK","รหัสรายการ"],["order_id","uuid FK","อยู่ในคำสั่งซื้อไหน"],["variant_id","uuid FK (null ได้)","ตัวเลือกที่ซื้อ (เป็น null ถ้าตัวเลือกถูกลบ)"],["product_name","text","ชื่อสินค้า ณ ตอนสั่ง"],["variant_name","text","ชื่อตัวเลือก ณ ตอนสั่ง"],["unit_price","numeric(10,2)","ราคาต่อชิ้น ณ ตอนสั่ง CHECK ≥ 0"],["quantity","integer","จำนวน CHECK > 0"]],
  r:["orders 1:N order_items (RESTRICT)","variant_id ON DELETE SET NULL","1:N refund_items"],
  a:"อ่าน: เจ้าของ, Admin, คลัง, ขาย, บัญชี, จัดส่ง (งานตัวเอง) · เขียน: ผ่าน RPC",u:"orders.html · employee/*"},
 {n:"order_status_history",g:"คำสั่งซื้อและเงิน",p:"log การเปลี่ยนสถานะคำสั่งซื้อทุกครั้ง (ใคร เปลี่ยนจากอะไรเป็นอะไร เมื่อไร)",ex:"trigger log_order_status เขียนให้อัตโนมัติ ไม่มีใครแก้หรือลบได้",
  c:[["id","bigint PK (identity)","ลำดับ log"],["order_id","uuid FK","คำสั่งซื้อ"],["from_status","order_status","สถานะเดิม (null = เพิ่งสร้าง)"],["to_status","order_status","สถานะใหม่"],["actor_id","uuid FK","คนที่ทำ (SET NULL)"],["created_at","timestamptz","เวลาที่เปลี่ยน"]],
  r:["orders 1:N (RESTRICT)","index (order_id, created_at)","append-only: มีแค่ policy SELECT"],
  a:"อ่าน: เจ้าของ, Admin, คลัง, ขาย, บัญชี, จัดส่ง (งานตัวเอง) · แก้/ลบ: ไม่มีใคร",u:"orders.html (timeline) · employee/admin.html"},
 {n:"payments",g:"คำสั่งซื้อและเงิน",p:"สลิปโอนเงินของคำสั่งซื้อ 1 คำสั่งซื้อส่งได้สูงสุด 2 ครั้ง และผลการตรวจของฝ่ายบัญชี",ex:"ครั้งที่ 1 ไม่ผ่าน → อัปใหม่ได้ · ครั้งที่ 2 ไม่ผ่าน → ยกเลิกคำสั่งซื้อ",
  c:[["id","uuid PK","รหัสการชำระ"],["order_id","uuid FK","คำสั่งซื้อ"],["attempt_no","smallint","ครั้งที่ส่งสลิป CHECK IN (1,2)"],["amount","numeric(10,2)","ยอดโอน CHECK > 0"],["slip_path","text","path รูปสลิปใน Storage (private)"],["status","payment_status","pending / approved / rejected"],["reject_reason","text","เหตุผลที่ไม่ผ่าน"],["uploaded_at","timestamptz","เวลาอัปสลิป"],["reviewed_by","uuid FK","ฝ่ายบัญชีที่ตรวจ (SET NULL)"],["reviewed_at","timestamptz","เวลาตรวจ"]],
  r:["orders 1:N payments (NO ACTION)","UNIQUE (order_id, attempt_no)","index payments(status) สำหรับคิวบัญชี"],
  a:"อ่าน: เจ้าของ, Admin, บัญชี (Confidential) · เขียน: submit_payment(), review_payment() · ลบ: ไม่มีใคร",u:"orders.html · employee/accounting.html"},
 {n:"refunds",g:"คำสั่งซื้อและเงิน",p:"คำขอคืนเงิน 1 คำขอต่อการคืน 1 รอบ (คืนทั้งคำสั่งซื้อหรือบางชิ้นก็ได้)",ex:"request_refund() สร้าง → review_refund() อนุมัติ/ปฏิเสธ → mark_refund_paid() แนบสลิปโอนคืน",
  c:[["id","uuid PK","รหัสคำขอ"],["order_id","uuid FK","คำสั่งซื้อ"],["amount","numeric(10,2)","ยอดคืน CHECK > 0"],["reason","refund_reason","cancel_before_ship / damaged / wrong_item"],["detail","text","รายละเอียดจากลูกค้า"],["status","refund_status","requested / approved / rejected / paid"],["slip_path","text","สลิปโอนคืน"],["requested_at","timestamptz","เวลายื่นคำขอ"],["approved_by","uuid FK","ผู้อนุมัติ (SET NULL)"],["approved_at","timestamptz","เวลาอนุมัติ"]],
  r:["orders 1:N refunds (NO ACTION)","1:N refund_items","trigger set_order_refunded: คืนครบทุกชิ้น → orders = refunded","trigger after_refund_status_change เก็บ audit"],
  a:"อ่าน: เจ้าของ, Admin, บัญชี · ฝ่ายขายอ่านผ่าน view refunds_for_sales (ไม่มี slip_path) · เขียน: ผ่าน RPC",u:"orders.html · employee/accounting.html"},
 {n:"refund_items",g:"คำสั่งซื้อและเงิน",p:"ชิ้นสินค้าที่ขอคืนในแต่ละคำขอ และผลการตรวจของคืนจากฝ่ายคลัง",ex:"คืน 1 ใน 2 ชิ้นได้ · ยกเลิกก่อนส่ง trigger set_no_return ตั้ง no_return ให้",
  c:[["id","uuid PK","รหัสรายการคืน"],["refund_id","uuid FK","อยู่ในคำขอไหน"],["order_item_id","uuid FK","คืนรายการไหนของคำสั่งซื้อ"],["quantity","integer","จำนวนที่คืน CHECK > 0"],["amount","numeric(10,2)","ยอดคืนของรายการนี้ CHECK > 0"],["return_status","return_status","pending_check / restocked / not_restocked / no_return"],["checked_by","uuid FK","คลังที่ตรวจ (SET NULL)"],["checked_at","timestamptz","เวลาตรวจ"]],
  r:["refunds 1:N, order_items 1:N (RESTRICT ทั้งคู่)","UNIQUE (refund_id, order_item_id)","index refund_items(order_item_id)","trigger after_return_check เก็บ audit"],
  a:"อ่าน: เจ้าของ, Admin, คลัง, ขาย, บัญชี · เขียน: request_refund(), check_return()",u:"orders.html · employee/warehouse.html"},
 {n:"shipments",g:"จัดส่งและแชท",p:"การจัดส่งของคำสั่งซื้อ (1 คำสั่งซื้อส่งได้ 1 ครั้ง) ใครรับงาน ส่งด้วยอะไร เลขพัสดุ",ex:"claim_shipment() รับงานที่ approved แล้ว · update_shipment() ใส่ขนส่ง + เลขพัสดุ + สถานะ",
  c:[["id","uuid PK","รหัสการส่ง"],["order_id","uuid FK UNIQUE","คำสั่งซื้อ (1:0..1)"],["method","delivery_method","store_truck / carrier"],["carrier","text","บริษัทขนส่ง"],["tracking_no","text","เลขพัสดุ"],["status","shipment_status","preparing / in_transit / delivered / failed"],["handled_by","uuid FK","พนักงานจัดส่งที่รับงาน (SET NULL)"],["shipped_at","timestamptz","เวลาออกจากร้าน"],["delivered_at","timestamptz","เวลาส่งถึง"]],
  r:["orders 1:0..1 shipments (RESTRICT)","partial UNIQUE (carrier, tracking_no) WHERE tracking_no IS NOT NULL","ส่งด้วยขนส่งต้องมี carrier + tracking_no: บังคับใน update_shipment()","index shipments(status)"],
  a:"อ่าน: Admin, คลัง, ขาย, บัญชี, จัดส่ง (งานตัวเอง/ยังไม่มีคนรับ), เจ้าของคำสั่งซื้อ · เขียน: ผ่าน RPC",u:"employee/delivery.html · orders.html"},
 {n:"conversations",g:"จัดส่งและแชท",p:"ห้องแชทระหว่างลูกค้ากับฝ่ายขาย/บริการ",ex:"ลูกค้าเปิดห้อง (waiting_staff) → ฝ่ายขายรับเรื่อง (in_progress) → ปิด (closed)",
  c:[["id","uuid PK","รหัสห้อง"],["customer_id","uuid FK","ลูกค้า (RESTRICT)"],["staff_id","uuid FK","พนักงานที่รับเรื่อง (SET NULL)"],["order_id","uuid FK","คำสั่งซื้อที่คุยถึง (ไม่บังคับ)"],["status","conversation_status","waiting_staff / in_progress / closed"],["created_at","timestamptz","เวลาเปิดห้อง"],["closed_at","timestamptz","เวลาปิดห้อง"]],
  r:["profiles 1:N conversations · 1:N messages","index conversations(customer_id), (status)"],
  a:"อ่าน: เจ้าของ, ขาย, Admin · ลูกค้าเปิดห้องได้เฉพาะของตัวเอง · แก้สถานะ: ขาย, Admin",u:"chat.html · employee/service.html"},
 {n:"messages",g:"จัดส่งและแชท",p:"ข้อความแต่ละข้อความในห้องแชท (ข้อความหรือรูป) ส่งแบบ Realtime",ex:"ฝั่งลูกค้าแสดงผู้ส่งเป็น \"ฝ่ายบริการ\" ไม่แสดงชื่อพนักงาน",
  c:[["id","uuid PK","รหัสข้อความ"],["conversation_id","uuid FK","ห้องแชท (CASCADE)"],["sender_type","sender_type","customer / staff"],["sender_id","uuid FK","ผู้ส่ง (NO ACTION)"],["body","text","ข้อความ"],["image_path","text","รูปแนบ"],["created_at","timestamptz","เวลาส่ง"]],
  r:["CHECK body หรือ image_path ต้องมีอย่างน้อย 1","index (conversation_id, created_at)","แก้ไขข้อความไม่ได้ (revoke update)"],
  a:"อ่าน/ส่ง: คนในห้อง (ลูกค้าเจ้าของ, ขาย, Admin) · แก้/ลบ: ไม่มีใคร",u:"chat.html · employee/service.html"},
 {n:"store_settings",g:"ร้านและ log",p:"ตั้งค่าร้าน มีแค่ 1 แถว (QR พร้อมเพย์ บัญชีธนาคาร เวลาทำการ ค่าส่ง เวลายกเลิกอัตโนมัติ)",ex:"id เป็น boolean + CHECK (id) ทำให้มีได้แถวเดียว",
  c:[["id","boolean PK","true เสมอ (CHECK) = แถวเดียว"],["store_name","text","ชื่อร้าน"],["promptpay_qr_path","text","รูป QR พร้อมเพย์"],["bank_name","text","ธนาคาร"],["bank_account_no","text","เลขบัญชี"],["bank_account_name","text","ชื่อบัญชี"],["business_hours","text","เวลาทำการ"],["shipping_fee","numeric(10,2)","ค่าส่ง CHECK ≥ 0"],["payment_window_hours","integer","ชั่วโมงให้โอนก่อนยกเลิก (default 24)"],["reupload_window_hours","integer","ชั่วโมงให้อัปสลิปใหม่ (default 24)"],["updated_at","timestamptz","แก้ล่าสุด"],["updated_by","uuid FK","คนแก้ (trigger set_updated_by)"]],
  r:["trigger after_store_settings_update เก็บ audit ทุกครั้ง"],
  a:"อ่าน: ผู้ที่ล็อกอิน · ผู้เยี่ยมชมอ่านผ่าน view store_public (ชื่อร้าน เวลาทำการ ค่าส่ง) · แก้: Admin",u:"employee/admin.html · orders.html (QR)"},
 {n:"stock_logs",g:"ร้านและ log",p:"ประวัติการเคลื่อนไหวสต็อกทุกครั้ง (ขาย ยกเลิก ปรับเอง รับคืน)",ex:"place_order() เขียน 'order' · ยกเลิกเขียน 'cancel' · คลังแก้เองเขียน 'adjust' ผ่าน trigger",
  c:[["id","bigint PK (identity)","ลำดับ log"],["variant_id","uuid FK","ตัวเลือกสินค้า (RESTRICT)"],["change_qty","integer","จำนวนที่เปลี่ยน (ติดลบ = ออก)"],["reason","text","CHECK IN (order, cancel, adjust, return)"],["order_id","uuid FK","คำสั่งซื้อที่เกี่ยวข้อง (SET NULL)"],["actor_id","uuid FK","คนที่ทำ (SET NULL)"],["created_at","timestamptz","เวลา"]],
  r:["append-only: มีแค่ policy SELECT","index (variant_id, created_at)","variant_id RESTRICT: ลบตัวเลือกที่มีประวัติไม่ได้"],
  a:"อ่าน: Admin, คลัง · แก้/ลบ: ไม่มีใคร รวม Admin",u:"employee/warehouse.html · employee/admin.html"},
 {n:"audit_logs",g:"ร้านและ log",p:"log การกระทำสำคัญ เช่น เปลี่ยน role เปลี่ยนราคา ปรับสต็อก อนุมัติคืนเงิน แก้ตั้งค่าร้าน",ex:"เขียนผ่านฟังก์ชัน write_audit() จาก trigger เท่านั้น",
  c:[["id","bigint PK (identity)","ลำดับ log"],["actor_id","uuid FK","คนที่ทำ (SET NULL)"],["action","text","ชื่อการกระทำ เช่น variant.price, refund.approved"],["target_table","text","ตารางที่ถูกแก้"],["target_id","text","รหัสแถวที่ถูกแก้"],["detail","jsonb","ค่าเก่า/ใหม่"],["created_at","timestamptz","เวลา"]],
  r:["append-only (Confidential)","index audit_logs(created_at)"],
  a:"อ่าน: Admin เท่านั้น · แก้/ลบ: ไม่มีใคร",u:"employee/admin.html"},
];
(function(){
  const list = document.getElementById("ddList"), q = document.getElementById("ddSearch");
  let cur = DD[0].n;
  const set = (id, t) => (document.getElementById(id).textContent = t);
  const pick = (n) => { cur = n; const t = DD.find((x) => x.n === n);
    set("ddGroup", "กลุ่ม" + t.g + " · " + t.c.length + " คอลัมน์"); set("ddName", t.n); set("ddPurpose", t.p); set("ddExample", t.ex); set("ddAccess", t.a); set("ddUsed", "หน้าจอที่ใช้: " + t.u);
    const tb = document.querySelector("#ddCols tbody"); tb.textContent = "";
    t.c.forEach(([c, ty, d]) => { const tr = document.createElement("tr"); const a = document.createElement("td"); const code = document.createElement("code"); code.textContent = c; a.appendChild(code); const b = document.createElement("td"); b.className = "mono"; b.style.whiteSpace = "nowrap"; b.textContent = ty; const e = document.createElement("td"); e.textContent = d; tr.append(a, b, e); tb.appendChild(tr); });
    const ul = document.getElementById("ddRules"); ul.textContent = ""; t.r.forEach((r) => { const li = document.createElement("li"); li.textContent = r; ul.appendChild(li); });
    list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b.dataset.n === n)); };
  const render = () => { const s = q.value.trim().toLowerCase(); list.textContent = ""; let last = "";
    DD.filter((t) => !s || (t.n + " " + t.p + " " + t.c.map((c) => c.join(" ")).join(" ")).toLowerCase().includes(s)).forEach((t) => {
      if (t.g !== last) { last = t.g; const h = document.createElement("div"); h.className = "wb-group"; h.textContent = t.g; list.appendChild(h); }
      const b = document.createElement("button"); b.type = "button"; b.dataset.n = t.n; const bb = document.createElement("b"); bb.textContent = t.n; b.append(bb, document.createElement("br"), document.createTextNode(t.p.split(" ").slice(0, 6).join(" "))); b.onclick = () => pick(t.n); b.setAttribute("aria-current", t.n === cur); list.appendChild(b); }); };
  q.addEventListener("input", render); render(); pick(cur);
})();

/* ---------- การเลื่อนสไลด์ ---------- */
const slides = [...document.querySelectorAll(".slide")];
const counter = document.getElementById("counter"), bar = document.getElementById("progress");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let idx = 0;
function setCurrent(i){
  idx = i; counter.textContent = (i + 1) + " / " + slides.length;
  bar.style.width = ((i + 1) / slides.length * 100) + "%";
  history.replaceState(null, "", "#slide-" + (i + 1));
}
function go(i, instant){ i = Math.max(0, Math.min(slides.length - 1, i)); slides[i].scrollIntoView({behavior: (instant || reduce) ? "instant" : "smooth", block:"start"}); setCurrent(i); }
document.getElementById("prev").onclick = () => go(idx - 1);
document.getElementById("next").onclick = () => go(idx + 1);
document.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(+a.dataset.go - 1); }));
const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) { const i = slides.indexOf(en.target); if (i !== idx) setCurrent(i); } }); }, {threshold:0.45});
slides.forEach((s) => io.observe(s));

/* overview */
const ov = document.getElementById("overview"), ovGrid = document.getElementById("ovGrid");
slides.forEach((s, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "ov-card" + (s.classList.contains("theme-light") ? " light" : ""); const n = document.createElement("span"); n.textContent = String(i + 1).padStart(2, "0"); const t = document.createElement("b"); t.textContent = s.dataset.title; b.append(n, t); b.onclick = () => { closeOv(); go(i, true); }; ovGrid.appendChild(b); });
function openOv(){ ov.classList.add("open"); ovGrid.querySelectorAll(".ov-card").forEach((c, i) => c.setAttribute("aria-current", i === idx)); (ovGrid.children[idx] || ovGrid.firstChild).focus(); }
function closeOv(){ ov.classList.remove("open"); }
document.getElementById("ovBtn").onclick = () => ov.classList.contains("open") ? closeOv() : openOv();
document.getElementById("ovClose").onclick = closeOv;
ov.addEventListener("click", (e) => { if (e.target === ov) closeOv(); });

function toggleFs(){ if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
document.getElementById("fsBtn").onclick = toggleFs;

/* ธีม: มืดเป็นค่าเริ่มต้น จำค่าที่เลือกไว้ในเครื่อง (อ่าน/เขียนไม่ได้ก็ยังสลับได้) */
function toggleTheme(){
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("hompb-slides-theme", next); } catch {}
}
document.getElementById("themeBtn").onclick = toggleTheme;

document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") { if (e.key === "Escape") e.target.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === "Escape") { closeOv(); return; }
  if (ov.classList.contains("open")) return;
  if (k === "ArrowRight" || k === "PageDown") { e.preventDefault(); go(idx + 1); }
  else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(idx - 1); }
  else if (k === "Home") { e.preventDefault(); go(0); }
  else if (k === "End") { e.preventDefault(); go(slides.length - 1); }
  else if (k === "g" || k === "G") { e.preventDefault(); openOv(); }
  else if (k === "f" || k === "F") { e.preventDefault(); toggleFs(); }
  else if (k === "t" || k === "T") { e.preventDefault(); toggleTheme(); }
});

/* deep link #slide-N */
(function(){ const m = location.hash.match(/^#slide-(\d+)$/); if (m) { const i = +m[1] - 1; requestAnimationFrame(() => go(i, true)); } else setCurrent(0); })();
