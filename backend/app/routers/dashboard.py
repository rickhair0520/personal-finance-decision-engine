from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db.database import get_db
from .. import models
from ..auth import get_current_user
from ..engine.cashflow import health_score, fv
from ..engine.retirement_calc import retirement_projection

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

EXAMPLE = {
    "annual_income": 220000,
    "monthly_expenses": 5500,
    "existing_monthly_mortgage": 3200,
    "other_monthly_debt": 500,
    "current_savings": 80000,
    "investments": 280000,
    "age": 42,
    "retirement_age": 65,
    "annual_investment_return": 0.07,
    "home_appreciation_rate": 0.04,
}


@router.get("")
def get_dashboard(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    a = db.query(models.UserAssumptions).filter(models.UserAssumptions.user_id == user.id).first()

    is_example = p.annual_income == 0
    if is_example:
        annual_income = EXAMPLE["annual_income"]
        monthly_expenses = EXAMPLE["monthly_expenses"]
        mortgage = EXAMPLE["existing_monthly_mortgage"]
        other_debt = EXAMPLE["other_monthly_debt"]
        savings = EXAMPLE["current_savings"]
        investments = EXAMPLE["investments"]
        age = EXAMPLE["age"]
        retirement_age = EXAMPLE["retirement_age"]
        return_rate = EXAMPLE["annual_investment_return"]
    else:
        annual_income = p.annual_income
        monthly_expenses = p.monthly_expenses
        mortgage = p.existing_monthly_mortgage
        other_debt = p.other_monthly_debt
        savings = p.current_savings
        investments = p.investments
        age = p.age
        retirement_age = p.retirement_age
        return_rate = a.annual_investment_return

    monthly_income = annual_income / 12
    monthly_cf = monthly_income - monthly_expenses - mortgage - other_debt
    savings_rate = monthly_cf / monthly_income if monthly_income > 0 else 0
    dti = (mortgage + other_debt) / monthly_income if monthly_income > 0 else 0
    score = health_score(savings_rate, dti, monthly_cf)
    net_worth = savings + investments

    monthly_contribution = max(0, monthly_cf * 0.8)
    ret = retirement_projection(
        investments, monthly_contribution, return_rate, age, retirement_age, monthly_expenses
    )

    # Net worth chart (current year → retirement)
    years_to_retirement = retirement_age - age
    net_worth_chart = []
    import datetime
    current_year = datetime.datetime.utcnow().year
    for y in range(0, years_to_retirement + 1):
        val = fv(investments, return_rate, y, monthly_contribution) + savings
        net_worth_chart.append({"year": current_year + y, "value": round(val, 2)})

    return {
        "monthly_cash_flow": round(monthly_cf, 2),
        "savings_rate": round(savings_rate, 4),
        "health_score": score,
        "net_worth": round(net_worth, 2),
        "retirement_projection": {
            "baseline_fv": ret["projected_balance"],
            "monthly_income_estimate": ret["estimated_monthly_income"],
            "on_track": ret["on_track"],
            "target_balance": ret["target_balance"],
        },
        "net_worth_chart": net_worth_chart,
        "is_example": is_example,
    }
