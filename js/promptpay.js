// ========== QR พร้อมเพย์ที่ใส่ยอดเงินไว้แล้ว (orders.html) ==========
// รูป QR ที่ Admin อัปโหลด (store_settings.promptpay_qr_path) เป็น QR แบบไม่มียอดเงิน
// หน้าเว็บอ่านข้อความใน QR นั้น (มาตรฐาน EMVCo / Thai QR Payment) แล้วสร้าง QR ใหม่ที่ใส่ยอดของคำสั่งซื้อ
// ลูกค้าสแกนแล้วแอปธนาคารขึ้นยอดให้เลย ไม่ต้องพิมพ์เอง
// ต้องโหลด jsQR (อ่าน QR) และ qrcode-generator (สร้าง QR) ก่อนไฟล์นี้

const PROMPTPAY_AID = /A00000067701011[1-4]/; // รหัสพร้อมเพย์ใน tag 29 (โอนเข้าบัญชี/วอลเล็ต) หรือ 30 (bill payment)

// CRC-16/CCITT-FALSE ตามมาตรฐาน EMVCo (คำนวณรวม "6304" ท้ายข้อความ)
function ppCrc(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// แยกข้อความ QR เป็นรายการ [tag, value] คืน null ถ้ารูปแบบไม่ถูก
function ppParse(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len) || i + 4 + len > s.length) return null;
    out.push([tag, s.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

// ข้อความ QR เป็นพร้อมเพย์ที่ใช้ได้ไหม (มี tag ที่จำเป็น และ CRC ถูก)
function ppValid(payload) {
  const t = typeof payload === "string" && ppParse(payload);
  if (!t) return false;
  const crc = t.find(([k]) => k === "63");
  const acct = t.find(([k, v]) => (k === "29" || k === "30") && PROMPTPAY_AID.test(v));
  return !!(acct && crc && payload.endsWith(crc[1]) && ppCrc(payload.slice(0, -4)) === crc[1]);
}

// บัญชีปลายทางใน QR (ให้ Admin เช็กว่าเป็นของร้านจริง) คืน { type, id } หรือ null
// tag 29 ข้างในมี 01 = เบอร์มือถือ (0066xxxxxxxxx), 02 = เลขบัตรประชาชน/เลขผู้เสียภาษี, 03 = e-Wallet
// tag 30 (bill payment) ข้างในมี 01 = Biller ID
function ppAccount(payload) {
  if (!ppValid(payload)) return null;
  const outer = ppParse(payload).find(([k, v]) => (k === "29" || k === "30") && PROMPTPAY_AID.test(v));
  const inner = outer && ppParse(outer[1]);
  if (!inner) return null;
  const get = (t) => inner.find(([k]) => k === t)?.[1];
  if (outer[0] === "30") return get("01") ? { type: "Biller ID", id: get("01") } : null;
  const phone = get("01");
  if (phone) {
    const local = "0" + phone.replace(/^0066/, "").replace(/^0+/, "");
    return { type: "เบอร์มือถือ", id: local.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") };
  }
  if (get("02")) return { type: "เลขประจำตัวประชาชน / ผู้เสียภาษี", id: get("02") };
  if (get("03")) return { type: "e-Wallet", id: get("03") };
  return null;
}

// ใส่ยอดเงิน: tag 01 = 12 (QR ใช้ครั้งเดียว มียอด), tag 54 = ยอด ทศนิยม 2 ตำแหน่ง แล้วคำนวณ CRC ใหม่
function ppWithAmount(payload, amount) {
  if (!ppValid(payload)) return null;
  const amt = Number(amount);
  if (!(amt > 0)) return null;
  const fields = ppParse(payload).filter(([k]) => k !== "54" && k !== "63");
  const v01 = fields.find(([k]) => k === "01");
  if (v01) v01[1] = "12";
  fields.push(["54", amt.toFixed(2)]);
  fields.sort((a, b) => a[0].localeCompare(b[0])); // เรียง tag จากน้อยไปมาก (00 ต้องอยู่หน้าสุด)
  const body = fields.map(([k, v]) => k + String(v.length).padStart(2, "0") + v).join("") + "6304";
  return body + ppCrc(body);
}

// อ่านข้อความจากรูป QR (url ของรูป) คืน null ถ้าอ่านไม่ได้หรือไม่ใช่พร้อมเพย์
async function ppReadImage(url) {
  try {
    if (typeof jsQR !== "function") return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height)); // รูปใหญ่ย่อก่อน อ่านเร็วขึ้น
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; // รูป PNG พื้นใส ให้พื้นขาวก่อน
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const r = jsQR(img.data, img.width, img.height);
    return r && ppValid(r.data) ? r.data : null;
  } catch {
    return null;
  }
}

// รูป QR (data URL) ของข้อความ
function ppImage(text) {
  if (typeof qrcode !== "function") return null;
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createDataURL(8, 4);
}
