/* กราฟ SVG ของต้นแบบ (เว็บจริงจะใช้ Recharts ตามหัวข้อ 7)
   สเปกเส้น: เส้น 2 px, จุดปลาย ≥ 8 px มีวงแหวนสีพื้น 2 px, เส้นกริด 1 px, Tooltip + เส้นกำกับเมื่อชี้ */
(function () {
  const ns = 'http://www.w3.org/2000/svg';
  const v = (name) => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
  const niceStep = (m) => {
    const p = 10 ** Math.floor(Math.log10(m || 1));
    const n = m / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  };
  const fmt = (n) => (n >= 10000 ? n / 1000 + 'K' : n.toLocaleString('en-US'));

  /* line(el, {labels, series:[{name, token, data}], valueFmt, height, yMin}) */
  function line(el, o) {
    // วาดตามความกว้างจริงของพื้นที่ ตัวอักษรแกนจึงคงขนาด 12 px ทั้งบนคอมและมือถือ
    const W = Math.max(280, el.clientWidth || 720);
    const H = W < 500 ? 200 : o.height || 260, m = { t: 12, r: 16, b: 26, l: 44 };
    const all = o.series.flatMap((s) => s.data.filter((d) => d != null));
    const yMin = o.yMin ?? 0;
    const stepY = niceStep((Math.max(...all) - yMin) / 4);
    const yMax = yMin + stepY * Math.ceil((Math.max(...all) - yMin) / stepY);
    const n = o.labels.length;
    const x = (i) => m.l + (i * (W - m.l - m.r)) / (n - 1);
    const y = (d) => H - m.b - ((d - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    let svg = `<svg xmlns="${ns}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || 'กราฟเส้น'}">`;
    for (let d = yMin; d <= yMax; d += stepY) {
      svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(d)}" y2="${y(d)}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y(d) + 4}" text-anchor="end">${fmt(d)}</text>`;
    }
    const step = Math.ceil(n / Math.max(3, Math.floor(W / 100)));
    o.labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${l}</text>`; });
    o.series.forEach((s) => {
      const pts = s.data.map((d, i) => (d == null ? null : `${x(i)},${y(d)}`)).filter(Boolean).join(' ');
      if (o.series.length === 1 && o.area) svg += `<polygon points="${x(0)},${H - m.b} ${pts} ${x(n - 1)},${H - m.b}" fill="var(--${s.token})" opacity=".1"/>`;
      svg += `<polyline points="${pts}" fill="none" stroke="var(--${s.token})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = s.data.length - 1;
      svg += `<circle cx="${x(last)}" cy="${y(s.data[last])}" r="4" fill="var(--${s.token})" stroke="var(--surface)" stroke-width="2"/>`;
    });
    svg += `<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--border-strong)" visibility="hidden"/>`;
    svg += '</svg>';
    el.classList.add('chart');
    el.innerHTML = svg + '<div class="tip"></div>';
    const s = el.querySelector('svg'), tip = el.querySelector('.tip'), xh = el.querySelector('.xh');
    const f = o.valueFmt || ((d) => d.toLocaleString('en-US'));
    const move = (e) => {
      const r = s.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1))));
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible');
      tip.style.display = 'block';
      tip.style.left = Math.max(70, Math.min(r.width - 70, (x(i) / W) * r.width)) + 'px';
      tip.style.top = '20px';
      tip.innerHTML = `<div class="faint">${o.labels[i]}</div>` + o.series.map((q) => `<div class="row" style="justify-content:space-between;gap:12px"><span class="row"><i style="width:10px;height:3px;border-radius:2px;background:var(--${q.token})"></i>${q.name}</span><b>${f(q.data[i])}</b></div>`).join('');
    };
    s.addEventListener('pointermove', move);
    s.addEventListener('pointerleave', () => { tip.style.display = 'none'; xh.setAttribute('visibility', 'hidden'); });
  }

  /* donut(el, {segments:[{name, token, value}], center}) ช่องว่าง 2 px ระหว่างชิ้นตามสเปกเครื่องหมาย */
  function donut(el, o) {
    const S = 240, r = 96, sw = 28, c = 2 * Math.PI * r;
    const total = o.segments.reduce((a, b) => a + b.value, 0);
    let off = 0, marks = '';
    o.segments.forEach((g, i) => {
      if (!g.value) return;
      const len = (g.value / total) * c;
      marks += `<circle data-i="${i}" cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="var(--${g.token})" stroke-width="${sw}" stroke-dasharray="${Math.max(len - 2, 1)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${S / 2} ${S / 2})"/>`;
      off += len;
    });
    el.classList.add('chart');
    el.innerHTML = `<svg xmlns="${ns}" viewBox="0 0 ${S} ${S}" role="img" aria-label="${o.label || 'สัดส่วน'}">${marks}
      <text x="${S / 2}" y="${S / 2 - 2}" text-anchor="middle" style="font-size:24px;font-weight:600;fill:var(--text)">${o.center || ''}</text>
      <text x="${S / 2}" y="${S / 2 + 20}" text-anchor="middle" style="font-size:13px;fill:var(--text-2)">${o.sub || ''}</text></svg><div class="tip"></div>`;
    const tip = el.querySelector('.tip');
    el.querySelectorAll('circle').forEach((m) => {
      m.addEventListener('pointermove', (e) => {
        const g = o.segments[+m.dataset.i];
        const r2 = el.getBoundingClientRect();
        tip.style.display = 'block';
        tip.style.left = e.clientX - r2.left + 'px';
        tip.style.top = e.clientY - r2.top + 'px';
        tip.innerHTML = `${g.name} <b>${g.value}%</b>`;
      });
      m.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    });
  }

  /* gauge: เกจกำลังไฟครึ่งวงกลม โซนตามหัวข้อ 4.3: ต่ำกว่า 70% / 70–85% / เกิน 85% */
  function gaugeSvg(pct) {
    const W = 240, H = 136, cx = 120, cy = 124, r = 104, sw = 16;
    const pt = (p) => {
      const a = Math.PI * (1 - p / 100);
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    };
    const arc = (a, b, stroke, cap = 'butt') => {
      const [x1, y1] = pt(a), [x2, y2] = pt(b);
      return `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}"/>`;
    };
    const tick = (p, label) => {
      const a = Math.PI * (1 - p / 100), rr = r + 16;
      return `<text class="gauge__tick" x="${cx + rr * Math.cos(a)}" y="${cy - rr * Math.sin(a) + 4}" text-anchor="middle">${label}</text>`;
    };
    const level = pct == null ? 'none' : pct < 70 ? 'ok' : pct <= 85 ? 'warn' : 'err';
    const fillToken = { ok: 'ok', warn: 'warn', err: 'err' }[level];
    const fill = pct == null ? '' : arc(0, Math.max(0.5, Math.min(pct, 100)), `var(--${fillToken})`);
    return `<svg xmlns="${ns}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      ${arc(0, 69.4, 'var(--ok-soft)')}${arc(70, 84.4, 'var(--warn-soft)')}${arc(85, 100, 'var(--err-soft)')}
      ${arc(0, 69.4, 'var(--ok-border)').replace(`stroke-width="${sw}"`, `stroke-width="${sw}" opacity=".55"`)}${arc(70, 84.4, 'var(--warn-border)').replace(`stroke-width="${sw}"`, `stroke-width="${sw}" opacity=".55"`)}${arc(85, 100, 'var(--err-border)').replace(`stroke-width="${sw}"`, `stroke-width="${sw}" opacity=".55"`)}
      ${fill}${tick(70, '70')}${tick(85, '85')}
    </svg>`;
  }

  window.BCChart = { line, donut, gaugeSvg, v };
})();
