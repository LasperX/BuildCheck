// สิทธิ์ของสเปก ฟังก์ชันล้วน ใช้ได้ทั้งหน้าเว็บ Route Handler และเทสต์

/** สิทธิ์ดูสเปก: สาธารณะและมีลิงก์ = ทุกคน · ส่วนตัว = เจ้าของ (และแอดมิน) */
export function canViewBuild(
  build: { userId: string; visibility: 'public' | 'unlisted' | 'private' },
  viewer: { id: string; role?: string | null } | null | undefined,
) {
  if (build.visibility !== 'private') return true;
  return Boolean(viewer && (viewer.id === build.userId || viewer.role === 'admin'));
}
