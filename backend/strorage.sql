-- HomPB 04: Storage, pg_cron, Realtime (รันใน Supabase เท่านั้น)
-- ก่อนรัน: Dashboard > Database > Extensions เปิด pg_cron

-- BUCKETS (Security Design ข้อ 10) ----------------------------------
-- slips          private  สลิปลูกค้า      path: {user_id}/{order_id}/ชื่อไฟล์
-- refund-slips   private  หลักฐานโอนคืน   path: {order_id}/ชื่อไฟล์
-- chat-images    private  รูปในแชท        path: {conversation_id}/ชื่อไฟล์
-- store          private  QR พร้อมเพย์     path: ชื่อไฟล์ (ผู้ใช้ที่ล็อกอินเห็น)
-- product-images public   รูปสินค้า        path: {product_id}/ชื่อไฟล์

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('slips',          'slips',          false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('refund-slips',   'refund-slips',   false, 5242880, array['image/jpeg', 'image/png', 'application/pdf']),
  ('chat-images',    'chat-images',    false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('store',          'store',          false, 2097152, array['image/jpeg', 'image/png']),
  ('product-images', 'product-images', true,  5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- path เทียบเป็น text (o.id::text = ...) ไม่ cast เป็น ::uuid เพราะถ้าโฟลเดอร์ไม่ใช่ uuid จะ error แทนที่จะแค่ไม่ผ่าน

-- slips: ลูกค้าอัปโหลดและอ่านเฉพาะโฟลเดอร์ตัวเอง บัญชีและ Admin อ่านได้ ไม่มีใครลบหรือแก้
-- อัปโหลดได้เฉพาะคำสั่งซื้อที่รอชำระ (เงื่อนไขเดียวกับ submit_payment)
create policy slips_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'slips' and public.has_role('customer')
              and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from public.orders o
                          where o.id::text = (storage.foldername(name))[2]
                            and o.user_id = public.me()
                            and o.status = 'pending_payment'));
create policy slips_select on storage.objects for select to authenticated
  using (bucket_id = 'slips'
         and ((storage.foldername(name))[1] = public.me()::text or public.has_role('accounting', 'admin')));

-- refund-slips: บัญชีและ Admin อัปโหลด ลูกค้าเจ้าของคำสั่งซื้ออ่านได้
-- อัปโหลดได้เฉพาะคำสั่งซื้อที่มีคำขอคืนเงินอนุมัติแล้ว (เงื่อนไขเดียวกับ mark_refund_paid)
create policy refund_slips_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'refund-slips' and public.has_role('accounting', 'admin')
              and exists (select 1 from public.refunds r
                          where r.order_id::text = (storage.foldername(name))[1]
                            and r.status = 'approved'));
create policy refund_slips_select on storage.objects for select to authenticated
  using (bucket_id = 'refund-slips'
         and (public.has_role('accounting', 'admin')
              or exists (select 1 from public.orders o
                         where o.id::text = (storage.foldername(name))[1]
                           and o.user_id = public.me())));

-- chat-images: คนในห้องแชท (ลูกค้าเจ้าของห้อง ฝ่ายขาย Admin)
-- ลูกค้าส่งรูปได้เฉพาะห้องที่ยังไม่ปิด (เงื่อนไขเดียวกับ policy messages_insert)
create policy chat_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and ((c.customer_id = public.me() and c.status <> 'closed')
           or public.has_role('sales', 'admin'))));
create policy chat_images_select on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (c.customer_id = public.me() or public.has_role('sales', 'admin'))));

-- store: ผู้ใช้ที่ล็อกอินอ่าน QR ได้ Admin อัปโหลดและเปลี่ยน
create policy store_select on storage.objects for select to authenticated
  using (bucket_id = 'store' and public.me() is not null);
create policy store_write on storage.objects for insert to authenticated
  with check (bucket_id = 'store' and public.has_role('admin'));
create policy store_update on storage.objects for update to authenticated
  using (bucket_id = 'store' and public.has_role('admin'));

-- product-images: bucket public ทุกคนอ่านได้ คลังและ Admin จัดการ
create policy product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_role('admin', 'warehouse'));
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role('admin', 'warehouse'));
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role('admin', 'warehouse'));


-- PG_CRON (Security Design ข้อ 7) ------------------------------------
-- ยกเลิกคำสั่งซื้อที่เลยกำหนดโอน ทุก 5 นาที
select cron.schedule('hompb-cancel-expired-orders', '*/5 * * * *',
                     $$select public.cancel_expired_orders()$$);


-- REALTIME (Security Design ข้อ 17) ----------------------------------
alter publication supabase_realtime add table conversations, messages;