# House Budget Page — Design Spec

**Date:** 2026-06-17  
**Status:** Approved for implementation

---

## Overview

A standalone budget planning page where users build and compare named construction cost scenarios. Users can enter line items manually, import an Excel file from their builder, and compare any two versions side by side. Results are independent of the scenario engine for now (Phase 2 connection planned).

---

## Scope

**In scope:**
- Multiple named budget versions (create, rename, duplicate, delete)
- Pre-populated line items with editable amounts
- Excel (.xlsx) import with 2-step column mapping
- Side-by-side version comparison with delta highlighting
- Summary bar showing total, total with contingency, and down payment estimate

**Out of scope (Phase 2):**
- Connecting budget totals to the build scenario engine
- PDF export
- Sharing budgets with a contractor

---

## Data Model

### `budget_versions` table

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | cascade delete |
| name | VARCHAR(100) | e.g. "Base Plan", "Upgraded Kitchen" |
| is_baseline | BOOLEAN | true for the first/designated version |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `budget_lines` table

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| version_id | UUID FK → budget_versions | cascade delete |
| category | VARCHAR(100) | e.g. "Foundation", "Kitchen" |
| amount | NUMERIC(12,2) | user-entered, 0 is valid |
| sort_order | INTEGER | controls display order |

**Default categories** (seeded on every new version):
Foundation, Framing, Roofing, Exterior, Electrical, Plumbing, HVAC, Insulation, Drywall, Flooring, Kitchen, Bathrooms, Interior Finishes, Landscaping, General Contractor Fee, Contingency

Users can rename, add, or delete any line. Sort order is fixed at creation; no drag-to-reorder in MVP.

---

## API Design

Base path: `/api/v1/budget`

| Method | Path | Description |
|---|---|---|
| GET | `/budget/versions` | List versions (id, name, total computed from lines, is_baseline) |
| POST | `/budget/versions` | Create blank version seeded with defaults |
| PUT | `/budget/versions/:id` | Rename or toggle is_baseline |
| DELETE | `/budget/versions/:id` | Delete version + lines (blocked if only version) |
| POST | `/budget/versions/:id/duplicate` | Copy version with new name |
| GET | `/budget/versions/:id/lines` | Get all line items |
| PUT | `/budget/versions/:id/lines` | Bulk-replace all lines |
| POST | `/budget/import` | Parse .xlsx → return rows with auto-detected category matches |
| POST | `/budget/import/confirm` | Accept confirmed mapping → create new version |

### Import response shape (`POST /budget/import`)
```json
{
  "rows": [
    { "raw_label": "Site Work / Foundation", "detected_category": "Foundation", "amount": 68500, "confidence": "high" },
    { "raw_label": "Appliances & Cabinetry", "detected_category": null, "amount": 89000, "confidence": "low" }
  ],
  "unmatched_count": 2
}
```

Confidence is `high` (auto-map, green ✓) or `low` (needs review, amber ?). No data is written until `/import/confirm` is called.

---

## Frontend

### Routes

| Path | Description |
|---|---|
| `/budget` | Main page |
| `/budget/import` | Upload + mapping flow |

### Components

```
components/budget/
  VersionCard.tsx          — summary card (name, total, delta vs baseline)
  VersionCardRow.tsx       — horizontal scrollable row of all cards
  LineItemTable.tsx        — editable line-item table for selected version
  BudgetSummaryBar.tsx     — footer: total / +contingency / down payment
  CompareDrawer.tsx        — slide-up drawer, version pickers, delta table
  ImportUpload.tsx         — drag-and-drop .xlsx step
  ImportMapper.tsx         — column mapping table with confidence indicators
```

### Page layout (`/budget`)

1. **Header row:** "House Budget" title + "⬆ Import Excel" button + "+ New Version" button
2. **Version card row:** one card per version; selected version has indigo border; each card shows name, total, delta vs baseline, Edit/Duplicate actions
3. **Line item detail:** full editable table for the selected version
4. **Summary bar:** total, total with contingency (from profile assumptions, default 15%), estimated down payment (20% × total with contingency)
5. **"Compare versions" button:** opens `CompareDrawer`

### New Version menu options
Clicking "+ New Version" opens a small inline menu (3 options):
- Start from template (16 default categories at $0)
- Duplicate existing version (shows version picker)
- Import from Excel (→ navigates to `/budget/import`)

### Compare Drawer

- Slides up from bottom over dimmed page
- Two dropdowns to select versions A and B
- Table shows all categories; changed lines highlighted (red = more expensive, green = savings); unchanged lines shown but not highlighted
- Footer: totals for A, B, and net difference (with and without contingency)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Import: unrecognized file format | Inline error on upload step, do not proceed |
| Import: no numeric column found | Prompt user to manually identify amount column |
| Duplicate version name | Append "(2)" automatically |
| Delete only remaining version | Block with message; must have at least one version |
| Delete baseline version | Require user to designate another version as baseline first |
| Line item amount blank or 0 | Allowed — shown as $0, treated as TBD |
| Contingency % not set | Fall back to 15% from profile assumptions |

---

## Contingency Display

The summary bar shows two totals:
- **Line items total** — sum of all entered amounts
- **With contingency** — total × (1 + contingency_pct), where `contingency_pct` comes from the user's profile assumptions (default 15%), shown read-only with a link to Profile to change it

---

## Out of Scope Notes

- No connection to the build scenario engine in this phase. The budget total is display-only and does not feed into Phase 1/2 loan calculations.
- No drag-to-reorder on line items.
- No PDF/CSV export.
- Excel import supports `.xlsx` only (not `.xls` or `.csv`) in MVP.
