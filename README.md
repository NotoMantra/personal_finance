# PFOS Widgets (Local-only Notion embeds)

A set of blue/black finance widgets designed to be embedded in Notion and run entirely in the user’s browser.

## Widgets
- `/kpi/` — KPI dashboard (cards, trend, top categories)
- `/transactions/` — Transactions ledger (add/edit/delete)
- `/budgets/` — Budget table + overspend alerts

## Data + privacy
- Stores data locally in the browser using IndexedDB (`pfos` database).
- No backend, no analytics, no accounts.

## Deploy on GitHub Pages
1) Create a GitHub repo and upload the contents of this folder.
2) In GitHub → Settings → Pages:
   - Source: `Deploy from a branch`
   - Branch: `main` (or `master`) + `/root`
3) Your URLs will look like:
   - `https://<username>.github.io/<repo>/kpi/`
   - `https://<username>.github.io/<repo>/transactions/`
   - `https://<username>.github.io/<repo>/budgets/`

## Embed in Notion
In Notion:
- Type `/embed`
- Paste the widget URL (from above)

## Notes
- Widgets sync live on the same origin using BroadcastChannel (with a storage fallback).
- Use the “Load demo data” button to populate sample rows.
