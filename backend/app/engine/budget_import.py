from __future__ import annotations
from typing import Optional
from io import BytesIO
import openpyxl

# Keyword → category mapping (checked in order; first match wins)
_KEYWORD_MAP: list[tuple[list[str], str]] = [
    (["foundation", "site work", "excavat", "concrete slab"], "Foundation"),
    (["fram"], "Framing"),
    (["roof"], "Roofing"),
    (["exterior", "siding", "window", "door", "facade"], "Exterior"),
    (["electric"], "Electrical"),
    (["plumb"], "Plumbing"),
    (["hvac", "mechanical", "heating", "cooling", "air condition"], "HVAC"),
    (["insul"], "Insulation"),
    (["drywall", "sheetrock", "gypsum"], "Drywall"),
    (["floor"], "Flooring"),
    (["kitchen", "cabinet", "appliance"], "Kitchen"),
    (["bath"], "Bathrooms"),
    (["interior finish", "trim", "paint", "millwork"], "Interior Finishes"),
    (["landscap", "yard", "grading", "irrigation"], "Landscaping"),
    (["general contractor", "gc fee", "builder fee"], "General Contractor Fee"),
    (["contingency"], "Contingency"),
]


def match_category(raw_label: str) -> tuple[Optional[str], str]:
    """Return (category, confidence) where confidence is 'high' or 'low'."""
    lower = raw_label.lower().strip()
    for keywords, category in _KEYWORD_MAP:
        if any(kw in lower for kw in keywords):
            return category, "high"
    # Exact match against default category names
    from app.models import DEFAULT_BUDGET_CATEGORIES
    for cat in DEFAULT_BUDGET_CATEGORIES:
        if cat.lower() == lower:
            return cat, "high"
    return None, "low"


def parse_excel_bytes(data: bytes) -> list[dict]:
    """
    Parse an .xlsx file and return rows as:
      [{"raw_label": str, "detected_category": str|None, "amount": float, "confidence": "high"|"low"}]

    Heuristic: first text column = labels, first numeric column = amounts.
    Skips rows where label is empty and amount is also empty. Skips header rows
    (where label is a string but amount is also a string / non-numeric).
    """
    wb = openpyxl.load_workbook(BytesIO(data), data_only=True)
    ws = wb.active

    rows_out = []
    for row in ws.iter_rows(values_only=True):
        # Find first text cell (label) and first numeric cell (amount)
        label = None
        amount = None
        for cell in row:
            if cell is None:
                continue
            if label is None and isinstance(cell, str) and cell.strip():
                label = cell.strip()
            elif amount is None and isinstance(cell, (int, float)):
                amount = float(cell)

        if amount is None:
            continue  # skip rows with no numeric value (headers, etc)

        # Allow empty labels if there's an amount
        if label is None:
            label = ""

        category, confidence = match_category(label) if label else (None, "low")
        rows_out.append({
            "raw_label": label,
            "detected_category": category,
            "amount": amount,
            "confidence": confidence,
        })

    return rows_out
