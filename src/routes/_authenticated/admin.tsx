import { createFileRoute } from "@tanstack/react-router";
import { requireRoles } from "@/lib/route-guards";
import { AppShell, Panel, EmptyState } from "@/components/app/app-shell";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { CreateStaffPanel } from "@/components/app/create-staff-panel";
import { ManageStaffPanel } from "@/components/app/manage-staff-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments, useDoctors } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => requireRoles(["admin"]),
  head: () => ({
    meta: [
      { title: "Administration — WellCare" },
      { name: "description", content: "Clinic administration: staff directory, departments, system activity and audit logs." },
      { property: "og:title", content: "Administration — WellCare" },
      { property: "og:description", content: "Manage doctors, departments and review clinic audit logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const doctors = useDoctors();
  const departments = useDepartments();

  return (
    <AppShell title="Administration" subtitle="Staff, departments and system oversight">
      <div className="space-y-4">
        <AdminDashboard />

        <CreateStaffPanel onCreated={() => doctors.refetch()} />

        <ManageStaffPanel />

        <Panel title="Doctors">
          {doctors.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (doctors.data ?? []).length === 0 ? (
            <EmptyState message="No doctors registered." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Doctor</th>
                    <th className="py-2 pr-3 font-semibold">Specialty</th>
                    <th className="py-2 pr-3 font-semibold">Hours</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(doctors.data ?? []).map((doctor) => (
                    <tr key={doctor.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{doctor.full_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{doctor.specialty}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {doctor.start_hour}:00 – {doctor.end_hour}:00
                      </td>
                      <td className="py-2">{doctor.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Departments">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(departments.data ?? []).map((department) => (
              <div key={department.id} className="rounded-md border border-border p-3">
                <p className="font-semibold">{department.name}</p>
                <p className="text-xs text-muted-foreground">{department.description}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
