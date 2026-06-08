from .cashflow import fv


def retirement_projection(
    current_savings: float,
    monthly_contribution: float,
    annual_return: float,
    current_age: int,
    retirement_age: int,
    monthly_expenses: float,
) -> dict:
    years = retirement_age - current_age
    if years <= 0:
        return {
            "projected_balance": current_savings,
            "estimated_monthly_income": current_savings * 0.04 / 12,
            "on_track": False,
            "target_balance": 0,
            "shortfall": 0,
            "chart": [],
        }

    projected_balance = fv(current_savings, annual_return, years, monthly_contribution)
    estimated_monthly_income = projected_balance * 0.04 / 12
    target_balance = monthly_expenses * 12 * 25
    on_track = projected_balance >= target_balance
    shortfall = max(0, target_balance - projected_balance)

    chart = []
    for y in range(0, years + 1):
        val = fv(current_savings, annual_return, y, monthly_contribution)
        chart.append({"year": current_age + y, "value": round(val, 2)})

    return {
        "projected_balance": round(projected_balance, 2),
        "estimated_monthly_income": round(estimated_monthly_income, 2),
        "on_track": on_track,
        "target_balance": round(target_balance, 2),
        "shortfall": round(shortfall, 2),
        "chart": chart,
    }
