'use client';

import { LayoutDashboard, LogOut, Settings, BellRing, Cpu, Heart, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { UserAvatar } from '@/components/account/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';

export function AccountDropdown({
  displayName,
  image,
  isAdmin,
}: {
  displayName: string;
  image: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="เมนูบัญชี"
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <UserAvatar name={displayName} image={image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me/settings">
            <Settings />
            ตั้งค่าบัญชี
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/builds">
            <Cpu />
            สเปกของฉัน
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/favorites">
            <Heart />
            รายการโปรด
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/price-alerts">
            <BellRing />
            เตือนราคาของฉัน
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/used/report">
            <Megaphone />
            รายงานราคามือสอง
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard />
              หลังบ้าน
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          ออกจากระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
