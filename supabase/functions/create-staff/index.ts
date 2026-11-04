// ========== Edge Function: create-staff (Admin เพิ่มบัญชีพนักงาน) ==========
// เรียกจากหน้า admin: sb.functions.invoke("create-staff", { body: { email, full_name, role, password } })
//
// ทำไมต้องเป็น Edge Function: การสร้างบัญชีให้คนอื่นต้องใช้ service_role key
// ซึ่งข้าม RLS ได้ทั้งหมด จึงเก็บไว้บน server เท่านั้น ห้ามอยู่ในโค้ดหน้าเว็บ
//
// ลำดับการทำงาน
// 1) เช็กว่าคนเรียกล็อกอินอยู่ เป็น admin และบัญชียังเปิดอยู่
// 2) สร้างบัญชีด้วย service_role → trigger handle_new_user สร้าง profile (role = customer)
// 3) เปลี่ยน role ด้วยสิทธิ์ของ Admin ที่เรียก → audit_logs บันทึกว่า Admin คนนี้เป็นคนทำ
//    ถ้าข้อ 3 ไม่สำเร็จ ลบบัญชีที่เพิ่งสร้างทิ้ง จะได้ไม่มีบัญชีค้างเป็นลูกค้า
//
// URL และคีย์ ระบบใส่ให้อัตโนมัติตอน deploy (ไม่ต้องตั้ง Secrets เอง)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// คีย์แบบเก่า (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY) ถ้าไม่มีใช้แบบใหม่
// (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS เป็น JSON เช่น {"default":"sb_..."})
function envKey(legacy: string, json: string): string | undefined {
  const v = Deno.env.get(legacy);
  if (v) return v;
  try {
    return Object.values(JSON.parse(Deno.env.get(json) ?? "{}"))[0] as string | undefined;
  } catch {
    return undefined;
  }
}

const STAFF_ROLES = ["admin", "warehouse", "shipping", "sales", "accounting"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "ใช้ได้เฉพาะ POST" });

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = envKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
  const secretKey = envKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
  if (!url || !publicKey || !secretKey)
    return reply(500, { error: "ตั้งค่า Edge Function ไม่ครบ (ไม่พบ URL หรือคีย์)" });
  const authHeader = req.headers.get("Authorization") ?? "";

  // client ในนามคนที่เรียก (ใช้ token ของเขา) → ติด RLS และ trigger ตามปกติ
  const asCaller = createClient(url, publicKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  // client สิทธิ์เต็ม ใช้แค่สร้าง/ลบบัญชีใน auth เท่านั้น
  const asService = createClient(url, secretKey, {
    auth: { persistSession: false },
  });

  // 1) ต้องเป็น Admin ที่บัญชียังเปิดอยู่
  // ต้องส่ง token เข้า getUser เอง (header ใน global ใช้กับคำสั่งตาราง ไม่ใช้กับ auth)
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user } } = await asService.auth.getUser(token);
  if (!user) return reply(401, { error: "กรุณาเข้าสู่ระบบใหม่" });
  const { data: caller } = await asCaller
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  if (!caller || caller.role !== "admin" || !caller.is_active)
    return reply(403, { error: "เฉพาะ Admin เท่านั้น" });

  // ตรวจข้อมูลที่ส่งมา
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "ข้อมูลไม่ถูกต้อง" });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const full_name = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "");
  const password = String(body.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "อีเมลไม่ถูกต้อง" });
  if (!full_name) return reply(400, { error: "กรอกชื่อพนักงาน" });
  if (!STAFF_ROLES.includes(role)) return reply(400, { error: "ตำแหน่งไม่ถูกต้อง" });
  if (password.length < 6) return reply(400, { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัว" });

  // 2) สร้างบัญชี (email_confirm: true = ไม่ต้องกดยืนยันอีเมล ใช้ได้ทันที)
  const { data: created, error: e1 } = await asService.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (e1 || !created.user) {
    const dup = /already|registered|exists/i.test(e1?.message ?? "");
    return reply(dup ? 409 : 400, {
      error: dup ? "อีเมลนี้มีบัญชีอยู่แล้ว" : "สร้างบัญชีไม่สำเร็จ: " + (e1?.message ?? ""),
    });
  }

  // 3) ตั้งตำแหน่งในนาม Admin (trigger on_profile_update ยอม เพราะคนทำเป็น admin)
  // .select() เพื่อเช็กว่าแก้ได้จริง (ถ้า RLS ไม่ให้แก้ จะไม่มี error แต่ได้ 0 แถว)
  const { data: updated, error: e2 } = await asCaller
    .from("profiles")
    .update({ role })
    .eq("id", created.user.id)
    .select("id");
  if (e2 || !updated?.length) {
    await asService.auth.admin.deleteUser(created.user.id);
    return reply(500, { error: "ตั้งตำแหน่งไม่สำเร็จ: " + (e2?.message ?? "ไม่มีสิทธิ์แก้ profile") });
  }

  return reply(200, { id: created.user.id });
});
