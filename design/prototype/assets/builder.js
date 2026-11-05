/* ต้นแบบหน้าจัดสเปก: แสดงการทำงานจริงของ PartSlot, PartPicker, SummaryPanel, PowerGauge, IssueList
   เฟส 7 จะเขียนใหม่ด้วย React + Zustand โดยใช้โครงเดียวกัน */
(function () {
  const { CATS, PARTS, find, usedPrice, evalOffer, power, totals, score, check, unitPrice, fakeQR } = window.BCProto;
  const { baht, esc, icon } = window.BC;
  const $ = (s) => document.querySelector(s);

  const it = (id, extra = {}) => ({ id, qty: 1, cond: 'new', grade: 'B', offer: null, ...extra });
  const base = { cpu: [it('A1')], mb: [it('M1')], ram: [it('R1')], gpu: [it('G1')], storage: [it('S1')], psu: [it('P2')], case: [it('C1')], cooler: [it('K1')] };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const SCEN = {
    empty: {},
    ok: { ...clone(base), gpu: [it('G3')], psu: [it('P3')] },
    doc: clone(base), // ตัวอย่างจากเอกสาร 372 W + PSU 500 W
    r01: { cpu: [it('B1')], mb: [it('M1')], ram: [it('R1')] },
    power: { ...clone(base), gpu: [it('G2')], psu: [it('P1')] },
    used: { ...clone(base), gpu: [it('G1', { cond: 'used', grade: 'B' })], storage: [it('S1', { cond: 'used', grade: 'A' })], psu: [it('P3')], cpu: [it('A1', { cond: 'used', grade: 'B', offer: 2500 })] },
    partial: { cpu: [it('A2')], mb: [it('M1')] },
  };

  const qs = window.BC.params;
  let build = clone(SCEN[qs.get('state')] || SCEN.r01);
  let hist = [], fut = [];
  const push = () => { hist.push(JSON.stringify(build)); fut = []; };

  const budget = () => Number(($('#budget').value || '').replace(/[^\d]/g, '')) || 0;
  const usage = () => $('#usage').value;
  const LV = { err: { ic: 'circle-x', th: 'ผิดพลาด' }, warn: { ic: 'triangle-alert', th: 'เตือน' }, info: { ic: 'info', th: 'ข้อมูล' } };

  const worstFor = (issues, cat) => {
    const list = issues.filter((x) => x.cats.includes(cat) && x.level !== 'info');
    return list.find((x) => x.level === 'err') || list.find((x) => x.level === 'warn') || null;
  };

  function itemHTML(cat, row, idx, multi) {
    const p = find(cat, row.id);
    const used = row.cond === 'used';
    const m = usedPrice(cat, p, row.grade);
    const unit = unitPrice(cat, row);
    let usedRow = '';
    if (used) {
      const ev = row.offer ? evalOffer(row.offer, m) : null;
      usedRow = `
        <select class="select select--sm" style="width:auto" data-act="grade" data-cat="${cat}" data-idx="${idx}" aria-label="เกรดสภาพ">
          ${[['A', 'A ดีมาก มีประกัน'], ['B', 'B ใช้งานปกติ มีรอย'], ['C', 'C มีตำหนิ ไม่มีกล่อง']].map(([g, l]) => `<option value="${g}" ${g === row.grade ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input class="input input--sm mono offer" inputmode="numeric" placeholder="ราคาที่เจอจริง" aria-label="ราคาที่เจอจริง" data-act="offer" data-cat="${cat}" data-idx="${idx}" value="${row.offer || ''}">
        ${ev ? `<span class="price-eval" data-l="${ev.l}">${icon(ev.ic, 'ic-14')}${ev.t}</span>` : ''}
        <span class="conf" style="flex-basis:100%">ราคากลาง <b class="mono">${baht(m)}</b> · <span class="badge badge--neutral" style="height:20px;font-size:12px;padding-inline:6px">ประมาณการ</span> จากสูตรค่าเสื่อม</span>`;
    }
    return `<div class="item">
      <div class="thumb thumb--48">${icon(CATS.find((c) => c.k === cat).icon, 'ic-24')}</div>
      <div style="min-width:0">
        <a class="item__name" href="part.html">${esc(p.name)}</a>
        <div class="chips" style="margin-top:2px">${p.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      </div>
      <span class="seg seg--sm item__cond" role="group" aria-label="สภาพอะไหล่">
        <button data-act="cond" data-v="new" data-cat="${cat}" data-idx="${idx}" aria-pressed="${!used}">มือหนึ่ง</button>
        <button data-act="cond" data-v="used" data-used="1" data-cat="${cat}" data-idx="${idx}" aria-pressed="${used}">${icon('recycle', 'ic-14')}มือสอง</button>
      </span>
      <div class="item__end">
        <div class="item__price mono">${baht(unit * row.qty)}${used ? `<small style="color:var(--used-fg)">ของใหม่ ${baht(p.price * row.qty)}</small>` : ''}</div>
        <div class="item__tools">
          ${multi ? `<span class="stepper" role="group" aria-label="จำนวน"><button data-act="dec" data-cat="${cat}" data-idx="${idx}" aria-label="ลดจำนวน">${icon('minus', 'ic-14')}</button><output>${row.qty}</output><button data-act="inc" data-cat="${cat}" data-idx="${idx}" aria-label="เพิ่มจำนวน">${icon('plus', 'ic-14')}</button></span>` : ''}
          <button class="btn btn--ghost btn--icon btn--sm" data-act="swap" data-cat="${cat}" data-idx="${idx}" aria-label="เปลี่ยนรุ่น" title="เปลี่ยนรุ่น">${icon('pencil', 'ic-16')}</button>
          <button class="btn btn--ghost btn--icon btn--sm" data-act="rm" data-cat="${cat}" data-idx="${idx}" aria-label="เอาออก" title="เอาออก">${icon('trash-2', 'ic-16')}</button>
        </div>
      </div>
      ${used ? `<div class="item__used">${usedRow}</div>` : ''}
    </div>`;
  }

  function renderSlots(issues) {
    $('#slots').innerHTML = CATS.map((c) => {
      const rows = build[c.k] || [];
      const w = worstFor(issues, c.k);
      const spaced = /^[A-Z]/.test(c.th) ? ' ' : ''; // เว้นวรรคหน้าคำภาษาอังกฤษ เช่น "เลือก PSU"
      const hint = w ? `<div class="slot__hint" data-l="${w.level}">${icon(LV[w.level].ic, 'ic-16')}<span><span class="mono" style="font-weight:600">${w.code}</span> ${esc(w.title)} · <a class="link" href="#issues" style="color:inherit;text-decoration:underline">ดูวิธีแก้</a></span></div>` : '';
      const head = `<div class="slot__cat"><span style="font-weight:600;color:var(--text)">${c.th}</span>${c.required ? '<span class="req">· จำเป็น</span>' : ''}</div>`;
      const body = rows.length
        ? `${head}<div style="margin-top:var(--s-1)">${rows.map((r, i) => itemHTML(c.k, r, i, c.multi)).join('')}</div>${c.multi ? `<button class="btn btn--ghost btn--sm slot__more" data-act="add" data-cat="${c.k}">${icon('plus', 'ic-14')}เพิ่ม${c.th}อีกชิ้น</button>` : ''}`
        : `<div class="slot__empty"><div>${head}<div class="t-xs faint">${c.k === 'gpu' ? 'ไม่บังคับถ้า CPU มีกราฟิกในตัว' : c.k === 'cooler' ? 'ไม่บังคับถ้า CPU มีพัดลมแถม' : 'ยังไม่ได้เลือก'}</div></div><button class="btn btn--secondary btn--sm" data-act="add" data-cat="${c.k}">${icon('plus', 'ic-14')}เลือก${spaced}${c.th}</button></div>`;
      return `<article class="slot ${rows.length ? 'slot--filled' : ''}" ${w ? `data-l="${w.level}"` : ''} aria-label="${c.th}">${rows.length ? '' : `<div class="slot__icon">${icon(c.icon)}</div>`}<div style="min-width:0">${body}</div>${hint}</article>`;
    }).join('');
  }

  function renderIssues(issues) {
    if (!issues.length) {
      const any = CATS.some((c) => (build[c.k] || []).length);
      $('#issue-list').innerHTML = `<div class="issue" style="grid-template-columns:24px minmax(0,1fr)">${icon(any ? 'circle-check' : 'info', 'ic-24')}<div><div class="issue__title">${any ? 'ไม่พบปัญหา' : 'ยังไม่มีอะไหล่ในสเปก'}</div><div class="issue__body">${any ? 'อะไหล่ที่เลือกไว้เข้ากันได้ทั้งหมด' : 'เริ่มจากเลือก CPU ระบบจะตรวจให้ทันทีทุกครั้งที่เปลี่ยนอะไหล่'}</div></div></div>`;
      return;
    }
    $('#issue-list').innerHTML = issues.map((x, i) => `<article class="issue" data-l="${x.level}">
      ${icon(LV[x.level].ic, 'ic-24')}
      <div style="min-width:0">
        <div class="issue__title">${x.code !== 'INFO' ? `<span class="code">${x.code}</span>` : ''}<span>${esc(x.title)}</span><span class="sr-only">ระดับ${LV[x.level].th}</span></div>
        <p class="issue__body">${esc(x.body)}</p>
        ${x.action ? `<div class="issue__fix"><button class="btn btn--secondary btn--sm" data-issue="${i}">${icon('lightbulb', 'ic-14')}${esc(x.action.label)}</button></div>` : ''}
      </div></article>`).join('');
    $('#issue-list').querySelectorAll('[data-issue]').forEach((b) => {
      b.addEventListener('click', () => {
        const a = issues[+b.dataset.issue].action;
        openPicker(a.cat, { smart: true, sortNear: true });
      });
    });
  }

  function gaugeHTML() {
    const pw = power(build);
    const psu = (build.psu || [])[0] ? find('psu', build.psu[0].id) : null;
    const pct = psu && pw.total ? Math.round((pw.total / psu.watt) * 100) : null;
    let st;
    if (!pw.total) st = { l: 'none', ic: 'gauge', t: 'เลือกอะไหล่เพื่อดูกำลังไฟ' };
    else if (pct == null) st = { l: 'none', ic: 'lightbulb', t: `แนะนำ PSU ${pw.rec} W ขึ้นไป` };
    else if (pct > 100) st = { l: 'err', ic: 'circle-x', t: `PSU ไฟไม่พอ ควรใช้อย่างน้อย ${pw.rec} W` };
    else if (pct > 85) st = { l: 'err', ic: 'triangle-alert', t: `โหลดสูงมาก แนะนำ PSU ${pw.rec} W ขึ้นไป` };
    else if (pct >= 70) st = { l: 'warn', ic: 'triangle-alert', t: psu.watt >= pw.rec ? 'ได้ขนาดที่แนะนำแล้ว แต่โหลดเกิน 70%' : `ใช้ได้ แต่เหลือไฟไม่มาก · แนะนำ ${pw.rec} W` };
    else st = { l: 'ok', ic: 'circle-check', t: 'ไฟเหลือเพียงพอ' };
    return `<div class="gauge" role="meter" aria-label="กำลังไฟที่ใช้" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct == null ? 0 : Math.min(pct, 100)}" aria-valuetext="${pw.total} วัตต์${psu ? ` จาก ${psu.watt} วัตต์ คิดเป็น ${pct} เปอร์เซ็นต์` : ''}" data-c="PowerGauge">
        ${window.BCChart.gaugeSvg(pct)}
        <div class="gauge__center"><div class="gauge__w">${pw.total} <small>W</small></div></div>
      </div>
      <div class="t-xs muted" style="text-align:center">${psu ? `ใช้ <b class="mono">${pct}%</b> ของ PSU ${psu.watt} W` : 'ยังไม่ได้เลือก PSU'}</div>
      <div class="gauge-status" data-l="${st.l}">${icon(st.ic, 'ic-16')}<span>${st.t}</span></div>`;
  }

  function summaryHTML(issues, inSheet) {
    const n = { err: 0, warn: 0, info: 0 };
    issues.forEach((x) => n[x.level]++);
    const t = totals(build);
    const b = budget();
    const any = t.count > 0;
    const missing = CATS.filter((c) => c.required && !(build[c.k] || []).length).length;
    let banner;
    if (!any) banner = ['none', 'cpu', 'เริ่มจัดสเปกกันเลย', 'เลือกอะไหล่ทีละหมวด ระบบตรวจให้ทันที'];
    else if (n.err) banner = ['err', 'circle-x', 'ใส่ด้วยกันไม่ได้', `ต้องแก้ ${n.err} ปัญหาก่อนประกอบ`];
    else if (n.warn) banner = ['warn', 'triangle-alert', 'ใส่ได้ แต่มีข้อควรระวัง', `มี ${n.warn} ข้อที่ควรดู`];
    else if (missing) banner = ['ok', 'circle-check', 'ยังไม่พบปัญหา', `เลือกอีก ${missing} หมวดจำเป็นให้ครบ`];
    else banner = ['ok', 'circle-check', 'เข้ากันได้ทั้งชุด', 'ประกอบได้ ไม่พบปัญหา'];
    const usedPct = b ? Math.min(100, (t.price / b) * 100) : 0;
    const over = b && t.price > b;
    const sc = score(build, usage());
    const value = sc && t.price ? ((sc / t.price) * 10000).toFixed(1) : null;
    return `
      <div class="status-banner status-banner--${banner[0]}" data-c="StatusBanner" ${inSheet ? 'style="border-radius:0"' : ''}>${icon(banner[1], 'ic-28')}<div><h2>${banner[2]}</h2><p>${banner[3]}</p></div></div>
      <div class="summary__block stack-3" data-c="PriceBlock">
        <div><div class="t-sm muted">ราคารวม${t.save > 0 ? 'แบบผสม' : ''}</div><div class="price-big">${baht(t.price)}</div></div>
        ${t.save > 0 ? `<div class="save-line"><span class="row">${icon('recycle', 'ic-14')}ประหยัดกว่าซื้อใหม่ทั้งชุด</span><b class="mono">${baht(t.save)}</b></div>` : ''}
        ${b ? `<div><div class="meter" data-l="${over ? 'err' : ''}" role="img" aria-label="ใช้งบ ${Math.round(usedPct)}%"><span style="width:${usedPct}%"></span></div>
          <div class="row between t-xs muted" style="margin-top:4px"><span>งบ ${baht(b)}</span><span style="${over ? 'color:var(--err-fg);font-weight:500' : ''}">${over ? `เกินงบ ${baht(t.price - b)}` : `เหลือ ${baht(b - t.price)}`}</span></div></div>` : ''}
      </div>
      <div class="summary__block">${gaugeHTML()}</div>
      <div class="summary__block">
        <div class="counts" data-c="IssueCounts">${['err', 'warn', 'info'].map((k) => `<a class="count" href="#issues" data-l="${k}" data-zero="${n[k] ? 0 : 1}" data-close-sheet><span class="count__n">${icon(LV[k].ic, 'ic-18')}${n[k]}</span><span class="count__l">${LV[k].th}</span></a>`).join('')}</div>
        ${sc != null ? `<dl class="row between t-xs" style="margin-top:var(--s-3)"><div class="row"><dt class="muted">คะแนนประสิทธิภาพ</dt><dd class="mono" style="font-weight:600">${sc}/100</dd></div><div class="row"><dt class="muted">ความคุ้มค่า</dt><dd class="mono" style="font-weight:600">${value}</dd></div></dl>` : ''}
      </div>`;
  }

  function renderMbar(issues) {
    const n = { err: 0, warn: 0, info: 0 };
    issues.forEach((x) => n[x.level]++);
    const t = totals(build);
    const pw = power(build);
    const psu = (build.psu || [])[0] ? find('psu', build.psu[0].id) : null;
    const pct = psu && pw.total ? Math.round((pw.total / psu.watt) * 100) : null;
    const l = pct == null ? 'none' : pct < 70 ? 'ok' : pct <= 85 ? 'warn' : 'err';
    $('#mbar').innerHTML = `<span style="min-width:0;display:block"><span class="mbar__price mono" style="display:block">${baht(t.price)}</span>
        <span class="mbar__power"><span class="meter" data-l="${l}"><span style="width:${pct == null ? 0 : Math.min(pct, 100)}%"></span></span>${pw.total} W${pct != null ? ` · ${pct}%` : ''}</span></span>
      <span class="row">
        ${n.err ? `<span class="badge badge--err">${icon('circle-x', 'ic-14')}${n.err}</span>` : ''}
        ${n.warn ? `<span class="badge badge--warn">${icon('triangle-alert', 'ic-14')}${n.warn}</span>` : ''}
        ${!n.err && !n.warn && t.count ? `<span class="badge badge--ok">${icon('circle-check', 'ic-14')}ผ่าน</span>` : ''}
        ${icon('chevron-up', 'ic-18')}</span>`;
    $('#mbar').setAttribute('aria-label', `สรุปสเปก ราคารวม ${baht(t.price)} กำลังไฟ ${pw.total} วัตต์ ผิดพลาด ${n.err} เตือน ${n.warn} แตะเพื่อดูเพิ่ม`);
  }

  function render() {
    const issues = check(build, { budget: budget() });
    renderSlots(issues);
    renderIssues(issues);
    $('#side').innerHTML = `<div class="summary">${summaryHTML(issues)}</div>`;
    renderMbar(issues);
    if ($('#sheet').open) renderSheet(issues);
    $('#undo').disabled = !hist.length;
    $('#redo').disabled = !fut.length;
  }

  function renderSheet(issues) {
    $('#sheet').innerHTML = `<div class="sheet__grab"></div>
      <div class="row between" style="padding:var(--s-2) var(--s-4)"><h2 class="t-h4">สรุปสเปก</h2><form method="dialog"><button class="btn btn--ghost btn--icon btn--sm" aria-label="ปิด">${icon('x')}</button></form></div>
      <div class="summary">${summaryHTML(issues, true)}</div>`;
  }

  // ---------- PartPicker ----------
  const pick = { cat: null, smart: true, q: '', sortNear: false, replace: null, used: false };

  function evalCandidate(cat, part) {
    const trial = clone(build);
    const row = it(part.id);
    if (pick.replace != null) trial[cat][pick.replace] = row;
    else if (CATS.find((c) => c.k === cat).multi) trial[cat] = [...(trial[cat] || []), row];
    else trial[cat] = [row];
    const issues = check(trial).filter((x) => x.cats.includes(cat) && x.level !== 'info');
    return issues.find((x) => x.level === 'err') || issues.find((x) => x.level === 'warn') || null;
  }

  function renderPicker() {
    const { cat } = pick;
    const c = CATS.find((x) => x.k === cat);
    const cur = (build[cat] || [])[0] ? find(cat, build[cat][0].id).price : null;
    let list = PARTS[cat].map((p) => ({ p, w: evalCandidate(cat, p) }));
    const total = list.length;
    if (pick.q) list = list.filter((x) => x.p.name.toLowerCase().includes(pick.q.toLowerCase()));
    let hidden = 0;
    if (pick.smart) { const before = list.length; list = list.filter((x) => !x.w || x.w.level !== 'err'); hidden = before - list.length; }
    if (pick.sortNear && cur != null) list.sort((a, b) => Math.abs(a.p.price - cur) - Math.abs(b.p.price - cur));

    const filterBlock = cat === 'cpu' || cat === 'mb'
      ? `<div class="filter-group"><h3>Socket</h3><label class="check"><input type="checkbox">AM5</label><label class="check"><input type="checkbox">LGA1700</label></div>`
      : cat === 'ram' ? `<div class="filter-group"><h3>ชนิดแรม</h3><label class="check"><input type="checkbox">DDR5</label><label class="check"><input type="checkbox">DDR4</label></div>`
        : `<div class="filter-group"><h3>สเปกเฉพาะหมวด</h3><label class="check"><input type="checkbox">ตัวเลือกตามหมวด 1</label><label class="check"><input type="checkbox">ตัวเลือกตามหมวด 2</label></div>`;

    $('#picker').innerHTML = `
      <div class="picker__head">
        <div class="slot__icon">${icon(c.icon)}</div>
        <div class="grow"><h2 class="t-h3" id="picker-title">เลือก${/^[A-Z]/.test(c.th) ? ' ' : ''}${c.th}</h2><p class="t-xs muted">${list.length} จาก ${total} รุ่น${hidden ? ` · ซ่อน ${hidden} รุ่นที่ใส่ไม่ได้` : ''}</p></div>
        <form method="dialog"><button class="btn btn--ghost btn--icon" aria-label="ปิดหน้าต่าง">${icon('x')}</button></form>
      </div>
      <div class="picker__tools">
        <div class="input-wrap grow" style="flex:1 1 220px">${icon('search', 'ic-16')}<input class="input" id="pick-q" type="search" placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ" value="${esc(pick.q)}" aria-label="ค้นหา${c.th}"></div>
        <label class="switch smart"><input type="checkbox" id="pick-smart" ${pick.smart ? 'checked' : ''}><span class="switch__track"></span><span>กรองอัจฉริยะ</span></label>
        <select class="select" style="width:auto" aria-label="เรียงลำดับ" id="pick-sort"><option>เรียงตามความนิยม</option><option ${pick.sortNear ? 'selected' : ''}>ราคาใกล้เคียงที่สุด</option><option>ราคาต่ำไปสูง</option><option>รุ่นใหม่ล่าสุด</option></select>
        <button class="btn btn--secondary filters-btn">${icon('sliders-horizontal', 'ic-16')}ตัวกรอง</button>
      </div>
      <div class="picker__body">
        <div class="picker__filters" aria-label="ตัวกรอง">
          <div class="filter-group"><h3>ยี่ห้อ</h3><label class="check"><input type="checkbox">ยี่ห้อตัวอย่าง 1</label><label class="check"><input type="checkbox">ยี่ห้อตัวอย่าง 2</label></div>
          <div class="filter-group"><h3>ช่วงราคา (บาท)</h3><div class="row"><input class="input input--sm mono" placeholder="ต่ำสุด" aria-label="ราคาต่ำสุด"><span class="faint">–</span><input class="input input--sm mono" placeholder="สูงสุด" aria-label="ราคาสูงสุด"></div></div>
          ${filterBlock}
        </div>
        <div class="picker__list" id="pick-list">
          ${list.length ? list.map(({ p, w }) => `<article class="pick" ${w ? `data-l="${w.level}"` : ''}>
            <div class="thumb thumb--64">${icon(c.icon, 'ic-28')}</div>
            <div style="min-width:0">
              <div class="pick__name">${esc(p.name)}</div>
              <div class="chips" style="margin-top:2px">${p.chips.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
              <div class="pick__why" data-l="${w ? w.level : 'ok'}">${icon(w ? LV[w.level].ic : 'circle-check', 'ic-14')}<span>${w ? `<span class="mono" style="font-weight:600">${w.code}</span> ${esc(w.title)}` : 'เข้ากันได้กับที่เลือกไว้'}</span></div>
            </div>
            <div class="pick__right">
              <div><div class="pick__price mono">${baht(p.price)}</div><div class="pick__used mono">มือสอง ~${baht(usedPrice(cat, p, 'B'))}</div></div>
              <button class="btn ${w && w.level === 'err' ? 'btn--secondary' : 'btn--primary'} btn--sm" data-pick="${p.id}">เลือก</button>
            </div></article>`).join('') : `<p class="muted t-sm" style="padding:var(--s-6);text-align:center">ไม่พบรุ่นที่เข้ากันได้ ลองปิดกรองอัจฉริยะเพื่อดูทั้งหมด</p>`}
        </div>
      </div>`;

    $('#pick-smart').addEventListener('change', (e) => { pick.smart = e.target.checked; renderPicker(); });
    $('#pick-q').addEventListener('input', (e) => {
      pick.q = e.target.value;
      const pos = e.target.selectionStart;
      renderPicker();
      const q = $('#pick-q'); q.focus(); q.setSelectionRange(pos, pos);
    });
    $('#pick-sort').addEventListener('change', (e) => { pick.sortNear = e.target.selectedIndex === 1; renderPicker(); });
    $('#pick-list').querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.pick)));
  }

  function openPicker(cat, o = {}) {
    Object.assign(pick, { cat, q: '', smart: o.smart ?? true, sortNear: !!o.sortNear, replace: o.replace ?? null });
    renderPicker();
    if (!$('#picker').open) {
      $('#picker').showModal();
      if (innerWidth >= 768) $('#pick-q').focus(); // มือถือไม่โฟกัสเอง เพื่อไม่ให้คีย์บอร์ดบังรายการ
    }
  }

  function choose(id) {
    push();
    const { cat, replace } = pick;
    const c = CATS.find((x) => x.k === cat);
    const old = (build[cat] || [])[replace ?? 0];
    const row = it(id, old && (replace != null || !c.multi) ? { cond: old.cond, grade: old.grade } : {});
    if (replace != null) build[cat][replace] = row;
    else if (c.multi) build[cat] = [...(build[cat] || []), row];
    else build[cat] = [row];
    $('#picker').close();
    render();
  }

  // ---------- เหตุการณ์ในหน้า ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !$('#slots').contains(b)) {
      if (e.target.closest('[data-close-sheet]') && $('#sheet').open) $('#sheet').close();
      return;
    }
    const { act, cat } = b.dataset;
    const idx = +b.dataset.idx;
    if (b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
    if (act === 'add') return openPicker(cat, { smart: true });
    if (act === 'swap') {
      const isMulti = CATS.find((c) => c.k === cat).multi;
      return openPicker(cat, { smart: true, replace: isMulti ? idx : null });
    }
    push();
    const row = build[cat][idx];
    if (act === 'rm') build[cat].splice(idx, 1);
    if (act === 'inc') row.qty++;
    if (act === 'dec') { row.qty--; if (row.qty < 1) build[cat].splice(idx, 1); }
    if (act === 'cond') { row.cond = b.dataset.v; if (row.cond === 'new') row.offer = null; }
    render();
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.act) return;
    const row = build[t.dataset.cat][+t.dataset.idx];
    push();
    if (t.dataset.act === 'grade') row.grade = t.value;
    if (t.dataset.act === 'offer') row.offer = Number(t.value.replace(/[^\d]/g, '')) || null;
    render();
  });
  $('#budget').addEventListener('input', render);
  $('#usage').addEventListener('change', render);
  $('#undo').addEventListener('click', () => { if (!hist.length) return; fut.push(JSON.stringify(build)); build = JSON.parse(hist.pop()); render(); });
  $('#redo').addEventListener('click', () => { if (!fut.length) return; hist.push(JSON.stringify(build)); build = JSON.parse(fut.pop()); render(); });
  $('#mbar').addEventListener('click', () => { renderSheet(check(build, { budget: budget() })); $('#sheet').showModal(); });
  $('#share').addEventListener('click', () => { $('#qr').innerHTML = fakeQR(); $('#share-dlg').showModal(); });
  $('#export').addEventListener('click', () => { $('#qr').innerHTML = fakeQR(); $('#share-dlg').showModal(); });
  // ปิดหน้าต่างเมื่อกดพื้นหลัง
  ['#picker', '#sheet', '#share-dlg'].forEach((s) => $(s).addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }));

  render();
  if (qs.get('open')) openPicker(qs.get('open'), { smart: qs.get('smart') !== '0' });
  if (qs.get('sheet') === '1') $('#mbar').click();
})();
