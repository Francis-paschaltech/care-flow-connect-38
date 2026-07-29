import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Panel, CountBadge, EmptyState } from "@/components/app/app-shell";
import { StatusPill } from "@/components/dashboards/patient-dashboard";
import { DoctorSchedulePanel } from "@/components/app/doctor-schedule-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointments, useNotifications, startOfDay, addDays } from "@/lib/queries";
import { formatDate, formatTime } from "@/lib/clinic";

export function DoctorDashboard({ doctorId }: { doctorId: string | null }) {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const appointments = useAppointments({
    doctorId: doctorId ?? undefined,
    from: today,
    to: tomorrow,
    limit: 50,
  });
  const upcoming = useAppointments({
    doctorId: doctorId ?? undefined,
    from: tomorrow,
    to: addDays(today, 30),
    limit: 200,
  });
  const caseload = useAppointments({
    doctorId: doctorId ?? undefined,
    from: addDays(today, -180),
    to: addDays(today, 30),
    limit: 500,
  });
  const notifications = useNotifications();

  const assignedPatients = useMemo(() => {
    const map = new Map<string, { name: string; code: string; last: string; visits: number }>();
    (caseload.data ?? []).forEach((row) => {
      const existing = map.get(row.patient_id);
      map.set(row.patient_id, {
        name: row.patients?.full_name ?? "Patient",
        code: row.patients?.patient_code ?? "",
        last:
          !existing || new Date(row.scheduled_at) > new Date(existing.last)
            ? row.scheduled_at
            : existing.last,
        visits: (existing?.visits ?? 0) + 1,
      });
    });
    return [...map.entries()].sort(
      (a, b) => new Date(b[1].last).getTime() - new Date(a[1].last).getTime(),
    );
  }, [caseload.data]);

  if (appointments.isLoading) return <Skeleton className="h-72 w-full" />;

  const rows = appointments.data ?? [];
  const upcomingRows = upcoming.data ?? [];
  const arrivals = rows.filter((row) => row.status === "checked_in" || row.status === "confirmed");
  const alerts = (notifications.data ?? []).filter((item) => item.kind !== "info" && item.kind !== "success").slice(0, 3);

  return (
    <div className="space-y-4">
      <Panel title="Today's appointments" badge={<CountBadge>{rows.length} total</CountBadge>}>
        {rows.length === 0 ? (
          <EmptyState message="No appointments booked for today." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((appointment) => (
              <li
                key={appointment.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
              >
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3">
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {formatTime(appointment.scheduled_at)}
                  </span>
                  <span className="truncate text-sm">
                    {appointment.patients?.full_name} — {appointment.reason ?? "Consultation"}
                  </span>
                </div>
                <StatusPill status={appointment.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Upcoming arrivals"
        badge={<CountBadge tone="warning">{arrivals.length} waiting</CountBadge>}
      >
        {arrivals.length === 0 ? (
          <EmptyState message="No further arrivals expected today." />
        ) : (
          <ul className="space-y-2.5">
            {arrivals.slice(0, 4).map((appointment) => (
              <li key={appointment.id} className="text-sm">
                <span className="font-semibold">{appointment.patients?.full_name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  —{" "}
                  {appointment.status === "checked_in"
                    ? `arrived, checked in for ${formatTime(appointment.scheduled_at)}`
                    : `expected at ${formatTime(appointment.scheduled_at)}, SMS confirmed`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Urgent notifications"
        badge={<CountBadge tone="warning">{alerts.length} alerts</CountBadge>}
      >
        {alerts.length === 0 ? (
          <EmptyState message="Nothing needs your attention right now." />
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded border px-3 py-2 text-xs ${
                  alert.kind === "error"
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

      <Panel
        title="Upcoming appointments"
        badge={<CountBadge>{upcomingRows.length} next 30 days</CountBadge>}
      >
        {upcomingRows.length === 0 ? (
          <EmptyState message="Nothing scheduled beyond today." />
        ) : (
          <ul className="divide-y divide-border">
            {upcomingRows.slice(0, 6).map((appointment) => (
              <li key={appointment.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{appointment.patients?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(appointment.scheduled_at)} · {formatTime(appointment.scheduled_at)} ·{" "}
                    {appointment.reason ?? "Consultation"}
                  </p>
                </div>
                <StatusPill status={appointment.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Assigned patients"
        badge={<CountBadge>{assignedPatients.length} patients</CountBadge>}
      >
        {assignedPatients.length === 0 ? (
          <EmptyState message="No patients have been assigned to you yet." />
        ) : (
          <ul className="divide-y divide-border">
            {assignedPatients.slice(0, 8).map(([id, patient]) => (
              <li key={id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{patient.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {patient.code} · {patient.visits} appointment{patient.visits === 1 ? "" : "s"} · last{" "}
                    {formatDate(patient.last)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/patients">Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <DoctorSchedulePanel doctorId={doctorId} />

      <Panel title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/appointments">View full schedule</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/patients">Patient records</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/records">Consultation notes</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/reports">Attendance report</Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
