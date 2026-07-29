import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Panel, EmptyState } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useDoctors } from "@/lib/queries";
import { WEEK_DAYS, slotsForHours, type WeekDay } from "@/lib/clinic";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 15 }, (_, index) => index + 6); // 06:00 – 20:00

/**
 * Working days, hours and availability for one doctor. Writes go through the
 * `doctors_self_update` policy, so a doctor may only edit their own row while
 * an administrator may edit any.
 */
export function DoctorSchedulePanel({ doctorId }: { doctorId: string | null }) {
  const doctors = useDoctors();
  const queryClient = useQueryClient();
  const doctor = (doctors.data ?? []).find((row) => row.id === doctorId) ?? null;

  const [days, setDays] = useState<WeekDay[]>([]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!doctor) return;
    setDays(((doctor.available_days ?? []) as string[]).filter((day): day is WeekDay =>
      (WEEK_DAYS as readonly string[]).includes(day),
    ));
    setStartHour(doctor.start_hour);
    setEndHour(doctor.end_hour);
    setIsActive(doctor.is_active);
  }, [doctor?.id, doctor?.start_hour, doctor?.end_hour, doctor?.is_active]);

  if (doctors.isLoading) return <Skeleton className="h-56 w-full" />;
  if (!doctor) {
    return (
      <Panel title="Schedule & availability">
        <EmptyState message="No doctor profile is linked to this account yet." />
      </Panel>
    );
  }

  const slotCount = slotsForHours(startHour, endHour).length;
  const invalid = endHour <= startHour || days.length === 0;

  const save = async () => {
    if (invalid) {
      toast.error("Pick at least one working day and an end time after the start time.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("doctors")
      .update({
        available_days: days,
        start_hour: startHour,
        end_hour: endHour,
        is_active: isActive,
      })
      .eq("id", doctor.id);
    setBusy(false);
    if (error) {
      toast.error("Could not save your schedule. Please try again.");
      return;
    }
    toast.success("Schedule updated — patients now see these slots.");
    queryClient.invalidateQueries({ queryKey: ["doctors"] });
  };

  return (
    <Panel title="Schedule & availability">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Working days</Label>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((day) => {
              const on = days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((prev) => (on ? prev.filter((d) => d !== day) : [...prev, day]))}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-semibold transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary hover:bg-info-soft",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="start-hour">Start time</Label>
            <Select value={`${startHour}`} onValueChange={(value) => setStartHour(Number(value))}>
              <SelectTrigger id="start-hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={`${hour}`}>{`${`${hour}`.padStart(2, "0")}:00`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-hour">End time</Label>
            <Select value={`${endHour}`} onValueChange={(value) => setEndHour(Number(value))}>
              <SelectTrigger id="end-hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={`${hour}`}>{`${`${hour}`.padStart(2, "0")}:00`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            Accepting new appointments
            <span className="block text-xs text-muted-foreground">
              Turn this off to hide yourself from patient booking.
            </span>
          </span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </label>

        <p className="text-xs text-muted-foreground">
          {invalid
            ? "Pick at least one working day and an end time after the start time."
            : `${slotCount} bookable 30-minute slots per working day (12:00–13:00 is reserved for lunch).`}
        </p>

        <Button onClick={save} disabled={busy || invalid}>
          {busy ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </Panel>
  );
}