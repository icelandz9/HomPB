// ========== เชื่อมต่อ Supabase (ใช้ร่วมกันทุกหน้าพนักงาน) ==========
// ต้องโหลด supabase-js จาก CDN ก่อนไฟล์นี้ (ดู <script> ใน html)
//
// ค่าจาก Supabase Dashboard > Project Settings > API
// ใช้ได้เฉพาะ anon / publishable key (คีย์สาธารณะ ข้อมูลถูกป้องกันด้วย RLS)
// ห้ามใส่ service_role / secret key เด็ดขาด เพราะข้าม RLS ทั้งหมด และใครก็เปิดดูโค้ดหน้าเว็บได้
const SUPABASE_URL = "https://owdayhfejexebndyehfe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ksI3eI59NU03i6rNrIX4Xw_qxXp0DKf";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// role ในฐานข้อมูล (app_role) → หน้าของฝ่ายนั้น
const ROLE_HOME = {
  admin: "admin.html",
  accounting: "accounting.html",
  warehouse: "warehouse.html",
  shipping: "delivery.html",
  sales: "service.html",
};
const ROLE_NAME = {
  admin: "Admin",
  accounting: "ฝ่ายบัญชี",
  warehouse: "ฝ่ายคลังสินค้า",
  shipping: "ฝ่ายจัดส่ง",
  sales: "ฝ่ายบริการลูกค้า-ฝ่ายขาย",
};

// เรียกตอนเปิดหน้า: ยังไม่ล็อกอิน / บัญชีถูกปิด / role ไม่มีสิทธิ์หน้านี้ → กลับไปหน้า login
// Admin เข้าได้ทุกหน้า คืนค่า { id, email, full_name, role }
// หมายเหตุ: นี่แค่ซ่อนหน้าจอ ตัวที่กันข้อมูลจริงคือ RLS และฟังก์ชันใน backend/
async function requireStaff(...roles) {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return goLogin();
  const { data: p } = await sb
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .single();
  if (!p || !p.is_active || !(p.role === "admin" || roles.includes(p.role))) {
    return goLogin();
  }
  return p;
}

function goLogin() {
  location.replace("login.html");
  return new Promise(() => {}); // หยุดรอ ไม่ให้โค้ดหน้าเดิมทำงานต่อระหว่างเปลี่ยนหน้า
}

async function staffLogout() {
  await sb.auth.signOut();
  location.replace("login.html");
}

// error จาก Supabase → ข้อความภาษาไทยสำหรับ toast
function errText(error) {
  if (!error) return "";
  if (error.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้";
  return error.message || "เกิดข้อผิดพลาด";
}
