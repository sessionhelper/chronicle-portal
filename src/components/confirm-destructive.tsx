"use client";

import { type ReactNode, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ConfirmDestructiveProps {
  trigger: ReactNode;
  title: string;
  description: string;
  /** The text the user must type to enable the confirm button. */
  confirmText: string;
  /** Async callback executed when the user confirms. */
  onConfirm: () => Promise<void>;
  /** Label for the confirm button. @default "Delete" */
  confirmLabel?: string;
}

export function ConfirmDestructive({
  trigger,
  title,
  description,
  confirmText,
  onConfirm,
  confirmLabel = "Delete",
}: ConfirmDestructiveProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  const match = typed.toLowerCase() === confirmText.toLowerCase();

  const handleConfirm = () => {
    start(async () => {
      await onConfirm();
      setOpen(false);
      setTyped("");
    });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTyped("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm">
            Type your name to confirm:{" "}
            <span className="font-semibold">{confirmText}</span>
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!match || pending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
