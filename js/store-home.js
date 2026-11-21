// ========== หน้าแรก: "สินค้าแนะนำ" ==========
// แต่ละห้องแสดงไม่เกิน HOME_PER_ZONE ใบ: สินค้าจริงจากฐานข้อมูลก่อน ที่เหลือเติมด้วยสินค้าตัวอย่าง (js/catalog.js)
// ปุ่มโซนด้านบนกรองได้ เพราะการ์ดมี class z-โซน (CSS ใน main_page.css)
// ถ้าโหลดสินค้าจริงไม่ได้ ตัวอย่างที่แสดงไว้ก่อนยังอยู่
const HOME_PER_ZONE = 8;

function renderHome(list, favs) {
  const samples = samplesExcept(list);
  const cards = [];
  for (const [slug] of ZONES) {
    const real = list.filter((p) => p.slug === slug).slice(0, HOME_PER_ZONE);
    const fill = samples.filter((s) => s.slug === slug).slice(0, HOME_PER_ZONE - real.length);
    cards.push(...real.map((p) => productCard(p, favs)), ...fill.map(sampleCard));
  }
  // สินค้าจริงที่ไม่ได้อยู่ห้องไหน ขึ้นท้ายสุด
  cards.push(...list.filter((p) => !p.slug).map((p) => productCard(p, favs)));
  $("#homeGrid").innerHTML = cards.join("");
}

// จำสินค้าที่โหลดล่าสุดไว้ในแท็บนี้ (sessionStorage) กดดูสินค้าแล้วกดย้อนกลับ
// จะวาดสินค้าชุดเดิมทันที ไม่ขึ้นการ์ดตัวอย่างก่อน และเบราว์เซอร์เลื่อนกลับไปตำแหน่งเดิมได้ถูก
// แล้วค่อยโหลดใหม่จากฐานข้อมูลมาแทน (ราคา / สต๊อกล่าสุด)
const HOME_CACHE = "hompb-home";
function readHomeCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(HOME_CACHE));
    if (c && Array.isArray(c.list)) return c;
  } catch {}
  return null;
}
function saveHomeCache(list, favs) {
  try {
    sessionStorage.setItem(HOME_CACHE, JSON.stringify({ list, favs: [...favs] }));
  } catch {}
}

const cached = readHomeCache();
renderHome(cached?.list || [], new Set(cached?.favs || []));

(async () => {
  me = await currentProfile();
  if (me && !me.is_active) me = null;
  refreshCartCount(); // ตัวเลขบนไอคอนตะกร้าที่หัวเว็บ
  const [list, favs] = await Promise.all([fetchProducts(), myFavorites()]);
  if (!list.length) return;
  renderHome(list, favs);
  saveHomeCache(list, favs);
})();
