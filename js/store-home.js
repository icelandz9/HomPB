// ========== หน้าแรก: "สินค้าแนะนำ" ดึงจากฐานข้อมูล ==========
// ถ้ามีสินค้าในระบบ แทนการ์ดตัวอย่างใน index.html ด้วยสินค้าจริง (ปุ่มโซนด้านบนยังกรองได้ เพราะใช้ class z-โซน เหมือนเดิม)
// ถ้าโหลดไม่ได้หรือยังไม่มีสินค้า การ์ดตัวอย่างยังอยู่ (ลิงก์ไปหน้าค้นหา)

(async () => {
  me = await currentProfile();
  if (me && !me.is_active) me = null;
  const [list, favs] = await Promise.all([fetchProducts(), myFavorites()]);
  if (!list.length) return;
  $("#homeGrid").innerHTML = list.slice(0, 12).map((p) => productCard(p, favs)).join("");
})();
