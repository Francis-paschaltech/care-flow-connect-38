import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  department_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason: string | null;
  notes: string | null;
  patients: { full_name: string; patient_code: string; phone: string | null } | null;
  doctors: { full_name: string; specialty: string } | null;
  departments: { name: string } | null;
};

const APPOINTMENT_SELECT =
  "id, patient_id, doctor_id, department_id, scheduled_at, duration_minutes, status, reason, notes, patients(full_name, patient_code, phone), doctors(full_name, specialty), departments(name)";

export function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function useAppointments(filters: {
  from?: Date;
  to?: Date;
  doctorId?: string | null;
  patientId?: string | null;
  limit?: number;
  enabled?: boolean;
}) {
  const { from, to, doctorId, patientId, limit = 500, enabled = true } = filters;
  return useQuery({
    queryKey: [
      "appointments",
      from?.toISOString() ?? null,
      to?.toISOString() ?? null,
      doctorId ?? null,
      patientId ?? null,
      limit,
    ],
    enabled,
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (from) query = query.gte("scheduled_at", from.toISOString());
      if (to) query = query.lt("scheduled_at", to.toISOString());
      if (doctorId) query = query.eq("doctor_id", doctorId);
      if (patientId) query = query.eq("patient_id", patientId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });
}

export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select(
          "id, full_name, specialty, department_id, email, phone, is_active, years_experience, start_hour, end_hour, available_days",
        )
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, description").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePatients(search: string) {
  return useQuery({
    queryKey: ["patients", search],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("id, patient_code, full_name, gender, date_of_birth, phone, email, address, emergency_contact, blood_group, created_at")
        .order("full_name")
        .limit(200);
      if (search.trim()) {
        const term = `%${search.trim().replace(/[%,]/g, "")}%`;
        query = query.or(`full_name.ilike.${term},patient_code.ilike.${term},phone.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMedicalRecords(filters: { patientId?: string | null; doctorId?: string | null; search?: string }) {
  const { patientId, doctorId, search = "" } = filters;
  return useQuery({
    queryKey: ["medical-records", patientId ?? null, doctorId ?? null, search],
    queryFn: async () => {
      let query = supabase
        .from("medical_records")
        .select(
          "id, diagnosis, notes, prescription, follow_up, created_at, patient_id, patients(full_name, patient_code), doctors(full_name, specialty)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (patientId) query = query.eq("patient_id", patientId);
      if (doctorId) query = query.eq("doctor_id", doctorId);
      if (search.trim()) query = query.ilike("diagnosis", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, kind, is_read, created_at, audience")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useClinicStats() {
  return useQuery({
    queryKey: ["clinic-stats"],
    queryFn: async () => {
      const [patients, doctors, appointments, completed, noShow, cancelled] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("doctors").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "no_show"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
      ]);
      const total = appointments.count ?? 0;
      const done = completed.count ?? 0;
      return {
        patients: patients.count ?? 0,
        doctors: doctors.count ?? 0,
        appointments: total,
        completed: done,
        noShow: noShow.count ?? 0,
        cancelled: cancelled.count ?? 0,
        attendanceRate: total ? Math.round((done / total) * 100) : 0,
      };
    },
  });
}

export function useAuditLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["audit-logs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, actor, action, entity, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
}
