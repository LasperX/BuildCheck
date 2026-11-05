'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/** ตัวกลางแคชของ TanStack Query: ผลค้นหาเดิมเปิดซ้ำได้ทันทีโดยไม่ต้องโหลดใหม่ (หัวข้อ 7.1) */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
