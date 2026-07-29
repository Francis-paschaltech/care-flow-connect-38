import { Link } from "@tanstack/react-router";
import { CalendarClock, CalendarX2, FileText, Stethoscope } from "lucide-react";
import { Panel, CountBadge, EmptyState } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppointments, useMedicalRecords, startOfDay } from "@/lib/queries";
import { formatDate, formatTime, statusLabels, statusToneClass } from "@/lib/clinic";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof CalendarClock;
}) {
  return (
    <div className="surface-panel p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-bold">{value}</p>
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-info-soft text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-semibold",
        statusToneClass(status),
      )}
    >
      {statusLabels[status as keyof typeof statusLabels] ?? status}
    </span>
  );
}

export function PatientDashboard({ patientId }: { patientId: string | null }) {
  const today = startOfDay();
  const upcoming = useAppointments({ patientId, from: today, enabled: !!patientId, limit: 50 });
  const past = useAppointments({ patientId, to: today, enabled: !!patientId, limit: 50 });
  const records = useMedicalRecords({ patientId });

  if (!patientId) {
    return (
      <Panel title="Patient profile">
        <EmptyState message="No patient profile is linked to this account yet. Ask the front desk to link your record." />
      </Panel>
    );
  }

  const loading = upcoming.isLoading || past.isLoading;
  const upcomingRows = upcoming.data ?? [];
  const pastRows = [...(past.data ?? [])].reverse();
  const assignedDoctor = upcomingRows[0]?.doctors?.full_name ?? pastRows[0]?.doctors?.full_name ?? "—";

  if (loading) return <Skeleton className="h-72 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming appointments" value={upcomingRows.length} icon={CalendarClock} />
        <StatCard label="Past appointments" value={pastRows.length} icon={CalendarX2} />
        <StatCard label="Assigned doctor" value={assignedDoctor} icon={Stethoscope} />
        <StatCard label="Medical records" value={records.data?.length ?? 0} icon={FileText} />
      </div>

      <Panel title="Upcoming appointments" badge={<CountBadge>{upcomingRows.length} scheduled</CountBadge>}>
        {upcomingRows.length === 0 ? (
          <EmptyState message="You have no upcoming appointments. Book one to get started." />
        ) : (
          <ul className="divide-y divide-border">
            {upcomingRows.slice(0, 6).map((appointment) => (
              <li
                key={appointment.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {appointment.doctors?.full_name} — {appointment.reason ?? "Consultation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(appointment.scheduled_at)} · {formatTime(appointment.scheduled_at)} ·{" "}
                    {appointment.departments?.name ?? appointment.doctors?.specialty}
                  </p>
                </div>
                <StatusPill status={appointment.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/book">+ Book Appointment</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/appointments">Reschedule</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/appointments">Cancel appointment</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/records">View records</Link>
          </Button>
        </div>
      </Panel>

      <Panel title="Recent activity">
        {pastRows.length === 0 ? (
          <EmptyState message="No visit history yet." />
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {pastRows.slice(0, 6).map((appointment) => (
              <li key={appointment.id} className="relative">
                <span className="absolute -left-[1.42rem] top-1.5 size-2 rounded-full bg-primary" aria-hidden />
                <p className="text-sm font-medium">
                  {appointment.status === "completed"
                    ? "Consultation completed"
                    : appointment.status === "cancelled"
                      ? "Appointment cancelled"
                      : "Appointment booked"}{" "}
                  with {appointment.doctors?.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(appointment.scheduled_at)} · {formatTime(appointment.scheduled_at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
