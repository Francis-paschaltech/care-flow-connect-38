import { Users, Stethoscope, CalendarCheck, TrendingUp } from "lucide-react";
import { Panel, EmptyState } from "@/components/app/app-shell";
import { StatCard } from "@/components/dashboards/patient-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogs, useClinicStats, useNotifications } from "@/lib/queries";
import { formatDate, formatTime } from "@/lib/clinic";

export function AdminDashboard() {
  const stats = useClinicStats();
  const logs = useAuditLogs(true);
  const notifications = useNotifications();

  if (stats.isLoading) return <Skeleton className="h-72 w-full" />;
  const data = stats.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total patients" value={data?.patients ?? 0} icon={Users} />
        <StatCard label="Total doctors" value={data?.doctors ?? 0} icon={Stethoscope} />
        <StatCard label="Total appointments" value={data?.appointments ?? 0} icon={CalendarCheck} />
        <StatCard
          label="Attendance rate"
          value={`${data?.attendanceRate ?? 0}%`}
          hint={`${data?.noShow ?? 0} no-shows · ${data?.cancelled ?? 0} cancellations`}
          icon={TrendingUp}
        />
      </div>

      <Panel title="System activity feed">
        {(notifications.data ?? []).length === 0 ? (
          <EmptyState message="No system activity recorded." />
        ) : (
          <ul className="divide-y divide-border">
            {(notifications.data ?? []).slice(0, 6).map((item) => (
              <li key={item.id} className="py-2.5">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.message} · {formatDate(item.created_at)} {formatTime(item.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Audit logs">
        {(logs.data ?? []).length === 0 ? (
          <EmptyState message="No audit entries yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Actor</th>
                  <th className="py-2 pr-3 font-semibold">Action</th>
                  <th className="py-2 pr-3 font-semibold">Entity</th>
                  <th className="py-2 pr-3 font-semibold">Detail</th>
                  <th className="py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).slice(0, 12).map((log) => (
                  <tr key={log.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{log.actor}</td>
                    <td className="py-2 pr-3 font-semibold text-primary">{log.action}</td>
                    <td className="py-2 pr-3">{log.entity}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{log.detail}</td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(log.created_at)} {formatTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
