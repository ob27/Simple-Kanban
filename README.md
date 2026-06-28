# Simple AIM Kanban

A full-screen Kanban board for tracking DPK (Deliverable Package) items through a FAB (**Final As Built**) workflow. Designed to run on a large TV or Surface display in the office so the whole team can see progress at a glance.

---

## Features

- **Project Lifeline bar** — shows how far through the overall project timeline you are today, with a configurable start and end month/year
- **Progress bar** — stacked colour segments showing how many DPKs have reached each stage, relative to the total estimated count
- **6 workflow columns** — FAB Target Date Confirmed → Pre-FAB Prep → Pre-FAB Review → Post-FAB Prep → Post-FAB Review → Completions Data Release
- **Drag and drop** — reorder cards within a column, or move them between columns, using mouse, touch, or keyboard
- **Card preview** — press and hold any card to see its full text in a large overlay (useful for long DPK names)
- **Celebrations** — confetti fires when a card moves right; fireworks launch when a card reaches Completions
- **CSV import** — paste in a spreadsheet export and the board populates instantly (overwrites existing cards); rows with unrecognised statuses are silently skipped
- **Manual add / delete** — tap **+** to add a card; hover a card and click **✕** to delete it
- **Editable total** — click the pencil next to the counter to set how many DPKs exist in total, keeping the progress bar honest
- **Persists locally** — all state is saved to `localStorage`; no server or cloud account required

---

## What is FAB?

**FAB** stands for **Final As Built**. The workflow tracks DPK items as they move through the documentation and review process required to produce Final As Built asset registers, culminating in the release of completions data.

---

## Running the app

A pre-built production bundle is committed to this repo inside the `dist/` folder. You do not need Node.js installed to run it — you only need a way to serve static files over HTTP.

### Option A — Python (no install required)

Python ships with macOS and most Linux distributions.

```bash
git clone https://github.com/your-org/Simple-AIM-Kanban.git
cd "Simple AIM Kanban"

# Python 3
python3 -m http.server 8080 --directory dist
```

Then open **http://localhost:8080** in a browser.

### Option B — Node / npx (no npm install required)

```bash
git clone https://github.com/your-org/Simple-AIM-Kanban.git
cd "Simple AIM Kanban"

npx serve dist
```

Then open the URL shown in the terminal (usually **http://localhost:3000**).

> **TV / kiosk display:** run the server on a machine attached to the screen, then open the URL in a full-screen browser window (F11 on Windows, or use kiosk mode in Chrome: `chrome --kiosk http://localhost:8080`).

---

## Development setup

Only needed if you want to modify the source code.

**Prerequisites:** [Node.js](https://nodejs.org/) v18 or later (npm is bundled with Node).

```bash
# 1. Clone and enter the repo
git clone https://github.com/your-org/Simple-AIM-Kanban.git
cd "Simple AIM Kanban"

# 2. Install dependencies
npm install

# 3. Start the hot-reload dev server
npm run dev
```

Open **http://localhost:5173**. The page updates automatically as you save files.

```bash
# Type-check and produce a new production build
npm run build

# Preview the production build locally
npm run preview
```

The `dist/` folder is committed to the repo — after making changes, run `npm run build` and commit the updated `dist/` along with your source changes so other users always have a current pre-built version.

---

## CSV import format

Prepare a `.csv` file with exactly two columns:

```
DPK Number,Status
DPK 1001,FAB Target Date Confirmed
DPK 2001,Pre-FAB Asset Register Preparation
DPK 3001,Pre-FAB Asset Register Review
DPK 4001,Post-FAB Asset Register Preparation
DPK 5001,Post-FAB Asset Register Review
DPK 6001,Completions Data Release
```

| Column | Required | Notes |
|---|---|---|
| `DPK Number` | Yes | Displayed on the card. Converted to uppercase on import. |
| `Status` | Yes | Matched to a column — see mappings below. Case-insensitive, partial matches accepted. |

**Status → Column mappings**

| Status value (or substring) | Column |
|---|---|
| `FAB Target`, `Target Date Confirmed` | FAB Target Date Confirmed |
| `Pre-FAB Asset Register Prep`, `Pre FAB Prep` | Pre-FAB Asset Register Preparation |
| `Pre-FAB Asset Register Review`, `Pre FAB Review` | Pre-FAB Asset Register Review |
| `Post-FAB Asset Register Prep`, `Post FAB Prep` | Post-FAB Asset Register Preparation |
| `Post-FAB Asset Register Review`, `Post FAB Review` | Post-FAB Asset Register Review |
| `Completions`, `Data Release` | Completions Data Release |

Rows with a blank DPK Number, blank Status, or an unrecognised Status are skipped silently. The success notification reports how many rows were skipped. A sample file is included at [`test-import.csv`](test-import.csv).

> **Note:** importing a CSV overwrites **all** existing cards on the board. The total estimated count and project dates are not affected.

---

## Usage

### Importing from CSV

1. Tap the **+** button (bottom-right corner)
2. In the modal, scroll past the manual add form and click **Choose CSV file…**
3. Select your `.csv` file
4. A success notification confirms how many cards were imported and how many rows were skipped

### Adding a card manually

1. Tap the **+** button (bottom-right corner)
2. Enter the DPK number and select a column
3. Click **Add Card**

### Deleting a card

Hover over the card — a **✕** button appears in the top-right corner of the card. Click it to delete.

### Moving a card

Click and drag the card to another column or a new position within the same column. On touch screens, press and hold briefly until the card lifts, then drag.

### Viewing the full text of a card

Press and hold any card for about 0.4 seconds. A panel appears showing the full DPK number. Release to dismiss.

### Updating the total DPK estimate

Click the **pencil icon** next to the counter (e.g. `24 of 300 ✏️`), enter the new total, and press **OK** or **Enter**.

### Configuring the Project Lifeline dates

Click the **pencil icon** next to the "Project Lifeline" label. Set the start month/year and end month/year, then click **Apply**.

---

## Tech stack

| | |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| UI components | Ant Design 5 |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable |
| CSV parsing | PapaParse |
| Celebrations | canvas-confetti |
| Storage | Browser `localStorage` |

---

## Data persistence

All board state (cards, total estimated count, and project dates) is stored in `localStorage` under the key `aim_kanban_state`. It survives page refreshes and browser restarts but is scoped to the browser/device. If you need to share state across machines, export your CSV from the source spreadsheet and re-import on each device.
