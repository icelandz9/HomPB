-- =====================================================================
-- HomPB: SQL สำหรับโชว์ตอนนำเสนอ (Supabase SQL Editor)
-- วิธีใช้: ลากคลุมทีละบล็อก (ตั้งแต่ -- @@ ถึงก่อน -- @@ ถัดไป) แล้วกด Run
-- บล็อกที่แก้ข้อมูลครอบด้วย begin; ... rollback; ข้อมูลจริงจะไม่เปลี่ยน
-- ยกเว้น E3 (คืนค่าให้เอง) และหมวด Z (ล้างของค้างจากการสาธิต อยู่ท้ายไฟล์)
-- หมายเหตุ: SQL Editor รันด้วย role postgres ซึ่งข้าม RLS ได้
--           ถ้าจะโชว์ RLS ให้ใช้หมวด G
-- =====================================================================


-- =====================================================================
-- หมวด A: ดูโครงสร้างฐานข้อมูล (ตอบคำถาม "มีกี่ตาราง กี่ constraint")
-- =====================================================================

-- @@ A1 รายชื่อตารางทั้งหมดและจำนวนคอลัมน์
select table_name, count(*) as columns
from information_schema.columns
where table_schema = 'public'
  and table_name in (select table_name from information_schema.tables
                     where table_schema = 'public' and table_type = 'BASE TABLE')
group by table_name
order by table_name;

-- @@ A2 นับ constraint แยกประเภท (p=PK, f=FK, u=UNIQUE, c=CHECK)
select case contype when 'p' then 'PRIMARY KEY' when 'f' then 'FOREIGN KEY'
                    when 'u' then 'UNIQUE' when 'c' then 'CHECK' end as type,
       count(*)
from pg_constraint
where connamespace = 'public'::regnamespace
group by contype
order by 1;

-- @@ A3 นโยบาย ON DELETE ของ FK ทุกตัว (a=NO ACTION, c=CASCADE, n=SET NULL)
select conrelid::regclass as table_name,
       conname,
       confrelid::regclass as references_table,
       case confdeltype when 'a' then 'NO ACTION' when 'c' then 'CASCADE'
                        when 'n' then 'SET NULL'  when 'r' then 'RESTRICT' end as on_delete
from pg_constraint
where contype = 'f' and connamespace = 'public'::regnamespace
order by on_delete, table_name;

-- @@ A4 CHECK constraint ทั้งหมดพร้อมเงื่อนไข
select conrelid::regclass as table_name, pg_get_constraintdef(oid) as rule
from pg_constraint
where contype = 'c' and connamespace = 'public'::regnamespace
order by 1;

-- @@ A5 enum ทั้ง 10 ตัวและค่าที่อนุญาต
select t.typname as enum_name, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as values
from pg_type t join pg_enum e on e.enumtypid = t.oid
where t.typnamespace = 'public'::regnamespace
group by t.typname
order by 1;

-- @@ A6 trigger ทั้งหมด (รวม trigger บน auth.users)
select event_object_schema || '.' || event_object_table as table_name,
       trigger_name, action_timing, string_agg(event_manipulation, ' / ') as events
from information_schema.triggers
where trigger_schema in ('public', 'auth')
group by 1, 2, 3
order by 1;

-- @@ A7 index ทั้งหมด
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- @@ A8 ฟังก์ชัน / RPC ทั้งหมด พร้อม parameter
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       case when p.prosecdef then 'security definer' else 'security invoker' end as security
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by 1;

-- @@ A9 ดูโค้ดเต็มของฟังก์ชัน (เปลี่ยนชื่อได้ เช่น place_order, review_payment)
select pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'place_order';

-- @@ A10 RLS เปิดครบทุกตารางไหม + จำนวน policy ต่อตาราง
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by 1;

-- @@ A11 policy ทั้งหมด (ใคร ทำอะไร เงื่อนไขอะไร)
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;


-- =====================================================================
-- หมวด B: SQL เบื้องหลังแต่ละฟีเจอร์ (ตอบคำถาม "ตอนกดปุ่มนี้ ใช้คำสั่งอะไร")
-- =====================================================================

-- @@ B1 สมัครสมาชิก: Supabase Auth เพิ่มแถวใน auth.users
--      แล้ว trigger handle_new_user สร้าง profiles ให้อัตโนมัติ role = customer
--      (บล็อกนี้รันได้บน PostgreSQL ทดสอบ ใน Supabase จริงให้สมัครผ่านหน้าเว็บแล้วรันเฉพาะ select ล่าง)
begin;
insert into auth.users (id, email, raw_user_meta_data)
values (gen_random_uuid(), 'demo.signup@mail.com', '{"full_name":"ทดสอบ สมัคร"}');
select id, email, full_name, role, is_active
from profiles where email = 'demo.signup@mail.com';
rollback;

-- @@ B2 ผู้เยี่ยมชมดูสินค้าตามห้อง (หน้าแรก) ไม่ต้องล็อกอิน
select c.name as room, p.name as product, v.name as option, v.price,
       case when v.stock_qty > 0 then 'มีสินค้า' else 'หมด' end as stock
from categories c
join product_categories pc on pc.category_id = c.id
join products p           on p.id = pc.product_id and p.is_active
join product_variants v   on v.product_id = p.id and v.is_active
order by c.name, p.name, v.price;

-- @@ B3 ค้นหาสินค้าด้วยคำค้น
select p.name, min(v.price) as price_from
from products p
join product_variants v on v.product_id = p.id and v.is_active
where p.is_active and (p.name ilike '%' || 'หม้อ' || '%' or p.description ilike '%' || 'หม้อ' || '%')
group by p.id, p.name;

-- @@ B4 หน้ารายละเอียดสินค้า: ตัวเลือก + รูป + หมวด
select p.name, p.description, p.delivery_method,
       (select json_agg(json_build_object('sku', v.sku, 'name', v.name, 'price', v.price,
                                          'in_stock', v.stock_qty > 0) order by v.price)
        from product_variants v where v.product_id = p.id and v.is_active) as variants,
       (select json_agg(i.image_path order by i.sort_order)
        from product_images i where i.product_id = p.id) as images,
       (select string_agg(c.name, ', ')
        from product_categories pc join categories c on c.id = pc.category_id
        where pc.product_id = p.id) as rooms
from products p
where p.is_active
limit 1;

-- @@ B5 ใส่ตะกร้า (กดซ้ำ = เพิ่มจำนวน) และกดหัวใจ (กดซ้ำไม่เกิดแถวซ้ำ)
begin;
insert into cart_items (user_id, variant_id, quantity)
select pr.id, v.id, 1
from profiles pr, product_variants v
where pr.role = 'customer' and v.is_active
order by pr.created_at, v.price
limit 1
on conflict (user_id, variant_id) do update set quantity = cart_items.quantity + excluded.quantity;

insert into favorites (user_id, product_id)
select pr.id, p.id from profiles pr, products p
where pr.role = 'customer' order by pr.created_at limit 1
on conflict do nothing;

-- ดูตะกร้าพร้อมยอดรวม
select pr.email, v.sku, ci.quantity, v.price, ci.quantity * v.price as line_total,
       sum(ci.quantity * v.price) over (partition by ci.user_id) as cart_total
from cart_items ci
join product_variants v on v.id = ci.variant_id
join profiles pr on pr.id = ci.user_id;
rollback;

-- @@ B6 สั่งซื้อ: สิ่งที่ place_order() ทำข้างใน (ฉบับสาธิตทีละขั้นใน transaction เดียว)
--      ราคามาจากฐานข้อมูลเสมอ ไม่รับจากหน้าเว็บ (Security Design ข้อ 5)
begin;
select set_config('hompb.system_stock', 'on', true);   -- เหมือนฟังก์ชันจริง: เขียน stock_logs เอง trigger ปรับสต็อกจึงข้าม
-- 0) เลือกลูกค้าทดสอบ 1 คน (ต้องมีที่อยู่หลัก)
create temp table demo_cust on commit drop as
select a.user_id from addresses a join profiles p on p.id = a.user_id
where p.role = 'customer' and a.is_default
order by p.created_at limit 1;

-- 1) ใส่ตะกร้า 2 ชิ้น
insert into cart_items (user_id, variant_id, quantity)
select (select user_id from demo_cust), v.id, 2
from product_variants v where v.is_active and v.stock_qty >= 2
order by v.price limit 1
on conflict (user_id, variant_id) do update set quantity = 2;

-- 2) สร้างคำสั่งซื้อ คำนวณยอดจากราคาใน product_variants และ snapshot ที่อยู่ 1 ที่ (BR5)
create temp table demo_order on commit drop as
with total as (
  select sum(ci.quantity * v.price) as subtotal
  from cart_items ci join product_variants v on v.id = ci.variant_id
  where ci.user_id = (select user_id from demo_cust)),
addr as (
  select to_jsonb(a) - 'id' - 'user_id' - 'created_at' - 'is_default' as snap
  from addresses a where a.user_id = (select user_id from demo_cust) and a.is_default),
o as (
  insert into orders (user_id, shipping_address, subtotal, shipping_fee, total_amount, payment_due_at)
  select (select user_id from demo_cust), (select snap from addr), t.subtotal, s.shipping_fee,
         t.subtotal + s.shipping_fee, now() + make_interval(hours => s.payment_window_hours)
  from total t, store_settings s
  returning id)
select id from o;

-- 3) ตัดสต็อกแบบมีเงื่อนไข ถ้าสต็อกไม่พอจะได้ 0 แถว แล้ว place_order() ยกเลิกทั้งชุด (BR7)
update product_variants v
set stock_qty = v.stock_qty - ci.quantity
from cart_items ci
where ci.user_id = (select user_id from demo_cust)
  and ci.variant_id = v.id and v.stock_qty >= ci.quantity
returning v.sku, v.stock_qty as stock_after;

-- 4) snapshot ชื่อและราคา ณ ตอนสั่งลง order_items + บันทึก stock_logs
insert into order_items (order_id, variant_id, product_name, variant_name, unit_price, quantity)
select (select id from demo_order), v.id, p.name, v.name, v.price, ci.quantity
from cart_items ci
join product_variants v on v.id = ci.variant_id
join products p on p.id = v.product_id
where ci.user_id = (select user_id from demo_cust);

insert into stock_logs (variant_id, change_qty, reason, order_id)
select variant_id, -quantity, 'order', order_id
from order_items where order_id = (select id from demo_order);

-- 5) ล้างตะกร้าของลูกค้าคนนี้
delete from cart_items where user_id = (select user_id from demo_cust);

-- ผลลัพธ์: คำสั่งซื้อ + ประวัติสถานะที่ trigger log_order_status เขียนให้
select o.order_no, o.status, o.subtotal, o.total_amount, o.payment_due_at,
       o.shipping_address->>'province' as province,
       (select count(*) from order_items i where i.order_id = o.id) as items,
       (select count(*) from order_status_history h where h.order_id = o.id) as history_rows
from orders o where o.id = (select id from demo_order);
rollback;

-- @@ B7 ลูกค้าอัปโหลดสลิป -> บัญชีอนุมัติ (BR6)
begin;
create temp table demo_order on commit drop as
with o as (
  insert into orders (user_id, shipping_address, subtotal, total_amount, payment_due_at)
  select id, '{"province":"กรุงเทพฯ"}', 990, 990, now() + interval '24 hours'
  from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;

-- ลูกค้าอัปโหลดสลิป (submit_payment)
insert into payments (order_id, attempt_no, amount, slip_path)
select id, 1, 990, 'slips/demo/1.jpg' from demo_order;
update orders set status = 'awaiting_approval' where id = (select id from demo_order);

-- บัญชีกดอนุมัติ (review_payment)
update payments
set status = 'approved',
    reviewed_by = (select id from profiles where role = 'accounting' limit 1),
    reviewed_at = now()
where order_id = (select id from demo_order) and status = 'pending';
update orders set status = 'approved', updated_at = now()
where id = (select id from demo_order) and status = 'awaiting_approval';

select from_status, to_status, created_at
from order_status_history where order_id = (select id from demo_order) order by id;
rollback;

-- @@ B8 สลิปไม่ผ่านครั้งที่ 1 -> อัปโหลดใหม่ได้ภายใน reupload_window_hours
begin;
create temp table demo_order on commit drop as
with o as (
  insert into orders (user_id, status, shipping_address, subtotal, total_amount)
  select id, 'awaiting_approval', '{}', 590, 590
  from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;

insert into payments (order_id, attempt_no, amount, slip_path)
select id, 1, 590, 'slips/demo/bad.jpg' from demo_order;

update payments set status = 'rejected', reject_reason = 'ยอดไม่ตรง', reviewed_at = now()
where order_id = (select id from demo_order) and attempt_no = 1;
update orders
set status = 'pending_payment',
    payment_due_at = now() + make_interval(hours => (select reupload_window_hours from store_settings))
where id = (select id from demo_order);

-- ครั้งที่ 2 ใส่ได้ (ครั้งที่ 3 จะติด CHECK ดูบล็อก C4)
insert into payments (order_id, attempt_no, amount, slip_path)
select id, 2, 590, 'slips/demo/retry.jpg' from demo_order;

select attempt_no, status, reject_reason
from payments where order_id = (select id from demo_order) order by attempt_no;
rollback;

-- @@ B9 ยกเลิกอัตโนมัติ (สิ่งที่ cancel_expired_orders() ทำผ่าน pg_cron)
--      เกินเวลาโอน -> cancelled + คืนสต็อก + stock_logs เหตุผล cancel
begin;
select set_config('hompb.system_stock', 'on', true);   -- เหมือนฟังก์ชันจริง: เขียน stock_logs เอง trigger ปรับสต็อกจึงข้าม
create temp table demo_order on commit drop as
with o as (
  insert into orders (user_id, shipping_address, subtotal, total_amount, payment_due_at)
  select id, '{}', 590, 590, now() - interval '1 hour'       -- หมดเวลาไปแล้ว 1 ชม.
  from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;

insert into order_items (order_id, variant_id, product_name, variant_name, unit_price, quantity)
select d.id, v.id, 'สินค้าทดสอบ', v.name, v.price, 1
from demo_order d, (select * from product_variants order by price limit 1) v;

select v.sku, v.stock_qty as stock_before
from product_variants v join order_items i on i.variant_id = v.id
where i.order_id = (select id from demo_order);

with expired as (
  update orders set status = 'cancelled', updated_at = now()
  where id = (select id from demo_order)                     -- ของจริง: where status = 'pending_payment' and payment_due_at < now()
    and status = 'pending_payment' and payment_due_at < now()
  returning id),
restock as (
  update product_variants v set stock_qty = v.stock_qty + oi.quantity
  from order_items oi join expired e on e.id = oi.order_id
  where oi.variant_id = v.id
  returning v.id)
insert into stock_logs (variant_id, change_qty, reason, order_id)
select oi.variant_id, oi.quantity, 'cancel', oi.order_id
from order_items oi join expired e on e.id = oi.order_id;

select o.status, v.sku, v.stock_qty as stock_after, l.change_qty, l.reason
from orders o
join stock_logs l on l.order_id = o.id
join product_variants v on v.id = l.variant_id
where o.id = (select id from demo_order);
rollback;

-- @@ B10 จัดส่ง: ฝ่ายจัดส่งรับงาน -> ใส่ขนส่ง + เลขพัสดุ -> ส่งถึง
begin;
create temp table demo_order on commit drop as
with o as (
  insert into orders (user_id, status, shipping_address, subtotal, total_amount)
  select id, 'approved', '{"recipient_name":"ลูกค้า หนึ่ง","phone":"0800000000","province":"กรุงเทพฯ"}', 990, 990
  from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;

-- รับงาน (claim_shipment)
insert into shipments (order_id, method, handled_by)
select id, 'carrier', (select id from profiles where role = 'shipping' limit 1) from demo_order;

-- ฝ่ายจัดส่งเห็นที่อยู่จากคำสั่งซื้อนี้เท่านั้น (BR5) ไม่เห็นสมุดที่อยู่ของลูกค้า
select o.order_no, o.shipping_address->>'recipient_name' as recipient,
       o.shipping_address->>'phone' as phone, o.shipping_address->>'province' as province,
       s.method, s.status
from shipments s join orders o on o.id = s.order_id
where o.id = (select id from demo_order);

-- ส่งของออก (update_shipment)
update shipments set carrier = 'Kerry', tracking_no = 'KEX123456789',
                     status = 'in_transit', shipped_at = now()
where order_id = (select id from demo_order);
update orders set status = 'shipping' where id = (select id from demo_order);

-- ส่งถึง
update shipments set status = 'delivered', delivered_at = now() where order_id = (select id from demo_order);
update orders set status = 'delivered' where id = (select id from demo_order);

select o.order_no, o.status, s.status as shipment, s.carrier, s.tracking_no
from orders o join shipments s on s.order_id = o.id
where o.id = (select id from demo_order);
rollback;

-- @@ B11 คืนเงินบางชิ้น -> คลังตรวจของ -> บัญชีจ่ายคืน (BR8)
--      คืน 1 ใน 2 ชิ้น สถานะยังเป็น delivered / คืนครบทุกชิ้น trigger set_order_refunded เปลี่ยนเป็น refunded
begin;
create temp table demo_order on commit drop as
with o as (
  insert into orders (user_id, status, shipping_address, subtotal, total_amount)
  select id, 'delivered', '{}', 1180, 1180
  from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;

insert into order_items (order_id, variant_id, product_name, variant_name, unit_price, quantity)
select d.id, v.id, 'สินค้าทดสอบ', v.name, 590, 2
from demo_order d, (select * from product_variants order by price limit 1) v;

-- ลูกค้าขอคืน 1 ชิ้นเพราะชำรุด (request_refund)
create temp table demo_refund on commit drop as
with r as (
  insert into refunds (order_id, amount, reason, detail)
  select id, 590, 'damaged', 'ฝาแตก' from demo_order
  returning id)
select id from r;

insert into refund_items (refund_id, order_item_id, quantity, amount)
select (select id from demo_refund), oi.id, 1, 590
from order_items oi where oi.order_id = (select id from demo_order);

-- คลังตรวจของคืน (check_return)
update refund_items set return_status = 'restocked',
       checked_by = (select id from profiles where role = 'warehouse' limit 1), checked_at = now()
where refund_id = (select id from demo_refund);

-- บัญชีอนุมัติ (review_refund) แล้วจ่ายคืน (mark_refund_paid)
update refunds set status = 'approved',
       approved_by = (select id from profiles where role = 'accounting' limit 1), approved_at = now()
where id = (select id from demo_refund);
update refunds set status = 'paid', slip_path = 'refunds/demo/1.jpg' where id = (select id from demo_refund);

select 'คืน 1 ใน 2 ชิ้น' as step, o.status as order_status
from orders o where o.id = (select id from demo_order);

-- ขอคืนชิ้นที่เหลืออีก 1 ชิ้น แล้วจ่ายคืน -> trigger เปลี่ยนเป็น refunded
create temp table demo_refund2 on commit drop as
with r as (
  insert into refunds (order_id, amount, reason) select id, 590, 'damaged' from demo_order returning id)
select id from r;
insert into refund_items (refund_id, order_item_id, quantity, amount)
select (select id from demo_refund2), oi.id, 1, 590
from order_items oi where oi.order_id = (select id from demo_order);
update refunds set status = 'approved' where id = (select id from demo_refund2);
update refunds set status = 'paid' where id = (select id from demo_refund2);

select 'คืนครบ 2 ชิ้น' as step, o.status as order_status
from orders o where o.id = (select id from demo_order);
rollback;

-- @@ B12 ยกเลิกก่อนส่ง: trigger set_no_return ตั้ง return_status = no_return ให้เอง
begin;
create temp table demo_order on commit drop as
with o as (
  insert into orders (user_id, status, shipping_address, subtotal, total_amount)
  select id, 'approved', '{}', 590, 590
  from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;

insert into order_items (order_id, variant_id, product_name, variant_name, unit_price, quantity)
select d.id, v.id, 'สินค้าทดสอบ', v.name, 590, 1
from demo_order d, (select * from product_variants order by price limit 1) v;

create temp table demo_refund on commit drop as
with r as (
  insert into refunds (order_id, amount, reason) select id, 590, 'cancel_before_ship' from demo_order returning id)
select id from r;

insert into refund_items (refund_id, order_item_id, quantity, amount)   -- ไม่ได้ส่ง return_status
select (select id from demo_refund), oi.id, 1, 590
from order_items oi where oi.order_id = (select id from demo_order);

select r.reason, ri.return_status      -- ได้ no_return (ค่า default คือ pending_check)
from refund_items ri join refunds r on r.id = ri.refund_id
where r.id = (select id from demo_refund);
rollback;

-- @@ B13 แชท: ลูกค้าเปิดห้อง -> ฝ่ายขายรับเรื่อง -> ตอบ
--      ฝั่งลูกค้าแสดงชื่อ "ฝ่ายบริการ" ไม่ดึงชื่อพนักงาน (NFR-04)
begin;
create temp table demo_conv on commit drop as
with c as (
  insert into conversations (customer_id)
  select id from profiles where role = 'customer' order by created_at limit 1
  returning id, customer_id)
select id, customer_id from c;

insert into messages (conversation_id, sender_type, sender_id, body)
select id, 'customer', customer_id, 'ตู้เย็นรุ่นนี้กินไฟเท่าไหร่ครับ' from demo_conv;

-- ฝ่ายขายรับเรื่อง
update conversations set status = 'in_progress',
       staff_id = (select id from profiles where role = 'sales' limit 1)
where id = (select id from demo_conv);

insert into messages (conversation_id, sender_type, sender_id, body)
select id, 'staff', staff_id, 'ประหยัดไฟเบอร์ 5 ครับ'
from conversations where id = (select id from demo_conv);

-- มุมมองฝั่งลูกค้า
select m.created_at,
       case m.sender_type when 'staff' then 'ฝ่ายบริการ' else 'คุณ' end as sender,
       m.body
from messages m
where m.conversation_id = (select id from demo_conv)
order by m.created_at, m.sender_type;
rollback;

-- @@ B14 ดู log ย้อนหลัง (Admin): ประวัติสถานะ + การเคลื่อนไหวสต็อก
select o.order_no, h.from_status, h.to_status, h.created_at, pr.email as actor
from order_status_history h
join orders o on o.id = h.order_id
left join profiles pr on pr.id = h.actor_id
order by h.created_at desc
limit 20;

select v.sku, l.change_qty, l.reason, l.created_at
from stock_logs l join product_variants v on v.id = l.variant_id
order by l.created_at desc
limit 20;


-- =====================================================================
-- หมวด R: รายงาน (คำถามยอดฮิต: GROUP BY, JOIN, aggregate)
-- =====================================================================

-- @@ R1 ยอดขายรายวัน (นับเฉพาะคำสั่งซื้อที่อนุมัติแล้วขึ้นไป)
select date_trunc('day', created_at)::date as day,
       count(*) as orders, sum(total_amount) as revenue
from orders
where status in ('approved', 'shipping', 'delivered')
group by 1
order by 1 desc;

-- @@ R2 สินค้าขายดี 5 อันดับ
select oi.product_name, oi.variant_name, sum(oi.quantity) as qty_sold,
       sum(oi.quantity * oi.unit_price) as revenue
from order_items oi
join orders o on o.id = oi.order_id
where o.status in ('approved', 'shipping', 'delivered', 'refunded')
group by oi.product_name, oi.variant_name
order by qty_sold desc
limit 5;

-- @@ R3 สินค้าใกล้หมด (ฝ่ายคลัง)
select p.name, v.sku, v.name as option, v.stock_qty
from product_variants v join products p on p.id = v.product_id
where v.is_active and v.stock_qty <= 3
order by v.stock_qty;

-- @@ R4 จำนวนคำสั่งซื้อแยกตามสถานะ (dashboard)
select status, count(*) from orders group by status order by status;

-- @@ R5 คิวงานของแต่ละฝ่าย
select 'บัญชี: สลิปรอตรวจ' as queue, count(*) from payments where status = 'pending'
union all
select 'จัดส่ง: รอส่ง', count(*) from shipments where status = 'preparing'
union all
select 'ขาย: แชทรอตอบ', count(*) from conversations where status = 'waiting_staff'
union all
select 'คลัง: ของคืนรอตรวจ', count(*) from refund_items where return_status = 'pending_check';


-- =====================================================================
-- หมวด J: JOIN ทีละแบบ (สำหรับคำถาม "ขอดูการ query แบบ JOIN")
-- =====================================================================

-- @@ J1 INNER JOIN 4 ตาราง: สินค้าในแต่ละห้อง พร้อมราคาและสต็อก
--      categories -> product_categories (M:N) -> products -> product_variants (1:N)
--      INNER JOIN เอาเฉพาะแถวที่จับคู่ได้ครบทุกตาราง
select c.name as room, p.name as product, v.sku, v.name as option, v.price, v.stock_qty
from categories c
join product_categories pc on pc.category_id = c.id
join products p            on p.id = pc.product_id
join product_variants v    on v.product_id = p.id
where p.is_active and v.is_active
order by c.name, p.name, v.price
limit 10;

-- @@ J2 LEFT JOIN + GROUP BY: นับสินค้าในแต่ละห้อง (ห้องที่ยังไม่มีสินค้าก็ยังแสดง เป็น 0)
--      LEFT JOIN เก็บทุกแถวของตารางซ้าย ฝั่งขวาที่ไม่มีคู่เป็น null
select c.id, c.name as room,
       count(distinct p.id) as products,
       count(v.id) as variants,
       min(v.price) as price_from
from categories c
left join product_categories pc on pc.category_id = c.id
left join products p            on p.id = pc.product_id and p.is_active
left join product_variants v    on v.product_id = p.id and v.is_active
group by c.id, c.name
order by c.id;

-- @@ J3 JOIN auth.users กับ profiles (1:1): ทุก role อยู่ตาราง profiles ตารางเดียว แยกด้วยคอลัมน์ role
--      ลูกค้า แอดมิน และพนักงานทุกฝ่ายใช้ตารางเดียวกัน ต่างกันแค่ค่า role (enum app_role)
select p.role, count(*) as users,
       count(*) filter (where p.is_active) as active,
       min(u.created_at)::date as first_signup
from auth.users u
join profiles p on p.id = u.id
group by p.role
order by p.role;

-- @@ J4 รายละเอียดคำสั่งซื้อล่าสุด: orders + profiles + order_items + payments + shipments
--      INNER JOIN กับลูกค้าและรายการสินค้า (ต้องมีเสมอ) · LEFT JOIN กับสลิปและการส่ง (อาจยังไม่มี)
--      ใช้คู่กับเดโมเว็บ: สั่งซื้อบนเว็บแล้วรันบล็อกนี้ จะเห็นแถวใหม่ทันที
select o.order_no, o.status, pr.full_name as customer,
       oi.product_name, oi.variant_name, oi.quantity, oi.unit_price,
       o.total_amount,
       pay.attempt_no, pay.status as payment_status,
       sh.status as shipment_status, sh.tracking_no
from orders o
join profiles pr          on pr.id = o.user_id
join order_items oi       on oi.order_id = o.id
left join payments pay    on pay.order_id = o.id
left join shipments sh    on sh.order_id = o.id
where o.id = (select id from orders order by created_at desc limit 1)
order by oi.product_name, pay.attempt_no;


-- =====================================================================
-- หมวด C: ทดสอบ constraint (รันทีละบล็อก ทุกบล็อกต้อง error ตามรหัสที่เขียนไว้)
-- =====================================================================

-- @@ C1 FK ผิด -> ERROR 23503 foreign_key_violation (ที่อยู่ของผู้ใช้ที่ไม่มีอยู่จริง)
begin;
insert into addresses (user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode)
values (gen_random_uuid(), 'ไม่มีตัวตน', '0800000000', '1', 'x', 'x', 'x', '10000');
rollback;

-- @@ C2 CHECK ราคาติดลบ -> ERROR 23514 check_violation
begin;
update product_variants set price = -1
where id = (select id from product_variants order by sku limit 1);
rollback;

-- @@ C3 CHECK สต็อกติดลบ -> ERROR 23514 (ด่านสุดท้ายกันขายเกินสต็อก)
begin;
update product_variants set stock_qty = stock_qty - 999999
where id = (select id from product_variants order by sku limit 1);
rollback;

-- @@ C4 CHECK อัปโหลดสลิปครั้งที่ 3 -> ERROR 23514 (attempt_no in (1,2))
begin;
with o as (
  insert into orders (user_id, shipping_address, subtotal, total_amount)
  select id, '{}', 1, 1 from profiles where role = 'customer' order by created_at limit 1
  returning id)
insert into payments (order_id, attempt_no, amount, slip_path)
select id, 3, 1, 'slips/x.jpg' from o;
rollback;

-- @@ C5 กฎขนส่งต้องมีเลขพัสดุ: ตรวจใน update_shipment() -> ERROR P0001
--      กฎนี้ไม่ได้เป็น CHECK ในตาราง shipments เพราะต้องรู้ว่ากำลังเปลี่ยนเป็น in_transit
--      และส่งด้วยบริษัทขนส่ง (ส่งด้วยรถของร้านไม่ต้องใส่) จึงตรวจใน RPC ที่หน้าเว็บเรียก
begin;
select set_config('request.jwt.claims',                              -- ทำในนามแอดมิน 1 คน
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where role = 'admin' and is_active order by created_at limit 1;
create temp table c5_order on commit drop as
with o as (
  insert into orders (user_id, status, shipping_address, subtotal, total_amount)
  select id, 'approved', '{}', 1, 1 from profiles where role = 'customer' order by created_at limit 1
  returning id)
select id from o;
insert into shipments (order_id, method, status) select id, 'carrier', 'preparing' from c5_order;
select update_shipment((select id from c5_order), 'in_transit');      -- ไม่ใส่ขนส่ง/เลขพัสดุ -> error
rollback;

-- @@ C6 CHECK ข้อความแชทว่าง -> ERROR 23514 (ต้องมี body หรือ image_path)
begin;
with c as (insert into conversations (customer_id)
           select id from profiles where role = 'customer' order by created_at limit 1 returning id, customer_id)
insert into messages (conversation_id, sender_type, sender_id) select id, 'customer', customer_id from c;
rollback;

-- @@ C7 UNIQUE sku ซ้ำ -> ERROR 23505 unique_violation
begin;
insert into product_variants (product_id, sku, price)
select product_id, sku, price from product_variants order by sku limit 1;
rollback;

-- @@ C8 UNIQUE หมวดชื่อซ้ำ -> ERROR 23505
begin;
insert into categories (name) select name from categories order by name limit 1;
rollback;

-- @@ C9 Partial UNIQUE ที่อยู่หลักได้แค่ 1 ที่ต่อคน -> ERROR 23505
begin;
insert into addresses (user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, is_default)
select user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, true
from addresses where is_default order by created_at limit 1;
rollback;

-- @@ C10 ENUM ค่าที่ไม่มี -> ERROR 22P02 invalid_text_representation
begin;
update orders set status = 'lost' where id = (select id from orders order by created_at limit 1);
rollback;

-- @@ C11 NOT NULL -> ERROR 23502 not_null_violation
begin;
insert into products (name) values (null);
rollback;


-- =====================================================================
-- หมวด D: ON DELETE (CASCADE / SET NULL / NO ACTION / RESTRICT)
-- หมายเหตุ: สินค้าและตัวเลือกที่มีอยู่แล้วมีประวัติใน stock_logs ทุกตัว (RESTRICT) จึงลบไม่ได้
--           D1 D2 เลยสร้างสินค้าทดสอบที่ยังไม่มีประวัติขึ้นมาลบใน transaction แล้ว rollback
-- =====================================================================

-- @@ D1 CASCADE: ลบสินค้า -> ตัวเลือก รูป และการผูกหมวด หายตาม
begin;
create temp table d1 on commit drop as
with p as (insert into products (name) values ('สินค้าทดสอบ D1') returning id)
select id from p;
insert into product_variants (product_id, sku, name, price, stock_qty)   -- สต็อก 0 จึงยังไม่มี stock_logs
select id, 'DEMO-D1', 'มาตรฐาน', 100, 0 from d1;
insert into product_images (product_id, image_path) select id, 'demo/d1.jpg' from d1;
insert into product_categories (product_id, category_id)
select d1.id, (select id from categories order by name limit 1) from d1;
create temp table d1_before on commit drop as
select (select count(*) from product_variants   where product_id = (select id from d1)) as variants,
       (select count(*) from product_images     where product_id = (select id from d1)) as images,
       (select count(*) from product_categories where product_id = (select id from d1)) as links;
delete from products where id = (select id from d1);
select b.variants as variants_before, b.images as images_before, b.links as links_before,
       (select count(*) from product_variants   where product_id = (select id from d1)) as variants_after,
       (select count(*) from product_images     where product_id = (select id from d1)) as images_after,
       (select count(*) from product_categories where product_id = (select id from d1)) as links_after   -- after ต้องเป็น 0
from d1_before b;
rollback;

-- @@ D2 SET NULL: ลบตัวเลือกที่เคยขาย -> order_items ยังอยู่ ชื่อและราคาเดิมไม่หาย
--      ของจริงตัวเลือกที่ขายไปแล้วมี stock_logs (RESTRICT) จะลบไม่ได้ ร้านใช้ is_active = false แทน
--      บล็อกนี้ตัดเฉพาะเรื่อง SET NULL ของ order_items มาโชว์
begin;
create temp table d2 on commit drop as
with v as (
  insert into product_variants (product_id, sku, name, price, stock_qty)
  select id, 'DEMO-D2', 'ตัวเลือกทดสอบ', 250, 0 from products order by created_at limit 1
  returning id, product_id),
o as (
  insert into orders (user_id, shipping_address, subtotal, total_amount)
  select id, '{}', 250, 250 from profiles where role = 'customer' order by created_at limit 1
  returning id)
select v.id as variant_id, o.id as order_id from v, o;
insert into order_items (order_id, variant_id, product_name, variant_name, unit_price, quantity)
select order_id, variant_id, 'สินค้าทดสอบ D2', 'ตัวเลือกทดสอบ', 250, 1 from d2;
delete from product_variants where id = (select variant_id from d2);
select product_name, variant_name, unit_price, variant_id as variant_id_now_null   -- ชื่อ ราคาอยู่ครบ variant_id เป็น null
from order_items where order_id = (select order_id from d2);
rollback;

-- @@ D3 NO ACTION: ลบลูกค้าที่มีคำสั่งซื้อไม่ได้ -> ERROR 23503 (กันประวัติการเงินหาย)
--      สร้างคำสั่งซื้อทดสอบให้ลูกค้า 1 คนก่อน แล้วลองลบลูกค้าคนนั้น
begin;
create temp table d3 on commit drop as
with o as (
  insert into orders (user_id, shipping_address, subtotal, total_amount)
  select id, '{}', 1, 1 from profiles where role = 'customer' order by created_at limit 1
  returning user_id)
select user_id from o;
delete from profiles where id = (select user_id from d3);           -- ERROR 23503
rollback;


-- =====================================================================
-- หมวด E: ACID และ Concurrency
-- =====================================================================

-- @@ E1 Atomicity: สั่ง 2 รายการ รายการที่ 2 สต็อกไม่พอ -> ทั้งชุดยกเลิก สต็อกรายการแรกกลับคืน
--      กด Run ได้เลยทั้งบล็อก: block begin ... exception คือ transaction ย่อย
--      error ตรงไหนก็ยกเลิกทุกคำสั่งในบล็อก (เหมือน raise exception ใน place_order())
--      ผลที่ต้องเห็น: result = ERROR 23514 ... และ rows_changed = 0 (สต็อกเท่าเดิมทุกตัว)
drop table if exists e1_before, e1_log;
create temp table e1_before as select id, stock_qty from product_variants;
create temp table e1_log (result text);
do $$
begin
  update product_variants set stock_qty = stock_qty - 1          -- รายการที่ 1 ตัดสต็อกสำเร็จ
  where id = (select id from product_variants where stock_qty >= 1 order by sku limit 1);
  update product_variants set stock_qty = stock_qty - 999999     -- รายการที่ 2 error 23514 ตรงนี้
  where id = (select id from product_variants order by sku desc limit 1);
exception when check_violation then
  insert into e1_log values ('ERROR ' || sqlstate || ': ' || sqlerrm || ' -> rollback ทั้งชุด');
end $$;
select (select result from e1_log) as result,
       count(*) filter (where v.stock_qty <> b.stock_qty) as rows_changed   -- ต้องได้ 0
from product_variants v join e1_before b on b.id = v.id;

-- @@ E2 ตัดสต็อกแบบมีเงื่อนไข: สต็อกไม่พอ = UPDATE 0 แถว (ไม่ error ไม่ติดลบ)
begin;
update product_variants set stock_qty = stock_qty - 999999
where id = (select id from product_variants limit 1) and stock_qty >= 999999
returning sku, stock_qty;
rollback;

-- @@ E3 Concurrency: ของเหลือ 1 ชิ้น 2 คนกดพร้อมกัน (กด Run ได้เลย ไม่ต้องแก้ sku)
--      เปิด SQL Editor 2 แท็บ วาง SQL แท็บ A และแท็บ B ไว้ก่อน
--      กด Run แท็บ A แล้วภายใน 15 วินาทีกด Run แท็บ B (ถ้ามีหน้าต่างเตือน drop ให้กด Run ต่อ)
--      ผลที่ต้องเห็น: แท็บ A ได้ stock_qty = 0
--                    แท็บ B หมุนรอจน A เสร็จ แล้วได้ tab_b_bought = 0 (ไม่ติดลบ)
--      ใช้สินค้า sku แรกเรียงตามตัวอักษร แท็บ A จำสต็อกเดิมไว้ แท็บ B คืนให้เองตอนจบ
--
-- ---- แท็บ A ----
begin;
select set_config('hompb.system_stock', 'on', true);              -- สาธิต: ไม่บันทึก stock_logs ปรับสต็อก
create schema if not exists demo;
create table if not exists demo.e3_backup as                       -- จำสต็อกเดิมไว้คืนทีหลัง
  select id, stock_qty from product_variants order by sku limit 1;
update product_variants set stock_qty = 1
where id = (select id from demo.e3_backup);                        -- ให้เหลือ 1 ชิ้น
update product_variants set stock_qty = stock_qty - 1
where id = (select id from demo.e3_backup) and stock_qty >= 1;     -- A ซื้อชิ้นสุดท้าย + ถือ row lock
select pg_sleep(15);                                               -- ถือ lock ไว้ 15 วินาที
select sku, stock_qty from product_variants
where id = (select id from demo.e3_backup);                        -- ต้องได้ 0
commit;
--
-- ---- แท็บ B ----
select set_config('hompb.system_stock', 'on', true);              -- สาธิต: ไม่บันทึก stock_logs ปรับสต็อก
with b as (
  update product_variants set stock_qty = stock_qty - 1
  where id = (select id from product_variants order by sku limit 1) and stock_qty >= 1
  returning id
)
select count(*) as tab_b_bought from b;                            -- รอ A เสร็จ แล้วต้องได้ 0
update product_variants v set stock_qty = k.stock_qty              -- คืนสต็อกเดิม
from demo.e3_backup k where v.id = k.id;
drop schema demo cascade;

-- @@ E4 Isolation level ปัจจุบัน
show transaction_isolation;


-- =====================================================================
-- หมวด G: RLS (จำลองเป็นผู้ใช้แต่ละ role ใน Supabase SQL Editor)
-- ⚠️ ต้องรันบน Supabase จริงที่รัน 02_security.sql แล้ว
-- =====================================================================

-- @@ G1 ผู้เยี่ยมชม (anon): เห็นสินค้า แต่ไม่เห็นคำสั่งซื้อ
begin;
set local role anon;
select (select count(*) from products) as products_visible,   -- เห็นสินค้า
       (select count(*) from orders)   as orders_visible;    -- ต้องได้ 0
rollback;

-- @@ G2 ลูกค้า: เห็นเฉพาะคำสั่งซื้อของตัวเอง
--      สร้างคำสั่งซื้อทดสอบ 2 ใบ (ของลูกค้าคนนี้ 1 ใบ ของคนอื่น 1 ใบ) แล้วสลับเป็นลูกค้าคนนี้
begin;
create temp table g2 on commit drop as
select id from profiles where role = 'customer' order by created_at limit 1;
insert into orders (user_id, shipping_address, subtotal, total_amount)
select id, '{}', 1, 1 from g2;
insert into orders (user_id, shipping_address, subtotal, total_amount)
select id, '{}', 1, 1 from profiles where id <> (select id from g2) order by created_at limit 1;
create temp table g2_total on commit drop as select count(*) as n from orders;   -- นับด้วย postgres ก่อน
grant select on g2_total to authenticated;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true) from g2;
set local role authenticated;
select auth.uid() as me,
       (select n from g2_total) as orders_in_db,
       count(*) filter (where user_id = auth.uid())  as my_orders,
       count(*) filter (where user_id <> auth.uid()) as others_visible   -- ต้องได้ 0
from orders;
rollback;
-- @@ G3 ลูกค้าพยายามเปลี่ยน role ตัวเองเป็น admin -> ERROR 42501 (trigger on_profile_update)
begin;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where role = 'customer' order by created_at limit 1;
set local role authenticated;
update profiles set role = 'admin' where id = auth.uid();
rollback;

-- @@ G4 ฝ่ายคลังดูสลิปไม่ได้ (NFR-03)
--      สร้างสลิปทดสอบ 1 ใบก่อน (slips_in_db > 0) แล้วสลับเป็นพนักงานคลัง
begin;
with o as (
  insert into orders (user_id, shipping_address, subtotal, total_amount)
  select id, '{}', 1, 1 from profiles where role = 'customer' order by created_at limit 1
  returning id)
insert into payments (order_id, attempt_no, amount, slip_path)
select id, 1, 1, 'slips/demo/g4.jpg' from o;
create temp table g4_total on commit drop as select count(*) as n from payments;   -- นับด้วย postgres ก่อน
grant select on g4_total to authenticated;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where role = 'warehouse' and is_active order by created_at limit 1;
set local role authenticated;
select auth.uid() as me,
       (select n from g4_total) as slips_in_db,
       count(*) as slips_visible                                      -- ต้องได้ 0
from payments;
rollback;
-- @@ G5 ลบข้อมูลการเงินไม่ได้แม้เป็น Admin -> ERROR 42501 permission denied
--      security.sql ถอนสิทธิ์ delete ของตารางเงินและ log จาก authenticated ไว้ก่อนถึง RLS อีกชั้น
begin;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where role = 'admin' and is_active order by created_at limit 1;
set local role authenticated;
delete from payments returning id;                   -- ERROR 42501
rollback;


-- =====================================================================
-- หมวด S: กัน SQL Injection
-- =====================================================================

-- @@ S1 ถ้าต่อ string เอง: คำค้น  x' or '1'='1  จะกลายเป็นเงื่อนไขจริงเสมอ
--      SQL ที่ได้:  select * from products where name = 'x' or '1'='1';
select count(*) as leaked_rows from products where name = 'x' or '1'='1';

-- @@ S2 แบบ parameterized (แบบที่ supabase-js ส่ง): คำค้นเป็นแค่ข้อความ หาไม่เจอ
prepare search_product(text) as select count(*) as rows from products where name = $1;
execute search_product('x'' or ''1''=''1');
deallocate search_product;


-- =====================================================================
-- หมวด X: EXPLAIN ดูว่า query ใช้ index ไหม
-- หมายเหตุ: ข้อมูลน้อย Postgres อาจเลือก Seq Scan เพราะเร็วกว่า เป็นเรื่องปกติ
--           บรรทัด set enable_seqscan = off ใช้บังคับให้เห็นว่ามี index ให้ใช้
-- =====================================================================

-- @@ X1 คิวสลิปของบัญชี -> index payments(status)
begin;
set local enable_seqscan = off;
explain analyze select * from payments where status = 'pending';
rollback;

-- @@ X2 คำสั่งซื้อของลูกค้า -> index orders(user_id)
begin;
set local enable_seqscan = off;
explain analyze select * from orders where user_id = (select id from profiles limit 1);
rollback;

-- @@ X3 โหลดข้อความในห้องแชทเรียงตามเวลา -> index messages(conversation_id, created_at)
begin;
set local enable_seqscan = off;
explain analyze
select * from messages
where conversation_id = (select id from conversations limit 1)
order by created_at;
rollback;


-- =====================================================================
-- หมวด Q: คำถามที่มักโดนถาม (อ่านอย่างเดียว ไม่แก้ข้อมูล)
-- =====================================================================

-- @@ Q1 ยอดเงินในคำสั่งซื้อตรงกับรายการสินค้าไหม (ต้องได้ 0 แถว)
--      subtotal ต้องเท่ากับผลรวม จำนวน x ราคา ใน order_items และ total = subtotal + ค่าส่ง
select o.order_no, o.subtotal,
       coalesce(sum(oi.quantity * oi.unit_price), 0) as items_sum,
       o.shipping_fee, o.total_amount
from orders o
left join order_items oi on oi.order_id = o.id
group by o.id
having o.subtotal <> coalesce(sum(oi.quantity * oi.unit_price), 0)
    or o.total_amount <> o.subtotal + o.shipping_fee;

-- @@ Q2 สต็อกปัจจุบันตรงกับผลรวมประวัติ stock_logs ไหม (mismatch ต้องเป็น 0)
--      ทุกครั้งที่สต็อกเปลี่ยน (สั่งซื้อ ยกเลิก คืนของ คลังปรับ) ระบบเขียน stock_logs
--      ผลรวม change_qty ของแต่ละตัวเลือกจึงต้องเท่ากับ stock_qty ตอนนี้
select count(*) as variants,
       count(*) filter (where v.stock_qty <> coalesce(l.total, 0)) as mismatch
from product_variants v
left join (select variant_id, sum(change_qty) as total
           from stock_logs group by variant_id) l on l.variant_id = v.id;

-- @@ Q3 FK ตัวไหนไม่มี index (ตั้งใจ: index เฉพาะคอลัมน์ที่ query ใช้จริง)
select c.conrelid::regclass as table_name, a.attname as fk_column,
       c.confrelid::regclass as references_table
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and not exists (select 1 from pg_index i
                  where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
order by 1, 2;

-- @@ Q4 ฟังก์ชัน security definer ทุกตัวล็อก search_path ไหม (no_search_path ต้องเป็น 0)
--      security definer รันด้วยสิทธิ์เจ้าของฟังก์ชัน ถ้าไม่ล็อก search_path
--      คนอื่นอาจสร้างตาราง/ฟังก์ชันชื่อซ้ำมาหลอกให้ถูกเรียกแทนได้
select count(*) filter (where prosecdef) as security_definer,
       count(*) filter (where prosecdef and proconfig is null) as no_search_path
from pg_proc
where pronamespace = 'public'::regnamespace;

-- @@ Q5 view ซ่อนคอลัมน์: ผู้เยี่ยมชมเห็นแค่ "มี/หมด" ไม่เห็นจำนวนสต็อกจริง
select 'product_variants (ตารางจริง)' as source,
       string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public' and table_name = 'product_variants'
union all
select 'variants_public (view ให้หน้าร้าน)',
       string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name = 'variants_public';

-- @@ Q6 สินค้าขายดีอันดับ 1-3 ของแต่ละห้อง (CTE + window function)
--      นับเฉพาะคำสั่งซื้อที่อนุมัติแล้วขึ้นไป ถ้ายังไม่มีคำสั่งซื้อจะได้ 0 แถว
with sold as (
  select c.name as room, oi.product_name, sum(oi.quantity) as qty
  from order_items oi
  join orders o              on o.id = oi.order_id
                            and o.status in ('approved', 'shipping', 'delivered')
  join product_variants v    on v.id = oi.variant_id
  join product_categories pc on pc.product_id = v.product_id
  join categories c          on c.id = pc.category_id
  group by c.name, oi.product_name),
ranked as (
  select *, rank() over (partition by room order by qty desc) as rank_in_room
  from sold)
select room, rank_in_room, product_name, qty
from ranked
where rank_in_room <= 3
order by room, rank_in_room;

-- @@ Q7 ใครทำอะไรล่าสุด (audit_logs 20 แถวล่าสุด)
select a.created_at, coalesce(p.email, 'ระบบ') as actor, a.action,
       a.target_table, a.detail
from audit_logs a
left join profiles p on p.id = a.actor_id
order by a.created_at desc
limit 20;

-- @@ Q8 งานอัตโนมัติ pg_cron (Supabase เท่านั้น)
--      ยกเลิกคำสั่งซื้อที่เกินเวลาโอนทุก 5 นาที
select jobname, schedule, command, active
from cron.job;

-- @@ Q9 Storage bucket เป็น private ไหม (Supabase เท่านั้น)
--      สลิปและสลิปคืนเงินต้อง public = false เปิดได้ผ่าน signed URL อายุสั้นเท่านั้น
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;


-- =====================================================================
-- หมวด Z: ล้างของค้างจากการสาธิต (รันก่อนหรือหลังโชว์ได้ทุกเมื่อ)
-- ปกติทุกบล็อกจบด้วย rollback ไม่มีอะไรค้าง หมวดนี้มีไว้กันกรณีรันไม่ครบบล็อก
-- เช่น ก๊อปไปแค่ครึ่งบล็อก หรือรัน E3 แท็บ A แล้วไม่ได้รันแท็บ B
-- =====================================================================

-- @@ Z1 ล้างข้อมูลทดสอบที่ค้าง แล้วโชว์ว่าเหลือ 0 ทุกช่อง (บันทึกจริง)
--      ลบเฉพาะของที่บล็อกสาธิตสร้าง ระบุได้แน่นอน ไม่แตะข้อมูลจริง
--      - คำสั่งซื้อทดสอบ = ไม่มีชื่อผู้รับในที่อยู่ (ของจริงจาก place_order() มีเสมอ)
--      - สินค้า/ตัวเลือก/รูปทดสอบ = ชื่อ "สินค้าทดสอบ" · SKU ขึ้นต้น DEMO- · รูปใน demo/
--      - บัญชีทดสอบจาก B1 = demo.signup@mail.com
--      - E3 ค้าง = คืนสต็อกจาก demo.e3_backup แล้วลบ schema demo
begin;
select set_config('hompb.system_stock', 'on', true);               -- คืนสต็อก E3 โดยไม่สร้าง log ปรับสต็อกปลอม
do $$
begin
  if to_regclass('demo.e3_backup') is not null then
    update public.product_variants v set stock_qty = k.stock_qty
    from demo.e3_backup k where v.id = k.id;
  end if;
end $$;
drop schema if exists demo cascade;

create temp table z1_orders on commit drop as
select id from orders where not (shipping_address ? 'recipient_name');
delete from refund_items where refund_id in (select id from refunds where order_id in (select id from z1_orders));
delete from refunds              where order_id in (select id from z1_orders);
delete from payments             where order_id in (select id from z1_orders);
delete from shipments            where order_id in (select id from z1_orders);
delete from order_items          where order_id in (select id from z1_orders);
delete from order_status_history where order_id in (select id from z1_orders);
delete from orders               where id       in (select id from z1_orders);

delete from product_variants where sku like 'DEMO-%';
delete from product_images   where image_path like 'demo/%';
delete from products         where name like 'สินค้าทดสอบ%';
delete from auth.users       where email = 'demo.signup@mail.com';

select (select count(*) from orders where not (shipping_address ? 'recipient_name')) as test_orders,
       (select count(*) from product_variants where sku like 'DEMO-%')                as test_variants,
       (select count(*) from products where name like 'สินค้าทดสอบ%')               as test_products,
       (select count(*) from profiles where email = 'demo.signup@mail.com')          as test_users,
       (select count(*) from pg_namespace where nspname = 'demo')                    as demo_schema;   -- ต้องได้ 0 ทุกช่อง
commit;

-- @@ Z2 เรียงเลขคำสั่งซื้อให้ต่อจากเลขล่าสุด (บันทึกจริง)
--      ทุกบล็อกที่สร้างคำสั่งซื้อแล้ว rollback ทำให้เลข order_no ข้าม (sequence ไม่ย้อนกลับ)
--      บล็อกนี้ตั้งให้คำสั่งซื้อจริงใบถัดไปได้เลข = เลขสูงสุดตอนนี้ + 1
select setval(pg_get_serial_sequence('public.orders', 'order_no'),
              coalesce(max(order_no), 0) + 1, false) as next_order_no
from orders;
