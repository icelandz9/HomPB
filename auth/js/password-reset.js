// ========== ลืมรหัสผ่าน (forgot.html) + ตั้งรหัสผ่านใหม่ (reset.html) ==========
// 1. forgot.html: ใส่อีเมล → Supabase ส่งลิงก์ไปที่อีเมล (resetPasswordForEmail)
// 2. กดลิงก์ในอีเมล → กลับมาที่ reset.html พร้อม token ใน URL
//    supabase-js อ่าน token เองแล้วล็อกอินชั่วคราว (เหตุการณ์ PASSWORD_RECOVERY)
// 3. reset.html: ตั้งรหัสใหม่ (updateUser) → ออกจากระบบ → ไปหน้า login
//
// ต้องตั้งใน Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
// ให้มี https://hompb.netlify.app/auth/reset.html (และ http://localhost:8765/auth/reset.html ตอนทดสอบในเครื่อง)
// ไม่อย่างนั้นลิงก์ในอีเมลจะพาไปหน้าแรกแทน

const $ = (s) => document.querySelector(s);

// ปุ่มลูกตา (เหมือน auth-ui.js)
document.querySelectorAll("[data-eye]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.eye);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
    btn.setAttribute("aria-pressed", String(show));
  });
});

const say = (id, msg) => ($(id).textContent = msg);

// ---------- forgot.html ----------
const forgot = $("#forgotForm");
if (forgot) {
  const label = $("#submitBtn").textContent;
  let wait = null;

  // Supabase ส่งอีเมลซ้ำให้อีเมลเดิมได้ทุก 60 วินาที นับถอยหลังบนปุ่มให้เห็น
  const cooldown = (sec) => {
    clearInterval(wait);
    const btn = $("#submitBtn");
    btn.disabled = true;
    const tick = () => {
      btn.textContent = sec > 0 ? `ส่งอีกครั้งได้ใน ${sec} วินาที` : label;
      if (sec-- <= 0) {
        clearInterval(wait);
        btn.disabled = false;
      }
    };
    tick();
    wait = setInterval(tick, 1000);
  };

  forgot.addEventListener("submit", async (e) => {
    e.preventDefault();
    say("#error", "");
    say("#success", "");
    const email = $("#email").value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("#error", "อีเมลไม่ถูกต้อง");

    $("#submitBtn").disabled = true;
    $("#submitBtn").textContent = "กำลังส่ง…";
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: site("auth/reset.html") });
    if (error) {
      $("#submitBtn").disabled = false;
      $("#submitBtn").textContent = label;
      if (/rate limit|seconds/i.test(error.message)) {
        cooldown(60);
        return say("#error", "ขอลิงก์ถี่เกินไป รอสักครู่แล้วลองใหม่");
      }
      return say("#error", "ส่งลิงก์ไม่สำเร็จ: " + errText(error));
    }
    // ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่ (กันคนเดาว่าใครเป็นสมาชิก)
    say("#success", "ถ้าอีเมลนี้มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว เปิดอีเมลแล้วกดลิงก์ภายใน 1 ชั่วโมง");
    cooldown(60);
  });
}

// ---------- reset.html ----------
const reset = $("#resetForm");
if (reset) {
  const hash = new URLSearchParams(location.hash.slice(1));
  let shown = false;

  const showForm = (session) => {
    if (shown) return;
    shown = true;
    $("#who").textContent = "ตั้งรหัสผ่านใหม่ให้บัญชี " + (session.user.email || "");
    reset.hidden = false;
    $("#invalid").hidden = true;
    $("#password").focus();
  };
  const showInvalid = () => {
    if (shown) return;
    $("#who").textContent = "";
    $("#invalid").hidden = false;
  };

  // ลิงก์หมดอายุ / ใช้ไปแล้ว: Supabase ส่ง #error=...&error_code=otp_expired กลับมา
  if (hash.get("error")) showInvalid();
  else {
    sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) showForm(session);
    });
    // getSession รอให้ supabase-js อ่าน token จาก URL เสร็จก่อน
    sb.auth.getSession().then(({ data: { session } }) => (session ? showForm(session) : showInvalid()));
  }

  reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    say("#error", "");
    const pw = $("#password").value;
    if (pw.length < 6) return say("#error", "รหัสผ่านต้องมีอย่างน้อย 6 ตัว");
    if (pw !== $("#confirmPassword").value) return say("#error", "รหัสผ่านทั้งสองช่องไม่ตรงกัน");

    const btn = $("#submitBtn");
    btn.disabled = true;
    btn.textContent = "กำลังบันทึก…";
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) {
      btn.disabled = false;
      btn.textContent = "บันทึกรหัสผ่านใหม่";
      if (/different from the old/i.test(error.message)) return say("#error", "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
      if (/session|expired|jwt/i.test(error.message)) return showInvalid();
      return say("#error", "บันทึกไม่สำเร็จ: " + errText(error));
    }
    // ออกจากระบบ แล้วให้เข้าสู่ระบบด้วยรหัสใหม่ (ยืนยันว่าจำรหัสได้)
    await sb.auth.signOut();
    location.replace(site("auth/login.html") + "?reset=1");
  });
}
