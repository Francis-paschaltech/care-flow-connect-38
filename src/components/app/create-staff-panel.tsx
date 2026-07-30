import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStaffAccount } from "@/lib/admin-staff.functions";
import { roleLabels } from "@/lib/clinic";
import { useDepartments } from "@/lib/queries";

const STAFF_ROLE_OPTIONS = ["doctor", "nurse", "receptionist", "admin"] as const;

type StaffRole = (typeof STAFF_ROLE_OPTIONS)[number];

const EMPTY = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  specialty: "",
  departmentId: "",
};

export function CreateStaffPanel({ onCreated }: { onCreated?: () => void }) {
  const departments = useDepartments();
  const createStaff = useServerFn(createStaffAccount);
  const [role, setRole] = useState<StaffRole>("doctor");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createStaff({ data: { ...form, role } });
      toast.success(`${roleLabels[role]} account created`);
      setForm(EMPTY);
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create the account.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Create a staff account">
      <p className="mb-3 text-sm text-muted-foreground">
        Only clinic managers can provision staff accounts. Patients register themselves and always
        receive the patient role.
      </p>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="staff-name">Full name</Label>
          <Input
            id="staff-name"
            required
            maxLength={120}
            value={form.fullName}
            onChange={(event) => update("fullName", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            required
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-phone">Phone</Label>
          <Input
            id="staff-phone"
            type="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as StaffRole)}>
            <SelectTrigger id="staff-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAFF_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {roleLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {role === "doctor" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="staff-specialty">Specialty</Label>
              <Input
                id="staff-specialty"
                placeholder="General Medicine"
                value={form.specialty}
                onChange={(event) => update("specialty", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-department">Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(value) => update("departmentId", value)}
              >
                <SelectTrigger id="staff-department">
                  <SelectValue placeholder="Select a department" />
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
          </>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="staff-password">Temporary password</Label>
          <PasswordInput
            id="staff-password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Minimum 8 characters with an uppercase letter, a lowercase letter and a number. Share it
            securely and ask the staff member to change it after first sign-in.
          </p>
        </div>

        {error ? (
          <p role="alert" className="sm:col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create account
          </Button>
        </div>
      </form>
    </Panel>
  );
}
