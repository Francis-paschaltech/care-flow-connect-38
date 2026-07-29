import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Panel, CountBadge, EmptyState } from "@/components/app/app-shell";
import { StatusPill } from "@/components/dashboards/patient-dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments, useNotifications, startOfDay, addDays } from "@/lib/queries";
import { formatTime } from "@/lib/clinic";

export function StaffDashboard({ canCheckIn = true }: { canCheckIn?: boolean }) {
  const today = startOfDay();
  const appointments = useAppointments({ from: today, to: addDays(today, 1), limit: 100 });
  const notifications = useNotifications();
  const queryClient = useQueryClient();

  if (appointments.isLoading) return <Skeleton className="h-72 w-full" />;

  const rows = appointments.data ?? [];
  const queue = rows.filter((row) => row.status === "confirmed" || row.status === "checked_in");
  const completed = rows.filter((row) => row.status === "completed").length;
  const alerts = (notifications.data ?? []).filter((item) => item.kind !== "info").slice(0, 3);

  const checkIn = async (id: string) => {
    const { error } = await supabase.from("appointments").update({ status: "checked_in" }).eq("id", id);
    if (error) {
      toast.error("Could not check the patient in.");
      return;
    }
    toast.success("Patient checked in");
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  };

  return (
    <div className="space-y-4">
      <Panel title="Today's appointments" badge={<CountBadge>{rows.length} total</CountBadge>}>
        {rows.length === 0 ? (
          <EmptyState message="No appointments booked for today." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 8).map((appointment) => (
              <li key={appointment.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3">
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {formatTime(appointment.scheduled_at)}
                  </span>
                  <span className="truncate text-sm">
                    {appointment.patients?.full_name} — {appointment.doctors?.full_name}
                  </span>
                </div>
                <StatusPill status={appointment.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Waiting queue" badge={<CountBadge tone="warning">{queue.length} waiting</CountBadge>}>
        {queue.length === 0 ? (
          <EmptyState message="The waiting queue is empty." />
        ) : (
          <ul className="divide-y divide-border">
            {queue.slice(0, 6).map((appointment) => (
              <li key={appointment.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{appointment.patients?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatTime(appointment.scheduled_at)} · {appointment.doctors?.full_name}
                  </p>
                </div>
                {canCheckIn && appointment.status !== "checked_in" ? (
                  <Button size="sm" variant="outline" onClick={() => checkIn(appointment.id)}>
                    Check in
                  </Button>
                ) : (
                  <StatusPill status={appointment.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Urgent notifications" badge={<CountBadge tone="warning">{alerts.length} alerts</CountBadge>}>
        {alerts.length === 0 ? (
          <EmptyState message="No alerts right now." />
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded border px-3 py-2 text-xs ${
                  alert.kind === "alert"
                    ? "border-destructive/25 bg-danger-soft text-destructive"
                    : "border-warning/35 bg-warning-soft text-warning-foreground"
                }`}
              >
                ⚠ {alert.title} — {alert.message}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Daily summary">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Scheduled", rows.length],
            ["Checked in", rows.filter((row) => row.status === "checked_in").length],
            ["Completed", completed],
            ["Cancelled", rows.filter((row) => row.status === "cancelled").length],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/book">+ New Appointment</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/patients">+ Register Patient</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/appointments">View Full Schedule</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/reports">Attendance Report</Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
