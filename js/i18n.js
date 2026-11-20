// ========== เปลี่ยนภาษา ไทย / English (หน้าร้าน, login, profile) ==========
// โหลดใน <head> ก่อน script อื่น: แปลข้อความบนหน้าเป็นอังกฤษตอนเลือก EN
// วิธีทำงาน: เทียบข้อความทั้งก้อนกับพจนานุกรม (DICT) ถ้าไม่ตรง ลองรูปแบบที่มีตัวเลข/ราคา (PATTERNS)
// แล้วคอยแปลข้อความที่ JS สร้างทีหลังด้วย MutationObserver (การ์ดสินค้า ตะกร้า toast ฯลฯ)
// ข้อมูลจากฐานข้อมูล (ชื่อสินค้า รายละเอียด ที่อยู่ ข้อความแชท) ไม่แปล
// เพิ่มคำใหม่: ใส่ใน DICT เป็น "ข้อความไทยตามที่แสดง": "English"
// หน้าพนักงาน (employee/) ยังเป็นภาษาไทยอย่างเดียว

(function () {
  const KEY = "hompb-lang";
  let lang = "th";
  try {
    if (localStorage.getItem(KEY) === "en") lang = "en";
  } catch {}
  document.documentElement.lang = lang;
  window.HOMPB_LANG = lang;

  // ปุ่มเปลี่ยนภาษาเรียก toggleLang() แล้วโหลดหน้าใหม่ (กลับเป็นไทยได้ทันทีโดยไม่ต้องเก็บข้อความเดิม)
  window.toggleLang = function () {
    try {
      localStorage.setItem(KEY, lang === "en" ? "th" : "en");
    } catch {}
    location.reload();
  };

  // ปุ่ม [data-lang-btn] แสดงภาษาปัจจุบัน
  function markButtons(root) {
    (root.querySelectorAll ? root : document).querySelectorAll("[data-lang-btn]").forEach((b) => {
      b.setAttribute("aria-label", lang === "en" ? "Language: English (เปลี่ยนเป็นภาษาไทย)" : "ภาษา: ไทย (Switch to English)");
      b.querySelectorAll("[data-lang]").forEach((s) => s.classList.toggle("on", s.dataset.lang === lang));
    });
  }
  document.addEventListener("DOMContentLoaded", () => markButtons(document));

  if (lang !== "en") return;

  const DICT = {
    // ---------- ทั่วไป / หัวเว็บ ----------
    "หน้าแรก": "Home",
    "HomPB หน้าแรก": "HomPB home",
    "ช้อปสินค้า": "Shop",
    "ห้องต่างๆ": "Rooms",
    "บริการต่างๆ": "Services",
    "ค้นหา": "Search",
    "ค้นหาสินค้า": "Search products",
    "ค้นหาสินค้า เช่น หมอน โซฟา กาต้มน้ำ": "Search e.g. pillow, sofa, kettle",
    "ล้างคำค้นหา": "Clear search",
    "รายการโปรด": "Favorites",
    "รายการโปรดของฉัน": "My favorites",
    "ตะกร้า": "Cart",
    "ตะกร้าสินค้า": "Shopping cart",
    "ติดตามพัสดุ": "Track parcel",
    "คำสั่งซื้อ": "Orders",
    "คำสั่งซื้อของฉัน": "My orders",
    "แชท": "Chat",
    "โปรไฟล์": "Profile",
    "บัญชีของฉัน": "My account",
    "ระบบหลังบ้าน": "Back office",
    "สวัสดี": "Hello",
    "สวัสดี! เข้าสู่ระบบ หรือ สมัครสมาชิก": "Hello! Log in or sign up",
    "เข้าสู่ระบบ": "Log in",
    "สมัครสมาชิก": "Sign up",
    "เข้าสู่ระบบ / สมัครสมาชิก": "Log in / Sign up",
    "ออกจากระบบ": "Log out",
    "ไทย": "Thai",
    "ธีมมืด": "Dark theme",
    "ธีมสว่าง": "Light theme",
    "โหมดสว่าง": "Light mode",
    "โหมดมืด": "Dark mode",
    "เปลี่ยนธีม": "Change theme",
    "เปลี่ยนธีม สว่าง / มืด": "Switch light / dark theme",
    "เมนูหลัก": "Main menu",
    "ปิดเมนู": "Close menu",
    "ทางลัด": "Shortcuts",
    "บัญชีและตะกร้า": "Account and cart",
    "เมนูช้อปสินค้า": "Shop menu",
    "เมนูบริการต่างๆ": "Services menu",
    "เมนูห้องต่างๆ": "Rooms menu",
    "เปิดเมนูช้อปสินค้า": "Open shop menu",
    "เปิด/ปิดเมนูช้อปสินค้า": "Open / close shop menu",
    "เปิดแชทกับ HomPB": "Chat with HomPB",
    "แชทกับฝ่ายบริการลูกค้าได้ตลอดช่วงเวลาทำการ": "Chat with customer service during business hours",
    "กำลังโหลด…": "Loading…",
    "เกิดข้อผิดพลาด": "Something went wrong",
    "ไม่มีสิทธิ์ทำรายการนี้": "You don't have permission to do this",

    // ---------- ห้อง / โซน ----------
    "ทุกห้อง": "All rooms",
    "ห้องนอน": "Bedroom",
    "ห้องน้ำ": "Bathroom",
    "ห้องนั่งเล่น": "Living room",
    "ห้องครัว": "Kitchen",
    "เครื่องใช้ไฟฟ้า": "Appliances",
    "หมอน": "Pillows",
    "ผ้าห่ม": "Blankets",
    "ผ้าขี้ริ้ว": "Cloths",
    "ชักโครก": "Toilets",
    "โซฟา": "Sofas",
    "ทีวี": "TVs",
    "ชาม": "Bowls",
    "ตะหลิว": "Spatulas",
    "กาต้มน้ำ": "Kettles",
    "กาต้มน้ำไฟฟ้า": "Electric kettles",
    "หมอน, ผ้าห่ม": "Pillows, blankets",
    "ผ้าขี้ริ้ว, ชักโครก": "Cloths, toilets",
    "โซฟา, ทีวี": "Sofas, TVs",
    "ชาม, ตะหลิว": "Bowls, spatulas",
    "เครื่องใช้ไฟฟ้าสำหรับแต่ละห้อง": "Appliances for every room",
    "กรองตามโซน": "Filter by room",
    "ห้องนอน: เตียงคลุมผ้านวมสีขาว หมอน ตู้เสื้อผ้าไม้ และโต๊ะข้างเตียง": "Bedroom: bed with white duvet, pillows, wooden wardrobe and nightstand",
    "ห้องน้ำ: อ่างอาบน้ำแบบลอยตัว ชักโครก ฝักบัว และอ่างล้างหน้าพร้อมตู้": "Bathroom: freestanding bathtub, toilet, shower and vanity",
    "ห้องนั่งเล่น: โซฟาสีเทา โต๊ะกลางไม้ ชั้นวางทีวี และพรม": "Living room: grey sofa, wooden coffee table, TV stand and rug",
    "ห้องครัว: เคาน์เตอร์หินอ่อน เตาแก๊ส ชาม ตะหลิว และชั้นวางจาน": "Kitchen: marble counter, gas stove, bowls, spatula and dish rack",
    "เครื่องใช้ไฟฟ้า: กาต้มน้ำ หม้อหุงข้าว เครื่องปิ้งขนมปัง เครื่องปั่น และเตาอบ": "Appliances: kettle, rice cooker, toaster, blender and oven",

    // ---------- หน้าแรก ----------
    "เครื่องใช้ไฟฟ้า & ของใช้ในบ้าน": "Appliances & home goods",
    "ทุกห้องในบ้าน": "Every room in your home,",
    "ครบที่": "all at",
    "เลือกซื้อสินค้าตามโซนของบ้าน สั่งซื้อ ชำระเงิน และติดตามการจัดส่งได้สะดวก รวดเร็ว ผ่านระบบออนไลน์": "Shop by room, order, pay and track delivery quickly and easily online.",
    "เลือกซื้อตามห้อง": "Shop by room",
    "ติดตามคำสั่งซื้อ": "Track orders",
    "สินค้าแนะนำ": "Recommended",
    "ทั้งหมด": "All",
    "ดูสินค้าทั้งหมด": "View all products",
    "ช้อปตามห้อง": "Shop by room",
    "ช้อปตามห้อง ครบทุกโซน": "Shop by room, every zone",
    "ช้อปง่าย ครบในที่เดียว": "Easy shopping, all in one place",
    "แนะนำ HomPB": "About HomPB",
    "ค้นหาตามโซนบ้าน": "Search by room",
    "ห้องนอน ห้องน้ำ ห้องนั่งเล่น ห้องครัว และเครื่องใช้ไฟฟ้า": "Bedroom, bathroom, living room, kitchen and appliances",
    "แชทกับฝ่ายบริการลูกค้า": "Chat with customer service",
    "คุยกับฝ่ายบริการลูกค้าในเวลาทำการ": "Talk to customer service during business hours",
    "ชำระเงิน & แนบสลิป": "Payment & slip upload",
    "วิธีชำระเงิน & แนบสลิป": "How to pay & upload a slip",
    "โอนเงินแล้วแนบหลักฐานการโอนในคำสั่งซื้อได้ทันที": "Transfer, then attach your payment slip to the order right away",
    "ติดตามการจัดส่ง": "Delivery tracking",
    "ติดตามสถานะการจัดส่ง": "Track delivery status",
    "ติดตามการจัดส่งถึงหน้าบ้าน": "Track delivery to your door",
    "ติดตามคำสั่งซื้อได้ทุกขั้นตอน": "Follow every step of your order",
    "ดูสถานะคำสั่งซื้อตั้งแต่ตรวจสลิปจนถึงมือคุณ": "See your order status from slip check to your doorstep",
    "บันทึกของที่ชอบไว้ในรายการโปรด": "Save what you like to favorites",
    "บันทึกสินค้าที่ชอบไว้ดูทีหลัง": "Save products to view later",
    "สั่งซื้อและชำระเงินผ่านพร้อมเพย์": "Order and pay with PromptPay",
    "บริการลูกค้า": "Customer service",
    "เกี่ยวกับ HomPB": "About HomPB",
    "เกี่ยวกับเรา": "About us",
    "ติดต่อเรา": "Contact us",
    "แพลตฟอร์ม E-Commerce สำหรับเครื่องใช้ไฟฟ้าและอุปกรณ์ภายในบ้าน เลือกซื้อได้สะดวก รวดเร็ว ผ่านระบบออนไลน์": "An e-commerce platform for appliances and home goods. Shop quickly and easily online.",
    "© 2026 HomPB · โปรเจกต์รายวิชา CPE230 มหาวิทยาลัยศรีนครินทรวิโรฒ": "© 2026 HomPB · CPE230 course project, Srinakharinwirot University",
    "เว็บเดโม: ราคาและข้อมูลเป็นตัวอย่าง เก็บในเบราว์เซอร์นี้เท่านั้น": "Demo site: prices and data are examples only",
    "เร็วๆ นี้": "Coming soon",
    "สินค้าเครื่องใช้ไฟฟ้าอื่นๆ": "More appliances",

    // ---------- การ์ดสินค้า / หน้าสินค้า ----------
    "เพิ่มลงตะกร้า": "Add to cart",
    "เพิ่ม": "Add",
    "ลด": "Decrease",
    "จำนวน": "Quantity",
    "แบบ": "Option",
    "มีสินค้า": "In stock",
    "สินค้าหมด": "Out of stock",
    "(หมด)": "(sold out)",
    "รายละเอียด": "Details",
    "ไม่พบสินค้านี้ หรือปิดการขายแล้ว": "This product was not found or is no longer for sale",
    "กลับหน้าแรก": "Back to home",
    "สินค้าทั้งหมด": "All products",
    "ไม่พบสินค้าที่ค้นหา ลองคำอื่น": "No products found. Try another word.",
    "ยังไม่มีสินค้าในหมวดนี้": "No products in this category yet",
    "โหลดสินค้าไม่สำเร็จ": "Could not load products",
    "เพิ่มลงตะกร้าแล้ว": "Added to cart",
    "เพิ่มลงตะกร้าไม่สำเร็จ": "Could not add to cart",
    "บันทึกในรายการโปรดแล้ว": "Saved to favorites",
    "เอาออกจากรายการโปรดแล้ว": "Removed from favorites",
    "บันทึกไม่สำเร็จ": "Could not save",
    "บัญชีพนักงานใช้ตะกร้า/รายการโปรดไม่ได้ ใช้บัญชีลูกค้าแทน": "Staff accounts can't use the cart or favorites. Please use a customer account.",
    "ยังไม่มีรายการโปรด กดรูปหัวใจที่สินค้าเพื่อบันทึกไว้ดูทีหลัง": "No favorites yet. Tap the heart on a product to save it for later.",
    "อื่นๆ": "others",

    // ---------- ตะกร้า ----------
    "ยังไม่มีสินค้าในตะกร้า": "Your cart is empty",
    "เลือกซื้อสินค้า": "Start shopping",
    "ลบ": "Remove",
    "ที่อยู่จัดส่ง": "Shipping address",
    "ที่อยู่ใหม่": "New address",
    "ที่อยู่หลัก": "Default address",
    "เก็บที่อยู่ไว้ใช้ครั้งต่อไป": "Save this address for next time",
    "ชื่อผู้รับ": "Recipient name",
    "เบอร์โทร": "Phone",
    "บ้านเลขที่ ถนน": "House no., street",
    "ตำบล / แขวง": "Subdistrict",
    "อำเภอ / เขต": "District",
    "จังหวัด": "Province",
    "รหัสไปรษณีย์": "Postcode",
    "ราคาสินค้า": "Subtotal",
    "ค่าส่ง": "Shipping",
    "ฟรี": "Free",
    "รวม": "Total",
    "สั่งซื้อและไปชำระเงิน": "Place order and pay",
    "ชำระเงินด้วยการโอนหรือพร้อมเพย์ แล้วแนบสลิปในหน้าคำสั่งซื้อ": "Pay by bank transfer or PromptPay, then upload the slip on the orders page.",
    "มีสินค้าหมด ลบออกก่อนสั่งซื้อ": "Some items are out of stock. Remove them before ordering.",
    "โหลดตะกร้าไม่สำเร็จ": "Could not load the cart",
    "กรอกที่อยู่ให้ครบทุกช่อง": "Please fill in every address field",
    "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก": "Postcode must be 5 digits",
    "บันทึกที่อยู่ไม่สำเร็จ": "Could not save the address",
    "บัญชีพนักงานใช้ตะกร้าไม่ได้": "Staff accounts can't use the cart",

    // ---------- คำสั่งซื้อ / ชำระเงิน ----------
    "สั่งซื้อ": "Ordered",
    "แนบสลิป": "Slip uploaded",
    "ชำระแล้ว": "Paid",
    "จัดส่ง": "Shipping",
    "ได้รับของ": "Received",
    "รอชำระเงิน": "Awaiting payment",
    "รอตรวจสลิป": "Checking slip",
    "ชำระแล้ว · รอจัดส่ง": "Paid · awaiting shipment",
    "กำลังจัดส่ง": "In transit",
    "ส่งถึงแล้ว": "Delivered",
    "ยกเลิก": "Cancel",
    "คืนเงินแล้ว": "Refunded",
    "รอจัดส่ง": "Preparing",
    "ส่งไม่สำเร็จ": "Delivery failed",
    "ส่งด้วยรถของร้าน": "Delivered by store truck",
    "เลขพัสดุ": "Tracking no.",
    "ส่งถึง": "Ship to",
    "ยังไม่มีคำสั่งซื้อ": "No orders yet",
    "โหลดคำสั่งซื้อไม่สำเร็จ": "Could not load orders",
    "บัญชีพนักงานไม่มีคำสั่งซื้อ": "Staff accounts have no orders",
    "สแกนจ่ายด้วยพร้อมเพย์": "Scan to pay with PromptPay",
    "บันทึกรูป QR": "Save QR image",
    "ยังไม่มี QR": "No QR yet",
    "สแกน QR แล้วแอปธนาคารจะขึ้นยอดนี้ให้เลย ไม่ต้องพิมพ์เอง": "Scan the QR and your banking app fills in this amount for you.",
    "แนบสลิป (JPG/PNG/PDF ไม่เกิน 5 MB)": "Upload slip (JPG/PNG/PDF, max 5 MB)",
    "ส่งสลิป": "Send slip",
    "เลือกไฟล์สลิปก่อน": "Choose a slip file first",
    "สลิปต้องเป็น JPG, PNG หรือ PDF": "The slip must be JPG, PNG or PDF",
    "สลิปต้องไม่เกิน 5 MB": "The slip must be 5 MB or smaller",
    "อัปโหลดสลิปไม่สำเร็จ": "Could not upload the slip",
    "ส่งสลิปแล้ว รอฝ่ายบัญชีตรวจ": "Slip sent. Waiting for accounting to check it.",
    "แชทเรื่องคำสั่งซื้อนี้": "Chat about this order",
    "ยกเลิกคำสั่งซื้อ (คืนเงิน)": "Cancel order (refund)",
    "ยกเลิกคำสั่งซื้อนี้และขอคืนเงินใช่หรือไม่?": "Cancel this order and request a refund?",
    "ขอคืนเงิน / คืนสินค้า": "Refund / return items",
    "ใส่จำนวนที่จะคืนของแต่ละรายการ รายการที่ไม่คืนใส่ 0": "Enter how many of each item to return. Enter 0 for items you keep.",
    "เหตุผล": "Reason",
    "สินค้าชำรุด": "Damaged item",
    "ส่งสินค้าผิด": "Wrong item sent",
    "ยกเลิกก่อนส่ง": "Cancelled before shipping",
    "อธิบายเพิ่มเติม (ไม่บังคับ)": "More details (optional)",
    "ยอดคืนโดยประมาณ": "Estimated refund",
    "(ไม่รวมค่าส่ง ฝ่ายบัญชีจะยืนยันยอดอีกครั้ง)": "(excludes shipping; accounting will confirm the amount)",
    "ส่งคำขอคืน": "Send request",
    "เลือกจำนวนที่จะคืนอย่างน้อย 1 ชิ้น": "Choose at least 1 item to return",
    "ส่งคำขอคืนเงินแล้ว รอฝ่ายบัญชีพิจารณา": "Refund request sent. Waiting for accounting to review it.",
    "รอพิจารณา": "Under review",
    "อนุมัติแล้ว รอโอนคืน": "Approved, refund pending",
    "ไม่อนุมัติ": "Rejected",
    "โอนคืนแล้ว": "Refunded",
    "คืนเงิน": "Refund",
    "ไม่ผ่าน": "rejected",

    // ---------- แชท ----------
    "เริ่มแชทใหม่": "New chat",
    "ฝ่ายบริการลูกค้า HomPB": "HomPB Customer Service",
    "รอเจ้าหน้าที่": "Waiting for staff",
    "กำลังคุย": "In progress",
    "ปิดแล้ว": "Closed",
    "แชททั่วไป": "General chat",
    "แชทนี้ปิดแล้ว": "This chat is closed",
    "เจ้าหน้าที่จะตอบในช่วงเวลาทำการ": "Staff reply during business hours",
    "พิมพ์คำถามได้เลย เช่น สอบถามสินค้า การจัดส่ง หรือการชำระเงิน": "Ask anything, e.g. about products, delivery or payment.",
    "พิมพ์ข้อความ…": "Type a message…",
    "ข้อความ": "Message",
    "ส่ง": "Send",
    "คุณ": "You",
    "[รูปภาพ]": "[Image]",
    "โหลดแชทไม่สำเร็จ": "Could not load chats",
    "เริ่มแชทไม่สำเร็จ": "Could not start the chat",
    "พนักงานตอบแชทได้ที่หน้าฝ่ายบริการลูกค้า": "Staff reply to chats from the customer service page",

    // ---------- login / สมัครสมาชิก ----------
    "← กลับหน้าแรก": "← Back to home",
    "ยินดีต้อนรับ": "Welcome",
    "ใช้อีเมลและรหัสผ่านที่สมัครไว้": "Use the email and password you signed up with",
    "เข้าสู่ระบบเพื่อสั่งซื้อ ติดตามพัสดุ และแชทกับฝ่ายบริการลูกค้า": "Log in to order, track parcels and chat with customer service",
    "ยังไม่มีบัญชี?": "No account yet?",
    "มีบัญชีอยู่แล้ว?": "Already have an account?",
    "อีเมล": "Email",
    "รหัสผ่าน": "Password",
    "ยืนยันรหัสผ่าน": "Confirm password",
    "พิมพ์รหัสผ่านอีกครั้ง": "Type the password again",
    "อย่างน้อย 6 ตัว": "At least 6 characters",
    "แสดงรหัสผ่าน": "Show password",
    "ซ่อนรหัสผ่าน": "Hide password",
    "ชื่อ-นามสกุล": "Full name",
    "ชื่อ นามสกุล": "First and last name",
    "สมัครสมาชิก HomPB": "Sign up for HomPB",
    "กรอกข้อมูลด้านล่างเพื่อสร้างบัญชีใหม่": "Fill in the form below to create an account",
    "สร้างบัญชีครั้งเดียว ช้อปของใช้ได้ครบทุกห้องในบ้าน": "Create an account once and shop for every room in your home",
    "สมัครสมาชิก HomPB เพื่อบันทึกสินค้า ดูประวัติคำสั่งซื้อ และติดตามพัสดุได้ทุกเมื่อ ข้อมูลส่วนตัวของคุณถูกเก็บเป็นความลับ": "Sign up to save products, see your order history and track parcels any time. Your personal data is kept private.",
    "กำลังดำเนินการ…": "Working…",
    "กรอกชื่อ-นามสกุล": "Enter your full name",
    "อีเมลไม่ถูกต้อง": "Invalid email",
    "กรอกรหัสผ่าน": "Enter your password",
    "รหัสผ่านต้องมีอย่างน้อย 6 ตัว": "Password must be at least 6 characters",
    "รหัสผ่านทั้งสองช่องไม่ตรงกัน": "The passwords don't match",
    "ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ในอีเมลที่ส่งไปก่อน": "Email not confirmed yet. Open the link we emailed you first.",
    "อีเมลหรือรหัสผ่านไม่ถูกต้อง": "Incorrect email or password",
    "บัญชีนี้ถูกปิดใช้งาน ติดต่อร้านค้า": "This account is disabled. Please contact the store.",
    "อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบแทน": "This email already has an account. Try logging in.",
    "อีเมลนี้รับอีเมลไม่ได้ ใช้อีเมลจริงที่เปิดอ่านได้ เช่น Gmail": "This address can't receive email. Use a real inbox such as Gmail.",
    "ตอนนี้มีคนสมัครเยอะ ระบบส่งอีเมลยืนยันไม่ทัน ลองใหม่อีกครั้งในอีกประมาณ 1 ชั่วโมง": "Too many sign-ups right now. Please try again in about an hour.",
    "สมัครเสร็จแล้ว เปิดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบ": "Signed up! Open the confirmation link in your email before logging in.",

    // ---------- โปรไฟล์ ----------
    "← กลับไปหน้าร้าน": "← Back to the store",
    "ข้อมูลส่วนตัว": "Personal information",
    "แก้ไขข้อมูลส่วนตัว": "Edit personal information",
    "✎ แก้ไขโปรไฟล์": "✎ Edit profile",
    "แก้ไขโปรไฟล์": "Edit profile",
    "✕ ยกเลิกการแก้ไข": "✕ Cancel editing",
    "✎ เปลี่ยนรูป": "✎ Change photo",
    "รูปโปรไฟล์": "Profile photo",
    "เบอร์โทรศัพท์": "Phone number",
    "อีเมลใช้เข้าสู่ระบบ เปลี่ยนไม่ได้": "Your email is used to log in and can't be changed",
    "อีเมลใช้เข้าสู่ระบบ เปลี่ยนในหน้านี้ไม่ได้": "Your email is used to log in and can't be changed here",
    "+ เพิ่มที่อยู่": "+ Add address",
    "✓ บันทึก": "✓ Save",
    "☀️ โหมดสว่าง": "☀️ Light mode",
    "🌙 โหมดมืด": "🌙 Dark mode",
    "ยังไม่ได้ตั้งชื่อ": "No name yet",
    "โหลดที่อยู่ไม่สำเร็จ": "Could not load addresses",
    "เปลี่ยนรูปโปรไฟล์แล้ว ✓": "Profile photo changed ✓",
    "บันทึกโปรไฟล์แล้ว ✓": "Profile saved ✓",
    "กรุณากรอกชื่อ-นามสกุล": "Please enter your full name",
    "กรุณากรอกเบอร์โทรศัพท์": "Please enter your phone number",
    "กรุณากรอกที่อยู่ให้ครบทุกช่อง": "Please fill in every address field",
    "ลูกค้า": "Customer",

    // ---------- ชื่อแท็บ ----------
    "HomPB": "HomPB",
  };

  // เดือนแบบย่อของ toLocaleString("th-TH")
  const MONTHS = { "ม.ค.": "Jan", "ก.พ.": "Feb", "มี.ค.": "Mar", "เม.ย.": "Apr", "พ.ค.": "May", "มิ.ย.": "Jun",
    "ก.ค.": "Jul", "ส.ค.": "Aug", "ก.ย.": "Sep", "ต.ค.": "Oct", "พ.ย.": "Nov", "ธ.ค.": "Dec" };
  const MON_RE = new RegExp("(\\d{1,2}) (" + Object.keys(MONTHS).map((m) => m.replace(/\./g, "\\.")).join("|") + ")(?: (\\d{4}))?", "g");
  const date = (s) => s.replace(MON_RE, (_, d, m, y) => `${d} ${MONTHS[m]}${y ? " " + (Number(y) - 543) : ""}`);

  // ข้อความที่มีตัวเลข / ชื่อ ปนอยู่ (ลองทีละแบบ ตัวแรกที่ตรงชนะ)
  const PATTERNS = [
    [/^(\d[\d,]*) รายการ$/, (m) => `${m[1]} items`],
    [/^(\d[\d,]*) รายการ · สินค้าตัวอย่าง \(เร็วๆ นี้\) (\d[\d,]*) รายการ$/, (m) => `${m[1]} items · ${m[2]} sample items (coming soon)`],
    [/^ผลการค้นหา “(.*)”$/, (m) => `Results for “${m[1]}”`],
    [/^\/ ผลการค้นหา “(.*)”$/, (m) => `/ Results for “${m[1]}”`],
    [/^\/ (.+)$/, (m) => `/ ${tr(m[1]) ?? m[1]}`],
    [/^สินค้า(.+)อื่นๆ$/, (m) => `More from ${tr(m[1]) ?? m[1]}`],
    [/^รวม (฿[\d,.]+)$/, (m) => `Total ${m[1]}`],
    [/^ค่าส่ง (฿[\d,.]+)$/, (m) => `Shipping ${m[1]}`],
    [/^โอน (฿[\d,.]+)$/, (m) => `Transfer ${m[1]}`],
    [/^(฿[\d,.]+) \/ ชิ้น$/, (m) => `${m[1]} / pc`],
    [/^คืนได้อีก (\d+) ชิ้น$/, (m) => `${m[1]} more can be returned`],
    [/^QR พร้อมเพย์ ยอด (฿[\d,.]+)$/, (m) => `PromptPay QR for ${m[1]}`],
    [/^คำสั่งซื้อ (\S+)$/, (m) => `Order ${m[1]}`],
    [/^(.+) ·$/, (m) => { const t = tr(m[1]); return t == null ? null : `${t} ·`; }],
    [/^· (.+)$/, (m) => { const t = tr(m[1]); return t == null ? null : `· ${t}`; }],
    [/^โอนภายใน (.+) ไม่อย่างนั้นคำสั่งซื้อจะถูกยกเลิก$/, (m) => `Pay by ${date(m[1])} or the order will be cancelled`],
    [/^สลิปครั้งที่ (\d+) ไม่ผ่าน: (.*)$/, (m) => `Slip #${m[1]} rejected: ${m[2]}`],
    [/^ส่งใหม่ได้อีก (\d+) ครั้ง$/, (m) => `${m[1]} more attempt(s) left`],
    [/^คืนเงิน (฿[\d,.]+) \((.+)\)$/, (m) => `Refund ${m[1]} (${tr(m[2]) ?? m[2]})`],
    [/^บันทึก (.+) ในรายการโปรด$/, (m) => `Save ${m[1]} to favorites`],
    [/^เพิ่ม (.+) ลงตะกร้า$/, (m) => `Add ${m[1]} to cart`],
    [/^จำนวนที่คืน (.+)$/, (m) => `Quantity to return: ${m[1]}`],
    [/^สินค้า (.+) มีไม่พอ$/, (m) => `Not enough stock for ${m[1]}`],
    [/^สวัสดี,? (.+)$/, (m) => `Hello, ${m[1]}`],
    [/^(.+): (.+)$/, (m) => (DICT[m[1]] ? `${DICT[m[1]]}: ${tr(m[2]) ?? m[2]}` : null)],
  ];

  // คำเดียวกันแต่ความหมายต่างตามที่อยู่: ป้ายสถานะ (.pill) "ยกเลิก" = ถูกยกเลิกแล้ว ไม่ใช่ปุ่มยกเลิก
  const IN_PILL = { "ยกเลิก": "Cancelled", "ไม่ผ่าน": "Rejected" };

  function tr(raw) {
    const s = raw.replace(/\s+/g, " ").trim();
    if (!s || !/[฀-๿]/.test(s)) return null;
    if (DICT[s] !== undefined) return DICT[s];
    for (const [re, fn] of PATTERNS) {
      re.lastIndex = 0;
      if (re.global) continue;
      const m = s.match(re);
      if (m) {
        const r = fn(m);
        if (r != null) return r;
      }
    }
    // ข้อความหลายส่วน: แปลทีละส่วน (เช่น "กำลังจัดส่ง · Kerry Express · เลขพัสดุ", "หน้าแรก | HomPB")
    for (const sep of [" · ", " | ", " / "]) {
      if (s.includes(sep)) {
        const parts = s.split(sep).map((p) => tr(p) ?? date(p));
        const out = parts.join(sep);
        if (out !== s) return out;
      }
    }
    const d = date(s);
    return d !== s ? d : null;
  }
  window.trText = (s) => tr(String(s)) ?? s;

  const ATTRS = ["placeholder", "aria-label", "title", "alt"];
  function translateNode(n) {
    if (n.nodeType === 3) {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName) || p.closest("[data-no-tr]")) return;
      const key = n.nodeValue.replace(/\s+/g, " ").trim();
      const t = (p.closest(".pill") && IN_PILL[key]) || tr(n.nodeValue);
      if (t != null) {
        const lead = n.nodeValue.match(/^\s*/)[0], trail = n.nodeValue.match(/\s*$/)[0];
        const v = lead + t + trail;
        if (v !== n.nodeValue) n.nodeValue = v;
      }
      return;
    }
    if (n.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(n.tagName)) return;
    for (const a of ATTRS) {
      const v = n.getAttribute(a);
      if (v) {
        const t = tr(v);
        if (t != null && t !== v) n.setAttribute(a, t);
      }
    }
    if (n.tagName === "INPUT" && /^(button|submit)$/.test(n.type) && n.value) {
      const t = tr(n.value);
      if (t) n.value = t;
    }
    for (const c of n.childNodes) translateNode(c);
  }
  const doTitle = () => {
    const t = tr(document.title);
    if (t && t !== document.title) document.title = t;
  };

  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") translateNode(m.target);
      else if (m.type === "attributes") translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
    doTitle();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener("DOMContentLoaded", () => {
    translateNode(document.body);
    doTitle();
  });

  // กล่องข้อความของเบราว์เซอร์ (confirm / alert / prompt) ไม่อยู่ใน DOM แปลก่อนแสดง
  for (const fn of ["confirm", "alert", "prompt"]) {
    const orig = window[fn].bind(window);
    window[fn] = (msg, ...rest) => orig(msg == null ? msg : tr(String(msg)) ?? msg, ...rest);
  }
})();
