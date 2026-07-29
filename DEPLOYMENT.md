# CareConnect — Deployment Guide

## Build & hosting target

The app is a **TanStack Start v1** application built with Vite + Nitro. The
default (and verified) deploy target is **Cloudflare Workers**.

```bash
bun install
bun run build          # outputs dist/client, dist/server (+ dist/server/wrangler.json)
npx nitro deploy --prebuilt
```

`bun run build` has been verified end-to-end and emits a Cloudflare worker
bundle plus static client assets. To host on a Node server instead, set the
Nitro preset (`NITRO_PRESET=node-server`) before building and run
`node dist/server/index.mjs`.

## Required environment variables

Client-visible (must be present at **build time**, they are inlined):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Backend project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public/anon API key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (optional, used by tooling) |

Server-only (set as secrets on the host, available at **runtime**):

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Backend project URL for server functions |
| `SUPABASE_PUBLISHABLE_KEY` | Used by the authenticated server middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for admin staff provisioning (`createStaffAccount`) |
| `SITE_URL` | Production origin, e.g. `https://clinic.example.com`. Used for absolute `<loc>` URLs in `/sitemap.xml`. Falls back to the request origin. |

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or prefix it with
`VITE_`.

## Google sign-in (native Supabase OAuth)

Google login uses `supabase.auth.signInWithOAuth('google', { redirectTo })`
with `redirectTo` derived from `window.location.origin`, so it works on
localhost, preview and production without code changes — and it keeps working
if the project is exported or self-hosted.

To enable it in a self-hosted / exported setup:

1. In **Google Cloud Console → APIs & Services → Credentials**, create an
   OAuth 2.0 Web Application client.
   - Authorised redirect URI:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
2. In the **Supabase dashboard → Authentication → Providers → Google**,
   enable the provider and paste the Client ID and Client Secret.
3. In **Authentication → URL Configuration**:
   - Set **Site URL** to your production origin.
   - Add every origin you sign in from to **Redirect URLs**, including:
     - `https://your-production-domain.com/**`
     - `http://localhost:8080/**` (local development)

Without step 3 Google will return to Supabase successfully but the browser
redirect back to the app will be rejected.

## Access control summary

- Public self-registration **always** creates a `patient`. The database
  trigger `handle_new_user()` ignores any client-supplied role.
- Staff (doctor / nurse / receptionist / admin) accounts are created only by a
  signed-in admin through the *Create a staff account* panel on `/admin`,
  which is backed by the `createStaffAccount` server function (verifies the
  caller's admin role server-side before using the service-role key).
- `/admin`, `/reports` and `/patients` enforce role checks in `beforeLoad`
  (`src/lib/route-guards.ts`) in addition to the sidebar filtering and the
  database RLS policies.

## Google sign-in redirect (updated)

Google OAuth now returns to the **public** callback route
`https://<your-domain>/auth/callback`, which waits for the session to hydrate
before entering the app. Add these to **Authentication → URL Configuration →
Redirect URLs**:

- `https://your-production-domain.com/**`
- `http://localhost:8080/**`

## First administrator bootstrap (one-time, manual)

Public sign-up always creates a `patient`; there is no way to self-assign a
staff role. To create the very first admin:

1. Register normally through `/auth` (Register tab) and confirm the email.
2. Run once against the project database:

   ```sql
   delete from public.user_roles where user_id = '<the-user-uuid>';
   insert into public.user_roles (user_id, role) values ('<the-user-uuid>', 'admin');
   delete from public.patients where user_id = '<the-user-uuid>';
   ```

3. Sign in again and open `/admin`. From there all further staff accounts are
   created through the UI — no SQL required.

Remove any test/demo accounts before go-live (delete the auth user; profile,
role, patient and appointment rows cascade or can be deleted alongside).

## Admin capabilities (`/admin`)

Backed by admin-only server functions that re-verify the caller's `admin` role
in the database on every call:

| Action | Server function |
| --- | --- |
| Create doctor / nurse / receptionist / admin (atomic, rolls back on failure) | `createStaffAccount` |
| List all accounts with role + status | `listStaffAccounts` |
| Promote / demote a user | `setUserRole` |
| Deactivate / reactivate an account | `setAccountActive` |
| Send a password-reset email | `sendPasswordReset` |

Every one of these writes an `audit_logs` row containing the actor, action,
entity, affected user, previous role, new role, success flag and timestamp.

## Security model summary

- **Roles** live only in `public.user_roles`; it has **no** insert/update/delete
  policies, so the browser can never write a role. Role changes happen only
  through service-role server functions after an admin check.
- **Email verification** is enforced: the protected layout signs out and
  redirects any account without a confirmed email. Admin-created staff accounts
  are pre-confirmed.
- **Notifications** are created by the `createNotifications` server function
  using the caller's own session, so RLS applies and failures surface to the UI.
- **Route guards** (`requireRoles`) protect `/admin`, `/reports` and `/patients`
  in addition to RLS.
- `SUPABASE_SERVICE_ROLE_KEY` is only read inside server-function handlers.
