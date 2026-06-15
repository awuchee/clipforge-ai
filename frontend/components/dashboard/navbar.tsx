'use client';

import Link from 'next/link';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { useAuth } from '@/lib/auth-context';

export function DashboardNavbar() {
  const { user, logout } = useAuth();

  const initials = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div className="text-sm text-muted-foreground">
          Plan: <Badge variant="secondary">{user?.plan ?? 'FREE'}</Badge>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left text-sm sm:block">
              <p className="font-medium leading-none">{user?.name ?? 'Account'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <UserIcon className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
