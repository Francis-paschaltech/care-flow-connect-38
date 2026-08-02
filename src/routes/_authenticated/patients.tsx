import { createFileRoute } from "@tanstack/react-router";
import { requireRoles, STAFF_ROLES } from "@/lib/route-guards";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, Panel, EmptyState, CountBadge } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePatients, useMedicalRecords } from "@/lib/queries";
import { ageFrom, formatDate, initialsOf } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/patients")({
  beforeLoad: () => requireRoles(STAFF_ROLES),
  head: () => ({
    meta: [
      { title: "Patients — WellCare" },
      { name: "description", content: "Search the clinic patient directory, register new patients and open digital folders." },
      { property: "og:title", content: "Patients — WellCare" },
      { property: "og:description", content: "Search, register and review clinic patient records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const patients = usePatients(search);
  const records = useMedicalRecords({ patientId: selectedId });

  const selected = (patients.data ?? []).find((patient) => patient.id === selectedId) ?? null;

  return (
    <AppShell title="Patients" subtitle="Digital patient folders, searchable in seconds.">
      <div className="space-y-4">
        <Panel
          title="Patient directory"
          badge={
            <RegisterPatientDialog />
          }
        >
          <div className="mb-3 max-w-sm space-y-1.5">
            <Label htmlFor="patient-search">Search by name, code or phone</Label>
            <Input
              id="patient-search"
              value={search}
              maxLength={80}
              placeholder="e.g. Amina or P-0042"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {patients.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (patients.data ?? []).length === 0 ? (
            <EmptyState message="No patients match that search." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Patient</th>
                    <th className="py-2 pr-3 font-semibold">Code</th>
                    <th className="py-2 pr-3 font-semibold">Age</th>
                    <th className="py-2 pr-3 font-semibold">Phone</th>
                    <th className="py-2 pr-3 font-semibold">Blood</th>
                    <th className="py-2 font-semibold">Folder</th>
                  </tr>
                </thead>
                <tbody>
                  {(patients.data ?? []).map((patient) => (
                    <tr key={patient.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info-soft text-[11px] font-bold text-primary">
                            {initialsOf(patient.full_name)}
                          </span>
                          <span className="truncate font-medium">{patient.full_name}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{patient.patient_code}</td>
                      <td className="py-2 pr-3">{ageFrom(patient.date_of_birth) ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{patient.phone ?? "—"}</td>
                      <td className="py-2 pr-3">{patient.blood_group ?? "—"}</td>
                      <td className="py-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedId(patient.id)}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {selected ? (
          <Panel
            title={`${selected.full_name} · ${selected.patient_code}`}
            badge={<CountBadge>{(records.data ?? []).length} records</CountBadge>}
          >
            <dl className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {[
                ["Age", ageFrom(selected.date_of_birth) ?? "—"],
                ["Gender", selected.gender ?? "—"],
                ["Phone", selected.phone ?? "—"],
                ["Email", selected.email ?? "—"],
                ["Blood group", selected.blood_group ?? "—"],
                ["Emergency contact", selected.emergency_contact ?? "—"],
                ["Address", selected.address ?? "—"],
              ].map(([label, value]) => (
                <div key={label as string} className="min-w-0 rounded-md border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="truncate font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {(records.data ?? []).length === 0 ? (
              <EmptyState message="No medical records yet for this patient." />
            ) : (
              <ul className="space-y-2">
                {(records.data ?? []).slice(0, 8).map((record) => (
                  <li key={record.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-semibold">{record.diagnosis}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(record.created_at)} · {record.doctors?.full_name ?? "Clinic"}
                    </p>
                    {record.prescription ? (
                      <p className="mt-1 text-xs">Rx: {record.prescription}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}

function RegisterPatientDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", date_of_birth: "", blood_group: "" });
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async () => {
    if (form.full_name.trim().length < 2) {
      toast.error("Enter the patient's full name.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("patients").insert({
      patient_code: `P-${Date.now().toString(36).toUpperCase()}`,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      blood_group: form.blood_group.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not register this patient.");
      return;
    }
    toast.success("Patient registered");
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    setForm({ full_name: "", email: "", phone: "", date_of_birth: "", blood_group: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Register patient</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a new patient</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="np-name">Full name</Label>
            <Input id="np-name" maxLength={100} value={form.full_name} onChange={update("full_name")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-email">Email</Label>
            <Input id="np-email" type="email" maxLength={255} value={form.email} onChange={update("email")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-phone">Phone</Label>
            <Input id="np-phone" maxLength={30} value={form.phone} onChange={update("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-dob">Date of birth</Label>
            <Input id="np-dob" type="date" value={form.date_of_birth} onChange={update("date_of_birth")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-blood">Blood group</Label>
            <Input id="np-blood" maxLength={5} value={form.blood_group} onChange={update("blood_group")} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Register patient"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
