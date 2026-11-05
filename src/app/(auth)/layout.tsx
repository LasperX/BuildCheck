import Link from 'next/link';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      <Link href="/" className="text-lg font-bold">
        BuildCheck
      </Link>
      {children}
    </main>
  );
}
