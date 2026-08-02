import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  BarChart3,
  Settings,
  Bell,
  ShieldCheck,
  CalendarClock,
  Menu,
  LogOut,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-auth";
import { initialsOf, roleLabels, type AppRole } from "@/lib/clinic";
import { GlobalSearchDialog } from "@/components/app/global-search";
import { SEARCH_SCOPE } from "@/lib/search";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] };

const ALL: AppRole[] = ["patient", "doctor", "nurse", "receptionist", "admin"];
const STAFF: AppRole[] = ["doctor", "nurse", "receptionist", "admin"];

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, roles: ALL },
  { to: "/book", label: "Book Appointment", icon: CalendarClock, roles: ["patient", "receptionist", "nurse", "admin"] },
  { to: "/patients", label: "Patients", icon: Users, roles: STAFF },
  { to: "/records", label: "Medical Records", icon: FileText, roles: ALL },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["doctor", "receptionist", "admin"] },
  { to: "/admin", label: "Administration", icon: ShieldCheck, roles: ["admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ALL },
  { to: "/settings", label: "Settings", icon: Settings, roles: ALL },
];

function SidebarNav({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const items = NAV.filter((item) => item.roles.includes(role));
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-4" aria-label="Main">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:font-semibold data-[status=active]:text-sidebar-primary-foreground"
          activeProps={{ "aria-current": "page" }}
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-xl font-extrabold tracking-tight", className)}>
      Well<span className="text-brand-teal">Care</span>
    </span>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { data, loading } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const routerState = useRouterState();
  const queryClient = useQueryClient();
  const role = data?.role ?? "patient";
  const searchHint = SEARCH_SCOPE[role].slice(0, 2).join(", ").toLowerCase();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Link to="/">
            <BrandMark />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={role} />
        </div>
        <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/70">
          <p className="font-semibold text-sidebar-foreground">{data?.fullName ?? "—"}</p>
          <p>{roleLabels[role]}</p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Open menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0 text-sidebar-foreground">
                  <SheetTitle className="flex h-16 items-center border-b border-sidebar-border px-5 text-sidebar-foreground">
                    <BrandMark />
                  </SheetTitle>
                  <SidebarNav role={role} onNavigate={() => setOpen(false)} />
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
                {subtitle ? (
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search WellCare"
                className="hidden items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:flex"
              >
                <Search className="size-3.5" aria-hidden />
                <span>Search {searchHint}…</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Search WellCare"
                className="md:hidden"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                onClick={async () => {
                  await queryClient.cancelQueries();
                  queryClient.clear();
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
              >
                <LogOut className="size-4" />
              </Button>
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                aria-hidden
              >
                {initialsOf(data?.fullName ?? "CC")}
              </span>
            </div>
          </div>
        </header>

        <main key={routerState.location.pathname} className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          {actions ? <div className="mb-4">{actions}</div> : null}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} role={role} />
    </div>
  );
}

export function Panel({
  title,
  badge,
  children,
  className,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-panel", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="panel-title truncate">{title}</h2>
        {badge ? <div className="shrink-0">{badge}</div> : <span />}
      </div>
      <div className="px-4 py-3 sm:px-5 sm:py-4">{children}</div>
    </section>
  );
}

export function CountBadge({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "success" }) {
  const toneClass =
    tone === "warning"
      ? "bg-warning-soft text-warning-foreground"
      : tone === "success"
        ? "bg-success-soft text-success"
        : "bg-info-soft text-primary";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", toneClass)}>{children}</span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
  );
}
