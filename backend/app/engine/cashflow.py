def monthly_payment(principal: float, annual_rate: float, term_years: int) -> float:
    r = annual_rate / 12
    n = term_years * 12
    if r == 0:
        return principal / n
    return principal * (r * (1 + r) ** n) / ((1 + r) ** n - 1)


def fv(pv: float, annual_rate: float, years: float, monthly_pmt: float) -> float:
    r = annual_rate / 12
    n = years * 12
    if r == 0:
        return pv + monthly_pmt * n
    return pv * (1 + r) ** n + monthly_pmt * ((1 + r) ** n - 1) / r


def health_score(savings_rate: float, dti: float, monthly_cashflow: float) -> int:
    base = 50
    if savings_rate >= 0.20:
        base += 20
    elif savings_rate >= 0.10:
        base += 10
    elif savings_rate < 0:
        base -= 20
    if dti <= 0.28:
        base += 15
    elif dti <= 0.36:
        base += 5
    elif dti > 0.43:
        base -= 15
    if monthly_cashflow > 0:
        base += 15
    elif monthly_cashflow < 0:
        base -= 20
    return max(0, min(100, base))
