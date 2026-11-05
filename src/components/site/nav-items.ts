// เมนูหลักของเว็บ ตามหัวข้อ 5.3 ใช้ร่วมกันทั้งแถบบนและแถบล่างบนมือถือ
export const MAIN_NAV = [
  { href: '/builder', label: 'จัดสเปก' },
  { href: '/budget', label: 'จัดตามงบ' },
  { href: '/parts', label: 'คลังอะไหล่' },
  { href: '/used', label: 'ตลาดมือสอง' },
  { href: '/builds', label: 'ชุมชน' },
  { href: '/compare', label: 'เทียบสเปก' },
] as const;
