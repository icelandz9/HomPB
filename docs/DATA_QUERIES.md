# การทำงานของฐานข้อมูล HomPB (โค้ดสำหรับสไลด์)

HomPB ใช้ Supabase (PostgreSQL) โค้ดในเอกสารนี้ตัดมาจากโค้ดจริงของโปรเจกต์ บางชิ้นตัดคอลัมน์ออกให้สั้นพอใส่สไลด์ แต่ตรรกะเหมือนเดิม

- **JS** = query จากหน้าเว็บผ่าน supabase-js
- **SQL** = ฟังก์ชัน trigger และ policy ที่รันในฐานข้อมูล

| หัวข้อ | เรื่อง | เทียบกับ SQL | ไฟล์ |
|---|---|---|---|
| Retrieval & Mapping | คำสั่งซื้อพร้อมรายการ สลิป การจัดส่ง คำขอคืน | JOIN ORDERS → ORDER_ITEMS / PAYMENTS / SHIPMENTS / REFUNDS | `js/shop-orders.js` |
| Retrieval & Mapping | ตะกร้าจับคู่ราคาและสินค้า | JOIN CART_ITEMS → VARIANTS → PRODUCTS | `js/shop-cart.js` |
| Retrieval & Mapping | สั่งซื้อและล็อกสต็อก | JOIN ... FOR UPDATE | `backend/functions.sql` |
| Aggregation | ยอดรวมตะกร้า | SUM(PRICE * QTY) | `js/shop-cart.js` |
| Aggregation | KPI หน้าบัญชี | SUM / COUNT WHERE STATUS | `employee/accounting.js` |
| Aggregation | จำนวนที่ยังขอคืนได้ | SUM + COALESCE ใน subquery | `backend/functions.sql` |
| Aggregation | วิธีจัดส่งทั้งคำสั่งซื้อ | BOOL_OR | `backend/functions.sql` |
| Multi-step | สินค้าในตะกร้า | WHERE ID IN (...) | `js/shop-cart.js` |
| Multi-step | ยกเลิกคำสั่งซื้อที่เลยกำหนดโอน | SELECT ... FOR UPDATE SKIP LOCKED → LOOP | `backend/functions.sql` |
| Multi-step | คืนเงินครบแล้วเปลี่ยนสถานะ | NOT EXISTS + SUM subquery | `backend/schema.sql` |
| Multi-step | สิทธิ์เห็นรายการคืน (RLS) | WHERE EXISTS (...) | `backend/security.sql` |

---

## 1. DATA RETRIEVAL & DATA MAPPING

### หน้าคำสั่งซื้อ: ดึงคำสั่งซื้อพร้อมรายการสินค้า สลิป การจัดส่ง และคำขอคืนในครั้งเดียว

- JOIN ORDERS → ORDER_ITEMS / PAYMENTS / SHIPMENTS / REFUNDS → REFUND_ITEMS
- ไฟล์: `js/shop-orders.js` (ฟังก์ชัน `load`)

```js
sb.from("orders").select(
  "id, order_no, status, total_amount, order_items (id, product_name, unit_price, quantity), " +
  "payments (attempt_no, status), shipments (status, carrier, tracking_no), " +
  "refunds (id, amount, status, refund_items (order_item_id, quantity))")
```

### ตะกร้า: จับคู่ของในตะกร้ากับราคาและข้อมูลสินค้า

- JOIN CART_ITEMS → PRODUCT_VARIANTS → PRODUCTS
- ไฟล์: `js/shop-cart.js` (ฟังก์ชัน `loadCart`)

```js
const byP = Object.fromEntries(products.map((p) => [p.id, p]));
const byV = Object.fromEntries(vs.map((v) => [v.id, v]));
lines = items.filter((x) => byV[x.variant_id] && byP[byV[x.variant_id].product_id])
  .map((x) => { const v = byV[x.variant_id], p = byP[v.product_id];
    return { name: p.name, price: v.price, qty: x.quantity }; });
```

### สั่งซื้อ: ดึงของในตะกร้าพร้อมราคาและสถานะสินค้า แล้วล็อกแถวสต็อกกันขายเกิน

- JOIN CART_ITEMS → VARIANTS → PRODUCTS ... FOR UPDATE
- ไฟล์: `backend/functions.sql` (ฟังก์ชัน `place_order`)

```sql
select c.variant_id, c.quantity, v.price, p.name as product_name,
       v.is_active and p.is_active as on_sale
from public.cart_items c
join public.product_variants v on v.id = c.variant_id
join public.products p on p.id = v.product_id
where c.user_id = v_uid
order by c.variant_id
for update of v
```

---

## 2. DATA AGGREGATION

### lines.reduce(...) รวมราคาตะกร้า

- SUM(PRICE * QTY)
- ไฟล์: `js/shop-cart.js`

```js
const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
```

### หน้าบัญชี: รวมยอดตามสถานะสลิปและคำขอคืนเงิน

- SUM ... WHERE STATUS = ?, COUNT
- ไฟล์: `employee/accounting.js` (หน้า ภาพรวม)

```js
const sum = (list, f) => list.filter(f).reduce((a, x) => a + Number(x.amt), 0);
k("ยอดที่ยืนยันแล้ว", baht(sum(payments, (p) => p.status === "approved")))
k("สลิปรอตรวจสอบ", payments.filter((p) => p.status === "pending").length)
```

### จำนวนที่ยังขอคืนได้ = จำนวนที่สั่ง − จำนวนที่ขอคืนไปแล้ว

- SUM + COALESCE ใน subquery
- ไฟล์: `backend/functions.sql` (ฟังก์ชัน `request_refund`)

```sql
oi.quantity - coalesce((
  select sum(ri.quantity) from public.refund_items ri
  join public.refunds rf on rf.id = ri.refund_id
  where ri.order_item_id = oi.id and rf.status <> 'rejected'), 0) as left_qty
```

### เลือกวิธีจัดส่งทั้งคำสั่งซื้อ: มีชิ้นไหนต้องส่งรถร้าน ส่งรถร้านทั้งคำสั่งซื้อ

- BOOL_OR (aggregate)
- ไฟล์: `backend/functions.sql` (ฟังก์ชัน `review_payment`)

```sql
case when bool_or(p.delivery_method = 'store_truck') then 'store_truck' else 'carrier' end
```

---

## 3. MULTI-STEP DATA QUERY

### ผลของ query แรก (id ของสินค้าในตะกร้า) ถูกส่งเข้า query ที่สอง

- WHERE ID IN (SELECT VARIANT_ID FROM CART_ITEMS)
- ไฟล์: `js/shop-cart.js`

```js
const vids = items.map((x) => x.variant_id);
await sb.from("variants_public").select("id, product_id, name, price").in("id", vids);
```

### ยกเลิกคำสั่งซื้อที่เลยกำหนดโอน: หา id ก่อน แล้วยกเลิกและคืนสต็อกทีละรายการ

- SELECT ... FOR UPDATE SKIP LOCKED → LOOP
- ไฟล์: `backend/functions.sql` (ฟังก์ชัน `cancel_expired_orders` ที่ pg_cron เรียกทุก 5 นาที)

```sql
for v_id in
  select id from public.orders
  where status = 'pending_payment' and payment_due_at < now()
  for update skip locked
loop
  if public._cancel_order(v_id) then v_count := v_count + 1; end if;
end loop;
```

### คืนเงินครบทุกชิ้นแล้วเปลี่ยนสถานะคำสั่งซื้อเป็น refunded

- NOT EXISTS (SELECT ... WHERE QTY > (SELECT SUM ...))
- ไฟล์: `backend/schema.sql` (trigger `set_order_refunded`)

```sql
and not exists (
  select 1 from public.order_items oi
  where oi.order_id = new.order_id
    and oi.quantity > coalesce((select sum(ri.quantity) from public.refund_items ri
      join public.refunds r on r.id = ri.refund_id
      where ri.order_item_id = oi.id and r.status = 'paid'), 0))
```

### สิทธิ์ (RLS): ลูกค้าเห็นรายการคืนเฉพาะของคำสั่งซื้อตัวเอง

- WHERE EXISTS (SELECT 1 FROM REFUNDS WHERE ...)
- ไฟล์: `backend/security.sql`

```sql
create policy refund_items_select on refund_items for select
  using (public.has_role('admin', 'warehouse', 'sales', 'accounting')
         or exists (select 1 from public.refunds r
                    where r.id = refund_id and public.owns_order(r.order_id)));
```
