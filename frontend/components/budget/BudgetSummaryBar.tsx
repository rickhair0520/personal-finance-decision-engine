interface Props {
  total: number;
  contingencyPct: number;
}

export default function BudgetSummaryBar({ total, contingencyPct }: Props) {
  const withContingency = total * (1 + contingencyPct);
  const downPayment = withContingency * 0.2;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl flex gap-6 px-6 py-4 flex-wrap">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Line Items Total</p>
        <p className="text-xl font-bold text-gray-900">{fmt(total)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
          With {(contingencyPct * 100).toFixed(0)}% Contingency
        </p>
        <p className="text-xl font-bold text-gray-700">{fmt(withContingency)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
          Down Payment (20%)
        </p>
        <p className="text-xl font-bold text-gray-700">{fmt(downPayment)}</p>
      </div>
    </div>
  );
}
