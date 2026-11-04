# คู่มือเชื่อม Supabase สำหรับทีม HomPB

ไฟล์นี้บอกว่าแต่ละหน้าต้องดึงหรือบันทึกข้อมูลจากตารางและฟังก์ชันอะไร
ทุกอย่างอ้างอิงจาก `schema.sql`, `security.sql`, `functions.sql` และ `strorage.sql` ใน branch นี้

- [ส่วนกลาง (ทุกคนอ่าน)](#ส่วนกลาง-ทุกคนอ่าน)
- [FE3: Backoffice](#fe3-backoffice)
- FE1: Storefront (กำลังเขียน)
- FE2: Customer account และแชท (กำลังเขียน)

---

## ส่วนกลาง (ทุกคนอ่าน)

### 1. ใส่ script ในหน้า html ตามลำดับนี้

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="supabase.js"></script>
<script src="ชื่อหน้า.js"></script>
```

`employee/supabase.js` เตรียมของพวกนี้ไว้ให้ใช้ได้เลย:

| ชื่อ | ใช้ทำอะไร |
|---|---|
| `sb` | ตัวเชื่อม Supabase ใช้เรียกทุกอย่าง |
| `requireStaff("role")` | เช็กว่าล็อกอินและมีสิทธิ์เข้าหน้านี้ ถ้าไม่ผ่านจะเด้งไปหน้า login คืนค่า `{ id, email, full_name, role }` |
| `staffLogout()` | ออกจากระบบ |
| `errText(error)` | แปลง error เป็นข้อความไทยสำหรับ toast |
| `ROLE_NAME` | ชื่อฝ่ายภาษาไทย |

> ⚠️ ห้ามใส่ `service_role` key หรือ secret key ในโค้ดหน้าเว็บเด็ดขาด ใช้ได้แค่ publishable key ที่อยู่ใน `supabase.js`

### 2. บัญชีทดสอบ

ดูอีเมลและ role ของแต่ละฝ่ายที่ [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)

### 3. รูปแบบโค้ดที่ใช้ทุกหน้า

```js
// 1) ตัวแปรเก็บข้อมูล
let products = [];

// 2) โหลดจาก Supabase แล้วแปลงเป็นรูปที่หน้าเว็บใช้
async function loadData() {
  const { data, error } = await sb.from("ชื่อตาราง").select("คอลัมน์");
  if (error) return toast("โหลดไม่สำเร็จ: " + errText(error));
  products = data.map((x) => ({ ... }));
}

// 3) ปุ่มบันทึก: เรียก Supabase → โหลดใหม่ → วาดหน้าใหม่
async function save(i) {
  const { error } = await sb.rpc("ชื่อฟังก์ชัน", { p_xxx: ... });
  if (error) return toast("บันทึกไม่สำเร็จ: " + errText(error));
  await loadData();
  go("หน้าเดิม");
  toast("บันทึกแล้ว");
}

// 4) เริ่มทำงาน
(async () => {
  me = await requireStaff("warehouse");
  await loadData();
  go("overview");
})();
```

ฟังก์ชันที่ใช้ `await` ต้องมีคำว่า `async` ข้างหน้า และฟังก์ชันที่เรียกจาก `onclick` ห้ามซ้อนอยู่ในฟังก์ชันอื่น

### 4. คำสั่งที่ใช้บ่อย

```js
sb.from("products").select("id, name")                       // อ่าน
sb.from("products").select("id, product_variants ( price )") // อ่านพร้อมตารางลูก (join)
  .eq("is_active", true)                                     // where is_active = true
  .order("created_at", { ascending: false })                 // เรียงใหม่สุดก่อน
  .limit(50)
sb.from("products").insert({ name: "x" }).select("id").single() // เพิ่มแล้วเอา id กลับมา
sb.from("products").update({ name: "y" }).eq("id", id)         // แก้
sb.rpc("claim_shipment", { p_order_id: id })                   // เรียกฟังก์ชันใน functions.sql
```

โหลดหลายตารางพร้อมกันให้ใช้ `Promise.all` (ดูตัวอย่างใน `employee/accounting.js` ฟังก์ชัน `loadData`)

### 5. กฎที่ฐานข้อมูลบังคับ (หน้าเว็บทำแทนไม่ได้)

- **RLS:** แต่ละ role เห็นข้อมูลไม่เท่ากัน ถ้า select แล้วได้ `[]` ทั้งที่มีข้อมูล แปลว่า role นั้นไม่มีสิทธิ์เห็น ไม่ใช่โค้ดผิด
- **ตารางที่แก้ตรงไม่ได้:** `orders`, `order_items`, `payments`, `refunds`, `refund_items`, `shipments`, `stock_logs`, `audit_logs` ต้องเปลี่ยนผ่าน `sb.rpc(...)` เท่านั้น
- **ลบไม่ได้:** `products`, `product_variants`, `profiles` ให้ใช้ `is_active = false` แทนการลบ
- **บันทึก log อัตโนมัติ:** แก้ `stock_qty` แล้วระบบเขียน `stock_logs` และ `audit_logs` ให้เอง แก้ราคา เปลี่ยน role หรือเปิดปิดบัญชีก็บันทึก `audit_logs` ให้เองเช่นกัน ไม่ต้องเขียนโค้ดเพิ่ม

### 6. รหัสสถานะในฐานข้อมูล → ข้อความไทย

ฐานข้อมูลเก็บเป็นภาษาอังกฤษ หน้าเว็บต้องแปลงเอง:

```js
const ORDER_STATUS = {
  pending_payment: "รอชำระเงิน", awaiting_approval: "รอตรวจสลิป", approved: "ชำระแล้ว",
  shipping: "กำลังจัดส่ง", delivered: "ส่งถึงแล้ว", cancelled: "ยกเลิก", refunded: "คืนเงินแล้ว",
};
const SHIP_STATUS = {
  preparing: "รอจัดส่ง", in_transit: "กำลังจัดส่ง", delivered: "จัดส่งสำเร็จ", failed: "ส่งไม่สำเร็จ",
};
const STOCK_REASON = {
  order: "ลูกค้าสั่งซื้อ", cancel: "ยกเลิกคำสั่งซื้อ", adjust: "ปรับสต๊อก", return: "รับคืนสินค้า",
};
```

role: `admin`, `warehouse` (คลัง), `shipping` (จัดส่ง), `sales` (บริการลูกค้า/ขาย), `accounting` (บัญชี), `customer`

เลขคำสั่งซื้อที่แสดงให้คนอ่านคือ `"HPB" + order_no` ส่วน `id` (uuid) ใช้ตอนเรียก rpc

### 7. Error ที่เจอบ่อย

| ข้อความ | สาเหตุ |
|---|---|
| `xxx is not defined` | พิมพ์ชื่อผิด หรือฟังก์ชันซ้อนอยู่ในฟังก์ชันอื่น |
| `await is only valid in async functions` | ลืมใส่ `async` หน้า function |
| `ไม่มีสิทธิ์ทำรายการนี้` (42501) | role นี้ไม่มีสิทธิ์ ตรวจที่ตาราง RLS ด้านล่าง |
| `duplicate key value` (23505) | ค่าซ้ำ เช่น SKU หรือเลขพัสดุซ้ำ |
| `relation "xxx" does not exist` | ชื่อตารางผิด |
| select ได้ `[]` | RLS ไม่ให้เห็น หรือยังไม่มีข้อมูลจริง |

---

## FE3: Backoffice

### สถานะตอนนี้

| หน้า | สถานะ | หมายเหตุ |
|---|---|---|
| `login` | ✅ เชื่อมแล้ว | |
| `warehouse` | ✅ เชื่อมแล้ว | ใช้เป็นตัวอย่างหน้าสินค้า/สต๊อก |
| `delivery` | ✅ เชื่อมแล้ว | ใช้เป็นตัวอย่างหน้าจัดส่ง |
| `accounting` | ✅ เชื่อมแล้ว | งานของ Full stack ใช้เป็นตัวอย่างหน้าการเงิน |
| `service` | ✅ เชื่อมแล้ว | สินค้า คำสั่งซื้อ และแชทฝั่งพนักงาน (realtime) |
| `admin` | ✅ เชื่อมแล้ว | ทุกเมนู + บันทึกระบบจาก audit_logs · เพิ่มพนักงานผ่าน Edge Function `create-staff` |

### แต่ละ role เห็นอะไร (RLS)

| ตาราง / view | admin | warehouse | shipping | sales | accounting |
|---|---|---|---|---|---|
| `products`, `categories` | แก้ได้ | แก้ได้ | อ่าน | อ่าน | อ่าน |
| `product_variants` (มี sku, stock) | แก้ได้ | แก้ได้ | อ่าน | อ่าน | ❌ ใช้ `variants_public` |
| `orders` (มีที่อยู่) | อ่าน | ❌ | เฉพาะงานตัวเอง | ❌ | ❌ |
| `orders_for_staff` (ไม่มีที่อยู่) | อ่าน | อ่าน | ❌ | อ่าน | อ่าน |
| `order_items` | อ่าน | อ่าน | เฉพาะงานตัวเอง | อ่าน | อ่าน |
| `shipments` | อ่าน | อ่าน | งานตัวเอง + งานที่ยังไม่มีคนรับ | อ่าน | อ่าน |
| `payments`, `refunds` | อ่าน | ❌ | ❌ | ❌ (`refunds_for_sales`) | อ่าน |
| `refund_items` | อ่าน | อ่าน | ❌ | อ่าน | อ่าน |
| `stock_logs` | อ่าน | อ่าน | ❌ | ❌ | ❌ |
| `audit_logs` | อ่าน | ❌ | ❌ | ❌ | ❌ |
| `profiles` | อ่าน/แก้ทุกคน | ตัวเอง | ตัวเอง + ลูกค้าในงาน | ตัวเอง + ลูกค้าที่แชท | ตัวเอง + ลูกค้าที่มีคำสั่งซื้อ |
| `store_settings` | แก้ได้ | อ่าน | อ่าน | อ่าน | อ่าน |

### ฟังก์ชัน (rpc) ที่ FE3 ใช้

| ฟังก์ชัน | ใครเรียกได้ | พารามิเตอร์ | ทำอะไร |
|---|---|---|---|
| `claim_shipment` | shipping, admin | `p_order_id` | รับงานจัดส่ง |
| `update_shipment` | shipping, admin | `p_order_id`, `p_status`, `p_carrier`, `p_tracking_no` | เปลี่ยนสถานะจัดส่ง |
| `check_return` | warehouse, admin | `p_refund_item_id`, `p_restock` (true/false) | ตรวจของที่ลูกค้าส่งคืน |
| `review_payment` | accounting, admin | `p_payment_id`, `p_approve`, `p_reject_reason` | ตรวจสลิป |
| `review_refund` | accounting, admin | `p_refund_id`, `p_approve`, `p_note` | อนุมัติคืนเงิน |
| `mark_refund_paid` | accounting, admin | `p_refund_id`, `p_slip_path` | บันทึกว่าโอนคืนแล้ว |

ลำดับสถานะจัดส่งที่ `update_shipment` ยอมให้เปลี่ยน:
`preparing → in_transit → delivered` หรือ `in_transit → failed → in_transit`
ถ้าส่งด้วยบริษัทขนส่ง ต้องใส่ขนส่งและเลขพัสดุก่อนเปลี่ยนเป็น `in_transit`

---

### หน้า service.js (ฝ่ายบริการลูกค้า)

**สินค้า (อ่านอย่างเดียว):** copy `loadProducts` จาก `warehouse.js` มาได้เลย sales อ่านตารางเดียวกันได้ แต่ไม่ต้องดึง `stock_logs` เพราะ sales อ่านไม่ได้

**คำสั่งซื้อ:** sales อ่าน `orders` ตรงๆ ไม่ได้ ให้ใช้ view `orders_for_staff` แบบเดียวกับ `loadOrders` ใน `warehouse.js`

```js
const [o, it] = await Promise.all([
  sb.from("orders_for_staff").select("id, order_no, user_id, status, created_at")
    .order("created_at", { ascending: false }),
  sb.from("order_items").select("order_id, product_name, quantity"),
]);
```

ชื่อลูกค้า: sales เห็น `profiles` เฉพาะลูกค้าที่เคยแชท ลูกค้าคนอื่นให้แสดง `-`

**แชท:** FE2 เป็นคนทำ

---

### หน้า admin.js

Admin มีสิทธิ์ครบทุกตาราง จึง copy โค้ดจากหน้าที่เชื่อมแล้วมาใช้ได้เกือบหมด

| เมนู | copy จาก | ต้องแก้ |
|---|---|---|
| สินค้า & สต๊อก | `warehouse.js`: `loadProducts`, `addP`, `adjust`, `saveEdit`, `delP` | ไม่ต้องแก้ |
| คำสั่งซื้อ | `warehouse.js`: `loadOrders` | อ่านตาราง `orders` ตรงได้ จึงได้ที่อยู่และยอดเงินด้วย (ดูโค้ดด้านล่าง) |
| การเงิน | `accounting.js`: `loadData`, `signedUrls`, `callRpc`, `approve`, `reject`, `approveRefund`, `rejectRefund`, `markPaid` | Admin อ่าน `orders` ตรงได้ จะใช้ `orders_for_staff` ต่อก็ได้ |
| จัดส่ง | `delivery.js`: `loadData`, `saveS` | Admin ไม่ต้องกดรับงาน เรียก `update_shipment` ได้เลย Admin เห็นทุกงาน ชื่อคนทำจึงไม่ใช่ตัวเองเสมอไป |
| แชทลูกค้า | – | FE2 ทำ |
| ผู้ใช้ & ระบบ | – | ดูหัวข้อถัดไป |

**คำสั่งซื้อแบบ Admin:**
```js
const { data, error } = await sb
  .from("orders")
  .select("id, order_no, status, total_amount, shipping_address, created_at, order_items ( product_name, quantity )")
  .order("created_at", { ascending: false });
```
`shipping_address` เป็น object ที่มี key `recipient_name`, `phone`, `address_line`, `subdistrict`, `district`, `province`, `postcode` (ดูวิธีต่อเป็นข้อความใน `delivery.js`)

#### ผู้ใช้ & ระบบ

**รายชื่อพนักงาน:**
```js
sb.from("profiles").select("id, email, full_name, role, is_active").neq("role", "customer")
```

**เปลี่ยนตำแหน่ง / ปิดบัญชี** (ทำได้เฉพาะ Admin ระบบบันทึก audit ให้เอง):
```js
sb.from("profiles").update({ role: "warehouse" }).eq("id", id)
sb.from("profiles").update({ is_active: false }).eq("id", id)
```
ปุ่ม "ลบ" ในหน้าตอนนี้ให้เปลี่ยนเป็น "ปิดบัญชี" (`is_active: false`) เพราะลบ profile ไม่ได้ บัญชีที่ปิดแล้วจะเข้าระบบไม่ได้ทันที

**เพิ่มพนักงาน:** ⏳ โค้ด Edge Function อยู่ที่ [`supabase/functions/create-staff/index.ts`](../supabase/functions/create-staff/index.ts) แล้ว รอ Full stack deploy
ห้ามใช้ `sb.auth.signUp()` จากหน้า admin เพราะจะสลับ session ไปเป็นบัญชีใหม่ (Admin หลุดออกจากระบบ) และบัญชีใหม่จะได้ role `customer`
หน้า admin เรียกแบบนี้ (ทำไว้แล้วใน `addU`):
```js
const { error } = await sb.functions.invoke("create-staff", {
  body: { email, full_name, role, password },
});
```
Deploy (ต้องติดตั้ง Supabase CLI และล็อกอินก่อน):
```bash
supabase functions deploy create-staff --project-ref owdayhfejexebndyehfe
```
ฟังก์ชันเช็กเองว่าคนเรียกเป็น Admin ที่บัญชียังเปิดอยู่ สร้างบัญชีแบบไม่ต้องยืนยันอีเมล แล้วตั้ง role ในนาม Admin (audit_logs บันทึกว่าใครเพิ่ม) ถ้าตั้ง role ไม่สำเร็จจะลบบัญชีที่เพิ่งสร้างทิ้ง

**บันทึกการทำงานของระบบ:**
```js
sb.from("audit_logs")
  .select("created_at, actor_id, action, target_table, detail")
  .order("id", { ascending: false })
  .limit(50)
```
`action` เป็นรหัส เช่น `stock.adjust`, `variant.price`, `profile.access_change`, `refund.approved`, `store.update` ให้แปลงเป็นไทยเอง
ชื่อคนทำ: เอา `actor_id` ไปจับคู่กับรายชื่อพนักงานที่โหลดไว้

**ตั้งค่าร้าน (ถ้าจะทำ):** ตาราง `store_settings` มีแถวเดียว
```js
sb.from("store_settings").select("*").single()
sb.from("store_settings").update({ shipping_fee: 50 }).eq("id", true)
```
รูป QR พร้อมเพย์อัปโหลดไป bucket `store` แล้วเก็บ path ไว้ใน `promptpay_qr_path`

---

### งานเพิ่มที่ยังไม่มี UI (ถ้ามีเวลา)

**ตรวจของคืน (หน้า warehouse):** เมื่อลูกค้าขอคืนเพราะสินค้าชำรุดหรือส่งผิด และบัญชีอนุมัติแล้ว คลังต้องตรวจของ
```js
// รายการที่รอตรวจ
sb.from("refund_items")
  .select("id, quantity, return_status, order_items ( product_name, variant_name )")
  .eq("return_status", "pending_check")

// ตรวจแล้ว: true = เข้าสต๊อก, false = ใช้ไม่ได้
sb.rpc("check_return", { p_refund_item_id: id, p_restock: true })
```
ถ้าเลือกเข้าสต๊อก ระบบจะบวกสต๊อกและบันทึก `stock_logs` (reason `return`) ให้เอง

---

มีคำถามหรือเจอ error ที่ไม่อยู่ในตาราง ส่งรูป console มาถาม Full stack ได้เลย
