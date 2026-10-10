"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/action-result";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * Button that invokes a server action with a fixed input, shows a toast with the result and
 * optionally asks for confirmation first (for irreversible actions).
 */
export function ActionButton<T>({
  action,
  input,
  children,
  confirm,
  onDone,
  redirectTo,
  successToast = true,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: (input: never) => Promise<ActionResult<T>>;
  input: unknown;
  confirm?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean };
  /** Client-side callback — only usable when the parent is itself a Client Component. */
  onDone?: (data: T) => void;
  /** Serializable alternative to onDone for Server Component parents: navigate on success. */
  redirectTo?: string;
  successToast?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    start(async () => {
      const res = await action(input as never);
      if (res.ok) {
        if (successToast && res.message) toast.success(res.message);
        onDone?.(res.data);
        if (redirectTo) router.push(redirectTo);
      } else {
        toast.error(res.error);
      }
      setOpen(false);
    });

  return (
    <>
      <Button {...props} disabled={pending || props.disabled} onClick={() => (confirm ? setOpen(true) : run())} aria-busy={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {children}
      </Button>
      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              {confirm.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant={confirm.destructive ? "destructive" : "default"} onClick={run} disabled={pending}>
                {pending && <LoaderCircle className="animate-spin" />}
                {confirm.confirmLabel ?? "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
