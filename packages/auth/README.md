# `@graftvision/auth`

AUTH-001 isolates the local Supabase Auth adapter from application code. The shared entry exports
only validation, safe action-state types, and generic error messages. `./browser` creates a
public-key-only browser client boundary, while `./server` owns cookie SSR clients, verified session
lookups, logout, proxy refresh, and internal identity resolution. `apps/web` uses only the server
boundary for the implemented flow.

The implementation was checked against the official Supabase Next.js SSR, server-client,
password-login, logout, local-development, and seeding guidance on 2026-07-26. It pins
`@supabase/ssr` 0.12.3 and `@supabase/supabase-js` 2.110.8. Deprecated auth-helper packages are not
used.

The variable is named `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the current public-key contract.
The current local CLI gateway supplies its legacy `ANON_KEY` value to that variable; it remains a
public browser key, not an administrative secret.

The selected Auth SDK currently ships WebAuthn declarations that conflict with the repository's
TypeScript 6 DOM declarations. `skipLibCheck` is therefore scoped only to `packages/auth` and
`apps/web`; first-party source remains strictly checked and the root default remains `false`.

## Security boundary

- Login runs in a server action and returns one generic credential error.
- Session cookies are `HttpOnly`, `SameSite=Lax`, path `/`, and secure outside local/test.
- The request proxy refreshes tokens; protected pages still verify the provider user.
- Provider UUID plus verified email must match one existing internal user.
- Active internal-user, membership, and clinic states are required for clinic access.
- Tokens, passwords, raw provider errors, and database details never enter public result types.
- No service-role or secret key is accepted by runtime configuration.

The browser client is an explicit future-safe boundary but is not imported by the current web
flow because `HttpOnly` cookies deliberately make authentication server-owned. Do not use it to
implement client-side session state without a separately approved cookie-model change.

## Deliberate exclusions

Registration, account recovery, email sending, MFA, OAuth, role/permission evaluation, platform
access, clinic selection, patient data, and authentication audit events are not implemented.
The local email provider is enabled only so pre-created users can sign in; global Auth signup stays
disabled.
