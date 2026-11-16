-- =====================================================================
-- HomPB: เทียบ EXPLAIN ANALYZE ก่อน–หลังสร้าง index (Demo Checklist ข้อ 6 / A-3 ระดับ 5)
-- query ที่ใช้จริง: cancel_expired_orders() ที่ pg_cron เรียกทุก 5 นาที
--   select id from orders where status = 'pending_payment' and payment_due_at < now()
-- index ที่ใช้: orders_pending_due_idx (partial index เฉพาะคำสั่งซื้อที่รอชำระ เรียงตาม payment_due_at)
-- สคริปต์ลบ index นี้ชั่วคราวเพื่อวัดผล "ก่อน" แล้วสร้างใหม่เพื่อวัดผล "หลัง" ทั้งหมดถูกยกเลิกตอนจบ index เดิมยังอยู่
--
-- รันทั้งไฟล์ใน Supabase SQL Editor ได้เลย สร้างคำสั่งซื้อจำลอง 200,000 แถว แล้วยกเลิกทั้งหมดตอนจบ
-- (ข้อมูลจำลองและ index ไม่ค้างในฐานข้อมูล) ใช้เวลาประมาณ 10–30 วินาที
-- =====================================================================
create temp table if not exists _explain_result (seq int, step text, plan text, exec_ms numeric, buffers int);
truncate _explain_result;

do $demo$
declare
  v_user uuid := gen_random_uuid();
  j jsonb;
  q text := $q$select id from public.orders where status = 'pending_payment' and payment_due_at < now()$q$;
  p1 text; p2 text; t1 numeric; t2 numeric; b1 int; b2 int; n text;
begin
  begin
    -- ลูกค้าจำลอง 1 คน
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_user, 'bulk.' || v_user || '@test.hompb', '{"full_name":"ข้อมูลจำลอง"}');

    -- คำสั่งซื้อจำลอง 200,000 แถว: รอชำระ 40% ที่เหลือสถานะอื่น
    -- เวลาโอนกระจายไป 30 วันข้างหน้า มีที่เลยกำหนดแล้วประมาณ 1%
    insert into public.orders (user_id, status, shipping_address, subtotal, total_amount, payment_due_at, created_at)
    select v_user,
           (case when g % 10 < 4 then 'pending_payment' when g % 10 < 6 then 'approved'
                 when g % 10 < 9 then 'delivered' else 'cancelled' end)::public.order_status,
           '{}'::jsonb, 500, 500,
           now() + (case when g % 100 = 0 then -interval '1 hour' else interval '1 hour' end) * (1 + g % 720),
           now() - interval '1 day' * (g % 365)
    from generate_series(1, 200000) g;
    drop index if exists public.orders_pending_due_idx;
    analyze public.orders;

    -- ก่อน: มีแค่ index orders(status)
    execute 'explain (analyze, buffers, format json) ' || q into j;
    p1 := (j->0->'Plan'->>'Node Type') || coalesce(' on ' || (j->0->'Plan'->>'Index Name'), '') ||
      coalesce(' > ' || (j->0->'Plan'->'Plans'->0->>'Node Type') || coalesce(' on ' || (j->0->'Plan'->'Plans'->0->>'Index Name'), ''), '');
    t1 := round((j->0->>'Execution Time')::numeric, 2);
    b1 := (j->0->'Plan'->>'Shared Hit Blocks')::int + (j->0->'Plan'->>'Shared Read Blocks')::int;

    -- หลัง: partial index เฉพาะคำสั่งซื้อที่รอชำระ
    create index orders_pending_due_idx on public.orders (payment_due_at) where status = 'pending_payment';
    analyze public.orders;
    execute 'explain (analyze, buffers, format json) ' || q into j;
    p2 := (j->0->'Plan'->>'Node Type') || coalesce(' on ' || (j->0->'Plan'->>'Index Name'), '') ||
      coalesce(' > ' || (j->0->'Plan'->'Plans'->0->>'Node Type') || coalesce(' on ' || (j->0->'Plan'->'Plans'->0->>'Index Name'), ''), '');
    t2 := round((j->0->>'Execution Time')::numeric, 2);
    b2 := (j->0->'Plan'->>'Shared Hit Blocks')::int + (j->0->'Plan'->>'Shared Read Blocks')::int;

    select count(*)::text || ' จาก 200,000 แถวจำลอง' into n
    from public.orders where user_id = v_user and status = 'pending_payment' and payment_due_at < now();

    raise exception 'done' using errcode = 'XT000';  -- ยกเลิกข้อมูลจำลองและ index
  exception when sqlstate 'XT000' then null;
  end;
  insert into _explain_result values
    (1, 'ก่อนสร้าง index', p1, t1, b1),
    (2, 'หลังสร้าง index', p2, t2, b2),
    (3, 'แถวที่ตรงเงื่อนไข', n, null, null);
end $demo$;

select step as "ขั้น", plan as "plan ที่ PostgreSQL เลือก", exec_ms as "เวลา (ms)", buffers as "blocks ที่อ่าน"
from _explain_result order by seq;

-- index นี้อยู่ใน backend/schema.sql แล้ว สคริปต์จึงลบออกก่อนวัดผลแบบ "ก่อน" (ภายใน transaction ที่ถูกยกเลิก)
