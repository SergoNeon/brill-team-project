# BRILL TEAM API — implementation scaffold

Node.js 20+ and PostgreSQL. This server is **not deployed**. GitHub Pages cannot run server-side code.

## Setup
1. Create a dedicated database and apply `schema.sql` with `psql`.
2. Run `npm install` inside `server/`.
3. Supply environment variables from `.env.example` via the deployment platform's secret manager. Never commit credentials.
4. Run `npm start`. Server listens on loopback. Expose only behind a TLS reverse proxy.
5. Configure `PUBLIC_ORIGIN` to the exact site origin; set a separate HTTPS API domain and update the frontend only after deployment and testing.

## Endpoints
- `POST /api/inquiries`: public inquiry; JSON `{name,email,message,website:""}`. Origin enforcement, honeypot and 5 requests/hour/IP (in-memory).
- `GET /api/news?lang=ru`: published news.
- `GET /api/content?lang=ru`: public content overrides.
- `GET /api/admin/inquiries`: admin inbox (Bearer token).
- `PUT /api/admin/inquiries/:id`: update inquiry status.
- `PUT /api/admin/content`: update translated content.
- `POST /api/admin/news`: create translated news.

## Security and production gaps
The static website is **not yet connected**. Admin UI, authentication with individual user accounts, audit logging, content moderation, durable distributed rate limits, monitoring, backup/restore drills and deployment are **not implemented**. Admin authentication uses scrypt password hashes and PostgreSQL-backed expiring HttpOnly Secure SameSite=Strict sessions. Bootstrap the first admin using `node scripts/create-admin.js <username> <password>` on a trusted host (avoid shell history for real passwords; adapt to secure stdin before production). Admin mutations require `X-Brill-CSRF: 1` and exact Origin. Admin UI, credential rotation, audit logging, distributed rate limiting and production deployment remain incomplete. Never expose admin credentials in static files. Never claim messages are delivered until a real database-backed end-to-end test passes.
