// ========== หน้า login / register ==========
// ลูกค้าและพนักงานใช้หน้า login เดียวกัน ล็อกอินแล้วพาไปตาม role (ROLE_HOME ใน js/supabase.js)
// สมัครสมาชิกได้บัญชีลูกค้าเสมอ (trigger handle_new_user ตั้ง role = customer) บัญชีพนักงาน Admin เป็นคนเพิ่ม

const $ = (s) => document.querySelector(s);
const isRegister = !!$("#registerForm");

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
  if (isRegister && !$("#fullName").value.trim()) return "กรอกชื่อ-นามสกุล";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "อีเมลไม่ถูกต้อง";
  if (!pw) return "กรอกรหัสผ่าน";
  if (isRegister) {
    if (pw.length < 6) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัว";
    if (pw !== $("#confirmPassword").value) return "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  }
  return "";
}

// หน้าที่จะกลับไปหลังล็อกอิน (?next= จาก goLogin) รับเฉพาะหน้าในเว็บนี้ กันลิงก์พาไปเว็บอื่น
function nextUrl() {
  const n = new URLSearchParams(location.search).get("next");
  if (!n) return "";
  const u = new URL(n, SITE_ROOT);
  return u.origin === location.origin ? u.href : "";
}

// ไปหน้าของคนนี้: พนักงานไปหน้าฝ่าย (หรือหน้าพนักงานที่ค้างไว้) ลูกค้ากลับหน้าเดิมหรือหน้าแรก
function goHome(p) {
  const next = nextUrl();
  const staffPage = next.startsWith(site("employee/"));
  if (p.role !== "customer") location.replace(staffPage ? next : site(ROLE_HOME[p.role]));
  else location.replace(next && !staffPage ? next : site("index.html"));
}

function busy(on) {
  $("#submitBtn").disabled = on;
  $("#submitBtn").textContent = on
    ? "กำลังดำเนินการ…"
    : isRegister
      ? "สมัครสมาชิก"
      : "เข้าสู่ระบบ";
}

async function login() {
  const { error } = await sb.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#password").value,
  });
  if (error) {
    return /confirm/i.test(error.message)
      ? "ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ในอีเมลที่ส่งไปก่อน"
      : "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  const p = await currentProfile();
  if (!p || !p.is_active) {
    await sb.auth.signOut();
    return "บัญชีนี้ถูกปิดใช้งาน ติดต่อร้านค้า";
  }
  goHome(p);
  return "";
}

async function register() {
  const { data, error } = await sb.auth.signUp({
    email: $("#email").value.trim().toLowerCase(),
    password: $("#password").value,
    options: {
      data: { full_name: $("#fullName").value.trim() }, // trigger เอาไปใส่ profiles.full_name
      emailRedirectTo: site("auth/login.html"), // ลิงก์ยืนยันในอีเมลพากลับมาหน้า login
    },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) return "อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน";
    // Supabase เช็กว่าโดเมนรับอีเมลได้จริง (ต้องส่งลิงก์ยืนยัน) เช่น @hompb.com ไม่มีระบบอีเมล
    if (error.code === "email_address_invalid" || /email address .* invalid/i.test(error.message))
      return "อีเมลนี้รับอีเมลไม่ได้ ใช้อีเมลจริงที่เปิดอ่านได้ เช่น Gmail";
    if (/rate limit/i.test(error.message)) return "สมัครบ่อยเกินไป รอสักครู่แล้วลองใหม่";
    return "สมัครไม่สำเร็จ: " + error.message;
  }
  // ถ้าเปิดยืนยันอีเมลไว้ อีเมลที่สมัครแล้วจะไม่ error แต่ได้ identities ว่าง
  if (data.user && data.user.identities?.length === 0) return "อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน";
  if (data.session) {
    location.replace(nextUrl() || site("index.html"));
    return "";
  }
  $("#success").textContent = "สมัครเสร็จแล้ว เปิดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบ";
  $("form").reset();
  return "";
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#error").textContent = "";
  if ($("#success")) $("#success").textContent = "";
  const err = checkForm();
  if (err) return ($("#error").textContent = err);

  busy(true);
  $("#error").textContent = await (isRegister ? register() : login());
  busy(false);
});

// ล็อกอินค้างไว้อยู่แล้ว ไม่ต้องกรอกใหม่
currentProfile().then((p) => {
  if (p && p.is_active) goHome(p);
});
