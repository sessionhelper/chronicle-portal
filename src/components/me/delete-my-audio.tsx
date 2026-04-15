"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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

const CONFIRM = "DELETE MY AUDIO";

export function DeleteMyAudioButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const match = typed === CONFIRM;

  const confirm = () => {
    start(async () => {
      const res = await fetch(
        `/api/me/sessions/${sessionId}/delete-my-audio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: CONFIRM }),
        },
      );
      if (!res.ok) {
        toast.error("Deletion failed");
        return;
      }
      toast.success("Audio deletion submitted");
      setOpen(false);
      setTyped("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete my audio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete your audio?</DialogTitle>
          <DialogDescription>
            This removes your audio chunks and pipeline outputs for this
            session. It cannot be undone. Type
            <span className="mx-1 font-mono font-semibold">{CONFIRM}</span>
            to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={CONFIRM}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            disabled={!match || pending}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
