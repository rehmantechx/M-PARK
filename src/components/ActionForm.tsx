"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: true };

export function SubmitButton({ children, className, confirm }: { children: ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className || "btn-primary"}
      disabled={pending}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? "Working..." : children}
    </button>
  );
}

export function ActionForm({ action, children, className }: { action: (form: FormData) => Promise<ActionResult>; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(async (_prev: ActionResult, form: FormData) => action(form), initial);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? <p role="alert" className="text-red-700 text-sm mt-2">{state.error}</p> : null}
      {state.message ? <p role="status" className="text-green-700 text-sm mt-2">{state.message}</p> : null}
    </form>
  );
}

// For actions bound with .bind(null, id, value): wrap them so useActionState
// gets a stable function. Usage: <BoundActionForm action={fn.bind(null, id, v)}><SubmitButton/></BoundActionForm>
export function BoundActionForm({ action, children, className }: { action: (form: FormData) => Promise<ActionResult>; children: ReactNode; className?: string }) {
  return <ActionForm action={action} className={className}>{children}</ActionForm>;
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
