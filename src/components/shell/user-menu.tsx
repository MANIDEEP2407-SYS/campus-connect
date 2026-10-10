"use client";

import Link from "next/link";
import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/user-avatar";
import { signOut } from "@/lib/actions/auth";

export function UserMenu({ profile }: { profile: { full_name: string; handle: string; avatar_url: string | null } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
        <UserAvatar name={profile.full_name} src={profile.avatar_url} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block text-sm font-medium text-foreground">{profile.full_name}</span>
            <span className="block text-xs">@{profile.handle}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/profile/${profile.handle}`} />}>
          <User /> View profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/profile/edit" />}>
          <Settings /> Edit profile & privacy
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/safety" />}>
          <ShieldCheck /> Safety & moderation
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
