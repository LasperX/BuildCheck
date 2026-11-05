/** รูปโปรไฟล์ ถ้าไม่มีรูปแสดงอักษรตัวแรกของชื่อ */
export function UserAvatar({
  name,
  image,
  size = 32,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  if (image) {
    return (
      // รูปจาก Google อยู่นอกเว็บเรา เฟส 4 จะตั้งค่า next/image พร้อมที่เก็บรูป
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-grid place-items-center rounded-full bg-brand-soft font-semibold text-brand-soft-fg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
