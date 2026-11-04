// ========== product.html?id=... (รายละเอียดสินค้า) ==========
(async () => {
  await renderHeader();
  const [p] = await fetchProducts({ id: param("id") });
  if (!p) {
    $("#main").innerHTML = `<div class="empty-state">${ic("box", 48)}<p>ไม่พบสินค้านี้ หรือปิดการขายแล้ว</p><a class="btn" href="${site("index.html")}">กลับหน้าแรก</a></div>`;
    return;
  }
  document.title = p.name + " | HomPB";
  const favs = await myFavorites();
  const many = p.variants.length > 1; // มีหลายแบบ (เช่น สี / ขนาด) ให้เลือก
  const first = p.variants.find((v) => v.in_stock) || p.variants[0];

  $("#main").innerHTML = `<p class="crumb"><a href="${site("index.html")}">หน้าแรก</a> / ${
    p.slug ? `<a href="${site("zone.html?z=" + p.slug)}">${esc(p.zone)}</a> / ` : ""
  }${esc(p.name)}</p>
<section class="pd">
  <div class="pd-img">${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}">` : `<span class="noimg">${ic("box", 96)}</span>`}</div>
  <div class="pd-info">
    <span class="zone">${esc(p.zone || "")}</span>
    <h1>${esc(p.name)}</h1>
    <div class="pd-price num" id="price">${baht(first.price)}</div>
    <span class="stock${first.in_stock ? "" : " out"}" id="stock"></span>
    ${
      many
        ? `<div class="field"><label for="variant">แบบ</label><select id="variant">${p.variants
            .map((v) => `<option value="${v.id}"${v.id === first.id ? " selected" : ""}>${esc(v.name)} · ${baht(v.price)}${v.in_stock ? "" : " (หมด)"}</option>`)
            .join("")}</select></div>`
        : ""
    }
    <div class="pd-buy">
      <div class="qty" aria-label="จำนวน"><button type="button" data-step="-1" aria-label="ลด">−</button><input id="qty" type="number" min="1" value="1" aria-label="จำนวน"><button type="button" data-step="1" aria-label="เพิ่ม">+</button></div>
      <button type="button" class="btn lg" id="addBtn">${ic("cart")}เพิ่มลงตะกร้า</button>
      <button type="button" class="btn btn-ghost lg${favs.has(p.id) ? " on" : ""}" data-fav="${p.id}" aria-pressed="${favs.has(p.id)}">${ic("heart")}รายการโปรด</button>
    </div>
    ${p.desc ? `<div class="panel"><h2>รายละเอียด</h2><p>${esc(p.desc)}</p></div>` : ""}
  </div>
</section>
<section id="related"></section>`;

  const current = () => p.variants.find((v) => v.id === ($("#variant")?.value || first.id));
  const showVariant = () => {
    const v = current();
    $("#price").textContent = baht(v.price);
    $("#stock").className = "stock" + (v.in_stock ? "" : " out");
    $("#stock").innerHTML = ic(v.in_stock ? "check" : "x", 14) + (v.in_stock ? "มีสินค้า" : "สินค้าหมด");
    $("#addBtn").disabled = !v.in_stock;
  };
  showVariant();
  $("#variant")?.addEventListener("change", showVariant);
  document.querySelectorAll("[data-step]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#qty").value = Math.max(1, (parseInt($("#qty").value, 10) || 1) + Number(b.dataset.step));
    }),
  );
  $("#addBtn").addEventListener("click", async () => {
    $("#addBtn").disabled = true;
    await addToCart(current().id, Math.max(1, parseInt($("#qty").value, 10) || 1));
    $("#addBtn").disabled = !current().in_stock;
  });

  // สินค้าห้องเดียวกัน
  if (p.slug) {
    const others = (await fetchProducts({ zone: p.slug })).filter((x) => x.id !== p.id).slice(0, 4);
    if (others.length)
      $("#related").innerHTML = `<h2 style="margin-bottom:16px">สินค้า${esc(p.zone)}อื่นๆ</h2><div class="grid">${others.map((x) => productCard(x, favs)).join("")}</div>`;
  }
})();
