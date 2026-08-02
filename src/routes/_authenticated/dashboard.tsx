import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/app-shell";
import { PatientDashboard } from "@/components/dashboards/patient-dashboard";
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard";
import { StaffDashboard } from "@/components/dashboards/staff-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { useCurrentUser } from "@/hooks/use-auth";
import { formatLongDate, greeting, roleLabels } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WellCare" },
      { name: "description", content: "Your WellCare clinic dashboard: appointments, arrivals, alerts and daily summary." },
      { property: "og:title", content: "Dashboard — WellCare" },
      { property: "og:description", content: "Appointments, arrivals, alerts and clinic activity at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useCurrentUser();
  const role = data?.role ?? "patient";
  const displayName = role === "doctor" ? (data?.doctorName ?? data?.fullName) : data?.fullName;

  return (
    <AppShell
      title={`${greeting()}, ${displayName ?? ""}`}
      subtitle={`${formatLongDate(new Date())} · ${roleLabels[role]}`}
    >
      {role === "patient" ? <PatientDashboard patientId={data?.patientId ?? null} /> : null}
      {role === "doctor" ? <DoctorDashboard doctorId={data?.doctorId ?? null} /> : null}
      {role === "nurse" || role === "receptionist" ? <StaffDashboard /> : null}
      {role === "admin" ? <AdminDashboard /> : null}
    </AppShell>
  );
}
