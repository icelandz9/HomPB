-- แท็บ A: ลูกค้า A สั่งเตียงชิ้นสุดท้าย แล้วค้าง transaction ไว้ 20 วินาที (จำลองว่ายังทำงานไม่เสร็จ)
begin;
insert into auth.users (id, email, raw_user_meta_data)
  values ('e7e70000-7e57-4000-8000-0000000000e1', 't.racea1@test.hompb', '{"full_name":"ลูกค้า A"}');
insert into public.addresses (id, user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, is_default)
  values ('e7e70000-7e57-4000-8000-0000000001e1', 'e7e70000-7e57-4000-8000-0000000000e1', 'ลูกค้า A', '0800000000', '1 ถ.ทดสอบ', 'ต', 'อ', 'กรุงเทพมหานคร', '10110', true);
select set_config('request.jwt.claim.sub', 'e7e70000-7e57-4000-8000-0000000000e1', true);
set local role authenticated;
insert into public.cart_items (user_id, variant_id, quantity)
  select public.me(), v.id, 1 from public.variants_public v
  join public.products p on p.id = v.product_id where p.name = 'เตียงนอนพร้อมที่นอน';
create temp table _ta1 as select clock_timestamp() as started;
select public.place_order('e7e70000-7e57-4000-8000-0000000001e1') as order_id,
       round(extract(epoch from clock_timestamp() - (select started from _ta1))::numeric, 1) as "รอ (วินาที)";
select pg_sleep(20);
commit;  -- เปลี่ยนเป็น rollback; ถ้าไม่อยากให้ข้อมูลค้าง (แท็บ B จะสั่งได้หลังรอ)
