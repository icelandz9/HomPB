-- ========== เพิ่มคอลัมน์ stock_left ให้ view variants_public ==========
-- รันใน Supabase Dashboard > SQL Editor ครั้งเดียว (รันซ้ำได้ ไม่พัง)
-- ฐานข้อมูลใหม่ที่รัน security.sql ล่าสุด ไม่ต้องรันไฟล์นี้
--
-- หน้าร้านโชว์ "เหลือ N ชิ้น" ใต้ชื่อสินค้า จึงต้องให้ลูกค้าเห็นจำนวนสต๊อก (ยังไม่เห็น sku)
-- create or replace view เพิ่มคอลัมน์ต่อท้ายได้ สิทธิ์ (grant) เดิมยังอยู่

create or replace view public.variants_public with (security_barrier) as
  select v.id, v.product_id, v.name, v.price, (v.stock_qty > 0) as in_stock, v.stock_qty as stock_left
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.is_active and p.is_active;
