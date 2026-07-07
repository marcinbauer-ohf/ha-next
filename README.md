# Home Assistant Next.js Dashboard

A touch-friendly Home Assistant dashboard built with Next.js, featuring real-time WebSocket connectivity, room-based navigation, entity cards, pull-to-reveal panels, an idle screensaver, and a responsive mobile/desktop layout.

## Screenshots

### Desktop

![Desktop screenshot](public/screenshots/desktop.png)

### Mobile

<p align="center">
  <img src="public/screenshots/mobile.png" alt="Mobile screenshot" width="390" />
</p>

## Getting Started

### Prerequisites

- Node.js 18+
- A running Home Assistant instance
- A Home Assistant Long-Lived Access Token

### Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser. On first launch you'll see a setup screen asking for your **Home Assistant URL** and a **Long-Lived Access Token**. These are saved in your browser's localStorage — no server-side config needed.

To generate a Long-Lived Access Token, open your Home Assistant instance and go to **Profile → Security → Long-Lived Access Tokens**.

To reset stored credentials, scroll to the **Debug** section on the dashboard and tap **Clear credentials**.

## Debugging & keyboard shortcuts

Press <kbd>?</kbd> anywhere in the app for the shortcut overlay; the same reference lives in **Settings → Prototype & Debug Tools → Keyboard shortcuts**. The registry that drives the overlay, the tooltips, and the handlers is [`src/lib/keyboardShortcuts.ts`](src/lib/keyboardShortcuts.ts) — add new bindings there first.

`Mod` is the platform command modifier: <kbd>⌘</kbd> on macOS, <kbd>Ctrl</kbd> on Windows/Linux. Single letter keys never fire while a text field is focused or a dialog is open. Mac-reserved chords (<kbd>⌘H</kbd>, <kbd>⌘,</kbd>) are deliberately not used as primary bindings.

### Global

| Shortcut | Action |
| --- | --- |
| <kbd>Mod</kbd>+<kbd>K</kbd> or <kbd>/</kbd> | Search & command palette |
| <kbd>A</kbd> | Toggle assistant |
| <kbd>H</kbd> | Go to home dashboard |
| <kbd>S</kbd> | Open settings |
| <kbd>?</kbd> | Show keyboard shortcuts overlay |
| <kbd>Mod</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Toggle light / dark mode |
| <kbd>Mod</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> | Cycle theme |
| <kbd>Mod</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> | Cycle typeface |
| <kbd>Mod</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Toggle screensaver |
| <kbd>Esc</kbd> | Close dialog or overlay |

### Home dashboard

| Shortcut | Action |
| --- | --- |
| <kbd>E</kbd> | Toggle edit mode |
| <kbd>G</kbd> | Cycle grouping (areas → types → categories) |
| <kbd>M</kbd> | Toggle floor plan view (when a floor plan exists) |
| <kbd>1</kbd>–<kbd>9</kbd> / <kbd>0</kbd> | Switch floor / show all floors |
| <kbd>Mod</kbd>+<kbd>\</kbd> | Toggle immersive mode |

### Settings

| Shortcut | Action |
| --- | --- |
| <kbd>[</kbd> / <kbd>]</kbd> | Previous / next section (two-column workspace) |
| <kbd>D</kbd> | Open Prototype & Debug Tools |

### Debug

Safe toggles have their own keys. Destructive resets stay behind the command palette (<kbd>Mod</kbd>+<kbd>K</kbd> → search) so a stray keypress can't wipe your customisations.

| Shortcut | Action |
| --- | --- |
| <kbd>B</kbd> | Toggle debug badges |
| <kbd>L</kbd> | Toggle mock latency |
| <kbd>Mod</kbd>+<kbd>K</kbd> → search | Prototype reset (wipe & reload) |
| <kbd>Mod</kbd>+<kbd>K</kbd> → search | Other debug toggles; more resets in **Settings → Prototype & Debug Tools → Reset & restore** |

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
