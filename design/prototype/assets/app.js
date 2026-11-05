/* สคริปต์กลางของต้นแบบ: ธีม, Wireframe, ไอคอน, ส่วนหัว/ท้ายหน้า, Inspector
   โค้ดนี้ใช้เฉพาะต้นแบบเฟส 0 ไม่ใช่โค้ดของเว็บจริง */
(function () {
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;

  // ธีม: พารามิเตอร์จาก URL > ค่าที่จำไว้ > ค่าของระบบ
  let theme = params.get('theme');
  if (!theme) {
    try { theme = localStorage.getItem('bc-theme'); } catch (e) { /* เบราว์เซอร์ปิด storage */ }
  }
  if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.dataset.theme = theme;
  if (params.get('wire') === '1') root.dataset.fidelity = 'wire';

  const BC = (window.BC = {});
  BC.params = params;

  BC.icon = (name, cls = '') => {
    const inner = (window.BC_ICONS || {})[name] || '';
    return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  };
  // <i data-i="cpu" class="ic-16"></i> → SVG
  BC.icons = (scope = document) => {
    scope.querySelectorAll('i[data-i]').forEach((el) => {
      const t = document.createElement('template');
      t.innerHTML = BC.icon(el.dataset.i, el.className);
      const svg = t.content.firstChild;
      if (el.getAttribute('style')) svg.setAttribute('style', el.getAttribute('style'));
      el.replaceWith(svg);
    });
  };

  BC.baht = (n) => '฿' + Math.round(n).toLocaleString('en-US');
  BC.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LOGO = `<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="5" y="5" width="18" height="18" rx="4" fill="var(--brand)"/><path d="M10 14.5l3 3 5.5-6.5" stroke="var(--on-brand)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 1.5v3M14 1.5v3M18.5 1.5v3M9.5 23.5v3M14 23.5v3M18.5 23.5v3M1.5 9.5h3M1.5 14h3M1.5 18.5h3M23.5 9.5h3M23.5 14h3M23.5 18.5h3" stroke="var(--text-3)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  BC.logo = () => `<a class="logo" href="home.html">${LOGO}<span>BuildCheck</span></a>`;

  const NAV = [
    ['builder', 'จัดสเปก', 'builder.html'], ['budget', 'จัดตามงบ', 'budget.html'], ['parts', 'คลังอะไหล่', 'part.html'],
    ['used', 'ตลาดมือสอง', 'part.html?tab=used'], ['community', 'ชุมชน', 'build.html'],
  ];
  const TABS = [
    ['home', 'หน้าแรก', 'house', 'home.html'], ['builder', 'จัดสเปก', 'cpu', 'builder.html'], ['parts', 'อะไหล่', 'package', 'part.html'],
    ['community', 'ชุมชน', 'users', 'build.html'], ['me', 'บัญชี', 'user', 'build.html'],
  ];

  // ส่วนหัว ท้ายหน้า แถบล่าง ปุ่มลอย (องค์ประกอบร่วมตามหัวข้อ 5.3)
  BC.chrome = ({ active, fab = true, footer = true } = {}) => {
    const hdr = document.createElement('header');
    hdr.className = 'hdr';
    hdr.dataset.c = 'SiteHeader';
    hdr.innerHTML = `<div class="container hdr__in">
      ${BC.logo()}
      <nav class="nav" aria-label="เมนูหลัก">${NAV.map(([k, l, h]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
      <div class="input-wrap hdr__search"><i data-i="search" class="ic-16"></i><input class="input" type="search" placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ" aria-label="ค้นหาอะไหล่"></div>
      <div class="hdr__actions">
        <button class="btn btn--ghost btn--icon hdr__searchbtn" aria-label="ค้นหา"><i data-i="search"></i></button>
        <button class="btn btn--ghost btn--icon dot-badge" data-count="3" aria-label="การแจ้งเตือน 3 รายการ"><i data-i="bell"></i></button>
        <button class="btn btn--ghost btn--icon" id="theme-toggle" aria-label="สลับโหมดสว่าง/มืด"><i data-i="${theme === 'dark' ? 'sun' : 'moon'}"></i></button>
        <a class="avatar" href="build.html" aria-label="เมนูบัญชี">ว</a>
      </div></div>`;
    document.body.prepend(hdr);

    if (footer) {
      const f = document.createElement('footer');
      f.className = 'footer';
      f.dataset.c = 'SiteFooter';
      f.innerHTML = `<div class="container"><div class="footer__in"><span>${'BuildCheck'} · เครื่องมือจัดสเปกคอมภาษาไทย ไม่ขายสินค้า</span>
        <span class="footer__links"><a href="#">คู่มือ</a><a href="#">เกี่ยวกับ</a><a href="#">ติดต่อ</a><a href="#">นโยบายความเป็นส่วนตัว</a></span></div>
        <p class="proto-note">ต้นแบบเฟส 0: ชื่อรุ่น สเปก ราคา ชื่อผู้ใช้ และตัวเลขทั้งหมดเป็นข้อมูลสมมติเพื่อแสดงหน้าตา ไม่ใช่ข้อมูลอะไหล่จริง</p></div>`;
      document.body.append(f);
    }

    const tb = document.createElement('nav');
    tb.className = 'tabbar';
    tb.dataset.c = 'BottomTabBar';
    tb.setAttribute('aria-label', 'เมนูล่าง');
    tb.innerHTML = TABS.map(([k, l, ic, h]) => `<a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${BC.icon(ic)}<span>${l}</span></a>`).join('');
    document.body.append(tb);

    if (fab) {
      const a = document.createElement('a');
      a.className = 'fab';
      a.dataset.c = 'FloatingBuildButton';
      a.href = 'builder.html';
      a.innerHTML = `${BC.icon('cpu', 'ic-18')}<span>สเปกของฉัน (5 ชิ้น)</span>`;
      document.body.append(a);
    }
  };

  // คงค่าธีม/Wireframe/Inspector เมื่อกดลิงก์ไปหน้าอื่นในต้นแบบ
  const keep = ['theme', 'wire', 'inspect'];
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#theme-toggle');
    if (t) {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('bc-theme', next); } catch (err) { /* ไม่เป็นไร */ }
      if (params.has('theme')) params.set('theme', next);
      t.innerHTML = BC.icon(next === 'dark' ? 'sun' : 'moon');
      document.dispatchEvent(new CustomEvent('bc-theme'));
      return;
    }
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; }
    if (!/\.html/.test(href)) return;
    const u = new URL(href, location.href);
    keep.forEach((k) => { if (params.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, params.get(k)); });
    a.href = u.href;
  }, true);

  // ---------- Inspector: ชี้ที่องค์ประกอบใดก็ได้เพื่อดูขนาด ระยะ สี ฟอนต์ (ใช้แทน Dev Mode ของ Figma) ----------
  function initInspector() {
    const box = document.createElement('div'); box.className = 'insp-box';
    const tip = document.createElement('div'); tip.className = 'insp-tip';
    document.body.append(box, tip);
    box.style.display = tip.style.display = 'none';

    const probe = document.createElement('i');
    document.body.append(probe);
    const tokenMap = () => {
      const map = {};
      (window.BC_TOKENS || []).forEach(({ name }) => {
        probe.style.color = `var(--${name})`;
        const rgb = getComputedStyle(probe).color;
        if (!map[rgb]) map[rgb] = name;
      });
      return map;
    };
    let tokens = tokenMap();
    document.addEventListener('bc-theme', () => { tokens = tokenMap(); });
    const col = (c) => {
      if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return null;
      const hex = c.startsWith('rgb(') ? '#' + c.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase() : c;
      return tokens[c] ? `${hex} (${tokens[c]})` : hex;
    };
    const px = (s) => s.split(' ').map((v) => Math.round(parseFloat(v) * 10) / 10).join(' ');

    document.addEventListener('mousemove', (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === document.documentElement || el === document.body) { box.style.display = tip.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      box.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      const named = el.closest('[data-c]');
      const lines = [];
      lines.push(`<b>${named ? named.dataset.c + ' › ' : ''}${el.tagName.toLowerCase()}${el.classList[0] ? '.' + el.classList[0] : ''}</b>`);
      lines.push(`ขนาด   ${Math.round(r.width * 10) / 10} × ${Math.round(r.height * 10) / 10}`);
      if (s.padding !== '0px') lines.push(`padding ${px(s.padding)}`);
      if (s.gap && s.gap !== 'normal') lines.push(`gap    ${px(s.gap)}`);
      if (s.borderRadius !== '0px') lines.push(`radius ${px(s.borderRadius)}`);
      const bg = col(s.backgroundColor); if (bg) lines.push(`พื้น    ${bg}`);
      if (s.borderTopWidth !== '0px') { const b = col(s.borderTopColor); if (b) lines.push(`ขอบ    ${s.borderTopWidth} ${b}`); }
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText) {
        lines.push(`ฟอนต์  ${s.fontFamily.split(',')[0].replace(/['"]/g, '')} ${s.fontWeight}`);
        lines.push(`ขนาด   ${s.fontSize} / ${s.lineHeight}`);
        lines.push(`สี     ${col(s.color)}`);
      }
      tip.innerHTML = lines.join('\n');
      tip.style.display = 'block';
      const tr = tip.getBoundingClientRect();
      tip.style.left = Math.min(e.clientX + 14, innerWidth - tr.width - 8) + 'px';
      tip.style.top = Math.min(e.clientY + 14, innerHeight - tr.height - 8) + 'px';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    BC.icons();
    if (params.get('inspect') === '1') initInspector();
  });
})();
