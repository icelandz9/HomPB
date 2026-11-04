// ========== หัวเว็บหน้าร้าน: เปลี่ยนปุ่มบัญชีตามสถานะล็อกอิน ==========
// ยังไม่ล็อกอิน: ลิงก์ที่มี data-account ไปหน้า login (ค่าใน html อยู่แล้ว)
// ล็อกอินแล้ว: ลูกค้าไปหน้าโปรไฟล์ พนักงานไปหน้าฝ่ายของตัวเอง ปุ่มสมัครสมาชิก (data-register) ซ่อน

(async () => {
  const p = await currentProfile();
  if (!p || !p.is_active) return;

  const staff = p.role !== "customer";
  const href = site(staff ? ROLE_HOME[p.role] : "profile/profile.html");
  const first = (p.full_name || p.email).split(" ")[0];
  const text = staff ? "ระบบหลังบ้าน" : "สวัสดี, " + first;

  document.querySelectorAll("[data-account]").forEach((a) => {
    a.href = href;
    a.setAttribute("aria-label", text);
    // ข้อความอยู่ใน .lbl (หัวเว็บ), <b> (เมนูมือถือ) หรือในลิงก์ตรงๆ (เมนูบัญชีของฉัน)
    const label = a.querySelector(".lbl, b") || a;
    label.textContent = text;
  });
  document.querySelectorAll("[data-register]").forEach((a) => (a.hidden = true));
})();
