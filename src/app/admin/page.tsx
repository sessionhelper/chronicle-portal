import { AppShell } from "@/components/app-shell";
import { UserRow } from "@/components/admin/user-row";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dataApiClient } from "@/lib/data-api-client";
import { requireAdmin } from "@/lib/server-auth";
import type { User } from "@/lib/schemas/data-api";

export default async function AdminPage() {
  await requireAdmin();
  let users: User[] = [];
  try {
    users = await dataApiClient.listUsers();
  } catch {
    users = [];
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Admin</h1>
      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users returned. Check that the data-api exposes
              <code className="mx-1 font-mono text-xs">/internal/admin/users</code>.
            </p>
          ) : (
            <div>
              {users.map((u) => (
                <UserRow key={u.pseudo_id} user={u} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Rerun button for sessions (BFF endpoint exists; UI pending).</p>
          <p>• Mute-range editing UI.</p>
          <p>• Quality scoring & ground-truth annotation.</p>
          <p>• Segment split/merge/timecode editing.</p>
          <p>• Live transcript streaming.</p>
          <p>• Admin audit log viewer.</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
