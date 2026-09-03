# Halı Platform

> A carpet-washing marketplace: the customer picks a cleaner near them, the job drops straight onto that cleaner's own driver, and the customer follows their carpet step by step.

**Live site:** https://enyakinhaliyikamaservisi.com · **Turkish README:** [README.tr.md](README.tr.md)

![Next.js 15](https://img.shields.io/badge/Next.js-15-000000)
![React 19](https://img.shields.io/badge/React-19-087ea4)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)
![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue)

---

## Overview

Carpet washing in Turkey is a neighbourhood trade run by small shops. The work is coordinated by phone and notebook: the customer calls, the owner writes an address down, tells a driver over the phone, and then spends the rest of the week answering *"where is my carpet?"*. Almost nothing is recorded — not which carpet belongs to whom, not what the driver actually collected in cash, not how long he waited at an address.

This project is a two-sided marketplace **plus** the back office that shop needs to run the job it just received. A customer enters a location, sees the cleaners that serve that area ranked by distance and rating, places an order, and follows it through a tracking link — `created → accepted → picked up → washing → out for delivery → delivered` — with photographs taken at pickup and at delivery as damage evidence. The cleaner gets an order book, a live driver map, route history with per-address stop durations, an end-of-day cash reconciliation, an income/expense ledger, WhatsApp notifications to customers, and a subscription billed through iyzico. The platform side adds an admin console, an accountant-only view, and a two-tier commission agent network for selling those subscriptions.

It was built and operated by one person, and ran in production for one pilot carpet-washing business and its drivers. The repository contains the whole system: the Next.js web application, two Expo/React Native apps (customer and driver), the deployment setup, and the operational scripts that kept it running.

### Scope at a glance

| | |
| --- | --- |
| Database | 33 Prisma models, 11 enums (~1,050-line schema) |
| Web app | 63 pages, 53 API route handlers, 16 server-action modules |
| Domain logic | 81 modules in `src/lib`, 66 React components |
| Mobile | 2 Expo apps — driver (v1.2.8, versionCode 22) and customer |
| Checks | 9 runnable verification scripts (`npm run test:*`) |
| Size | ~53k lines of TypeScript/TSX under `src/`, ~5.8k across the two apps |

---

## Tech stack

- **Web** — Next.js 15 (App Router, RSC, server actions), React 19, TypeScript 5.7, Tailwind, PWA manifest
- **Data** — PostgreSQL 16 + Prisma 6, Zod for request validation
- **Auth** — HMAC-signed session tokens (bcrypt password hashing), accepted from either a cookie or a `Bearer` header so the panel works inside the mobile WebView
- **Payments** — iyzico: Checkout Form, subscription checkout, recurring checkout, subscription webhook and recurring callback
- **Messaging** — WhatsApp Cloud API (primary channel, with an inbound webhook and an in-app inbox), SMTP e-mail, Expo Push → FCM, Netgsm/Twilio SMS
- **Maps & routing** — Leaflet/OpenStreetMap by default, Google Maps when a key is present; **self-hosted OSRM** for map matching and routing
- **Storage** — AWS S3, with a local-disk fallback for development
- **Mobile** — Expo SDK 52 / React Native 0.76, `expo-location` background task with an Android foreground service
- **Ops** — multi-stage Docker build, Docker Compose (dev and prod), Caddy/nginx configs, backup and OSRM-refresh cron scripts

---

## Features

**Customer (web + Expo app)**
- Location-based discovery: cleaners that serve the customer's district, ranked by distance and rating, with trust badges — *photo record on intake*, *on-time delivery*, *high rating* and *fast response* are recomputed nightly from real order data and withdrawn when a shop stops qualifying; *verified* is granted by hand. The badge whose enum name is still `INSURED` is labelled **photo record** in the UI on purpose: without an actual policy, calling a shop "insured" is a misleading commercial practice under Turkish consumer law (6502 art. 61/62), so the badge says what was done rather than what was promised
- Ordering without an account; a short tracking code (`HLK-4F2A9`) and a tokenised tracking link
- Final-price approval: the shop declares the exact amount, the customer approves it from their own phone, and the approval is recorded
- Pickup and delivery photos, live courier position while a delivery is in progress, post-delivery reviews
- SEO surface for organic acquisition: per-city and per-district landing pages, sitemap, robots

**Cleaner / shop owner (panel, 16 pages)**
- Order book with the full status machine, plus manual entry for walk-in customers so street work lands in the same ledger
- Driver management and shifts; live tracking map; route history with stop durations per address
- **End-of-day reconciliation** — what each driver delivered, collected, handed over, and still carries
- **Kasa** — an income/expense ledger with recurring items and a profit/loss summary
- "Find the carpet": a photo wall of carpets in the shop, each with an auto-assigned weekly number
- WhatsApp/e-mail notification to the customer on every status change; a message inbox for replies
- Staff accounts with a reduced-permission panel, so an employee can register orders without seeing revenue, IBAN, or the subscription
- Subscription: plan card, iyzico checkout, recurring mandate, renewal reminders, invoicing details

**Driver (Expo app + web)**
- Shift start/stop, background location with an Android foreground service, accept/reject with a reason
- Step-by-step order advance, pickup/delivery photos, turn-by-turn hand-off to the phone's maps app
- Cash-collection declaration at delivery (cash vs. bank transfer), which feeds the owner's reconciliation

**Platform (admin, agents, accountant)**
- Admin: businesses, regions, requests with CSV export, WhatsApp message log, seasonal-reminder controls, manual cash collection of subscriptions
- **Agent network**: two tiers (head agent → sub-agent), per-agent commission percentages, a commission pool that head agents distribute, capped discount and trial-period grants, payout requests with scheduled monthly generation, referral codes, and a downloadable sales handbook whose visibility is filtered by tier
- Accountant role with access to nothing except invoicing data and payments
- Turkish legal surface (distance-selling contract, pre-information form, KVKK notices, refund policy, account deletion) rendered from an env-supplied commercial identity, with a `kunyeTamam()` check that shows placeholders instead of inventing details

---

## Architecture & engineering decisions

### Debugging a silent production failure — the location watchdog

`src/lib/konumBekcisi.ts` exists because of a specific incident, and its header comment is the post-mortem.

A shop owner opened a shift, stayed in the app for one to three minutes, and left. The location stream was killed by the phone roughly **6.5 minutes later** — a Transsion/HiOS device, the manufacturer family most aggressive about killing background work — and **nobody noticed for two hours**. The server side was clean: every ping that arrived returned 200. The panel simply said "not active" without saying why, and the driver believed he was on shift.

The rule that came out of it: **when a stream dies, a human has to be able to see it on a screen.** The watchdog does not fix the ROM killing the service; it makes the death visible, works regardless of handset brand, and keeps the system from going blind even when the battery-exemption flow fails.

Every threshold in that file is justified against measured data rather than guessed:

- **10 minutes of silence = dead stream.** The app sends a heartbeat every 60 seconds even while idle, so ten minutes is ten missed beats — long enough not to trip on a transient network drop.
- **12 hours of silence ≠ dead stream, it's a shift someone forgot to close.** On the first run there were five shifts still open in production, one of them since 22 July. Without this ceiling the watchdog would have alarmed every driver *and* every owner on its first tick, and repeated hourly. Their problem was a different bug (shifts don't auto-close at end of day) and got logged as such instead of being papered over with an alert.
- **The watchdog ticks every 5 minutes, not hourly.** Measured death time was ~6.5 minutes; an hourly check would leave a driver blind for fifty minutes.

Two days later the design was corrected against its own live measurements. Until then, *"revive the app"* and *"warn the driver"* were the **same notification**, so they inherited the same 10-minute threshold and the same 60-minute repeat brake — meaning that if the first revival attempt failed, the next one was an hour away. A day's telemetry on a single driver showed 12 gaps, two of them 109 and 114 minutes. The conclusion, written verbatim in the code:

> Most of the hole was not the ROM killing us — it was **us waiting**.

The two jobs have different economics. Waking a phone is **free**: nothing appears on screen, so it should happen often. Warning a person is **expensive**: it spends their attention and erodes their trust in alerts, so it should be rare and braked. Putting them on the same schedule was the design error. They now run on separate ticks — a silent wake-up push every 15 seconds against a 120-second silence threshold, and the human alert on the 5-minute tick.

The silent channel then had to be walked *back*. It was first set to 45 s / 60 s on the assumption that more aggressive is better; research showed the opposite. FCM detects a pattern of high-priority messages that never produce a user-visible notification and **demotes that app's priority**, after which messages are held until the device leaves Doze. Firing 60 silent pushes per driver per hour was burning down the exact wake-up channel the design depended on. The settled values — 120 s silence, 300 s per-driver repeat — stay under the throttling threshold while still being twelve times faster than the 60-minute brake that caused the 109-minute gaps. The comment names the recurring failure mode behind it: *looking at what a mechanism **accepted** and assuming the work **happened** — Expo accepts the request, FCM quietly downgrades priority, and nothing lands on the phone.*

Two smaller decisions in the same file are worth noting:
- **Recovery is announced.** When the stream comes back, both the driver and the owner get an explicit "it's working again" message. Silently clearing the flag isn't enough — the two people who received the alarm would otherwise be left guessing whether it was still broken.
- **The alert tells the driver what to do**, not just that something is wrong, and it carries `{ tip: "konum-yeniden-baslat" }` so that a still-running app restarts tracking on receipt without the driver touching anything.

The honest limit is stated in the app too (`driver-app/src/pil.ts`): a battery-optimisation exemption *improves* survival, it does not guarantee it, and some manufacturers ignore their own settings. Android exposes `isIgnoringBatteryOptimizations` only through native code that Expo doesn't wrap, so rather than write a check that would lie, the app stores the driver's declaration to stop nagging and shows the **actual evidence** separately: the timestamp of the last successful location upload.

### Money: two ledgers that must never merge

`src/lib/tahsilat.ts` computes the end-of-day cash reconciliation, and its header documents the trap it was written to avoid.

**Kasa** (`src/lib/ledger.ts`) is an **accrual** book: it sums `priceTotal` over delivered orders live and writes no rows. Reconciliation is the **cash** view: what actually reached the owner's hand. Posting an `INCOME` row from reconciliation into Kasa would count the same money twice, and the shop owner would see two different answers to "what did I earn this month". They stay on separate screens under separate labels, and nothing crosses between them.

Two more details are load-bearing:
- **Bank transfer is separated from cash.** Money that arrived by IBAN is already in the business account and leaves nothing in the driver's pocket; the "still carried by the driver" balance runs only over cash. Mixing them makes the owner ask a driver for money he never held.
- **A driver with a handover but no deliveries that day still gets a row** — he may have collected yesterday and handed over today. Drop him and the handover silently disappears from the balance.

The whole module is **pure**: no database, no session, no ambient "now". Inputs in, summary out. That is what makes `npm run test:tahsilat` runnable with no Docker and no database — because, as the comment puts it, where money is concerned *"it compiled, so it probably works"* is not good enough.

### Drawing a route without lying

Three modules cooperate on the tracking map, and the constraint they share is that **the map must never be more confident than the data**.

- `src/lib/konumFiltre.ts` filters only the array that gets **drawn**. Raw pings are stored untouched, preserving both their evidentiary value and the KVKK record; a bad filter therefore loses no data and can be reverted in one line. The filter is time-aware because the first version wasn't: without timestamps, "standing still" and "moving slowly" are indistinguishable, so a slow GPS drift under 60 m could be rendered as kilometres of travel. It now decides on speed (step < 100 m **and** < 0.7 m/s ⇒ stationary; ≥ 3 minutes of stationary steps collapse to a single point) with a distance gate, so an app that closes at night and reopens 3 km away is treated as movement rather than as one very slow stop.
- `src/lib/yolaOturt.ts` snaps the trace to real roads through a **self-hosted OSRM** instance, under three explicit safety rules: snapping happens only *within* a segment and never across a data gap; the snapped path is discarded if its length deviates more than 40% from the raw trace; and if OSRM is slow or unreachable, the raw trace is drawn. The reasoning is that a wrong street rendered smoothly reads as *"the driver went there"* — map matching makes a lie **more** convincing, so filtering must come first and snapping must be allowed to fail.
- `src/lib/tracking.ts` holds the stop-detection rules, whose bounds were learned in production: a stop that absorbed an unbounded ping gap plus a stop with no maximum duration produced a **37-hour "stop"** (a van parked in the shop's own yard), which also blanked the following days' reports. Absorbed gaps are now capped at 1 hour and a single stop at 12 hours.

The routing engine is refreshed by `scripts/osrm-tazele.sh` on a monthly cron: it rebuilds Turkey's road data into a **separate** directory, smoke-tests it on a throwaway container, and only then swaps the live service over. Any failure at any step leaves the old data serving and sends a mail.

### Provider seams, and a config gate that refuses to boot

Payments, SMS, e-mail, storage, and maps each sit behind a seam with a mock implementation and a live one, selected by environment variable. This is what makes the system developable without accounts anywhere — but a mock in production is worse than a crash, so `validateConfig()` refuses to start the server when `NODE_ENV=production` and the session secret is short or a placeholder, the base URL is localhost, payments are live without iyzico keys, the iyzico base URL still points at sandbox, or photo storage is unconfigured — either S3 keys, or a deliberate `ALLOW_LOCAL_UPLOADS=1` opt-in for a box with a persistent disk, because a container filesystem is not durable. `iyzico.ts` throws on construction rather than falling back to mock, because a silent fallback means money is never taken and the order still says "paid".

### Fail-closed authorization

`src/lib/panelYetki.ts` opens the panel to shop employees without weakening the owner-only path. `getCurrentBusiness()` was **left unchanged** — it still accepts only `role === "CLEANER"` — so all ~25 of its call sites remained owner-only with no edits, and employee access is opened one call site at a time. The inverse (a permissive shared function plus guards on the sensitive pages) would make every forgotten call site a leak.

The guard also has to run **before** any Prisma query. In the App Router a layout and its page render in parallel, so a layout-level `redirect()` does not prevent the page's query from executing and its data from reaching the RSC payload. Every restricted page therefore calls its guard on the first line. The same rule governs the subscription-tier gate in `paketYetki.ts`, which reads plan *and* period validity in a single function so that "a business that stops paying is demoted, not deleted" lives in exactly one place.

### Idempotency where callbacks repeat

Payment callbacks, webhooks, and background ticks all fire more than once, so the guarantees are in the schema and in the query shape:

- `CommissionEntry.paymentId` is `@unique`, which turns a replayed webhook into a silent no-op (P2002) instead of a double accrual, and commission accrual is called best-effort so a failure never rolls back the payment record.
- The mobile hand-off nonce (`src/app/m/[nonce]/route.ts`) is consumed with `delete` — the deletion *is* the claim. Two racing requests mean exactly one winner; `findUnique` followed by `delete` would not give that.
- The daily tick uses an atomic `UPDATE ... WHERE value <> today` on an `AppState` row rather than read-then-write, because the container restarts several times a day (deploys, OOM) and the "run once on boot + 24 h interval" pattern would message customers twice. The insert path uses `createMany({ skipDuplicates })` rather than create/catch, so a lost race does not print a Prisma unique-violation error that masks real ones in the container log.
- Timers are started with a deliberate offset after boot as well as on an interval, because an interval counter resets on every restart — on a day with a dozen deploys the check could otherwise never run at all.

### Deployment

The Dockerfile is a three-stage build producing a Next.js standalone output that runs as a non-root user. `NEXT_PUBLIC_*` values are passed as build args because `.env` is deliberately in `.dockerignore` and those values are inlined into the client bundle at build time. The Server Action encryption key is pinned across builds so that action ids stay stable and a redeploy does not break a form in a tab someone left open. The production compose file keeps Postgres off the host network entirely, tunes it for the box it ran on, and persists uploads in a named volume.

### Data protection

Retention is implemented, not just promised in the policy pages: raw location pings are pruned after 30 days, and stop records — which the privacy notice and the driver disclosure commit to deleting after 12 months — are purged on a daily tick. Deletion is chunked and started off the boot path (`void`, not `await`), because a backlog after an outage could otherwise block startup for minutes when the priority is getting the site back up. The sample location trace committed for tests (`scripts/veri/konum-ornek.json`) is anonymised: longitudes shifted, clocks rebased, all relative geometry preserved.

---

## Getting started

Requires Node.js 22+ and Docker.

```bash
# 1) Database (Postgres, via Docker)
docker compose up -d db

# 2) Dependencies
npm install

# 3) Configuration — copy the template and read the header comments;
#    every provider defaults to a mock, so nothing external is required
cp .env.example .env

# 4) Apply the schema
npm run db:push

# 5) Optional: seed demo data
npm run db:seed

# 6) Development server
npm run dev          # http://localhost:3000
```

Full container run (app + database):

```bash
docker compose up --build
```

Verification scripts — the money and location rules that cannot be checked by looking at a screen. None of them need a database:

```bash
npm run test:tahsilat   # end-of-day cash reconciliation
npm run test:konum      # location trace filtering (synthetic + anonymised real trace)
npm run test:durak      # stop detection
npm run test:fiyat      # subscription price ladder
npm run test:para       # money parsing/formatting
npm run test:paket      # subscription-tier module gating
npm run test:halino     # weekly carpet numbering
npm run test:rehber     # agent handbook rendering + tier visibility
npm run test:odeme      # payment chain: on-screen amount ↔ iyzico plan (moves no money)
```

`test:odeme` is the exception that needs outside access: it reads the live plan definitions from iyzico to confirm that every amount the pricing code can produce has a matching active plan, so it requires iyzico credentials in the shell. It never moves money.

The two Expo apps live in `driver-app/` and `customer-app/` and each build against `EXPO_PUBLIC_API_BASE`; see their own READMEs.

`.env.example` documents every switch, including which variables become mandatory under `NODE_ENV=production` and why.

---

## Known limitations

Honest list; all of these are visible in the code and most are annotated there.

- **Single-instance assumptions.** The rate limiter (`src/lib/ratelimit.ts`) is an in-memory fixed window, the wake-up tick keeps its per-driver cooldown in a process-local `Map`, and ping pruning is opportunistic per instance. Horizontally scaling this would need a shared store (Redis) and a real job runner; the code says so at each site.
- **Background jobs run inside the web process.** Scheduling lives in `src/instrumentation.ts` with `setInterval`, not in a queue or worker. The daily job is protected against duplicate runs by an atomic `AppState` flag, but the design is a single-box design.
- **Schema is applied with `prisma db push --accept-data-loss` at container start**, not versioned migrations. That flag is required because an unattended `db push` otherwise blocks waiting for confirmation and the app never boots — which caused a production outage on 2026-07-09 when a `@unique` constraint was added. Any deployment that needs version history should switch to `prisma migrate deploy`.
- **No test runner, no CI.** The checks above are hand-written assertion scripts over pure functions. There is no component testing, no end-to-end coverage, and the API route handlers and server actions are not covered at all — they were verified by hand.
- **Battery-optimisation state cannot be read.** Expo exposes no API for it, so the driver app records the driver's own declaration and shows the last successful upload as the real evidence. A fabricated check was explicitly rejected.
- **The subscription-tier gate is inert in practice.** Every subscription in production sat on the top tier, so no module ever locked. The layer is deliberately built ahead of the pricing migration it was written for, and the price ladder itself is still behind the `FIYAT_MERDIVENI` flag.
- **Customer phone numbers are stored unnormalised**, so inbound WhatsApp matching tries several formats and refuses to match non-Turkish numbers at all — an unmatched message sitting in the admin inbox is better than one attached to the wrong order. Normalising at write time is the correct fix and was not done.
- **SMS ships disabled.** WhatsApp became the primary channel on cost grounds, so the Netgsm/Twilio path is implemented and logged but was never the live channel.
- **Seasonal reminders default to off.** They are commercial messaging under Turkish law (6563/İYS) and the responsibility sits with whoever enables them, so there is no default-on path.
- **Shifts do not auto-close at end of day.** The watchdog works around it with a 12-hour abandonment ceiling instead of alarming; the underlying fix was still open when the project stopped.
- **The tracking map's OSRM dependency is optional but unmanaged** — it runs as a separate container refreshed by a cron script outside the compose file, so a fresh clone gets raw traces rather than snapped ones until that is set up.

---

## Status

**Shut down.** The platform ran in production against **one pilot carpet-washing business** and its drivers; it never reached a second paying shop. Both mobile apps were built and distributed through EAS — the driver app reached version 1.2.8 (versionCode 22), driven by real field use — and were prepared for a Play Store closed-testing track.

It is published as a **reference implementation**: a complete, deployed system rather than a demo, with the production incidents, their measurements, and the reasoning behind each fix left in the code comments where they happened. Commercial documents, contracts, and personal data were removed before publication; the Turkish original of this README is preserved at [README.tr.md](README.tr.md), and inline comments throughout the codebase remain in Turkish.

---

## License

AGPL-3.0 — see [LICENSE](LICENSE).

The AGPL is deliberate. This is not a teaching example written to be published; it is the code of a commercial service that took real orders and real money, released afterwards so it can be read. Anyone may study, modify, and run it — but running a modified version as a network service means publishing the source of that version. Copyright is held by the author, so separate commercial terms can be arranged on request.
