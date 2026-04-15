"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import type { User } from "@/lib/schemas/data-api";

export function UserRow({ user }: { user: User }) {
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [, start] = useTransition();

  const toggle = (next: boolean) => {
    start(async () => {
      setIsAdmin(next);
      const res = await fetch(`/api/admin/users/${user.pseudo_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: next }),
      });
      if (!res.ok) {
        setIsAdmin(!next);
        toast.error("Couldn't update admin status");
        return;
      }
      toast.success(next ? "Admin granted" : "Admin revoked");
    });
  };

  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div>
        <div className="font-medium">
          {user.display_name ?? <span className="text-muted-foreground">(no name)</span>}
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {user.pseudo_id}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm">admin</label>
        <Switch checked={isAdmin} onCheckedChange={toggle} />
      </div>
    </div>
  );
}
