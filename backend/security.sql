-- หมายเหตุการเขียนฟังก์ชัน (PostgreSQL / Supabase) ----------------------------
--
-- ตัวอย่าง:
--   create function public.owns_order(p_order uuid)
--   returns boolean language sql stable security definer set search_path = '' as $$
--     select exists (select 1 from public.orders where id = p_order and user_id = public.me());
--   $$;
--
-- 1. create function public.ชื่อ(พารามิเตอร์ ชนิด)
--    สร้างฟังก์ชันไว้เรียกใช้ซ้ำ ตั้งชื่อพารามิเตอร์ขึ้นต้นด้วย p_ (p_order, p_user)
--    กันชื่อชนกับชื่อคอลัมน์ (เช่น ถ้าตั้งว่า id จะไม่รู้ว่าหมายถึง orders.id หรือพารามิเตอร์)
--    ไม่มีพารามิเตอร์ก็ต้องใส่วงเล็บเปล่า เช่น public.me()
--
-- 2. returns ชนิด
--    บอกว่าฟังก์ชันคืนค่าอะไร เช่น boolean, uuid, public.app_role
--    returns void = ไม่คืนค่า (ทำงานอย่างเดียว เช่น write_audit)
--    returns trigger = ใช้กับฟังก์ชันที่ trigger เรียก
--    สังเกต: returns มี s / ถ้าเขียน return จะ error
--
-- 3. language sql / language plpgsql
--    sql     = มีแค่คำสั่ง SQL คำสั่งเดียว (select / insert) ไม่มี begin ... end
--    plpgsql = ใช้ if, raise exception, ตัวแปร ได้ ต้องมี begin ... end; ครอบ
--    ฟังก์ชัน trigger ต้องเป็น plpgsql เสมอ
--
-- 4. stable
--    บอกว่าฟังก์ชันอ่านข้อมูลอย่างเดียว ไม่แก้อะไร ฐานข้อมูลเลยเรียกซ้ำน้อยลง (เร็วขึ้นใน RLS policy)
--    ฟังก์ชันที่ insert / update / delete ห้ามใส่ stable (จะ error)
--
-- 5. security definer
--    รันด้วยสิทธิ์ของเจ้าของฟังก์ชัน (postgres) แทนสิทธิ์ของคนที่เรียก
--    ใช้เพื่ออ่านตารางได้โดยไม่ติด RLS เช่น policy ของ profiles เรียก has_role() ซึ่งอ่าน profiles อีกที
--    ถ้าไม่ใส่ จะติด RLS ของตัวเองวนไม่จบ (infinite recursion)
--    ข้อควรระวัง: ข้างในฟังก์ชัน current_user จะเป็น postgres เสมอ
--    -> ฟังก์ชันที่ต้องเช็กว่าใครเรียก (เช่น profiles_update) ห้ามใส่
--
-- 6. set search_path = ''
--    ไม่ให้ฟังก์ชันเดาว่าตารางอยู่ schema ไหน กันคนสร้างตารางชื่อซ้ำมาหลอกฟังก์ชัน security definer
--    เลยต้องเขียนชื่อเต็มทุกครั้ง เช่น public.orders, public.me(), auth.uid()
--    ถ้าเขียนแค่ orders จะ error: relation "orders" does not exist
--
-- 7. as $$ ... $$;
--    $$ คือเครื่องหมายเปิด/ปิดตัวฟังก์ชัน (ใช้แทน ' เพื่อให้ข้างในใช้ 'ข้อความ' ได้ไม่ต้อง escape)
--    คำสั่งข้างในต้องจบด้วย ; และ $$ ตัวปิดต้องตามด้วย ; อีกที
--
-- 8. auth.uid() กับ public.me()
--    auth.uid() = id ของคนที่ล็อกอิน (Supabase ให้มา) ถึงบัญชีถูกปิดก็ยังได้ค่า
--    public.me() = id เหมือนกัน แต่ถ้าบัญชีถูกปิด (is_active = false) จะได้ null -> เช็กสิทธิ์ไม่ผ่าน
--    ใช้ public.me() ตอนเช็กสิทธิ์ / ใช้ auth.uid() ตอนบันทึกว่าใครทำ (actor_id)
--
-- 9. select exists (select 1 from ... where ...)
--    เช็กว่ามีแถวที่ตรงเงื่อนไขอย่างน้อย 1 แถวไหม คืน true / false
--    select 1 = ไม่สนค่าในแถว สนแค่ว่ามีหรือไม่มี (เร็วกว่าดึงข้อมูลจริง)
--
-- 10. ฟังก์ชันพวกนี้เอาไปใช้ใน RLS policy เช่น
--    create policy "ลูกค้าเห็นรายการสินค้าในคำสั่งซื้อของตัวเอง" on order_items
--      for select using (public.owns_order(order_id));
-- -----------------------------------------------------------------------------

-- HELPER FUNCTIONS ---------------------------------------------------
-- ใช้ใน RLS policy และ trigger

-- role ของคนที่ล็อกอินอยู่ ปิดบัญชีแล้ว (is_active = false) คืนค่าว่าง
create function public.current_user_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

-- id ของคนที่ล็อกอินอยู่ ปิดบัญชีแล้ว (is_active = false) คืนค่าว่าง
create function public.me()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profiles where id = auth.uid() and is_active;
$$;

-- เช็ค role ของคนที่ล็อกอินอยู่ในรายการไหม เช่น public.has_role('admin', 'accounting')
create function public.has_role(variadic roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() = any(roles), false);
$$;

-- ฝ่ายจัดส่ง: คำสั่งซื้อเป็นงานของตัวเอง หรือยังไม่มีใครรับ
create function public.is_my_shipping_job(p_order uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('shipping') and exists (
    select 1 from public.shipments s
    where s.order_id = p_order
      and (s.handled_by = public.me() or s.handled_by is null)
  );
$$;

-- เป็นเจ้าของคำสั่งซื้อนี้ไหม
create function public.owns_order(p_order uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders where id = p_order and user_id = public.me());
$$;

-- พนักงานเห็นโปรไฟล์ลูกค้าเฉพาะที่เกี่ยวกับงาน (Privacy Level แถว profiles)
create function public.can_view_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.current_user_role()
    when 'shipping' then exists (
      select 1 from public.orders o
      join public.shipments s on s.order_id = o.id
      where o.user_id = p_user
        and (s.handled_by = public.me() or s.handled_by is null)
    )
    when 'sales' then exists (
      select 1 from public.conversations c where c.customer_id = p_user
    )
    when 'accounting' then exists (
      select 1 from public.orders o where o.user_id = p_user
    )
    else false
  end;
$$;

-- บันทึก audit_logs เช่น select public.write_audit('update', 'products', '<id>', '{"price": 100}');
-- ไม่ใส่ stable เพราะฟังก์ชันนี้ insert ข้อมูล
create function public.write_audit(
  p_action text,
  p_table text,
  p_id text,
  p_detail jsonb default null
)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, target_table, target_id, detail)
  values (auth.uid(), p_action, p_table, p_id, p_detail);
$$;

-- TRIGGERS -----------------------------------------------------------

-- กันผู้ใช้แก้ role / is_active / email ของตัวเอง (เช่น ลูกค้าตั้งตัวเองเป็น admin)
-- ไม่ใส่ security definer: ต้องให้ current_user เป็น role ของคนที่เรียกจริง ('authenticated' / 'anon')
-- ถ้าใส่ current_user จะกลายเป็นเจ้าของฟังก์ชัน (postgres) ทุกครั้ง แล้วเงื่อนไขจะไม่ทำงาน
-- trigger sync_user_email (security definer) ยังแก้ email ได้ เพราะรันเป็น postgres
create function public.profiles_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.has_role('admin')
     and (new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
       or new.id is distinct from old.id) then
    raise exception 'แก้ role, is_active หรือ email ได้เฉพาะ Admin'
      using errcode = '42501'; -- รหัสมาตรฐานของ PostgreSQL แปลว่า "ไม่มีสิทธิ์"
  end if;
  return new;
end;
$$;

create trigger on_profile_update
  before update on profiles
  for each row execute function public.profiles_update();
