import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, isStaffRole } from "@/hooks/use-auth";
import { formatDate, formatTime, roleLabels, type AppRole } from "./clinic";

export type SearchGroup =
  | "Doctors"
  | "Patients"
  | "Appointments"
  | "Medical records"
  | "Staff"
  | "Reports";

export type SearchResult = {
  id: string;
  group: SearchGroup;
  label: string;
  sublabel: string;
  to: string;
};

/**
 * Which entities each role is allowed to search. This mirrors the RLS rules —
 * it is a UX affordance, not the security boundary: every query below still
 * runs as the signed-in user and is filtered by row level security.
 */
export const SEARCH_SCOPE: Record<AppRole, SearchGroup[]> = {
  patient: ["Doctors", "Appointments", "Medical records"],
  doctor: ["Patients", "Appointments", "Medical records"],
  nurse: ["Patients", "Appointments", "Doctors"],
  receptionist: ["Patients", "Appointments", "Doctors"],
  admin: ["Staff", "Patients", "Doctors", "Appointments", "Medical records", "Reports"],
};

function likeTerm(term: string) {
  return `%${term.trim().replace(/[%,()]/g, "")}%`;
}

function matches(term: string, ...values: (string | null | undefined)[]) {
  const needle = term.trim().toLowerCase();
  return values.some((value) => (value ?? "").toLowerCase().includes(needle));
}

/**
 * Global search used by the header search bar. Results are scoped by role and
 * by the caller's own identity (a patient only ever searches their own
 * appointments and records, a doctor only their own schedule).
 */
export function useGlobalSearch(term: string) {
  const { data: me } = useCurrentUser();
  const role = me?.role ?? "patient";
  const scope = SEARCH_SCOPE[role];
  const enabled = !!me && term.trim().length >= 2;

  return useQuery({
    queryKey: ["global-search", role, me?.userId ?? null, term.trim().toLowerCase()],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<SearchResult[]> => {
      const like = likeTerm(term);
      const results: SearchResult[] = [];

      const tasks: Promise<void>[] = [];

      if (scope.includes("Doctors")) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("doctors")
              .select("id, full_name, specialty, is_active")
              .or(`full_name.ilike.${like},specialty.ilike.${like}`)
              .order("full_name")
              .limit(6);
            (data ?? []).forEach((doctor) =>
              results.push({
                id: `doctor-${doctor.id}`,
                group: "Doctors",
                label: doctor.full_name,
                sublabel: `${doctor.specialty}${doctor.is_active ? "" : " · inactive"}`,
                to: role === "admin" ? "/admin" : "/book",
              }),
            );
          })(),
        );
      }

      if (scope.includes("Patients") && isStaffRole(role)) {
        tasks.push(
          (async () => {
            const { data } = await supabase
              .from("patients")
              .select("id, full_name, patient_code, phone")
              .or(`full_name.ilike.${like},patient_code.ilike.${like},phone.ilike.${like}`)
              .order("full_name")
              .limit(6);
            (data ?? []).forEach((patient) =>
              results.push({
                id: `patient-${patient.id}`,
                group: "Patients",
                label: patient.full_name,
                sublabel: `${patient.patient_code}${patient.phone ? ` · ${patient.phone}` : ""}`,
                to: "/patients",
              }),
            );
          })(),
        );
      }

      if (scope.includes("Appointments")) {
        tasks.push(
          (async () => {
            let query = supabase
              .from("appointments")
              .select(
                "id, scheduled_at, status, reason, patients(full_name, patient_code), doctors(full_name)",
              )
              .order("scheduled_at", { ascending: false })
              .limit(300);
            if (role === "patient" && me?.patientId) query = query.eq("patient_id", me.patientId);
            if (role === "doctor" && me?.doctorId) query = query.eq("doctor_id", me.doctorId);
            const { data } = await query;
            (data ?? [])
              .filter((row: any) =>
                matches(
                  term,
                  row.patients?.full_name,
                  row.patients?.patient_code,
                  row.doctors?.full_name,
                  row.reason,
                  row.status,
                ),
              )
              .slice(0, 6)
              .forEach((row: any) =>
                results.push({
                  id: `appointment-${row.id}`,
                  group: "Appointments",
                  label: `${row.patients?.full_name ?? "Patient"} — ${row.doctors?.full_name ?? "Doctor"}`,
                  sublabel: `${formatDate(row.scheduled_at)} · ${formatTime(row.scheduled_at)} · ${row.reason ?? "Consultation"}`,
                  to: "/appointments",
                }),
              );
          })(),
        );
      }

      if (scope.includes("Medical records")) {
        tasks.push(
          (async () => {
            let query = supabase
              .from("medical_records")
              .select("id, diagnosis, created_at, patients(full_name), doctors(full_name)")
              .ilike("diagnosis", like)
              .order("created_at", { ascending: false })
              .limit(6);
            if (role === "patient" && me?.patientId) query = query.eq("patient_id", me.patientId);
            if (role === "doctor" && me?.doctorId) query = query.eq("doctor_id", me.doctorId);
            const { data } = await query;
            (data ?? []).forEach((record: any) =>
              results.push({
                id: `record-${record.id}`,
                group: "Medical records",
                label: record.diagnosis,
                sublabel: `${record.patients?.full_name ?? "You"} · ${formatDate(record.created_at)}`,
                to: "/records",
              }),
            );
          })(),
        );
      }

      if (scope.includes("Staff")) {
        tasks.push(
          (async () => {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .or(`full_name.ilike.${like},email.ilike.${like}`)
              .limit(20);
            if (!profiles?.length) return;
            const { data: roles } = await supabase
              .from("user_roles")
              .select("user_id, role")
              .in(
                "user_id",
                profiles.map((profile) => profile.id),
              );
            const roleById = new Map((roles ?? []).map((row) => [row.user_id, row.role as AppRole]));
            profiles
              .filter((profile) => (roleById.get(profile.id) ?? "patient") !== "patient")
              .slice(0, 6)
              .forEach((profile) =>
                results.push({
                  id: `staff-${profile.id}`,
                  group: "Staff",
                  label: profile.full_name || profile.email || "Staff member",
                  sublabel: `${roleLabels[roleById.get(profile.id) ?? "patient"]} · ${profile.email ?? ""}`,
                  to: "/admin",
                }),
              );
          })(),
        );
      }

      await Promise.all(tasks);

      if (scope.includes("Reports") && matches(term, "reports", "attendance", "no-show", "utilisation")) {
        results.push({
          id: "reports",
          group: "Reports",
          label: "Clinic reports",
          sublabel: "Attendance, no-shows and doctor utilisation",
          to: "/reports",
        });
      }

      return results;
    },
  });
}