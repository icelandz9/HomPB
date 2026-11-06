// ========== zone.html?z=bed (สินค้าตามห้อง) และ search.html?q=คำค้น ==========
// สินค้าจริงขึ้นก่อน ตามด้วยสินค้าตัวอย่าง (js/catalog.js) ของห้องนั้น / ที่ชื่อตรงคำค้น
(async () => {
  await renderHeader();
  const isZone = location.pathname.endsWith("zone.html");
  const z = param("z"),
    q = param("q").trim();
  const title = isZone ? zoneName(z) || "ทุกห้อง" : q ? `ผลการค้นหา “${q}”` : "สินค้าทั้งหมด";
  document.title = title + " | HomPB";

  const [list, favs] = await Promise.all([fetchProducts(isZone ? { zone: z } : { q }), myFavorites()]);
  const samples = samplesExcept(list).filter((s) => (isZone ? !z || s.slug === z : s.name.includes(q)));
  const count = samples.length ? `${list.length} รายการ · สินค้าตัวอย่าง (เร็วๆ นี้) ${samples.length} รายการ` : `${list.length} รายการ`;
  $("#main").innerHTML = `<p class="crumb"><a href="${site("index.html")}">หน้าแรก</a> / ${esc(title)}</p>
<h1>${esc(title)}</h1>
<p class="muted">${count}</p>
${
  list.length || samples.length
    ? `<div class="grid">${list.map((p) => productCard(p, favs)).join("")}${samples.map(sampleCard).join("")}</div>`
    : `<div class="empty-state">${ic("search", 48)}<p>${q ? "ไม่พบสินค้าที่ค้นหา ลองคำอื่น" : "ยังไม่มีสินค้าในหมวดนี้"}</p><a class="btn" href="${site("search.html")}">ดูสินค้าทั้งหมด</a></div>`
}`;
})();
