// ========== zone.html?z=bed (สินค้าตามห้อง) และ search.html?q=คำค้น ==========
(async () => {
  await renderHeader();
  const isZone = location.pathname.endsWith("zone.html");
  const z = param("z"),
    q = param("q").trim();
  const title = isZone ? zoneName(z) || "ทุกห้อง" : q ? `ผลการค้นหา “${q}”` : "สินค้าทั้งหมด";
  document.title = title + " | HomPB";

  const [list, favs] = await Promise.all([fetchProducts(isZone ? { zone: z } : { q }), myFavorites()]);
  $("#main").innerHTML = `<p class="crumb"><a href="${site("index.html")}">หน้าแรก</a> / ${esc(title)}</p>
<h1>${esc(title)}</h1>
<p class="muted">${list.length} รายการ</p>
${
  list.length
    ? `<div class="grid">${list.map((p) => productCard(p, favs)).join("")}</div>`
    : `<div class="empty-state">${ic("search", 48)}<p>${q ? "ไม่พบสินค้าที่ค้นหา ลองคำอื่น" : "ยังไม่มีสินค้าในหมวดนี้"}</p><a class="btn" href="${site("search.html")}">ดูสินค้าทั้งหมด</a></div>`
}`;
})();
