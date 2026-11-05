import { SiteFloating, SiteFooter, SiteHeader } from '@/components/site-header';

export default function MeLayout({ children }: LayoutProps<'/me'>) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <SiteFloating />
    </>
  );
}
