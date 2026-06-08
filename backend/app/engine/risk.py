def compute_risk_flag(post_perm_savings_rate: float, retirement_shift_years: float) -> str:
    cashflow_negative = post_perm_savings_rate < 0
    if cashflow_negative or post_perm_savings_rate < 0.05 or retirement_shift_years > 5:
        return "red"
    if post_perm_savings_rate < 0.15 or retirement_shift_years > 2:
        return "yellow"
    return "green"
