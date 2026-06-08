from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..db.database import get_db
from .. import models
from ..auth import get_current_user
from ..engine.retirement_calc import retirement_projection

router = APIRouter(prefix="/retirement", tags=["retirement"])


@router.get("")
def get_retirement(
    retirement_age: Optional[int] = Query(None),
    monthly_contribution: Optional[float] = Query(None),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    a = db.query(models.UserAssumptions).filter(models.UserAssumptions.user_id == user.id).first()

    is_example = p.annual_income == 0
    if is_example:
        base_investments = 280000
        base_income = 220000
        base_expenses = 5500
        base_mortgage = 3200
        base_other_debt = 500
        base_age = 42
        base_retirement_age = 65
        base_return = 0.07
    else:
        base_investments = p.investments
        base_income = p.annual_income
        base_expenses = p.monthly_expenses
        base_mortgage = p.existing_monthly_mortgage
        base_other_debt = p.other_monthly_debt
        base_age = p.age
        base_retirement_age = p.retirement_age
        base_return = a.annual_investment_return

    monthly_income = base_income / 12
    baseline_cf = monthly_income - base_expenses - base_mortgage - base_other_debt
    default_contribution = max(0, baseline_cf * 0.8)

    effective_age = base_retirement_age if retirement_age is None else retirement_age
    effective_contribution = default_contribution if monthly_contribution is None else monthly_contribution

    result = retirement_projection(
        base_investments, effective_contribution, base_return,
        base_age, effective_age, base_expenses
    )
    result["default_contribution"] = round(default_contribution, 2)
    result["current_age"] = base_age
    result["retirement_age"] = effective_age
    result["is_example"] = is_example
    return result
