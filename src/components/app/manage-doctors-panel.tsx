import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Panel, EmptyState } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments, useDoctors } from "@/lib/queries";
import { WEEK_DAYS } from "@/lib/clinic";

const NO_DEPARTMENT = "none";

type Draft = {
  id: string | null;
  fullName: string;
  specialty: string;
  departmentId: string;
  email: string;
  phone: string;
  yearsExperience: string;
  startHour: string;
  endHour: string;
  availableDays: string[];
  isActive: boolean;
};

const EMPTY: Draft = {
  id: null,
  fullName: "",
  specialty: "",
  departmentId: NO_DEPARTMENT,
  email: "",
  phone: "",
  yearsExperience: "5",
  startHour: "9",
  endHour: "17",
  availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  isActive: true,
};

export function ManageDoctorsPanel() {
  const doctors = useDoctors();
  const departments = useDepartments();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const departmentNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of departments.data ?? []) map.set(department.id, department.name);
    return map;
  }, [departments.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["doctors"] });
    void queryClient.invalidateQueries({ queryKey: ["appointments"] });
  };

  const toggleDay = (day: string) => {
    if (!draft) return;
    const next = draft.availableDays.includes(day)
      ? draft.availableDays.filter((value) => value !== day)
      : [...draft.availableDays, day];
    setDraft({ ...draft, availableDays: WEEK_DAYS.filter((value) => next.includes(value)) });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const fullName = draft.fullName.trim();
    const specialty = draft.specialty.trim();
    const startHour = Number(draft.startHour);
    const endHour = Number(draft.endHour);

    if (!fullName || !specialty) {
      toast.error("Name and specialty are required.");
      return;
    }
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || startHour < 0 || endHour > 24 || startHour >= endHour) {
      toast.error("Consulting hours must start before they end, between 0 and 24.");
      return;
    }
    if (draft.availableDays.length === 0) {
      toast.error("Select at least one working day.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        full_name: fullName,
        specialty,
        department_id: draft.departmentId === NO_DEPARTMENT ? null : draft.departmentId,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        years_experience: Math.max(0, Number(draft.yearsExperience) || 0),
        start_hour: startHour,
        end_hour: endHour,
        available_days: draft.availableDays,
        is_active: draft.isActive,
      };
      const { error } = draft.id
        ? await supabase.from("doctors").update(payload).eq("id", draft.id)
        : await supabase.from("doctors").insert(payload);
      if (error) throw error;
      toast.success(draft.id ? "Doctor profile updated" : "Doctor added");
      setDraft(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the doctor profile.");
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (id: string, isActive: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("doctors").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
      toast.success(isActive ? "Doctor is now accepting bookings" : "Doctor hidden from booking");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update availability.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Doctors"
      badge={
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY })} disabled={busy}>
          <Plus className="mr-1.5 size-4" /> Add doctor
        </Button>
      }
    >
      {draft ? (
        <form className="mb-4 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2" onSubmit={save} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="doc-name">Full name</Label>
            <Input
              id="doc-name"
              required
              maxLength={120}
              value={draft.fullName}
              onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-specialty">Specialty</Label>
            <Input
              id="doc-specialty"
              required
              maxLength={120}
              value={draft.specialty}
              onChange={(event) => setDraft({ ...draft, specialty: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-department">Department</Label>
            <Select
              value={draft.departmentId}
              onValueChange={(value) => setDraft({ ...draft, departmentId: value })}
            >
              <SelectTrigger id="doc-department">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                {(departments.data ?? []).map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-experience">Years of experience</Label>
            <Input
              id="doc-experience"
              type="number"
              min={0}
              max={70}
              value={draft.yearsExperience}
              onChange={(event) => setDraft({ ...draft, yearsExperience: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-email">Email</Label>
            <Input
              id="doc-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-phone">Phone</Label>
            <Input
              id="doc-phone"
              type="tel"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-start">Start hour</Label>
            <Input
              id="doc-start"
              type="number"
              min={0}
              max={23}
              value={draft.startHour}
              onChange={(event) => setDraft({ ...draft, startHour: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-end">End hour</Label>
            <Input
              id="doc-end"
              type="number"
              min={1}
              max={24}
              value={draft.endHour}
              onChange={(event) => setDraft({ ...draft, endHour: event.target.value })}
            />
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Working days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((day) => {
                const selected = draft.availableDays.includes(day);
                return (
                  <Button
                    key={day}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch
              id="doc-active"
              checked={draft.isActive}
              onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
            />
            <Label htmlFor="doc-active">Accepting bookings</Label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {draft.id ? "Save changes" : "Add doctor"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              <X className="mr-1.5 size-4" /> Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {doctors.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (doctors.data ?? []).length === 0 ? (
        <EmptyState message="No doctors registered yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Doctor</th>
                <th className="py-2 pr-3 font-semibold">Specialty</th>
                <th className="py-2 pr-3 font-semibold">Department</th>
                <th className="py-2 pr-3 font-semibold">Hours</th>
                <th className="py-2 pr-3 font-semibold">Days</th>
                <th className="py-2 pr-3 font-semibold">Bookable</th>
                <th className="py-2 font-semibold">Edit</th>
              </tr>
            </thead>
            <tbody>
              {(doctors.data ?? []).map((doctor) => (
                <tr key={doctor.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{doctor.full_name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{doctor.specialty}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {doctor.department_id ? (departmentNames.get(doctor.department_id) ?? "—") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {doctor.start_hour}:00 – {doctor.end_hour}:00
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {(doctor.available_days ?? []).join(", ") || "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <Switch
                      checked={doctor.is_active}
                      aria-label={`Bookings for ${doctor.full_name}`}
                      disabled={busy}
                      onCheckedChange={(checked) => setActive(doctor.id, checked)}
                    />
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          id: doctor.id,
                          fullName: doctor.full_name,
                          specialty: doctor.specialty,
                          departmentId: doctor.department_id ?? NO_DEPARTMENT,
                          email: doctor.email ?? "",
                          phone: doctor.phone ?? "",
                          yearsExperience: String(doctor.years_experience ?? 0),
                          startHour: String(doctor.start_hour),
                          endHour: String(doctor.end_hour),
                          availableDays: doctor.available_days ?? [],
                          isActive: doctor.is_active,
                        })
                      }
                    >
                      <Pencil className="mr-1.5 size-3.5" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
