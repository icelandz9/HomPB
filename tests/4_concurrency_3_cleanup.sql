-- ขั้น 3: ลบข้อมูลของลูกค้าทดสอบ (t.racea1 / t.raceb2) แล้วคืนสต็อกเดิมที่จำไว้ใน 0_setup.sql
drop table if exists _race_users;
create temp table _race_users as
  select id from auth.users where email in ('t.racea1@test.hompb', 't.raceb2@test.hompb');
delete from public.stock_logs where order_id in (select id from public.orders where user_id in (select id from _race_users));
delete from public.order_status_history where order_id in (select id from public.orders where user_id in (select id from _race_users));
delete from public.order_items where order_id in (select id from public.orders where user_id in (select id from _race_users));
delete from public.orders where user_id in (select id from _race_users);
delete from auth.users where id in (select id from _race_users);
-- คืนสต็อกเดิม ถ้าไม่มีตารางพัก (ยังไม่เคยรัน 0_setup.sql) จะข้ามขั้นนี้
do $r$
begin
  if to_regclass('public._race_backup') is not null then
    update public.product_variants v set stock_qty = b.stock_qty from public._race_backup b where v.sku = b.sku;
    drop table public._race_backup;
  else
    raise notice 'ไม่มี _race_backup: ไม่ได้คืนสต็อก ตรวจสต็อกด้วยตัวเอง';
  end if;
end $r$;
drop table if exists _race_users;
select sku, stock_qty from public.product_variants where sku = 'HPB-BED-003';
