-- HomPB 03: ฟังก์ชันธุรกิจ (RPC) รันต่อจาก security.sql
-- หน้าเว็บเรียกด้วย supabase.rpc('ชื่อฟังก์ชัน', { พารามิเตอร์ })
-- ทุกฟังก์ชันอ่าน auth.uid() เอง ไม่รับ id ผู้ใช้ ราคา หรือยอดเงินจากหน้าเว็บ (Security Design ข้อ 5, 8)

-- INTERNAL -----------------------------------------------------------

-- ยกเลิกคำสั่งซื้อและคืนสต็อก (ใช้ภายใน: หมดเวลาโอน, สลิปไม่ผ่านครั้งที่ 2)
create function public._cancel_order(p_order uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'cancelled', updated_at = now()
  where id = p_order and status in ('pending_payment', 'awaiting_approval');
  if not found then return false; end if;

  perform set_config('hompb.system_stock', 'on', true);
  update public.product_variants v set stock_qty = v.stock_qty + oi.quantity
  from public.order_items oi
  where oi.order_id = p_order and oi.variant_id = v.id;
  insert into public.stock_logs (variant_id, change_qty, reason, order_id, actor_id)
  select oi.variant_id, oi.quantity, 'cancel', p_order, auth.uid()
  from public.order_items oi
  where oi.order_id = p_order and oi.variant_id is not null;
  perform set_config('hompb.system_stock', 'off', true);
  return true;
end;
$$;

-- เช็ก role แล้วโยน error ถ้าไม่ผ่าน
create function public._require_role(variadic roles public.app_role[])
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(variadic roles) then
    raise exception 'ไม่มีสิทธิ์ทำรายการนี้' using errcode = '42501';
  end if;
end;
$$;


-- 1. สั่งซื้อ (ลูกค้า) ------------------------------------------------
-- อ่านของจากตะกร้าของคนที่ล็อกอิน ล็อกแถวสินค้า ตัดสต็อกแบบ atomic
-- ถ้าชิ้นไหนไม่พอ ยกเลิกทั้งชุด (Security Design ข้อ 5, 6 / NFR-06 / BR7)
create function public.place_order(p_address_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := public.me();
  v_addr     public.addresses;
  v_store    public.store_settings;
  v_order    uuid;
  v_subtotal numeric(10,2) := 0;
  r          record;
begin
  perform public._require_role('customer');

  select * into v_addr from public.addresses where id = p_address_id and user_id = v_uid;
  if not found then raise exception 'ไม่พบที่อยู่จัดส่ง'; end if;

  if not exists (select 1 from public.cart_items where user_id = v_uid) then
    raise exception 'ตะกร้าว่าง';
  end if;

  select * into v_store from public.store_settings limit 1;
  perform set_config('hompb.system_stock', 'on', true);

  -- เรียงตาม variant_id กัน deadlock เมื่อหลายคนสั่งพร้อมกัน
  for r in
    select c.variant_id, c.quantity, v.price, v.name as variant_name, p.name as product_name,
           v.is_active and p.is_active as on_sale
    from public.cart_items c
    join public.product_variants v on v.id = c.variant_id
    join public.products p on p.id = v.product_id
    where c.user_id = v_uid
    order by c.variant_id
    for update of v
  loop
    if not r.on_sale then
      raise exception 'สินค้า % (%) ปิดการขายแล้ว', r.product_name, r.variant_name;
    end if;
    update public.product_variants set stock_qty = stock_qty - r.quantity
    where id = r.variant_id and stock_qty >= r.quantity;
    if not found then
      raise exception 'สินค้า % (%) มีไม่พอ', r.product_name, r.variant_name using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + r.price * r.quantity;
  end loop;

  insert into public.orders (user_id, shipping_address, subtotal, shipping_fee, total_amount, payment_due_at)
  values (
    v_uid,
    jsonb_build_object(
      'recipient_name', v_addr.recipient_name, 'phone', v_addr.phone,
      'address_line', v_addr.address_line, 'subdistrict', v_addr.subdistrict,
      'district', v_addr.district, 'province', v_addr.province, 'postcode', v_addr.postcode),
    v_subtotal, v_store.shipping_fee, v_subtotal + v_store.shipping_fee,
    now() + make_interval(hours => v_store.payment_window_hours))
  returning id into v_order;

  insert into public.order_items (order_id, variant_id, product_name, variant_name, unit_price, quantity)
  select v_order, c.variant_id, p.name, v.name, v.price, c.quantity
  from public.cart_items c
  join public.product_variants v on v.id = c.variant_id
  join public.products p on p.id = v.product_id
  where c.user_id = v_uid;

  insert into public.stock_logs (variant_id, change_qty, reason, order_id, actor_id)
  select c.variant_id, -c.quantity, 'order', v_order, v_uid
  from public.cart_items c where c.user_id = v_uid;

  delete from public.cart_items where user_id = v_uid;
  perform set_config('hompb.system_stock', 'off', true);
  return v_order;
end;
$$;


-- 2. แนบสลิป (ลูกค้า) -------------------------------------------------
-- อัปโหลดไฟล์ไป bucket slips ที่ path {user_id}/{order_id}/ชื่อไฟล์ ก่อน แล้วค่อยเรียกฟังก์ชันนี้
-- อัปโหลดได้ 2 ครั้ง (ครั้งที่ 2 เมื่อครั้งแรกไม่ผ่าน) ยอดเงินใช้ total_amount ของคำสั่งซื้อ
create function public.submit_payment(p_order_id uuid, p_slip_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := public.me();
  v_order   public.orders;
  v_attempt smallint;
  v_payment uuid;
begin
  perform public._require_role('customer');

  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if not found then raise exception 'ไม่พบคำสั่งซื้อ'; end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'คำสั่งซื้อนี้ไม่ได้รอชำระเงิน (สถานะ %)', v_order.status;
  end if;
  if v_order.payment_due_at is not null and v_order.payment_due_at < now() then
    raise exception 'เลยเวลาชำระเงินแล้ว';
  end if;
  if split_part(p_slip_path, '/', 1) <> v_uid::text
     or split_part(p_slip_path, '/', 2) <> p_order_id::text
     or split_part(p_slip_path, '/', 3) = '' then
    raise exception 'path ของสลิปต้องเป็น {user_id}/{order_id}/ชื่อไฟล์';
  end if;

  select coalesce(max(attempt_no), 0) + 1 into v_attempt
  from public.payments where order_id = p_order_id;
  if v_attempt > 2 then raise exception 'อัปโหลดสลิปครบ 2 ครั้งแล้ว'; end if;

  insert into public.payments (order_id, attempt_no, amount, slip_path)
  values (p_order_id, v_attempt, v_order.total_amount, p_slip_path)
  returning id into v_payment;

  update public.orders set status = 'awaiting_approval', updated_at = now() where id = p_order_id;
  return v_payment;
end;
$$;


-- 3. ตรวจสลิป (ฝ่ายบัญชี, Admin) ---------------------------------------
-- อนุมัติ: คำสั่งซื้อเป็น approved และสร้างงานจัดส่ง (ถ้ามีสินค้าชิ้นไหนส่งรถร้าน ใช้รถร้านทั้งคำสั่งซื้อ)
-- ไม่อนุมัติครั้งที่ 1: กลับไปรอชำระ เลื่อนกำหนดโอนเป็น ตอนนี้ + reupload_window_hours
-- ไม่อนุมัติครั้งที่ 2: ยกเลิกคำสั่งซื้อและคืนสต็อก
create function public.review_payment(p_payment_id uuid, p_approve boolean, p_reject_reason text default null)
returns public.order_status language plpgsql security definer set search_path = '' as $$
declare
  v_pay   public.payments;
  v_order public.orders;
  v_hours integer;
begin
  perform public._require_role('accounting', 'admin');

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'ไม่พบสลิป'; end if;
  select * into v_order from public.orders where id = v_pay.order_id for update;
  if v_pay.status <> 'pending' or v_order.status <> 'awaiting_approval' then
    raise exception 'สลิปนี้ตรวจไปแล้ว';
  end if;

  if p_approve then
    update public.payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_payment_id;
    update public.orders set status = 'approved', updated_at = now() where id = v_order.id;
    insert into public.shipments (order_id, method)
    select v_order.id,
           case when bool_or(p.delivery_method = 'store_truck') then 'store_truck'::public.delivery_method
                else 'carrier'::public.delivery_method end
    from public.order_items oi
    join public.product_variants v on v.id = oi.variant_id
    join public.products p on p.id = v.product_id
    where oi.order_id = v_order.id
    on conflict (order_id) do nothing;
    return 'approved';
  end if;

  if coalesce(trim(p_reject_reason), '') = '' then
    raise exception 'ต้องใส่เหตุผลที่ไม่อนุมัติ';
  end if;
  update public.payments
  set status = 'rejected', reject_reason = p_reject_reason, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_payment_id;

  if v_pay.attempt_no = 1 then
    select reupload_window_hours into v_hours from public.store_settings limit 1;
    update public.orders
    set status = 'pending_payment', payment_due_at = now() + make_interval(hours => v_hours), updated_at = now()
    where id = v_order.id;
    return 'pending_payment';
  end if;

  perform public._cancel_order(v_order.id);
  return 'cancelled';
end;
$$;


-- 4. ยกเลิกอัตโนมัติ (pg_cron เรียกทุก 5 นาที) ----------------------------
-- คำสั่งซื้อที่รอชำระและเลยกำหนดโอน ยกเลิกและคืนสต็อก (Security Design ข้อ 7 / FR-10)
-- คำสั่งซื้อที่รอตรวจสลิป (awaiting_approval) ไม่ถูกยกเลิก เพราะลูกค้าโอนแล้ว
create function public.cancel_expired_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_id    uuid;
begin
  for v_id in
    select id from public.orders
    where status = 'pending_payment' and payment_due_at < now()
    for update skip locked
  loop
    if public._cancel_order(v_id) then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;


-- 5. ขอคืนเงิน (ลูกค้า) ------------------------------------------------
-- p_items = [{"order_item_id": "...", "quantity": 1}, ...] ส่ง null = คืนทุกชิ้นที่เหลือ
-- ยกเลิกก่อนส่ง: คำสั่งซื้อต้องอนุมัติแล้วและยังไม่ออกจากร้าน
-- ชำรุด / ส่งผิด: คำสั่งซื้อต้องส่งถึงแล้ว
-- TODO: รอลูกค้ากำหนดว่าขอคืนได้ภายในกี่วันหลังได้รับของ
create function public.request_refund(
  p_order_id uuid, p_reason public.refund_reason, p_items jsonb default null, p_detail text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := public.me();
  v_order  public.orders;
  v_refund uuid;
  v_total  numeric(10,2) := 0;
  r        record;
begin
  perform public._require_role('customer');

  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if not found then raise exception 'ไม่พบคำสั่งซื้อ'; end if;

  if p_reason = 'cancel_before_ship' then
    if v_order.status <> 'approved' or exists (
         select 1 from public.shipments where order_id = p_order_id and status <> 'preparing') then
      raise exception 'ยกเลิกก่อนส่งได้เฉพาะคำสั่งซื้อที่ชำระแล้วและยังไม่ออกจากร้าน';
    end if;
  elsif v_order.status <> 'delivered' then
    raise exception 'ขอคืนเงินกรณีสินค้าชำรุดหรือส่งผิดได้หลังได้รับของแล้ว';
  end if;

  insert into public.refunds (order_id, amount, reason, detail)
  values (p_order_id, 0.01, p_reason, p_detail)   -- ใส่ยอดจริงหลังรวมรายการด้านล่าง
  returning id into v_refund;

  -- จำนวนที่ขอคืนได้ = จำนวนที่สั่ง - จำนวนในคำขอคืนเงินอื่นที่ยังไม่ถูกปฏิเสธ
  for r in
    with wanted as (
      select (e->>'order_item_id')::uuid as order_item_id, (e->>'quantity')::integer as quantity
      from jsonb_array_elements(p_items) e
      where p_items is not null
    ),
    remaining as (
      select oi.id, oi.unit_price,
             oi.quantity - coalesce((
               select sum(ri.quantity) from public.refund_items ri
               join public.refunds rf on rf.id = ri.refund_id
               where ri.order_item_id = oi.id and rf.status <> 'rejected' and rf.id <> v_refund), 0) as left_qty
      from public.order_items oi
      where oi.order_id = p_order_id
    )
    select m.id, m.unit_price, m.left_qty,
           case when p_items is null then m.left_qty else w.quantity end as qty
    from remaining m
    left join wanted w on w.order_item_id = m.id
    where p_items is null or w.order_item_id is not null
  loop
    if r.qty is null or r.qty <= 0 then continue; end if;
    if r.qty > r.left_qty then
      raise exception 'จำนวนที่ขอคืนเกินจำนวนที่คืนได้ (เหลือ % ชิ้น)', r.left_qty;
    end if;
    insert into public.refund_items (refund_id, order_item_id, quantity, amount)
    values (v_refund, r.id, r.qty, r.unit_price * r.qty);
    v_total := v_total + r.unit_price * r.qty;
  end loop;

  if p_items is not null and jsonb_array_length(p_items) <> (
       select count(*) from public.refund_items where refund_id = v_refund) then
    raise exception 'มีรายการที่ไม่อยู่ในคำสั่งซื้อนี้ หรือจำนวนไม่ถูกต้อง';
  end if;
  if v_total <= 0 then raise exception 'ไม่มีรายการที่ขอคืนได้'; end if;

  update public.refunds set amount = v_total where id = v_refund;
  return v_refund;
end;
$$;


-- 6. อนุมัติคืนเงิน (ฝ่ายบัญชี, Admin) ------------------------------------
-- ยกเลิกก่อนส่ง: อนุมัติแล้วคืนสต็อกทันที ถ้ายกเลิกครบทุกชิ้น คำสั่งซื้อเป็น cancelled
-- ชำรุด / ส่งผิด: ของต้องให้คลังตรวจก่อน (check_return) ไม่คืนสต็อกตรงนี้
create function public.review_refund(p_refund_id uuid, p_approve boolean, p_note text default null)
returns public.refund_status language plpgsql security definer set search_path = '' as $$
declare
  v_refund public.refunds;
begin
  perform public._require_role('accounting', 'admin');

  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'ไม่พบคำขอคืนเงิน'; end if;
  if v_refund.status <> 'requested' then raise exception 'คำขอนี้พิจารณาไปแล้ว'; end if;

  if not p_approve then
    if coalesce(trim(p_note), '') = '' then raise exception 'ต้องใส่เหตุผลที่ไม่อนุมัติ'; end if;
    update public.refunds set status = 'rejected', approved_by = auth.uid(), approved_at = now(),
      detail = concat_ws(E'\n', detail, 'ไม่อนุมัติ: ' || p_note)
    where id = p_refund_id;
    return 'rejected';
  end if;

  update public.refunds set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_refund_id;

  if v_refund.reason = 'cancel_before_ship' then
    -- ของอาจออกจากร้านไปแล้วระหว่างรออนุมัติ ล็อกงานจัดส่งไว้แล้วเช็กอีกรอบ
    -- (ล็อก shipments ก่อน orders ลำดับเดียวกับ update_shipment กัน deadlock)
    perform 1 from public.shipments where order_id = v_refund.order_id for update;
    if exists (select 1 from public.shipments where order_id = v_refund.order_id and status <> 'preparing')
       or (select status from public.orders where id = v_refund.order_id for update) <> 'approved' then
      raise exception 'สินค้าออกจากร้านแล้ว อนุมัติยกเลิกก่อนส่งไม่ได้';
    end if;

    perform set_config('hompb.system_stock', 'on', true);
    update public.product_variants v set stock_qty = v.stock_qty + ri.quantity
    from public.refund_items ri join public.order_items oi on oi.id = ri.order_item_id
    where ri.refund_id = p_refund_id and oi.variant_id = v.id;
    insert into public.stock_logs (variant_id, change_qty, reason, order_id, actor_id)
    select oi.variant_id, ri.quantity, 'cancel', v_refund.order_id, auth.uid()
    from public.refund_items ri join public.order_items oi on oi.id = ri.order_item_id
    where ri.refund_id = p_refund_id and oi.variant_id is not null;
    perform set_config('hompb.system_stock', 'off', true);

    -- ยกเลิกครบทุกชิ้นแล้ว คำสั่งซื้อเป็น cancelled
    if not exists (
      select 1 from public.order_items oi
      where oi.order_id = v_refund.order_id
        and oi.quantity > coalesce((
          select sum(ri.quantity) from public.refund_items ri
          join public.refunds rf on rf.id = ri.refund_id
          where ri.order_item_id = oi.id and rf.reason = 'cancel_before_ship'
            and rf.status in ('approved', 'paid')), 0)) then
      update public.orders set status = 'cancelled', updated_at = now() where id = v_refund.order_id;
    end if;
  end if;
  return 'approved';
end;
$$;

-- 7. บันทึกโอนคืนแล้ว (ฝ่ายบัญชี, Admin) ---------------------------------
-- อัปโหลดหลักฐานไป bucket refund-slips ที่ path {order_id}/ชื่อไฟล์ ก่อน
create function public.mark_refund_paid(p_refund_id uuid, p_slip_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_refund public.refunds;
begin
  perform public._require_role('accounting', 'admin');

  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'ไม่พบคำขอคืนเงิน'; end if;
  if v_refund.status <> 'approved' then raise exception 'ต้องอนุมัติก่อนบันทึกการโอนคืน'; end if;
  if split_part(p_slip_path, '/', 1) <> v_refund.order_id::text or split_part(p_slip_path, '/', 2) = '' then
    raise exception 'path ของหลักฐานต้องเป็น {order_id}/ชื่อไฟล์';
  end if;

  update public.refunds set status = 'paid', slip_path = p_slip_path where id = p_refund_id;
end;
$$;


-- 8. ตรวจของคืน (ฝ่ายคลัง, Admin) ---------------------------------------
-- restocked = เข้าสต็อก (บันทึก stock_logs เหตุผล return), not_restocked = ใช้ไม่ได้
create function public.check_return(p_refund_item_id uuid, p_restock boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item    public.refund_items;
  v_status  public.refund_status;
  v_order   uuid;
  v_variant uuid;
begin
  perform public._require_role('warehouse', 'admin');

  select * into v_item from public.refund_items where id = p_refund_item_id for update;
  if not found then raise exception 'ไม่พบรายการคืนของ'; end if;
  select r.status, r.order_id into v_status, v_order from public.refunds r where r.id = v_item.refund_id;
  if v_status not in ('approved', 'paid') then raise exception 'คำขอคืนเงินยังไม่อนุมัติ'; end if;
  if v_item.return_status <> 'pending_check' then raise exception 'รายการนี้ตรวจไปแล้ว'; end if;

  update public.refund_items
  set return_status = case when p_restock then 'restocked'::public.return_status
                           else 'not_restocked'::public.return_status end,
      checked_by = auth.uid(), checked_at = now()
  where id = p_refund_item_id;

  if p_restock then
    select variant_id into v_variant from public.order_items where id = v_item.order_item_id;
    if v_variant is not null then
      perform set_config('hompb.system_stock', 'on', true);
      update public.product_variants set stock_qty = stock_qty + v_item.quantity where id = v_variant;
      insert into public.stock_logs (variant_id, change_qty, reason, order_id, actor_id)
      values (v_variant, v_item.quantity, 'return', v_order, auth.uid());
      perform set_config('hompb.system_stock', 'off', true);
    end if;
  end if;
end;
$$;


-- 9. จัดส่ง (ฝ่ายจัดส่ง, Admin) -----------------------------------------
-- รับงานที่ยังไม่มีคนรับ
create function public.claim_shipment(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_role('shipping', 'admin');
  update public.shipments set handled_by = auth.uid()
  where order_id = p_order_id and handled_by is null;
  if not found then raise exception 'งานนี้มีคนรับแล้ว หรือไม่พบงาน'; end if;
end;
$$;

-- อัปเดตสถานะ: preparing → in_transit → delivered (หรือ failed)
-- ส่งด้วยบริษัทขนส่งต้องใส่ carrier และ tracking_no ก่อนออกจากร้าน
create function public.update_shipment(
  p_order_id uuid, p_status public.shipment_status, p_carrier text default null, p_tracking_no text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ship  public.shipments;
  v_order public.order_status;
begin
  perform public._require_role('shipping', 'admin');

  select * into v_ship from public.shipments where order_id = p_order_id for update;
  if not found then raise exception 'ไม่พบงานจัดส่ง'; end if;
  if public.has_role('shipping') and v_ship.handled_by is distinct from auth.uid() then
    raise exception 'ต้องรับงานนี้ก่อน (claim_shipment)';
  end if;
  select status into v_order from public.orders where id = p_order_id for update;
  if v_order not in ('approved', 'shipping') then
    raise exception 'คำสั่งซื้อนี้จัดส่งไม่ได้ (สถานะ %)', v_order;
  end if;

  if not (
       (v_ship.status = 'preparing'  and p_status in ('preparing', 'in_transit'))
    or (v_ship.status = 'in_transit' and p_status in ('delivered', 'failed'))
    or (v_ship.status = 'failed'     and p_status = 'in_transit')) then
    raise exception 'เปลี่ยนสถานะจาก % เป็น % ไม่ได้', v_ship.status, p_status;
  end if;
  if p_status = 'in_transit' and v_ship.method = 'carrier'
     and (coalesce(trim(coalesce(p_carrier, v_ship.carrier)), '') = ''
       or coalesce(trim(coalesce(p_tracking_no, v_ship.tracking_no)), '') = '') then
    raise exception 'ส่งด้วยบริษัทขนส่งต้องใส่ชื่อขนส่งและเลขพัสดุก่อน';
  end if;

  update public.shipments set
    status       = p_status,
    carrier      = coalesce(p_carrier, carrier),
    tracking_no  = coalesce(p_tracking_no, tracking_no),
    handled_by   = coalesce(handled_by, auth.uid()),
    shipped_at   = case when p_status = 'in_transit' then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where order_id = p_order_id;

  if p_status = 'in_transit' and v_order = 'approved' then
    update public.orders set status = 'shipping', updated_at = now() where id = p_order_id;
  elsif p_status = 'delivered' then
    update public.orders set status = 'delivered', updated_at = now() where id = p_order_id;
  end if;
end;
$$;


-- FUNCTION GRANTS ----------------------------------------------------
-- Supabase ให้ anon/authenticated เรียกทุกฟังก์ชันได้เป็นค่าเริ่มต้น ถอนออกทั้งหมดก่อน
-- แล้วเปิดเฉพาะที่หน้าเว็บต้องใช้

revoke execute on all functions in schema public from public, anon, authenticated;

-- ฟังก์ชันที่ policy และ view เรียก ต้องให้ทุกคนเรียกได้
grant execute on function
  public.current_user_role(), public.me(), public.has_role(public.app_role[]),
  public.is_my_shipping_job(uuid), public.owns_order(uuid), public.can_view_profile(uuid)
to anon, authenticated;

-- ฟังก์ชัน trigger ไม่ต้อง grant: PostgreSQL เช็กสิทธิ์ execute ตอน create trigger เท่านั้น ไม่เช็กตอน trigger ทำงาน

-- RPC ที่หน้าเว็บเรียก (ข้างในเช็ก role เอง)
grant execute on function
  public.place_order(uuid),
  public.submit_payment(uuid, text),
  public.review_payment(uuid, boolean, text),
  public.request_refund(uuid, public.refund_reason, jsonb, text),
  public.review_refund(uuid, boolean, text),
  public.mark_refund_paid(uuid, text),
  public.check_return(uuid, boolean),
  public.claim_shipment(uuid),
  public.update_shipment(uuid, public.shipment_status, text, text)
to authenticated;

-- cancel_expired_orders, _cancel_order, write_audit: ไม่เปิดให้หน้าเว็บ (pg_cron รันด้วย postgres)
grant execute on all functions in schema public to service_role;