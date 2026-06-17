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
