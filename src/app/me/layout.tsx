import { SiteHeader } from '@/components/site-header';

export default function MeLayout({ children }: LayoutProps<'/me'>) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
