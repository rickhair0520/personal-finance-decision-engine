from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..db.database import get_db
from .. import models, schemas
from ..auth import get_current_user
from ..engine.build import custom_build_scenario, scope_change_delta
import uuid

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


EXAMPLE_PROFILE = {
    "annual_income": 220000, "monthly_expenses": 5500, "existing_monthly_mortgage": 3200,
    "other_monthly_debt": 500, "investments": 280000, "age": 42, "retirement_age": 65,
}


def _run_build_scenario(p: models.UserProfile, a: models.UserAssumptions, inputs: dict) -> dict:
    is_example = p.annual_income == 0
    ep = EXAMPLE_PROFILE if is_example else {}
    return custom_build_scenario(
        annual_income=ep.get("annual_income", p.annual_income),
        existing_monthly_mortgage=ep.get("existing_monthly_mortgage", p.existing_monthly_mortgage),
        other_monthly_debt=ep.get("other_monthly_debt", p.other_monthly_debt),
        monthly_expenses=ep.get("monthly_expenses", p.monthly_expenses),
        investments=ep.get("investments", p.investments),
        age=ep.get("age", p.age),
        retirement_age=ep.get("retirement_age", p.retirement_age),
        annual_investment_return=a.annual_investment_return,
        home_appreciation_rate=a.home_appreciation_rate,
        build_estimate=inputs["build_estimate"],
        contingency_pct=inputs.get("contingency_pct", 0.15),
        down_payment_pct=inputs.get("down_payment_pct", 0.20),
        construction_loan_rate=inputs["construction_loan_rate"],
        build_timeline_months=inputs.get("build_timeline_months", 14),
        permanent_loan_rate=inputs["permanent_loan_rate"],
        permanent_loan_term_years=inputs.get("permanent_loan_term_years", 30),
    )


@router.post("")
def create_scenario(
    req: schemas.CreateScenarioRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).first()
    a = db.query(models.UserAssumptions).filter(models.UserAssumptions.user_id == user.id).first()

    if req.type != "custom_build":
        raise HTTPException(status_code=400, detail="Only custom_build scenarios supported in MVP")

    inputs = req.inputs if isinstance(req.inputs, dict) else req.inputs.model_dump()
    required = ["build_estimate", "construction_loan_rate", "permanent_loan_rate"]
    for field in required:
        if field not in inputs:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")

    result = _run_build_scenario(p, a, inputs)

    scenario = models.Scenario(
        id=str(uuid.uuid4()),
        user_id=user.id,
        type=req.type,
        name=req.name or f"Build Scenario {datetime.utcnow().strftime('%b %d')}",
        inputs=inputs,
        result=result,
        result_computed_at=datetime.utcnow(),
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)

    return {
        "id": scenario.id,
        "type": scenario.type,
        "name": scenario.name,
        "inputs": scenario.inputs,
        "result": scenario.result,
        "created_at": scenario.created_at.isoformat(),
    }


@router.get("")
def list_scenarios(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scenarios = (
        db.query(models.Scenario)
        .filter(models.Scenario.user_id == user.id)
        .order_by(models.Scenario.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "type": s.type,
            "name": s.name,
            "risk_flag": s.result.get("risk_flag") if s.result else None,
            "created_at": s.created_at.isoformat(),
        }
        for s in scenarios
    ]


@router.get("/{scenario_id}")
def get_scenario(
    scenario_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(models.Scenario).filter(
        models.Scenario.id == scenario_id,
        models.Scenario.user_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")

    scope_changes = [
        {
            "id": sc.id,
            "scope_increase": sc.scope_increase,
            "months_remaining": sc.months_remaining,
            "result": sc.result,
            "created_at": sc.created_at.isoformat(),
        }
        for sc in s.scope_changes
    ]

    return {
        "id": s.id,
        "type": s.type,
        "name": s.name,
        "inputs": s.inputs,
        "result": s.result,
        "scope_changes": scope_changes,
        "created_at": s.created_at.isoformat(),
    }


@router.delete("/{scenario_id}")
def delete_scenario(
    scenario_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(models.Scenario).filter(
        models.Scenario.id == scenario_id,
        models.Scenario.user_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/{scenario_id}/scope-changes")
def add_scope_change(
    scenario_id: str,
    req: schemas.ScopeChangeRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(models.Scenario).filter(
        models.Scenario.id == scenario_id,
        models.Scenario.user_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if not s.result:
        raise HTTPException(status_code=400, detail="Scenario has no computed result")

    result = scope_change_delta(
        original_loan_amount=s.result["loan_amount"],
        original_phase2_payment=s.result["phase2"]["monthly_payment"],
        scope_increase=req.scope_increase,
        months_remaining=req.months_remaining,
        perm_rate=s.inputs["permanent_loan_rate"],
        perm_term_years=s.inputs.get("permanent_loan_term_years", 30),
    )

    sc = models.ScopeChange(
        id=str(uuid.uuid4()),
        scenario_id=s.id,
        user_id=user.id,
        scope_increase=req.scope_increase,
        months_remaining=req.months_remaining,
        result=result,
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)

    return {
        "id": sc.id,
        "scope_increase": sc.scope_increase,
        "months_remaining": sc.months_remaining,
        "result": sc.result,
    }


@router.get("/{scenario_id}/scope-changes")
def list_scope_changes(
    scenario_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(models.Scenario).filter(
        models.Scenario.id == scenario_id,
        models.Scenario.user_id == user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return [
        {
            "id": sc.id,
            "scope_increase": sc.scope_increase,
            "months_remaining": sc.months_remaining,
            "result": sc.result,
            "created_at": sc.created_at.isoformat(),
        }
        for sc in s.scope_changes
    ]
