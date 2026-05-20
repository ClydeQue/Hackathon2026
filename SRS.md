# Software Requirements Specification — SlowFashion

- **Project:** SlowFashion
- **Version:** 0.1 (draft)
- **Date:** 2026-05-20
- **Authors:** _TBD_
- **Status:** Draft

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **SlowFashion**, a mobile application that promotes sustainable clothing consumption by helping users track, reuse, swap, and extend the life of garments in their wardrobe.

### 1.2 Scope
SlowFashion is a cross-platform mobile app (iOS, Android) with a REST backend. It enables users to:
- Catalog their wardrobe.
- Track wear count and cost-per-wear of each item.
- Discover second-hand and swap opportunities with other users.
- Receive nudges that discourage fast-fashion purchases.

Out of scope for v1: payments/checkout, AR try-on, brand partnerships.

### 1.3 Definitions, Acronyms, Abbreviations
| Term | Definition |
|---|---|
| CPW | Cost Per Wear — item price ÷ times worn |
| Swap | A peer-to-peer exchange of garments without money changing hands |
| SKU | Stock Keeping Unit (used loosely for a wardrobe item) |
| SRS | Software Requirements Specification |

### 1.4 References
- React Native / Expo docs
- Express 5 docs
- IEEE 830-1998 (SRS structure)

### 1.5 Overview
Section 2 describes the product context and constraints. Section 3 lists functional requirements. Section 4 lists non-functional requirements. Section 5 covers external interfaces.

---

## 2. Overall Description

### 2.1 Product Perspective
SlowFashion is a standalone product consisting of:
- **Mobile client** — Expo (React Native, TypeScript) targeting iOS and Android.
- **Backend API** — Node.js + Express (TypeScript) exposing a REST/JSON API.
- **Database** — _TBD_ (Postgres expected).
- **Object storage** — _TBD_ (for garment photos).

### 2.2 Product Functions (high level)
- Account creation / authentication.
- Add a garment (photo, category, price, brand, material).
- Log wear events; auto-update CPW.
- Browse a local feed of available swaps.
- Initiate / accept a swap with another user.
- Receive periodic "do you really need this?" reminders.

### 2.3 User Classes and Characteristics
| Class | Description |
|---|---|
| End user | Owns a smartphone, wants to consume fashion more sustainably |
| Swapper | A power-user who lists multiple items for swap |
| Admin | Internal moderator — handles reports and abuse |

### 2.4 Operating Environment
- iOS 16+ and Android 10+ (via Expo).
- Backend deployed to a Node 22+ runtime.
- Database: Postgres 15+.

### 2.5 Design and Implementation Constraints
- Must run on Expo managed workflow (no custom native modules in v1).
- Backend must be stateless behind a load balancer.
- All PII encrypted at rest.

### 2.6 Assumptions and Dependencies
- Users have network connectivity for sync; offline read of own wardrobe is supported.
- Third-party auth provider (e.g., Apple / Google) available.

---

## 3. Functional Requirements

> Each requirement has an ID `FR-<area>-<n>`, a priority (MUST / SHOULD / MAY), and an acceptance criterion.

### 3.1 Authentication
- **FR-AUTH-1 (MUST)** — A user can sign up with email + password OR with Apple/Google SSO.
  - *Accept:* Account record persists; user can log in on a fresh install.
- **FR-AUTH-2 (MUST)** — Sessions are issued as JWTs with a 30-day refresh window.
- **FR-AUTH-3 (SHOULD)** — User can delete their account, which purges all PII within 30 days.

### 3.2 Wardrobe Management
- **FR-WARD-1 (MUST)** — User can add a garment with: photo, name, category, brand, price, purchase date, material.
- **FR-WARD-2 (MUST)** — User can edit or delete a garment they own.
- **FR-WARD-3 (MUST)** — User can list/filter their wardrobe by category, brand, or CPW.
- **FR-WARD-4 (SHOULD)** — Garment photos auto-resized client-side before upload (max 2048px).

### 3.3 Wear Tracking
- **FR-WEAR-1 (MUST)** — User can record a wear event for an item.
- **FR-WEAR-2 (MUST)** — System computes CPW = price / wear_count and exposes it on the item detail screen.
- **FR-WEAR-3 (SHOULD)** — System surfaces "least worn" items weekly to encourage reuse.

### 3.4 Swap Marketplace
- **FR-SWAP-1 (MUST)** — User can mark an owned garment as "available to swap".
- **FR-SWAP-2 (MUST)** — Users can browse a feed of swap-available items within configurable radius.
- **FR-SWAP-3 (MUST)** — User can request a swap; counterparty can accept/decline.
- **FR-SWAP-4 (SHOULD)** — In-app messaging is available once a swap is accepted.
- **FR-SWAP-5 (MAY)** — Reputation score per user based on completed swaps.

### 3.5 Nudges & Insights
- **FR-NUDGE-1 (SHOULD)** — Weekly summary of wardrobe utilization.
- **FR-NUDGE-2 (SHOULD)** — Before logging a new purchase, prompt user with similar items already owned.

### 3.6 Moderation
- **FR-MOD-1 (MUST)** — Users can report a listing or another user.
- **FR-MOD-2 (MUST)** — Admin can hide a listing and notify the owner.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-PERF-1** — P95 API latency < 300 ms for read endpoints under 100 RPS.
- **NFR-PERF-2** — App cold start < 3 s on mid-range devices.

### 4.2 Scalability
- **NFR-SCALE-1** — Backend horizontally scalable; no in-process session state.

### 4.3 Security
- **NFR-SEC-1** — Passwords hashed with argon2id.
- **NFR-SEC-2** — All traffic over TLS 1.2+.
- **NFR-SEC-3** — Rate limiting on auth endpoints (≤ 10 req / min / IP).

### 4.4 Privacy
- **NFR-PRIV-1** — Comply with GDPR delete-on-request within 30 days.
- **NFR-PRIV-2** — Location for swap feed is fuzzed to ~1 km.

### 4.5 Usability
- **NFR-UX-1** — Core flow (add garment, log wear) reachable in ≤ 3 taps from home.
- **NFR-UX-2** — Accessible: meets WCAG 2.1 AA contrast on all primary screens.

### 4.6 Reliability
- **NFR-REL-1** — 99.5% monthly uptime target.

### 4.7 Maintainability
- **NFR-MAINT-1** — Backend code passes `tsc --noEmit` and lint in CI.
- **NFR-MAINT-2** — Mobile code passes `tsc --noEmit` in CI.

---

## 5. External Interface Requirements

### 5.1 User Interfaces
Mobile screens (v1):
1. Onboarding / Auth
2. Wardrobe (list + filters)
3. Garment detail (photo, CPW, wear log)
4. Add Garment
5. Swap feed
6. Swap detail / chat
7. Profile / settings

### 5.2 API (Backend ↔ Mobile)
- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <JWT>`
- Format: JSON

Indicative endpoints:
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Issue tokens |
| GET | `/me/wardrobe` | List own items |
| POST | `/me/wardrobe` | Add item |
| PATCH | `/me/wardrobe/:id` | Edit item |
| POST | `/me/wardrobe/:id/wears` | Log wear |
| GET | `/swaps/feed?lat=&lng=` | Local feed |
| POST | `/swaps/:itemId/request` | Request swap |

### 5.3 Third-Party Services
- Apple Sign-In / Google Sign-In.
- Object storage (S3-compatible) — _TBD_.
- Push notifications (Expo Push).

---

## 6. Open Questions
- [ ] Final choice of database (Postgres vs. SQLite-on-device + sync)?
- [ ] Do we require KYC for swap users in v1?
- [ ] Monetization model post-hackathon?
- [ ] Image moderation: manual, automated, or none for v1?

---

## 7. Revision History
| Version | Date | Author | Notes |
|---|---|---|---|
| 0.1 | 2026-05-20 | _TBD_ | Initial draft |
