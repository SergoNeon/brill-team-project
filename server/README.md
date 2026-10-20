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
The static website is **not yet connected**. Admin UI, authentication with individual user accounts, audit logging, content moderation, durable distributed rate limits, monitoring, backup/restore drills and deployment are **not implemented**. The single shared Bearer token is a temporary bootstrap mechanism, not suitable as a final public admin login. Do not put it in static pages or browser storage. Do not expose admin routes publicly until replaced with session-based authentication and CSRF protection. Never claim messages are delivered until a real database-backed end-to-end test passes.
