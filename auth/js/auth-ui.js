// ========== หน้าตาของฟอร์ม login / register (ยังไม่ได้เชื่อม Supabase) ==========
// ไฟล์นี้ทำแค่ปุ่มลูกตา และเช็กข้อมูลก่อนส่ง ส่วนการล็อกอิน/สมัครจริงจะเพิ่มทีหลัง

const $ = (s) => document.querySelector(s);

// ปุ่มลูกตา: data-eye="id ของช่องรหัส" (ไอคอนสลับด้วย CSS ตาม aria-pressed)
document.querySelectorAll("[data-eye]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.eye);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
    btn.setAttribute("aria-pressed", String(show));
  });
});

// เช็กช่องที่กรอก คืนข้อความ error ภาษาไทย หรือ "" ถ้าผ่าน
function checkForm() {
  const email = $("#email").value.trim();
  const pw = $("#password").value;
  if ($("#fullName") && !$("#fullName").value.trim()) return "กรอกชื่อ-นามสกุล";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "อีเมลไม่ถูกต้อง";
  if (!pw) return "กรอกรหัสผ่าน";
  if ($("#confirmPassword")) {
    if (pw.length < 6) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัว";
    if (pw !== $("#confirmPassword").value) return "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  }
  return "";
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const err = checkForm();
  $("#error").textContent = err;
  if (err) return;
  // TODO: เชื่อม Supabase (signInWithPassword / signUp) ในงานถัดไป
});
