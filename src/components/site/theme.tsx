'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { THEME_KEY } from '@/lib/theme';

// โหมดสว่าง/มืด (หัวข้อ 1.5, 5.3) เก็บตัวเลือกไว้ใน localStorage ของเครื่อง
// "ตามระบบ" = ใช้ค่า prefers-color-scheme ของอุปกรณ์ และเปลี่ยนตามเมื่อผู้ใช้สลับโหมดของเครื่อง

type Theme = 'light' | 'dark' | 'system';

function apply(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'สว่าง', icon: Sun },
  { value: 'dark', label: 'มืด', icon: Moon },
  { value: 'system', label: 'ตามอุปกรณ์', icon: Monitor },
];

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    // โหมดส่วนตัวบางเบราว์เซอร์อ่านไม่ได้
    return 'system';
  }
}

// อ่านตัวเลือกจาก localStorage แบบ external store: เซิร์ฟเวอร์ใช้ 'system' เสมอ เบราว์เซอร์อ่านค่าจริงหลังโหลด
const listeners = new Set<() => void>();
function subscribe(notify: () => void) {
  listeners.add(notify);
  // ตามอุปกรณ์: เปลี่ยนเมื่อผู้ใช้สลับโหมดของเครื่อง · แท็บอื่นเปลี่ยนค่า: ตามด้วย
  const media = matchMedia('(prefers-color-scheme: dark)');
  const onMedia = () => {
    if (readTheme() === 'system') apply('system');
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return;
    apply(readTheme());
    notify();
  };
  media.addEventListener('change', onMedia);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    media.removeEventListener('change', onMedia);
    window.removeEventListener('storage', onStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);

  const choose = (value: string) => {
    const next = value as Theme;
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // เปลี่ยนได้เฉพาะหน้านี้
    }
    apply(next);
    for (const notify of listeners) notify();
  };

  const Current = OPTIONS.find((option) => option.value === theme)?.icon ?? Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="เปลี่ยนโหมดสว่างหรือมืด"
        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Current aria-hidden className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>โหมดการแสดงผล</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={choose}>
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
