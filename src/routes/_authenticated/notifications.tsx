import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Panel, EmptyState, CountBadge } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/lib/queries";
import { formatDate, formatTime } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — CareConnect" },
      { name: "description", content: "Appointment reminders, cancellations and clinic alerts in one feed." },
      { property: "og:title", content: "Notifications — CareConnect" },
      { property: "og:description", content: "Reminders, cancellations and urgent clinic alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const notifications = useNotifications();
  const rows = notifications.data ?? [];

  return (
    <AppShell title="Notifications" subtitle="Reminders, alerts and clinic updates">
      <Panel title="Recent" badge={<CountBadge>{rows.length} items</CountBadge>}>
        {notifications.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState message="No notifications yet." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((item) => (
              <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(item.created_at)} {formatTime(item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
