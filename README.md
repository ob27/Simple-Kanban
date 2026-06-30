# Simple Kanban by Oestler

A multi-board Kanban platform with real-time sync, invite-based sharing, progress tracking, and per-card notes and comments. Deployed at [oestler.com/simple-kanban](https://oestler.com/simple-kanban).

---

## Features

- **Multiple boards** — each user can own or be invited to any number of kanbans
- **Real-time sync** — all state in Firestore; changes appear instantly across devices
- **Project Lifeline** — timeline bar showing how far through the project you are today
- **Progress bar** — stacked colour segments per column, driven by actual card counts
- **Groomed % / Complete %** — assign Backlog, Groomed, and Done roles to columns in Settings
- **Drag and drop** — mouse, touch, and keyboard, with confetti when cards move forward
- **Card notes + comments** — double-tap or double-click any card to open a notes drawer and threaded comments with dicebear avatars
- **Card long-press preview** — hold a card to see its full title in a centred overlay
- **Invite sharing** — share a link; recipients sign in or create an account and auto-join
- **Access management** — owners can add co-owners, remove members, and manage roles from the gallery
- **Per-kanban settings** — column titles, column colours, card font size, timeline dates, estimated total, progress bar + lifeline toggles
- **Password recovery** — Firebase sends a reset email with no additional configuration
- **Responsive layout** — tablet and mobile breakpoints; board scrolls horizontally on small screens
- **CSV import** — bulk-import cards from a spreadsheet export

---

## Tech stack

| | |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| UI components | Ant Design 5 |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable |
| Backend / auth | Firebase (Auth + Firestore + Hosting) |
| Avatars | DiceBear (notionists-neutral, seeded from email) |
| Celebrations | canvas-confetti |

---

## Security model

The Firebase client config (`apiKey`, `appId`, etc.) in `src/firebase.ts` is **intentionally public** — these are client-side identifiers required by the Firebase SDK and end up in the served JavaScript bundle regardless. Security is enforced by:

1. **Firestore security rules** (`/users/tom/oestler/firestore.rules`) — every read/write is gated by auth uid and ownership checks
2. **Firebase Authentication** — no anonymous access; email+password accounts only
3. **Firebase App Check** (reCAPTCHA v3, production only) — prevents automated abuse

**What is NOT safe to commit:** Firebase Admin SDK service account JSON files, server-side API keys, and any `.env` files containing secrets. None of those exist in this project. The `.gitignore` already excludes `.env*` files.

---

## Deploying your own instance

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A Firebase project — create one at [console.firebase.google.com](https://console.firebase.google.com)

### 2. Firebase project setup

In the Firebase console for your project:

**Authentication**
- Enable **Email/Password** sign-in (Authentication → Sign-in method)

**Firestore**
- Create a Firestore database in production mode (Database → Create database)
- Deploy the security rules (see step 5)

**Hosting**
- Register a web app (Project settings → Add app → Web)
- Note the config values — you'll paste them into `src/firebase.ts`

**App Check** (optional but recommended for production)
- Register a reCAPTCHA v3 site key at [google.com/recaptcha](https://www.google.com/recaptcha)
- Enable App Check in the Firebase console (App Check → Apps → Register)

### 3. Update the Firebase config

Edit `src/firebase.ts` and replace the config object with your own project's values:

```ts
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID',   // optional
};
```

If using App Check, also replace the reCAPTCHA site key:

```ts
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
  ...
});
```

If you're not using App Check, remove the `initializeAppCheck` block.

### 4. Update Vite config

Edit `vite.config.ts` to set your own `base` path and `outDir`:

```ts
export default defineConfig({
  plugins: [react()],
  base: '/simple-kanban/',        // URL path where the app will be served
  build: {
    outDir: './dist',             // local output directory
    emptyOutDir: true,
  },
})
```

### 5. Deploy Firestore security rules

The rules file lives at `/users/tom/oestler/firestore.rules` in this repo's parent project. Copy the relevant `kanbans` and `kanbanInvites` match blocks into your own `firestore.rules` file and deploy:

```bash
firebase deploy --only firestore:rules
```

The key rules to include:

```
match /kanbans/{kanbanId} {
  // Owners and co-owners have full access
  // Members can update cards only
  // Invite join allows adding self to memberIds + memberEmails
}

match /kanbanInvites/{token} {
  allow read: if true;   // public — tokens are random UUIDs; content is not sensitive
  allow create, update: if request.auth != null
                        && request.resource.data.ownerId == request.auth.uid;
  allow delete: if request.auth != null
                && resource.data.ownerId == request.auth.uid;
}
```

### 6. Update Firebase Hosting rewrites

If you're hosting at a sub-path (e.g. `/simple-kanban`), add rewrite rules to your `firebase.json`:

```json
{
  "hosting": {
    "rewrites": [
      { "source": "/simple-kanban",    "destination": "/simple-kanban/index.html" },
      { "source": "/simple-kanban/**", "destination": "/simple-kanban/index.html" }
    ]
  }
}
```

If hosting at the root path, use `"source": "**"` instead.

### 7. Build and deploy

```bash
# Install dependencies
npm install

# Build the app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build
npm run preview    # preview the production build locally
```

---

## Invite flow

1. Open a kanban → Settings → copy the invite link
2. Share the link with the person you want to invite
3. They open the link, sign in (or create an account), and are automatically added as a member
4. Invite tokens are UUIDs; regenerate from Settings to invalidate any existing links

---

## CSV import format

Cards can be bulk-imported from a CSV with the following columns:

```
Title,Status,Pill
DPK 1001,FAB Target Date Confirmed,14 Jul 27
DPK 2001,Pre-FAB Asset Register Preparation,High priority
DPK 3001,Pre-FAB Asset Register Review,
```

| Column | Required | Notes |
|---|---|---|
| `Title` (or `DPK Number`) | Yes | Displayed as the card title |
| `Status` | Yes | Matched case-insensitively to a column label; unrecognised rows are skipped |
| `Pill` (or `Pill Value`) | No | Short tag displayed as a pill below the title (e.g. a date, priority, or reference) |

A sample file is included at [`test-import.csv`](test-import.csv).

> Importing a CSV **replaces all existing cards** on the board. Notes, comments, and settings are not affected.

---

## Column roles

In Settings → Column roles, assign three special roles:

| Role | Purpose |
|---|---|
| **Backlog** | Cards here count as "not yet groomed"; optionally used as the estimated total |
| **Groomed** | Cards at or past this column count toward groomed % |
| **Done** | Cards in this column count toward complete % |

These drive the `groomed %` and `complete %` figures shown in the progress bar legend.
