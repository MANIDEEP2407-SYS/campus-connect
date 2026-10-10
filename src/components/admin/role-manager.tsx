"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { setUserRole } from "@/lib/actions/admin";
import { ROLE_LABELS } from "@/lib/constants";

type Role = keyof typeof ROLE_LABELS;

/** Admin-only control: grants/revokes privileged roles via the audited admin_set_role RPC. */
export function RoleManager({ userId, roles }: { userId: string; roles: Role[] }) {
  const [pending, start] = useTransition();
  return (
    <section className="rounded-xl border border-warning/30 bg-warning/5 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-warning" /> Roles (admin)</h2>
      <p className="mb-3 text-xs text-muted-foreground">Changes are audited and the user is notified.</p>
      <ul className="space-y-2">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <li key={r} className="flex items-center justify-between text-sm">
            <span>{ROLE_LABELS[r]}</span>
            <Switch
              checked={roles.includes(r)}
              disabled={pending}
              aria-label={`${roles.includes(r) ? "Revoke" : "Grant"} ${ROLE_LABELS[r]}`}
              onCheckedChange={(grant) =>
                start(async () => {
                  const res = await setUserRole({ userId, role: r, grant });
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.error);
                })
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
