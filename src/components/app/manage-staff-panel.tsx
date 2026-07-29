import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Panel, EmptyState } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listStaffAccounts,
  setUserRole,
  setAccountActive,
  sendPasswordReset,
} from "@/lib/admin-staff.functions";
import { roleLabels } from "@/lib/clinic";

const ROLE_OPTIONS = ["patient", "doctor", "nurse", "receptionist", "admin"] as const;

export function ManageStaffPanel() {
  const listAccounts = useServerFn(listStaffAccounts);
  const changeRole = useServerFn(setUserRole);
  const changeActive = useServerFn(setAccountActive);
  const resetPassword = useServerFn(sendPasswordReset);
  const [busyId, setBusyId] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["admin", "accounts"],
    queryFn: () => listAccounts({ data: undefined }),
  });

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      await accounts.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel title="Manage accounts">
      <p className="mb-3 text-sm text-muted-foreground">
        Change roles, deactivate access or send a password reset. Every action is recorded in the
        audit log with the previous and new role.
      </p>

      {accounts.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : accounts.isError ? (
        <EmptyState message="Could not load accounts." />
      ) : (accounts.data ?? []).length === 0 ? (
        <EmptyState message="No accounts found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(accounts.data ?? []).map((account) => (
                <tr key={account.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{account.fullName || "—"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{account.email}</td>
                  <td className="py-2 pr-3">
                    <Select
                      value={account.role}
                      disabled={busyId === account.id}
                      onValueChange={(value) =>
                        run(
                          account.id,
                          () => changeRole({ data: { userId: account.id, role: value as typeof ROLE_OPTIONS[number] } }),
                          `Role updated to ${roleLabels[value as keyof typeof roleLabels] ?? value}`,
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-[9.5rem]" aria-label={`Role for ${account.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {roleLabels[option] ?? option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {account.deactivated
                      ? "Deactivated"
                      : account.emailConfirmed
                        ? "Active"
                        : "Email unverified"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {busyId === account.id ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === account.id}
                        onClick={() =>
                          run(
                            account.id,
                            () =>
                              changeActive({
                                data: { userId: account.id, active: account.deactivated },
                              }),
                            account.deactivated ? "Account reactivated" : "Account deactivated",
                          )
                        }
                      >
                        {account.deactivated ? "Reactivate" : "Deactivate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === account.id || !account.email}
                        onClick={() =>
                          run(
                            account.id,
                            () =>
                              resetPassword({
                                data: {
                                  email: account.email,
                                  redirectTo: `${window.location.origin}/reset-password`,
                                },
                              }),
                            "Password reset email sent",
                          )
                        }
                      >
                        Reset password
                      </Button>
                    </div>
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
