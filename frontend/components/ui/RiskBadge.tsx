import { riskColor } from "@/lib/utils";

interface Props {
  flag: string;
  size?: "sm" | "md";
}

const labels: Record<string, string> = {
  green: "Low Risk",
  yellow: "Moderate Risk",
  red: "High Risk",
};

export default function RiskBadge({ flag, size = "md" }: Props) {
  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium ${riskColor(flag)} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      {labels[flag] || flag}
    </span>
  );
}
