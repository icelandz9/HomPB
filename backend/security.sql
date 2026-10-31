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


-- AUDIT TRIGGERS (Security Design ข้อ 14) ----------------------------
-- เปลี่ยน role / เปิดปิดบัญชี: เก็บค่า [เก่า, ใหม่]
create function public.audit_profile_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('profile.access_change', 'profiles', new.id::text,
    jsonb_build_object('role', jsonb_build_array(old.role, new.role),
                       'is_active', jsonb_build_array(old.is_active, new.is_active)));
  return new;
end;
$$;

create trigger after_profile_access_change
  after update of role, is_active on profiles
  for each row when (old.role is distinct from new.role or old.is_active is distinct from new.is_active)
  execute function public.audit_profile_access();


-- สถานะคำขอคืนเงินเปลี่ยน เช่น refund.approved
create function public.audit_refund_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('refund.' || new.status, 'refunds', new.id::text,
    jsonb_build_object('status', jsonb_build_array(old.status, new.status),
                       'amount', new.amount, 'reason', new.reason));
  return new;
end;
$$;

create trigger after_refund_status_change
  after update of status on refunds
  for each row when (old.status is distinct from new.status)
  execute function public.audit_refund_status();

-- คลังตรวจของที่ลูกค้าส่งคืน เช่น return.restocked
create function public.audit_return_check()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('return.' || new.return_status, 'refund_items', new.id::text,
    jsonb_build_object('refund_id', new.refund_id, 'quantity', new.quantity));
  return new;
end;
$$;

create trigger after_return_check
  after update of return_status on refund_items
  for each row when (old.return_status is distinct from new.return_status)
  execute function public.audit_return_check();

-- สต็อก: ถ้าคลังหรือ Admin แก้ stock_qty เอง บันทึก stock_logs (adjust) และ audit
-- ถ้าฟังก์ชันของระบบแก้ (สั่งซื้อ ยกเลิก คืนของ) ฟังก์ชันจะตั้ง hompb.system_stock = on
-- และเขียน stock_logs เอง trigger นี้จึงข้าม
create function public.log_stock_adjust()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_change integer := new.stock_qty - case when tg_op = 'INSERT' then 0 else old.stock_qty end;
begin
  if v_change <> 0 and coalesce(current_setting('hompb.system_stock', true), '') <> 'on' then
    insert into public.stock_logs (variant_id, change_qty, reason, actor_id)
    values (new.id, v_change, 'adjust', auth.uid());
    perform public.write_audit('stock.adjust', 'product_variants', new.id::text,
      jsonb_build_object('sku', new.sku, 'change_qty', v_change, 'stock_qty', new.stock_qty));
  end if;
  return new;
end;
$$;

create trigger after_stock_change
  after insert or update of stock_qty on product_variants
  for each row execute function public.log_stock_adjust();

-- ราคาเปลี่ยน: เก็บ [ราคาเก่า, ราคาใหม่]
create function public.audit_price_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('variant.price', 'product_variants', new.id::text,
    jsonb_build_object('sku', new.sku, 'price', jsonb_build_array(old.price, new.price)));
  return new;
end;
$$;

create trigger after_price_change
  after update of price on product_variants
  for each row when (old.price is distinct from new.price)
  execute function public.audit_price_change();

-- ตั้งค่าร้าน (รวมเลขบัญชี / QR) เปลี่ยน: เก็บทั้งแถวหลังแก้
create function public.audit_store_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('store.update', 'store_settings', 'store', to_jsonb(new));
  return new;
end;
$$;

create trigger after_store_settings_update
  after update on store_settings
  for each row execute function public.audit_store_settings();

-- ใส่ updated_by ของ store_settings ให้เอง
-- (updated_at ใส่โดย trigger set_updated_at ใน schema.sql อยู่แล้ว)
create function public.set_updated_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger set_updated_by before update on store_settings
  for each row execute function public.set_updated_by();


-- ROW LEVEL SECURITY (Security Design ข้อ 2) -------------------------
-- เปิด RLS ทุกตาราง ไม่มี policy = ห้ามทุกคน (ยกเว้น service_role)

alter table profiles             enable row level security;
alter table addresses            enable row level security;
alter table categories           enable row level security;
alter table products             enable row level security;
alter table product_categories   enable row level security;
alter table product_variants     enable row level security;
alter table product_images       enable row level security;
alter table favorites            enable row level security;
alter table cart_items           enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table order_status_history enable row level security;
alter table payments             enable row level security;
alter table refunds              enable row level security;
alter table refund_items         enable row level security;
alter table shipments            enable row level security;
alter table conversations        enable row level security;
alter table messages             enable row level security;
alter table store_settings       enable row level security;
alter table stock_logs           enable row level security;
alter table audit_logs           enable row level security;

-- profiles: ตัวเอง RU, Admin RU, พนักงานเห็นลูกค้าตามงาน
-- (สร้าง profile ทำโดย trigger ตอนสมัคร หรือ Edge Function create-staff)
create policy profiles_select on profiles for select
  using (id = auth.uid() or public.has_role('admin') or public.can_view_profile(id));
create policy profiles_update on profiles for update
  using (id = public.me() or public.has_role('admin'))
  with check (id = public.me() or public.has_role('admin'));

-- addresses, favorites, cart_items: เจ้าของ CRUD และ Admin CRUD
create policy addresses_all on addresses for all
  using (user_id = public.me() or public.has_role('admin'))
  with check (user_id = public.me() or public.has_role('admin'));
create policy favorites_all on favorites for all
  using (user_id = public.me() or public.has_role('admin'))
  with check (user_id = public.me() or public.has_role('admin'));
create policy cart_items_all on cart_items for all
  using (user_id = public.me() or public.has_role('admin'))
  with check (user_id = public.me() or public.has_role('admin'));

-- สินค้า: ทุกคนรวมผู้เยี่ยมชมดูได้ (BR3) คลังและ Admin แก้ได้
-- products / product_variants ไม่มี policy ลบ ใช้ is_active ปิดขายแทน
create policy categories_select on categories for select using (true);
create policy categories_write on categories for all
  using (public.has_role('admin', 'warehouse')) with check (public.has_role('admin', 'warehouse'));

create policy products_select on products for select
  using (is_active or public.has_role('admin', 'warehouse', 'shipping', 'sales', 'accounting'));
create policy products_insert on products for insert
  with check (public.has_role('admin', 'warehouse'));
create policy products_update on products for update
  using (public.has_role('admin', 'warehouse')) with check (public.has_role('admin', 'warehouse'));

create policy product_categories_select on product_categories for select using (true);
create policy product_categories_write on product_categories for all
  using (public.has_role('admin', 'warehouse')) with check (public.has_role('admin', 'warehouse'));

create policy product_images_select on product_images for select using (true);
create policy product_images_write on product_images for all
  using (public.has_role('admin', 'warehouse')) with check (public.has_role('admin', 'warehouse'));

-- product_variants มี stock_qty และ sku (Internal) ตารางจริงให้พนักงานที่เกี่ยวข้องเท่านั้น
-- ลูกค้า ผู้เยี่ยมชม และฝ่ายบัญชี อ่านผ่าน view variants_public (เห็นแค่ มี/หมด)
create policy variants_select on product_variants for select
  using (public.has_role('admin', 'warehouse', 'shipping', 'sales'));
create policy variants_insert on product_variants for insert
  with check (public.has_role('admin', 'warehouse'));
create policy variants_update on product_variants for update
  using (public.has_role('admin', 'warehouse')) with check (public.has_role('admin', 'warehouse'));

-- orders: มี shipping_address ตารางจริงให้ เจ้าของ, Admin, ฝ่ายจัดส่ง (งานตัวเอง)
-- ฝ่ายคลัง ขาย บัญชี อ่านผ่าน view orders_for_staff (ไม่มีที่อยู่)
-- ไม่มี policy insert/update/delete: สร้างผ่าน place_order() เปลี่ยนสถานะผ่านฟังก์ชันเท่านั้น
create policy orders_select on orders for select
  using (user_id = public.me() or public.has_role('admin') or public.is_my_shipping_job(id));

create policy order_items_select on order_items for select
  using (public.has_role('admin', 'warehouse', 'sales', 'accounting')
         or public.owns_order(order_id) or public.is_my_shipping_job(order_id));

create policy order_history_select on order_status_history for select
  using (public.has_role('admin', 'warehouse', 'sales', 'accounting')
         or public.owns_order(order_id) or public.is_my_shipping_job(order_id));

-- payments: Admin, บัญชี, เจ้าของ (เพิ่มผ่าน submit_payment())
create policy payments_select on payments for select
  using (public.has_role('admin', 'accounting') or public.owns_order(order_id));

-- refunds: Admin, บัญชี, เจ้าของ ฝ่ายขายใช้ view refunds_for_sales (ไม่มี slip_path)
create policy refunds_select on refunds for select
  using (public.has_role('admin', 'accounting') or public.owns_order(order_id));

create policy refund_items_select on refund_items for select
  using (public.has_role('admin', 'warehouse', 'sales', 'accounting')
         or exists (select 1 from public.refunds r
                    where r.id = refund_id and public.owns_order(r.order_id)));

-- shipments: ฝ่ายจัดส่งเห็นงานตัวเองและงานที่ยังไม่มีคนรับ แก้ผ่าน update_shipment()
create policy shipments_select on shipments for select
  using (public.has_role('admin', 'warehouse', 'sales', 'accounting')
         or (public.has_role('shipping') and (handled_by = auth.uid() or handled_by is null))
         or public.owns_order(order_id));

-- แชท: ลูกค้า CR ห้องตัวเอง, ฝ่ายขาย CRU, Admin RU
-- ไม่มีแชทบอท (ตัดสินใจ 15 ต.ค.) ห้องใหม่เริ่มที่ waiting_staff ให้ฝ่ายขายรับเรื่อง
-- ลูกค้าเปลี่ยนสถานะห้องไม่ได้ ฝ่ายขายเปลี่ยนเป็น in_progress / closed
create policy conversations_select on conversations for select
  using (customer_id = public.me() or public.has_role('sales', 'admin'));
create policy conversations_insert on conversations for insert
  with check (customer_id = public.me() and public.has_role('customer')
              and status = 'waiting_staff' and staff_id is null and closed_at is null
              and (order_id is null or public.owns_order(order_id)));
create policy conversations_update on conversations for update
  using (public.has_role('sales', 'admin')) with check (public.has_role('sales', 'admin'));

create policy messages_select on messages for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id
                   and (c.customer_id = public.me() or public.has_role('sales', 'admin'))));
-- ลูกค้าส่งได้เฉพาะห้องตัวเองที่ยังไม่ปิด ฝ่ายขายและ Admin ส่งในนามพนักงาน
create policy messages_insert on messages for insert
  with check (
    (sender_type = 'customer' and sender_id = public.me()
     and exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.customer_id = public.me() and c.status <> 'closed'))
    or
    (sender_type = 'staff' and sender_id = auth.uid() and public.has_role('sales', 'admin')));

-- store_settings: ผู้ใช้ที่ล็อกอินเห็นทั้งหมด (รวม QR เลขบัญชี) Admin แก้
-- ผู้เยี่ยมชมอ่านผ่าน view store_public (ไม่มีข้อมูลบัญชี)
create policy store_select on store_settings for select using (public.me() is not null);
create policy store_update on store_settings for update
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- log: อ่านอย่างเดียว ไม่มีใครแก้หรือลบ รวม Admin (BR2)
create policy stock_logs_select on stock_logs for select using (public.has_role('admin', 'warehouse'));
create policy audit_logs_select on audit_logs for select using (public.has_role('admin'));


-- VIEWS ซ่อนคอลัมน์ (Security Design ข้อ 13, 18) ----------------------
-- view เหล่านี้รันด้วยสิทธิ์เจ้าของ (ข้าม RLS) จึงกรองแถวเองใน WHERE

-- สินค้าสำหรับหน้าร้าน: ไม่มี sku และ stock_qty เห็นแค่ in_stock
create view public.variants_public with (security_barrier) as
  select v.id, v.product_id, v.name, v.price, (v.stock_qty > 0) as in_stock
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.is_active and p.is_active;

-- คำสั่งซื้อสำหรับฝ่ายคลัง ขาย บัญชี: ไม่มี shipping_address
create view public.orders_for_staff with (security_barrier) as
  select id, order_no, user_id, status, subtotal, shipping_fee, total_amount,
         payment_due_at, created_at, updated_at
  from public.orders
  where public.has_role('admin', 'warehouse', 'sales', 'accounting');

-- คำขอคืนเงินสำหรับฝ่ายขาย: ไม่มี slip_path (R* ใน Privacy Level)
create view public.refunds_for_sales with (security_barrier) as
  select id, order_id, amount, reason, detail, status, requested_at, approved_at
  from public.refunds
  where public.has_role('admin', 'sales', 'accounting');

-- ข้อมูลร้านสำหรับผู้เยี่ยมชม
create view public.store_public with (security_barrier) as
  select store_name, business_hours, shipping_fee from public.store_settings;


-- GRANTS -------------------------------------------------------------
-- Supabase ให้สิทธิ์ตารางกับ anon/authenticated ทั้งหมดเป็นค่าเริ่มต้น แล้วให้ RLS คุม
-- ตารางที่ต้องเปลี่ยนผ่านฟังก์ชันเท่านั้น ถอนสิทธิ์เขียนออกอีกชั้น

revoke insert, update, delete on
  orders, order_items, order_status_history, payments, refunds, refund_items,
  shipments, stock_logs, audit_logs
from anon, authenticated;
revoke delete on profiles, products, product_variants, conversations, messages,
  store_settings from anon, authenticated;
revoke insert on profiles, store_settings from anon, authenticated;
revoke update on messages from anon, authenticated;

-- view ตารางเดียว (orders_for_staff, refunds_for_sales, store_public) แก้ข้อมูลผ่าน view ได้
-- และ view รันด้วยสิทธิ์เจ้าของ (ข้าม RLS และ revoke ข้างบน) จึงต้องถอนสิทธิ์ทั้งหมดก่อน แล้วให้แค่ select
revoke all on public.variants_public, public.store_public,
  public.orders_for_staff, public.refunds_for_sales from anon, authenticated;
grant select on public.variants_public, public.store_public to anon, authenticated;
grant select on public.orders_for_staff, public.refunds_for_sales to authenticated;

-- ฟังก์ชันใน public เรียกผ่าน API ได้ (supabase.rpc) ค่าเริ่มต้นทุกคนเรียกได้
-- write_audit ต้องเรียกจาก trigger เท่านั้น ไม่อย่างนั้นใครก็เขียน audit_logs ปลอมได้
-- (trigger ยังเรียกได้ เพราะฟังก์ชัน trigger รันด้วยสิทธิ์ postgres)
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;
