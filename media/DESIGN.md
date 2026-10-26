---
version: alpha
name: "BRILL MEDIA"
description: "Editorial control room for Brill Team Project's in-house content studio."
colors:
  background: "#0b0b0f"
  surface: "#141419"
  surfaceRaised: "#1b1b21"
  text: "#f2eee8"
  muted: "#b3abb0"
  primary: "#c8384c"
  secondary: "#d3ac6c"
  border: "#343139"
  focus: "#e0c18d"
typography:
  display:
    fontFamily: '"Arial Narrow", Impact, "Segoe UI", sans-serif'
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
  mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace'
rounded:
  DEFAULT: "0.375rem"
  card: "0.75rem"
spacing:
  page-inline: "clamp(22px, 4.1vw, 75px)"
  section-gap: "4.0625rem"
  sidebar-width: "246px"
components:
  button: {}
  card: {}
  dialog: {}
  navigation: {}
  form: {}
  status: {}
---

# BRILL MEDIA — Design System

## Overview

### Creative North Star
An independent production control room rather than a generic marketing agency.
The signature is a concentric "signal" instrument framing an unmistakable **B.**
It references broadcast targeting and editorial operations, not an AI spark, crown,
stock photo, or bank dashboard.

### Product context and register
- **Audience:** owner/operator of Brill Team Project's content studio; later studio staff.
- **Primary task:** move campaign ideas through draft, review, and locally planned stages.
- **Markets:** Russian, Israeli and international audiences, subject to campaign-specific targeting.
- **Locales:** RU default, HE with full RTL, EN. User-authored content remains in its source language.
- **Scene:** full desktop editorial workstation and narrow Android/iPhone phone screens.
- **Register:** hybrid: cinematic overview and factual operational forms/lists.
- **Anti-references:** generic numbering (01/02/03), crown logos, confetti metrics,
  large empty gradients, fake "AI" tiles, fake analytics, and decorative stock people.
- **Token ownership/runtime mapping:** this file documents accepted token values;
  the canonical runtime implementation is styles.css root custom properties.
  Frontend components consume semantic CSS variables. Changes to tokens require
  concurrent edits here and in styles.css.

## Colors
Near-black background #0b0b0f, raised editorial surfaces #141419
and #1b1b21, warm text #f2eee8. Red #c8384c is the primary
action/signal accent; restrained gold #d3ac6c calls out editorial data.
Danger is a distinct strong red in destructive dialogs, not the primary CTA.
Focus outline is #e0c18d and remains visible on dark panels.
Muted text meets reasonable contrast via #b3abb0; avoid tiny low-contrast text
for essential actions. Status colors are accompanied by words.

## Typography
Display titles use condensed bold faces to evoke editorial posters. Controls
and dense content use local system sans faces with safe Hebrew fallbacks.
Short labels may use uppercase tracking in RU/EN; no forced text transforms
on Hebrew. Numeric values remain selectable text.

## Layout
A 246px sidebar on wide screens, with a 1400px-style content focus and
single document scrolling. At <=900px, navigation becomes a visible,
horizontally scrollable row. At <=680px, cards and forms stack, never hide
critical controls. Modal dialogs use viewport-bounded scroll and usable
touch targets. RTL reverses flow via the root document direction, except
for the Latin wordmark and language switch.

## Elevation & Depth
Border lines distinguish data areas; a restrained shadow is used for dialogs,
not every card. The hero's concentric rings are visual identity, not interactive UI.

## Shapes
Most controls have small, functional 6px corners. Cards are deliberately
squared/low-radius to reinforce a professional production desk.
Badges are pills for statuses only. The B. mark is not a crown.

## Motion & Accessibility
UI transitions are subtle, never required to understand state, and disabled
with prefers-reduced-motion. Native buttons and form controls, visible
focus indication, an initial skip link, modal focus trap, inline validation,
and explicit local-data disclosures are required. Target WCAG 2.2 AA.

## Design Critique Gates
Reject:
- Fake impressions, revenue, reach, or fabricated social posting confirmations.
- Static placeholders that look like working platform connections.
- Client-specific confidential records on a publicly accessible demo.
- Hidden mobile navigation, broken RTL, or labels remaining in another UI locale.
- Forms that suggest a server save when only localStorage exists.
