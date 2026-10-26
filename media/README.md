# BRILL MEDIA

Internal content-planning studio for **Brill Team Project**. All source code lives in GitHub under media/. This is a reviewable prototype, not a published marketing platform.

## Implemented in the first GitHub branch
- Cinematic editorial workspace with Overview, Content, Calendar, Projects and Studio views.
- Six Brill-related product profiles (no customer information).
- RU / HE / EN language switch, including Hebrew right-to-left layout.
- Create, edit, delete, filter and search campaign ideas; local browser persistence.
- Date-based editorial calendar and counts computed from actual local records.
- Full form validation, modal confirmations and keyboard accessibility baseline.
- Rights safeguard preventing SHELEG TV content from moving into scheduled status before verification.
- Responsive mobile screen layout; no external font, UI, or image service needed.
- Node.js built-in smoke/domain tests and GitHub Actions validation.

## Not implemented (do not present as live)
- Login, employee roles, cloud sync, audit history, server database.
- AI video creation, file uploads, real social media OAuth or publishing.
- Real social metrics, ad spend, lead capture, or payments.
- Rights licensing/verification of media materials.
- Production hosting and publicly shared preview of the unmerged branch.

All seed records and counts are **demo content**. Editorial statuses represent local planning, not successful publication. localStorage persists only in the same browser/profile; it is not a safe place for secrets or private customer data.

## Run locally from GitHub checkout

Requires a static HTTP server because the JavaScript uses ES modules.

From repository root:

    python3 -m http.server 8080

Open http://localhost:8080/media/ (or use an existing trusted static dev server).

## Tests

Use Node.js 20+:

    node --check media/model.mjs
    node --check media/app.mjs
    node --test media/tests/model.test.mjs

GitHub Actions workflow: .github/workflows/brill-media-checks.yml.

## Next engineering milestone
1. Run browser visual and interaction QA on desktop + Android/iPhone and all three locales.
2. Review design and functionality with the owner from the isolated feature branch.
3. After approval, implement server-side access-controlled editorial storage and cross-device synchronization on the approved GitHub stack.
4. Connect social providers only with authorized accounts, provider terms, idempotent publication and audit logs. Any real-media assets must clear rights review.

Do not merge into main or deploy production until testing and explicit review.
