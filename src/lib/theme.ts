// ค่าที่ใช้ร่วมกันระหว่าง layout (เซิร์ฟเวอร์) กับสวิตช์โหมดมืด (เบราว์เซอร์)
// แยกไว้นอกไฟล์ 'use client' เพราะค่าที่ export จากไฟล์ client เมื่อเรียกจากเซิร์ฟเวอร์จะไม่ใช่สตริงจริง

export const THEME_KEY = 'buildcheck-theme';

/**
 * สคริปต์เล็ก ๆ ที่รันก่อนหน้าเว็บแสดง ใส่ class .dark ให้ <html> ทันที
 * หน้าจึงไม่กะพริบเป็นสีขาวก่อนเปลี่ยนเป็นมืด (ต้องเป็นสคริปต์ในหน้า เพราะ React ยังไม่โหลดตอนนั้น)
 */
export const themeScript = `(()=>{try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;
