from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db.database import get_db
from .. import models, schemas
from ..auth import get_current_user
from ..engine.cashflow import health_score

router = APIRouter(prefix="/profile", tags=["profile"])

EXAMPLE_PROFILE = {
    "annual_income": 220000,
    "annual_bonus": 0,
    "monthly_expenses": 5500,
    "current_savings": 80000,
    "investments": 280000,
    "existing_monthly_mortgage": 3200,
    "other_monthly_debt": 500,
    "age": 42,
    "retirement_age": 65,
}

EXAMPLE_ASSUMPTIONS = {
    "annual_investment_return": 0.07,
    "inflation_rate": 0.03,
    "home_appreciation_rate": 0.04,
}


def _profile_to_dict(p: models.UserProfile) -> dict:
    return {
        "annual_income": p.annual_income,
        "annual_bonus": p.annual_bonus,
        "monthly_expenses": p.monthly_expenses,
        "current_savings": p.current_savings,
        "investments": p.investments,
        "existing_monthly_mortgage": p.existing_monthly_mortgage,
        "other_monthly_debt": p.other_monthly_debt,
        "age": p.age,
        "retirement_age": p.retirement_age,
    }


def _assumptions_to_dict(a: models.UserAssumptions) -> dict:
    return {
        "annual_investment_return": a.annual_investment_return,
        "inflation_rate": a.inflation_rate,
        "home_appreciation_rate": a.home_appreciation_rate,
    }


def _derive(p: models.UserProfile) -> dict:
    monthly_income = p.annual_income / 12
    monthly_cf = (
        monthly_income - p.monthly_expenses - p.existing_monthly_mortgage - p.other_monthly_debt
    )
    savings_rate = monthly_cf / monthly_income if monthly_income > 0 else 0
    dti = (
        (p.existing_monthly_mortgage + p.other_monthly_debt) / monthly_income
        if monthly_income > 0
        else 0
    )
    score = health_score(savings_rate, dti, monthly_cf)
    return {
        "monthly_income": round(monthly_income, 2),
        "monthly_cash_flow": round(monthly_cf, 2),
        "savings_rate": round(savings_rate, 4),
        "debt_to_income": round(dti, 4),
        "health_score": score,
    }


@router.get("")
def get_profile(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    a = db.query(models.UserAssumptions).filter(models.UserAssumptions.user_id == user.id).first()

    is_example = p.annual_income == 0
    return {
        "profile": _profile_to_dict(p) if not is_example else EXAMPLE_PROFILE,
        "assumptions": _assumptions_to_dict(a) if a else EXAMPLE_ASSUMPTIONS,
        "derived": _derive(p) if not is_example else _derive_from_dict(EXAMPLE_PROFILE),
        "is_example": is_example,
    }


def _derive_from_dict(d: dict) -> dict:
    monthly_income = d["annual_income"] / 12
    monthly_cf = (
        monthly_income
        - d["monthly_expenses"]
        - d["existing_monthly_mortgage"]
        - d["other_monthly_debt"]
    )
    savings_rate = monthly_cf / monthly_income if monthly_income > 0 else 0
    dti = (
        (d["existing_monthly_mortgage"] + d["other_monthly_debt"]) / monthly_income
        if monthly_income > 0
        else 0
    )
    score = health_score(savings_rate, dti, monthly_cf)
    return {
        "monthly_income": round(monthly_income, 2),
        "monthly_cash_flow": round(monthly_cf, 2),
        "savings_rate": round(savings_rate, 4),
        "debt_to_income": round(dti, 4),
        "health_score": score,
    }


@router.put("")
def update_profile(
    req: schemas.ProfileUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)

    a = db.query(models.UserAssumptions).filter(models.UserAssumptions.user_id == user.id).first()
    return {
        "profile": _profile_to_dict(p),
        "assumptions": _assumptions_to_dict(a),
        "derived": _derive(p),
        "is_example": False,
    }


@router.put("/assumptions")
def update_assumptions(
    req: schemas.AssumptionsUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(models.UserAssumptions).filter(models.UserAssumptions.user_id == user.id).first()
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return _assumptions_to_dict(a)
