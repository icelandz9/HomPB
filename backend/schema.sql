-- หมายเหตุการเขียน SQL (PostgreSQL / Supabase) -------------------------------
--
-- 1. เครื่องหมายคำพูด
--    'ข้อความ' (single quote) ใช้กับค่าข้อความ เช่น default 'customer', 'มาตรฐาน'
--    "ชื่อ"   (double quote) ใช้กับชื่อตาราง/คอลัมน์ เท่านั้น
--    ถ้าเขียน default "มาตรฐาน" จะ error: column "มาตรฐาน" does not exist
--    ชื่อชนิดข้อมูลไม่ต้องใส่เครื่องหมายคำพูด เช่น numeric(10,2) ไม่ใช่ "numeric(10,2)"
--
-- 2. default gen_random_uuid()
--    สุ่ม uuid ให้อัตโนมัติตอน insert
--    ใส่เฉพาะ id ที่เป็น primary key ของตารางตัวเอง และไม่ได้เอาค่ามาจากที่อื่น
--    ไม่ใส่กับคอลัมน์ที่มี references (เช่น user_id, product_id, profiles.id)
--
-- 3. generated always as identity
--    ให้ฐานข้อมูลรันเลข 1, 2, 3 ให้เอง ใช้กับ id ที่เป็น bigint (เช่น categories)
--
-- 4. on delete cascade
--    ใช้กับ foreign key
--    เมื่อลบแถวที่ถูกอ้างถึง แถวที่อ้างถึงมันจะถูกลบตามอัตโนมัติ
--    ถ้าไม่ใส่ จะลบไม่ได้ (error) จนกว่าจะลบแถวที่อ้างถึงก่อน
--    ใส่ได้กับตารางที่ไม่มีประโยชน์ถ้าแถวหลักหายไป เช่น product_categories, addresses
--    ไม่ควรใส่กับข้อมูลที่ต้องเก็บประวัติ เช่น order_items -> products
--    (ให้ใช้ is_active = false แทนการลบสินค้าจริง)
--
-- 5. on delete set null
--    เมื่อลบแถวที่ถูกอ้างถึง คอลัมน์ที่อ้างถึงจะถูกเปลี่ยนเป็น null แต่แถวยังอยู่
--    เช่น ลบ product_variants แล้ว order_items.variant_id กลายเป็น null ประวัติการสั่งซื้อไม่หาย
--    คอลัมน์ที่ใช้ set null ห้ามมี not null (ไม่งั้นจะ error ตอนลบ)
--    สรุป: ไม่ใส่อะไร = ลบไม่ได้ / cascade = ลบตาม / set null = แถวอยู่ แต่ค่าเป็น null
--
-- 6. numeric(10,2)
--    ตัวเลขรวม 10 หลัก ทศนิยม 2 หลัก (สูงสุด 99,999,999.99) ใช้เก็บราคา
--
-- 7. id boolean primary key default true check (id)
--    บังคับให้ตารางมีได้แค่ 1 แถว ใช้กับตารางตั้งค่าที่มีชุดเดียว (เช่น store_settings)
--    primary key = ห้ามซ้ำ / check (id) = ห้ามเป็น false / default true = ไม่ต้องส่ง id ตอน insert
--    ถ้าไม่ใส่ check (id) จะยังมีได้ 2 แถว (true กับ false)
--    ไม่ใช้กับตารางที่เก็บหลายแถว (เช่น faq_entries) ให้ใช้ uuid หรือ identity แทน
--
-- 8. check (...)
--    ตรวจค่าก่อนบันทึก ถ้าเงื่อนไขในวงเล็บเป็นเท็จ จะ insert/update ไม่ได้ (error)
--    ใส่ท้ายคอลัมน์ก่อนจุลภาค เช่น price numeric(10,2) not null check (price >= 0),
--    >= 0  = ห้ามติดลบ แต่เป็น 0 ได้ (ราคา, สต็อก, ค่าส่ง, ยอดรวม)
--    > 0   = ต้องมากกว่า 0 (จำนวนสินค้า, ยอดโอน, จำนวนชั่วโมง)
--    in (...) = ต้องเป็นค่าในรายการเท่านั้น
--      payments.attempt_no in (1, 2)  -> ส่งสลิปได้ไม่เกิน 2 ครั้งต่อคำสั่งซื้อ
--      stock_logs.reason in ('order', 'cancel', 'adjust', 'return')
--      -> ถ้ามีเหตุผลใหม่ (เช่น 'restock') ต้องมาเพิ่มในรายการนี้ก่อน ไม่งั้น insert ไม่ได้
--
-- 9. unique
--    ห้ามค่าในคอลัมน์ซ้ำกัน เช่น categories.name text not null unique
--    insert 'ห้องนอน' 2 ครั้ง -> ครั้งที่ 2 error
--    ตัวพิมพ์เล็ก/ใหญ่ และช่องว่างนับเป็นคนละค่า ('Sofa' กับ 'sofa', 'ห้องนอน' กับ 'ห้องนอน ' ใส่ได้ทั้งคู่)
--    -> ให้แอปตัดช่องว่างหัวท้ายก่อนบันทึก
--    ข้อความหลัง -- เป็นแค่คอมเมนต์ SQL ไม่อ่าน ลบได้ไม่มีผล
--
-- 10. index
--    เหมือนสารบัญหนังสือ ทำให้ค้นหา (where) และ join เร็วขึ้น ไม่ต้องไล่ดูทุกแถว
--    ใส่กับคอลัมน์ที่ใช้ค้น/กรองบ่อย ไม่ต้องใส่ทุกคอลัมน์ (ทำให้ insert/update ช้าลง และกินพื้นที่)
--    PostgreSQL ไม่สร้าง index ให้ foreign key อัตโนมัติ -> ต้อง create index เอง
--    primary key และ unique มี index ให้อัตโนมัติอยู่แล้ว ไม่ต้องสร้างซ้ำ
--      (เช่น shipments.order_id มี unique แล้ว / cart_items, favorites มี user_id เป็นตัวแรกของ primary key แล้ว)
--    แบ่งเป็น 3 กลุ่ม:
--      1) foreign key           เช่น orders(user_id), order_items(order_id)
--         foreign key + เวลา    เช่น messages(conversation_id, created_at) ช่วยทั้งค้นและเรียงตามเวลา
--      2) สถานะ                 เช่น orders(status), payments(status) ใช้ดูรายการที่รอทำ
--      3) เวลา                  เช่น audit_logs(created_at) ใช้ดู log ล่าสุด
--    ดู index ทั้งหมด: Supabase > Database > Indexes
--      หรือ select tablename, indexname from pg_indexes where schemaname = 'public';
--    เช็กว่าใช้ index ไหม: explain select ... -> Index Scan = ใช้ / Seq Scan = ไล่ทุกแถว
-- -----------------------------------------------------------------------------

-- ENUM ---------------------------------------------------------------
create type app_role as enum (
    'admin',
    'warehouse',
    'shipping',
    'sales',
    'accounting',
    'customer'
);

create type order_status as enum (
    'pending_payment',
    'awaiting_approval',
    'approved',
    'shipping',
    'delivered',
    'cancelled',
    'refunded'
);

create type payment_status as enum (
    'pending',
    'approved',
    'rejected'
);

create type refund_status as enum (
    'requested',
    'approved',
    'rejected',
    'paid'
);

create type return_status as enum (
    'no_return',
    'pending_check',
    'restocked',
    'not_restocked'
);

create type shipment_status as enum (
    'preparing',   -- กำลังเตรียมของ
    'in_transit',  -- อยู่ระหว่างขนส่ง
    'delivered',
    'failed'
);

create type delivery_method as enum (
    'store_truck',
    'carrier'
);

create type refund_reason as enum (
    'cancel_before_ship',
    'damaged',
    'wrong_item'
);

create type sender_type as enum (
    'customer',
    'staff'
);

create type conversation_status as enum (
    'waiting_staff',
    'in_progress',
    'closed'
);

-- ผู้ใช้(User) ---------------------------------------------------------------

create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    full_name text not null,
    display_name text,
    phone text,
    role app_role not null default 'customer',
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table addresses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    recipient_name text not null,
    phone text not null,
    address_line text not null,
    subdistrict text not null,
    district text not null,
    province text not null,
    postcode text not null,
    is_default boolean not null default false,
    created_at timestamptz not null default now()
);

-- ผู้ใช้ 1 คนมีที่อยู่หลัก (is_default = true) ได้แค่ 1 ที่
create unique index addresses_one_default_per_user
    on addresses (user_id) where is_default;

-- สินค้า(Product) ---------------------------------------------------------------

create table categories (
    id bigint generated always as identity primary key,
    name text not null unique -- ห้ามตั้งชื่อหมวดหมู่ซ้ำ
);

create table products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    is_active boolean not null default true,
    delivery_method delivery_method not null default 'carrier',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table product_categories (
    product_id uuid not null references products(id) on delete cascade,
    category_id bigint not null references categories(id) on delete cascade,
    primary key (product_id, category_id)
);

create table product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    sku text unique not null,
    name text not null default 'มาตรฐาน',
    price numeric(10,2) not null check (price >= 0),
    stock_qty integer not null default 0 check (stock_qty >= 0),
    is_active boolean not null default true
);

create table product_images(
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    image_path text not null,
    sort_order integer not null default 0
);

create table favorites(
    user_id uuid not null references profiles(id) on delete cascade,
    product_id uuid not null references products(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, product_id)
);

create table cart_items(
    user_id uuid not null references profiles(id) on delete cascade,
    variant_id uuid not null references product_variants(id) on delete cascade,
    quantity integer not null check (quantity > 0),
    added_at timestamptz not null default now(),
    primary key (user_id, variant_id)
);

-- คำสั่งซื้อ(orders) ---------------------------------------------------------------

create table orders(
    id uuid primary key default gen_random_uuid(),
    order_no bigint unique generated always as identity,
    user_id uuid not null references profiles(id), -- ไม่ใส่ cascade: ลบผู้ใช้แล้วประวัติคำสั่งซื้อต้องไม่หาย
    status order_status not null default 'pending_payment',
    shipping_address jsonb not null,
    subtotal numeric(10,2) not null check (subtotal >= 0),
    shipping_fee numeric(10,2) not null default 0 check (shipping_fee >= 0),
    total_amount numeric(10,2) not null check (total_amount >= 0),
    payment_due_at timestamptz, -- กำหนดเวลาโอน = เวลาสั่ง + store_settings.payment_window_hours
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table order_items(
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    variant_id uuid references product_variants(id) on delete set null, -- ว่างได้ ถ้าลบตัวเลือกสินค้าออกภายหลัง
    product_name text not null,
    variant_name text not null,
    unit_price numeric(10,2) not null check (unit_price >= 0),
    quantity integer not null check (quantity > 0)
);

create table order_status_history (
    id bigint generated always as identity primary key,
    order_id uuid not null references orders(id) on delete cascade,
    from_status order_status,
    to_status order_status not null,
    actor_id uuid references profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

-- การเงิน(payments) ---------------------------------------------------------------

create table payments(
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id), -- ไม่ใส่ cascade: ข้อมูลการเงินต้องเก็บไว้
    attempt_no smallint not null default 1 check (attempt_no in (1, 2)),
    amount numeric(10,2) not null check (amount > 0),
    slip_path text not null,
    status payment_status not null default 'pending',
    reject_reason text,
    uploaded_at timestamptz not null default now(),
    reviewed_by uuid references profiles(id) on delete set null,
    reviewed_at timestamptz,
    unique(order_id, attempt_no)
);

create table refunds(
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id), -- ไม่ใส่ cascade: ข้อมูลการเงินต้องเก็บไว้
    amount numeric(10,2) not null check (amount > 0),
    reason refund_reason not null,
    detail text,
    status refund_status not null default 'requested',
    slip_path text,
    requested_at timestamptz not null default now(),
    approved_by uuid references profiles(id) on delete set null,
    approved_at timestamptz
);

create table refund_items(
    id uuid primary key default gen_random_uuid(),
    refund_id uuid not null references refunds(id) on delete cascade,
    order_item_id uuid not null references order_items(id) on delete cascade,
    quantity integer not null check (quantity > 0),
    amount numeric(10,2) not null check (amount > 0),
    return_status return_status not null default 'pending_check', -- ยกเลิกก่อนส่ง trigger จะเปลี่ยนเป็น no_return
    checked_by uuid references profiles(id) on delete set null,
    checked_at timestamptz,
    unique (refund_id, order_item_id)
);

-- การจัดส่ง(shipments) ---------------------------------------------------------------

create table shipments(
    id uuid primary key default gen_random_uuid(),
    order_id uuid unique not null references orders(id) on delete cascade,
    method delivery_method not null,
    carrier text,
    tracking_no text,
    status shipment_status not null default 'preparing',
    handled_by uuid references profiles(id) on delete set null,
    shipped_at timestamptz,
    delivered_at timestamptz
);

-- แชท(conversations) ---------------------------------------------------------------

create table conversations(
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references profiles(id) on delete cascade,
    staff_id uuid references profiles(id) on delete set null,
    order_id uuid references orders(id) on delete set null,
    status conversation_status not null default 'waiting_staff',
    created_at timestamptz not null default now(),
    closed_at timestamptz
);

create table messages(
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    sender_type sender_type not null,
    sender_id uuid not null references profiles(id),
    body text,
    image_path text,
    created_at timestamptz not null default now(),
    check (body is not null or image_path is not null) -- ต้องมีข้อความหรือรูปอย่างน้อย 1 อย่าง
);

create table faq_entries(
    id uuid primary key default gen_random_uuid(),
    question text not null,
    keywords text,
    answer text not null,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_by uuid references profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ข้อมูลร้าน(store_settings) ---------------------------------------------------------------

create table store_settings(
    id boolean primary key default true check(id),
    store_name text not null default 'HomPB',
    promptpay_qr_path text,
    bank_name text,
    bank_account_no text,
    bank_account_name text, 
    business_hours text,
    shipping_fee numeric(10,2) not null default 0 check (shipping_fee >= 0),
    payment_window_hours integer not null default 24 check (payment_window_hours > 0),
    reupload_window_hours integer not null default 24 check (reupload_window_hours > 0),
    updated_at timestamptz not null default now(),
    updated_by uuid references profiles(id) on delete set null
);

-- สร้างแถวตั้งค่าร้านไว้ 1 แถว (ใช้ค่า default ทั้งหมด แก้ทีหลังด้วย update)
insert into store_settings default values;

-- Log ---------------------------------------------------------------

create table stock_logs (
    id bigint primary key generated always as identity,
    variant_id uuid not null references product_variants(id) on delete cascade,
    change_qty integer not null,
    reason text not null check (reason in ('order', 'cancel', 'adjust', 'return')),
    order_id uuid references orders(id) on delete set null,
    actor_id uuid references profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references profiles(id) on delete set null,
  action        text not null,
  target_table  text not null,
  target_id     text not null,
  detail        jsonb,
  created_at    timestamptz not null default now()
);

-- TRIGGERS -----------------------------------------------------------
-- trigger มีไว้สำหรับ งานที่ต้องเกิดทุกครั้ง
-- โครงสร้าง create function public.ชื่อฟังก์ชัน()                         -- ตั้งชื่อ
-- returns trigger language plpgsql security definer set search_path = '' as $$
-- begin
--   -- ② สิ่งที่จะทำ
--   return new;
-- end;
-- -- $$;

-- create trigger ชื่อtrigger
--   after insert on ตาราง                                      -- ตอนไหน ตารางไหน
--   for each row execute function public.ชื่อฟังก์ชัน();

-- สร้าง profile ตอนสมัคร
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- อัปเดตอีเมลใน profiles เมื่อผู้ใช้เปลี่ยนอีเมล
create function public.sync_user_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    update public.profiles set email = new.email where id = new.id;
    return new;
end;
$$;

create trigger on_auth_user_email_changed
    after update of email on auth.users
    for each row execute function public.sync_user_email();

-- บันทึกประวัติสถานะคำสั่งซื้อ
create function public.log_order_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, actor_id)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger on_order_status_change
  after insert or update of status on orders
  for each row execute function public.log_order_status();

-- ยกเลิกก่อนส่ง ไม่มีของคืน ตั้ง return_status = no_return
create function public.set_no_return()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select reason from public.refunds where id = new.refund_id) = 'cancel_before_ship' then
    new.return_status := 'no_return';
  end if;
  return new;
end;
$$;

create trigger on_refund_item_insert
  before insert on refund_items -- ต้องเป็น before ถึงจะแก้ค่า new ได้ (after แก้แล้วไม่มีผล)
  for each row execute function public.set_no_return();

-- คืนเงินครบทุกชิ้นของคำสั่งซื้อที่ส่งถึงแล้ว เปลี่ยนสถานะคำสั่งซื้อเป็น refunded
create function public.set_order_refunded()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid'
     and (select status from public.orders where id = new.order_id) = 'delivered'
     and not exists (
       select 1
       from public.order_items oi
       where oi.order_id = new.order_id
         and oi.quantity > coalesce((
           select sum(ri.quantity)
           from public.refund_items ri
           join public.refunds r on r.id = ri.refund_id
           where ri.order_item_id = oi.id and r.status = 'paid'
         ), 0)
     )
  then
    update public.orders set status = 'refunded', updated_at = now() where id = new.order_id;
  end if;
  return new;
end;
$$;

create trigger on_refund_paid
  after update of status on refunds
  for each row execute function public.set_order_refunded();

-- อัปเดต updated_at เป็นเวลาปัจจุบันทุกครั้งที่แก้ไขแถว
create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on faq_entries
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on store_settings
  for each row execute function public.set_updated_at();

-- INDEX ---------------------------------------------------------------
-- Index คือสารบัญของตาราง ทำให้ค้นหาข้อมูลได้เร็วขึ้น

create index on addresses (user_id);
create index on product_variants (product_id);
create index on product_images (product_id);
create index on product_categories (category_id);
create index on orders (user_id);
create index on orders (status);
create index on order_items (order_id);
create index on order_status_history (order_id, created_at);
create index on payments (status);
create index on refunds (order_id);
create index on refund_items (order_item_id);
create index on shipments (status);
create index on conversations (customer_id);
create index on conversations (status);
create index on messages (conversation_id, created_at);
create index on stock_logs (variant_id, created_at);
create index on audit_logs (created_at);