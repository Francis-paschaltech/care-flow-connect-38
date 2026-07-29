import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarClock,
  FileHeart,
  BellRing,
  BarChart3,
  ShieldCheck,
  UserPlus,
  Stethoscope,
  HeartPulse,
  Phone,
  Mail,
  MapPin,
  Quote,
} from "lucide-react";
import heroImage from "@/assets/clinic-hero.jpg";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareConnect — Modern Healthcare Scheduling Made Simple" },
      {
        name: "description",
        content:
          "Book clinic appointments online, manage patient records and streamline clinic operations with CareConnect.",
      },
      { property: "og:title", content: "CareConnect — Modern Healthcare Scheduling Made Simple" },
      {
        property: "og:description",
        content:
          "Book clinic appointments online, manage patient records and streamline clinic operations with CareConnect.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Online Appointment Booking",
    body: "Patients book genuinely open slots in seconds — no phone tag, no double bookings.",
  },
  {
    icon: CalendarClock,
    title: "Doctor Scheduling",
    body: "Availability, clinic hours and reassignments managed from one shared calendar.",
  },
  {
    icon: FileHeart,
    title: "Electronic Medical Records",
    body: "Diagnoses, prescriptions and follow-ups stored securely against every visit.",
  },
  {
    icon: BellRing,
    title: "Automated Notifications",
    body: "Confirmations, reminders and schedule-change alerts sent without manual effort.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    body: "Attendance, no-show trends and doctor utilization, exportable for management.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Patient Data",
    body: "Role-based access so each team member sees only what their job requires.",
  },
];

const STEPS = [
  { icon: UserPlus, title: "Register", body: "Create your patient profile in under two minutes." },
  { icon: CalendarCheck, title: "Book Appointment", body: "Pick a department, doctor and open time slot." },
  { icon: Stethoscope, title: "Visit Clinic", body: "Check in on arrival — the front desk already has your file." },
  { icon: HeartPulse, title: "Receive Care", body: "Your notes, prescription and follow-up are saved instantly." },
];

const TESTIMONIALS = [
  {
    quote:
      "I used to spend a whole morning at the clinic. Now I book the night before and I'm seen at my slot time.",
    name: "Victoria Okoro",
    role: "Patient, Cardiology",
  },
  {
    quote:
      "Reassigning a sick colleague's list used to take an hour of phone calls. It now takes about four clicks.",
    name: "Dr. Chinedu Ibrahim",
    role: "General Medicine",
  },
  {
    quote:
      "Monthly attendance and utilization reports that used to be hand-counted are ready before our Monday meeting.",
    name: "Adaeze Bello",
    role: "Clinic Manager",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="min-w-0">
            <BrandMark className="text-foreground" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "register" }}>
                Book Appointment
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center rounded-full bg-info-soft px-3 py-1 text-xs font-semibold text-primary">
              Clinic management platform
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Modern Healthcare Scheduling Made Simple
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Book appointments, manage patient records, and streamline clinic operations with
              CareConnect.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "register" }}>
                  Book Appointment
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Login</Link>
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6 text-sm">
              {[
                ["15", "Doctors"],
                ["8", "Departments"],
                ["86%", "Utilization"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-bold text-primary">{value}</dt>
                  <dd className="text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="overflow-hidden rounded-xl border border-border shadow-lift">
            <img
              src={heroImage}
              alt="Doctor consulting with a patient at a modern clinic reception desk"
              className="h-full w-full object-cover"
              width={1400}
              height={1000}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" id="features">
        <h2 className="text-2xl font-bold sm:text-3xl">Everything a busy clinic runs on</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          CareConnect replaces the paper appointment book and patient folders with one connected
          system.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="surface-panel p-5">
              <span className="grid size-10 place-items-center rounded-md bg-info-soft text-primary">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-lg border border-border p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <step.icon className="size-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">Trusted by patients and clinicians</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <figure key={item.name} className="surface-panel flex h-full flex-col p-5">
              <Quote className="size-5 text-brand-teal" aria-hidden />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed">“{item.quote}”</blockquote>
              <figcaption className="mt-4 border-t border-border pt-3 text-sm">
                <span className="font-semibold">{item.name}</span>
                <span className="block text-xs text-muted-foreground">{item.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card" id="contact">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Visit or contact the clinic</h2>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-semibold">Phone</span>
                  <a className="text-muted-foreground hover:text-primary" href="tel:+2348031112200">
                    +234 803 111 2200
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-semibold">Email</span>
                  <a
                    className="text-muted-foreground hover:text-primary"
                    href="mailto:hello@careconnect-clinic.app"
                  >
                    hello@careconnect-clinic.app
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-semibold">Clinic address</span>
                  <span className="text-muted-foreground">
                    24 Awolowo Road, Ikoyi, Lagos, Nigeria
                  </span>
                </span>
              </li>
            </ul>
          </div>
          <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-border bg-muted text-center text-sm text-muted-foreground">
            <span>
              <MapPin className="mx-auto mb-2 size-6" aria-hidden />
              Google Maps placeholder
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-sidebar py-8 text-sidebar-foreground">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <BrandMark />
          <p className="text-xs text-sidebar-foreground/70">
            © {new Date().getFullYear()} CareConnect Clinic. Patient data handled with role-based
            access control.
          </p>
        </div>
      </footer>
    </div>
  );
}
