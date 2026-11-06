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

renderHome([], new Set());

(async () => {
  me = await currentProfile();
  if (me && !me.is_active) me = null;
  const [list, favs] = await Promise.all([fetchProducts(), myFavorites()]);
  if (list.length) renderHome(list, favs);
})();
