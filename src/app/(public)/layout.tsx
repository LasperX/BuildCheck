import { SiteFloating, SiteFooter, SiteHeader } from '@/components/site-header';

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <SiteFloating />
    </>
  );
}
