-- ========== สินค้าเริ่มต้นของร้าน (164 รายการ) ==========
-- รันใน Supabase Dashboard > SQL Editor (รันเป็น postgres จึงข้าม RLS ได้) รันซ้ำได้ ไม่สร้างของซ้ำ
--
-- ต่อสินค้า 1 ชิ้น: products + product_variants (ราคา/สต็อก) + product_categories (ห้อง) + product_images
-- รูปใช้ไฟล์ในเว็บ img/products/... (image_path ขึ้นต้นด้วย img/ = รูปในเว็บ ไม่ใช่ Storage ดู imgUrl ใน js/shop.js)
-- สินค้าที่มีชื่อนี้อยู่แล้ว ไม่สร้างใหม่ แค่เติมส่วนที่ยังไม่มี (รายละเอียด ราคา ห้อง รูป)
-- ของชิ้นใหญ่ส่งด้วยรถร้าน (store_truck) สต็อกเริ่ม 10 ที่เหลือส่งขนส่ง (carrier) สต็อกเริ่ม 20

begin;

create temp table seed (zone text, name text, description text, price numeric(10,2), delivery delivery_method, stock int, sku text, image_path text) on commit drop;

insert into seed values
  ('ห้องนอน', 'หมอน', 'หมอนหนุนผ้าฝ้ายสีขาว นุ่ม ไม่ยุบง่าย ใช้ได้ทั้งบนเตียงและโซฟา', 500, 'carrier', 20, 'HPB-BED-001', 'img/products/bed/pillow.jpg'),
  ('ห้องนอน', 'ผ้าห่ม', 'ผ้าห่มสีเทา เนื้อนุ่ม ห่มสบายได้ทุกฤดู', 590, 'carrier', 20, 'HPB-BED-002', 'img/products/bed/blanket.jpg'),
  ('ห้องนอน', 'เตียงนอนพร้อมที่นอน', 'เตียงหัวบุผ้าพร้อมที่นอนพ็อกเก็ตสปริง ขนาด 6 ฟุต', 15900, 'store_truck', 10, 'HPB-BED-003', 'img/products/bed/bed-mattress.jpg'),
  ('ห้องนอน', 'ตู้เสื้อผ้าไม้', 'ตู้เสื้อผ้าไม้ 3 บาน มีราวแขวนและชั้นวาง', 8900, 'store_truck', 10, 'HPB-BED-004', 'img/products/bed/wardrobe.jpg'),
  ('ห้องนอน', 'โต๊ะข้างเตียงพร้อมโคมไฟ', 'โต๊ะข้างเตียงไม้มีลิ้นชัก มาพร้อมโคมไฟตั้งโต๊ะ', 2490, 'carrier', 20, 'HPB-BED-005', 'img/products/bed/nightstand-lamp.jpg'),
  ('ห้องนอน', 'โต๊ะเครื่องแป้งพร้อมกระจก', 'โต๊ะเครื่องแป้งไม้พร้อมกระจกกลมและสตูลนั่ง', 4590, 'store_truck', 10, 'HPB-BED-006', 'img/products/bed/dressing-table.jpg'),
  ('ห้องนอน', 'ม้านั่งปลายเตียงบุนวม', 'ม้านั่งบุนวมวางปลายเตียง ขาไม้จริง', 2990, 'store_truck', 10, 'HPB-BED-007', 'img/products/bed/bed-bench.jpg'),
  ('ห้องนอน', 'ราวแขวนเสื้อผ้า', 'ราวแขวนเสื้อผ้าโครงเหล็กพร้อมชั้นวางรองเท้าด้านล่าง', 890, 'carrier', 20, 'HPB-BED-008', 'img/products/bed/clothes-rack.jpg'),
  ('ห้องนอน', 'กระจกเต็มตัวตั้งพื้น', 'กระจกส่องเต็มตัวกรอบไม้ ตั้งพื้นหรือพิงผนังได้', 1990, 'store_truck', 10, 'HPB-BED-009', 'img/products/bed/floor-mirror.jpg'),
  ('ห้องนอน', 'โต๊ะทำงานและเก้าอี้', 'ชุดโต๊ะทำงานไม้พร้อมเก้าอี้ เหมาะกับมุมทำงานในห้องนอน', 5490, 'store_truck', 10, 'HPB-BED-010', 'img/products/bed/study-desk-chair.jpg'),
  ('ห้องนอน', 'ชุดหมอนหนุน', 'ชุดหมอนหนุน 2 ใบ ใยสังเคราะห์นุ่มฟู', 990, 'carrier', 20, 'HPB-BED-011', 'img/products/bed/pillows-set.jpg'),
  ('ห้องนอน', 'ผ้านวมขนเป็ด', 'ผ้านวมไส้ขนเป็ด อุ่น เบา ระบายอากาศดี', 3490, 'carrier', 20, 'HPB-BED-012', 'img/products/bed/duvet-quilt.jpg'),
  ('ห้องนอน', 'นาฬิกาปลุกดิจิทัล', 'นาฬิกาปลุกจอ LED ปรับความสว่างได้', 450, 'carrier', 20, 'HPB-BED-013', 'img/products/bed/alarm-clock.jpg'),
  ('ห้องนอน', 'ตะกร้าผ้าไม้ไผ่', 'ตะกร้าใส่ผ้าสานไม้ไผ่ มีฝาปิดและถุงผ้าด้านใน', 590, 'carrier', 20, 'HPB-BED-014', 'img/products/bed/laundry-hamper.jpg'),
  ('ห้องนอน', 'ชุดเหยือกน้ำข้างเตียง', 'เหยือกน้ำแก้วพร้อมแก้วครอบ วางข้างเตียง', 390, 'carrier', 20, 'HPB-BED-015', 'img/products/bed/bedside-carafe.jpg'),
  ('ห้องนอน', 'กล่องใส่เครื่องประดับไม้', 'กล่องไม้แบ่งช่องเก็บแหวน ต่างหู และสร้อย', 690, 'carrier', 20, 'HPB-BED-016', 'img/products/bed/jewelry-box.jpg'),
  ('ห้องนอน', 'เครื่องพ่นอโรมาเพิ่มความชื้น', 'เครื่องพ่นไอน้ำใส่น้ำมันหอมระเหยได้ มีไฟกลางคืน', 890, 'carrier', 20, 'HPB-BED-017', 'img/products/bed/aroma-humidifier.jpg'),
  ('ห้องนอน', 'ผ้าม่านกันแสง', 'ผ้าม่านทึบกันแสงได้เกือบทั้งหมด ช่วยให้ห้องเย็นและนอนหลับง่าย', 1290, 'carrier', 20, 'HPB-BED-018', 'img/products/bed/blackout-curtains.jpg'),
  ('ห้องนอน', 'พัดลมไร้ใบพัดตั้งโต๊ะ', 'พัดลมไร้ใบพัด เงียบ ปลอดภัยกับเด็ก มีรีโมท', 2490, 'carrier', 20, 'HPB-BED-019', 'img/products/bed/table-fan.jpg'),
  ('ห้องนอน', 'หมอนอิงตกแต่ง', 'หมอนอิงผ้าลินินพร้อมไส้ ใช้ตกแต่งเตียงหรือโซฟา', 450, 'carrier', 20, 'HPB-BED-020', 'img/products/bed/throw-cushions.jpg'),
  ('ห้องนอน', 'ผ้าปิดตาผ้าไหม', 'ผ้าปิดตาผ้าไหม นุ่ม ไม่กดทับ ช่วยให้หลับสนิท', 290, 'carrier', 20, 'HPB-BED-021', 'img/products/bed/silk-sleeping-mask.jpg'),
  ('ห้องนอน', 'ไม้แขวนเสื้อไม้', 'ไม้แขวนเสื้อไม้จริง ชุด 10 ชิ้น', 350, 'carrier', 20, 'HPB-BED-022', 'img/products/bed/wooden-hangers.jpg'),
  ('ห้องนอน', 'ชั้นวางรองเท้าไม้', 'ชั้นวางรองเท้าไม้ ด้านบนเป็นม้านั่งสำหรับใส่รองเท้า', 1590, 'store_truck', 10, 'HPB-BED-023', 'img/products/bed/shoe-rack-bench.jpg'),
  ('ห้องนอน', 'ผ้าห่มคลุมเตียงไหมพรม', 'ผ้าห่มไหมพรมถักลายหนา ใช้คลุมเตียงหรือห่มบนโซฟา', 890, 'carrier', 20, 'HPB-BED-024', 'img/products/bed/knit-throw-blanket.jpg'),
  ('ห้องนอน', 'กล่องเก็บของใต้เตียง', 'กล่องผ้ามีซิปและหน้าต่างใส เก็บเสื้อผ้าและผ้าห่มใต้เตียง', 390, 'carrier', 20, 'HPB-BED-025', 'img/products/bed/underbed-storage-bag.jpg'),
  ('ห้องนอน', 'โคมไฟติดผนังหัวเตียง', 'โคมไฟติดผนังปรับทิศทางได้ สำหรับอ่านหนังสือบนเตียง', 1190, 'carrier', 20, 'HPB-BED-026', 'img/products/bed/wall-sconce-lamp.jpg'),
  ('ห้องนอน', 'ที่จัดระเบียบโต๊ะทำงานไม้', 'กล่องไม้แบ่งช่องเก็บปากกา โทรศัพท์ และเอกสาร', 490, 'carrier', 20, 'HPB-BED-027', 'img/products/bed/desk-caddy-organizer.jpg'),
  ('ห้องนอน', 'โต๊ะรีดผ้าพับได้', 'โต๊ะรีดผ้าปรับความสูงได้ พับเก็บประหยัดพื้นที่', 790, 'carrier', 20, 'HPB-BED-028', 'img/products/bed/ironing-board.jpg'),
  ('ห้องนอน', 'เตารีดไอน้ำพกพา', 'เตารีดไอน้ำแบบมือถือ รีดผ้าบนไม้แขวนได้เลย', 1290, 'carrier', 20, 'HPB-BED-029', 'img/products/bed/garment-steamer.jpg'),
  ('ห้องนอน', 'เครื่องช่วยนอนหลับไวท์นอยส์', 'เครื่องเปิดเสียงไวท์นอยส์และเสียงธรรมชาติ ตั้งเวลาปิดได้', 990, 'carrier', 20, 'HPB-BED-030', 'img/products/bed/white-noise-machine.jpg'),
  ('ห้องนอน', 'หมอนพนักพิงอ่านหนังสือ', 'หมอนพนักพิงมีที่วางแขน นั่งอ่านหนังสือบนเตียงสบาย', 890, 'carrier', 20, 'HPB-BED-031', 'img/products/bed/reading-pillow.jpg'),
  ('ห้องนอน', 'ฐานรองขาเตียงไม้', 'ฐานรองขาเตียงไม้ ชุด 4 ชิ้น เพิ่มที่เก็บของใต้เตียง', 390, 'carrier', 20, 'HPB-BED-032', 'img/products/bed/bed-risers.jpg'),
  ('ห้องนอน', 'ผ้ารองกันเปื้อนที่นอน', 'ผ้ารองกันน้ำและกันเปื้อน ถอดซักได้', 590, 'carrier', 20, 'HPB-BED-033', 'img/products/bed/mattress-protector.jpg'),
  ('ห้องนอน', 'กระเป๋าผ้าสักหลาดข้างเตียง', 'กระเป๋าผ้าสักหลาดเหน็บข้างที่นอน ใส่รีโมท โทรศัพท์ และหนังสือ', 290, 'carrier', 20, 'HPB-BED-034', 'img/products/bed/bedside-pocket-caddy.jpg'),
  ('ห้องนอน', 'เทียนหอมอโรมา', 'เทียนหอมไขถั่วเหลืองในโถแก้ว จุดได้ประมาณ 40 ชั่วโมง', 350, 'carrier', 20, 'HPB-BED-035', 'img/products/bed/scented-soy-candle.jpg'),
  ('ห้องน้ำ', 'ผ้าขี้ริ้ว', 'ผ้าขี้ริ้วผ้าฝ้ายลายตาราง ซับน้ำดี', 59, 'carrier', 20, 'HPB-BATH-001', 'img/products/bath/rag.jpg'),
  ('ห้องน้ำ', 'โถสุขภัณฑ์ชักโครก', 'ชักโครกแบบสองชิ้น ระบบกดสองจังหวะ ประหยัดน้ำ', 6990, 'store_truck', 10, 'HPB-BATH-002', 'img/products/bath/toilet.jpg'),
  ('ห้องน้ำ', 'อ่างล้างหน้าพร้อมตู้เก็บของ', 'อ่างล้างหน้าเซรามิกบนตู้ไม้แขวนผนัง 2 ลิ้นชัก', 7990, 'store_truck', 10, 'HPB-BATH-003', 'img/products/bath/vanity-sink.jpg'),
  ('ห้องน้ำ', 'ชุดฝักบัวเรนชาวเวอร์', 'ชุดฝักบัวเรนชาวเวอร์พร้อมฝักบัวสายอ่อน', 3490, 'carrier', 20, 'HPB-BATH-004', 'img/products/bath/rain-shower.jpg'),
  ('ห้องน้ำ', 'อ่างอาบน้ำแบบลอยตัว', 'อ่างอาบน้ำอะคริลิกแบบตั้งอิสระ ทรงรี', 18900, 'store_truck', 10, 'HPB-BATH-005', 'img/products/bath/bathtub.jpg'),
  ('ห้องน้ำ', 'ราวแขวนผ้าขนหนูสแตนเลส', 'ราวแขวนผ้าขนหนูสแตนเลสแบบไฟฟ้า อุ่นผ้าให้แห้งไว', 4590, 'carrier', 20, 'HPB-BATH-006', 'img/products/bath/heated-towel-rack.jpg'),
  ('ห้องน้ำ', 'ตู้กระจกส่องหน้าไฟLED', 'ตู้กระจกแขวนผนังมีไฟ LED รอบกรอบ ด้านในมีชั้นเก็บของ', 5990, 'store_truck', 10, 'HPB-BATH-007', 'img/products/bath/led-mirror-cabinet.jpg'),
  ('ห้องน้ำ', 'ชุดขวดกดสบู่เซรามิก', 'ขวดกดสบู่เหลวพร้อมแก้วน้ำเซรามิก', 490, 'carrier', 20, 'HPB-BATH-008', 'img/products/bath/soap-dispenser-set.jpg'),
  ('ห้องน้ำ', 'เครื่องทำน้ำอุ่นไฟฟ้าติดผนัง', 'เครื่องทำน้ำอุ่น 4500 วัตต์ พร้อมฝักบัว มีระบบตัดไฟ', 4290, 'carrier', 20, 'HPB-BATH-009', 'img/products/bath/water-heater.jpg'),
  ('ห้องน้ำ', 'ไดร์เป่าผมไอออนิก', 'ไดร์เป่าผมระบบไอออน ลดผมชี้ฟู ปรับลมร้อน/เย็นได้', 1290, 'carrier', 20, 'HPB-BATH-010', 'img/products/bath/ionic-hair-dryer.jpg'),
  ('ห้องน้ำ', 'เครื่องชั่งน้ำหนักดิจิทัล', 'เครื่องชั่งน้ำหนักกระจกนิรภัย จอดิจิทัล รับน้ำหนักได้ 180 กก.', 590, 'carrier', 20, 'HPB-BATH-011', 'img/products/bath/digital-bathroom-scale.jpg'),
  ('ห้องน้ำ', 'พรมหินเช็ดเท้าซับน้ำไว', 'พรมหินไดอะตอมไมต์ ซับน้ำและแห้งไวในไม่กี่วินาที', 390, 'carrier', 20, 'HPB-BATH-012', 'img/products/bath/diatomite-bath-mat.jpg'),
  ('ห้องน้ำ', 'แปรงขัดห้องน้ำซิลิโคน', 'แปรงขัดชักโครกขนซิลิโคน ไม่อมน้ำ พร้อมฐานวาง', 250, 'carrier', 20, 'HPB-BATH-013', 'img/products/bath/silicone-toilet-brush.jpg'),
  ('ห้องน้ำ', 'ชั้นวางของเข้ามุมห้องน้ำ', 'ชั้นวางสแตนเลส 2 ชั้น เข้ามุมห้องน้ำ', 490, 'carrier', 20, 'HPB-BATH-014', 'img/products/bath/shower-corner-caddy.jpg'),
  ('ห้องน้ำ', 'สายฉีดชำระสแตนเลส', 'ชุดสายฉีดชำระสแตนเลสพร้อมสายและขายึด', 450, 'carrier', 20, 'HPB-BATH-015', 'img/products/bath/bidet-sprayer-set.jpg'),
  ('ห้องน้ำ', 'ห่วงแขวนผ้าเช็ดมือ', 'ห่วงแขวนผ้าเช็ดมือติดผนัง สีดำด้าน', 290, 'carrier', 20, 'HPB-BATH-016', 'img/products/bath/hand-towel-ring.jpg'),
  ('ห้องน้ำ', 'ที่ใส่กระดาษชำระพร้อมชั้นวาง', 'ที่ใส่กระดาษชำระสแตนเลส ด้านบนวางโทรศัพท์ได้', 390, 'carrier', 20, 'HPB-BATH-017', 'img/products/bath/toilet-paper-holder.jpg'),
  ('ห้องน้ำ', 'แปรงสีฟันไฟฟ้าโซนิค', 'แปรงสีฟันไฟฟ้าระบบโซนิค ชาร์จได้ มี 3 โหมด', 1490, 'carrier', 20, 'HPB-BATH-018', 'img/products/bath/electric-toothbrush.jpg'),
  ('ห้องน้ำ', 'เครื่องพ่นน้ำขัดฟันไร้สาย', 'ไหมขัดฟันพลังน้ำแบบไร้สาย ทำความสะอาดซอกฟัน', 1690, 'carrier', 20, 'HPB-BATH-019', 'img/products/bath/water-flosser.jpg'),
  ('ห้องน้ำ', 'ชุดมีดโกนหนวดพร้อมแปรง', 'มีดโกนหนวดแบบใบมีดคู่ พร้อมแปรงขนและขาตั้ง', 1290, 'carrier', 20, 'HPB-BATH-020', 'img/products/bath/classic-shaving-kit.jpg'),
  ('ห้องน้ำ', 'ถาดไม้วางพาดอ่างอาบน้ำ', 'ถาดไม้ไผ่พาดอ่างอาบน้ำ ยืดได้ มีที่วางแท็บเล็ต', 790, 'carrier', 20, 'HPB-BATH-021', 'img/products/bath/bathtub-caddy-tray.jpg'),
  ('ห้องน้ำ', 'กระบอกใส่สำลีและคอตตอนบัด', 'โถอะคริลิกฝาไม้ 2 ชั้น ใส่สำลีและคอตตอนบัด', 290, 'carrier', 20, 'HPB-BATH-022', 'img/products/bath/cotton-swab-jars.jpg'),
  ('ห้องน้ำ', 'ผ้าม่านห้องน้ำกันน้ำ', 'ผ้าม่านห้องน้ำลายวาฟเฟิล กันน้ำ พร้อมห่วง', 490, 'carrier', 20, 'HPB-BATH-023', 'img/products/bath/waffle-shower-curtain.jpg'),
  ('ห้องน้ำ', 'ถังขยะแบบเหยียบสแตนเลส', 'ถังขยะสแตนเลสแบบเหยียบเปิด ฝาปิดนุ่มเงียบ', 590, 'carrier', 20, 'HPB-BATH-024', 'img/products/bath/step-trash-can.jpg'),
  ('ห้องน้ำ', 'จานรองสบู่เซรามิก', 'จานรองสบู่เซรามิกมีร่องระบายน้ำ', 150, 'carrier', 20, 'HPB-BATH-025', 'img/products/bath/ceramic-soap-dish.jpg'),
  ('ห้องน้ำ', 'กระจกแต่งหน้าไฟLEDขยาย', 'กระจกแต่งหน้ามีไฟ LED และเลนส์ขยาย หมุนได้', 890, 'carrier', 20, 'HPB-BATH-026', 'img/products/bath/lighted-makeup-mirror.jpg'),
  ('ห้องน้ำ', 'ใยบวบขัดตัวด้ามยาว', 'ใยบวบธรรมชาติด้ามไม้ยาว ขัดหลังได้ถึง', 190, 'carrier', 20, 'HPB-BATH-027', 'img/products/bath/bath-loofah-scrubber.jpg'),
  ('ห้องน้ำ', 'เครื่องหนีบผมตรงเซรามิก', 'เครื่องหนีบผมแผ่นเซรามิก ร้อนเร็ว ปรับอุณหภูมิได้', 990, 'carrier', 20, 'HPB-BATH-028', 'img/products/bath/hair-straightener.jpg'),
  ('ห้องน้ำ', 'ที่รีดน้ำกระจกซิลิโคน', 'ที่รีดน้ำซิลิโคนสำหรับกระจกห้องน้ำ มีตะขอแขวน', 190, 'carrier', 20, 'HPB-BATH-029', 'img/products/bath/shower-glass-squeegee.jpg'),
  ('ห้องน้ำ', 'ชุดผ้าขนหนูอาบน้ำคอตตอน', 'ผ้าขนหนูคอตตอน 100% ชุด 3 ผืน หนานุ่ม ซับน้ำดี', 790, 'carrier', 20, 'HPB-BATH-030', 'img/products/bath/plush-bath-towels.jpg'),
  ('ห้องน้ำ', 'กล่องทิชชู่กันน้ำติดผนัง', 'กล่องทิชชู่กันน้ำติดผนัง ไม่ต้องเจาะ', 290, 'carrier', 20, 'HPB-BATH-031', 'img/products/bath/waterproof-tissue-box.jpg'),
  ('ห้องน้ำ', 'ม้านั่งเหยียบขับถ่ายเพื่อสุขภาพ', 'ม้านั่งวางเท้าหน้าชักโครก ช่วยให้นั่งถูกท่า', 490, 'carrier', 20, 'HPB-BATH-032', 'img/products/bath/toilet-squatting-stool.jpg'),
  ('ห้องน้ำ', 'ที่ปั๊มส้วมพร้อมฐานรอง', 'ที่ปั๊มส้วมยางพร้อมฐานเก็บ ไม่เลอะพื้น', 290, 'carrier', 20, 'HPB-BATH-033', 'img/products/bath/toilet-plunger-stand.jpg'),
  ('ห้องน้ำ', 'พัดลมระบายอากาศติดเพดาน', 'พัดลมดูดอากาศติดเพดาน เสียงเบา ลดความอับชื้น', 1290, 'carrier', 20, 'HPB-BATH-034', 'img/products/bath/exhaust-ventilation-fan.jpg'),
  ('ห้องนั่งเล่น', 'ทีวี', 'ทีวีจอแบน 43 นิ้ว ภาพคมชัด Full HD', 8990, 'store_truck', 10, 'HPB-LIVING-001', 'img/products/living/tv.jpg'),
  ('ห้องนั่งเล่น', 'โซฟา3ที่นั่ง', 'โซฟาผ้า 3 ที่นั่ง เบาะนุ่ม ขาไม้', 12900, 'store_truck', 10, 'HPB-LIVING-002', 'img/products/living/sofa.jpg'),
  ('ห้องนั่งเล่น', 'โต๊ะกลางห้องนั่งเล่น', 'โต๊ะกลางท็อปไม้ทรงกลม ขาเหล็กดีไซน์โปร่ง', 2990, 'store_truck', 10, 'HPB-LIVING-003', 'img/products/living/coffee-table.jpg'),
  ('ห้องนั่งเล่น', 'ชั้นวางโทรทัศน์', 'ชั้นวางทีวีไม้ มีตู้และช่องวางอุปกรณ์', 4590, 'store_truck', 10, 'HPB-LIVING-004', 'img/products/living/tv-console.jpg'),
  ('ห้องนั่งเล่น', 'เก้าอี้อาร์มแชร์พักผ่อน', 'เก้าอี้อาร์มแชร์บุผ้า ขาไม้ นั่งพักผ่อนสบาย', 4990, 'store_truck', 10, 'HPB-LIVING-005', 'img/products/living/armchair.jpg'),
  ('ห้องนั่งเล่น', 'โคมไฟตั้งพื้นทรงโค้ง', 'โคมไฟตั้งพื้นก้านโค้งฐานหินอ่อน ส่องลงโซฟาได้พอดี', 2590, 'store_truck', 10, 'HPB-LIVING-006', 'img/products/living/arched-floor-lamp.jpg'),
  ('ห้องนั่งเล่น', 'ชั้นวางหนังสือไม้ทรงสูง', 'ชั้นวางหนังสือไม้ 5 ชั้น ทรงสูงประหยัดพื้นที่', 3490, 'store_truck', 10, 'HPB-LIVING-007', 'img/products/living/bookshelf.jpg'),
  ('ห้องนั่งเล่น', 'พรมปูพื้นห้องนั่งเล่น', 'พรมขนสั้นลายกราฟิก ขนาด 160x230 ซม.', 1990, 'carrier', 20, 'HPB-LIVING-008', 'img/products/living/area-rug.jpg'),
  ('ห้องนั่งเล่น', 'เครื่องฟอกอากาศดิจิทัล', 'เครื่องฟอกอากาศแผ่นกรอง HEPA จอแสดงค่าฝุ่น PM2.5', 4990, 'carrier', 20, 'HPB-LIVING-009', 'img/products/living/air-purifier.jpg'),
  ('ห้องนั่งเล่น', 'สมาร์ททีวี4K', 'สมาร์ททีวี 55 นิ้ว ความละเอียด 4K ดูแอปสตรีมมิงได้', 15900, 'store_truck', 10, 'HPB-LIVING-010', 'img/products/living/smart-tv.jpg'),
  ('ห้องนั่งเล่น', 'ลำโพงซาวด์บาร์โฮมเธียเตอร์', 'ลำโพงซาวด์บาร์พร้อมซับวูฟเฟอร์ เชื่อมต่อบลูทูธได้', 3990, 'carrier', 20, 'HPB-LIVING-011', 'img/products/living/soundbar.jpg'),
  ('ห้องนั่งเล่น', 'หุ่นยนต์ดูดฝุ่นอัจฉริยะ', 'หุ่นยนต์ดูดฝุ่นและถูพื้น สั่งงานผ่านแอปได้', 8990, 'carrier', 20, 'HPB-LIVING-012', 'img/products/living/robot-vacuum.jpg'),
  ('ห้องนั่งเล่น', 'เครื่องดูดฝุ่นไร้สาย', 'เครื่องดูดฝุ่นไร้สายแบบด้ามจับ ใช้งานได้นาน 40 นาที', 5990, 'carrier', 20, 'HPB-LIVING-013', 'img/products/living/cordless-vacuum.jpg'),
  ('ห้องนั่งเล่น', 'เครื่องปรับอากาศติดผนัง', 'แอร์ติดผนังอินเวอร์เตอร์ 12000 BTU ประหยัดไฟเบอร์ 5', 14900, 'store_truck', 10, 'HPB-LIVING-014', 'img/products/living/air-conditioner.jpg'),
  ('ห้องนั่งเล่น', 'พัดลมตั้งพื้น', 'พัดลมตั้งพื้น 16 นิ้ว ปรับระดับได้ 3 ระดับ', 1290, 'carrier', 20, 'HPB-LIVING-015', 'img/products/living/standing-pedestal-fan.jpg'),
  ('ห้องนั่งเล่น', 'ที่ใส่นิตยสารหนังและโลหะ', 'ที่ใส่นิตยสารโครงโลหะกับหนังเทียม', 690, 'carrier', 20, 'HPB-LIVING-016', 'img/products/living/magazine-rack.jpg'),
  ('ห้องนั่งเล่น', 'โต๊ะข้างทรงกลมซ้อนได้', 'โต๊ะข้างทรงกลม 2 ตัว ซ้อนเก็บได้', 1890, 'carrier', 20, 'HPB-LIVING-017', 'img/products/living/nesting-side-tables.jpg'),
  ('ห้องนั่งเล่น', 'เก้าอี้สตูลกำมะหยี่', 'สตูลบุผ้ากำมะหยี่ ใช้นั่งหรือวางเท้า', 1290, 'carrier', 20, 'HPB-LIVING-018', 'img/products/living/velvet-ottoman.jpg'),
  ('ห้องนั่งเล่น', 'นาฬิกาแขวนผนังมินิมอล', 'นาฬิกาแขวนผนังดีไซน์มินิมอล เข็มเดินเงียบ', 590, 'carrier', 20, 'HPB-LIVING-019', 'img/products/living/wall-clock.jpg'),
  ('ห้องนั่งเล่น', 'ชุดกรอบรูปติดผนัง', 'ชุดกรอบรูปไม้หลายขนาด สำหรับจัดผนังแกลเลอรี', 790, 'carrier', 20, 'HPB-LIVING-020', 'img/products/living/picture-frames-set.jpg'),
  ('ห้องนั่งเล่น', 'กระถางต้นไม้พร้อมขาตั้งไม้', 'กระถางเซรามิกพร้อมขาตั้งไม้ สำหรับต้นไม้ในบ้าน', 690, 'carrier', 20, 'HPB-LIVING-021', 'img/products/living/indoor-planter-pot.jpg'),
  ('ห้องนั่งเล่น', 'ลำโพงบลูทูธไร้สาย', 'ลำโพงบลูทูธพกพา เสียงเบสแน่น แบตอยู่ได้ 12 ชั่วโมง', 1490, 'carrier', 20, 'HPB-LIVING-022', 'img/products/living/bluetooth-speaker.jpg'),
  ('ห้องนั่งเล่น', 'ตู้ไซด์บอร์ดเก็บของ', 'ตู้ไซด์บอร์ดไม้ บานเลื่อน เก็บของได้เยอะ', 6990, 'store_truck', 10, 'HPB-LIVING-023', 'img/products/living/sideboard-credenza.jpg'),
  ('ห้องนั่งเล่น', 'ที่แขวนเสื้อคลุมและหมวกไม้', 'ที่แขวนเสื้อแบบตั้งพื้นทำจากไม้ แขวนเสื้อ หมวก และกระเป๋า', 990, 'carrier', 20, 'HPB-LIVING-024', 'img/products/living/coat-hat-rack-stand.jpg'),
  ('ห้องนั่งเล่น', 'รถเข็นบาร์เสิร์ฟเครื่องดื่ม', 'รถเข็น 2 ชั้นโครงโลหะ วางเครื่องดื่มและแก้ว', 2490, 'carrier', 20, 'HPB-LIVING-025', 'img/products/living/rolling-bar-cart.jpg'),
  ('ห้องนั่งเล่น', 'เบาะรองนั่งสไตล์ทาทามิ', 'เบาะรองนั่งพื้นสไตล์ญี่ปุ่น หนานุ่ม', 590, 'carrier', 20, 'HPB-LIVING-026', 'img/products/living/tatami-floor-cushion.jpg'),
  ('ห้องนั่งเล่น', 'เชิงเทียนโลหะสีดำ', 'เชิงเทียนโลหะสีดำ ชุด 3 ชิ้น สูงไม่เท่ากัน', 390, 'carrier', 20, 'HPB-LIVING-027', 'img/products/living/taper-candle-holders.jpg'),
  ('ห้องนั่งเล่น', 'แจกันดอกไม้เซรามิก', 'แจกันเซรามิกเคลือบด้าน ใส่ดอกไม้สดหรือดอกไม้แห้ง', 450, 'carrier', 20, 'HPB-LIVING-028', 'img/products/living/ceramic-flower-vase.jpg'),
  ('ห้องนั่งเล่น', 'ชุดจานรองแก้วไม้', 'จานรองแก้วไม้ ชุด 6 ชิ้น พร้อมที่วาง', 190, 'carrier', 20, 'HPB-LIVING-029', 'img/products/living/wood-drink-coasters.jpg'),
  ('ห้องนั่งเล่น', 'กล่องจัดระเบียบสายไฟ', 'กล่องเก็บปลั๊กพ่วงและสายไฟให้เรียบร้อย', 350, 'carrier', 20, 'HPB-LIVING-030', 'img/products/living/cable-management-box.jpg'),
  ('ห้องนั่งเล่น', 'ที่ใส่รีโมทหนัง', 'กล่องหนังเทียมแบ่งช่องใส่รีโมทและของชิ้นเล็ก', 290, 'carrier', 20, 'HPB-LIVING-031', 'img/products/living/remote-control-caddy.jpg'),
  ('ห้องนั่งเล่น', 'ฉากกั้นห้องไม้พับได้', 'ฉากกั้นห้องไม้ 4 บาน พับเก็บได้', 2490, 'store_truck', 10, 'HPB-LIVING-032', 'img/products/living/folding-room-divider.jpg'),
  ('ห้องนั่งเล่น', 'กล่องใส่ทิชชู่ฝาไม้', 'กล่องใส่ทิชชู่ตัวกล่องขาว ฝาไม้', 290, 'carrier', 20, 'HPB-LIVING-033', 'img/products/living/tissue-box-cover.jpg'),
  ('ห้องนั่งเล่น', 'ชั้นวางของติดผนังไม้', 'ชั้นไม้ลอยติดผนัง ชุด 3 แผ่น', 690, 'carrier', 20, 'HPB-LIVING-034', 'img/products/living/floating-wall-shelves.jpg'),
  ('ห้องครัว', 'ชาม', 'ชามเซรามิกสีครีม ใส่ข้าว ซุป หรือสลัด', 89, 'carrier', 20, 'HPB-KITCHEN-001', 'img/products/kitchen/bowl.jpg'),
  ('ห้องครัว', 'ตะหลิว', 'ตะหลิวไนลอนด้ามไม้ ทนร้อน ไม่ขูดกระทะเคลือบ', 129, 'carrier', 20, 'HPB-KITCHEN-002', 'img/products/kitchen/spatula.jpg'),
  ('ห้องครัว', 'ตู้เย็น2ประตู', 'ตู้เย็นสแตนเลสแบบ French door มีที่กดน้ำและน้ำแข็ง', 24900, 'store_truck', 10, 'HPB-KITCHEN-003', 'img/products/kitchen/refrigerator.jpg'),
  ('ห้องครัว', 'เตาแม่เหล็กไฟฟ้าฝัง', 'เตาแม่เหล็กไฟฟ้าแบบฝัง 2 หัว ร้อนเร็ว ทำความสะอาดง่าย', 6990, 'carrier', 20, 'HPB-KITCHEN-004', 'img/products/kitchen/induction-cooktop.jpg'),
  ('ห้องครัว', 'เตาอบไมโครเวฟ', 'ไมโครเวฟ 25 ลิตร อุ่นและละลายน้ำแข็งได้', 3490, 'carrier', 20, 'HPB-KITCHEN-005', 'img/products/kitchen/microwave.jpg'),
  ('ห้องครัว', 'ซิงค์ล้างจานสแตนเลส', 'ซิงค์สแตนเลส 2 หลุม พร้อมก๊อกน้ำ', 3990, 'store_truck', 10, 'HPB-KITCHEN-006', 'img/products/kitchen/kitchen-sink.jpg'),
  ('ห้องครัว', 'เครื่องดูดควันสแตนเลส', 'เครื่องดูดควันติดผนังสแตนเลส แรงดูดสูง มีไฟส่องสว่าง', 6490, 'store_truck', 10, 'HPB-KITCHEN-007', 'img/products/kitchen/range-hood.jpg'),
  ('ห้องครัว', 'กาน้ำร้อนไฟฟ้าคอห่าน', 'กาต้มน้ำไฟฟ้าคอห่าน ปรับอุณหภูมิได้ เหมาะกับชงกาแฟดริป', 1290, 'carrier', 20, 'HPB-KITCHEN-008', 'img/products/kitchen/gooseneck-kettle.jpg'),
  ('ห้องครัว', 'หม้อทอดไร้น้ำมันดิจิทัล', 'หม้อทอดไร้น้ำมัน 5 ลิตร จอดิจิทัล มีโหมดสำเร็จรูป', 2490, 'carrier', 20, 'HPB-KITCHEN-009', 'img/products/kitchen/air-fryer.jpg'),
  ('ห้องครัว', 'เตาอบไฟฟ้าบิวท์อิน', 'เตาอบไฟฟ้าแบบฝัง 70 ลิตร มีพัดลมกระจายความร้อน', 12900, 'store_truck', 10, 'HPB-KITCHEN-010', 'img/products/kitchen/built-in-oven.jpg'),
  ('ห้องครัว', 'เครื่องปั่นน้ำผลไม้', 'เครื่องปั่นโถแก้ว 1.5 ลิตร ปั่นน้ำแข็งได้', 1590, 'carrier', 20, 'HPB-KITCHEN-011', 'img/products/kitchen/blender.jpg'),
  ('ห้องครัว', 'เครื่องปิ้งขนมปัง', 'เครื่องปิ้งขนมปัง 2 ช่อง ปรับความกรอบได้', 890, 'carrier', 20, 'HPB-KITCHEN-012', 'img/products/kitchen/toaster.jpg'),
  ('ห้องครัว', 'เครื่องชงกาแฟดริป', 'เครื่องชงกาแฟดริปพร้อมโถแก้ว ชงได้ครั้งละ 10 แก้ว', 1990, 'carrier', 20, 'HPB-KITCHEN-013', 'img/products/kitchen/coffee-maker.jpg'),
  ('ห้องครัว', 'หม้อหุงข้าวไฟฟ้า', 'หม้อหุงข้าวดิจิทัล 1.8 ลิตร มีระบบอุ่นอัตโนมัติ', 1290, 'carrier', 20, 'HPB-KITCHEN-014', 'img/products/kitchen/rice-cooker.jpg'),
  ('ห้องครัว', 'เขียงไม้', 'เขียงไม้จริงมีด้ามจับ ใช้หั่นและเสิร์ฟ', 390, 'carrier', 20, 'HPB-KITCHEN-015', 'img/products/kitchen/cutting-board.jpg'),
  ('ห้องครัว', 'มีดทำครัว', 'มีดเชฟสแตนเลส 8 นิ้ว คมนาน', 690, 'carrier', 20, 'HPB-KITCHEN-016', 'img/products/kitchen/chef-knife.jpg'),
  ('ห้องครัว', 'กระทะทอด', 'กระทะเคลือบกันติด 28 ซม. ใช้กับเตาแม่เหล็กไฟฟ้าได้', 790, 'carrier', 20, 'HPB-KITCHEN-017', 'img/products/kitchen/frying-pan.jpg'),
  ('ห้องครัว', 'หม้อต้มซุปสแตนเลส', 'หม้อสแตนเลสพร้อมฝาแก้ว 8 ลิตร', 1190, 'carrier', 20, 'HPB-KITCHEN-018', 'img/products/kitchen/stock-pot.jpg'),
  ('ห้องครัว', 'ชั้นวางขวดเครื่องเทศ', 'ชั้นวางไม้พร้อมขวดเครื่องเทศแก้ว', 590, 'carrier', 20, 'HPB-KITCHEN-019', 'img/products/kitchen/spice-rack.jpg'),
  ('ห้องครัว', 'ที่คว่ำจานสแตนเลส', 'ที่คว่ำจานสแตนเลส 2 ชั้น พร้อมถาดรองน้ำ', 890, 'carrier', 20, 'HPB-KITCHEN-020', 'img/products/kitchen/dish-drying-rack.jpg'),
  ('ห้องครัว', 'เครื่องเตรียมอาหาร', 'เครื่องบด สับ หั่น และซอยในเครื่องเดียว', 2990, 'carrier', 20, 'HPB-KITCHEN-021', 'img/products/kitchen/food-processor.jpg'),
  ('ห้องครัว', 'เครื่องชั่งดิจิทัล', 'เครื่องชั่งอาหารดิจิทัล ละเอียด 1 กรัม ชั่งได้ถึง 5 กก.', 390, 'carrier', 20, 'HPB-KITCHEN-022', 'img/products/kitchen/kitchen-scale.jpg'),
  ('ห้องครัว', 'ถังขยะเซนเซอร์อัจฉริยะ', 'ถังขยะฝาเปิดอัตโนมัติด้วยเซนเซอร์ ไม่ต้องสัมผัส', 1490, 'carrier', 20, 'HPB-KITCHEN-023', 'img/products/kitchen/sensor-trash-can.jpg'),
  ('ห้องครัว', 'เครื่องทำวาฟเฟิล', 'เครื่องทำวาฟเฟิลแผ่นเคลือบกันติด', 1290, 'carrier', 20, 'HPB-KITCHEN-024', 'img/products/kitchen/waffle-maker.jpg'),
  ('ห้องครัว', 'เครื่องผสมอาหารตั้งโต๊ะ', 'เครื่องผสมอาหารโถสแตนเลส 5 ลิตร พร้อมหัวตี 3 แบบ', 6990, 'carrier', 20, 'HPB-KITCHEN-025', 'img/products/kitchen/stand-mixer.jpg'),
  ('ห้องครัว', 'กระชอนกรองสแตนเลส', 'กระชอนสแตนเลสมีขาตั้ง ล้างผักและสะเด็ดเส้น', 290, 'carrier', 20, 'HPB-KITCHEN-026', 'img/products/kitchen/colander.jpg'),
  ('ห้องครัว', 'ที่บดพริกไทยไม้', 'ที่บดพริกไทยไม้ ปรับความหยาบละเอียดได้', 350, 'carrier', 20, 'HPB-KITCHEN-027', 'img/products/kitchen/pepper-grinder.jpg'),
  ('ห้องครัว', 'บล็อกเก็บมีดไม้', 'บล็อกไม้สำหรับเก็บมีด 5 ช่อง', 690, 'carrier', 20, 'HPB-KITCHEN-028', 'img/products/kitchen/knife-block.jpg'),
  ('ห้องครัว', 'เครื่องกดน้ำดื่ม', 'ตู้กดน้ำร้อนและน้ำเย็น ใช้กับถังน้ำดื่ม', 4990, 'store_truck', 10, 'HPB-KITCHEN-029', 'img/products/kitchen/water-dispenser.jpg'),
  ('ห้องครัว', 'ชุดตะหลิวทัพพีซิลิโคน', 'ชุดตะหลิว ทัพพี และที่คีบซิลิโคน ด้ามไม้', 490, 'carrier', 20, 'HPB-KITCHEN-030', 'img/products/kitchen/cooking-utensils.jpg'),
  ('ห้องครัว', 'เครื่องทำน้ำแข็งก้อน', 'เครื่องทำน้ำแข็งตั้งโต๊ะ ได้น้ำแข็งชุดแรกใน 10 นาที', 4590, 'carrier', 20, 'HPB-KITCHEN-031', 'img/products/kitchen/ice-maker.jpg'),
  ('ห้องครัว', 'ถุงมือกันความร้อน', 'ถุงมือผ้ากันความร้อน 1 คู่', 190, 'carrier', 20, 'HPB-KITCHEN-032', 'img/products/kitchen/oven-mitts.jpg'),
  ('ห้องครัว', 'ชุดถ้วยตวงช้อนตวง', 'ชุดถ้วยตวงและช้อนตวงสแตนเลส', 290, 'carrier', 20, 'HPB-KITCHEN-033', 'img/products/kitchen/measuring-cups.jpg'),
  ('ห้องครัว', 'หม้ออัดแรงดันไฟฟ้า', 'หม้ออัดแรงดันไฟฟ้า 6 ลิตร ตุ๋นเปื่อยไว', 2990, 'carrier', 20, 'HPB-KITCHEN-034', 'img/products/kitchen/pressure-cooker.jpg'),
  ('ห้องครัว', 'ที่ใส่ม้วนกระดาษทิชชู่ครัว', 'ที่ใส่ม้วนกระดาษทิชชู่แบบตั้งโต๊ะ', 290, 'carrier', 20, 'HPB-KITCHEN-035', 'img/products/kitchen/paper-towel-holder.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'กาต้มน้ำไฟฟ้า', 'กาต้มน้ำไฟฟ้าสแตนเลส 1.8 ลิตร ตัดไฟอัตโนมัติ', 790, 'carrier', 20, 'HPB-APPLIANCE-001', 'img/products/appliance/kettle.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องซักผ้าฝาหน้า', 'เครื่องซักผ้าฝาหน้า 9 กก. อินเวอร์เตอร์ ประหยัดไฟและน้ำ', 12900, 'store_truck', 10, 'HPB-APPLIANCE-002', 'img/products/appliance/washing-machine.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องอบผ้า', 'เครื่องอบผ้าระบบฮีตปั๊ม 8 กก. ผ้าแห้งไว ไม่ยับ', 14900, 'store_truck', 10, 'HPB-APPLIANCE-003', 'img/products/appliance/clothes-dryer.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องล้างจานบิวท์อิน', 'เครื่องล้างจานบิวท์อิน 12 ชุด อบแห้งในตัว ประหยัดน้ำ', 18900, 'store_truck', 10, 'HPB-APPLIANCE-004', 'img/products/appliance/dishwasher.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องชงกาแฟเอสเปรสโซ', 'เครื่องชงกาแฟเอสเปรสโซ 15 บาร์ พร้อมก้านสตีมนม', 8990, 'carrier', 20, 'HPB-APPLIANCE-005', 'img/products/appliance/espresso-machine.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องทำแซนด์วิช', 'เครื่องทำแซนด์วิชแผ่นเคลือบกันติด ทำได้ครั้งละ 2 ชิ้น', 890, 'carrier', 20, 'HPB-APPLIANCE-006', 'img/products/appliance/sandwich-maker.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'หม้อตุ๋นไฟฟ้าสโลว์คุกเกอร์', 'หม้อตุ๋นไฟฟ้า 5 ลิตร ตั้งเวลาได้ ตุ๋นเนื้อนุ่มรสเข้ม', 1590, 'carrier', 20, 'HPB-APPLIANCE-007', 'img/products/appliance/slow-cooker.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องปั่นมือถือ', 'เครื่องปั่นมือถือ 800 วัตต์ ใบมีดสแตนเลส ปั่นซุปและสมูทตี้', 990, 'carrier', 20, 'HPB-APPLIANCE-008', 'img/products/appliance/immersion-blender.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องสกัดน้ำผลไม้รอบต่ำ', 'เครื่องสกัดน้ำผลไม้รอบต่ำ แยกกากอัตโนมัติ ได้น้ำผลไม้เข้มข้น', 3990, 'carrier', 20, 'HPB-APPLIANCE-009', 'img/products/appliance/cold-press-juicer.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องทำขนมปังอัตโนมัติ', 'เครื่องทำขนมปังอัตโนมัติ 12 โปรแกรม นวดและอบในเครื่องเดียว', 2990, 'carrier', 20, 'HPB-APPLIANCE-010', 'img/products/appliance/bread-maker.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'หม้อสุกี้ชาบูปิ้งย่างไฟฟ้า', 'หม้อสุกี้พร้อมกระทะปิ้งย่างในตัว ปรับไฟแยกได้ 2 ฝั่ง', 1490, 'carrier', 20, 'HPB-APPLIANCE-011', 'img/products/appliance/electric-hot-pot-grill.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องดูดความชื้นลดกลิ่นอับ', 'เครื่องดูดความชื้น 20 ลิตร/วัน ช่วยลดเชื้อราและกลิ่นอับ', 5990, 'carrier', 20, 'HPB-APPLIANCE-012', 'img/products/appliance/dehumidifier.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'พัดลมเพดานพร้อมโคมไฟLED', 'พัดลมเพดาน 52 นิ้ว พร้อมโคมไฟ LED และรีโมท', 3490, 'store_truck', 10, 'HPB-APPLIANCE-013', 'img/products/appliance/ceiling-fan-light.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'ปลั๊กพ่วงอัจฉริยะ', 'ปลั๊กพ่วง WiFi 4 ช่อง 2 USB สั่งเปิดปิดผ่านมือถือได้', 790, 'carrier', 20, 'HPB-APPLIANCE-014', 'img/products/appliance/smart-power-strip.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'ปัตตาเลี่ยนตัดผมไร้สาย', 'ปัตตาเลี่ยนไร้สาย ใบมีดสแตนเลส พร้อมหวีรอง 4 ขนาด', 790, 'carrier', 20, 'HPB-APPLIANCE-015', 'img/products/appliance/hair-clipper.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องโกนหนวดไฟฟ้า3หัว', 'เครื่องโกนหนวดไฟฟ้า 3 หัว กันน้ำ ใช้โกนขณะอาบน้ำได้', 1990, 'carrier', 20, 'HPB-APPLIANCE-016', 'img/products/appliance/rotary-shaver.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'โปรเจกเตอร์โฮมเธียเตอร์', 'โปรเจกเตอร์ Full HD ภาพใหญ่ถึง 120 นิ้ว ต่อมือถือได้', 7990, 'carrier', 20, 'HPB-APPLIANCE-017', 'img/products/appliance/home-projector.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เก้าอี้นวดไฟฟ้าปรับเอน', 'เก้าอี้นวดไฟฟ้าปรับเอนได้ นวดทั้งตัว 6 โปรแกรม', 29900, 'store_truck', 10, 'HPB-APPLIANCE-018', 'img/products/appliance/massage-recliner.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องเล่นเกมคอนโซลพร้อมจอย', 'เครื่องเล่นเกมคอนโซล 4K พร้อมจอยไร้สาย 1 อัน', 16900, 'carrier', 20, 'HPB-APPLIANCE-019', 'img/products/appliance/gaming-console.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'ตู้แช่ไวน์ขนาดเล็ก', 'ตู้แช่ไวน์ 12 ขวด ปรับอุณหภูมิได้ ประตูกระจกกัน UV', 6990, 'store_truck', 10, 'HPB-APPLIANCE-020', 'img/products/appliance/mini-wine-cooler.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องซีลสุญญากาศถนอมอาหาร', 'เครื่องซีลสุญญากาศ ยืดอายุอาหารได้นานขึ้น 5 เท่า', 1290, 'carrier', 20, 'HPB-APPLIANCE-021', 'img/products/appliance/vacuum-sealer.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องทำป๊อปคอร์น', 'เครื่องทำป๊อปคอร์นลมร้อน ไม่ใช้น้ำมัน พร้อมใน 3 นาที', 690, 'carrier', 20, 'HPB-APPLIANCE-022', 'img/products/appliance/popcorn-maker.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'ฝารองนั่งชักโครกอัจฉริยะ', 'ฝารองนั่งอุ่นได้ มีน้ำฉีดชำระและลมเป่าแห้งในตัว', 8990, 'carrier', 20, 'HPB-APPLIANCE-023', 'img/products/appliance/smart-bidet-seat.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'ผ้าห่มไฟฟ้าปรับอุณหภูมิ', 'ผ้าห่มไฟฟ้าปรับความอุ่นได้ 6 ระดับ ตัดไฟอัตโนมัติ', 1990, 'carrier', 20, 'HPB-APPLIANCE-024', 'img/products/appliance/heated-blanket.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'เครื่องนวดฝ่าเท้าไฟฟ้า', 'เครื่องนวดฝ่าเท้าแบบลูกกลิ้งพร้อมความร้อน', 2490, 'carrier', 20, 'HPB-APPLIANCE-025', 'img/products/appliance/foot-massager.jpg'),
  ('เครื่องใช้ไฟฟ้า', 'แท่นชาร์จไร้สายตั้งโต๊ะ', 'แท่นชาร์จไร้สาย 15 วัตต์ ชาร์จโทรศัพท์และหูฟังได้', 590, 'carrier', 20, 'HPB-APPLIANCE-026', 'img/products/appliance/wireless-charger.jpg');

-- 1. สินค้าใหม่
insert into products (name, description, delivery_method)
select s.name, s.description, s.delivery from seed s
where not exists (select 1 from products p where p.name = s.name);

-- 2. รายละเอียดของสินค้าเดิมที่ยังว่าง
update products p set description = s.description
from seed s where p.name = s.name and coalesce(p.description, '') = '';

-- 3. ราคา/สต็อก (เฉพาะสินค้าที่ยังไม่มี variant)
insert into product_variants (product_id, sku, price, stock_qty)
select p.id, s.sku, s.price, s.stock from seed s join products p on p.name = s.name
where not exists (select 1 from product_variants v where v.product_id = p.id)
on conflict (sku) do nothing;

-- 4. ห้อง (เฉพาะสินค้าที่ยังไม่อยู่ห้องไหน)
insert into product_categories (product_id, category_id)
select p.id, c.id from seed s join products p on p.name = s.name join categories c on c.name = s.zone
where not exists (select 1 from product_categories pc where pc.product_id = p.id);

-- 5. รูป (เฉพาะสินค้าที่ยังไม่มีรูป)
insert into product_images (product_id, image_path, sort_order)
select p.id, s.image_path, 0 from seed s join products p on p.name = s.name
where not exists (select 1 from product_images i where i.product_id = p.id);

commit;

-- เช็กผล: ควรได้ 164 แถว ทุกแถวมีราคา ห้อง และรูป
-- select p.name, v.price, v.stock_qty, c.name as zone, i.image_path
-- from products p
-- left join product_variants v on v.product_id = p.id
-- left join product_categories pc on pc.product_id = p.id left join categories c on c.id = pc.category_id
-- left join product_images i on i.product_id = p.id
-- order by c.name, p.name;
