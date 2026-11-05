import { SiteHeader } from '@/components/site-header';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
