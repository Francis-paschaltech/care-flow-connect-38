import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Panel, EmptyState, CountBadge } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, isStaffRole } from "@/hooks/use-auth";
import { useMedicalRecords } from "@/lib/queries";
import { formatDate } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [
      { title: "Medical Records — WellCare" },
      { name: "description", content: "Consultation notes, diagnoses, prescriptions and follow-up plans in one digital folder." },
      { property: "og:title", content: "Medical Records — WellCare" },
      { property: "og:description", content: "Diagnoses, prescriptions and follow-up plans per patient visit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const { data: me } = useCurrentUser();
  const staff = isStaffRole(me?.role);
  const [search, setSearch] = useState("");
  const records = useMedicalRecords({
    patientId: staff ? undefined : me?.patientId,
    search: staff ? search : undefined,
  });

  return (
    <AppShell
      title="Medical records"
      subtitle={staff ? "Consultation notes across the clinic" : "Your consultation history"}
    >
      <Panel
        title="Records"
        badge={<CountBadge>{(records.data ?? []).length} entries</CountBadge>}
      >
        {staff ? (
          <div className="mb-3 max-w-sm space-y-1.5">
            <Label htmlFor="record-search">Search diagnosis</Label>
            <Input
              id="record-search"
              value={search}
              maxLength={80}
              placeholder="e.g. hypertension"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        ) : null}

        {records.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (records.data ?? []).length === 0 ? (
          <EmptyState message="No medical records found." />
        ) : (
          <ul className="space-y-3">
            {(records.data ?? []).map((record) => (
              <li key={record.id} className="surface-panel p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{record.diagnosis}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.patients?.full_name ?? "You"} · {record.doctors?.full_name ?? "Clinic"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(record.created_at)}
                  </span>
                </div>
                {record.prescription ? (
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Prescription:</span> {record.prescription}
                  </p>
                ) : null}
                {record.notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">{record.notes}</p>
                ) : null}
                {record.follow_up ? (
                  <p className="mt-1 text-xs text-primary">Follow-up: {record.follow_up}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
