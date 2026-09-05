# E-Discipline Board

A digital, editable version of the radial monthly habit tracker — click a day's
cell to mark it done, half-done, or missed, and watch a report dashboard tally
your progress.

Open `index.html` in a browser (or serve the folder with any static file
server) — no build step or dependencies required.

## Features

- **Radial habit tracker.** Each habit is a ring; each day is a wedge. Click a
  cell to cycle: empty → 🟢 done → 🟠 half done → 🔴 missed → empty.
- **Fully text-editable.** Click any label — "HABITS:", habit names,
  "OBSERVATIONS", "KEY GOALS", the month/year, the footer title, observation
  lines, and goal boxes — and type to change it.
- **1–10 habits.** Starts with 3 habit slots; add up to 10, or remove down to 1.
- **Month navigation.** Step to the next/previous month with the arrows next
  to the month label. Each month keeps its own grid, observations, and goals
  (new months start blank, carrying over your current habit names).
- **Report dashboard.** Click "Report" to see completion stats for the current
  month or cumulatively across all months, broken down per habit.
- Everything is saved automatically to your browser's local storage.

## Files

- `index.html` — page structure
- `style.css` — styling (light/dark aware)
- `app.js` — state, rendering, and interaction logic
