// ========== หัวเว็บหน้าร้าน: เปลี่ยนปุ่มบัญชีตามสถานะล็อกอิน ==========
// ยังไม่ล็อกอิน: ลิงก์ที่มี data-account ไปหน้า login (ค่าใน html อยู่แล้ว)
// ล็อกอินแล้ว: ลูกค้าไปหน้าโปรไฟล์ พนักงานไปหน้าฝ่ายของตัวเอง ปุ่มสมัครสมาชิก (data-register) ซ่อน

// มี session ค้างในเบราว์เซอร์ = น่าจะล็อกอินอยู่ ซ่อนส่วนของคนยังไม่สมัคร ([data-guest-only]) ทันที
// ไม่ต้องรอเช็กกับเซิร์ฟเวอร์ (ไม่อย่างนั้นแบนเนอร์สมัครสมาชิกจะโผล่แวบหนึ่ง) แล้วค่อยแก้ถ้าเช็กแล้วไม่ใช่
try {
  if (Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k))) document.documentElement.classList.add("signed-in");
} catch {}

(async () => {
  const p = await currentProfile();
  document.documentElement.classList.toggle("signed-in", !!(p && p.is_active));
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
