# DZDiscFinder Rebuild — v2 MVP Spec

Mobile-first lost-disc management system built **primarily for shops, clubs, and course managers**. Central promise:

> **Receive discs quickly, notify owners automatically, know where every disc is, and document every return.**

The finder and owner experiences support that Return Center workflow. The community etiquette flowchart drives the UX so users are always shown the appropriate next action.

Stack: Supabase + Vercel. SMS: **Twilio** (outbound notifications, inbound Y/N webhook, and phone-verification auth).

**Locked decisions:**
- Lost-disc reports in MVP = **saved alerts** (keyword/course match on new intake), no scoring engine
- The owner SMS link creates a **phone-verified lightweight session that IS the account seed** — no forced signup mid-claim
- **DZ Discs dogfoods on real data from Phase 2** — DZ inventory import is not a launch task, it's a development tool
- Twilio for all SMS (replaces TextMagic)

---

## 0. Terminology

| Term | Meaning |
|------|---------|
| **Return Center** | A shop, club, course, or organization managing found discs |
| **Return Center Manager** | Primary account owner of a center |
| **Return Center Staff** | Additional people entering and returning discs |
| **Disc Retriever** | Someone who delivers multiple discs from ponds, courses, or collection points |
| **Finder** | Someone reporting or turning in an individual disc |
| **Owner** | Person who lost the disc |

"Return Center" is clearer and more marketable than "conglomerator": *Make your shop an official Return Center.*

---

## 1. Etiquette research (drives the UX voice)

- **Ink = intent to recover.** Name/number on disc → contact the owner promptly (same/next day locally).
- **Finder's fees are frowned on**; voluntary owner-initiated thanks are welcomed. Rewards must never be finder-demanded.
- **No ink → drop box → hold period → disposition.** Community norms ~30–90 days; shops hold 60–90 days then sell (often part to charity), donate, or trash.
- Competitors (Disctrac, Disc Rescue Network, Disc Defender, UDisc L&F) each own one slice; nobody owns the whole triage.
- **UX implications:** every flow says "you're doing the right thing" + "here's what happens next"; the finder flow *is* the flowchart; hold-period timers make disposition guilt-free and fair.

---

## 2. Opening and account flow

### Not logged in
Opening screen presents:
- Log in
- Create account
- Browse found discs
- How lost-disc returns work

Visitors can search without an account. Authentication required before reporting, claiming, messaging, or managing discs.

### Account creation
Collect only: name, mobile number, SMS verification (Twilio Verify), optional email, password or passwordless login.

Then ask: **"What will you use the app for most often?"**
- Manage a Return Center
- Find and return discs
- Recover my lost discs
- Retrieve and turn in multiple discs

This becomes the user's **primary role** → determines their opening dashboard. Changeable in Profile. A primary role changes the default home screen; it does not prevent other actions.

### Lightweight sessions (decision)
Tapping an owner-notification SMS link creates a **phone-verified lightweight session** scoped to that recovery page: the owner can converse, claim, and confirm **without a full account**. Completing a profile later upgrades the same identity — the phone number is the account seed. Link tokens: single recovery page scope, re-usable by the same phone, expire/rotate on request, revoked if the recipient taps "not mine."

---

## 3. Etiquette-driven finder flow

The finder UX is the community etiquette flowchart made interactive.

### Minimum found-disc entry
A finder should be able to finish with:
- "Red Destroyer"
- Phone number from the disc, if present
- Current location or selected course
- Custody choice

Optional: photo, name written on disc, hole or exact area, additional description.

The app parses "red Destroyer" into color, mold, and known manufacturer when possible (requires a **disc reference table** — seeded from public disc databases; a build dependency for the "no big form" promise). The finder confirms the suggestion instead of filling out a detailed form.

### Privacy reminder
Before publishing a photo:
> Make sure the owner's phone number is not visible. Enter it privately below so we can notify them.

(Automatic phone-number blur detection is post-MVP.)

### Custody choices
- I have the disc.
- I'm dropping it at a Return Center or collection point.
- I already returned it.
- I handed it to another person or organization.

### Completion reassurance
> You did the right thing. We'll notify you when the owner responds or another action is needed.

Claims on finder-held discs go through the **same claim-review screen** as centers, scoped to that finder's disc.

---

## 4. Return Center onboarding

A manager creates a Return Center with: public name, address and contact info, hours, default course, default collection point, default storage location, **holding period**, unclaimed-disc policy, pickup instructions, pickup fee (if any), shipping availability and flat fee, public FAQs.

Manager invites staff — one simple **staff** role for MVP (no granular permissions).

**Staff can:** receive and enter discs, search inventory, contact owners, process claims and returns, manage rack locations, view intake batches.

**Manager only:** change center policies, manage staff, change fees, manage unclaimed-disc dispositions, export data.

---

## 5. Return Center dashboard

Opens with current work:
- Discs waiting to be entered
- Discs currently in stock
- Owners awaiting contact
- Claims awaiting review
- Claimed discs awaiting pickup
- Returns awaiting owner confirmation
- Discs approaching end of holding period

Primary actions: **Receive discs · Enter received discs · Find a disc · Process a pickup · Search inventory**

Example task list:
- Enter 10 discs turned in by Bobby
- Enter 6 discs collected from the Centennial bin
- Contact owners for 3 newly entered discs
- Prepare 2 claimed discs for pickup
- Review 8 discs reaching the 90-day limit

---

## 6. Receiving discs (intake batches)

Receiving records where a group of discs came from **before** individual entry.

**How were these received?** Individual finder turn-in · Disc Retriever turn-in · Collection point pickup · Found by staff · Transfer from another Return Center · Other

**Who provided them?** Existing user/Retriever · Staff member · Name and phone · Anonymous/unknown

**Where did they come from?** Default course · Managed course · Collection point · Current location · Another location · Unknown

**How many discs?** Physical count. Optional: batch photo, notes, retrieval method (pond dive, rake, course cleanup, bin pickup).

**Result — an intake batch** ("10 discs turned in by Bobby from Centennial Park") storing: original count, entered count, remaining count, source person, source location, date/time received, receiving staff member, notes/photo, payment status, related discs.

A single-disc turn-in creates a one-disc batch behind the scenes.

---

## 7. Rapid disc entry

Manager opens an intake task: **"Bobby — Centennial Park · Disc 1 of 10"**

- **Required:** simple description ("red Destroyer")
- **Strongly encouraged:** photo, phone number written on the disc
- **Optional:** owner name, brand, plastic, weight, stamp, condition, PDGA number, exact location, notes

The batch auto-supplies: course/source, retriever/finder, date received, Return Center, receiving staff member, batch ID.

**Entry actions:** Save and enter next · Save and pause · Skip · Correct batch count · Finish batch

**On save:** create inventory record → assign rack ID → store physical rack/bin location → send SMS if valid phone → log contact attempt → update batch progress.

---

## 8. Owner notification and communication

### Initial SMS
> Good news—Centennial Disc Return Center received a red Innova Destroyer marked with this phone number. View the private recovery page: [link]

The link (lightweight session, §2) lets the recipient:
- Confirm it may be theirs / say it is not theirs
- Read pickup and shipping policies
- Communicate with the Return Center
- Begin a claim
- Create or finish setting up an account

Finder, staff, and owner phone numbers are **never publicly exposed**. SMS alerts users; conversation and status live in the app.

### Reminder
If no response, the center can send a configurable reminder. Every attempt logged: date/time, channel, message, sender, delivery result, owner response.

### Twilio infrastructure (explicit scope)
- Outbound: notifications + reminders via Twilio; delivery status recorded
- **Inbound webhook**: parse Y/N replies and match to open return confirmations — new infrastructure, built in Phase 3
- **A2P 10DLC registration**, STOP/opt-out handling, quiet-hours sending windows — compliance is MVP scope, not polish
- Twilio Verify for signup phone verification

---

## 9. Phone-match auto-claim (the killer feature)

When a disc's entered phone number matches a **verified** user/session phone number, the claim collapses to near-zero friction:

1. Disc entered with phone → SMS with private link
2. Owner taps link → phone-verified session already matches the number on the disc
3. "Is this yours?" → **Yes** → claim auto-approved (center can require manual review by policy) → pick return method
4. **No / Not mine** → one tap; poisons future auto-matching for that number+disc pair; center notified

Edge case handled: reassigned phone numbers — "not mine" must be effortless and remembered.

---

## 10. Inventory and physical storage

Every disc gets: unique disc ID, **rack ID (scoped per center**, display "#317"), rack/bin/storage location, current status, current custodian, intake batch, source location, photos + searchable details, owner-contact status, **holding-period deadline snapshotted at intake** (policy changes don't retroactively move deadlines).

### Status model
Split **status** (active pipeline) from **disposition** (terminal, null while active):

- `status`: in_stock · owner_notified · possible_claim · claimed · ready_for_pickup · shipping_requested · shipped · return_awaiting_confirmation · returned · unclaimed
- `disposition`: returned · donated · sold · disposed

("Awaiting entry" is batch-level — a disc doesn't exist until entered; the batch's remaining count covers it.)

UI shows friendly labels; DB keeps exact values. All status/custody changes are **append-only custody events**.

---

## 11. Search and pickup mode

Finding the correct physical disc among 100–500 discs is MVP-critical.

### One search box matches
Rack ID, phone number or last four, owner name, mold, color, brand, course, collection point, retriever, intake batch, PDGA number, date, notes.

Examples: `red destroyer 1234` · `7854 blue buzzz` · `Bobby Centennial` · `rack 317` · `discs from July 20`

**Filters:** status, age, course, collection point, retriever, intake batch, rack range, photos only, include returned/disposed.

### Pickup mode
1. Search owner's phone, name, claim code, or disc
2. Likely records with large photos
3. Physical location prominent: **Rack 317 — Blue Bin B**
4. Staff visually verifies → "Handed to owner"
5. Owner receives SMS confirmation request (this *is* the §13 confirmation flow — built once)

---

## 12. Public browse and claim flow

### Public search
Near current location · city or map point · course · radius · filter by date, color, mold, brand, Return Center · recent finds · include/hide returned.

Geographic search = radius over **courses** (each geocoded lat/lng, PostGIS), not over individual discs.

### Visibility rules *(revised 2026-08-19: name/ink, rack #, and dates are public — like a physical lost-and-found wall; the phone number is the private claim verifier)*
| Public | Private |
|--------|---------|
| Public-safe photos | **Phone number on the disc** |
| Color, mold, brand, plastic, weight, stamp | Owner contact details |
| Name written on the disc | Finder contact details |
| Rack number + found location | Exact hidden/stashed location |
| Found / entered dates, current status | Staff notes |
| Raw entry text (digit-runs redacted) | Unredacted raw text & ink photos |
| Holding Return Center + its policies | |

### Claim
"**This may be my disc**" → provide: verified phone number, description of ink or another private identifier, optional explanation, preferred return method. Holder or Return Center reviews. Same-phone match → §9 auto path.

---

## 13. Return confirmation (two-party)

**Holder confirms:** handed directly to owner · picked up at center · left at agreed location · shipped · transferred elsewhere → taps "**I returned this disc**"

**Owner SMS:**
> DZ Discs says your red Destroyer was returned. Reply Y if you received it or N if you did not.

| Holder | Owner | Result |
|--------|-------|--------|
| Returned | No response | Awaiting owner confirmation |
| No confirmation | Received | Awaiting holder confirmation |
| Returned | Received | **Return completed** |
| Returned | Not received | Disputed |
| Shipped | Not delivered | In transit |

When both confirm: return completed, disc leaves active inventory, custody timeline closes, points awarded, both parties notified.

**Disputed = admin/manager reopen only** for MVP; no dispute UI gets built.

---

## 14. Lost-disc reports = saved alerts (decision: Option B)

No matching engine in MVP. A lost report is a **dumb saved alert**:

- Owner records: simple description ("pink Destroyer"), course(s)/area, date lost, optional photo/details
- On every new disc entry, alerts run a keyword + course match → matching subscribers get an SMS/notification: "A pink Destroyer was just entered at Centennial — take a look."
- Owner taps through → public disc page → normal claim flow
- No scoring, no confidence, no auto-claim from alerts

This keeps the loser-side promise alive at near-zero engineering cost; the real match engine is post-MVP and slots into the same data.

---

## 15. Disc Retriever workflow

Retriever does **not** enter every disc.

**Retriever dashboard:** record a turn-in · my pending turn-ins · verified turn-ins · disc totals · points · payments recorded by centers.

**Turn-in record:** Return Center, number of discs, course/location, retrieval method, retrieval date, turn-in date, optional batch photo/notes.

**Verification by center:** batch received, actual count, source/location, receiving staff member. Center may separately record payment amount/method/date; retriever confirms. **Payments are bookkeeping only — the app does not process payouts.**

---

## 16. Simple MVP points

Points recognize activity; **no cash value or redemption in MVP**.

- 10 pts: verified found-disc report
- 10 pts: confirmed return
- 10 pts: verified Retriever turn-in
- 1 pt/disc: accepted discs in a Retriever batch
- 5 pts: first completed profile
- Badges: First Return · 10 Confirmed Returns · 50 Confirmed Returns · Water Retriever (verified pond-diving batch)

**Awarded only after verification** (owner responds / center accepts custody / batch accepted / both parties confirm). Limits fake activity without a fraud system. No tips, gift certificates, transferable credits, leaderboards, or redemption in MVP.

---

## 17. FAQs and etiquette

**Platform FAQs:** what to do with a marked disc · no phone number? · finder's fees? · am I expected to drive/pay shipping? · owner never responds? · how claims work · who sees the phone number · how return confirmation works · what points mean.

**Return Center FAQs (per center):** pickup location · hours · hold duration · can someone else collect it · shipping + cost · pickup fee · unclaimed-disc policy · collection-point emptying schedule.

FAQs appear **contextually inside flows**, not only on a separate page.

---

## 18. MVP page map

| Page | Main purpose |
|------|--------------|
| Opening | Log in, create account, browse, or learn how it works |
| Role Home | Dashboard for the user's primary role |
| Finder Triage | Guide a finder through the appropriate etiquette |
| Found Disc Entry | Create a minimal found-disc record |
| Browse | Search geographically and by disc details |
| Disc Detail | Public-safe record; start a claim |
| Claim | Verify ownership; select return method |
| Conversation | Private coordination with SMS notifications |
| My Activity | Active finds, losses/alerts, claims, confirmations |
| Return Confirmation | Collect matching confirmations |
| Return Center Dashboard | Inventory and current work |
| Receive Discs | Create one-disc or batch intake |
| Intake Task | Enter individual discs from a batch |
| Inventory | Search all current and historical discs |
| Pickup Mode | Find and complete an in-person return |
| Retriever Turn-ins | Submit, verify, and track batches |
| Return Center Profile | Public policies, locations, hours, FAQs |
| Center Settings | Defaults, staff, storage, notification templates |
| User Profile | Phone verification, primary role, points, preferences |
| Platform Admin | Centers, users, moderation, FAQs, data tools |

---

## 19. Data concepts

Supabase design centers on: users and profiles · Return Centers · center staff · courses and collection points · intake batches · individual found discs · lost-disc alerts · claims · custody events · contact attempts · conversations and messages · return confirmations · retriever payments · point transactions · FAQs and policies · **disc reference table** (manufacturer/mold seed data).

**Append-only history** for points, custody, contact attempts, and status changes — preserves who did what; mistakes are corrected by new records, not edits.

Modeling notes: rack IDs per-center; status vs disposition split (§10); holding deadline snapshotted at intake; SMS link tokens scoped + revocable (§2).

---

## 20. Explicitly outside MVP

Registered bag / loss-prevention inventory · QR or printed labels · photo recognition/OCR · automated match scoring · tips and payment processing · store-credit redemption · shipping-label generation · advanced staff permissions · push notifications · email campaigns · offline intake · leaderboards · used-disc marketplace · automated disposition · social integrations.

The database should not block these; none should delay the first working product.

---

## 21. Build order

### Phase 1 — Foundation
- Auth + Twilio phone verification; profiles and primary roles
- Return Centers, staff, courses, collection points
- Public/private data rules (RLS)
- Core disc + intake-batch schema; disc reference table seed

### Phase 2 — Return Center intake  *(DZ goes live here)*
- Manager dashboard; receive-disc process; intake task list; rapid entry
- Rack IDs + storage locations
- Automatic owner SMS (outbound Twilio) + contact-attempt history
- **Import existing DZ DiscFinder inventory — DZ becomes the pilot Return Center and dogfoods everything from this point forward**

### Phase 3 — Inventory and return
- Fast inventory search; pickup mode
- Claims; phone-match auto-claim; lightweight SMS-link sessions
- In-app conversation
- Two-party return confirmation; **inbound Twilio webhook + Y/N parsing; A2P 10DLC registration, STOP handling, quiet hours**
- Custody and status history

### Phase 4 — Public and individual flows
- Public geographic browse (course-radius)
- Finder etiquette wizard; individual finder custody
- Lost-disc **saved alerts** (Option B)
- Owner activity dashboard

### Phase 5 — Retriever and points
- Retriever batch submission; center verification; payment bookkeeping
- Points ledger + basic badges

### Phase 6 — Second-center launch readiness
- Return Center public profiles; platform + center FAQs
- Holding-period visibility; unclaimed-disc workflow
- Platform administration
- Mobile usability and security testing; onboarding polish for center #2

---

## 22. MVP completion standard

The MVP is ready when **another shop** (DZ is already live from Phase 2) can:

1. Create its Return Center
2. Configure its course, collection points, policies, and storage
3. Receive one disc or a 30-disc Retriever batch
4. Enter discs quickly without a large form
5. Automatically notify owners by SMS
6. Find the correct physical disc among at least 500 records
7. Coordinate a claim without publicly exposing phone numbers
8. Complete a return using matching holder and owner confirmations
9. Track who supplied each disc and award activity points
10. Publish a searchable inventory and clear lost-and-found instructions to its community

That is the product worth giving another shop: **a complete operational lost-and-found system with etiquette built into every decision.**

---

## Appendix — Post-MVP roadmap (from v1 plan)

Registered bag + QR labels ("lost mode") · real match engine with confidence scoring · tips (Stripe) + store-credit karma redemption · used-disc marketplace (For Sale Used) · shipping-label generation · push/PWA offline intake · OCR/auto-blur of ink photos · leaderboards · center-to-center transfers at scale.

Also queued (from dogfooding, 2026-07-26): **turn-in invite SMS** — when a batch is saved with a provider phone number, text them "Thanks for turning in X discs to [center] — complete your profile to claim your points" (phone number is the account seed, same §2/§9 mechanics) · **park/course picker API** for "where did they come from" (discgolfapi.com or courses table + geolocation) · **processing-time stats** (drop-off→entry per disc; data already captured in `intake_batches.received_at` / `discs.entered_at` / custody & contact events — reporting only) · **disc lifetime timeline view** (dropped off → entered → msg 1 → msg 2 → …, straight off `custody_events` + `contact_events`) · **edit discs after entry** (update details, add photos) · **role switcher / triage shortcut from dashboards** (staff who found a disc off-shift jump straight to the finder flow — primary role sets the default home, never blocks other actions, per §2) · **sync `t_plastics` (679 rows) from inventory DB** and teach the parser to normalize plastic from raw entry ("elite z buzzz" → plastic: Elite Z) · **shipped-return flow** (owner requests shipping → address collection, shipping fee, packing slip, tracking, `in_transit` → delivered confirmation; `return_method='shipped'` and `return_conf_status='in_transit'` already exist in schema) · **white-label subdomains** when selling to other centers — `myowncourse.discfinder.com` per Return Center (Vercel wildcard domain + host-based routing in middleware resolving subdomain → center slug; the `return_centers.slug` column is the natural key).

### Etiquette research sources
[PDGA 805.03](https://www.pdga.com/rules/official-rules-disc-golf/80503) · [Inside the Circle](https://www.insidethecircledg.com/post/what-to-do-when-you-find-a-lost-disc) · [DiscgolfNOW](https://discgolfnow.com/lost-disc-golf-disc/) · [DiscSkill](https://discskill.com/instruction/basics/rules-etiquette/disc-golf-etiquette-found-disc/) · [DGCR thread 1](https://www.dgcoursereview.com/threads/proper-etiquette-for-lost-discs.115745/) · [DGCR thread 2](https://www.dgcoursereview.com/threads/proper-etiquette-when-finding-discs.117401/) · [Sabattus DG](https://sabattusdiscgolf.com/blogs/sdg-newsbites/what-happens-to-our-unclaimed-lost-found-discs) · Competitors: [Disctrac](https://www.disctracapp.com/) · [Disc Rescue Network](https://app.discrescuenetwork.com/) · [Disc Defender](https://discdefender.com/)
