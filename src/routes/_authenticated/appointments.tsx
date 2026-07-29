import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell, Panel, EmptyState, CountBadge } from "@/components/app/app-shell";
import { StatusPill } from "@/components/dashboards/patient-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, isStaffRole } from "@/hooks/use-auth";
import { useAppointments, useDoctors, addDays, startOfDay } from "@/lib/queries";
import type { AppointmentRow } from "@/lib/queries";
import { formatDate, formatTime, toDateKey } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — CareConnect" },
      { name: "description", content: "Browse, reschedule and cancel clinic appointments in list or calendar view." },
      { property: "og:title", content: "Appointments — CareConnect" },
      { property: "og:description", content: "Browse, reschedule and cancel clinic appointments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppointmentsPage,
});

const STATUS_FILTERS = ["all", "pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"];

function AppointmentsPage() {
  const { data: me } = useCurrentUser();
  const staff = isStaffRole(me?.role);
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<AppointmentRow | null>(null);

  const doctors = useDoctors();
  const rangeFrom = addDays(startOfDay(), -60);
  const rangeTo = addDays(startOfDay(), 60);

  const query = useAppointments({
    from: rangeFrom,
    to: rangeTo,
    patientId: me?.role === "patient" ? me.patientId : undefined,
    doctorId: me?.role === "doctor" ? me.doctorId : undefined,
    limit: 1000,
  });

  const rows = useMemo(() => {
    let list = query.data ?? [];
    if (statusFilter !== "all") list = list.filter((row) => row.status === statusFilter);
    if (doctorFilter !== "all") list = list.filter((row) => row.doctor_id === doctorFilter);
    return list;
  }, [query.data, statusFilter, doctorFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    rows.forEach((row) => {
      const key = toDateKey(new Date(row.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), row]);
    });
    return map;
  }, [rows]);

  return (
    <AppShell
      title="Appointments"
      subtitle={staff ? "Clinic-wide schedule" : "Your appointment history and upcoming visits"}
    >
      <div className="space-y-4">
        <Panel title="Filters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "all" ? "All statuses" : value.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {staff ? (
              <div className="space-y-1.5">
                <Label htmlFor="doctor-filter">Doctor</Label>
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger id="doctor-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All doctors</SelectItem>
                    {(doctors.data ?? []).map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </Panel>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-3">
            <Panel title="Appointments" badge={<CountBadge>{rows.length} results</CountBadge>}>
              {query.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : rows.length === 0 ? (
                <EmptyState message="No appointments match these filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">Date</th>
                        <th className="py-2 pr-3 font-semibold">Time</th>
                        <th className="py-2 pr-3 font-semibold">Patient</th>
                        <th className="py-2 pr-3 font-semibold">Doctor</th>
                        <th className="py-2 pr-3 font-semibold">Reason</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        <th className="py-2 font-semibold">Manage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((row) => (
                        <tr key={row.id} className="border-b border-border/60">
                          <td className="whitespace-nowrap py-2 pr-3">{formatDate(row.scheduled_at)}</td>
                          <td className="whitespace-nowrap py-2 pr-3 font-semibold text-primary">
                            {formatTime(row.scheduled_at)}
                          </td>
                          <td className="py-2 pr-3">{row.patients?.full_name}</td>
                          <td className="py-2 pr-3">{row.doctors?.full_name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{row.reason}</td>
                          <td className="py-2 pr-3">
                            <StatusPill status={row.status} />
                          </td>
                          <td className="py-2">
                            <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                              Manage
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="calendar" className="mt-3">
            <MonthCalendar
              cursor={monthCursor}
              onCursorChange={setMonthCursor}
              byDay={byDay}
              onSelect={setSelected}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ManageDialog appointment={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}

function MonthCalendar({
  cursor,
  onCursorChange,
  byDay,
  onSelect,
}: {
  cursor: Date;
  onCursorChange: (date: Date) => void;
  byDay: Map<string, AppointmentRow[]>;
  onSelect: (row: AppointmentRow) => void;
}) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)),
  ];

  return (
    <Panel
      title={cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
      badge={
        <span className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous month"
            onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Next month"
            onClick={() => onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </span>
      }
    >
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} className="min-h-20 rounded bg-muted/40" />;
          const key = toDateKey(date);
          const items = byDay.get(key) ?? [];
          const isToday = key === toDateKey(new Date());
          return (
            <div
              key={key}
              className={`min-h-20 rounded border p-1 text-left ${
                isToday ? "border-primary bg-info-soft" : "border-border bg-card"
              }`}
            >
              <span className="text-[11px] font-semibold">{date.getDate()}</span>
              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 2).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="block w-full truncate rounded bg-secondary px-1 py-0.5 text-left text-[10px] hover:bg-accent"
                  >
                    {formatTime(item.scheduled_at)} {item.patients?.full_name?.split(" ")[0]}
                  </button>
                ))}
                {items.length > 2 ? (
                  <span className="block text-[10px] text-muted-foreground">+{items.length - 2} more</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ManageDialog({ appointment, onClose }: { appointment: AppointmentRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    onClose();
  };

  const cancel = async () => {
    if (!appointment) return;
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id);
    setBusy(false);
    if (error) {
      toast.error("Could not cancel this appointment.");
      return;
    }
    // notifications RLS requires user_id = auth.uid() (or staff). Address the
    // notification to the acting user, and to the patient when staff cancels.
    if (me?.userId) {
      const recipients = new Set<string>([me.userId]);
      const { data: patientOwner } = await supabase
        .from("patients")
        .select("user_id")
        .eq("id", appointment.patient_id)
        .maybeSingle();
      if (patientOwner?.user_id) recipients.add(patientOwner.user_id);

      const { error: notifyError } = await supabase.from("notifications").insert(
        [...recipients].map((userId) => ({
          user_id: userId,
          title: "Appointment cancelled",
          message: `${appointment.patients?.full_name}'s appointment with ${appointment.doctors?.full_name} was cancelled.`,
          kind: "warning",
        })),
      );
      if (notifyError) {
        console.error("Failed to create cancellation notification", notifyError);
        toast.warning("Appointment cancelled, but the notification could not be sent.");
      } else {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    }
    toast.success("Appointment cancelled");
    refresh();
  };

  const reschedule = async () => {
    if (!appointment || !newDate || !newTime) {
      toast.error("Choose a new date and time first.");
      return;
    }
    const next = new Date(`${newDate}T${newTime}`);
    if (next.getTime() < Date.now()) {
      toast.error("Appointments cannot be moved to a past date.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .update({ scheduled_at: next.toISOString(), status: "confirmed" })
      .eq("id", appointment.id);
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "That slot is already taken for this doctor."
          : "Could not reschedule this appointment.",
      );
      return;
    }
    toast.success("Appointment rescheduled");
    refresh();
  };

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage appointment</DialogTitle>
        </DialogHeader>
        {appointment ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="font-semibold">{appointment.patients?.full_name}</p>
              <p className="text-muted-foreground">
                {appointment.doctors?.full_name} · {formatDate(appointment.scheduled_at)} at{" "}
                {formatTime(appointment.scheduled_at)}
              </p>
              <p className="text-muted-foreground">{appointment.reason}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-date">New date</Label>
                <Input
                  id="new-date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-time">New time</Label>
                <Input
                  id="new-time"
                  type="time"
                  step={1800}
                  value={newTime}
                  onChange={(event) => setNewTime(event.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="destructive" onClick={cancel} disabled={busy}>
            Cancel appointment
          </Button>
          <Button onClick={reschedule} disabled={busy}>
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
