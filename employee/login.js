// ========== เข้าสู่ระบบพนักงาน ==========
// ล็อกอินด้วยอีเมล + รหัสผ่าน แล้วพาไปหน้าของฝ่ายตาม role ใน profiles
// บัญชีพนักงานสร้างโดย Admin (ไม่มีปุ่มสมัครในหน้านี้)

const $ = (s) => document.querySelector(s);

// อ่าน role แล้วไปหน้าของฝ่าย / ลูกค้าหรือบัญชีที่ถูกปิด ไม่ให้เข้า
async function goHome(userId) {
  const { data: p } = await sb
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .single();
  if (p && p.is_active && ROLE_HOME[p.role]) {
    location.replace(ROLE_HOME[p.role]);
    return true;
  }
  await sb.auth.signOut();
  $("#err").textContent = "บัญชีนี้ไม่มีสิทธิ์เข้าระบบหลังบ้าน";
  return false;
}

// ปุ่มลูกตาแสดง/ซ่อนรหัสผ่าน (สลับ type password ↔ text)
// ไอคอนตาเปิด/ปิด สลับด้วย CSS ตามค่า aria-pressed
$("#eye").addEventListener("click", () => {
  const show = $("#pw").type === "password";
  $("#pw").type = show ? "text" : "password";
  $("#eye").setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
  $("#eye").setAttribute("aria-pressed", String(show));
});

$("#f").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#err").textContent = ""; 
  $("#go").disabled = true;

  const { data, error } = await sb.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#pw").value,
  });
  if (error) {
    $("#err").textContent = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  } else {
    await goHome(data.user.id);
  }
  $("#go").disabled = false;
});

// ล็อกอินค้างไว้อยู่แล้ว ไปหน้าของฝ่ายเลย
sb.auth.getUser().then(({ data: { user } }) => {
  if (user) goHome(user.id);
});
