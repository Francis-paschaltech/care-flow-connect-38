import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Panel, EmptyState } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useDepartments } from "@/lib/queries";

type Draft = { id: string | null; name: string; description: string };

const EMPTY: Draft = { id: null, name: "", description: "" };

export function ManageDepartmentsPanel() {
  const departments = useDepartments();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["departments"] });
    void queryClient.invalidateQueries({ queryKey: ["doctors"] });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error("Department name is required.");
      return;
    }
    setBusy(true);
    try {
      const payload = { name, description: draft.description.trim() || null };
      const { error } = draft.id
        ? await supabase.from("departments").update(payload).eq("id", draft.id)
        : await supabase.from("departments").insert(payload);
      if (error) throw error;
      toast.success(draft.id ? "Department updated" : "Department added");
      setDraft(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the department.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove the ${name} department? Doctors and appointments linked to it keep their records.`)) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
      toast.success("Department removed");
      refresh();
    } catch {
      toast.error("This department is still in use and cannot be removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Departments"
      badge={
        <Button size="sm" variant="outline" onClick={() => setDraft({ ...EMPTY })} disabled={busy}>
          <Plus className="mr-1.5 size-4" /> Add department
        </Button>
      }
    >
      {draft ? (
        <form className="mb-4 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2" onSubmit={save} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              required
              maxLength={80}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-description">Description</Label>
            <Textarea
              id="dept-description"
              rows={2}
              maxLength={300}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {draft.id ? "Save changes" : "Add department"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
              <X className="mr-1.5 size-4" /> Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {departments.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (departments.data ?? []).length === 0 ? (
        <EmptyState message="No departments yet. Add the first one to start scheduling." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(departments.data ?? []).map((department) => (
            <div key={department.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{department.name}</p>
                <p className="text-xs text-muted-foreground">{department.description || "No description"}</p>
              </div>
              <div className="mt-auto flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      id: department.id,
                      name: department.name,
                      description: department.description ?? "",
                    })
                  }
                >
                  <Pencil className="mr-1.5 size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove(department.id, department.name)}
                  disabled={busy}
                >
                  <Trash2 className="mr-1.5 size-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
