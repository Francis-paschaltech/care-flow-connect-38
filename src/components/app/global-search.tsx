import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useGlobalSearch, SEARCH_SCOPE, type SearchGroup, type SearchResult } from "@/lib/search";
import type { AppRole } from "@/lib/clinic";

/**
 * Global search for the header bar. Results are produced by `useGlobalSearch`,
 * which scopes every query to the caller's role and identity; RLS remains the
 * enforcing boundary.
 */
export function GlobalSearchDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: AppRole;
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const search = useGlobalSearch(term);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<SearchGroup, SearchResult[]>();
    (search.data ?? []).forEach((result) => {
      map.set(result.group, [...(map.get(result.group) ?? []), result]);
    });
    return [...map.entries()];
  }, [search.data]);

  const scopeHint = SEARCH_SCOPE[role].join(", ").toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search CareConnect</DialogTitle>
          <DialogDescription>{`Search ${scopeHint}`}</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
        placeholder={`Search ${scopeHint}…`}
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {term.trim().length < 2 ? (
          <CommandEmpty>Type at least two characters to search.</CommandEmpty>
        ) : search.isFetching && grouped.length === 0 ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : grouped.length === 0 ? (
          <CommandEmpty>No results found.</CommandEmpty>
        ) : null}
        {grouped.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.group} ${item.label} ${item.sublabel}`}
                onSelect={() => {
                  onOpenChange(false);
                  navigate({ to: item.to });
                }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{item.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}