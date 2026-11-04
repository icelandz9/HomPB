// ========== cart.html (ตะกร้า + สั่งซื้อ ต้องล็อกอินเป็นลูกค้า) ==========
// สั่งซื้อ = เลือกที่อยู่ แล้วเรียก place_order (ตัดสต๊อก สร้างคำสั่งซื้อ ล้างตะกร้า ในฐานข้อมูลทีเดียว)

let lines = []; // {variantId, qty, name, variant, price, inStock, img, productId}
let addrs = []; // ที่อยู่ของฉัน
let fee = 0; // ค่าส่งจาก store_public

async function loadCart() {
  const { data: items, error } = await sb.from("cart_items").select("variant_id, quantity").order("added_at");
  if (error) return toast("โหลดตะกร้าไม่สำเร็จ: " + errText(error), true);
  const vids = items.map((x) => x.variant_id);
  const { data: vs } = vids.length
    ? await sb.from("variants_public").select("id, product_id, name, price, in_stock").in("id", vids)
    : { data: [] };
  const products = await fetchProducts({ ids: [...new Set((vs || []).map((v) => v.product_id))] });
  const byP = Object.fromEntries(products.map((p) => [p.id, p]));
  const byV = Object.fromEntries((vs || []).map((v) => [v.id, v]));
  lines = items
    .filter((x) => byV[x.variant_id] && byP[byV[x.variant_id].product_id]) // สินค้าที่ปิดขายแล้วไม่แสดง
    .map((x) => {
      const v = byV[x.variant_id],
        p = byP[v.product_id];
      return { variantId: v.id, qty: x.quantity, name: p.name, variant: v.name, price: v.price, inStock: v.in_stock, img: p.img, productId: p.id };
    });
}

async function loadCheckout() {
  const [{ data: a }, { data: s }] = await Promise.all([
    sb.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at"),
    sb.from("store_public").select("shipping_fee").single(),
  ]);
  addrs = a || [];
  fee = Number(s?.shipping_fee || 0);
}

const addrText = (a) =>
  `${a.recipient_name} · ${a.phone}<br><span class="muted">${esc([a.address_line, a.subdistrict, a.district, a.province, a.postcode].filter(Boolean).join(" "))}</span>`;

function render() {
  if (!lines.length) {
    $("#main").innerHTML = `<h1>ตะกร้าสินค้า</h1><div class="empty-state">${ic("cart", 48)}<p>ยังไม่มีสินค้าในตะกร้า</p><a class="btn" href="${site("index.html")}">เลือกซื้อสินค้า</a></div>`;
    return;
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const soldOut = lines.some((l) => !l.inStock);
  $("#main").innerHTML = `<h1>ตะกร้าสินค้า</h1>
<div class="cart">
  <section class="panel">
    ${lines
      .map(
        (l, i) => `<div class="line-item">
  ${l.img ? `<img class="thumb" src="${esc(l.img)}" alt="">` : `<span class="thumb"></span>`}
  <div><a href="${site("product.html?id=" + l.productId)}"><b>${esc(l.name)}</b></a>${l.variant !== "มาตรฐาน" ? `<br><small class="muted">${esc(l.variant)}</small>` : ""}
    <br><span class="num">${baht(l.price)}</span>${l.inStock ? "" : ' <span class="pill bad">สินค้าหมด</span>'}</div>
  <div class="acts">
    <div class="qty"><button type="button" onclick="setQty(${i}, ${l.qty - 1})" aria-label="ลด">−</button><span>${l.qty}</span><button type="button" onclick="setQty(${i}, ${l.qty + 1})" aria-label="เพิ่ม">+</button></div>
    <button type="button" class="link-btn" onclick="setQty(${i}, 0)">ลบ</button>
  </div>
</div>`,
      )
      .join("")}
  </section>
  <aside class="panel" style="display:grid;gap:16px">
    <div>
      <h2>ที่อยู่จัดส่ง</h2>
      <div style="display:grid;gap:8px">${addrs
        .map((a, i) => `<label class="addr"><input type="radio" name="addr" value="${a.id}"${i === 0 ? " checked" : ""}><span>${addrText(a)}</span></label>`)
        .join("")}
      <label class="addr"><input type="radio" name="addr" value="new"${addrs.length ? "" : " checked"}><span>ที่อยู่ใหม่</span></label></div>
      <div id="newAddr" class="fields" style="margin-top:12px"></div>
    </div>
    <div>
      <div class="sum-row"><span>ราคาสินค้า</span><span class="num">${baht(subtotal)}</span></div>
      <div class="sum-row"><span>ค่าส่ง</span><span class="num">${fee ? baht(fee) : "ฟรี"}</span></div>
      <div class="sum-row total"><span>รวม</span><span class="num">${baht(subtotal + fee)}</span></div>
    </div>
    ${soldOut ? '<p class="pill bad">มีสินค้าหมด ลบออกก่อนสั่งซื้อ</p>' : ""}
    <button type="button" class="btn lg block" id="orderBtn"${soldOut ? " disabled" : ""}>สั่งซื้อและไปชำระเงิน</button>
    <p class="muted" style="font-size:13px">ชำระเงินด้วยการโอนหรือพร้อมเพย์ แล้วแนบสลิปในหน้าคำสั่งซื้อ</p>
  </aside>
</div>`;
  document.querySelectorAll('input[name="addr"]').forEach((r) => r.addEventListener("change", showNewAddr));
  showNewAddr();
  $("#orderBtn").addEventListener("click", placeOrder);
}

// ฟอร์มที่อยู่ใหม่ (แสดงเมื่อเลือก "ที่อยู่ใหม่")
function showNewAddr() {
  const isNew = $('input[name="addr"]:checked')?.value === "new";
  const f = (id, label, attrs = "", val = "") =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" ${attrs} value="${esc(val)}"></div>`;
  $("#newAddr").innerHTML = isNew
    ? f("a_name", "ชื่อผู้รับ", 'autocomplete="name"', me.full_name || "") +
      f("a_phone", "เบอร์โทร", 'type="tel" autocomplete="tel"', me.phone || "") +
      f("a_line", "บ้านเลขที่ ถนน", 'autocomplete="address-line1"') +
      f("a_sub", "ตำบล / แขวง") +
      f("a_dist", "อำเภอ / เขต") +
      f("a_prov", "จังหวัด") +
      f("a_post", "รหัสไปรษณีย์", 'inputmode="numeric" maxlength="5" autocomplete="postal-code"')
    : "";
}

async function setQty(i, qty) {
  const l = lines[i];
  const { error } =
    qty <= 0
      ? await sb.from("cart_items").delete().eq("variant_id", l.variantId)
      : await sb.from("cart_items").update({ quantity: qty }).eq("variant_id", l.variantId);
  if (error) return toast("แก้ตะกร้าไม่สำเร็จ: " + errText(error), true);
  await loadCart();
  render();
  refreshCartCount();
}

async function placeOrder() {
  const btn = $("#orderBtn");
  let addrId = $('input[name="addr"]:checked')?.value;
  if (addrId === "new") {
    const v = (id) => $("#" + id).value.trim();
    const row = {
      user_id: me.id,
      recipient_name: v("a_name"),
      phone: v("a_phone"),
      address_line: v("a_line"),
      subdistrict: v("a_sub"),
      district: v("a_dist"),
      province: v("a_prov"),
      postcode: v("a_post"),
      is_default: !addrs.some((a) => a.is_default),
    };
    if (Object.values(row).some((x) => x === "")) return toast("กรอกที่อยู่ให้ครบทุกช่อง", true);
    if (!/^\d{5}$/.test(row.postcode)) return toast("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก", true);
    btn.disabled = true;
    const { data, error } = await sb.from("addresses").insert(row).select("id").single();
    if (error) {
      btn.disabled = false;
      return toast("บันทึกที่อยู่ไม่สำเร็จ: " + errText(error), true);
    }
    addrId = data.id;
  }
  btn.disabled = true;
  const { data: orderId, error } = await sb.rpc("place_order", { p_address_id: addrId });
  if (error) {
    btn.disabled = false;
    await loadCart(); // สต๊อกอาจเปลี่ยน โหลดใหม่ให้เห็นของที่หมด
    render();
    return toast(errText(error), true); // เช่น "สินค้า หมอน (มาตรฐาน) มีไม่พอ"
  }
  location.href = site("orders.html?id=" + orderId);
}

(async () => {
  await renderHeader();
  if (!needCustomer()) {
    if (me) $("#main").innerHTML = '<div class="empty-state"><p>บัญชีพนักงานใช้ตะกร้าไม่ได้</p></div>';
    return;
  }
  await Promise.all([loadCart(), loadCheckout()]);
  render();
})();
