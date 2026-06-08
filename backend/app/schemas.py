from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    annual_income: Optional[float] = None
    annual_bonus: Optional[float] = None
    monthly_expenses: Optional[float] = None
    current_savings: Optional[float] = None
    investments: Optional[float] = None
    existing_monthly_mortgage: Optional[float] = None
    other_monthly_debt: Optional[float] = None
    age: Optional[int] = None
    retirement_age: Optional[int] = None


class AssumptionsUpdate(BaseModel):
    annual_investment_return: Optional[float] = None
    inflation_rate: Optional[float] = None
    home_appreciation_rate: Optional[float] = None


class ProfileResponse(BaseModel):
    profile: dict
    assumptions: dict
    derived: dict


class DashboardResponse(BaseModel):
    monthly_cash_flow: float
    savings_rate: float
    health_score: int
    net_worth: float
    retirement_projection: dict
    net_worth_chart: List[dict]


class BuildScenarioInputs(BaseModel):
    build_estimate: float
    contingency_pct: float = 0.15
    down_payment_pct: float = 0.20
    construction_loan_rate: float
    build_timeline_months: int = 14
    permanent_loan_rate: float
    permanent_loan_term_years: int = 30

    @field_validator("build_estimate")
    @classmethod
    def positive_build_estimate(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("build_estimate must be greater than 0")
        return v


class CreateScenarioRequest(BaseModel):
    type: str = "custom_build"
    name: Optional[str] = None
    inputs: Any


class ScopeChangeRequest(BaseModel):
    scope_increase: float
    months_remaining: int


class RetirementQueryParams(BaseModel):
    retirement_age: Optional[int] = None
    monthly_contribution: Optional[float] = None
