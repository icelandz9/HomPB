-- แท็บ B: ลูกค้า B สั่งเตียงชิ้นเดียวกัน กด Run ภายใน 20 วินาทีหลังแท็บ A
-- ผลที่ควรเห็น: B ต้องรอจน A จบ (FOR UPDATE ล็อกแถวสินค้า) แล้วได้ "มีไม่พอ" ไม่มีการขายเกินสต็อก
-- ข้อมูลของ B ถูกยกเลิกเองตอนจบ (ไม่ค้าง)
create temp table if not exists _race_b (waited_sec numeric, result text, stock_after int);
truncate _race_b;
do $b$
declare t0 timestamptz; w numeric; r text;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
      values ('e7e70000-7e57-4000-8000-0000000000b2', 't.raceb2@test.hompb', '{"full_name":"ลูกค้า B"}');
    insert into public.addresses (id, user_id, recipient_name, phone, address_line, subdistrict, district, province, postcode, is_default)
      values ('e7e70000-7e57-4000-8000-0000000001b2', 'e7e70000-7e57-4000-8000-0000000000b2', 'ลูกค้า B', '0800000000', '1 ถ.ทดสอบ', 'ต', 'อ', 'กรุงเทพมหานคร', '10110', true);
    t0 := clock_timestamp();  -- เริ่มจับเวลาตั้งแต่ลูกค้า B แตะสินค้าชิ้นเดียวกัน (ใส่ตะกร้า แล้วสั่งซื้อ)
    perform set_config('request.jwt.claim.sub', 'e7e70000-7e57-4000-8000-0000000000b2', true);
    execute 'set local role authenticated';
    insert into public.cart_items (user_id, variant_id, quantity)
      select public.me(), v.id, 1 from public.variants_public v
      join public.products p on p.id = v.product_id where p.name = 'เตียงนอนพร้อมที่นอน';
    begin
      perform public.place_order('e7e70000-7e57-4000-8000-0000000001b2');
      r := 'สั่งซื้อสำเร็จ';
    exception when others then r := 'ERROR: ' || sqlerrm;
    end;
    w := round(extract(epoch from clock_timestamp() - t0)::numeric, 1);
    raise exception 'done' using errcode = 'XT000';
  exception when sqlstate 'XT000' then null;
  end;
  insert into _race_b select w, r, (select stock_qty from public.product_variants where sku = 'HPB-BED-003');
end $b$;
select waited_sec as "B รอ (วินาที)", result as "ผลของ B", stock_after as "สต็อกหลังทดสอบ" from _race_b;
