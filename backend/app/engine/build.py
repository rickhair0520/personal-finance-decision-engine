from typing import Optional
from .cashflow import monthly_payment, fv
from .risk import compute_risk_flag


def custom_build_scenario(
    annual_income: float,
    existing_monthly_mortgage: float,
    other_monthly_debt: float,
    monthly_expenses: float,
    investments: float,
    age: int,
    retirement_age: int,
    annual_investment_return: float,
    home_appreciation_rate: float,
    build_estimate: float,
    contingency_pct: float,
    down_payment_pct: float,
    construction_loan_rate: float,
    build_timeline_months: int,
    permanent_loan_rate: float,
    permanent_loan_term_years: int,
) -> dict:
    monthly_income = annual_income / 12

    total_cost = build_estimate * (1 + contingency_pct)
    down_payment = total_cost * down_payment_pct
    loan_amount = total_cost - down_payment

    # Phase 1: construction (interest-only, linear draw)
    avg_outstanding = loan_amount / 2
    construction_monthly_interest = avg_outstanding * (construction_loan_rate / 12)
    phase1_monthly_carry = construction_monthly_interest + existing_monthly_mortgage
    phase1_cashflow_delta = construction_monthly_interest
    total_phase1_cash_out = down_payment + (phase1_cashflow_delta * build_timeline_months)

    baseline_cashflow = (
        monthly_income - monthly_expenses - existing_monthly_mortgage - other_monthly_debt
    )
    phase1_cashflow = baseline_cashflow - phase1_cashflow_delta

    # Phase 2: permanent
    phase2_payment = monthly_payment(loan_amount, permanent_loan_rate, permanent_loan_term_years)
    phase2_net_delta = phase2_payment - existing_monthly_mortgage
    phase2_cashflow = baseline_cashflow + existing_monthly_mortgage - phase2_payment

    # Retirement impact
    months_to_retirement = (retirement_age - age) * 12
    post_build_months = max(0, months_to_retirement - build_timeline_months)

    baseline_contribution = max(0, baseline_cashflow * 0.8)
    phase1_contribution = max(0, phase1_cashflow * 0.8)
    phase2_contribution = max(0, phase2_cashflow * 0.8)

    baseline_fv = fv(
        investments, annual_investment_return, (retirement_age - age), baseline_contribution
    )

    mid_build_fv = fv(
        investments, annual_investment_return, build_timeline_months / 12, phase1_contribution
    )
    scenario_fv = fv(
        mid_build_fv, annual_investment_return, post_build_months / 12, phase2_contribution
    )

    retirement_dollar_impact = baseline_fv - scenario_fv
    retirement_shift_years = (
        retirement_dollar_impact / (baseline_contribution * 12)
        if baseline_contribution > 0
        else 0.0
    )

    # Break-even
    monthly_appreciation = total_cost * (home_appreciation_rate / 12)
    monthly_mortgage_savings = max(0, existing_monthly_mortgage - phase2_payment)
    monthly_benefit = monthly_appreciation + monthly_mortgage_savings
    break_even_months: Optional[int] = (
        int(total_phase1_cash_out / monthly_benefit) if monthly_benefit > 0 else None
    )

    phase2_savings_rate = phase2_cashflow / monthly_income if monthly_income > 0 else 0

    return {
        "total_project_cost": round(total_cost, 2),
        "down_payment": round(down_payment, 2),
        "loan_amount": round(loan_amount, 2),
        "phase1": {
            "monthly_construction_interest": round(construction_monthly_interest, 2),
            "monthly_carry_total": round(phase1_monthly_carry, 2),
            "monthly_cashflow_delta": round(phase1_cashflow_delta, 2),
            "monthly_cashflow": round(phase1_cashflow, 2),
            "savings_rate": round(phase1_cashflow / monthly_income, 4) if monthly_income > 0 else 0,
            "total_cash_out": round(total_phase1_cash_out, 2),
            "duration_months": build_timeline_months,
        },
        "phase2": {
            "monthly_payment": round(phase2_payment, 2),
            "net_delta_vs_today": round(phase2_net_delta, 2),
            "monthly_cashflow": round(phase2_cashflow, 2),
            "savings_rate": round(phase2_savings_rate, 4),
        },
        "retirement": {
            "baseline_fv": round(baseline_fv, 2),
            "scenario_fv": round(scenario_fv, 2),
            "dollar_impact": round(retirement_dollar_impact, 2),
            "shift_years": round(retirement_shift_years, 2),
        },
        "break_even_months": break_even_months,
        "risk_flag": compute_risk_flag(phase2_savings_rate, retirement_shift_years),
    }


def scope_change_delta(
    original_loan_amount: float,
    original_phase2_payment: float,
    scope_increase: float,
    months_remaining: int,
    perm_rate: float,
    perm_term_years: int,
) -> dict:
    new_loan = original_loan_amount + scope_increase
    additional_interest = (scope_increase / 2) * (perm_rate / 12) * months_remaining
    new_payment = monthly_payment(new_loan, perm_rate, perm_term_years)
    payment_delta = new_payment - original_phase2_payment
    return {
        "new_loan_amount": round(new_loan, 2),
        "additional_construction_interest": round(additional_interest, 2),
        "new_monthly_payment": round(new_payment, 2),
        "monthly_payment_increase": round(payment_delta, 2),
    }
