"use client";

interface VarianceItem {
  category: string;
  budgeted: number;
  actual: number;
}

// Mock data for home construction project
const VARIANCE_DATA: VarianceItem[] = [
  { category: "Foundation", budgeted: 85000, actual: 82500 },
  { category: "Framing", budgeted: 120000, actual: 125000 },
  { category: "Roofing", budgeted: 65000, actual: 68000 },
  { category: "Electrical", budgeted: 95000, actual: 92000 },
  { category: "Plumbing", budgeted: 78000, actual: 76500 },
  { category: "HVAC", budgeted: 88000, actual: 90000 },
  { category: "Finishes", budgeted: 210000, actual: 205000 },
  { category: "Appliances & Fixtures", budgeted: 112000, actual: 120000 },
];

interface VarianceCardProps {
  category: string;
  budgeted: number;
  actual: number;
}

function VarianceCard({ category, budgeted, actual }: VarianceCardProps) {
  const dollarVariance = actual - budgeted;
  const percentVariance = (dollarVariance / budgeted) * 100;
  const isOverBudget = dollarVariance > 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const percentFmt = (n: number) => `${isOverBudget ? "+" : ""}${n.toFixed(1)}%`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{category}</h3>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">Budgeted</span>
          <span className="text-sm font-semibold text-gray-900">{fmt(budgeted)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">Actual</span>
          <span className="text-sm font-semibold text-gray-900">{fmt(actual)}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">Variance</span>
          <span
            className={`text-sm font-bold ${
              isOverBudget ? "text-red-600" : "text-green-600"
            }`}
          >
            {fmt(dollarVariance)}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600 uppercase tracking-wide font-medium">% Variance</span>
          <span
            className={`text-xs font-semibold ${
              isOverBudget ? "text-red-600" : "text-green-600"
            }`}
          >
            {percentFmt(percentVariance)}
          </span>
        </div>
      </div>

      {/* Variance bar indicator */}
      <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${isOverBudget ? "bg-red-500" : "bg-green-500"}`}
          style={{
            width: `${Math.min(100, Math.abs(percentVariance) * 5)}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function VarianceAnalysisPanel() {
  const totalBudgeted = VARIANCE_DATA.reduce((sum, item) => sum + item.budgeted, 0);
  const totalActual = VARIANCE_DATA.reduce((sum, item) => sum + item.actual, 0);
  const totalDollarVariance = totalActual - totalBudgeted;
  const totalPercentVariance = (totalDollarVariance / totalBudgeted) * 100;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Variance Analysis</h2>
        <p className="text-sm text-gray-600">Budget vs. actual spend by category</p>
      </div>

      {/* Summary totals */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Total Budgeted</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalBudgeted)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Total Actual</p>
            <p className="text-lg font-bold text-gray-900">{fmt(totalActual)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Total Variance</p>
            <p className={`text-lg font-bold ${totalDollarVariance > 0 ? "text-red-600" : "text-green-600"}`}>
              {fmt(totalDollarVariance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium mb-1">Overall %</p>
            <p className={`text-lg font-bold ${totalDollarVariance > 0 ? "text-red-600" : "text-green-600"}`}>
              {totalDollarVariance > 0 ? "+" : ""}{totalPercentVariance.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Variance cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {VARIANCE_DATA.map((item) => (
          <VarianceCard
            key={item.category}
            category={item.category}
            budgeted={item.budgeted}
            actual={item.actual}
          />
        ))}
      </div>
    </div>
  );
}
