"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/confirm-destructive";

interface DeleteMyAudioButtonProps {
  sessionId: string;
  displayName: string;
}

export function DeleteMyAudioButton({
  sessionId,
  displayName,
}: DeleteMyAudioButtonProps) {
  const handleDelete = async () => {
    const res = await fetch(
      `/api/me/sessions/${sessionId}/delete-my-audio`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE MY AUDIO" }),
      },
    );
    if (!res.ok) {
      toast.error("Deletion failed");
      return;
    }
    toast.success("Audio deletion submitted");
  };

  return (
    <ConfirmDestructive
      trigger={
        <Button variant="destructive" size="sm">
          Delete my audio
        </Button>
      }
      title="Permanently delete your audio?"
      description="This will permanently delete your audio recordings for this session. Transcript segments attributed to you will be retained but marked as wiped. This cannot be undone."
      confirmText={displayName}
      onConfirm={handleDelete}
    />
  );
}
