# ขั้นตอนการทำงานด้วย Git (HomPB)

## กฎหลัก
- **ห้ามแก้หรือ push เข้า `main` ตรงๆ** ทุกงานต้องผ่าน branch และ Pull Request (PR)
- **1 branch = 1 งาน** พอ merge แล้วให้ลบทิ้ง ไม่ใช้ branch เดิมซ้ำ
- **pull `main` ทุกครั้งก่อนเริ่มงานใหม่**

## ขั้นตอน

### 1. เริ่มงานใหม่
```bash
git checkout main
git pull origin main
git checkout -b feature/ชื่องาน
```

### 2. ทำงาน + commit เป็นระยะ
```bash
git status                 # ดูว่าแก้ไฟล์อะไรไปบ้าง
git add .
git commit -m "เพิ่มตาราง products"
```
ก่อน commit เช็คให้แน่ใจว่า save ไฟล์แล้ว (`Ctrl + S`)

### 3. ส่งขึ้น GitHub
```bash
git push origin feature/ชื่องาน
```

### 4. เปิด Pull Request
1. ไปที่ GitHub แล้วกด **Compare & pull request**
2. เช็คทิศทางให้ถูก: **`base: main` ← `compare: feature/ชื่องาน`**
3. เช็คว่า **Files changed มากกว่า 0** (ถ้าเป็น 0 แปลว่ายังไม่ได้ commit)
4. ใส่ title บอกว่าทำอะไร แล้วแท็กเพื่อนให้ช่วยดู

### 5. Merge แล้วเก็บกวาด
หลังจากกด **Merge** บน GitHub แล้ว:
```bash
git checkout main
git pull origin main
git branch -d feature/ชื่องาน              # ลบในเครื่อง
git push origin --delete feature/ชื่องาน   # ลบบน GitHub (ถ้ายังไม่ได้ลบ)
git fetch --prune                          # ล้างชื่อ branch ที่ถูกลบแล้ว
```

## ตั้งชื่อ branch
| ขึ้นต้นด้วย | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|
| `feature/` | ทำของใหม่ | `feature/checkout`, `feature/mega-menu` |
| `fix/` | แก้บั๊ก | `fix/stock-negative` |
| `style/` | แก้หน้าตา/CSS อย่างเดียว | `style/navbar-spacing` |
| `docs/` | แก้เอกสาร | `docs/readme` |

ตั้งชื่อตาม**งาน** ไม่ใช่ตามชื่อคน ใช้ตัวพิมพ์เล็กและคั่นด้วย `-`

## ข้อความ commit
- บอกว่า**ทำอะไร** ให้สั้นและชัด เช่น `เพิ่มปุ่มเปลี่ยนธีม`, `แก้สต็อกติดลบตอนสั่งซื้อ`
- อย่าใช้ข้อความลอยๆ เช่น `update`, `แก้`, `ข้อความอธิบายการเปลี่ยนแปลง`

## ใครทำส่วนไหน
| Dev | งาน | branch ตัวอย่าง |
|---|---|---|
| Full stack | Schema, RLS, Auth, Storage, RPC, checkout | `feature/db-schema`, `feature/checkout` |
| FE 1 | Storefront, header, หน้าสินค้า, ตะกร้า, dark mode | `feature/header`, `feature/cart` |
| FE 2 | บัญชีลูกค้า, คำสั่งซื้อ, แชท | `feature/login`, `feature/chat` |
| FE 3 | Backoffice | `feature/backoffice-kpi` |

ถ้าต้องแก้ไฟล์ที่ใช้ร่วมกัน (เช่น ไฟล์สีกลาง หรือ header) ให้**บอกในกลุ่มก่อน** จะได้ไม่ชนกัน

## ปัญหาที่เจอบ่อย

**`git push` แล้วขึ้น `Everything up-to-date`**
ยังไม่ได้ commit ให้ `git add` แล้ว `git commit` ก่อน

**pull แล้วไม่เห็นโค้ดใหม่**
- โค้ดของเพื่อนยังไม่ได้ merge เข้า `main` ให้ไปเช็ค PR บน GitHub
- แท็บใน VS Code ค้างของเก่าไว้ ให้กด `Ctrl + Shift + P` → `File: Revert File`
  (ห้าม save ทับ ไม่งั้นโค้ดที่เพิ่ง pull มาจะหาย)

**ขึ้น conflict ตอน pull หรือ merge**
1. เปิดไฟล์ที่ conflict ใน VS Code
2. เลือก **Accept Current**, **Accept Incoming** หรือ **Accept Both** แล้วแต่กรณี
3. `git add` ไฟล์นั้น แล้ว `git commit`
4. ถ้าไม่แน่ใจ ให้ถามเจ้าของโค้ดส่วนนั้นก่อน

**ลบ branch แล้วขึ้น `branch not found`**
branch นั้นไม่มีในเครื่อง มีแค่บน GitHub ให้ใช้ `git push origin --delete ชื่อ-branch`

## คำสั่งเช็คสถานะ
```bash
git status                  # แก้อะไรไป อยู่ branch ไหน
git branch -a               # ดู branch ทั้งในเครื่องและบน GitHub
git log --oneline -5        # ดู 5 commit ล่าสุด
git fetch origin            # ดึงข้อมูลล่าสุดมาดู (ยังไม่แก้ไฟล์ในเครื่อง)
```
