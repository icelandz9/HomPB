# HomPB

ร้านค้าออนไลน์ของแต่งบ้านและเครื่องใช้ไฟฟ้า แบ่งสินค้าตามห้อง ได้แก่ ห้องนอน ห้องน้ำ ห้องนั่งเล่น ห้องครัว และเครื่องใช้ไฟฟ้า
มีทั้งหน้าร้านสำหรับลูกค้าและหน้าหลังบ้านสำหรับพนักงานแต่ละฝ่าย

- **หน้าเว็บ:** HTML, CSS และ JavaScript ล้วน ไม่มี framework และไม่ต้อง build
- **หลังบ้าน:** [Supabase](https://supabase.com) (Postgres, Auth, Storage, Realtime และ Edge Function)
- **ความปลอดภัยของข้อมูล:** ใช้ Row Level Security (RLS) กับฟังก์ชันในฐานข้อมูล หน้าเว็บใช้แค่คีย์สาธารณะ (publishable key)

## เริ่มใช้งานในเครื่อง

1. Clone repo
   ```bash
   git clone https://github.com/icelandz9/HomPB.git
   cd HomPB
   ```
2. เปิดเว็บผ่าน local server ที่ตั้งต้นจากโฟลเดอร์บนสุดของ repo (บางหน้าอ้างรูปด้วย path ที่ขึ้นต้นด้วย `/`) เลือกได้สองวิธี
   - **VS Code:** ติดตั้ง extension **Live Server** แล้วคลิกขวาที่ `index.html` เลือก **Open with Live Server**
   - **Python:**
     ```bash
     python -m http.server 8000
     ```
     แล้วเปิด <http://localhost:8000>

ไม่ต้องตั้งค่า Supabase เพิ่ม เพราะ `js/supabase.js` ชี้ไปที่โปรเจกต์ของทีมไว้แล้ว

## หน้าในเว็บ

### หน้าร้าน (ลูกค้า)

| หน้า | ทำอะไร |
|---|---|
| `index.html` | หน้าแรก เลือกซื้อตามห้อง และสินค้าแนะนำ |
| `zone.html?z=bed` | สินค้าตามห้อง (`bed` `bath` `living` `kitchen` `appliance`) |
| `search.html?q=` | ค้นหาสินค้าตามชื่อ |
| `product.html?id=` | รายละเอียดสินค้า เลือกแบบ เพิ่มลงตะกร้า |
| `cart.html` | ตะกร้า เลือกที่อยู่ และสั่งซื้อ |
| `orders.html` | คำสั่งซื้อของฉัน แนบสลิป ติดตามพัสดุ ขอคืนเงิน |
| `favorites.html` | รายการโปรด |
| `chat.html` | แชทกับฝ่ายบริการลูกค้า |
| `profile/profile.html` | ข้อมูลส่วนตัวและที่อยู่จัดส่ง |
| `auth/login.html`, `auth/register.html` | เข้าสู่ระบบ (ใช้หน้าเดียวกันทั้งลูกค้าและพนักงาน) และสมัครสมาชิก |

ตะกร้า คำสั่งซื้อ แชท รายการโปรด และโปรไฟล์ ต้องล็อกอินเป็นลูกค้าก่อน

### หลังบ้าน (พนักงาน)

ล็อกอินที่ `auth/login.html` แล้วระบบพาไปหน้าของฝ่ายตาม role

| หน้า | role | ฝ่าย |
|---|---|---|
| `employee/admin.html` | `admin` | ผู้ดูแลระบบ (เข้าได้ทุกหน้า เพิ่มบัญชีพนักงาน) |
| `employee/warehouse.html` | `warehouse` | คลังสินค้า (สินค้า สต็อก รูป) |
| `employee/delivery.html` | `shipping` | จัดส่ง |
| `employee/service.html` | `sales` | บริการลูกค้าและฝ่ายขาย (แชท คำสั่งซื้อ) |
| `employee/accounting.html` | `accounting` | บัญชี (ตรวจสลิป คืนเงิน) |

อีเมลของบัญชีทดสอบอยู่ใน [backend/TEST_ACCOUNTS.md](backend/TEST_ACCOUNTS.md) รหัสผ่านขอจาก Full stack ทางแชทของทีม

## โครงสร้างโฟลเดอร์

```
HomPB/
├── index.html, zone.html, ...   หน้าร้าน (ชั้นบนสุด)
├── main_page.css, shop.css      สไตล์หน้าร้าน (ธีมมืด/สว่าง)
├── js/
│   ├── supabase.js              ตัวเชื่อม Supabase และตัวช่วยที่ใช้ทุกหน้า
│   ├── shop.js                  หัวเว็บ การ์ดสินค้า ตะกร้า รายการโปรด
│   ├── catalog.js               รายชื่อสินค้าตัวอย่างและรูปของแต่ละห้อง
│   └── shop-*.js, store-*.js    โค้ดของแต่ละหน้า
├── auth/                        เข้าสู่ระบบ / สมัครสมาชิก
├── profile/                     หน้าโปรไฟล์ลูกค้า
├── employee/                    หน้าพนักงานแต่ละฝ่าย
├── img/                         รูปทั้งหมด (ดู img/README.md)
├── backend/                     SQL ของฐานข้อมูลและคู่มือ API
└── supabase/functions/          Edge Function (create-staff)
```

## ฐานข้อมูล (Supabase)

ไฟล์ SQL อยู่ใน `backend/` ถ้าตั้งโปรเจกต์ Supabase ใหม่ ให้รันใน **SQL Editor** ตามลำดับนี้

| ลำดับ | ไฟล์ | มีอะไร |
|---|---|---|
| 1 | `schema.sql` | ตาราง enum และ index |
| 2 | `security.sql` | ฟังก์ชันเช็กสิทธิ์และ RLS policy |
| 3 | `functions.sql` | ฟังก์ชันธุรกิจที่หน้าเว็บเรียกด้วย `sb.rpc(...)` เช่น `place_order` |
| 4 | `strorage.sql` | bucket รูปและสลิป pg_cron และ Realtime (เปิด extension `pg_cron` ก่อน) |
| 5 | `seed_products.sql` | สินค้าเริ่มต้น 164 รายการ พร้อมราคา สต็อก ห้อง และรูป (รันซ้ำได้ ไม่สร้างซ้ำ) |

Edge Function `create-staff` ใช้ตอน Admin เพิ่มบัญชีพนักงาน deploy ด้วย
```bash
supabase functions deploy create-staff
```

ดูว่าแต่ละหน้าใช้ตาราง ฟังก์ชัน และสถานะอะไร ได้ที่ [backend/API.md](backend/API.md)

> ⚠️ ห้ามใส่ `service_role` key หรือ secret key ในโค้ดหน้าเว็บ ใช้ได้แค่ publishable key ที่อยู่ใน `js/supabase.js`
> สิทธิ์ทั้งหมดบังคับที่ฐานข้อมูล (RLS) การซ่อนปุ่มในหน้าเว็บเป็นแค่เรื่องหน้าจอ

## รูปสินค้า

- รูปสินค้าเริ่มต้นอยู่ใน `img/products/<ห้อง>/` ตั้งชื่อไฟล์เป็นภาษาอังกฤษ เช่น `bed/pillow.jpg`
- รูปที่พนักงานอัปโหลดในหน้าคลังสินค้า เก็บใน Supabase Storage (bucket `product-images`)
- วิธีเพิ่มรูปใหม่ดูได้ที่ [img/README.md](img/README.md)

## ทำงานร่วมกัน

ห้าม push เข้า `main` ตรงๆ ทุกงานต้องแยก branch แล้วเปิด Pull Request
ขั้นตอน การตั้งชื่อ branch และวิธีแก้ปัญหา Git ที่เจอบ่อย อยู่ใน [CONTRIBUTING.md](CONTRIBUTING.md)

| ตำแหน่ง | ดูแลส่วน |
|---|---|
| Full stack | Schema, RLS, Auth, Storage, RPC, checkout |
| FE 1 | หน้าร้าน หัวเว็บ หน้าสินค้า ตะกร้า ธีมมืด/สว่าง |
| FE 2 | บัญชีลูกค้า คำสั่งซื้อ แชท |
| FE 3 | หลังบ้าน (Backoffice) |
