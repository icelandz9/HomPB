// ========== favorites.html (รายการโปรด ต้องล็อกอิน) ==========
(async () => {
  await renderHeader();
  if (!me) return goLogin();
  const favs = await myFavorites();
  const list = await fetchProducts({ ids: [...favs] });
  $("#main").innerHTML = `<h1>รายการโปรด</h1>${
    list.length
      ? `<div class="grid">${list.map((p) => productCard(p, favs)).join("")}</div>`
      : `<div class="empty-state">${ic("heart", 48)}<p>ยังไม่มีรายการโปรด กดรูปหัวใจที่สินค้าเพื่อบันทึกไว้ดูทีหลัง</p><a class="btn" href="${site("index.html")}">เลือกซื้อสินค้า</a></div>`
  }`;
})();
