// ========== เชื่อมต่อ Supabase (ใช้ร่วมกันทุกหน้า: หน้าร้าน, auth, profile, employee) ==========
// ต้องโหลด supabase-js จาก CDN ก่อนไฟล์นี้ (ดู <script> ใน html)
//
// ค่าจาก Supabase Dashboard > Project Settings > API
// ใช้ได้เฉพาะ anon / publishable key (คีย์สาธารณะ ข้อมูลถูกป้องกันด้วย RLS)
// ห้ามใส่ service_role / secret key เด็ดขาด เพราะข้าม RLS ทั้งหมด และใครก็เปิดดูโค้ดหน้าเว็บได้
const SUPABASE_URL = "https://owdayhfejexebndyehfe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ksI3eI59NU03i6rNrIX4Xw_qxXp0DKf";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// โฟลเดอร์บนสุดของเว็บ (ไฟล์นี้อยู่ที่ js/supabase.js) ใช้ทำลิงก์ให้ถูกไม่ว่าหน้าจะอยู่ชั้นไหน
// เช่น site("auth/login.html") จาก employee/admin.html หรือ index.html ก็ได้ที่เดียวกัน
const SITE_ROOT = new URL("../", document.currentScript.src);
const site = (path) => new URL(path, SITE_ROOT).href;

// role ในฐานข้อมูล (app_role) → หน้าแรกของคนนั้นหลังล็อกอิน
const ROLE_HOME = {
  admin: "employee/admin.html",
  accounting: "employee/accounting.html",
  warehouse: "employee/warehouse.html",
  shipping: "employee/delivery.html",
  sales: "employee/service.html",
  customer: "index.html",
};
const ROLE_NAME = {
  admin: "Admin",
  accounting: "ฝ่ายบัญชี",
  warehouse: "ฝ่ายคลังสินค้า",
  shipping: "ฝ่ายจัดส่ง",
  sales: "ฝ่ายบริการลูกค้า-ฝ่ายขาย",
  customer: "ลูกค้า",
};

// profile ของคนที่ล็อกอินอยู่ { id, email, full_name, phone, role, is_active } หรือ null ถ้ายังไม่ล็อกอิน
async function currentProfile() {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb
    .from("profiles")
    .select("id, email, full_name, phone, role, is_active")
    .eq("id", user.id)
    .single();
  return p || null;
}

// หน้าที่ต้องล็อกอิน (เช่น profile): ยังไม่ล็อกอิน / บัญชีถูกปิด → ไปหน้า login แล้วกลับมาหน้าเดิม
async function requireLogin() {
  const p = await currentProfile();
  if (!p || !p.is_active) return goLogin();
  return p;
}

// หน้าพนักงาน: ต้องเป็น role ที่กำหนด (Admin เข้าได้ทุกหน้า) คืนค่า profile
// หมายเหตุ: นี่แค่ซ่อนหน้าจอ ตัวที่กันข้อมูลจริงคือ RLS และฟังก์ชันใน backend/
async function requireStaff(...roles) {
  const p = await currentProfile();
  if (!p || !p.is_active || !(p.role === "admin" || roles.includes(p.role))) {
    return goLogin();
  }
  return p;
}

// ไปหน้า login พร้อมจำหน้าปัจจุบันไว้ (?next=) ล็อกอินเสร็จจะพากลับมา
function goLogin() {
  const next = location.href.replace(SITE_ROOT.href, "");
  location.replace(site("auth/login.html") + "?next=" + encodeURIComponent(next));
  return new Promise(() => {}); // หยุดรอ ไม่ให้โค้ดหน้าเดิมทำงานต่อระหว่างเปลี่ยนหน้า
}

async function signOut() {
  await sb.auth.signOut();
  location.replace(site("auth/login.html"));
}
const staffLogout = signOut; // ชื่อเดิมที่หน้าพนักงานเรียกอยู่

// error จาก Supabase → ข้อความภาษาไทยสำหรับ toast
function errText(error) {
  if (!error) return "";
  if (error.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้";
  return error.message || "เกิดข้อผิดพลาด";
}
