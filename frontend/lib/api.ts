const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || err.message || "Request failed");
  }
  return res.json();
}

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      request<{ access_token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },
  profile: {
    get: () => request<ProfileResponse>("/profile"),
    update: (data: Partial<ProfileData>) =>
      request<ProfileResponse>("/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updateAssumptions: (data: Partial<Assumptions>) =>
      request<Assumptions>("/profile/assumptions", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  dashboard: {
    get: () => request<DashboardData>("/dashboard"),
  },
  scenarios: {
    list: () => request<ScenarioSummary[]>("/scenarios"),
    get: (id: string) => request<ScenarioDetail>("/scenarios/" + id),
    create: (data: CreateScenarioRequest) =>
      request<ScenarioDetail>("/scenarios", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>("/scenarios/" + id, { method: "DELETE" }),
    addScopeChange: (id: string, data: { scope_increase: number; months_remaining: number }) =>
      request<ScopeChangeResult>("/scenarios/" + id + "/scope-changes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  retirement: {
    get: (params?: { retirement_age?: number; monthly_contribution?: number }) => {
      const qs = params
        ? "?" + new URLSearchParams(
            Object.fromEntries(
              Object.entries(params)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, String(v)])
            )
          ).toString()
        : "";
      return request<RetirementData>("/retirement" + qs);
    },
  },
};

// Types
export interface ProfileData {
  annual_income: number;
  annual_bonus: number;
  monthly_expenses: number;
  current_savings: number;
  investments: number;
  existing_monthly_mortgage: number;
  other_monthly_debt: number;
  age: number;
  retirement_age: number;
}

export interface Assumptions {
  annual_investment_return: number;
  inflation_rate: number;
  home_appreciation_rate: number;
}

export interface ProfileResponse {
  profile: ProfileData;
  assumptions: Assumptions;
  derived: {
    monthly_income: number;
    monthly_cash_flow: number;
    savings_rate: number;
    debt_to_income: number;
    health_score: number;
  };
  is_example: boolean;
}

export interface DashboardData {
  monthly_cash_flow: number;
  savings_rate: number;
  health_score: number;
  net_worth: number;
  retirement_projection: {
    baseline_fv: number;
    monthly_income_estimate: number;
    on_track: boolean;
    target_balance: number;
  };
  net_worth_chart: { year: number; value: number }[];
  is_example: boolean;
}

export interface ScenarioSummary {
  id: string;
  type: string;
  name: string;
  risk_flag: string | null;
  created_at: string;
}

export interface BuildResult {
  total_project_cost: number;
  down_payment: number;
  loan_amount: number;
  phase1: {
    monthly_construction_interest: number;
    monthly_carry_total: number;
    monthly_cashflow_delta: number;
    monthly_cashflow: number;
    savings_rate: number;
    total_cash_out: number;
    duration_months: number;
  };
  phase2: {
    monthly_payment: number;
    net_delta_vs_today: number;
    monthly_cashflow: number;
    savings_rate: number;
  };
  retirement: {
    baseline_fv: number;
    scenario_fv: number;
    dollar_impact: number;
    shift_years: number;
  };
  break_even_months: number | null;
  risk_flag: "green" | "yellow" | "red";
}

export interface ScenarioDetail {
  id: string;
  type: string;
  name: string;
  inputs: Record<string, unknown>;
  result: BuildResult;
  scope_changes: ScopeChangeResult[];
  created_at: string;
}

export interface ScopeChangeResult {
  id: string;
  scope_increase: number;
  months_remaining: number;
  result: {
    new_loan_amount: number;
    additional_construction_interest: number;
    new_monthly_payment: number;
    monthly_payment_increase: number;
  };
  created_at?: string;
}

export interface CreateScenarioRequest {
  type: string;
  name?: string;
  inputs: Record<string, unknown>;
}

export interface RetirementData {
  projected_balance: number;
  estimated_monthly_income: number;
  on_track: boolean;
  target_balance: number;
  shortfall: number;
  chart: { year: number; value: number }[];
  default_contribution: number;
  current_age: number;
  retirement_age: number;
  is_example: boolean;
}
