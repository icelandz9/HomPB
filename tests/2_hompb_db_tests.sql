-- =====================================================================
-- HomPB: ชุดทดสอบฐานข้อมูล (Test Case TC-01 ถึง TC-41)
-- รันได้ทั้งใน Supabase SQL Editor และ PostgreSQL ที่โหลด backend/*.sql แล้ว
--
-- ทำไมผลนี้เชื่อได้แม้ SQL Editor ข้าม RLS:
--   ทุกขั้นสลับเป็น role authenticated / anon ด้วย SET LOCAL ROLE และตั้ง
--   request.jwt.claim.sub = id ของผู้ใช้ทดสอบ แบบเดียวกับที่ Supabase ทำตอนหน้าเว็บเรียก
--   ดังนั้น RLS, GRANT และ auth.uid() ทำงานจริงทุกขั้น
--
-- ปลอดภัยกับข้อมูลจริง: แต่ละเคสสร้างข้อมูลทดสอบเองแล้วยกเลิก (rollback) ตอนจบเคส
--   ผู้ใช้ทดสอบ (t.*@test.hompb) ฟังก์ชันช่วย public._t_* และคำสั่งซื้อทดสอบไม่ค้างในฐานข้อมูล
--
-- วิธีรัน: วางทั้งไฟล์ใน SQL Editor แล้วกด Run ผลคือตารางสุดท้าย แถวแรกเป็นสรุป ผ่าน / ทั้งหมด
-- =====================================================================
create temp table if not exists _tc_result (seq serial, id text, title text, result text, detail text);
truncate _tc_result;

-- เตรียมข้อมูลทดสอบ: เรียกใหม่ทุกเคส และถูกยกเลิก (rollback) พร้อมเคสนั้น
create or replace function pg_temp._t_setup() returns void language plpgsql as $setup$
begin

-- ผู้ใช้ทดสอบ (trigger handle_new_user สร้าง profiles ให้)
insert into auth.users (id, email, raw_user_meta_data) values
  ('e7e70000-7e57-4000-8000-0000000000a1', 't.admin@test.hompb',   '{"full_name":"ทดสอบ แอดมิน"}'),
  ('e7e70000-7e57-4000-8000-0000000000a2', 't.stock@test.hompb',   '{"full_name":"ทดสอบ คลัง"}'),
  ('e7e70000-7e57-4000-8000-0000000000a3', 't.ship@test.hompb',    '{"full_name":"ทดสอบ จัดส่ง 1"}'),
  ('e7e70000-7e57-4000-8000-0000000000a4', 't.ship2@test.hompb',   '{"full_name":"ทดสอบ จัดส่ง 2"}'),
  ('e7e70000-7e57-4000-8000-0000000000a5', 't.cs@test.hompb',      '{"full_name":"ทดสอบ บริการ"}'),
  ('e7e70000-7e57-4000-8000-0000000000a6', 't.finance@test.hompb', '{"full_name":"ทดสอบ บัญชี"}'),
  ('e7e70000-7e57-4000-8000-0000000000c1', 't.custa@test.hompb', '{"full_name":"ลูกค้า เอ"}'),
  ('e7e70000-7e57-4000-8000-0000000000c2', 't.custb@test.hompb', '{"full_name":"ลูกค้า บี"}');
update public.profiles set role = 'admin'      where email = 't.admin@test.hompb';
update public.profiles set role = 'warehouse'  where email = 't.stock@test.hompb';
update public.profiles set role = 'shipping'   where email in ('t.ship@test.hompb', 't.ship2@test.hompb');
update public.profiles set role = 'sales'      where email = 't.cs@test.hompb';
update public.profiles set role = 'accounting' where email = 't.finance@test.hompb';
insert into public.addresses (id, user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, is_default) values
  ('e7e70000-7e57-4000-8000-0000000000d1', 'e7e70000-7e57-4000-8000-0000000000c1', 'ลูกค้า เอ', '0811111111', '99/1 ถ.สุขุมวิท', 'คลองตัน', 'คลองเตย', 'กรุงเทพมหานคร', '10110', true),
  ('e7e70000-7e57-4000-8000-0000000000d2', 'e7e70000-7e57-4000-8000-0000000000c2', 'ลูกค้า บี', '0822222222', '5 ถ.นิมมาน', 'สุเทพ', 'เมือง', 'เชียงใหม่', '50200', true);

-- ค่าตั้งต้นของสินค้าที่ใช้ทดสอบ (ข้อมูลจริงอาจถูกสั่งไปแล้ว จึงตั้งใหม่ใน transaction นี้)
update public.product_variants set stock_qty = 20, is_active = true where sku = 'HPB-BATH-001';
update public.product_variants set stock_qty = 10, is_active = true where sku = 'HPB-BED-003';
update public.products set is_active = true where id in (select product_id from public.product_variants where sku in ('HPB-BATH-001', 'HPB-BED-003'));
update public.store_settings set payment_window_hours = 24, reupload_window_hours = 24, shipping_fee = 0;

-- ฟังก์ชันช่วยหา id ของข้อมูลทดสอบ (security definer: ใช้ได้ทุก role โดยไม่ติด RLS)
execute $d$create function public._t_v(p_sku text) returns uuid language sql stable security definer set search_path = '' as
  $f$ select id from public.product_variants where sku = p_sku $f$$d$;
execute $d$create function public._t_last_order() returns uuid language sql stable security definer set search_path = '' as
  $f$ select id from public.orders where user_id = 'e7e70000-7e57-4000-8000-0000000000c1' order by created_at desc, order_no desc limit 1 $f$$d$;
execute $d$create function public._t_last_pay() returns uuid language sql stable security definer set search_path = '' as
  $f$ select id from public.payments where order_id = public._t_last_order() order by attempt_no desc limit 1 $f$$d$;
execute $d$create function public._t_last_refund() returns uuid language sql stable security definer set search_path = '' as
  $f$ select id from public.refunds where order_id = public._t_last_order() order by requested_at desc limit 1 $f$$d$;
  execute 'grant execute on function public._t_v(text), public._t_last_order(), public._t_last_pay(), public._t_last_refund() to anon, authenticated';
end $setup$;


-- TC-01 [FR-01] สมัครสมาชิกใหม่ ระบบสร้าง profile ให้อัตโนมัติ role = customer
-- คาดว่า: มีแถวใน profiles และ role = customer
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$insert into auth.users(id,email,raw_user_meta_data) values (gen_random_uuid(),'t.new@test.hompb','{"full_name":"ใหม่"}')$q$;
    execute $q$select role from profiles where email='t.new@test.hompb'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('customer') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'customer'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-01', 'สมัครสมาชิกใหม่ ระบบสร้าง profile ให้อัตโนมัติ role = customer', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-01', 'สมัครสมาชิกใหม่ ระบบสร้าง profile ให้อัตโนมัติ role = customer', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-02 [FR-17] ลูกค้าพยายามเปลี่ยน role ตัวเองเป็น admin
-- คาดว่า: ถูกปฏิเสธ: แก้ role, is_active หรือ email ได้เฉพาะ Admin
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$update profiles set role='admin' where id=public.me()$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (แก้ role) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('แก้ role' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-02', 'ลูกค้าพยายามเปลี่ยน role ตัวเองเป็น admin', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-02', 'ลูกค้าพยายามเปลี่ยน role ตัวเองเป็น admin', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-03 [FR-17] Admin เปลี่ยนตำแหน่งพนักงาน ระบบบันทึก audit_logs
-- คาดว่า: เปลี่ยนได้ และมี audit_logs action = profile.access_change
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.admin@test.hompb'), true); execute 'set local role authenticated';
    execute $q$update profiles set role='warehouse' where email='t.cs@test.hompb'$q$;
    execute $q$select count(*)>0 from audit_logs where action='profile.access_change'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('True') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'True'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-03', 'Admin เปลี่ยนตำแหน่งพนักงาน ระบบบันทึก audit_logs', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-03', 'Admin เปลี่ยนตำแหน่งพนักงาน ระบบบันทึก audit_logs', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-04 [FR-17] Admin ปิดบัญชีพนักงาน แล้วบัญชีนั้นหมดสิทธิ์ทันที
-- คาดว่า: current_user_role() คืนค่าว่าง เห็นข้อมูลไม่ได้
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.admin@test.hompb'), true); execute 'set local role authenticated';
    execute $q$update profiles set is_active=false where email='t.cs@test.hompb'$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.cs@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select coalesce(public.current_user_role()::text,'(ไม่มีสิทธิ์)')$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('(ไม่มีสิทธิ์)') then raise exception 'ขั้นที่ 4: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '(ไม่มีสิทธิ์)'; end if;
    got := got || v;
    execute $q$select count(*) from conversations$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 5: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-04', 'Admin ปิดบัญชีพนักงาน แล้วบัญชีนั้นหมดสิทธิ์ทันที', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-04', 'Admin ปิดบัญชีพนักงาน แล้วบัญชีนั้นหมดสิทธิ์ทันที', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-05 [FR-02] ผู้เยี่ยมชม (ไม่ล็อกอิน) ดูสินค้าได้ แต่ไม่เห็น sku และสต็อกจริง
-- คาดว่า: เห็นสินค้าและ variants_public แต่ product_variants ได้ 0 แถว
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
    execute $q$select count(*)>0 from products$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('True') then raise exception 'ขั้นที่ 2: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'True'; end if;
    got := got || v;
    execute $q$select count(*)>0 from variants_public where in_stock$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('True') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'True'; end if;
    got := got || v;
    execute $q$select count(*) from product_variants$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 4: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-05', 'ผู้เยี่ยมชม (ไม่ล็อกอิน) ดูสินค้าได้ แต่ไม่เห็น sku และสต็อกจริง', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-05', 'ผู้เยี่ยมชม (ไม่ล็อกอิน) ดูสินค้าได้ แต่ไม่เห็น sku และสต็อกจริง', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-06 [FR-02] สินค้าที่ปิดขาย (is_active = false) ไม่แสดงหน้าร้าน
-- คาดว่า: ผู้เยี่ยมชมไม่เห็นสินค้าที่ปิดขาย
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$update products set is_active=false where name='ชาม'$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
    execute $q$select count(*) from products where name='ชาม'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 4: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-06', 'สินค้าที่ปิดขาย (is_active = false) ไม่แสดงหน้าร้าน', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-06', 'สินค้าที่ปิดขาย (is_active = false) ไม่แสดงหน้าร้าน', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-07 [FR-04] ลูกค้าใส่ตะกร้าและรายการโปรด ลูกค้าคนอื่นมองไม่เห็น
-- คาดว่า: ลูกค้า A เห็นตะกร้าตัวเอง 1 รายการ ลูกค้า B เห็น 0 (RLS)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$insert into favorites(user_id,product_id) select public.me(), id from products where name='ผ้าขี้ริ้ว'$q$;
    execute $q$select count(*) from cart_items$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('1') then raise exception 'ขั้นที่ 4: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '1'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custb@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from cart_items$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    execute $q$select count(*) from favorites$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 7: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-07', 'ลูกค้าใส่ตะกร้าและรายการโปรด ลูกค้าคนอื่นมองไม่เห็น', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-07', 'ลูกค้าใส่ตะกร้าและรายการโปรด ลูกค้าคนอื่นมองไม่เห็น', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-08 [FR-03, FR-12] สั่งซื้อจากตะกร้า ระบบตัดสต็อก เขียน stock_logs และล้างตะกร้า
-- คาดว่า: สต็อก 20 → 18, stock_logs -2 order, ตะกร้าว่าง, ยอด 118.00, สถานะ pending_payment
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('True') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'True'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select stock_qty from public.product_variants where sku='HPB-BATH-001'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('18') then raise exception 'ขั้นที่ 5: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '18'; end if;
    got := got || v;
    execute $q$select change_qty||' '||reason from stock_logs where reason='order' and order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('-2 order') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '-2 order'; end if;
    got := got || v;
    execute $q$select count(*) from cart_items where user_id='e7e70000-7e57-4000-8000-0000000000c1'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 7: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    execute $q$select total_amount from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('118.00') then raise exception 'ขั้นที่ 8: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '118.00'; end if;
    got := got || v;
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('pending_payment') then raise exception 'ขั้นที่ 9: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'pending_payment'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-08', 'สั่งซื้อจากตะกร้า ระบบตัดสต็อก เขียน stock_logs และล้างตะกร้า', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-08', 'สั่งซื้อจากตะกร้า ระบบตัดสต็อก เขียน stock_logs และล้างตะกร้า', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-09 [FR-12] สั่งเกินสต็อก ระบบยกเลิกทั้งรายการ (ROLLBACK) สต็อกไม่ถูกตัดครึ่งทาง
-- คาดว่า: error สินค้ามีไม่พอ สต็อกชิ้นแรกยังเป็น 20 ไม่มีคำสั่งซื้อค้าง
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),1)$q$;
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BED-003'),99)$q$;
    begin
      execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
      raise exception 'ขั้นที่ 4: ควรถูกปฏิเสธ (มีไม่พอ) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('มีไม่พอ' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select stock_qty from public.product_variants where sku='HPB-BATH-001'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('20') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '20'; end if;
    got := got || v;
    execute $q$select count(*) from orders where user_id='e7e70000-7e57-4000-8000-0000000000c1'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 7: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-09', 'สั่งเกินสต็อก ระบบยกเลิกทั้งรายการ (ROLLBACK) สต็อกไม่ถูกตัดครึ่งทาง', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-09', 'สั่งเกินสต็อก ระบบยกเลิกทั้งรายการ (ROLLBACK) สต็อกไม่ถูกตัดครึ่งทาง', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-10 [FR-03, FR-15] ลูกค้าใช้ที่อยู่ของคนอื่นสั่งซื้อ
-- คาดว่า: ถูกปฏิเสธ: ไม่พบที่อยู่จัดส่ง
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),1)$q$;
    begin
      execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d2')$q$;
      raise exception 'ขั้นที่ 3: ควรถูกปฏิเสธ (ไม่พบที่อยู่) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('ไม่พบที่อยู่' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-10', 'ลูกค้าใช้ที่อยู่ของคนอื่นสั่งซื้อ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-10', 'ลูกค้าใช้ที่อยู่ของคนอื่นสั่งซื้อ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-11 [FR-03, FR-20] พนักงานเรียก place_order
-- คาดว่า: ถูกปฏิเสธ: ไม่มีสิทธิ์ทำรายการนี้ (42501)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1')$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (ไม่มีสิทธิ์) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('ไม่มีสิทธิ์' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-11', 'พนักงานเรียก place_order', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-11', 'พนักงานเรียก place_order', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-12 [FR-03] ลูกค้า insert ตาราง orders ตรงเพื่อแก้ราคาเอง
-- คาดว่า: ถูกปฏิเสธ: permission denied (ต้องสั่งผ่าน place_order)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$insert into orders(user_id,shipping_address,subtotal,total_amount) values ('e7e70000-7e57-4000-8000-0000000000c1','{}',1,1)$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (permission denied) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('permission denied' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-12', 'ลูกค้า insert ตาราง orders ตรงเพื่อแก้ราคาเอง', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-12', 'ลูกค้า insert ตาราง orders ตรงเพื่อแก้ราคาเอง', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-13 [FR-05] แนบสลิปครั้งแรก
-- คาดว่า: สถานะเป็น awaiting_approval, payments.attempt_no = 1
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),1)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('True') then raise exception 'ขั้นที่ 4: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'True'; end if;
    got := got || v;
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('awaiting_approval') then raise exception 'ขั้นที่ 5: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'awaiting_approval'; end if;
    got := got || v;
    execute $q$select attempt_no from payments where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('1') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '1'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-13', 'แนบสลิปครั้งแรก', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-13', 'แนบสลิปครั้งแรก', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-14 [FR-05] แนบสลิปโดยใช้ path ของลูกค้าคนอื่น
-- คาดว่า: ถูกปฏิเสธ: path ต้องเป็น {user_id}/{order_id}/ชื่อไฟล์
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),1)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    begin
      execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c2/'||public._t_last_order()||'/slip.jpg')$q$;
      raise exception 'ขั้นที่ 4: ควรถูกปฏิเสธ (path ของสลิป) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('path ของสลิป' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-14', 'แนบสลิปโดยใช้ path ของลูกค้าคนอื่น', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-14', 'แนบสลิปโดยใช้ path ของลูกค้าคนอื่น', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-15 [FR-05, FR-09, FR-10] สลิปไม่ผ่านครั้งที่ 1 อัปโหลดใหม่ได้ ไม่ผ่านครั้งที่ 2 ยกเลิกและคืนสต็อก
-- คาดว่า: ครั้งที่ 1 กลับเป็น pending_payment ครั้งที่ 2 เป็น cancelled สต็อกคืนเป็น 20
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),3)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/s1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), false, 'ยอดไม่ตรง')$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('pending_payment') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'pending_payment'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/s2.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), false, 'สลิปปลอม')$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('cancelled') then raise exception 'ขั้นที่ 10: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'cancelled'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select stock_qty from public.product_variants where sku='HPB-BATH-001'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('20') then raise exception 'ขั้นที่ 12: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '20'; end if;
    got := got || v;
    execute $q$select count(*) from payments where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('2') then raise exception 'ขั้นที่ 13: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '2'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-15', 'สลิปไม่ผ่านครั้งที่ 1 อัปโหลดใหม่ได้ ไม่ผ่านครั้งที่ 2 ยกเลิกและคืนสต็อก', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-15', 'สลิปไม่ผ่านครั้งที่ 1 อัปโหลดใหม่ได้ ไม่ผ่านครั้งที่ 2 ยกเลิกและคืนสต็อก', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-16 [FR-09, FR-16] ฝ่ายบัญชีอนุมัติสลิป ระบบสร้างงานจัดส่งให้อัตโนมัติ
-- คาดว่า: orders.status = approved มี shipments 1 แถว method = store_truck (สินค้าชิ้นใหญ่)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BED-003'),1)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 8: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute $q$select method from shipments where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('store_truck') then raise exception 'ขั้นที่ 9: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'store_truck'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-16', 'ฝ่ายบัญชีอนุมัติสลิป ระบบสร้างงานจัดส่งให้อัตโนมัติ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-16', 'ฝ่ายบัญชีอนุมัติสลิป ระบบสร้างงานจัดส่งให้อัตโนมัติ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-17 [FR-09] ไม่อนุมัติสลิปโดยไม่ใส่เหตุผล
-- คาดว่า: ถูกปฏิเสธ: ต้องใส่เหตุผลที่ไม่อนุมัติ
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),1)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/s1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$select public.review_payment(public._t_last_pay(), false, '')$q$;
      raise exception 'ขั้นที่ 6: ควรถูกปฏิเสธ (ต้องใส่เหตุผล) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('ต้องใส่เหตุผล' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-17', 'ไม่อนุมัติสลิปโดยไม่ใส่เหตุผล', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-17', 'ไม่อนุมัติสลิปโดยไม่ใส่เหตุผล', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-18 [FR-09, FR-20] ฝ่ายคลังพยายามอนุมัติสลิป
-- คาดว่า: ถูกปฏิเสธ: ไม่มีสิทธิ์ทำรายการนี้
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),1)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/s1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$select public.review_payment(public._t_last_pay(), true)$q$;
      raise exception 'ขั้นที่ 6: ควรถูกปฏิเสธ (ไม่มีสิทธิ์) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('ไม่มีสิทธิ์' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-18', 'ฝ่ายคลังพยายามอนุมัติสลิป', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-18', 'ฝ่ายคลังพยายามอนุมัติสลิป', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-19 [FR-10] คำสั่งซื้อเลยเวลาโอน pg_cron ยกเลิกและคืนสต็อก
-- คาดว่า: ยกเลิก 1 รายการ สถานะ cancelled สต็อกคืน 20 มี stock_logs reason cancel
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),4)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$update orders set payment_due_at = now() - interval '1 minute' where id=public._t_last_order()$q$;
    execute $q$select public.cancel_expired_orders()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('1') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '1'; end if;
    got := got || v;
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('cancelled') then raise exception 'ขั้นที่ 7: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'cancelled'; end if;
    got := got || v;
    execute $q$select stock_qty from public.product_variants where sku='HPB-BATH-001'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('20') then raise exception 'ขั้นที่ 8: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '20'; end if;
    got := got || v;
    execute $q$select count(*) from stock_logs where reason='cancel' and order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('1') then raise exception 'ขั้นที่ 9: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '1'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-19', 'คำสั่งซื้อเลยเวลาโอน pg_cron ยกเลิกและคืนสต็อก', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-19', 'คำสั่งซื้อเลยเวลาโอน pg_cron ยกเลิกและคืนสต็อก', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-20 [FR-16] ส่งด้วยบริษัทขนส่งโดยไม่ใส่เลขพัสดุ
-- คาดว่า: ถูกปฏิเสธ: ต้องใส่ชื่อขนส่งและเลขพัสดุก่อน
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.ship@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.claim_shipment(public._t_last_order())$q$;
    begin
      execute $q$select public.update_shipment(public._t_last_order(),'in_transit')$q$;
      raise exception 'ขั้นที่ 9: ควรถูกปฏิเสธ (เลขพัสดุ) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('เลขพัสดุ' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-20', 'ส่งด้วยบริษัทขนส่งโดยไม่ใส่เลขพัสดุ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-20', 'ส่งด้วยบริษัทขนส่งโดยไม่ใส่เลขพัสดุ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-21 [FR-16, FR-06] รับงาน ใส่เลขพัสดุ ส่งถึง สถานะคำสั่งซื้อเปลี่ยนตามและมีประวัติ
-- คาดว่า: สถานะ delivered ประวัติครบ 5 ขั้น
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.ship@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.claim_shipment(public._t_last_order())$q$;
    execute $q$select public.update_shipment(public._t_last_order(),'in_transit','Kerry','KR123456789')$q$;
    execute $q$select public.update_shipment(public._t_last_order(),'delivered')$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('delivered') then raise exception 'ขั้นที่ 12: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'delivered'; end if;
    got := got || v;
    execute $q$select string_agg(to_status::text, ' > ' order by id) from order_status_history where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('pending_payment > awaiting_approval > approved > shipping > delivered') then raise exception 'ขั้นที่ 13: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'pending_payment > awaiting_approval > approved > shipping > delivered'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-21', 'รับงาน ใส่เลขพัสดุ ส่งถึง สถานะคำสั่งซื้อเปลี่ยนตามและมีประวัติ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-21', 'รับงาน ใส่เลขพัสดุ ส่งถึง สถานะคำสั่งซื้อเปลี่ยนตามและมีประวัติ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-22 [FR-16, FR-20] พนักงานจัดส่งคนที่ 2 พยายามแก้งานที่คนแรกรับไปแล้ว
-- คาดว่า: คนที่ 2 มองไม่เห็นงาน (0 แถว) และอัปเดตไม่ได้: ต้องรับงานนี้ก่อน
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.ship@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.claim_shipment(public._t_last_order())$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.ship2@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from shipments where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 10: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    begin
      execute $q$select public.update_shipment(public._t_last_order(),'in_transit','Flash','FL1')$q$;
      raise exception 'ขั้นที่ 11: ควรถูกปฏิเสธ (ต้องรับงานนี้ก่อน) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('ต้องรับงานนี้ก่อน' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-22', 'พนักงานจัดส่งคนที่ 2 พยายามแก้งานที่คนแรกรับไปแล้ว', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-22', 'พนักงานจัดส่งคนที่ 2 พยายามแก้งานที่คนแรกรับไปแล้ว', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-23 [FR-11] ขอคืนเงินกรณีชำรุดก่อนได้รับของ
-- คาดว่า: ถูกปฏิเสธ: ขอคืนกรณีชำรุดได้หลังได้รับของแล้ว
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$select public.request_refund(public._t_last_order(),'damaged')$q$;
      raise exception 'ขั้นที่ 8: ควรถูกปฏิเสธ (หลังได้รับของ) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('หลังได้รับของ' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-23', 'ขอคืนเงินกรณีชำรุดก่อนได้รับของ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-23', 'ขอคืนเงินกรณีชำรุดก่อนได้รับของ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-24 [FR-11, FR-14] คืนเงิน 1 ชิ้นกรณีชำรุด บัญชีอนุมัติ คลังตรวจแล้วเข้าสต็อก บัญชีโอนคืน
-- คาดว่า: ยอดคืน 59.00, return_status = restocked, สต็อก 18 → 19, refunds = paid, คำสั่งซื้อยัง delivered เพราะคืนไม่ครบ
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.ship@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.claim_shipment(public._t_last_order())$q$;
    execute $q$select public.update_shipment(public._t_last_order(),'in_transit','Kerry','KR123456789')$q$;
    execute $q$select public.update_shipment(public._t_last_order(),'delivered')$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.request_refund(public._t_last_order(),'damaged', jsonb_build_array(jsonb_build_object('order_item_id',(select id from order_items where order_id=public._t_last_order()),'quantity',1))) is not null$q$;
    execute $q$select amount from refunds where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('59.00') then raise exception 'ขั้นที่ 13: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '59.00'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_refund(public._t_last_refund(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 15: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.check_return((select id from refund_items where refund_id=public._t_last_refund()), true)$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.mark_refund_paid(public._t_last_refund(), public._t_last_order()||'/refund.jpg')$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select stock_qty from public.product_variants where sku='HPB-BATH-001'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('19') then raise exception 'ขั้นที่ 21: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '19'; end if;
    got := got || v;
    execute $q$select ri.return_status from refund_items ri join refunds r on r.id=ri.refund_id where r.order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('restocked') then raise exception 'ขั้นที่ 22: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'restocked'; end if;
    got := got || v;
    execute $q$select status from refunds where order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('paid') then raise exception 'ขั้นที่ 23: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'paid'; end if;
    got := got || v;
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('delivered') then raise exception 'ขั้นที่ 24: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'delivered'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-24', 'คืนเงิน 1 ชิ้นกรณีชำรุด บัญชีอนุมัติ คลังตรวจแล้วเข้าสต็อก บัญชีโอนคืน', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-24', 'คืนเงิน 1 ชิ้นกรณีชำรุด บัญชีอนุมัติ คลังตรวจแล้วเข้าสต็อก บัญชีโอนคืน', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-25 [FR-11] ขอคืนจำนวนเกินที่สั่ง
-- คาดว่า: ถูกปฏิเสธ: จำนวนที่ขอคืนเกินจำนวนที่คืนได้
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.ship@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.claim_shipment(public._t_last_order())$q$;
    execute $q$select public.update_shipment(public._t_last_order(),'in_transit','Kerry','KR123456789')$q$;
    execute $q$select public.update_shipment(public._t_last_order(),'delivered')$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$select public.request_refund(public._t_last_order(),'wrong_item', jsonb_build_array(jsonb_build_object('order_item_id',(select id from order_items where order_id=public._t_last_order()),'quantity',5)))$q$;
      raise exception 'ขั้นที่ 12: ควรถูกปฏิเสธ (เกินจำนวน) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('เกินจำนวน' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-25', 'ขอคืนจำนวนเกินที่สั่ง', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-25', 'ขอคืนจำนวนเกินที่สั่ง', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-26 [FR-11, FR-12] ยกเลิกก่อนส่ง บัญชีอนุมัติแล้วระบบคืนสต็อกทันที
-- คาดว่า: สต็อกคืน 20 คำสั่งซื้อ cancelled return_status = no_return (trigger)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.request_refund(public._t_last_order(),'cancel_before_ship') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_refund(public._t_last_refund(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 10: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true);
    execute $q$select stock_qty from public.product_variants where sku='HPB-BATH-001'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('20') then raise exception 'ขั้นที่ 12: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '20'; end if;
    got := got || v;
    execute $q$select status from orders where id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('cancelled') then raise exception 'ขั้นที่ 13: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'cancelled'; end if;
    got := got || v;
    execute $q$select ri.return_status from refund_items ri join refunds r on r.id=ri.refund_id where r.order_id=public._t_last_order()$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('no_return') then raise exception 'ขั้นที่ 14: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'no_return'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-26', 'ยกเลิกก่อนส่ง บัญชีอนุมัติแล้วระบบคืนสต็อกทันที', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-26', 'ยกเลิกก่อนส่ง บัญชีอนุมัติแล้วระบบคืนสต็อกทันที', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-27 [FR-07] ลูกค้าเปิดแชทและส่งข้อความ ลูกค้าคนอื่นมองไม่เห็น ฝ่ายขายเห็น
-- คาดว่า: ลูกค้า B เห็น 0 ฝ่ายขายเห็น 1
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into conversations(customer_id) values (public.me())$q$;
    execute $q$insert into messages(conversation_id,sender_type,sender_id,body) select id,'customer',public.me(),'มีสีขาวไหมคะ' from conversations$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custb@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from messages$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 5: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.cs@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from messages m join conversations c on c.id=m.conversation_id where c.customer_id='e7e70000-7e57-4000-8000-0000000000c1'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('1') then raise exception 'ขั้นที่ 7: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '1'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-27', 'ลูกค้าเปิดแชทและส่งข้อความ ลูกค้าคนอื่นมองไม่เห็น ฝ่ายขายเห็น', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-27', 'ลูกค้าเปิดแชทและส่งข้อความ ลูกค้าคนอื่นมองไม่เห็น ฝ่ายขายเห็น', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-28 [FR-07, FR-08] ลูกค้าพยายามเปลี่ยนสถานะห้องแชทเอง
-- คาดว่า: แก้ได้ 0 แถว (RLS ให้เฉพาะฝ่ายขาย)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into conversations(customer_id) values (public.me())$q$;
    execute $q$with u as (update conversations set status='closed' returning 1) select count(*) from u$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-28', 'ลูกค้าพยายามเปลี่ยนสถานะห้องแชทเอง', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-28', 'ลูกค้าพยายามเปลี่ยนสถานะห้องแชทเอง', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-29 [FR-08] ฝ่ายขายรับเรื่อง ตอบ และปิดเรื่อง
-- คาดว่า: สถานะ closed และลูกค้าส่งข้อความในห้องที่ปิดแล้วไม่ได้
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into conversations(customer_id) values (public.me())$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.cs@test.hompb'), true); execute 'set local role authenticated';
    execute $q$update conversations set status='in_progress', staff_id=auth.uid() where customer_id='e7e70000-7e57-4000-8000-0000000000c1'$q$;
    execute $q$insert into messages(conversation_id,sender_type,sender_id,body) select id,'staff',auth.uid(),'มีค่ะ' from conversations where customer_id='e7e70000-7e57-4000-8000-0000000000c1'$q$;
    execute $q$update conversations set status='closed', closed_at=now() where customer_id='e7e70000-7e57-4000-8000-0000000000c1'$q$;
    execute $q$select status from conversations where customer_id='e7e70000-7e57-4000-8000-0000000000c1'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('closed') then raise exception 'ขั้นที่ 7: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'closed'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$insert into messages(conversation_id,sender_type,sender_id,body) select id,'customer',public.me(),'ขอบคุณ' from conversations$q$;
      raise exception 'ขั้นที่ 9: ควรถูกปฏิเสธ (row-level security) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('row-level security' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-29', 'ฝ่ายขายรับเรื่อง ตอบ และปิดเรื่อง', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-29', 'ฝ่ายขายรับเรื่อง ตอบ และปิดเรื่อง', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-30 [FR-07] ส่งข้อความว่าง (ไม่มีข้อความและไม่มีรูป)
-- คาดว่า: ถูกปฏิเสธ: CHECK body หรือ image_path
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into conversations(customer_id) values (public.me())$q$;
    begin
      execute $q$insert into messages(conversation_id,sender_type,sender_id) select id,'customer',public.me() from conversations$q$;
      raise exception 'ขั้นที่ 3: ควรถูกปฏิเสธ (messages_check) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('messages_check' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-30', 'ส่งข้อความว่าง (ไม่มีข้อความและไม่มีรูป)', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-30', 'ส่งข้อความว่าง (ไม่มีข้อความและไม่มีรูป)', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-31 [FR-15] ตั้งที่อยู่หลัก 2 ที่
-- คาดว่า: ถูกปฏิเสธ: ที่อยู่หลักได้คนละ 1 ที่
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$insert into addresses(user_id,recipient_name,phone,address_line,subdistrict,district,province,postcode,is_default) values (public.me(),'ก','0','x','x','x','x','10000',true)$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (one_default) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('one_default' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-31', 'ตั้งที่อยู่หลัก 2 ที่', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-31', 'ตั้งที่อยู่หลัก 2 ที่', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-32 [FR-13] ฝ่ายคลังปรับสต็อก ระบบบันทึก stock_logs และ audit_logs
-- คาดว่า: stock_logs +5 adjust และ audit_logs stock.adjust
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    execute $q$update product_variants set stock_qty = stock_qty + 5 where sku='HPB-BATH-001'$q$;
    execute $q$select change_qty||' '||reason from stock_logs order by id desc limit 1$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('5 adjust') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '5 adjust'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.admin@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select action from audit_logs order by id desc limit 1$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('stock.adjust') then raise exception 'ขั้นที่ 5: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'stock.adjust'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-32', 'ฝ่ายคลังปรับสต็อก ระบบบันทึก stock_logs และ audit_logs', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-32', 'ฝ่ายคลังปรับสต็อก ระบบบันทึก stock_logs และ audit_logs', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-33 [FR-13, FR-20] ฝ่ายขายพยายามแก้ราคาสินค้า
-- คาดว่า: แก้ได้ 0 แถว (RLS)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.cs@test.hompb'), true); execute 'set local role authenticated';
    execute $q$with u as (update product_variants set price=1 where sku='HPB-BATH-001' returning 1) select count(*) from u$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 2: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-33', 'ฝ่ายขายพยายามแก้ราคาสินค้า', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-33', 'ฝ่ายขายพยายามแก้ราคาสินค้า', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-34 [FR-13] เพิ่มตัวเลือกสินค้าด้วย SKU ซ้ำ
-- คาดว่า: ถูกปฏิเสธ: UNIQUE sku
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$insert into product_variants(product_id,sku,price) select product_id,'HPB-BATH-001',10 from product_variants where sku='HPB-BATH-001'$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (duplicate key) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('duplicate key' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-34', 'เพิ่มตัวเลือกสินค้าด้วย SKU ซ้ำ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-34', 'เพิ่มตัวเลือกสินค้าด้วย SKU ซ้ำ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-35 [FR-12, FR-13] ตั้งสต็อกติดลบ
-- คาดว่า: ถูกปฏิเสธ: CHECK stock_qty >= 0
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$update product_variants set stock_qty=-1 where sku='HPB-BATH-001'$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (stock_qty_check) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('stock_qty_check' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-35', 'ตั้งสต็อกติดลบ', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-35', 'ตั้งสต็อกติดลบ', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-36 [FR-18] Admin แก้เวลาทำการ ลูกค้าแก้ไม่ได้
-- คาดว่า: Admin แก้ได้และมี audit store.update ลูกค้าแก้ได้ 0 แถว
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.admin@test.hompb'), true); execute 'set local role authenticated';
    execute $q$update store_settings set business_hours='จ.-ส. 09:00-18:00'$q$;
    execute $q$select action from audit_logs order by id desc limit 1$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('store.update') then raise exception 'ขั้นที่ 3: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'store.update'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$with u as (update store_settings set shipping_fee=999 returning 1) select count(*) from u$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 5: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-36', 'Admin แก้เวลาทำการ ลูกค้าแก้ไม่ได้', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-36', 'Admin แก้เวลาทำการ ลูกค้าแก้ไม่ได้', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-37 [FR-19] Admin พยายามลบ audit_logs
-- คาดว่า: ถูกปฏิเสธ: permission denied (log ลบไม่ได้แม้เป็น Admin)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.admin@test.hompb'), true); execute 'set local role authenticated';
    begin
      execute $q$delete from audit_logs$q$;
      raise exception 'ขั้นที่ 2: ควรถูกปฏิเสธ (permission denied) แต่ทำได้' using errcode = 'XT001';
    exception when sqlstate 'XT001' then raise;
      when others then
        if position('permission denied' in sqlerrm) = 0 then raise; end if;
        got := got || ('ERROR: ' || sqlerrm);
    end;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-37', 'Admin พยายามลบ audit_logs', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-37', 'Admin พยายามลบ audit_logs', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-38 [FR-19, FR-20] ฝ่ายคลังเปิดดู audit_logs
-- คาดว่า: เห็น 0 แถว (เฉพาะ Admin)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.stock@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from audit_logs$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 2: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-38', 'ฝ่ายคลังเปิดดู audit_logs', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-38', 'ฝ่ายคลังเปิดดู audit_logs', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-39 [FR-20] ฝ่ายบัญชีไม่เห็นที่อยู่ลูกค้า แต่เห็นคำสั่งซื้อผ่าน view
-- คาดว่า: orders 0 แถว orders_for_staff 1 แถว (ไม่มี shipping_address)
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from orders$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 8: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    execute $q$select count(*) from orders_for_staff where user_id='e7e70000-7e57-4000-8000-0000000000c1'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('1') then raise exception 'ขั้นที่ 9: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '1'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-39', 'ฝ่ายบัญชีไม่เห็นที่อยู่ลูกค้า แต่เห็นคำสั่งซื้อผ่าน view', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-39', 'ฝ่ายบัญชีไม่เห็นที่อยู่ลูกค้า แต่เห็นคำสั่งซื้อผ่าน view', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-40 [FR-06, FR-20] ลูกค้าดูคำสั่งซื้อของคนอื่น
-- คาดว่า: ลูกค้า B เห็น 0 แถว
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custa@test.hompb'), true); execute 'set local role authenticated';
    execute $q$insert into cart_items(user_id,variant_id,quantity) values (public.me(),public._t_v('HPB-BATH-001'),2)$q$;
    execute $q$select public.place_order('e7e70000-7e57-4000-8000-0000000000d1') is not null$q$;
    execute $q$select public.submit_payment(public._t_last_order(), 'e7e70000-7e57-4000-8000-0000000000c1/'||public._t_last_order()||'/slip1.jpg') is not null$q$;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.finance@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select public.review_payment(public._t_last_pay(), true)$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('approved') then raise exception 'ขั้นที่ 6: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), 'approved'; end if;
    got := got || v;
    execute 'reset role'; perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 't.custb@test.hompb'), true); execute 'set local role authenticated';
    execute $q$select count(*) from orders$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 8: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    execute $q$select count(*) from payments$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 9: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-40', 'ลูกค้าดูคำสั่งซื้อของคนอื่น', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-40', 'ลูกค้าดูคำสั่งซื้อของคนอื่น', 'FAIL', sqlerrm);
  end;
end $tc$;

-- TC-41 [NFR-01] SQL injection ในช่องค้นหา (ส่งค่าแบบ parameter)
-- คาดว่า: ได้ 0 แถว ข้อความถูกมองเป็นคำค้นธรรมดา ไม่ใช่คำสั่ง SQL
do $tc$
declare v text; got text[] := '{}';
begin
  begin
    perform pg_temp._t_setup();
    execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); execute 'set local role anon';
    execute $q$select count(*) from products where name ilike '%' || ''' OR ''1''=''1' || '%'$q$ into v;
    if lower(coalesce(v, '(null)')) <> lower('0') then raise exception 'ขั้นที่ 2: ได้ % แต่ควรได้ %', coalesce(v, '(null)'), '0'; end if;
    got := got || v;
    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกทุกอย่างของเคสนี้
  exception
    when sqlstate 'XT000' then insert into _tc_result (id, title, result, detail) values ('TC-41', 'SQL injection ในช่องค้นหา (ส่งค่าแบบ parameter)', 'PASS', array_to_string(got, ' | '));
    when others then insert into _tc_result (id, title, result, detail) values ('TC-41', 'SQL injection ในช่องค้นหา (ส่งค่าแบบ parameter)', 'FAIL', sqlerrm);
  end;
end $tc$;

-- ผลการทดสอบ: แถวแรกคือสรุป ตามด้วยเคสที่ FAIL (ถ้ามี) แล้วจึงเป็นเคสที่ PASS
select id, result, title, detail from (
  select 'สรุป' as id, (count(*) filter (where result = 'PASS'))::text || ' / ' || count(*) as result, 'ผ่าน / ทั้งหมด' as title, '' as detail, 0 as grp, 0 as seq from _tc_result
  union all
  select id, result, title, detail, case when result = 'PASS' then 2 else 1 end, seq from _tc_result
) r
order by grp, seq;
