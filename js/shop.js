// ========== ส่วนกลางของหน้าร้าน (product, zone, search, cart, orders, chat, favorites) ==========
// ต้องโหลดหลัง js/supabase.js ใช้ sb, currentProfile, requireLogin, site, ROLE_HOME จากไฟล์นั้น

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const baht = (n) => "฿" + Number(n).toLocaleString("th-TH");
const thDate = (d) => (d ? new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-");
const param = (k) => new URLSearchParams(location.search).get(k) || "";

// โซน: ชื่อใน categories ↔ ตัวย่อใน URL (zone.html?z=bed) และ class ในการ์ด (z-bed)
const ZONES = [
  ["bed", "ห้องนอน"],
  ["bath", "ห้องน้ำ"],
  ["living", "ห้องนั่งเล่น"],
  ["kitchen", "ห้องครัว"],
  ["appliance", "เครื่องใช้ไฟฟ้า"],
];
const zoneName = (slug) => (ZONES.find((z) => z[0] === slug) || [])[1] || "";
const zoneSlug = (name) => (ZONES.find((z) => z[1] === name) || [])[0] || "";

// ไอคอนเส้น (ชุดเดียวกับหน้าแรก)
const IC = {
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  cart: "M3 4h2l2.4 11h10.2L20 8H6.2 M9 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M16 20a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  truck: "M2 6h12v10H2z M14 9h4l3 3v4h-7 M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  chat: "M4 5h16v11H9l-5 4z M8 9h8 M8 12h5",
  user: "M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21c0-4 4-6 8-6s8 2 8 6",
  search: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M20 20l-4-4",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12 M18 6L6 18",
  plus: "M12 5v14 M5 12h14",
  box: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
};
const ic = (name, size = 20) =>
  `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${IC[name]}"/></svg>`;

function toast(msg, bad) {
  const t = document.createElement("div");
  t.className = "shop-toast" + (bad ? " bad" : "");
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ========== หัวเว็บของหน้าร้าน (ทุกหน้านอกจาก index ใช้ตัวนี้) ==========
let me = null; // profile คนที่ล็อกอิน หรือ null

async function renderHeader() {
  me = await currentProfile();
  if (me && !me.is_active) me = null;
  const staff = me && me.role !== "customer";
  const account = !me
    ? { href: site("auth/login.html"), text: "เข้าสู่ระบบ" }
    : staff
      ? { href: site(ROLE_HOME[me.role]), text: "ระบบหลังบ้าน" }
      : { href: site("profile/profile.html"), text: (me.full_name || me.email).split(" ")[0] };
  const link = (href, icon, text, extra = "") =>
    `<a href="${site(href)}" class="sh-ic"${extra} aria-label="${text}">${ic(icon, 22)}<span class="lbl">${text}</span></a>`;
  const h = document.createElement("header");
  h.className = "shop-hdr";
  h.innerHTML = `<div class="wrap shop-hdr-row">
<a href="${site("index.html")}" class="logo" aria-label="HomPB หน้าแรก">HOMPB</a>
<form action="${site("search.html")}" method="get" class="shop-search" role="search">
  <label for="sq" class="sr">ค้นหาสินค้า</label>
  <input id="sq" name="q" type="search" placeholder="ค้นหาสินค้า เช่น หมอน โซฟา กาต้มน้ำ" value="${esc(param("q"))}">
  <button type="submit" aria-label="ค้นหา">${ic("search")}</button>
</form>
<nav class="shop-icons" aria-label="บัญชีและตะกร้า">
  ${link("favorites.html", "heart", "รายการโปรด")}
  ${link("orders.html", "truck", "คำสั่งซื้อ")}
  ${link("chat.html", "chat", "แชท")}
  ${link("cart.html", "cart", "ตะกร้า")}
  <a href="${account.href}" class="sh-ic" aria-label="${esc(account.text)}">${ic("user", 22)}<span class="lbl">${esc(account.text)}</span></a>
</nav>
</div>
<nav class="wrap shop-zones" aria-label="ห้องต่างๆ">${ZONES.map(([s, n]) => `<a href="${site("zone.html?z=" + s)}"${param("z") === s ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>`;
  document.body.prepend(h);
  refreshCartCount();
}

// จำนวนชิ้นในตะกร้าบนไอคอน
async function refreshCartCount() {
  const a = document.querySelector('.shop-icons a[href$="cart.html"]');
  if (!a || !me) return;
  const { data } = await sb.from("cart_items").select("quantity");
  const n = (data || []).reduce((s, x) => s + x.quantity, 0);
  a.querySelector(".badge")?.remove();
  if (n) a.insertAdjacentHTML("beforeend", `<span class="badge">${n}</span>`);
}

// ========== สินค้า ==========
const imgUrl = (path) => (path ? sb.storage.from("product-images").getPublicUrl(path).data.publicUrl : "");

// สินค้าที่เปิดขาย + ราคา/มีของ จาก view variants_public (ลูกค้าอ่าน product_variants ตรงไม่ได้)
// opts: { ids: [..], zone: "bed", q: "คำค้น", id: "uuid" }
async function fetchProducts(opts = {}) {
  let q = sb
    .from("products")
    .select("id, name, description, created_at, product_images (image_path, sort_order), product_categories (categories (name))")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (opts.id) q = q.eq("id", opts.id);
  if (opts.ids) q = q.in("id", opts.ids.length ? opts.ids : ["00000000-0000-0000-0000-000000000000"]);
  if (opts.q) q = q.ilike("name", `%${opts.q.replace(/[%_,()]/g, " ").trim()}%`);
  const { data, error } = await q;
  if (error) {
    toast("โหลดสินค้าไม่สำเร็จ: " + errText(error), true);
    return [];
  }
  const ids = data.map((p) => p.id);
  const { data: vs } = ids.length
    ? await sb.from("variants_public").select("id, product_id, name, price, in_stock").in("product_id", ids)
    : { data: [] };
  const byProduct = {};
  for (const v of vs || []) (byProduct[v.product_id] ||= []).push(v);
  let list = data
    .filter((p) => byProduct[p.id]) // ไม่มี variant ที่เปิดขาย = ยังซื้อไม่ได้ ไม่แสดง
    .map((p) => {
      const variants = byProduct[p.id].sort((a, b) => a.price - b.price);
      const img = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
      const zone = p.product_categories[0]?.categories?.name || "";
      return {
        id: p.id,
        name: p.name,
        desc: p.description || "",
        zone,
        slug: zoneSlug(zone),
        img: img ? imgUrl(img.image_path) : "",
        variants,
        price: variants[0].price,
        inStock: variants.some((v) => v.in_stock),
      };
    });
  if (opts.zone) list = list.filter((p) => p.slug === opts.zone);
  return list;
}

// การ์ดสินค้า (markup เดียวกับหน้าแรก ใช้ CSS ใน main_page.css)
function productCard(p, favs = new Set()) {
  const v = p.variants.find((x) => x.in_stock) || p.variants[0];
  const url = site("product.html?id=" + p.id);
  return `<article class="card${p.slug ? " z-" + p.slug : ""}">
<div class="img">${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : `<span class="noimg">${ic("box", 64)}</span>`}
<button type="button" class="icon-btn fav${favs.has(p.id) ? " on" : ""}" data-fav="${p.id}" aria-pressed="${favs.has(p.id)}" aria-label="บันทึก ${esc(p.name)} ในรายการโปรด">${ic("heart", 22)}</button></div>
<span class="zone">${esc(p.zone || "-")}</span>
<a href="${url}" class="name">${esc(p.name)}</a>
<span class="stock${p.inStock ? "" : " out"}">${ic(p.inStock ? "check" : "x", 14)}${p.inStock ? "มีสินค้า" : "สินค้าหมด"}</span>
<div class="foot"><span class="price num"><span class="cur">฿</span><span class="amt">${Number(v.price).toLocaleString("th-TH")}</span></span>
<button type="button" class="btn sm" data-add="${v.id}"${p.inStock ? "" : " disabled"} aria-label="เพิ่ม ${esc(p.name)} ลงตะกร้า">${ic("plus", 16)}<span>ตะกร้า</span></button></div>
</article>`;
}

async function myFavorites() {
  if (!me) return new Set();
  const { data } = await sb.from("favorites").select("product_id");
  return new Set((data || []).map((x) => x.product_id));
}

// ต้องเป็นลูกค้าที่ล็อกอิน (พนักงานซื้อของไม่ได้ เพราะ place_order รับเฉพาะ role customer)
function needCustomer() {
  if (!me) {
    goLogin();
    return false;
  }
  if (me.role !== "customer") {
    toast("บัญชีพนักงานใช้ตะกร้า/รายการโปรดไม่ได้ ใช้บัญชีลูกค้าแทน", true);
    return false;
  }
  return true;
}

async function addToCart(variantId, qty = 1) {
  if (!needCustomer()) return false;
  const { data: cur } = await sb.from("cart_items").select("quantity").eq("variant_id", variantId).maybeSingle();
  const { error } = await sb
    .from("cart_items")
    .upsert({ user_id: me.id, variant_id: variantId, quantity: (cur?.quantity || 0) + qty });
  if (error) {
    toast("เพิ่มลงตะกร้าไม่สำเร็จ: " + errText(error), true);
    return false;
  }
  toast("เพิ่มลงตะกร้าแล้ว");
  refreshCartCount();
  return true;
}

async function toggleFav(productId, btn) {
  if (!needCustomer()) return;
  const on = btn.getAttribute("aria-pressed") === "true";
  const { error } = on
    ? await sb.from("favorites").delete().eq("product_id", productId)
    : await sb.from("favorites").insert({ user_id: me.id, product_id: productId });
  if (error) return toast("บันทึกไม่สำเร็จ: " + errText(error), true);
  btn.setAttribute("aria-pressed", String(!on));
  btn.classList.toggle("on", !on);
  toast(on ? "เอาออกจากรายการโปรดแล้ว" : "บันทึกในรายการโปรดแล้ว");
}

// ปุ่มในการ์ดสินค้าทุกหน้า (data-add / data-fav)
document.addEventListener("click", async (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    add.disabled = true;
    await addToCart(add.dataset.add);
    add.disabled = false;
  }
  const fav = e.target.closest("[data-fav]");
  if (fav) toggleFav(fav.dataset.fav, fav);
});

// สถานะ → ภาษาไทย
const ORDER_STATUS = {
  pending_payment: ["รอชำระเงิน", "warn"],
  awaiting_approval: ["รอตรวจสลิป", "warn"],
  approved: ["ชำระแล้ว · รอจัดส่ง", "ok"],
  shipping: ["กำลังจัดส่ง", "ok"],
  delivered: ["ส่งถึงแล้ว", "ok"],
  cancelled: ["ยกเลิก", "bad"],
  refunded: ["คืนเงินแล้ว", "neutral"],
};
const pill = ([text, kind]) => `<span class="pill ${kind}">${text}</span>`;
