# House Budget Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/budget` page where users create and compare named construction cost budget versions, with Excel import from a builder.

**Architecture:** FastAPI backend adds two new tables (`budget_versions`, `budget_lines`) and a budget router with 9 endpoints plus a two-step import flow. Next.js frontend adds a `/budget` page and `/budget/import` page backed by 7 new components. Excel parsing uses `openpyxl` with keyword-based fuzzy category matching. No connection to the existing scenario engine.

**Tech Stack:** Python/FastAPI/SQLAlchemy/openpyxl, Next.js 14/TypeScript/Tailwind, react-hook-form

---

## File Map

**Create (backend):**
- `backend/app/engine/budget_import.py` — Excel parser + fuzzy category matcher
- `backend/app/routers/budget.py` — all 9 budget endpoints
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — test client + auth fixtures
- `backend/tests/test_budget_import.py` — import parser tests
- `backend/tests/test_budget.py` — API endpoint tests

**Modify (backend):**
- `backend/app/models.py` — add BudgetVersion, BudgetLine
- `backend/requirements.txt` — add openpyxl, pytest, httpx
- `backend/main.py` — register budget router

**Create (frontend):**
- `frontend/app/budget/page.tsx`
- `frontend/app/budget/import/page.tsx`
- `frontend/components/budget/VersionCard.tsx`
- `frontend/components/budget/VersionCardRow.tsx`
- `frontend/components/budget/LineItemTable.tsx`
- `frontend/components/budget/BudgetSummaryBar.tsx`
- `frontend/components/budget/CompareDrawer.tsx`
- `frontend/components/budget/ImportUpload.tsx`
- `frontend/components/budget/ImportMapper.tsx`

**Modify (frontend):**
- `frontend/lib/api.ts` — add budget API methods
- `frontend/components/ui/Nav.tsx` — add Budget link

---

## Shared type contract

These shapes are used across backend responses and frontend types — defined once here, referenced throughout.

**BudgetVersionSummary** (list endpoint response item):
```json
{ "id": "uuid", "name": "Base Plan", "is_baseline": true, "total": 850000.0, "created_at": "2026-06-17T12:00:00Z" }
```

**BudgetLineItem** (lines endpoint response item):
```json
{ "id": "uuid", "category": "Foundation", "amount": 65000.0, "sort_order": 0 }
```

**ImportRow** (import parse response item):
```json
{ "raw_label": "Site Work / Foundation", "detected_category": "Foundation", "amount": 68500.0, "confidence": "high" }
```

**Default categories** (16, used in seeding and fuzzy matching):
```
Foundation, Framing, Roofing, Exterior, Electrical, Plumbing, HVAC,
Insulation, Drywall, Flooring, Kitchen, Bathrooms, Interior Finishes,
Landscaping, General Contractor Fee, Contingency
```

---

## Task 1: Install openpyxl and test dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add deps to requirements.txt**

Replace contents of `backend/requirements.txt` with:
```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy==2.0.30
python-jose[cryptography]==3.3.0
bcrypt>=4.0.0
pydantic==2.7.1
pydantic-settings==2.3.0
python-multipart==0.0.9
plaid-python==14.2.0
python-dotenv==1.0.1
openpyxl==3.1.2
pytest==8.2.2
httpx==0.27.0
```

- [ ] **Step 2: Install**

```bash
cd backend && pip3 install openpyxl==3.1.2 pytest==8.2.2 httpx==0.27.0 -q
```

Expected: no errors

- [ ] **Step 3: Verify**

```bash
python3 -c "import openpyxl, pytest, httpx; print('ok')"
```

Expected: `ok`

---

## Task 2: Add BudgetVersion and BudgetLine models

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/__init__.py` (empty file):
```bash
mkdir -p backend/tests && touch backend/tests/__init__.py
```

Create `backend/tests/conftest.py`:
```python
import os
import pytest
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

TEST_DB_URL = "sqlite:///./test_budget.db"
os.environ.setdefault("DATABASE_URL", TEST_DB_URL)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

engine_test = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    from app.db.database import Base
    Base.metadata.drop_all(bind=engine_test)
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def client(setup_db):
    from main import app
    from app.db.database import get_db
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client):
    client.post("/api/v1/auth/signup", json={"email": "budget@test.com", "password": "testpass123"})
    r = client.post("/api/v1/auth/login", json={"email": "budget@test.com", "password": "testpass123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
```

Create `backend/tests/test_budget.py`:
```python
def test_budget_models_importable():
    from app.models import BudgetVersion, BudgetLine
    assert BudgetVersion.__tablename__ == "budget_versions"
    assert BudgetLine.__tablename__ == "budget_lines"
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && python3 -m pytest tests/test_budget.py::test_budget_models_importable -v
```

Expected: `ImportError` (models don't exist yet)

- [ ] **Step 3: Add models to `backend/app/models.py`**

Append to the end of `backend/app/models.py`:
```python

DEFAULT_BUDGET_CATEGORIES = [
    "Foundation", "Framing", "Roofing", "Exterior", "Electrical",
    "Plumbing", "HVAC", "Insulation", "Drywall", "Flooring",
    "Kitchen", "Bathrooms", "Interior Finishes", "Landscaping",
    "General Contractor Fee", "Contingency",
]


class BudgetVersion(Base):
    __tablename__ = "budget_versions"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    is_baseline = Column(Integer, default=0)  # 1 = true
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lines = relationship("BudgetLine", back_populates="version", cascade="all, delete-orphan")


class BudgetLine(Base):
    __tablename__ = "budget_lines"
    id = Column(String, primary_key=True, default=gen_uuid)
    version_id = Column(String, ForeignKey("budget_versions.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Float, default=0.0)
    sort_order = Column(Integer, default=0)

    version = relationship("BudgetVersion", back_populates="lines")
```

- [ ] **Step 4: Run — expect pass**

```bash
cd backend && python3 -m pytest tests/test_budget.py::test_budget_models_importable -v
```

Expected: `PASSED`

- [ ] **Step 5: Commit**

```bash
cd backend && git add app/models.py requirements.txt tests/ && git commit -m "feat: add BudgetVersion and BudgetLine models"
```

---

## Task 3: Budget import engine (fuzzy category matcher)

**Files:**
- Create: `backend/app/engine/budget_import.py`
- Create: `backend/tests/test_budget_import.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_budget_import.py`:
```python
from app.engine.budget_import import match_category, parse_excel_bytes
from io import BytesIO
import openpyxl


def make_xlsx(rows: list) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_match_known_categories():
    assert match_category("Site Work / Foundation") == ("Foundation", "high")
    assert match_category("Wood Framing") == ("Framing", "high")
    assert match_category("Roof System") == ("Roofing", "high")
    assert match_category("Kitchen Cabinets & Appliances") == ("Kitchen", "high")
    assert match_category("HVAC System") == ("HVAC", "high")
    assert match_category("General Contractor Fee") == ("General Contractor Fee", "high")


def test_match_unknown_returns_low():
    category, confidence = match_category("Miscellaneous Custom Work")
    assert confidence == "low"
    assert category is None


def test_parse_excel_two_columns():
    data = make_xlsx([
        ["Category", "Cost"],
        ["Foundation", 68500],
        ["Framing", 118000],
        ["Unknown Trade", 25000],
    ])
    rows = parse_excel_bytes(data)
    assert len(rows) == 3
    assert rows[0]["raw_label"] == "Foundation"
    assert rows[0]["amount"] == 68500.0
    assert rows[0]["detected_category"] == "Foundation"
    assert rows[0]["confidence"] == "high"
    assert rows[2]["confidence"] == "low"
    assert rows[2]["detected_category"] is None


def test_parse_excel_skips_header_row():
    data = make_xlsx([
        ["Item", "Amount"],
        ["Roofing", 55000],
    ])
    rows = parse_excel_bytes(data)
    assert len(rows) == 1
    assert rows[0]["raw_label"] == "Roofing"


def test_parse_excel_skips_zero_amount_rows():
    data = make_xlsx([
        ["Category", "Cost"],
        ["Framing", 120000],
        ["", 0],
        ["Electrical", 0],
    ])
    rows = parse_excel_bytes(data)
    # Zero amount rows are included (spec says $0 is valid)
    assert len(rows) == 3
```

- [ ] **Step 2: Run — expect failures**

```bash
cd backend && python3 -m pytest tests/test_budget_import.py -v
```

Expected: all fail with `ModuleNotFoundError`

- [ ] **Step 3: Create `backend/app/engine/budget_import.py`**

```python
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
    Skips rows where label is empty. Skips header rows (where label is a string
    but amount is also a string / non-numeric).
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

        if label is None:
            continue  # skip empty rows
        if amount is None:
            continue  # skip header-only rows with no numeric value

        category, confidence = match_category(label)
        rows_out.append({
            "raw_label": label,
            "detected_category": category,
            "amount": amount,
            "confidence": confidence,
        })

    return rows_out
```

- [ ] **Step 4: Run — expect all pass**

```bash
cd backend && python3 -m pytest tests/test_budget_import.py -v
```

Expected: all 5 tests `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/engine/budget_import.py backend/tests/test_budget_import.py && git commit -m "feat: add Excel budget import parser with fuzzy category matching"
```

---

## Task 4: Budget router — versions CRUD + lines endpoints

**Files:**
- Create: `backend/app/routers/budget.py`
- Modify: `backend/tests/test_budget.py`

- [ ] **Step 1: Write failing tests — append to `backend/tests/test_budget.py`**

```python
def test_list_versions_empty(client, auth_headers):
    r = client.get("/api/v1/budget/versions", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_create_version_seeds_defaults(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Base Plan"}, headers=auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Base Plan"
    assert body["is_baseline"] is True
    assert body["total"] == 0.0
    # Lines should be seeded
    lines_r = client.get(f"/api/v1/budget/versions/{body['id']}/lines", headers=auth_headers)
    assert lines_r.status_code == 200
    categories = [l["category"] for l in lines_r.json()]
    assert "Foundation" in categories
    assert "Kitchen" in categories
    assert len(categories) == 16


def test_second_version_not_baseline(client, auth_headers):
    client.post("/api/v1/budget/versions", json={"name": "V1"}, headers=auth_headers)
    r = client.post("/api/v1/budget/versions", json={"name": "V2"}, headers=auth_headers)
    assert r.json()["is_baseline"] is False


def test_bulk_update_lines(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Test"}, headers=auth_headers)
    version_id = r.json()["id"]
    lines = client.get(f"/api/v1/budget/versions/{version_id}/lines", headers=auth_headers).json()
    # Update Foundation to 70000
    for line in lines:
        if line["category"] == "Foundation":
            line["amount"] = 70000.0
    update_r = client.put(
        f"/api/v1/budget/versions/{version_id}/lines",
        json=lines,
        headers=auth_headers,
    )
    assert update_r.status_code == 200
    # Total should now reflect
    versions_r = client.get("/api/v1/budget/versions", headers=auth_headers)
    v = next(v for v in versions_r.json() if v["id"] == version_id)
    assert v["total"] == 70000.0


def test_duplicate_version(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Original"}, headers=auth_headers)
    vid = r.json()["id"]
    # Update a line
    lines = client.get(f"/api/v1/budget/versions/{vid}/lines", headers=auth_headers).json()
    lines[0]["amount"] = 99000.0
    client.put(f"/api/v1/budget/versions/{vid}/lines", json=lines, headers=auth_headers)
    # Duplicate
    dup_r = client.post(f"/api/v1/budget/versions/{vid}/duplicate", headers=auth_headers)
    assert dup_r.status_code == 201
    dup_id = dup_r.json()["id"]
    dup_lines = client.get(f"/api/v1/budget/versions/{dup_id}/lines", headers=auth_headers).json()
    assert dup_lines[0]["amount"] == 99000.0


def test_delete_only_version_blocked(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Only"}, headers=auth_headers)
    vid = r.json()["id"]
    del_r = client.delete(f"/api/v1/budget/versions/{vid}", headers=auth_headers)
    assert del_r.status_code == 400


def test_rename_version(client, auth_headers):
    r = client.post("/api/v1/budget/versions", json={"name": "Old Name"}, headers=auth_headers)
    vid = r.json()["id"]
    rename_r = client.put(
        f"/api/v1/budget/versions/{vid}",
        json={"name": "New Name"},
        headers=auth_headers,
    )
    assert rename_r.status_code == 200
    assert rename_r.json()["name"] == "New Name"
```

- [ ] **Step 2: Run — expect failures**

```bash
cd backend && python3 -m pytest tests/test_budget.py -v
```

Expected: first test passes (models importable), rest fail with 404

- [ ] **Step 3: Create `backend/app/routers/budget.py`**

```python
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db.database import get_db
from .. import models
from ..auth import get_current_user
from ..models import DEFAULT_BUDGET_CATEGORIES

router = APIRouter(prefix="/budget", tags=["budget"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class VersionCreate(BaseModel):
    name: str


class VersionUpdate(BaseModel):
    name: Optional[str] = None
    is_baseline: Optional[bool] = None


class LineIn(BaseModel):
    id: Optional[str] = None
    category: str
    amount: float = 0.0
    sort_order: int = 0


class ImportConfirmRow(BaseModel):
    raw_label: str
    category: str
    amount: float


class ImportConfirmRequest(BaseModel):
    name: str
    rows: List[ImportConfirmRow]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _version_total(version_id: str, db: Session) -> float:
    result = db.query(func.sum(models.BudgetLine.amount)).filter(
        models.BudgetLine.version_id == version_id
    ).scalar()
    return round(float(result or 0), 2)


def _version_dict(v: models.BudgetVersion, db: Session) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "is_baseline": bool(v.is_baseline),
        "total": _version_total(v.id, db),
        "created_at": v.created_at.isoformat(),
    }


def _seed_lines(version_id: str, db: Session):
    for i, cat in enumerate(DEFAULT_BUDGET_CATEGORIES):
        db.add(models.BudgetLine(
            id=str(uuid.uuid4()),
            version_id=version_id,
            category=cat,
            amount=0.0,
            sort_order=i,
        ))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/versions")
def list_versions(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    versions = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.user_id == user.id
    ).order_by(models.BudgetVersion.created_at).all()
    return [_version_dict(v, db) for v in versions]


@router.post("/versions", status_code=201)
def create_version(
    req: VersionCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_count = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.user_id == user.id
    ).count()
    v = models.BudgetVersion(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=req.name,
        is_baseline=1 if existing_count == 0 else 0,
    )
    db.add(v)
    db.flush()
    _seed_lines(v.id, db)
    db.commit()
    return _version_dict(v, db)


@router.put("/versions/{version_id}")
def update_version(
    version_id: str,
    req: VersionUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.id == version_id,
        models.BudgetVersion.user_id == user.id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    if req.name is not None:
        v.name = req.name
    if req.is_baseline is not None:
        v.is_baseline = 1 if req.is_baseline else 0
    db.commit()
    return _version_dict(v, db)


@router.delete("/versions/{version_id}")
def delete_version(
    version_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.user_id == user.id
    ).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only budget version")
    v = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.id == version_id,
        models.BudgetVersion.user_id == user.id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    db.delete(v)
    db.commit()
    return {"ok": True}


@router.post("/versions/{version_id}/duplicate", status_code=201)
def duplicate_version(
    version_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    src = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.id == version_id,
        models.BudgetVersion.user_id == user.id,
    ).first()
    if not src:
        raise HTTPException(status_code=404, detail="Version not found")

    # Auto-suffix name
    base_name = src.name
    existing_names = {
        v.name for v in db.query(models.BudgetVersion).filter(
            models.BudgetVersion.user_id == user.id
        ).all()
    }
    new_name = f"{base_name} (2)"
    counter = 2
    while new_name in existing_names:
        counter += 1
        new_name = f"{base_name} ({counter})"

    new_v = models.BudgetVersion(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=new_name,
        is_baseline=0,
    )
    db.add(new_v)
    db.flush()

    for line in src.lines:
        db.add(models.BudgetLine(
            id=str(uuid.uuid4()),
            version_id=new_v.id,
            category=line.category,
            amount=line.amount,
            sort_order=line.sort_order,
        ))
    db.commit()
    return _version_dict(new_v, db)


@router.get("/versions/{version_id}/lines")
def get_lines(
    version_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.id == version_id,
        models.BudgetVersion.user_id == user.id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    lines = sorted(v.lines, key=lambda l: l.sort_order)
    return [{"id": l.id, "category": l.category, "amount": l.amount, "sort_order": l.sort_order} for l in lines]


@router.put("/versions/{version_id}/lines")
def update_lines(
    version_id: str,
    lines: List[LineIn],
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.query(models.BudgetVersion).filter(
        models.BudgetVersion.id == version_id,
        models.BudgetVersion.user_id == user.id,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")

    # Delete all existing lines and replace
    db.query(models.BudgetLine).filter(models.BudgetLine.version_id == version_id).delete()
    for i, line in enumerate(lines):
        db.add(models.BudgetLine(
            id=str(uuid.uuid4()),
            version_id=version_id,
            category=line.category,
            amount=line.amount,
            sort_order=line.sort_order if line.sort_order else i,
        ))
    db.commit()
    return {"ok": True, "total": _version_total(version_id, db)}


@router.post("/import")
async def parse_import(
    file: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")
    data = await file.read()
    try:
        from ..engine.budget_import import parse_excel_bytes
        rows = parse_excel_bytes(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")
    unmatched = sum(1 for r in rows if r["confidence"] == "low")
    return {"rows": rows, "unmatched_count": unmatched}


@router.post("/import/confirm", status_code=201)
def confirm_import(
    req: ImportConfirmRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = models.BudgetVersion(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=req.name,
        is_baseline=0,
    )
    db.add(v)
    db.flush()
    for i, row in enumerate(req.rows):
        db.add(models.BudgetLine(
            id=str(uuid.uuid4()),
            version_id=v.id,
            category=row.category,
            amount=row.amount,
            sort_order=i,
        ))
    db.commit()
    return _version_dict(v, db)
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && python3 -m pytest tests/test_budget.py -v
```

Expected: all 8 tests `PASSED`

- [ ] **Step 5: Register router in `backend/main.py`**

Add to the imports at the top:
```python
from app.routers import budget
```

Add after the other `include_router` calls:
```python
app.include_router(budget.router, prefix="/api/v1")
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/budget.py backend/tests/test_budget.py backend/main.py && git commit -m "feat: add budget router with versions CRUD, lines, and import endpoints"
```

---

## Task 5: Frontend — API client + Nav

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/ui/Nav.tsx`

- [ ] **Step 1: Add budget types and methods to `frontend/lib/api.ts`**

At the bottom of the `api` object (before the closing `};`), add:

```typescript
  budget: {
    listVersions: () => request<BudgetVersionSummary[]>("/budget/versions"),
    createVersion: (name: string) =>
      request<BudgetVersionSummary>("/budget/versions", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    updateVersion: (id: string, data: { name?: string; is_baseline?: boolean }) =>
      request<BudgetVersionSummary>(`/budget/versions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteVersion: (id: string) =>
      request<{ ok: boolean }>(`/budget/versions/${id}`, { method: "DELETE" }),
    duplicateVersion: (id: string) =>
      request<BudgetVersionSummary>(`/budget/versions/${id}/duplicate`, { method: "POST" }),
    getLines: (id: string) => request<BudgetLineItem[]>(`/budget/versions/${id}/lines`),
    updateLines: (id: string, lines: BudgetLineItem[]) =>
      request<{ ok: boolean; total: number }>(`/budget/versions/${id}/lines`, {
        method: "PUT",
        body: JSON.stringify(lines),
      }),
    parseImport: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`${BASE}/budget/import`, { method: "POST", headers, body: form })
        .then((r) => r.json()) as Promise<{ rows: ImportRow[]; unmatched_count: number }>;
    },
    confirmImport: (name: string, rows: ImportRow[]) =>
      request<BudgetVersionSummary>("/budget/import/confirm", {
        method: "POST",
        body: JSON.stringify({ name, rows: rows.map(r => ({ raw_label: r.raw_label, category: r.detected_category ?? r.raw_label, amount: r.amount })) }),
      }),
  },
```

Add these interfaces at the bottom of `frontend/lib/api.ts` (after the other interfaces):

```typescript
export interface BudgetVersionSummary {
  id: string;
  name: string;
  is_baseline: boolean;
  total: number;
  created_at: string;
}

export interface BudgetLineItem {
  id: string;
  category: string;
  amount: number;
  sort_order: number;
}

export interface ImportRow {
  raw_label: string;
  detected_category: string | null;
  amount: number;
  confidence: "high" | "low";
}
```

- [ ] **Step 2: Add Budget to Nav**

In `frontend/components/ui/Nav.tsx`, update the `links` array:

```typescript
const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scenarios/new", label: "New Scenario" },
  { href: "/budget", label: "Budget" },
  { href: "/retirement", label: "Retirement" },
  { href: "/profile", label: "Profile" },
];
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts frontend/components/ui/Nav.tsx && git commit -m "feat: add budget API client methods and nav link"
```

---

## Task 6: Frontend — VersionCard and VersionCardRow

**Files:**
- Create: `frontend/components/budget/VersionCard.tsx`
- Create: `frontend/components/budget/VersionCardRow.tsx`

- [ ] **Step 1: Create `frontend/components/budget/VersionCard.tsx`**

```typescript
"use client";
import { BudgetVersionSummary, api } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface Props {
  version: BudgetVersionSummary;
  baseline: BudgetVersionSummary | null;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export default function VersionCard({
  version,
  baseline,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onRename,
}: Props) {
  const delta = baseline && !version.is_baseline ? version.total - baseline.total : null;

  function handleRename() {
    const name = window.prompt("Rename version:", version.name);
    if (name && name.trim() && name !== version.name) onRename(name.trim());
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl p-4 min-w-[160px] cursor-pointer transition-all ${
        isSelected
          ? "border-2 border-indigo-500 bg-indigo-50"
          : "border border-gray-200 bg-white hover:border-indigo-300"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
          isSelected ? "text-indigo-600" : "text-gray-500"
        }`}
      >
        {version.name}
        {version.is_baseline && (
          <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
            baseline
          </span>
        )}
      </p>
      <p className="text-xl font-bold text-gray-900">{fmt$$(version.total)}</p>
      {delta !== null && (
        <p className={`text-xs mt-1 font-medium ${delta > 0 ? "text-red-500" : delta < 0 ? "text-green-600" : "text-gray-400"}`}>
          {delta > 0 ? `↑ ${fmt$$(delta)}` : delta < 0 ? `↓ ${fmt$$(Math.abs(delta))}` : "same as baseline"}
        </p>
      )}
      <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleRename}
          className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50"
        >
          Rename
        </button>
        <button
          onClick={onDuplicate}
          className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-50"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] border border-red-100 rounded px-1.5 py-0.5 text-red-400 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/components/budget/VersionCardRow.tsx`**

```typescript
"use client";
import { useRouter } from "next/navigation";
import { BudgetVersionSummary } from "@/lib/api";
import VersionCard from "./VersionCard";

interface Props {
  versions: BudgetVersionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onNewVersion: () => void;
}

export default function VersionCardRow({
  versions,
  selectedId,
  onSelect,
  onDuplicate,
  onDelete,
  onRename,
  onNewVersion,
}: Props) {
  const baseline = versions.find((v) => v.is_baseline) ?? null;
  const router = useRouter();

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {versions.map((v) => (
        <VersionCard
          key={v.id}
          version={v}
          baseline={baseline}
          isSelected={v.id === selectedId}
          onSelect={() => onSelect(v.id)}
          onDuplicate={() => onDuplicate(v.id)}
          onDelete={() => onDelete(v.id)}
          onRename={(name) => onRename(v.id, name)}
        />
      ))}

      {/* New version menu */}
      <div className="relative group">
        <button
          onClick={onNewVersion}
          className="min-w-[120px] h-full border border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 text-2xl font-light"
        >
          +
        </button>
      </div>

      {/* Import button (separate) */}
      <button
        onClick={() => router.push("/budget/import")}
        className="min-w-[140px] border border-dashed border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 flex flex-col items-center justify-center gap-1 text-indigo-500 px-3 py-4 text-xs font-medium"
      >
        <span className="text-lg">⬆</span>
        Import Excel
      </button>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/components/budget/ && git commit -m "feat: add VersionCard and VersionCardRow components"
```

---

## Task 7: Frontend — LineItemTable and BudgetSummaryBar

**Files:**
- Create: `frontend/components/budget/LineItemTable.tsx`
- Create: `frontend/components/budget/BudgetSummaryBar.tsx`

- [ ] **Step 1: Create `frontend/components/budget/LineItemTable.tsx`**

```typescript
"use client";
import { useState, useEffect, useRef } from "react";
import { BudgetLineItem, api } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface Props {
  versionId: string;
  versionName: string;
  onTotalChange: (total: number) => void;
}

export default function LineItemTable({ versionId, versionName, onTotalChange }: Props) {
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLoading(true);
    api.budget.getLines(versionId).then((l) => {
      setLines(l);
      setLoading(false);
    });
  }, [versionId]);

  function handleAmountChange(id: string, raw: string) {
    const val = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, amount: val } : l)));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(lines.map((l) => (l.id === id ? { ...l, amount: val } : l))), 800);
  }

  function handleCategoryChange(id: string, val: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, category: val } : l)));
  }

  function addLine() {
    const newLine: BudgetLineItem = { id: `new-${Date.now()}`, category: "New Item", amount: 0, sort_order: lines.length };
    setLines((prev) => [...prev, newLine]);
  }

  function removeLine(id: string) {
    const updated = lines.filter((l) => l.id !== id);
    setLines(updated);
    save(updated);
  }

  async function save(current: BudgetLineItem[]) {
    setSaveState("saving");
    try {
      const result = await api.budget.updateLines(versionId, current);
      onTotalChange(result.total);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{versionName} — Line Items</span>
        {saveState !== "idle" && (
          <span className={`text-xs font-medium ${saveState === "saved" ? "text-green-600" : "text-gray-400"}`}>
            {saveState === "saving" ? "Saving…" : "Saved ✓"}
          </span>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-5 py-2 text-left font-medium">Category</th>
            <th className="px-5 py-2 text-right font-medium">Amount</th>
            <th className="px-5 py-2 text-right font-medium">% of Total</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={line.id} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
              <td className="px-5 py-2">
                <input
                  className="w-full text-sm text-gray-800 font-medium bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 outline-none"
                  value={line.category}
                  onChange={(e) => handleCategoryChange(line.id, e.target.value)}
                  onBlur={() => save(lines)}
                />
              </td>
              <td className="px-5 py-2">
                <div className="relative flex items-center justify-end">
                  <span className="absolute left-0 text-gray-400 text-xs">$</span>
                  <input
                    type="number"
                    min={0}
                    value={line.amount || ""}
                    onChange={(e) => handleAmountChange(line.id, e.target.value)}
                    className="w-32 text-right text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder="0"
                  />
                </div>
              </td>
              <td className="px-5 py-2 text-right text-gray-500 text-xs">
                {total > 0 ? ((line.amount / total) * 100).toFixed(1) + "%" : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => removeLine(line.id)}
                  className="text-gray-300 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-gray-100">
        <button
          onClick={addLine}
          className="text-xs text-indigo-600 hover:underline"
        >
          + Add line item
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/components/budget/BudgetSummaryBar.tsx`**

```typescript
interface Props {
  total: number;
  contingencyPct: number;
}

export default function BudgetSummaryBar({ total, contingencyPct }: Props) {
  const withContingency = total * (1 + contingencyPct);
  const downPayment = withContingency * 0.2;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl flex gap-6 px-6 py-4 flex-wrap">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Line Items Total</p>
        <p className="text-xl font-bold text-gray-900">{fmt(total)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
          With {(contingencyPct * 100).toFixed(0)}% Contingency
        </p>
        <p className="text-xl font-bold text-gray-700">{fmt(withContingency)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
          Down Payment (20%)
        </p>
        <p className="text-xl font-bold text-gray-700">{fmt(downPayment)}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/components/budget/ && git commit -m "feat: add LineItemTable and BudgetSummaryBar components"
```

---

## Task 8: Frontend — CompareDrawer

**Files:**
- Create: `frontend/components/budget/CompareDrawer.tsx`

- [ ] **Step 1: Create `frontend/components/budget/CompareDrawer.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { BudgetVersionSummary, BudgetLineItem, api } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

interface Props {
  versions: BudgetVersionSummary[];
  onClose: () => void;
}

export default function CompareDrawer({ versions, onClose }: Props) {
  const [idA, setIdA] = useState(versions[0]?.id ?? "");
  const [idB, setIdB] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [linesA, setLinesA] = useState<BudgetLineItem[]>([]);
  const [linesB, setLinesB] = useState<BudgetLineItem[]>([]);

  useEffect(() => {
    if (idA) api.budget.getLines(idA).then(setLinesA);
  }, [idA]);

  useEffect(() => {
    if (idB) api.budget.getLines(idB).then(setLinesB);
  }, [idB]);

  const categories = Array.from(
    new Set([...linesA.map((l) => l.category), ...linesB.map((l) => l.category)])
  );

  const amtA = (cat: string) => linesA.find((l) => l.category === cat)?.amount ?? 0;
  const amtB = (cat: string) => linesB.find((l) => l.category === cat)?.amount ?? 0;

  const totalA = linesA.reduce((s, l) => s + l.amount, 0);
  const totalB = linesB.reduce((s, l) => s + l.amount, 0);
  const netDiff = totalB - totalA;

  const versionName = (id: string) => versions.find((v) => v.id === id)?.name ?? id;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[75vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm font-bold text-gray-900">Compare Versions</span>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">A:</span>
              <select
                value={idA}
                onChange={(e) => setIdA(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">B:</span>
              <select
                value={idB}
                onChange={(e) => setIdB(e.target.value)}
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg ml-2">✕</button>
          </div>
        </div>

        <div className="px-6 py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">{versionName(idA)}</th>
                <th className="px-4 py-2 text-right font-medium">{versionName(idB)}</th>
                <th className="px-4 py-2 text-right font-medium">Difference</th>
                <th className="px-4 py-2 text-right font-medium">% Change</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const a = amtA(cat);
                const b = amtB(cat);
                const diff = b - a;
                const pct = a > 0 ? ((diff / a) * 100).toFixed(1) : null;
                const changed = diff !== 0;
                return (
                  <tr
                    key={cat}
                    className={`border-b border-gray-50 ${
                      changed
                        ? diff > 0
                          ? "bg-red-50/40"
                          : "bg-green-50/40"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-2 font-medium text-gray-700">{cat}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmt$$(a)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${changed ? "text-gray-900" : "text-gray-600"}`}>
                      {fmt$$(b)}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold ${diff > 0 ? "text-red-600" : diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                      {diff === 0 ? "—" : (diff > 0 ? "+" : "") + fmt$$(diff)}
                    </td>
                    <td className={`px-4 py-2 text-right text-xs ${diff > 0 ? "text-red-500" : diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                      {pct !== null && diff !== 0 ? (diff > 0 ? "+" : "") + pct + "%" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals footer */}
          <div className="mt-4 grid grid-cols-3 gap-0 border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-r border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{versionName(idA)}</p>
              <p className="text-lg font-bold text-gray-900">{fmt$$(totalA)}</p>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-r border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{versionName(idB)}</p>
              <p className="text-lg font-bold text-gray-900">{fmt$$(totalB)}</p>
            </div>
            <div className={`px-5 py-3 ${netDiff !== 0 ? (netDiff > 0 ? "bg-red-50" : "bg-green-50") : "bg-gray-50"}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Net Difference</p>
              <p className={`text-lg font-bold ${netDiff > 0 ? "text-red-600" : netDiff < 0 ? "text-green-600" : "text-gray-600"}`}>
                {netDiff === 0 ? "No change" : (netDiff > 0 ? "+" : "") + fmt$$(netDiff)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/budget/CompareDrawer.tsx && git commit -m "feat: add CompareDrawer component"
```

---

## Task 9: Frontend — /budget main page

**Files:**
- Create: `frontend/app/budget/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p frontend/app/budget
```

- [ ] **Step 2: Create `frontend/app/budget/page.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import VersionCardRow from "@/components/budget/VersionCardRow";
import LineItemTable from "@/components/budget/LineItemTable";
import BudgetSummaryBar from "@/components/budget/BudgetSummaryBar";
import CompareDrawer from "@/components/budget/CompareDrawer";
import { api, BudgetVersionSummary, isLoggedIn } from "@/lib/api";

export default function BudgetPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<BudgetVersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contingencyPct] = useState(0.15); // from profile assumptions (default)

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/auth/login"); return; }
    api.budget.listVersions().then((vs) => {
      setVersions(vs);
      if (vs.length > 0) setSelectedId(vs.find((v) => v.is_baseline)?.id ?? vs[0].id);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleNewVersion() {
    const choice = window.prompt(
      'Create new version:\n1 - Start from template\n2 - Duplicate selected\n3 - Import from Excel\n\nEnter 1, 2, or 3:'
    );
    if (choice === "1") {
      const name = window.prompt("Version name:") ?? "New Version";
      const v = await api.budget.createVersion(name);
      setVersions((prev) => [...prev, v]);
      setSelectedId(v.id);
    } else if (choice === "2" && selectedId) {
      const v = await api.budget.duplicateVersion(selectedId);
      setVersions((prev) => [...prev, v]);
      setSelectedId(v.id);
    } else if (choice === "3") {
      router.push("/budget/import");
    }
  }

  async function handleDuplicate(id: string) {
    const v = await api.budget.duplicateVersion(id);
    setVersions((prev) => [...prev, v]);
    setSelectedId(v.id);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this budget version?")) return;
    try {
      await api.budget.deleteVersion(id);
      const updated = versions.filter((v) => v.id !== id);
      setVersions(updated);
      if (selectedId === id) setSelectedId(updated[0]?.id ?? null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Cannot delete version");
    }
  }

  async function handleRename(id: string, name: string) {
    const v = await api.budget.updateVersion(id, { name });
    setVersions((prev) => prev.map((ver) => (ver.id === id ? v : ver)));
  }

  function handleTotalChange(total: number) {
    setVersions((prev) =>
      prev.map((v) => (v.id === selectedId ? { ...v, total } : v))
    );
  }

  const selected = versions.find((v) => v.id === selectedId) ?? null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">House Budget</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build and compare construction cost scenarios</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/budget/import")}
              className="text-sm border border-gray-300 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              ⬆ Import Excel
            </button>
            <button
              onClick={handleNewVersion}
              className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 font-medium"
            >
              + New Version
            </button>
          </div>
        </div>

        {versions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-3">No budget versions yet</p>
            <button
              onClick={handleNewVersion}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Create your first budget
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <VersionCardRow
              versions={versions}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onRename={handleRename}
              onNewVersion={handleNewVersion}
            />

            {selected && (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCompare(true)}
                    disabled={versions.length < 2}
                    className="text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Compare versions
                  </button>
                </div>

                <LineItemTable
                  versionId={selected.id}
                  versionName={selected.name}
                  onTotalChange={handleTotalChange}
                />

                <BudgetSummaryBar
                  total={selected.total}
                  contingencyPct={contingencyPct}
                />
              </>
            )}
          </div>
        )}
      </main>

      {showCompare && versions.length >= 2 && (
        <CompareDrawer versions={versions} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/app/budget/ && git commit -m "feat: add /budget main page"
```

---

## Task 10: Frontend — Import pages (Upload + Mapper)

**Files:**
- Create: `frontend/components/budget/ImportUpload.tsx`
- Create: `frontend/components/budget/ImportMapper.tsx`
- Create: `frontend/app/budget/import/page.tsx`

- [ ] **Step 1: Create directories**

```bash
mkdir -p frontend/app/budget/import
```

- [ ] **Step 2: Create `frontend/components/budget/ImportUpload.tsx`**

```typescript
"use client";
import { useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
}

export default function ImportUpload({ onFile, loading }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      alert("Please upload a .xlsx file");
      return;
    }
    onFile(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        dragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="text-4xl mb-3">📊</div>
      {loading ? (
        <p className="text-sm text-gray-500">Parsing file…</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">Drop your builder's .xlsx file here</p>
          <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/components/budget/ImportMapper.tsx`**

```typescript
"use client";
import { useState } from "react";
import { ImportRow } from "@/lib/api";
import { fmt$$ } from "@/lib/utils";

const DEFAULT_CATEGORIES = [
  "Foundation","Framing","Roofing","Exterior","Electrical","Plumbing","HVAC",
  "Insulation","Drywall","Flooring","Kitchen","Bathrooms","Interior Finishes",
  "Landscaping","General Contractor Fee","Contingency","Other",
];

interface Props {
  rows: ImportRow[];
  onConfirm: (rows: ImportRow[]) => void;
  loading: boolean;
}

export default function ImportMapper({ rows, onConfirm, loading }: Props) {
  const [mapped, setMapped] = useState<ImportRow[]>(rows);

  function setCategory(idx: number, cat: string) {
    setMapped((prev) => prev.map((r, i) => i === idx ? { ...r, detected_category: cat } : r));
  }

  const unresolved = mapped.filter((r) => !r.detected_category).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length} rows parsed · {unresolved} need review
        </p>
        <button
          onClick={() => onConfirm(mapped)}
          disabled={loading || unresolved > 0}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import Version →"}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 text-left font-medium"></th>
              <th className="px-4 py-2 text-left font-medium">Your Excel Column</th>
              <th className="px-4 py-2 text-left font-medium">Budget Category</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {mapped.map((row, i) => (
              <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                <td className="px-4 py-2 w-6">
                  {row.confidence === "high" ? (
                    <span className="text-green-500 text-xs font-bold">✓</span>
                  ) : (
                    <span className="text-amber-400 text-xs font-bold">?</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-700">{row.raw_label}</td>
                <td className="px-4 py-2">
                  <select
                    value={row.detected_category ?? ""}
                    onChange={(e) => setCategory(i, e.target.value || "")}
                    className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                      !row.detected_category ? "border-amber-300 bg-amber-50" : "border-gray-200"
                    }`}
                  >
                    <option value="">-- select --</option>
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-right font-medium text-gray-800">
                  {fmt$$(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/app/budget/import/page.tsx`**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/ui/Nav";
import ImportUpload from "@/components/budget/ImportUpload";
import ImportMapper from "@/components/budget/ImportMapper";
import { api, ImportRow } from "@/lib/api";

export default function BudgetImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [versionName, setVersionName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setParsing(true);
    setError("");
    setVersionName(file.name.replace(".xlsx", ""));
    try {
      const result = await api.budget.parseImport(file);
      setRows(result.rows);
      setStep("map");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm(mappedRows: ImportRow[]) {
    if (!versionName.trim()) {
      setError("Please enter a version name");
      return;
    }
    setImporting(true);
    setError("");
    try {
      await api.budget.confirmImport(versionName, mappedRows);
      router.push("/budget");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/budget")} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Import from Excel</h1>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <span className={`px-3 py-1 rounded-full font-medium ${step === "upload" ? "bg-indigo-600 text-white" : "bg-green-100 text-green-700"}`}>
            1. Upload
          </span>
          <span className="text-gray-300">→</span>
          <span className={`px-3 py-1 rounded-full font-medium ${step === "map" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"}`}>
            2. Map columns
          </span>
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <ImportUpload onFile={handleFile} loading={parsing} />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version name</label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Builder Estimate June 2026"
              />
            </div>
            <ImportMapper rows={rows} onConfirm={handleConfirm} loading={importing} />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Full build check**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 7: Commit**

```bash
git add frontend/components/budget/ frontend/app/budget/ && git commit -m "feat: add import upload/mapper components and /budget/import page"
```

---

## Task 11: Smoke test

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && python3 -m pytest tests/ -v
```

Expected: all tests `PASSED`, no failures

- [ ] **Step 2: Start servers**

```bash
lsof -ti:8000 -ti:3000 | xargs kill -9 2>/dev/null; sleep 1
cd backend && python3 -m uvicorn main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
cd frontend && npm run dev > /tmp/frontend.log 2>&1 &
sleep 6 && curl -s http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Manual walkthrough**

Open http://localhost:3000/budget and verify:
1. Nav shows "Budget" link
2. Empty state shows "Create your first budget" button
3. Creating a version shows version card + 16 pre-populated line items
4. Editing an amount auto-saves (shows "Saved ✓")
5. Duplicating creates a second card showing delta vs baseline
6. Compare Versions button opens drawer (disabled with < 2 versions)
7. Import Excel button navigates to `/budget/import`
8. On import page: drag or click to upload `.xlsx` → mapper step shows rows with ✓/? indicators

- [ ] **Step 4: Final commit**

```bash
git add -A && git status --short
```

If only previously-committed files show as modified, nothing left to commit. Otherwise:

```bash
git commit -m "feat: complete house budget page with Excel import and compare drawer"
```

---

## Summary

| Task | Deliverable |
|---|---|
| 1 | openpyxl + pytest installed |
| 2 | BudgetVersion + BudgetLine models |
| 3 | Import parser with fuzzy category matching (5 tests) |
| 4 | Budget router — 9 endpoints (8 tests) |
| 5 | Frontend API client + Nav |
| 6 | VersionCard + VersionCardRow |
| 7 | LineItemTable + BudgetSummaryBar |
| 8 | CompareDrawer |
| 9 | /budget main page |
| 10 | ImportUpload + ImportMapper + /budget/import page |
| 11 | Smoke test |
