-- ขั้น 0 (รันครั้งเดียวก่อนสาธิต): จำสต็อกเดิมไว้ แล้วตั้งสต็อกของสินค้าที่ใช้สาธิตเหลือ 1 ชิ้น
-- ตารางพัก _race_backup ถูกลบใน 3_cleanup.sql หลังคืนสต็อกเดิม
create table if not exists public._race_backup as
  select sku, stock_qty from public.product_variants where sku = 'HPB-BED-003';
revoke all on public._race_backup from anon, authenticated;
update public.product_variants set stock_qty = 1 where sku = 'HPB-BED-003';
select v.sku, b.stock_qty as "สต็อกเดิม", v.stock_qty as "ตอนนี้"
  from public.product_variants v join public._race_backup b using (sku);
