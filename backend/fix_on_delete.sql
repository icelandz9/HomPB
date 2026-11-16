-- ========== แก้ฐานข้อมูลที่รัน schema.sql เวอร์ชันเก่าไปแล้ว ==========
-- รันใน Supabase Dashboard > SQL Editor ครั้งเดียว (รันซ้ำได้ ไม่พัง)
-- ฐานข้อมูลใหม่ที่รัน schema.sql ล่าสุด ไม่ต้องรันไฟล์นี้
--
-- 1. foreign key 7 ตัวที่เป็นประวัติ/log เปลี่ยนจาก on delete cascade เป็น on delete restrict
--    เดิม: ลบคำสั่งซื้อ/สินค้า/ลูกค้า แล้วรายการสั่งซื้อ ประวัติสถานะ การจัดส่ง รายการคืนเงิน log สต็อก แชท หายตามไปด้วย
--    ใหม่: ลบแถวหลักไม่ได้ถ้ายังมีประวัติอ้างถึง (เลิกขายใช้ is_active = false)
-- 2. ลบตาราง faq_entries (ไม่มีหน้าเว็บไหนใช้) ถ้ามีข้อมูลอยู่จะไม่ลบ และแจ้งเตือนแทน
-- 3. เพิ่ม index orders_pending_due_idx ให้ cancel_expired_orders หาคำสั่งซื้อที่เลยกำหนดโอนได้เร็ว

begin;

-- 1. FK ----------------------------------------------------------------
do $$
declare
  fk record;
  v_name text;
begin
  for fk in
    select * from (values
      ('order_items',          'order_id',      'orders'),
      ('order_status_history', 'order_id',      'orders'),
      ('refund_items',         'refund_id',     'refunds'),
      ('refund_items',         'order_item_id', 'order_items'),
      ('shipments',            'order_id',      'orders'),
      ('stock_logs',           'variant_id',    'product_variants'),
      ('conversations',        'customer_id',   'profiles')
    ) as t(tbl, col, ref)
  loop
    -- หาชื่อ constraint จริง (ปกติเป็น <ตาราง>_<คอลัมน์>_fkey แต่ไม่เดา)
    select c.conname into v_name
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.conrelid = ('public.' || fk.tbl)::regclass
      and c.confrelid = ('public.' || fk.ref)::regclass
      and array_length(c.conkey, 1) = 1
      and a.attname = fk.col;

    if v_name is null then
      v_name := fk.tbl || '_' || fk.col || '_fkey';
    else
      execute format('alter table public.%I drop constraint %I', fk.tbl, v_name);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete restrict',
      fk.tbl, v_name, fk.col, fk.ref);
  end loop;
end;
$$;

-- 2. faq_entries -------------------------------------------------------
do $$
begin
  if to_regclass('public.faq_entries') is null then
    raise notice 'faq_entries ไม่มีอยู่แล้ว ข้าม';
  elsif exists (select 1 from public.faq_entries) then
    raise warning 'faq_entries ยังมีข้อมูล ไม่ลบ ย้ายข้อมูลออกก่อนแล้วรันไฟล์นี้อีกรอบ';
  else
    drop table public.faq_entries; -- trigger set_updated_at ของตารางนี้หายไปด้วย
  end if;
end;
$$;

-- 3. index -------------------------------------------------------------
create index if not exists orders_pending_due_idx
  on public.orders (payment_due_at) where status = 'pending_payment';

commit;

-- เช็กผล: ต้องได้ 7 แถว on_delete = RESTRICT ทุกแถว
select c.conrelid::regclass as table_name,
       a.attname            as column_name,
       c.confrelid::regclass as references_table,
       case c.confdeltype when 'r' then 'RESTRICT' when 'c' then 'CASCADE'
                          when 'n' then 'SET NULL' when 'a' then 'NO ACTION' else c.confdeltype::text end as on_delete
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f'
  and (c.conrelid::regclass::text, a.attname) in (
    ('order_items', 'order_id'), ('order_status_history', 'order_id'), ('refund_items', 'refund_id'),
    ('refund_items', 'order_item_id'), ('shipments', 'order_id'), ('stock_logs', 'variant_id'),
    ('conversations', 'customer_id'))
order by 1, 2;

-- เช็กเพิ่ม: faq_entries ต้องเป็น null, index ต้องมีชื่อ orders_pending_due_idx
-- select to_regclass('public.faq_entries') as faq_entries, to_regclass('public.orders_pending_due_idx') as pending_due_idx;
