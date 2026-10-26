# BRILL MEDIA — UX Contract (prototype)

## Product, authority and risk
- Parent product: Brill Team Project. GitHub repository SergoNeon/brill-team-project is the only source of truth.
- Current use: editable editorial **prototype** within the media/ folder, not a production customer app.
- Audience: owner and eventually editors. No staff roles or authentication exist in this version.
- Languages: Russian (default), Hebrew (full RTL), English. Dates formatted according to the active UI language.
- Time zone: date-only plan values (YYYY-MM-DD), no implicit conversion to publication times.
- Accessibility target: WCAG 2.2 AA.
- Business source: owner-requested in-house media studio and explicit GitHub-only development rule, 2026-10-26.
- Studio publication policy: no third-party publishing integration yet; all marketing metrics must be actual or explicitly labeled demo.
- Rights gate: SHELEG TV content cannot enter "scheduled" status before rights are verified. The prototype cannot verify rights, so scheduling is blocked.
- Scope boundary: client data, advertising accounts, payment credentials, and production API keys must NOT be stored in local browser state.

## Canonical visual and interaction owners
- Visual decisions and tokens: media/DESIGN.md; runtime token source: media/styles.css root CSS custom properties.
- Navigation: dedicated route selector in media/app.mjs + URL query string ?view=...
- Form: one editor dialog (create and update), native date/select and field validation using media/model.mjs.
- Confirmation: one modal alert dialog for permanent local record deletion; never use native confirm().
- Toast: one local feedback region; no false claim of server persistence.
- Scrollbars: global styles.css baseline with both standard and WebKit rules.
- Lists: content list is bounded to 500 local records and filtered client-side (prototype only).
- Statuses: draft, review, scheduled. These are local editorial states, never platform post statuses.

## Lifecycle ledger

| Operation | Trigger | Pending / state | Success destination | Feedback | Failure recovery |
| --- | --- | --- | --- | --- | --- |
| Create | New content | Dialog opened, required fields | Content view | Saved locally | Inline field error, dialog retained |
| Edit | Edit icon | Same editor, prefilled | Content view | Updated locally | Inline field error, dialog retained |
| Delete | Delete icon | Confirmation dialog | Current view | Deleted locally | Cancel without mutation |
| Filter | Search/status | Immediate local filtering | Same view | Result count | Clear search/filter |
| Calendar | Calendar navigation | Static local render | Calendar view | Dated cards | Empty guidance |
| Language | RU / HE / EN | In-place translation | Same view | Pressed state | RU fallback |
| External publishing | Not implemented | No button | n/a | Explicit disclosure | Introduce authenticated backend and permissions first |

## Data contract
- Records are stored under brill-media-records-v1 in localStorage; language under brill-media-language-v1.
- First load initializes five clearly labeled demo ideas. Deleting all records leaves an empty library; do not recreate demo records on refresh.
- Supported project IDs and channels are allowlisted in model.mjs.
- Record title max 140, notes max 2000. Scheduled status requires a real date.
- Mutations rerender list, overview, calendar and project counts coherently.
- Browser storage failure uses in-memory state only and must show a visible warning.
- Labels and controls translate; user-created content is not silently translated.
- All user text inserted via dynamic HTML must be escaped.
- No API requests, authentication, analytics tracking, or account connection in this release.

## Navigation / responsive behavior
- Desktop sidebar becomes horizontal, scrollable navigation on narrow devices.
- URL query ?view=content|calendar|projects|about preserves deep-link visibility.
- The hero is visible only on overview to prevent obstruction of work.
- Forms use normal document/modal scroll; primary actions remain reachable with phone keyboard.
- RTL applies to navigation, form labels, lists and calendar. Latin BRILL wordmark is intentionally LTR.
- Minimum practical touch target for actions is about 42–44px.
- Skip link and focus-visible outline stay usable in keyboard navigation.

## Focus, keyboard and feedback
- Opening a dialog moves focus to title or safe cancel.
- Tab and Shift+Tab remain within the dialog; Escape closes it.
- On cancel and save focus returns to the invoking control when still visible, otherwise to topbar New content.
- Destructive confirmation gives focus to Cancel first.
- Validation errors appear inline in an alert region and focus the erroneous field.
- Toast messages specify local scope, are dismissible by expiry and never represent a social-network operation.

## Deployment & acceptance gate
- GitHub branch + PR only until owner reviews. Never overwrite the existing site or deploy to production unreviewed.
- Static model tests and syntax checks in GitHub Actions must pass when Actions are available.
- Before claiming a usable release: verify real browser flow (create, update, refresh, delete, filter, date),
  360px Android/iPhone layout, Hebrew RTL, keyboard focus, scroll behavior, and accessibility contrast.
- Production multi-device sync, roles, audit logs, provider OAuth, social publishing, approval,
  privacy/retention policies and real analytics all require a separate server-backed version.
