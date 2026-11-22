# FixMate Server (Backend)

FixMate is an on-demand Smart Device & Home Appliance Repair Service platform.
This repository contains the **Express + MongoDB API server**. The Next.js +
BetterAuth client lives in a separate repository.

- **Base path:** everything under `/api`
- **Health check:** `GET /api/health`
- **Entry:** `server.js` → `src/app.js`

---

## Stack

| Area | Technology |
|---|---|
| Runtime | Node.js (>= 20) |
| Framework | Express.js |
| Database | MongoDB (official `mongodb` driver, cached + serverless-safe client) |
| Auth | JWT (BetterAuth issues tokens, server verifies with `JWT_SECRET`) |
| Payment | Stripe Checkout + Webhook (test mode only) |
| Media | ImgBB (client uploads, server stores URLs) |

## Getting started

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### Environment variables

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=
DB_NAME=fixmate
JWT_SECRET=
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
IMGBB_API_KEY=
```

`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` belong to **Stripe test mode only**.
Register the production webhook endpoint for the deployed server and put its
signing secret in `STRIPE_WEBHOOK_SECRET`.

## API overview

### Public

| Method | Path | Notes |
|---|---|---|
| GET | `/api/services` | search / category / serviceMode / sort / limit / page |
| GET | `/api/services/:id` | public only; 404 unless approved + available |

### Auth & profile

| Method | Path | Middlewares |
|---|---|---|
| PATCH | `/api/users/profile` | `verifyToken` |

### Bookings

| Method | Path | Middlewares | Notes |
|---|---|---|---|
| POST | `/api/bookings` | `verifyToken`, `verifyCustomer` | duplicate active → `409` |
| GET | `/api/bookings/my` | `verifyToken`, `verifyCustomer` | |
| GET | `/api/bookings/stats` | `verifyToken`, `verifyCustomer` | dashboard |
| GET | `/api/bookings/technician` | `verifyToken`, `verifyTechnician` | |
| PATCH | `/api/bookings/:id/cancel` | `verifyToken`, `verifyCustomer` | from `requested` only |
| PATCH | `/api/bookings/:id/status` | `verifyToken`, `verifyTechnician` | statusRules only |

### Services

| Method | Path | Middlewares |
|---|---|---|
| POST | `/api/services` | `verifyToken`, `verifyTechnician` |
| GET | `/api/services/my` | `verifyToken`, `verifyTechnician` |
| GET | `/api/services/stats` | `verifyToken`, `verifyTechnician` |
| PATCH | `/api/services/:id` | `verifyToken`, `verifyTechnician` → back to `pending` |
| DELETE | `/api/services/:id` | `verifyToken`, `verifyTechnician` (own only) |
| PATCH | `/api/services/:id/availability` | `verifyToken`, `verifyTechnician` |

### Payments

| Method | Path | Notes |
|---|---|---|
| POST | `/api/payments/create-checkout-session` | customer, completed + unpaid booking |
| GET | `/api/payments/verify` | session retrieval + idempotent save |
| GET | `/api/payments/my` | customer history |
| GET | `/api/payments/stats` | customer totals |
| POST | `/api/payments/webhook` | public, raw body + Stripe signature |

### Admin

| Method | Path | Middlewares |
|---|---|---|
| GET | `/api/admin/users` | admin |
| PATCH | `/api/admin/users/:id/role` | admin (cannot change own role) |
| GET | `/api/admin/services` | admin |
| PATCH | `/api/admin/services/:id/approval` | admin |
| GET | `/api/admin/bookings` | admin |
| GET | `/api/admin/payments` | admin |
| GET | `/api/admin/stats` | admin |

---

## Rules enforced by the server

- `401` unauthenticated / `403` wrong role or ownership / `400` validation /
  `404` missing / `409` conflict — never mixed up.
- Role is always read from the DB, never from the token or the client.
- Only approved + available services are public; `GET /api/services/:id` → `404` otherwise.
- A technician edits a service → back to `approvalStatus: 'pending'`.
- No two active bookings per customer per service → `409 "You already have an active request for this service"`.
- `preferredDate` must be today or future, `problemDescription` ≥ 20 chars.
- Technician transitions: `requested → accepted|rejected`, `accepted → in-progress`,
  `in-progress → completed` (with `finalAmount > 0`). Any other transition → `400`.
- Payment: pay-after-service; amount always recomputed from the server-side booking.

## Seed

```bash
npm run seed
```

Upserts admin / technicians / customers / services / bookings / payments.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the API |
| `npm run dev` | Start with `node --watch` |
| `npm run seed` | Seed / upsert demo data |

## Deployment checklist

- [ ] `MONGODB_URI`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` set on host.
- [ ] CORS allows localhost + the deployed client domain.
- [ ] Stripe webhook endpoint registered (test mode).
- [ ] `GET /` and `GET /api/health` return OK.
- [ ] MongoDB Atlas network access allows the host.
