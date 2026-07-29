import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { AppShell, Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, isStaffRole } from "@/hooks/use-auth";
import { useAppointments, useDepartments, useDoctors } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { createNotifications } from "@/lib/notifications.functions";
import { slotsForHours, weekDayOf, type WeekDay } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book an Appointment — CareConnect" },
      { name: "description", content: "Book a clinic appointment in three steps: your details, doctor and department, then date and time." },
      { property: "og:title", content: "Book an Appointment — CareConnect" },
      { property: "og:description", content: "Pick a department, doctor and available time slot in a few clicks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

const STEPS = ["Your details", "Doctor & reason", "Date & time"];

function BookPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const notify = useServerFn(createNotifications);
  const staff = isStaffRole(me?.role);
  const departments = useDepartments();
  const doctors = useDoctors();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slot, setSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredDoctors = useMemo(
    () =>
      (doctors.data ?? []).filter(
        (doctor) => doctor.is_active && (!departmentId || doctor.department_id === departmentId),
      ),
    [doctors.data, departmentId],
  );

  const selectedDoctor = useMemo(
    () => (doctors.data ?? []).find((doctor) => doctor.id === doctorId) ?? null,
    [doctors.data, doctorId],
  );

  // Slots come from the doctor's own configured working hours and days, so a
  // patient can never book outside the times the doctor set for themselves.
  const workingDays = useMemo(
    () => ((selectedDoctor?.available_days ?? []) as string[]) as WeekDay[],
    [selectedDoctor],
  );
  const dayIsWorked = useMemo(() => {
    if (!date || workingDays.length === 0) return false;
    return workingDays.includes(weekDayOf(new Date(`${date}T00:00`)));
  }, [date, workingDays]);
  const slots = useMemo(
    () => (selectedDoctor ? slotsForHours(selectedDoctor.start_hour, selectedDoctor.end_hour) : []),
    [selectedDoctor],
  );

  const dayStart = new Date(`${date}T00:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const dayAppointments = useAppointments({
    from: dayStart,
    to: dayEnd,
    doctorId: doctorId || undefined,
    enabled: !!doctorId,
    limit: 100,
  });

  const takenSlots = new Set(
    (dayAppointments.data ?? [])
      .filter((row) => row.status !== "cancelled")
      .map((row) =>
        new Date(row.scheduled_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      ),
  );

  const nameValue = staff ? fullName : (me?.fullName ?? "");
  const emailValue = staff ? email : (me?.email ?? "");

  const stepValid = (index: number) => {
    if (index === 0) return staff ? fullName.trim().length > 1 && /.+@.+\..+/.test(email) : true;
    if (index === 1) return !!doctorId && reason.trim().length > 2;
    return !!date && !!slot && dayIsWorked;
  };

  const submit = async () => {
    if (!stepValid(2)) {
      toast.error(
        dayIsWorked
          ? "Pick a date and an available time slot."
          : "The selected doctor does not work on that day. Please choose another date.",
      );
      return;
    }
    setSubmitting(true);
    try {
      let patientId = me?.patientId ?? null;

      if (staff) {
        const { data: existing } = await supabase
          .from("patients")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();
        if (existing) {
          patientId = existing.id;
        } else {
          const { data: created, error: patientError } = await supabase
            .from("patients")
            .insert({
              patient_code: `P-${Date.now().toString(36).toUpperCase()}`,
              full_name: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim() || null,
              date_of_birth: dob || null,
            })
            .select("id")
            .single();
          if (patientError) throw patientError;
          patientId = created.id;
        }
      }

      if (!patientId) throw new Error("No patient record is linked to this account.");

      const scheduledAt = new Date(`${date}T${slot}`);
      const { error } = await supabase.from("appointments").insert({
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId || null,
        scheduled_at: scheduledAt.toISOString(),
        reason: reason.trim(),
        status: "confirmed",
      });
      if (error) throw error;

      // Notifications are created server-side (RLS still applies as the
      // acting user) so failures surface instead of being silently dropped.
      if (me?.userId) {
        try {
          await notify({
            data: {
              recipients: [me.userId],
              title: "New appointment booked",
              message: `${nameValue} booked ${date} at ${slot}.`,
              kind: "info",
            },
          });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        } catch (notifyError) {
          console.error("Failed to create booking notification", notifyError);
          toast.warning("Appointment booked, but we could not create your reminder notification.");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment confirmed", {
        description: `${date} at ${slot}. A confirmation has been sent.`,
      });
      navigate({ to: "/appointments" });
    } catch (error) {
      toast.error(
        (error as { code?: string }).code === "23505"
          ? "That slot has just been taken. Please pick another time."
          : "Could not complete the booking. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Book an appointment" subtitle="Three quick steps — details, doctor, then time.">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <ol className="grid grid-cols-3 gap-2" aria-label="Booking progress">
          {STEPS.map((label, index) => (
            <li key={label} className="min-w-0">
              <button
                type="button"
                onClick={() => (index < step ? setStep(index) : null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left",
                  index === step
                    ? "border-primary bg-info-soft"
                    : index < step
                      ? "border-success/40 bg-success-soft"
                      : "border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                    index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {index < step ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span className="truncate text-xs font-semibold sm:text-sm">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <Panel title="Patient details">
            {staff ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input id="full-name" value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{nameValue}</p>
                <p className="text-muted-foreground">{emailValue}</p>
                <p className="text-muted-foreground">
                  Booking for your own patient record. Contact the front desk to update your details.
                </p>
              </div>
            )}
          </Panel>
        ) : null}

        {step === 1 ? (
          <Panel title="Doctor & reason">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={departmentId}
                  onValueChange={(value) => {
                    setDepartmentId(value);
                    setDoctorId("");
                  }}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Any department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departments.data ?? []).map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doctor">Doctor</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger id="doctor">
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.full_name} — {doctor.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="reason">Reason for visit</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  maxLength={500}
                  rows={3}
                  placeholder="Describe your symptoms or the purpose of the visit"
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          </Panel>
        ) : null}

        {step === 2 ? (
          <Panel title="Date & time">
            <div className="space-y-4">
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="date">Preferred date</Label>
                <Input
                  id="date"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSlot("");
                  }}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Available time slots</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {SLOTS.map((value) => {
                    const taken = takenSlots.has(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={taken}
                        onClick={() => setSlot(value)}
                        className={cn(
                          "rounded-md border px-2 py-2 text-sm font-semibold transition-colors",
                          taken
                            ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
                            : slot === value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-primary hover:bg-info-soft",
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">Summary</p>
                <p className="text-muted-foreground">
                  {nameValue || "Patient"} ·{" "}
                  {filteredDoctors.find((doctor) => doctor.id === doctorId)?.full_name ?? "Doctor"} · {date}
                  {slot ? ` at ${slot}` : ""}
                </p>
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => (stepValid(step) ? setStep(step + 1) : toast.error("Complete this step first."))}
            >
              Continue
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Confirming…" : "Confirm booking"}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
