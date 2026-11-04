// ========== chat.html (แชทกับฝ่ายบริการลูกค้า ต้องล็อกอินเป็นลูกค้า) ==========
// ?order=... เปิดห้องที่ผูกกับคำสั่งซื้อนั้น (ถ้ายังไม่มี จะสร้างตอนส่งข้อความแรก)
// ลูกค้าเห็นข้อความพนักงานในชื่อ "ฝ่ายบริการลูกค้า HomPB" ไม่เห็นชื่อพนักงาน

const STAFF_NAME = "ฝ่ายบริการลูกค้า HomPB";
const CONV_STATUS = { waiting_staff: "รอเจ้าหน้าที่", in_progress: "กำลังคุย", closed: "ปิดแล้ว" };
let convs = []; // {id, status, orderId, code, msgs:[{mine,text,time}]}
let active = null; // id ห้องที่เปิด หรือ "new"
let newOrderId = param("order") || null; // ห้องใหม่จะผูกกับคำสั่งซื้อนี้

async function load() {
  const [c, m, o] = await Promise.all([
    sb.from("conversations").select("id, status, order_id, created_at").order("created_at", { ascending: false }),
    sb.from("messages").select("conversation_id, sender_type, body, created_at").order("created_at"),
    sb.from("orders").select("id, order_no"),
  ]);
  if (c.error || m.error) return toast("โหลดแชทไม่สำเร็จ: " + errText(c.error || m.error), true);
  const code = Object.fromEntries((o.data || []).map((x) => [x.id, "HPB" + x.order_no]));
  const msgs = {};
  for (const x of m.data)
    (msgs[x.conversation_id] ||= []).push({
      mine: x.sender_type === "customer",
      text: x.body || "[รูปภาพ]",
      time: new Date(x.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    });
  convs = c.data.map((x) => ({ id: x.id, status: x.status, orderId: x.order_id, code: code[x.order_id] || "", msgs: msgs[x.id] || [] }));
  // ห้องที่ผูกกับคำสั่งซื้อจาก ?order= และยังไม่ปิด ใช้ห้องนั้นเลย
  if (active === null) {
    const hit = newOrderId && convs.find((x) => x.orderId === newOrderId && x.status !== "closed");
    active = hit ? hit.id : newOrderId || !convs.length ? "new" : convs[0].id;
  }
}

function render() {
  const draft = $("#msg")?.value || "";
  const c = convs.find((x) => x.id === active);
  const closed = c?.status === "closed";
  const head = c
    ? `แชท${c.code ? " · คำสั่งซื้อ " + c.code : ""}<small>${CONV_STATUS[c.status]}</small>`
    : `เริ่มแชทใหม่${newOrderId ? " · เรื่องคำสั่งซื้อ" : ""}<small>เจ้าหน้าที่จะตอบในช่วงเวลาทำการ</small>`;
  const msgs = c?.msgs.length
    ? c.msgs.map((x) => `<small class="${x.mine ? "me" : ""}">${x.mine ? "คุณ" : STAFF_NAME} · ${x.time}</small><div class="bub${x.mine ? " me" : ""}">${esc(x.text)}</div>`).join("")
    : '<p class="muted">พิมพ์คำถามได้เลย เช่น สอบถามสินค้า การจัดส่ง หรือการชำระเงิน</p>';
  $("#main").innerHTML = `<h1>แชทกับฝ่ายบริการลูกค้า</h1>
<div class="chat-ui">
  <div class="conv-list">
    <button type="button" class="btn btn-ghost" onclick="openConv('new')">${ic("plus", 16)}เริ่มแชทใหม่</button>
    ${convs
      .map((x) => {
        const last = x.msgs[x.msgs.length - 1];
        return `<button type="button" class="conv" aria-current="${x.id === active}" onclick="openConv('${x.id}')"><b>${x.code ? "คำสั่งซื้อ " + x.code : "แชททั่วไป"}</b> · ${CONV_STATUS[x.status]}<small>${esc(last?.text || "")}</small></button>`;
      })
      .join("")}
  </div>
  <div class="chat-win">
    <header>${head}</header>
    <div class="msgs" id="msgs">${msgs}</div>
    ${
      closed
        ? `<div class="send"><span class="muted">แชทนี้ปิดแล้ว</span><button type="button" class="btn sm" onclick="openConv('new')">เริ่มแชทใหม่</button></div>`
        : `<form class="send" onsubmit="send(event)"><label for="msg" class="sr">ข้อความ</label><textarea id="msg" rows="1" placeholder="พิมพ์ข้อความ…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.form.requestSubmit()}">${esc(draft)}</textarea><button class="btn" id="sendBtn">ส่ง</button></form>`
    }
  </div>
</div>`;
  const box = $("#msgs");
  box.scrollTop = box.scrollHeight;
}

function openConv(id) {
  if (id === "new") newOrderId = null;
  active = id;
  if ($("#msg")) $("#msg").value = "";
  render();
}

async function send(e) {
  e.preventDefault();
  const body = $("#msg").value.trim();
  if (!body) return;
  $("#sendBtn").disabled = true;
  let id = active;
  if (id === "new") {
    // ห้องใหม่เริ่มที่ waiting_staff ให้ฝ่ายขายรับเรื่อง (RLS บังคับค่าเริ่มต้นเอง)
    const { data, error } = await sb
      .from("conversations")
      .insert({ customer_id: me.id, order_id: newOrderId })
      .select("id")
      .single();
    if (error) {
      $("#sendBtn").disabled = false;
      return toast("เริ่มแชทไม่สำเร็จ: " + errText(error), true);
    }
    id = active = data.id;
  }
  const { error } = await sb.from("messages").insert({ conversation_id: id, sender_type: "customer", sender_id: me.id, body });
  if (error) {
    $("#sendBtn").disabled = false;
    return toast("ส่งไม่สำเร็จ: " + errText(error), true);
  }
  $("#msg").value = "";
  await load();
  render();
}

(async () => {
  await renderHeader();
  if (!needCustomer()) {
    if (me) $("#main").innerHTML = '<div class="empty-state"><p>พนักงานตอบแชทได้ที่หน้าฝ่ายบริการลูกค้า</p></div>';
    return;
  }
  await load();
  render();
  // ข้อความใหม่จากพนักงานเด้งขึ้นเอง (ต้องเปิด realtime ของ conversations, messages ใน strorage.sql)
  let t = null;
  const refresh = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      await load();
      render();
    }, 300);
  };
  sb.channel("customer-chat")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
    .subscribe();
})();
