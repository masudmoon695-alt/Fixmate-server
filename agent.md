# AGENTS.md — FixMate Server (Backend)

Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) working on the **FixMate server**.
Read this file fully before writing or changing any code.

---

## 1. Project Summary

**FixMate** is an on-demand Smart Device & Home Appliance Repair Service platform.
This repository is the **Express + MongoDB API server**. The client (Next.js + BetterAuth) lives in a separate repository.

- **Stakeholders / roles:** `customer`, `technician`, `admin`
- **Core flow:** Technician lists service → Admin approves → Customer sends repair request → Technician moves job through status pipeline → Customer pays via Stripe **only after completion**.
- **Payment model:** pay-after-service, Stripe **test mode only**.

---

## 2. Tech Stack

| Area | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| Framework | Express.js |
| Database | MongoDB (official `mongodb` driver) |
| Auth | JWT (verified on server), users created by BetterAuth on the client |
| Payment | Stripe Checkout + Webhook (test mode) |
| Media | ImgBB (uploaded from the client; server only stores URLs) |
| Language | JavaScript (or TypeScript if the repo is already TS — do not mix) |

---

## 3. Suggested Folder Structure

```
server/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection + collection getters
│   │   └── stripe.js          # Stripe client
│   ├── middlewares/
│   │   ├── verifyToken.js
│   │   ├── verifyRole.js      # verifyCustomer / verifyTechnician / verifyAdmin
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── services.routes.js
│   │   ├── bookings.routes.js
│   │   ├── payments.routes.js
│   │   ├── admin.routes.js
│   │   └── users.routes.js
│   ├── controllers/           # request handling, one file per route group
│   ├── utils/
│   │   ├── statusRules.js     # job status transition map
│   │   └── objectId.js        # safe ObjectId parsing
│   ├── scripts/
│   │   └── seed.js            # admin, technicians, services, bookings
│   └── app.js
├── server.js                  # entry point
├── .env                       # NEVER commit
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Environment Variables (`.env`)

All secrets MUST come from environment variables. Never hardcode or commit them. Keep `.env` in `.gitignore` and provide `.env.example` with empty values.

```
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

- `CLIENT_URL` supports the production domain; CORS allowed origins must include **localhost + the deployed client domain**.
- Add the production Stripe webhook endpoint in the Stripe Dashboard (test mode) and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

---

## 5. Database Design (exactly 4 collections of our own)

BetterAuth also creates `session`, `account`, `verification` — these are **not** counted and the server must not modify them.
BetterAuth's `user` collection is treated as our **users** collection (extra fields: `role`, `phone`, `area`, `bio`).

### 5.1 users
`_id, name, email (unique), image, role ('customer'|'technician'|'admin', default 'customer'), phone, area, bio`

### 5.2 services
`_id, title, category, description, image, basePrice (Number), estimatedDuration, serviceMode ('Home Visit'|'Shop Drop-off'), serviceArea, technicianName, technicianEmail, approvalStatus ('pending'|'approved'|'rejected', default 'pending'), isAvailable (default true), createdAt (Date)`

Categories (allowed values): `Smartphone`, `Laptop & PC`, `AC`, `Refrigerator`, `TV`, `Washing Machine`, `Electrical`.

### 5.3 bookings
`_id, serviceId (String), serviceTitle, serviceImage, category, basePrice, technicianName, technicianEmail, customerName, customerEmail, customerPhone, address, preferredDate (Date), problemDescription, status ('requested'|'accepted'|'rejected'|'in-progress'|'completed'|'cancelled', default 'requested'), finalAmount (default = basePrice), paymentStatus ('unpaid'|'paid', default 'unpaid'), createdAt`

Service and technician info is **copied** into the booking so it still renders if the service is edited/deleted later.

### 5.4 payments
`_id, bookingId, serviceTitle, customerName, customerEmail, technicianName, technicianEmail, amount, currency ('usd'), transactionId (payment_intent id), stripeSessionId (UNIQUE), paymentStatus ('paid'), paidAt`

### Relations
- `services.technicianEmail = users.email`
- `bookings.serviceId = services._id`
- `bookings.customerEmail` / `bookings.technicianEmail` = `users.email`
- `payments.bookingId = bookings._id` (max one payment per booking)

### Required indexes
```js
payments.createIndex({ stripeSessionId: 1 }, { unique: true });
payments.createIndex({ bookingId: 1 }, { unique: true });
services.createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 });
bookings.createIndex({ customerEmail: 1 });
bookings.createIndex({ technicianEmail: 1 });
```

---

## 6. Authentication & Authorization (Challenge 2)

Custom Express middlewares, applied in this order: `verifyToken` → role middleware.

| Middleware | Behavior |
|---|---|
| `verifyToken` | Reads `Authorization: Bearer <token>`, verifies JWT. Missing/invalid/expired → **401 Unauthorized**. Attaches `req.user` (email). |
| `verifyCustomer` | Loads user from DB by email; role must be `customer`, else **403 Forbidden**. |
| `verifyTechnician` | Role must be `technician`, else **403**. |
| `verifyAdmin` | Role must be `admin`, else **403**. |

Rules:
- **Never trust the role inside the token or sent by the client.** Always read the role from the `users` collection.
- **Never trust an email from the URL/body for ownership.** Use `req.user.email` from the verified token. A customer must not read another customer's bookings by changing an email.
- Return `401` for "not authenticated" and `403` for "authenticated but not allowed". Do not mix them up.

### Route → middleware map

| API | Middlewares |
|---|---|
| `POST /api/bookings` | verifyToken, verifyCustomer |
| `PATCH /api/bookings/:id/cancel` | verifyToken, verifyCustomer |
| `GET /api/bookings/my` | verifyToken, verifyCustomer |
| `POST /api/payments/create-checkout-session` | verifyToken, verifyCustomer |
| `GET /api/payments/verify` | verifyToken, verifyCustomer |
| `GET /api/payments/my` | verifyToken, verifyCustomer |
| `POST /api/services` | verifyToken, verifyTechnician |
| `PATCH /api/services/:id` | verifyToken, verifyTechnician |
| `DELETE /api/services/:id` | verifyToken, verifyTechnician |
| `PATCH /api/services/:id/availability` | verifyToken, verifyTechnician |
| `GET /api/services/my` | verifyToken, verifyTechnician |
| `GET /api/bookings/technician` | verifyToken, verifyTechnician |
| `PATCH /api/bookings/:id/status` | verifyToken, verifyTechnician |
| `GET /api/admin/users` | verifyToken, verifyAdmin |
| `PATCH /api/admin/users/:id/role` | verifyToken, verifyAdmin |
| `GET /api/admin/services` | verifyToken, verifyAdmin |
| `PATCH /api/admin/services/:id/approval` | verifyToken, verifyAdmin |
| `GET /api/admin/bookings` | verifyToken, verifyAdmin |
| `GET /api/admin/payments` | verifyToken, verifyAdmin |
| `GET /api/admin/stats` | verifyToken, verifyAdmin |
| `PATCH /api/users/profile` | verifyToken |
| `GET /api/services`, `GET /api/services/:id` | Public |
| `POST /api/payments/webhook` | Public, but **Stripe signature verified** |

Dashboard stats endpoints (`/api/*/stats`) should use the matching role middleware and return aggregated numbers/series for the dashboard charts.

---

## 7. Business Rules (must be enforced on the SERVER)

1. Nobody can become `admin` through sign-up. Admin is created by seed/database only.
2. Only services with `approvalStatus: 'approved'` **and** `isAvailable: true` are returned by public endpoints. `GET /api/services/:id` returns **404** for any service that is not approved/available.
3. When a technician edits a service, set `approvalStatus` back to `'pending'`.
4. Technicians and admins **cannot** create bookings (403).
5. A technician cannot book their own service.
6. A customer cannot have two **active** bookings (`requested`, `accepted`, `in-progress`) for the same service → respond **409** with message `"You already have an active request for this service"`.
7. A technician can only see/update bookings where `technicianEmail === req.user.email`. A customer can only see their own bookings.
8. `preferredDate` must be today or in the future. `problemDescription` must be at least 20 characters. `basePrice` must be a positive number.
9. A technician can only edit/delete/toggle **their own** services (match `technicianEmail`).
10. An admin cannot change their **own** role.
11. Role updates only allow `customer | technician | admin`.

---

## 8. Job Status Pipeline (Challenge 3)

Implement the transition map in `utils/statusRules.js` and use it in **one** place only.

| Current | Next | Who | Extra rule |
|---|---|---|---|
| requested | accepted | Technician (job owner) | — |
| requested | rejected | Technician (job owner) | Final state |
| requested | cancelled | Customer (booking owner) | Final state |
| accepted | in-progress | Technician (job owner) | — |
| in-progress | completed | Technician (job owner) | Body must include `finalAmount` > 0 (number) |
| completed + unpaid | paymentStatus `paid` | Stripe only | Once per booking |

```js
// example shape
const technicianTransitions = {
  requested: ['accepted', 'rejected'],
  accepted: ['in-progress'],
  'in-progress': ['completed'],
};
```

- Any other transition (e.g. `requested → completed`, changing a `cancelled`/`rejected`/`completed` job) → reject with **400** (or **409**) and a clear message.
- `cancelled` is set only through `PATCH /api/bookings/:id/cancel` by the owning customer, and only from `requested`.
- Technician status endpoint must **never** allow setting `paymentStatus`.
- When completing: validate `finalAmount` is a finite number > 0.

---

## 9. Stripe Payment Flow

**Never trust an amount from the client.**

1. `POST /api/payments/create-checkout-session` `{ bookingId }`
   - Load booking from DB. Must be: owned by `req.user.email`, `status === 'completed'`, `paymentStatus === 'unpaid'`. Otherwise **403/400**.
   - Create Checkout Session: `unit_amount = Math.round(finalAmount * 100)`, `currency: 'usd'`, `mode: 'payment'`, `success_url = CLIENT_URL/payment/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url = CLIENT_URL/payment/cancel`, `metadata: { bookingId, customerEmail }`.
   - Return `{ url }`.
2. `GET /api/payments/verify?session_id=...`
   - Retrieve session from Stripe. If `payment_status === 'paid'`:
     - Confirm `metadata.customerEmail === req.user.email`.
     - Save payment **idempotently** (see below) and set booking `paymentStatus: 'paid'`.
     - Return amount + transactionId for the success page.
3. `POST /api/payments/webhook` (Challenge 4 / optional bonus)
   - Use `express.raw({ type: 'application/json' })` for this route **before** `express.json()`.
   - Verify with `stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)`.
   - Handle `checkout.session.completed` with the same idempotent save function.

### Idempotency (no duplicate payments)
Use ONE shared function (`savePaymentFromSession(session)`) for both verify and webhook:
- If a payment with the same `stripeSessionId` (or `bookingId`) already exists → return it, do not insert again.
- Rely on the unique indexes as a safety net; catch duplicate key error (`11000`) and treat it as success.
- Update booking `paymentStatus: 'paid'` only when it is still `'unpaid'`.

---

## 10. Search, Filter & Sort (Challenge 1)

`GET /api/services` — everything happens in MongoDB, never in JS `.filter()`:

| Query param | Behavior |
|---|---|
| `search` | Case-insensitive regex on `title` OR `category` (escape regex special chars) |
| `category` | Exact match |
| `serviceMode` | `Home Visit` or `Shop Drop-off` |
| `sort` | `price-asc` → `{basePrice: 1}`, `price-desc` → `{basePrice: -1}`, default/`newest` → `{createdAt: -1}` |
| `limit` | Optional (e.g. `6` for home featured services, sorted by `createdAt: -1`) |
| `page` | Optional pagination with `.skip()` / `.limit()`; return `{ data, total, page, totalPages }` |

Base filter is always `{ approvalStatus: 'approved', isAvailable: true }`.

---

## 11. Response & Error Conventions

- JSON only. Success: `{ success: true, data, message? }`. Error: `{ success: false, message }`.
- Status codes: `200/201` success, `400` validation, `401` no/invalid token, `403` wrong role/ownership, `404` not found, `409` conflict (duplicate active request), `500` unexpected.
- Validate `ObjectId` before querying (`ObjectId.isValid`) — invalid id → `400/404`, never a crash.
- Validate and sanitize every body field on the server; never spread `req.body` directly into a DB document or `$set` (whitelist fields).
- Never allow clients to set: `role` (except admin role API), `approvalStatus` (except admin), `paymentStatus`, `technicianEmail`, `customerEmail`, `createdAt`.
- Use a central error handler middleware; wrap async handlers so errors never hang a request.
- Do not log secrets, tokens, or full Stripe objects.

---

## 12. Deployment Checklist

- [ ] Works on production with **no CORS / 404 / 504 errors**.
- [ ] CORS allows localhost and the **deployed client domain** with `credentials` as needed.
- [ ] Reload on any route never breaks the API; server does not crash on bad input.
- [ ] `GET /` health route returns a simple "FixMate server running" message.
- [ ] All env vars set on the hosting platform (e.g. Vercel / Render / Railway).
- [ ] MongoDB Atlas network access allows the host; connection is reused (serverless-safe cached client).
- [ ] Stripe webhook endpoint registered for the deployed server (test mode); signing secret in `.env`.
- [ ] Seed data loaded on the live database.

---

## 13. Seed Data (`scripts/seed.js`)

The live site must look complete. Seed script must be re-runnable (upsert, no duplicates):
- 1 admin account (role set directly in DB; user created so BetterAuth login works)
- At least 2 technician accounts and 1+ customer account
- 12+ **approved** services across all 7 categories (realistic titles, ImgBB/hosted image URLs, USD prices)
- A few bookings in different statuses (`requested`, `accepted`, `in-progress`, `completed` unpaid, `completed` paid, `rejected`, `cancelled`) with matching `payments` records for paid ones

---

## 14. Git & Commit Rules

- Minimum **12 meaningful commits** on the server repo, each with a descriptive message.
- Use conventional style: `feat: add verifyTechnician middleware`, `fix: block duplicate active bookings`, `chore: add .env.example`.
- One logical change per commit. No "update", "fix", "final" style messages.
- Never commit `.env`, `node_modules`, or any secret. Rotate any key that was ever committed.

Suggested commit sequence: project setup → DB connection → env config + CORS → verifyToken → role middlewares → services CRUD → public services search/filter/sort → bookings create + duplicate guard → status pipeline → admin APIs → Stripe checkout session → payment verify + idempotency → webhook → stats endpoints → seed script → README.

---

## 15. README.md Requirements (server)

Must include: project name, purpose, live URL, admin credentials, key features, and the list of npm packages used (`express`, `cors`, `dotenv`, `mongodb`, `jsonwebtoken`, `stripe`, etc.).

---

## 16. Agent Do / Don't

**Do**
- Enforce every rule on the server even if the client already checks it.
- Keep controllers thin and reuse helpers (`statusRules`, `savePaymentFromSession`).
- Test each protected route for 401 (no token), 403 (wrong role), and ownership violations.
- Keep the 4-collection design; do not add new collections without being asked.

**Don't**
- Don't trust role, email, price, or amount coming from the client.
- Don't filter/sort/search in JavaScript after fetching all documents.
- Don't hardcode secrets, URLs, or Stripe keys.
- Don't create a payment record anywhere except the shared idempotent function.
- Don't modify BetterAuth's `session`, `account`, `verification` collections.
- Don't switch Stripe to live mode.

---

## 17. Quick Test Scenarios (manual / Postman)

1. Call a private API with no token → `401`.
2. Customer calls `GET /api/admin/users` → `403`.
3. Customer A tries to read Customer B's bookings → only own data returned / `403`.
4. Customer creates a second active booking for the same service → `409`.
5. Technician sends `requested → completed` → rejected.
6. Technician B tries to update Technician A's booking → `403`.
7. Customer tries to pay a non-completed or already paid booking → rejected.
8. Verify the same Stripe session twice + webhook retry → exactly **one** payment document.
9. Admin changes own role → rejected.
10. `GET /api/services/:id` for pending/unavailable service → `404`.