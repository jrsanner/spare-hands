# Spare Hands: POC Technical Spec (draft v0.1)

Product name: **Spare Hands** (decided 2026-11-25; domain and trademark not yet checked). Town: **Greensburg, PA 15601** (decided).

Status: **Approved by John 2026-11-25** ("yes to all"): stack, every recommendation in section 1 including the browse-gate change, and the section 9 decision log additions. Facts tagged [Unverified] still need checking. Items tagged **[Rec]** are Claude's recommendations. Items tagged **[Needs John]** block the slices listed next to them. Facts tagged **[Verified]** were checked against Stripe/Twilio docs on 2026-11-25; **[Unverified]** means from memory or a secondary source.

---

## 0. Findings that change the brief

| # | Brief said | What's actually true | Impact |
|---|---|---|---|
| F1 | "Stripe payout setup also checks age" (18+) | **[Verified]** Stripe Express allows connected accounts from age **13** with a legal guardian. Stripe will not enforce 18+ for us. | We must enforce 18+ ourselves: DOB at signup, and reject any connected account whose `individual.dob` is under 18 before first transfer. |
| F2 | Express identity check is enough for an "ID verified" badge | **[Verified]** Stripe often verifies from keyed-in data (name, DOB, SSN last 4) and asks for a document only when that fails. Many workers will never show an ID. | Rename the badge to **"Identity confirmed by Stripe"**. A real document + selfie check is Stripe Identity at ~$1.50 each (first 50 free) **[Verified, confirm current]**. Rec: honest label now, Stripe Identity only if posters ask for it. |
| F3 | Card holds "expire after a limited number of days" | **[Verified]** Online card auths last **7 days** by default. Extended auth (up to ~30 days) only on some networks/categories and only if available; not dependable for a POC. Uncaptured PaymentIntents auto-cancel at 7 days. Check `capture_before` on each charge. | **[Rec]** Jobs must start within **5 days** of posting. Leaves 2 days for completion and auto-complete before the hold dies. No far-ahead bookings in the POC. |
| F4 | (implied) destination charges | Flow B places the hold before any worker is chosen, and workers may not have finished payout setup. | **[Rec]** Use **separate charges and transfers**: authorize on the platform, capture on completion, then `Transfer` to the worker (with `source_transaction`). Consequence: the platform is liable for chargebacks and Stripe fees. |
| F5 | "A $40 shovel job is the gap" | **[Verified exists, activity unknown]** Several apps already target this: Dibs, Yardyman, Lawn x Snow, GigNGo, MowSnowPros. | The gap is not "nobody does this." The real competitor is free Facebook/Nextdoor posts. The POC tests whether verification + money on hold beats free and fast. Don't spend time on a broader landscape study before the POC. |
| F6 | (not mentioned) text notifications | **[Unverified, high confidence]** US app-to-person SMS from a normal number needs A2P 10DLC or toll-free verification, which can take 1 to 3+ weeks. Twilio Verify (login codes) is exempt. | Start toll-free verification **now** if invites go by text. Fallback: email + web push. Workers missing invite texts would sink the 4-hour fill metric. |

## 1. Positions on the open questions (approved 2026-11-25)

All rows below were approved by John on 2026-11-25.

| Question | Rec | Why |
|---|---|---|
| Platform fee | **Free during POC; platform absorbs Stripe fees** (~$1.50 on a $40 job) | The POC tests usage, not willingness to pay. A fee confounds the signal. Cap exposure by job price limit. |
| Who sets price | **Poster sets it**, with a suggested range per category; worker profiles show "typical rate" | Matches "no haggling." Suggested range keeps prices sane without pricing logic. |
| Invite expiry | **min(2 hours, start time minus 30 min)** | Snow jobs are urgent. A 2h invite leaves room for a second invite inside the 4h fill target. |
| Open job expiry | **Earlier of: start window opening, or 24 hours** | Keeps holds short, matches F3. |
| Auto-complete | One side marks done → charge **24h** later unless the other side disputes | Must land well inside the 7-day hold. |
| Unresponsive worker | Hide after **3** ignored invites in a row; they reappear on next sign-in + toggle | As in brief. |
| Town boundary | **Decided: Greensburg, PA.** Start with zip **15601** (stored in config, so neighboring zips can be added without code) | Simpler than radius, easy to explain, no geocoding dependency for the gate. |
| Price limits | $20 min, $300 max per job | Bounds chargeback exposure while the platform holds the funds. |
| Multi-worker jobs | **Out of scope.** One worker per job; poster posts twice if they need two people | Furniture jobs often need two. Multi-worker adds splits, partial accepts, partial no-shows. |
| Browse gate | **Change:** signed-in users without a card see a limited list (first name, category, general area, rating, available-now). Photo, full profile and weekly schedule need a card on file. | Requiring a card just to look is the biggest funnel risk in a cold-start town. The stalking risk comes from photo + schedule, which stay gated. **This changes an acceptance criterion, so John must approve.** |

## 2. Stack [Rec]

Solo builder, lowest glue, all TypeScript.

| Layer | Choice | Monthly cost (POC) |
|---|---|---|
| App | Next.js (App Router), mobile-first, Tailwind | — |
| Hosting | Vercel Pro (Hobby is non-commercial) + Vercel Cron | $20 **[Unverified]** |
| DB + auth + realtime | Supabase: Postgres, phone OTP auth, Row Level Security, Realtime for chat, Storage for photos | $25 Pro (free tier pauses when idle) **[Unverified]** |
| Login codes | Twilio Verify via Supabase phone provider | ~$0.058 per successful login **[Verified]** |
| Notifications | Twilio toll-free SMS (after verification) + email via Resend | ~$0.01/SMS; email free tier **[Unverified]** |
| Payments | Stripe: SetupIntents (card on file), PaymentIntents `capture_method=manual`, Connect Express, separate charges + transfers | 2.9% + 30¢ per charge; Connect $2 per monthly active account + 0.25% + 25¢ per payout **[Verified, confirm on live pricing page]** |
| Errors | Sentry free tier | $0 |

Fixed cost about **$45 to $50/month**. Variable cost on a $40 job about $1.50 card fee + payout fee + $2/month per active worker.

Alternative considered: Rails/Django monolith. Rejected for this builder because Supabase gives auth, RLS and realtime chat without writing them.

## 3. Data model

```
users            id, phone (unique, verified), name, dob, is_18_confirmed_at, town_zip,
                 roles[] (poster|worker|admin), stripe_customer_id, has_card_on_file,
                 suspended_at, created_at
worker_profiles  user_id PK, photo_url, bio, categories[], service_zips[],
                 typical_rate_cents, weekly_template jsonb  -- [{dow, start, end}]
                 available_now_until timestamptz, ignored_invite_streak int,
                 hidden_at timestamptz, stripe_account_id, payouts_enabled bool,
                 identity_confirmed bool, social_url, rating_avg, rating_count,
                 reliability_noshows int
jobs             id, poster_id, category, description, address (private), zip,
                 start_window_start, start_window_end, price_cents,
                 target_worker_id (null = open job), accepted_worker_id,
                 status, expires_at, poster_done_at, worker_done_at,
                 auto_complete_at, cancelled_by, cancel_reason, created_at
applications     id, job_id, worker_id, message, status (pending|chosen|rejected|withdrawn)
payments         id, job_id, payment_intent_id, amount_cents, status
                 (authorized|captured|released|refunded|partially_refunded|failed),
                 capture_before, captured_at, transfer_id,
                 transfer_status (not_due|waiting_onboarding|sent|failed)
messages         id, job_id, sender_id, body, created_at
ratings          id, job_id, from_user_id, to_user_id, score 1-5, note
reports          id, job_id, reporter_id, type (no_show|not_as_described|dispute|safety),
                 body, status (open|resolved_worker|resolved_poster|closed), admin_note
events           id, job_id, actor_id, type, data jsonb, created_at   -- audit log
```

RLS rules that carry acceptance criteria:
- `jobs.address` and users' phone are readable only by the poster, the accepted worker (after `accepted`), and admins. Expose public job fields through a view without them.
- `worker_profiles` photo + `weekly_template` readable only by users with `has_card_on_file`.
- `messages` readable/writable only by the two parties on an accepted job.

## 4. Job state machine

```
                    hold fails
     draft ─────────────────────► draft (show error)
       │ hold authorized
       ├── target worker set ──► invited ──decline/expire──► expired  (release)
       └── open ───────────────► open ─────no pick/expire──► expired  (release)
                                   │ poster picks applicant
   invited ─accept─► accepted ◄────┘
   invited/open ─poster cancels─► cancelled (release)

   accepted ─one side marks done─► completion_pending ─other confirms or 24h, no dispute─► completed (capture → transfer)
   accepted ─poster cancels after start window, worker no-show─► cancelled_noshow (release, worker.noshows++)
   accepted ─worker cancels─► cancelled (release, counts against reliability)
   accepted | completion_pending ─report filed─► disputed ─admin─► resolved_worker (capture → transfer)
                                                                 └► resolved_poster (release, or refund if captured)
```

Invariants:
- **Only `completed` and `resolved_worker` capture.** Every other terminal state releases the hold.
- Transfer only when `payouts_enabled` and the worker's Stripe DOB is 18+. Otherwise `transfer_status = waiting_onboarding` and a cron retries daily; nag the worker.
- A cron runs every 5 minutes: expire invites/open jobs, turn off `available_now_until`, run auto-complete, and alert the admin for any authorized payment within 24h of `capture_before` that is not in a terminal state.
- If a dispute is still open near `capture_before`: admin decides then, or the hold lapses (equals a poster win). No capture-then-refund by default, since Stripe keeps its fee.
- Worker may accept before payout setup (brief's recommendation). Payout waits.

## 5. Gates (enforced server-side, not just hidden in UI)

| Action | Requires |
|---|---|
| Any signed-in screen | Verified phone, 18+ attestation + DOB, zip in town list |
| See limited worker list | Above |
| See full worker profile | Card on file (SetupIntent succeeded) |
| Invite worker / publish open job | Successful manual-capture authorization for full price |
| Apply / accept | Verified phone + complete profile (photo, categories, zips, ≥1 availability slot) |
| Receive transfer | `payouts_enabled` + Stripe DOB ≥ 18 |
| Message / see address + phone | Party to an accepted job |

## 6. Screens

**Shared:** landing (town + category pitch), phone sign-in, onboarding (name, DOB, 18+, zip, role pick), account/settings, ToS + "no damage coverage" disclosure.

**Poster:** add card; worker list (limited/full by gate, filter by category + available now); worker profile; new job form (shows "N workers match" before submit); job detail by status (applicants, accepted worker contact, chat, mark done, cancel, report); rate worker; my jobs.

**Worker:** profile editor; weekly availability editor + available-now toggle (shows when it turns off); Stripe Connect onboarding link + status; job feed (open jobs in my categories/zips); invite inbox with countdown; job detail (accept/decline, chat, address after accept, mark done, report); rate poster; earnings/payout status.

**Admin:** users (search, suspend), jobs (filter by status), job detail with event log + payment state, reports queue (resolve for worker/poster), manual refund, payments nearing `capture_before`.

**Post-job survey** (one screen after rating): rebook through app? would stop posting in FB groups? did you trade contact info?

## 7. Build plan (slices)

Each slice ends deployable and demoable in Stripe test mode.

1. **Skeleton** — Next.js + Supabase project, phone OTP login, onboarding with DOB/18+/zip gate, roles, admin flag. Deployed to Vercel.
2. **Worker side** — profile, photo upload, weekly template, available-now with expiry cron, Stripe Connect Express onboarding + webhook for `payouts_enabled`.
3. **Flow A end to end** — card on file (SetupIntent), gated worker list/profile, invite job with manual-capture hold, accept/decline/expire with release, address reveal, chat, both mark done, capture + transfer, ratings. **This is the first real milestone.**
4. **Completion edge cases** — auto-complete, cancellations, no-show, reports, admin queue, refunds, suspend, `capture_before` alerts.
5. **Flow B** — open jobs, worker feed, applications, poster picks, expiry.
6. **Notifications + polish** — SMS/email for invites, applications, acceptance, done; "N workers match" counter; survey; mobile QA pass on iOS Safari + Android Chrome.
7. **Go-live prep (not code)** — ToS and privacy reviewed by a lawyer, Stripe live mode activation, toll-free SMS verified, seed workers recruited in person.

Estimated build: slices 1 to 3 roughly one focused week; 4 to 6 another week or two **[estimate]**.

### Build notes (slice 2, 2026-11-25)

- "Available now" is stored as an expiry time and compared to the clock, so no cron job is needed to turn it off.
- Connected accounts request only the `transfers` capability (platform charges, then transfers). **[Unverified]** that Stripe allows transfers-only US Express accounts; test mode will confirm on the first onboarding.
- Stripe's date of birth is stored as `stripe_individual_is_adult` (true/false/unknown). **[Unverified]** whether Stripe shares `individual.dob` with the platform for Express accounts. If it stays unknown, slice 3 must decide: block transfers, or rely on our own DOB check.
- Worker photos are in a private bucket. Posters will get short-lived signed links in slice 3.

## 8. Risks not already in the brief

- **Chargeback exposure** (from F4): the platform eats disputes. Price cap and suspend-on-first-chargeback mitigate.
- **Snow timing:** a winter launch has to ship in weeks, not months, or the season is gone. If the town gets little snow, the test runs on furniture alone.
- **Snow demand is spiky:** everyone wants a shovel at 7am after a storm. Expect a supply crunch on storm days and dead days between; read the 4-hour fill metric by day, not as an average.
- **Worker taxes:** Stripe Connect Express handles 1099 reporting for connected accounts **[Unverified for this setup; confirm in Stripe Tax/1099 settings]**.
- **Worker classification:** posters set the price, which is a control factor. Lawyer should look at this alongside the ToS.

## 9. Decision log additions (approved 2026-11-25)

| Topic | Proposed | Rejected alternative |
|---|---|---|
| Charge type | Separate charges and transfers | Destination charges (need worker at hold time) |
| Booking horizon | Start within 5 days of posting | Charge at booking or re-authorize (more refund/fee churn) |
| Age gate | Own DOB check + Stripe DOB check before transfer | Rely on Stripe (allows 13+) |
| Badge | "Identity confirmed by Stripe" | "ID verified" (overclaims) |
| Workers per job | One | Multi-worker jobs |
| Browse gate | Limited list without card; full profile with card | Card required to see anything |
