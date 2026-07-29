export type AppRole = "patient" | "doctor" | "nurse" | "receptionist" | "admin";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

export const roleLabels: Record<AppRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  admin: "Clinic Manager",
};

export const statusLabels: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export function statusToneClass(status: AppointmentStatus | string) {
  switch (status) {
    case "confirmed":
      return "bg-success-soft text-success border-success/30";
    case "completed":
      return "bg-info-soft text-primary border-primary/25";
    case "checked_in":
      return "bg-accent text-accent-foreground border-border";
    case "cancelled":
      return "bg-danger-soft text-destructive border-destructive/25";
    case "no_show":
      return "bg-warning-soft text-warning-foreground border-warning/35";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function initialsOf(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ageFrom(dob: string | null | undefined) {
  if (!dob) return null;
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
