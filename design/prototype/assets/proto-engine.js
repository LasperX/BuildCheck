/* ข้อมูลสมมติและตรรกะย่อของต้นแบบ
   - รุ่นทั้งหมดเป็นชื่อสมมติ ("ตัวอย่าง") ไม่ใช่สเปกอะไหล่จริง
   - ตัวเลขชุดเกจไฟตั้งใจใช้ตัวอย่างจากเอกสารหัวข้อ 4.3 (372 W → PSU 500 W)
   - กฎในไฟล์นี้เป็นตัวอย่างบางข้อเพื่อโชว์หน้าจอ ตัว Compatibility Engine จริงจะเขียนใหม่ในเฟส 6 พร้อม Unit test */
(function () {
  const CATS = [
    { k: 'cpu', th: 'CPU', icon: 'cpu', required: true },
    { k: 'mb', th: 'เมนบอร์ด', icon: 'circuit-board', required: true },
    { k: 'ram', th: 'แรม', icon: 'memory-stick', required: true, multi: true },
    { k: 'gpu', th: 'การ์ดจอ', icon: 'gpu' },
    { k: 'storage', th: 'อุปกรณ์เก็บข้อมูล', icon: 'hard-drive', required: true, multi: true },
    { k: 'psu', th: 'PSU', icon: 'plug-zap', required: true },
    { k: 'case', th: 'เคส', icon: 'pc-case', required: true },
    { k: 'cooler', th: 'ชุดระบายความร้อน', icon: 'fan' },
  ];

  // r และ k จากเอกสารหัวข้อ 4.6
  const RATE = { cpu: 0.8, gpu: 0.75, ram: 0.75, mb: 0.7, storage: 0.7, case: 0.7, cooler: 0.7, psu: 0.65 };
  const GRADE = { A: 1, B: 0.9, C: 0.75 };

  const PARTS = {
    cpu: [
      { id: 'A1', name: 'CPU ตัวอย่าง A1', price: 5900, age: 2, socket: 'AM5', gen: 'Gen-A', tdp: 65, igpu: false, fan: true, perf: 62, chips: ['AM5', '6 คอร์', '65 W'] },
      { id: 'A2', name: 'CPU ตัวอย่าง A2', price: 9900, age: 1, socket: 'AM5', gen: 'Gen-A', tdp: 105, igpu: true, fan: false, perf: 81, chips: ['AM5', '8 คอร์', '105 W', 'มีกราฟิกในตัว'] },
      { id: 'B1', name: 'CPU ตัวอย่าง B1', price: 5200, age: 3, socket: 'LGA1700', gen: 'Gen-B', tdp: 65, igpu: false, fan: true, perf: 58, chips: ['LGA1700', '6 คอร์', '65 W'] },
    ],
    mb: [
      { id: 'M1', name: 'เมนบอร์ดตัวอย่าง M1', price: 3900, age: 2, socket: 'AM5', mem: 'DDR5', ff: 'ATX', slots: 4, maxGb: 128, gens: ['Gen-A'], m2: 2, sata: 4, watt: 50, chips: ['AM5', 'DDR5', 'ATX'] },
      { id: 'M2', name: 'เมนบอร์ดตัวอย่าง M2', price: 2900, age: 3, socket: 'LGA1700', mem: 'DDR4', ff: 'mATX', slots: 2, maxGb: 64, gens: ['Gen-B'], m2: 1, sata: 4, watt: 50, chips: ['LGA1700', 'DDR4', 'mATX'] },
      { id: 'M3', name: 'เมนบอร์ดตัวอย่าง M3', price: 5400, age: 1, socket: 'AM5', mem: 'DDR5', ff: 'ITX', slots: 2, maxGb: 96, gens: ['Gen-A'], m2: 1, sata: 2, watt: 50, chips: ['AM5', 'DDR5', 'ITX'] },
      { id: 'M4', name: 'เมนบอร์ดตัวอย่าง M4', price: 3400, age: 3, socket: 'LGA1700', mem: 'DDR5', ff: 'ATX', slots: 4, maxGb: 128, gens: ['Gen-B'], m2: 2, sata: 4, watt: 50, chips: ['LGA1700', 'DDR5', 'ATX'] },
    ],
    ram: [
      { id: 'R1', name: 'แรมตัวอย่าง R1 (2 แถว)', price: 2400, age: 2, type: 'DDR5', gbPer: 16, sticks: 2, chips: ['DDR5', '16 GB × 2', '6000 MT/s'] },
      { id: 'R2', name: 'แรมตัวอย่าง R2 (2 แถว)', price: 1200, age: 3, type: 'DDR4', gbPer: 8, sticks: 2, chips: ['DDR4', '8 GB × 2', '3200 MT/s'] },
      { id: 'R3', name: 'แรมตัวอย่าง R3 (1 แถว)', price: 1300, age: 2, type: 'DDR5', gbPer: 16, sticks: 1, chips: ['DDR5', '16 GB × 1', '5600 MT/s'] },
    ],
    gpu: [
      { id: 'G1', name: 'การ์ดจอตัวอย่าง G1', price: 12000, age: 2, tbp: 220, len: 300, perf: 66, chips: ['8 GB', '220 W', 'ยาว 300 mm'] },
      { id: 'G2', name: 'การ์ดจอตัวอย่าง G2', price: 24000, age: 1, tbp: 350, len: 340, perf: 92, chips: ['16 GB', '350 W', 'ยาว 340 mm'] },
      { id: 'G3', name: 'การ์ดจอตัวอย่าง G3', price: 6900, age: 3, tbp: 130, len: 230, perf: 41, chips: ['8 GB', '130 W', 'ยาว 230 mm'] },
    ],
    storage: [
      { id: 'S1', name: 'SSD ตัวอย่าง S1', price: 1500, age: 1, type: 'NVMe', iface: 'M2', chips: ['NVMe', '1 TB', 'M.2'] },
      { id: 'S2', name: 'HDD ตัวอย่าง S2', price: 1300, age: 3, type: 'HDD', iface: 'SATA', chips: ['HDD', '2 TB', 'SATA'] },
    ],
    psu: [
      { id: 'P1', name: 'PSU ตัวอย่าง P1', price: 1200, age: 3, watt: 450, ff: 'ATX', chips: ['450 W', 'ATX', '80 Plus Bronze'] },
      { id: 'P2', name: 'PSU ตัวอย่าง P2', price: 1500, age: 2, watt: 500, ff: 'ATX', chips: ['500 W', 'ATX', '80 Plus Bronze'] },
      { id: 'P3', name: 'PSU ตัวอย่าง P3', price: 2000, age: 1, watt: 650, ff: 'ATX', chips: ['650 W', 'ATX', '80 Plus Gold'] },
      { id: 'P4', name: 'PSU ตัวอย่าง P4', price: 3200, age: 1, watt: 850, ff: 'ATX', chips: ['850 W', 'ATX', '80 Plus Gold'] },
    ],
    case: [
      { id: 'C1', name: 'เคสตัวอย่าง C1', price: 1500, age: 2, ffs: ['ATX', 'mATX', 'ITX'], gpuMax: 350, coolMax: 165, psuFf: ['ATX'], rad: [240, 360], chips: ['ATX', 'การ์ดจอ ≤ 350 mm'] },
      { id: 'C2', name: 'เคสตัวอย่าง C2', price: 2400, age: 1, ffs: ['ITX'], gpuMax: 280, coolMax: 70, psuFf: ['SFX'], rad: [], chips: ['ITX', 'การ์ดจอ ≤ 280 mm'] },
    ],
    cooler: [
      { id: 'K1', name: 'ซิงก์ลมตัวอย่าง K1', price: 500, age: 2, type: 'air', sockets: ['AM5', 'LGA1700'], h: 155, maxTdp: 180, chips: ['ซิงก์ลม', 'สูง 155 mm', '180 W'] },
      { id: 'K2', name: 'ชุดน้ำตัวอย่าง K2', price: 3200, age: 1, type: 'aio', sockets: ['AM5', 'LGA1700'], rad: 240, maxTdp: 250, chips: ['ชุดน้ำ', '240 mm', '250 W'] },
    ],
  };

  const find = (cat, id) => PARTS[cat].find((p) => p.id === id);

  // สูตรค่าเสื่อม หัวข้อ 4.6: P_used = P_new × r^t × k ปัดเป็นหลัก 50 บาท
  const usedPrice = (cat, part, grade) => Math.round((part.price * RATE[cat] ** part.age * GRADE[grade]) / 50) * 50;

  // ป้ายประเมินราคาที่เจอจริง หัวข้อ 4.6
  const evalOffer = (offer, m) => {
    const r = offer / m;
    if (r < 0.6) return { l: 'err', ic: 'triangle-alert', t: 'ถูกผิดปกติ ระวังของเสียหรือมิจฉาชีพ' };
    if (r < 0.9) return { l: 'ok', ic: 'circle-check', t: 'ถูก' };
    if (r <= 1.1) return { l: 'none', ic: 'scale', t: 'สมเหตุสมผล' };
    return { l: 'warn', ic: 'trending-up', t: 'แพงกว่าตลาด ต่อรองได้' };
  };

  const items = (b, c) => b[c] || [];
  const first = (b, c) => { const it = items(b, c)[0]; return it ? find(c, it.id) : null; };
  const sum = (b, c, fn) => items(b, c).reduce((a, it) => a + fn(find(c, it.id), it.qty, it), 0);

  // สูตรวัตต์ หัวข้อ 4.3
  function power(b) {
    const cpu = first(b, 'cpu'), gpu = first(b, 'gpu'), mb = first(b, 'mb'), cool = first(b, 'cooler');
    const nRam = sum(b, 'ram', (p, q) => p.sticks * q);
    const nSsd = sum(b, 'storage', (p, q) => (p.type === 'HDD' ? 0 : q));
    const nHdd = sum(b, 'storage', (p, q) => (p.type === 'HDD' ? q : 0));
    const any = CATS.some((c) => items(b, c.k).length);
    if (!any) return { total: 0, rec: 0 };
    const total = (cpu ? cpu.tdp : 0) + (gpu ? gpu.tbp : 0) + (mb ? mb.watt : 0) + 5 * nRam + 7 * nSsd + 10 * nHdd + (cool ? (cool.type === 'aio' ? 15 : 5) : 0) + 15;
    return { total, rec: Math.ceil((total * 1.3) / 50) * 50 };
  }

  const unitPrice = (cat, it) => {
    const p = find(cat, it.id);
    if (it.cond !== 'used') return p.price;
    return it.offer ? it.offer : usedPrice(cat, p, it.grade);
  };

  function totals(b) {
    let price = 0, newPrice = 0, count = 0;
    CATS.forEach((c) => items(b, c.k).forEach((it) => {
      price += unitPrice(c.k, it) * it.qty;
      newPrice += find(c.k, it.id).price * it.qty;
      count += it.qty;
    }));
    return { price, newPrice, save: newPrice - price, count };
  }

  // Score หัวข้อ 4.4
  const WEIGHT = { gaming: [0.3, 0.7], office: [0.8, 0.2], creator: [0.5, 0.5], streaming: [0.45, 0.55] };
  function score(b, usage) {
    const cpu = first(b, 'cpu'), gpu = first(b, 'gpu');
    if (!cpu && !gpu) return null;
    const [wc, wg] = WEIGHT[usage];
    return Math.round(wc * (cpu ? cpu.perf : 0) + wg * (gpu ? gpu.perf : 0));
  }

  /* ผลตรวจ: รูปแบบเดียวกับที่ Engine จริงจะคืน: {code, level, title, body, fix, cats, action} */
  function check(b, meta = {}) {
    const out = [];
    const add = (code, level, title, body, cats, action) => out.push({ code, level, title, body, cats, action });
    const cpu = first(b, 'cpu'), mb = first(b, 'mb'), gpu = first(b, 'gpu'), psu = first(b, 'psu'), cs = first(b, 'case'), cool = first(b, 'cooler');

    if (cpu && mb && cpu.socket !== mb.socket) add('R01', 'err', 'Socket ไม่ตรงกัน', `${cpu.name} ใช้ Socket ${cpu.socket} แต่ ${mb.name} ใช้ ${mb.socket} ทั้งสองชิ้นใส่ด้วยกันไม่ได้`, ['cpu', 'mb'], { cat: 'mb', label: `ดูเมนบอร์ด ${cpu.socket} ในงบใกล้เคียง` });
    if (mb) items(b, 'ram').some((it) => {
      const r = find('ram', it.id);
      if (r.type === mb.mem) return false;
      add('R04', 'err', 'ชนิดแรมไม่ตรงกับเมนบอร์ด', `${r.name} เป็น ${r.type} แต่ ${mb.name} รองรับ ${mb.mem} เท่านั้น`, ['ram', 'mb'], { cat: 'ram', label: `ดูแรม ${mb.mem}` });
      return true;
    });
    if (mb) {
      const sticks = sum(b, 'ram', (p, q) => p.sticks * q);
      if (sticks > mb.slots) add('R05', 'err', 'แรมเกินจำนวนช่อง', `เลือกแรมรวม ${sticks} แถว แต่เมนบอร์ดมี ${mb.slots} ช่อง`, ['ram', 'mb'], { cat: 'ram', label: 'ปรับแรม' });
    }
    if (mb && cs && !cs.ffs.includes(mb.ff)) add('R08', 'err', 'เมนบอร์ดใหญ่เกินเคส', `${mb.name} ขนาด ${mb.ff} แต่เคสรองรับ ${cs.ffs.join(', ')}`, ['mb', 'case'], { cat: 'case', label: `ดูเคสที่รองรับ ${mb.ff}` });
    if (gpu && cs && gpu.len > cs.gpuMax) add('R09', 'err', 'การ์ดจอยาวเกินเคส', `การ์ดจอยาว ${gpu.len} mm แต่เคสใส่ได้ไม่เกิน ${cs.gpuMax} mm`, ['gpu', 'case'], { cat: 'case', label: 'ดูเคสที่ใส่การ์ดจอนี้ได้' });
    if (cool && cs && cool.type === 'air' && cool.h > cs.coolMax) add('R10', 'err', 'ซิงก์ลมสูงเกินเคส', `ซิงก์ลมสูง ${cool.h} mm แต่เคสใส่ได้ไม่เกิน ${cs.coolMax} mm`, ['cooler', 'case'], { cat: 'cooler', label: 'ดูชุดระบายความร้อนที่ใส่ได้' });
    if (cool && cs && cool.type === 'aio' && !cs.rad.includes(cool.rad)) add('R11', 'err', 'หม้อน้ำไม่พอดีเคส', `หม้อน้ำ ${cool.rad} mm ไม่อยู่ในรายการที่เคสรองรับ`, ['cooler', 'case'], { cat: 'cooler', label: 'ดูชุดระบายความร้อนที่ใส่ได้' });
    if (cool && cpu && !cool.sockets.includes(cpu.socket)) add('R12', 'err', 'ชุดระบายความร้อนไม่รองรับ Socket', `ไม่รองรับ Socket ${cpu.socket}`, ['cooler', 'cpu'], { cat: 'cooler', label: 'ดูรุ่นที่รองรับ' });
    if (cool && cpu && cool.maxTdp < cpu.tdp) add('R13', 'warn', 'ระบายความร้อนอาจไม่พอ', `รับได้ ${cool.maxTdp} W แต่ CPU มี TDP ${cpu.tdp} W`, ['cooler', 'cpu'], { cat: 'cooler', label: 'ดูรุ่นที่แรงกว่า' });

    const pw = power(b);
    if (psu) {
      if (psu.watt < pw.total) add('R14', 'err', 'PSU ไฟไม่พอ', `สเปกนี้ใช้ไฟประมาณ ${pw.total} W แต่ PSU จ่ายได้ ${psu.watt} W ควรใช้อย่างน้อย ${pw.rec} W`, ['psu', 'gpu'], { cat: 'psu', label: `ดู PSU ${pw.rec} W ขึ้นไป` });
      else if (psu.watt < pw.total * 1.2) add('R14', 'warn', 'PSU เผื่อไฟไม่ถึง 20%', `ใช้ไฟประมาณ ${pw.total} W จาก ${psu.watt} W แนะนำ PSU ${pw.rec} W ขึ้นไป`, ['psu'], { cat: 'psu', label: `ดู PSU ${pw.rec} W ขึ้นไป` });
    }
    if (psu && cs && !cs.psuFf.includes(psu.ff)) add('R15', 'err', 'ขนาด PSU ไม่พอดีเคส', `PSU ขนาด ${psu.ff} แต่เคสรองรับ ${cs.psuFf.join(', ')}`, ['psu', 'case'], { cat: 'case', label: 'ดูเคสที่รองรับ' });
    if (cpu && !cpu.igpu && !gpu) add('R18', 'err', 'ไม่มีภาพออกจอ', `${cpu.name} ไม่มีกราฟิกในตัว ต้องเลือกการ์ดจอด้วย`, ['gpu'], { cat: 'gpu', label: 'เลือกการ์ดจอ' });

    // กฎมือสองบางข้อ หัวข้อ 4.6
    items(b, 'gpu').forEach((it) => { if (it.cond === 'used') add('U01', 'warn', 'การ์ดจอมือสอง', 'ขอดูรันทดสอบ ถามประวัติการใช้ขุดเหรียญ ดูอุณหภูมิ', ['gpu']); });
    items(b, 'psu').forEach((it) => { if (it.cond === 'used') add('U02', 'warn', 'PSU มือสอง', 'PSU เสียอาจพาอะไหล่อื่นเสียด้วย แนะนำซื้อใหม่', ['psu']); });
    items(b, 'storage').forEach((it) => { if (it.cond === 'used') add('U03', 'warn', 'เก็บข้อมูลมือสอง', 'ตรวจค่า Health ไม่ต่ำกว่า 90% ก่อนซื้อ', ['storage']); });
    CATS.forEach((c) => items(b, c.k).forEach((it) => {
      if (it.cond !== 'used' || !it.offer) return;
      const m = usedPrice(c.k, find(c.k, it.id), it.grade);
      if (it.offer < 0.6 * m) add('U06', 'warn', 'ราคาถูกผิดปกติ', `ราคาที่ใส่ต่ำกว่า 60% ของราคากลาง (฿${m.toLocaleString('en-US')})`, [c.k]);
    }));

    // ข้อมูลทั่วไป
    const missing = CATS.filter((c) => c.required && !items(b, c.k).length);
    if (missing.length && missing.length < 6) add('INFO', 'info', 'ยังเลือกอะไหล่ไม่ครบ', 'ยังขาด ' + missing.map((c) => c.th).join(', '), []);
    if (cpu && !cpu.fan && !cool) add('INFO', 'info', 'CPU ไม่มีพัดลมแถม', 'ยังไม่ได้เลือกชุดระบายความร้อน', ['cooler'], { cat: 'cooler', label: 'เลือกชุดระบายความร้อน' });
    if (sum(b, 'ram', (p, q) => p.sticks * q) === 1) add('INFO', 'info', 'ใส่แรมแถวเดียว', 'แนะนำ 2 แถวเพื่อ Dual Channel', ['ram']);
    if (meta.budget && totals(b).price > meta.budget) add('INFO', 'info', 'ราคารวมเกินงบที่ตั้งไว้', `เกินงบ ฿${(totals(b).price - meta.budget).toLocaleString('en-US')}`, []);

    const order = { err: 0, warn: 1, info: 2 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  }

  // QR สมมติ (เว็บจริงสร้างด้วยแพ็กเกจ qrcode) สแกนไม่ได้จริง
  function fakeQR() {
    const n = 25; let d = '';
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let on;
      if (finder(x, y)) {
        const fx = x >= n - 7 ? x - (n - 7) : x, fy = y >= n - 7 ? y - (n - 7) : y;
        on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5);
      } else on = ((x * 7 + y * 13 + x * y) % 5) < 2;
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }
    return `<svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR Code ตัวอย่าง"><path d="${d}" fill="#111"/></svg>`;
  }

  window.BCProto = { CATS, PARTS, GRADE, find, usedPrice, evalOffer, power, totals, score, check, unitPrice, fakeQR };
})();
