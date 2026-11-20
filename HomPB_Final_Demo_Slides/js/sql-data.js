/* SQL demo ทั้งหมด (ตรงกับ HomPB_Demo_SQL.sql) slides.js แยกเป็นบล็อกตามบรรทัด -- @@ */
const SQL_TEXT = `-- =====================================================================
-- HomPB: SQL สำหรับโชว์ตอนนำเสนอ (Supabase SQL Editor)
-- วิธีใช้: ลากคลุมทีละบล็อก (ตั้งแต่ -- @@ ถึงก่อน -- @@ ถัดไป) แล้วกด Run
-- บล็อกที่แก้ข้อมูลครอบด้วย begin; ... rollback; ข้อมูลจริงจะไม่เปลี่ยน
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
insert into addresses (user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode)
values (gen_random_uuid(), 'ไม่มีตัวตน', '0800000000', '1', 'x', 'x', 'x', '10000');

-- @@ C2 CHECK ราคาติดลบ -> ERROR 23514 check_violation
update product_variants set price = -1
where id = (select id from product_variants limit 1);

-- @@ C3 CHECK สต็อกติดลบ -> ERROR 23514 (ด่านสุดท้ายกันขายเกินสต็อก)
update product_variants set stock_qty = stock_qty - 999999
where id = (select id from product_variants limit 1);

-- @@ C4 CHECK อัปโหลดสลิปครั้งที่ 3 -> ERROR 23514 (attempt_no in (1,2))
insert into payments (order_id, attempt_no, amount, slip_path)
select id, 3, total_amount, 'slips/x.jpg' from orders limit 1;

-- @@ C5 CHECK ส่งด้วยขนส่งแต่ไม่มีเลขพัสดุ -> ERROR 23514
begin;
with o as (
  insert into orders (user_id, status, shipping_address, subtotal, total_amount)
  select id, 'approved', '{}', 1, 1 from profiles where role = 'customer' limit 1
  returning id)
insert into shipments (order_id, method, status) select id, 'carrier', 'in_transit' from o;
rollback;

-- @@ C6 CHECK ข้อความแชทว่าง -> ERROR 23514 (ต้องมี body หรือ image_path)
begin;
with c as (insert into conversations (customer_id)
           select id from profiles where role = 'customer' limit 1 returning id, customer_id)
insert into messages (conversation_id, sender_type, sender_id) select id, 'customer', customer_id from c;
rollback;

-- @@ C7 UNIQUE sku ซ้ำ -> ERROR 23505 unique_violation
insert into product_variants (product_id, sku, price)
select product_id, sku, price from product_variants limit 1;

-- @@ C8 UNIQUE หมวดชื่อซ้ำ -> ERROR 23505
insert into categories (name) select name from categories limit 1;

-- @@ C9 Partial UNIQUE ที่อยู่หลักได้แค่ 1 ที่ต่อคน -> ERROR 23505
insert into addresses (user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, is_default)
select user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, true
from addresses where is_default limit 1;

-- @@ C10 ENUM ค่าที่ไม่มี -> ERROR 22P02 invalid_text_representation
update orders set status = 'lost' where id = (select id from orders limit 1);

-- @@ C11 NOT NULL -> ERROR 23502 not_null_violation
insert into products (name) values (null);


-- =====================================================================
-- หมวด D: ON DELETE (CASCADE / SET NULL / NO ACTION)
-- =====================================================================

-- @@ D1 CASCADE: ลบสินค้า -> ตัวเลือก รูป หมวด หายตาม
begin;
select (select count(*) from product_variants)   as variants_before,
       (select count(*) from product_images)     as images_before,
       (select count(*) from product_categories) as links_before;
delete from products
where id = (select p.id from products p
            where not exists (select 1 from product_variants v
                              join order_items oi on oi.variant_id = v.id
                              where v.product_id = p.id)
            limit 1);
select (select count(*) from product_variants)   as variants_after,
       (select count(*) from product_images)     as images_after,
       (select count(*) from product_categories) as links_after;
rollback;

-- @@ D2 SET NULL: ลบตัวเลือกที่เคยขายไป -> order_items ยังอยู่ ชื่อและราคาเดิมไม่หาย
begin;
select oi.product_name, oi.unit_price, oi.variant_id from order_items oi limit 3;
delete from product_variants where id in (select variant_id from order_items where variant_id is not null);
select oi.product_name, oi.unit_price, oi.variant_id as variant_id_now_null from order_items oi limit 3;
rollback;

-- @@ D3 NO ACTION: ลบลูกค้าที่มีคำสั่งซื้อไม่ได้ -> ERROR 23503 (กันประวัติการเงินหาย)
begin;
delete from profiles where id = (select user_id from orders limit 1);
rollback;


-- =====================================================================
-- หมวด E: ACID และ Concurrency
-- =====================================================================

-- @@ E1 Atomicity: สั่ง 2 รายการ รายการที่ 2 สต็อกไม่พอ -> ทั้งชุดยกเลิก สต็อกรายการแรกกลับคืน
--      (ใน place_order() จริงใช้ raise exception ให้ rollback ทั้งฟังก์ชัน)
drop table if exists stock_before;
create temp table stock_before as select id, stock_qty from product_variants;
begin;
update product_variants set stock_qty = stock_qty - 1
where id = (select id from product_variants where stock_qty >= 1 order by sku limit 1);
update product_variants set stock_qty = stock_qty - 999999   -- error 23514 ตรงนี้
where id = (select id from product_variants order by sku desc limit 1);
rollback;
-- ตรวจว่าสต็อกเท่าเดิมทุกตัว (ต้องได้ 0 แถว)
select v.sku, b.stock_qty as before, v.stock_qty as now
from product_variants v join stock_before b on b.id = v.id
where v.stock_qty <> b.stock_qty;

-- @@ E2 ตัดสต็อกแบบมีเงื่อนไข: สต็อกไม่พอ = UPDATE 0 แถว (ไม่ error ไม่ติดลบ)
begin;
update product_variants set stock_qty = stock_qty - 999999
where id = (select id from product_variants limit 1) and stock_qty >= 999999
returning sku, stock_qty;
rollback;

-- @@ E3 Concurrency: ของเหลือ 1 ชิ้น 2 คนกดพร้อมกัน
--      เปิด SQL Editor 2 แท็บ วาง SQL แท็บ A และแท็บ B ไว้ก่อน
--      กด Run แท็บ A แล้วภายใน 10 วินาทีกด Run แท็บ B
--      ผลที่ต้องเห็น: แท็บ A ได้ 1 แถว (stock 0), แท็บ B ค้างรอจน A เสร็จ แล้วได้ 0 แถว
--      เปลี่ยน 'RC-2L' เป็น sku จริงที่ตั้ง stock_qty = 1 ไว้ก่อนโชว์
--
-- ---- แท็บ A ----
begin;
update product_variants set stock_qty = stock_qty - 1
where sku = 'RC-2L' and stock_qty >= 1
returning sku, stock_qty;
select pg_sleep(10);           -- ถือ row lock ไว้ 10 วินาที
commit;
--
-- ---- แท็บ B ---- (คัดลอกไปวางอีกแท็บ)
-- update product_variants set stock_qty = stock_qty - 1
-- where sku = 'RC-2L' and stock_qty >= 1
-- returning sku, stock_qty;
--
-- ---- คืนสต็อกหลังโชว์เสร็จ ----
-- update product_variants set stock_qty = stock_qty + 1 where sku = 'RC-2L';

-- @@ E4 Isolation level ปัจจุบัน
show transaction_isolation;


-- =====================================================================
-- หมวด G: RLS (จำลองเป็นผู้ใช้แต่ละ role ใน Supabase SQL Editor)
-- ⚠️ ต้องรันบน Supabase จริงที่รัน 02_security.sql แล้ว
-- =====================================================================

-- @@ G1 ผู้เยี่ยมชม (anon): เห็นสินค้า แต่ไม่เห็นคำสั่งซื้อ
begin;
set local role anon;
select count(*) as products_visible from products;
select count(*) as orders_visible from orders;      -- ต้องได้ 0
rollback;

-- @@ G2 ลูกค้า: เห็นเฉพาะคำสั่งซื้อของตัวเอง
--      เปลี่ยน email เป็นลูกค้าจริงที่มีคำสั่งซื้อ
begin;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where email = 'cust1@mail.com';
set local role authenticated;
select auth.uid() as me,
       count(*) filter (where user_id = auth.uid()) as my_orders,
       count(*) filter (where user_id <> auth.uid()) as others_orders   -- ต้องได้ 0
from orders;
rollback;

-- @@ G3 ลูกค้าพยายามเปลี่ยน role ตัวเองเป็น admin -> ต้องถูกปฏิเสธ
begin;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where email = 'cust1@mail.com';
set local role authenticated;
update profiles set role = 'admin' where id = auth.uid();
rollback;

-- @@ G4 ฝ่ายคลังดูสลิปไม่ได้ (NFR-03)
begin;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where email = 'stock@hompb.com';
set local role authenticated;
select count(*) as slips_visible from payments;      -- ต้องได้ 0
rollback;

-- @@ G5 ลบข้อมูลการเงินไม่ได้แม้เป็น Admin (ไม่มี policy DELETE)
begin;
select set_config('request.jwt.claims',
       json_build_object('sub', id, 'role', 'authenticated')::text, true)
from profiles where email = 'admin@hompb.com';
set local role authenticated;
delete from payments returning id;                   -- ต้องลบได้ 0 แถว
delete from audit_logs returning id;                 -- ต้องลบได้ 0 แถว
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
`;
