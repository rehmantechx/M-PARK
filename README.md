# M-Park Dashboard

## Backend Dashboard Only

This repository is the M-Park backend dashboard only. It contains the Customer Dashboard (C) and the Admin Dashboard (D), the login, and the backend APIs and database that the dashboards need.

The public frontend is not in this branch. The landing page, the public scan page, the public order page, and the public registration page are built by the frontend team. This branch has no public marketing UI. The root URL `/` redirects to `/login`.

## What this dashboard does

M-Park connects car owners and the public through a QR sticker on the car windscreen. A scanner uses the sticker to reach the owner. The owner number is never shown publicly. Communication happens only through the M-Park secure system. Messages are delivered instantly and anonymously.

The core business is selling QR stickers. A customer orders a sticker, registers the vehicle, and the sticker is permanently linked to that vehicle until ownership or registration changes.

## Customer Dashboard (C)

For a car owner, at `/customer`:

- Overview of vehicle, QR sticker, pending requests, and notifications.
- My Vehicle: registered vehicle details, editable.
- My QR Sticker: the QR image for the vehicle, with download and print.
- My Sticker Order: sticker price paid, payment status, order status, and delivery status.
- Notifications: contact requests and system messages.
- Contact Requests: approve or ignore requests from scanners.
- Emergency Contact: add, edit, and remove an emergency contact.

## Admin Dashboard (D)

For the owner of M-Park, at `/admin`:

- Overview: total registered users, total registered vehicles, active and inactive QR codes, pending contact requests, active subscriptions, QR stickers sold, and revenue from sticker sales.
- Orders: QR sticker sales, buyer, plate, sticker code, price, payment status, and order status from Ordered to Activated. Mark orders paid or unpaid, change order status, and set the sticker price.
- Customers: search, view, edit, add, block, and unblock customers.
- Vehicles: all registered vehicles.
- QR Codes: activate, deactivate, and mark codes lost.
- QR Inventory: sticker stock, batches, assigned and unassigned codes, and generate a new batch.
- Contact Requests and Notifications: monitoring of all scans, calls, alerts, and notifications.
- Subscriptions and Plans: create and edit subscription plans and prices.

## QR sticker selling

Selling QR stickers is the core M-Park business:

- The M-Park QR sticker costs PKR 999, stored in the database and managed in the Admin Dashboard.
- An order reserves the next unassigned QR code and creates a sticker order in the database.
- The admin confirms payment, ships the sticker, and the sticker is permanently linked to the vehicle after registration.
- The admin can see total QR stickers sold and total revenue from sticker sales.

## Backend APIs

These APIs serve the dashboards and the frontend team. The frontend team builds the public pages on top of them. There is no public page UI for these APIs in this branch.

| Route | Purpose |
| --- | --- |
| `POST /api/auth/admin-login` | Admin login with email and password |
| `POST /api/auth/logout` | Logout, clears the session cookie |
| `POST /api/otp/request` | Request a 6 digit OTP for a phone number |
| `POST /api/otp/verify-customer` | Verify a customer OTP and log the customer in |
| `POST /api/register` | Register a vehicle with QR verification and OTP |
| `POST /api/order` | Create a sticker order and reserve a QR code |
| `GET /api/qr/[code]` | Look up a QR code and its vehicle |
| `POST /api/scan/[code]/call` | Log a Call Owner request through M-Park Secure Relay, owner number never returned |
| `POST /api/scan/[code]/alert` | Log an anonymous M-Park Alert, with preset reasons and free text |

Every call and alert creates a scan log, a contact request, and a notification in the database, so the owner and the admin can see it in their dashboards. Example vehicle: LEK 7982, Grey Suzuki Cultus, QR code MPK-1009.

## Privacy and security

- The owner phone number is never returned by the call route, and the scanner number is never shared with the owner.
- Alerts are anonymous by design.
- Admin login uses email and password with bcrypt password hashing and a JWT session cookie.
- Customer login uses phone number and a 6 digit OTP. OTP codes expire in 10 minutes, allow a maximum of 5 attempts, and are stored as a SHA-256 hash in the database.
- OTP is used only for customer registration and login. A scanner never needs OTP.

## Tech stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS |
| Database | Prisma, SQLite for local development, PostgreSQL for production |
| Authentication | Bcrypt password hashing, JWT session cookies, phone OTP |
| QR codes | Unique code per sticker, generated QR image from the scan URL |

## Getting started

### Prerequisites

- Node.js 20 or later
- npm

### Run locally

```bash
git clone https://github.com/pakmultilinks-dot/m-park.git
cd m-park
git checkout dashboard-only
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open http://localhost:3000 in the browser. The root URL redirects to `/login`.

### Build for production

```bash
npm run build
npm run start
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values. Never commit `.env`.

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | SQLite file for local development, for example `file:./dev.db`. For production, a PostgreSQL connection string. |
| `SESSION_SECRET` | A long random string used to sign session cookies. Generate one per install. |
| `NEXT_PUBLIC_BASE_URL` | Public base URL used to build QR scan links, for example `https://m-park.example`. Use `http://localhost:3000` locally. |
| `SMS_PROVIDER` | SMS provider for OTP delivery. Leave empty in development. Set to `twilio` in production. |
| `TWILIO_ACCOUNT_SID` | Twilio account SID, required when `SMS_PROVIDER` is `twilio`. |
| `TWILIO_AUTH_TOKEN` | Twilio auth token, required when `SMS_PROVIDER` is `twilio`. |
| `TWILIO_FROM` | Twilio sender phone number, required when `SMS_PROVIDER` is `twilio`. |
| `PAYMENT_PROVIDER` | Payment provider for online sticker payment, for example `jazzcash`, `easypaisa`, or `stripe`. |
| `PAYMENT_MERCHANT_ID` | Merchant ID for the payment provider. |
| `PAYMENT_SECRET` | Secret key for the payment provider. |

With no SMS provider configured, OTP codes are logged to the server console and, in development mode only, shown on screen labelled as a development code. In production, configure an SMS provider so OTP codes are delivered by SMS.

## Database and test accounts

Prisma manages the database. SQLite is used for local development. The file is `prisma/dev.db`, created by the migration, and it is git ignored. For production PostgreSQL, change the provider in `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL` to the PostgreSQL connection string, and run a new migration.

The seed script in `prisma/seed.ts` creates test data only, for local development. Do not run the seed script on a live database. Test accounts are:

| Account | Details |
| --- | --- |
| Admin | `admin@m-park.example` / `Admin1234!` - change this password before launch |
| Customer | `+92 300 1234567`, login with phone and OTP |
| Video vehicle | LEK 7982, Grey Suzuki Cultus, QR code MPK-1009 |
| Unassigned QR codes | MPK-1010 to MPK-1050, MPK-1051 to MPK-1100 |

Subscription plans in the seed data:

| Plan | Price | Duration |
| --- | --- | --- |
| Basic Monthly | PKR 499 | 1 month |
| Standard Monthly | PKR 999 | 1 month |
| Premium Yearly | PKR 9999 | 12 months |

## Project structure

```text
prisma/
  schema.prisma        Database models
  seed.ts              Test data only
  migrations/          Database migrations
src/
  app/
    page.tsx           Redirects to /login, no public page
    login/             Admin login and customer OTP login
    customer/          Customer Dashboard
    admin/             Admin Dashboard
    api/               Authentication, OTP, order, register, scan, and QR routes
  components/          Shared dashboard layout and logout components
  lib/                 Database, authentication, OTP, SMS, QR, and admin actions
  middleware.ts        Route protection for admin and customer areas
```

## Security and production checklist

This dashboard was hardened for production. The main guarantees are:

- Sessions are JWTs signed with SESSION_SECRET, which must be at least
  32 random characters in production. The server refuses to start in
  production without one. Cookies are httpOnly, sameSite lax, and secure
  in production. Passwords use bcrypt cost 12.
- Every admin and customer page checks the session, the role, and the
  blocked flag in the database. A customer can never open an admin page,
  and a customer only ever sees their own vehicle, orders, requests,
  and notifications. The owner phone number is never returned by any
  API or rendered on any page.
- OTP codes are stored as SHA-256 hashes, expire in 10 minutes, allow
  5 attempts, and only the newest code works. A resend deletes older
  codes. In production the code is only delivered by SMS, never shown
  on screen and never written to a log.
- All forms and APIs validate input on the server: phone and plate
  formats, year, whole number money, and field lengths. Errors are
  friendly messages, never stack traces or database details.
- Rate limits: admin login 10 per 5 minutes, OTP 5 per hour per phone,
  scan alert and call 10 per minute per QR code. All return 429.
- Security headers are set in next.config.mjs: nosniff, frame deny,
  referrer, and permissions policy.
- Concurrent orders are queued in one process for SQLite, so two
  orders can never share a QR code. On Postgres with several servers
  this must become a database lock instead of the in-process mutex.
- The in-memory rate limiter is single-server only. On a multi-server
  deployment it must move to a shared store such as Redis.
- Never run the seed script on a live database. It refuses to run when
  NODE_ENV is production, and it wipes and reseeds test data.
- Never reseed or delete the database file while the server is running.
  Stop the server, reseed, then start it again, or the live Prisma
  connection keeps pointing at the deleted file.

## Deployment notes

Before launch, complete these steps:

- Set a production `SESSION_SECRET`, a production `DATABASE_URL`, and `NEXT_PUBLIC_BASE_URL` to the live domain, so QR scan links point to the live site.
- Configure an SMS provider and keys for registration and login OTP.
- Configure a telephony provider and keys for live Secure Relay voice calls. Until it is connected, the call route logs the call for the owner and the admin.
- Configure a payment provider and merchant keys for online sticker payment. Until it is connected, orders are created as unpaid and the admin confirms payment after the customer pays.
- Change the seeded admin password.
- Confirm the sticker price and the subscription plan prices.

## Roadmap

Future vision for M-Park, not built in this branch:

- AI based parking detection
- Smart parking
- Vehicle alerts
- Fleet management

## License and contact

License: to be confirmed by the owner.

Contact: to be confirmed by the owner.
