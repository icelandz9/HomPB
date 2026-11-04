# บัญชีทดสอบพนักงาน HomPB

| อีเมล | role | ฝ่าย | เข้าหน้า |
|---|---|---|---|
| admin@hompb.com | `admin` | Admin | `admin.html` (เข้าได้ทุกหน้า) |
| stock@hompb.com | `warehouse` | ฝ่ายคลังสินค้า | `warehouse.html` |
| ship@hompb.com | `shipping` | ฝ่ายจัดส่ง | `delivery.html` |
| cs@hompb.com | `sales` | ฝ่ายบริการลูกค้า/ฝ่ายขาย | `service.html` |
| finance@hompb.com | `accounting` | ฝ่ายบัญชี | `accounting.html` |

ทุกบัญชีล็อกอินที่ `auth/login.html` (หน้าเดียวกับลูกค้า) แล้วระบบพาไปหน้าของฝ่ายตาม role

> ⚠️ รหัสผ่านขอจาก Full stack ทางแชทของทีม ห้ามเขียนรหัสผ่านลง repo
