export function fmt$$(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

export function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function healthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Strong", color: "text-green-600" };
  if (score >= 60) return { label: "Moderate", color: "text-yellow-600" };
  if (score >= 40) return { label: "Caution", color: "text-orange-500" };
  return { label: "At Risk", color: "text-red-600" };
}

export function riskColor(flag: string): string {
  if (flag === "green") return "bg-green-100 text-green-800 border-green-300";
  if (flag === "yellow") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}
