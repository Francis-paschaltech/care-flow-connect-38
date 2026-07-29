import { createFileRoute } from "@tanstack/react-router";
import { requireRoles } from "@/lib/route-guards";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, Panel } from "@/components/app/app-shell";
import { StatCard } from "@/components/dashboards/patient-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, CheckCircle2, UserX, XCircle } from "lucide-react";
import { useAppointments, useClinicStats, addDays, startOfDay } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/reports")({
  beforeLoad: () => requireRoles(["doctor", "receptionist", "admin"]),
  head: () => ({
    meta: [
      { title: "Clinic Reports — CareConnect" },
      { name: "description", content: "Attendance statistics, no-show trends and doctor utilisation charts for the clinic." },
      { property: "og:title", content: "Clinic Reports — CareConnect" },
      { property: "og:description", content: "Attendance rates, no-show trends and doctor utilisation at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)"];

function ReportsPage() {
  const stats = useClinicStats();
  const range = useAppointments({
    from: addDays(startOfDay(), -90),
    to: addDays(startOfDay(), 1),
    limit: 1000,
  });

  const rows = range.data ?? [];

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; attended: number; noShow: number; cancelled: number }>();
    rows.forEach((row) => {
      const date = new Date(row.scheduled_at);
      const key = date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const entry = map.get(key) ?? { month: key, attended: 0, noShow: 0, cancelled: 0 };
      if (row.status === "completed") entry.attended += 1;
      if (row.status === "no_show") entry.noShow += 1;
      if (row.status === "cancelled") entry.cancelled += 1;
      map.set(key, entry);
    });
    return [...map.values()];
  }, [rows]);

  const utilisation = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const name = row.doctors?.full_name ?? "Unassigned";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([doctor, count]) => ({ doctor: doctor.replace("Dr. ", "Dr "), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [rows]);

  const statusSplit = useMemo(
    () =>
      [
        { name: "Completed", value: rows.filter((row) => row.status === "completed").length },
        { name: "Cancelled", value: rows.filter((row) => row.status === "cancelled").length },
        { name: "No-show", value: rows.filter((row) => row.status === "no_show").length },
        {
          name: "Scheduled",
          value: rows.filter((row) => ["pending", "confirmed", "checked_in"].includes(row.status)).length,
        },
      ].filter((entry) => entry.value > 0),
    [rows],
  );

  if (stats.isLoading || range.isLoading) {
    return (
      <AppShell title="Clinic reports" subtitle="Attendance, no-shows and utilisation">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Clinic reports" subtitle="Last 90 days of clinic activity">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total appointments" value={stats.data?.appointments ?? 0} icon={CalendarCheck} />
          <StatCard label="Attendance rate" value={`${stats.data?.attendanceRate ?? 0}%`} icon={CheckCircle2} />
          <StatCard label="No-shows" value={stats.data?.noShow ?? 0} icon={UserX} />
          <StatCard label="Cancellations" value={stats.data?.cancelled ?? 0} icon={XCircle} />
        </div>

        <Panel title="Attendance vs no-shows by month">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="attended" stroke="var(--color-chart-2)" strokeWidth={2} name="Attended" />
                <Line type="monotone" dataKey="noShow" stroke="var(--color-chart-5)" strokeWidth={2} name="No-shows" />
                <Line type="monotone" dataKey="cancelled" stroke="var(--color-chart-4)" strokeWidth={2} name="Cancelled" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Doctor utilisation">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilisation} layout="vertical" margin={{ left: 24, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    type="category"
                    dataKey="doctor"
                    width={110}
                    tick={{ fontSize: 11 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Appointments" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Appointment outcomes">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusSplit} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                    {statusSplit.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {statusSplit.map((entry, index) => (
                <li key={entry.name} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="truncate">
                    {entry.name} · {entry.value}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
