import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-auth";
import { roleLabels } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareConnect" },
      { name: "description", content: "Update your CareConnect profile details and notification preferences." },
      { property: "og:title", content: "Settings — CareConnect" },
      { property: "og:description", content: "Manage your profile and notification preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me, refetch } = useCurrentUser();
  const [fullName, setFullName] = useState(me?.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [emailReminders, setEmailReminders] = useState(true);
  const [smsReminders, setSmsReminders] = useState(false);

  const save = async () => {
    if (fullName.trim().length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", me?.userId ?? "");
    setBusy(false);
    if (error) {
      toast.error("Could not save your profile.");
      return;
    }
    toast.success("Profile updated");
    refetch();
  };

  return (
    <AppShell title="Settings" subtitle="Your profile and preferences">
      <div className="max-w-2xl space-y-4">
        <Panel title="Profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                maxLength={100}
                value={fullName}
                placeholder={me?.fullName ?? ""}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={me?.email ?? ""} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-role">Role</Label>
              <Input id="profile-role" value={me ? roleLabels[me.role] : ""} readOnly disabled />
            </div>
          </div>
          <div className="mt-3">
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Panel>

        <Panel title="Notification preferences">
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>Email appointment reminders</span>
              <Switch checked={emailReminders} onCheckedChange={setEmailReminders} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>SMS appointment reminders</span>
              <Switch checked={smsReminders} onCheckedChange={setSmsReminders} />
            </label>
            <p className="text-xs text-muted-foreground">
              Reminders are sent 24 hours before each appointment.
            </p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
