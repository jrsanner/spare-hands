# Spare Hands

Proof of concept: a local marketplace for small jobs (snow removal, furniture loading) in Greensburg, PA.
Product and technical decisions live in [SPEC.md](SPEC.md).

## Status

Slice 1 of 7: phone sign-in, onboarding (name, date of birth, 18+, zip 15601, roles), suspended-account gate, admin flag.

## Stack

Next.js 16 (App Router) · Supabase (Postgres, phone OTP auth, row-level security) · Tailwind · Vitest.
Stripe, Twilio Verify and Vercel get wired up in later slices / at deploy.

## Commands

```bash
npm install
npm run dev        # needs .env.local (see .env.example)
npm test           # unit tests
npm run test:db    # migrations + DB rule tests against a throwaway local Postgres 16
npm run typecheck
npm run lint
```

## Setting up a real Supabase project

1. Create a project at supabase.com. Copy the URL and publishable key into `.env.local`.
2. Apply migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Auth > Providers > Phone: enable, choose **Twilio Verify**, add the Twilio Account SID, auth token and Verify service SID.
   Turn email sign-up off.
4. Optional for testing without texts: add test numbers + fixed codes under Auth > Phone.
5. Make yourself admin: `update public.profiles set is_admin = true where phone = '+1XXXXXXXXXX';`

## Rules enforced in the database (not just the UI)

- Profiles are created by a trigger when a phone sign-in creates an auth user.
- Users can read only their own profile (admins read all). No direct writes from the browser.
- `complete_onboarding()` rejects: under 18 (computed in America/New_York), impossible dates of birth,
  zips not in `service_zips`, unknown roles, missing 18+ confirmation, suspended accounts.
- New service zips: `insert into public.service_zips (zip, town) values ('15644', 'Jeannette, PA');`

## Local DB tests

`tests/db/auth_shim.sql` is a minimal stand-in for Supabase's `auth` schema so migrations can be tested
on plain Postgres. It is never applied to a real project.
