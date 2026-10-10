"use client";

import { useRouter } from "next/navigation";

/** Compact channel picker for small screens (the channel sidebar is hidden below md). */
export function ChannelSwitcher({ serverId, channelId, channels }: { serverId: string; channelId: string; channels: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Switch channel"
      className="ml-auto h-8 rounded-md border bg-transparent px-2 text-sm md:hidden [&>option]:bg-popover"
      value={channelId}
      onChange={(e) => router.push(`/communities/${serverId}/${e.target.value}`)}
    >
      {channels.map((c) => (
        <option key={c.id} value={c.id}>#{c.name}</option>
      ))}
    </select>
  );
}
