<div align="center">

# ⚙️ FixMate Server (Backend)

**Express + MongoDB REST API for the FixMate repair booking platform**

[Live API](https://fixmate-server-two.vercel.app) · [Health Check](https://fixmate-server-two.vercel.app/api/health) · [Frontend Repo](https://github.com/masudmoon695-alt/Fixmate-client) · [Live Site](https://fixmate-client-alpha.vercel.app)

</div>

---

FixMate is an on-demand Smart Device & Home Appliance Repair Service platform. This repository contains the **Express + MongoDB API server**. The Next.js + BetterAuth client lives in a [separate repository](https://github.com/masudmoon695-alt/Fixmate-client).

- **Base path:** everything under `/api`
- **Health check:** `GET /api/health`
- **Entry:** `server.js` → `src/app.js`
- **Deployed on:** Vercel (serverless, `api/` entry + `vercel.json`)

## 🧰 Stack

| Area | Technology |
|---|---|
| Runtime | Node.js (>= 20) |
| Framework | Express.js |
| Database | MongoDB (official `mongodb` driver, cached and serverless-safe client) |
| Auth | JWT (BetterAuth issues tokens, the server verifies them with `JWT_SECRET`) |
| Payment | Stripe Checkout + Webhook (test mode only) |
| Media | ImgBB (client uploads, server stores URLs) |
| Deployment | Vercel |

## 🚀 Getting Started

```bash
git clone https://github.com/masudmoon695-alt/Fixmate-server.git
cd Fixmate-server
cp .env.example .env
npm install
npm run dev
```

The API runs at `http://localhost:5000`.

### Environment Variables

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

> `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` belong to **Stripe test mode only**. Register the production webhook endpoint for the deployed server and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

### Scripts

| Command | Description |
|---|---|
| `npm start` | Start the API |
| `npm run dev` | Start with `node --watch` |
| `npm run seed` | Seed / upsert demo data (admin, technicians, customers, services, bookings, payments) |

## 📡 API Overview

### Public

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/services` | `search`, `category`, `serviceMode`, `sort`, `limit`, `page` |
| GET | `/api/services/:id` | Public only; `404` unless approved and available |

### Auth & Profile

| Method | Path | Middlewares |
|---|---|---|
| PATCH | `/api/users/profile` | `verifyToken` |

### Bookings

| Method | Path | Middlewares | Notes |
|---|---|---|---|
| POST | `/api/bookings` | `verifyToken`, `verifyCustomer` | Duplicate active booking → `409` |
| GET | `/api/bookings/my` | `verifyToken`, `verifyCustomer` | |
| GET | `/api/bookings/stats` | `verifyToken`, `verifyCustomer` | Dashboard stats |
| GET | `/api/bookings/technician` | `verifyToken`, `verifyTechnician` | |
| PATCH | `/api/bookings/:id/cancel` | `verifyToken`, `verifyCustomer` | From `requested` only |
| PATCH | `/api/bookings/:id/status` | `verifyToken`, `verifyTechnician` | Allowed transitions only |

### Services

| Method | Path | Middlewares |
|---|---|---|
| POST | `/api/services` | `verifyToken`, `verifyTechnician` |
| GET | `/api/services/my` | `verifyToken`, `verifyTechnician` |
| GET | `/api/services/stats` | `verifyToken`, `verifyTechnician` |
| PATCH | `/api/services/:id` | `verifyToken`, `verifyTechnician` (goes back to `pending`) |
| DELETE | `/api/services/:id` | `verifyToken`, `verifyTechnician` (own only) |
| PATCH | `/api/services/:id/availability` | `verifyToken`, `verifyTechnician` |

### Payments

| Method | Path | Notes |
|---|---|---|
| POST | `/api/payments/create-checkout-session` | Customer, completed and unpaid booking |
| GET | `/api/payments/verify` | Session retrieval and idempotent save |
| GET | `/api/payments/my` | Customer payment history |
| GET | `/api/payments/stats` | Customer totals |
| POST | `/api/payments/webhook` | Public, raw body and Stripe signature |

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

## 🔒 Rules Enforced by the Server

- `401` unauthenticated, `403` wrong role or ownership, `400` validation, `404` missing, `409` conflict. These are never mixed up.
- The role is always read from the database, never from the token or the client.
- Only approved and available services are public; `GET /api/services/:id` returns `404` otherwise.
- When a technician edits a service, it goes back to `approvalStatus: 'pending'`.
- No two active bookings per customer per service → `409 "You already have an active request for this service"`.
- `preferredDate` must be today or a future date, and `problemDescription` must be at least 20 characters.
- Technician status transitions:
  `requested → accepted | rejected`, `accepted → in-progress`, `in-progress → completed` (with `finalAmount > 0`). Any other transition returns `400`.
- Payment is pay-after-service; the amount is always recomputed from the server-side booking.

## 📁 Project Structure

```
Fixmate-server/
├── api/              # Vercel serverless entry
├── src/              # Express app, routes, controllers, middlewares
├── server.js         # Local entry point (app.listen)
├── vercel.json       # Vercel routing config
├── .env.example      # Environment variable template
└── agent.md          # AI agent rules for this project
```

## ☁️ Deployment (Vercel)

- [ ] `MONGODB_URI`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `IMGBB_API_KEY` set in the Vercel dashboard
- [ ] `CLIENT_URL` set to `https://fixmate-client-alpha.vercel.app` (CORS allows localhost and the deployed client)
- [ ] Stripe webhook endpoint registered: `https://fixmate-server-two.vercel.app/api/payments/webhook` (test mode)
- [ ] `GET /` and `GET /api/health` return OK
- [ ] MongoDB Atlas Network Access allows the host (`0.0.0.0/0` for Vercel)
- [ ] Redeploy after changing any environment variable

## 🔗 Related

| | URL |
|---|---|
| Frontend repo | https://github.com/masudmoon695-alt/Fixmate-client |
| Live site | https://fixmate-client-alpha.vercel.app |
| Live API | https://fixmate-server-two.vercel.app |

## 👨‍💻 Author

**Masud**
- GitHub: [@masudmoon695-alt](https://github.com/masudmoon695-alt)
