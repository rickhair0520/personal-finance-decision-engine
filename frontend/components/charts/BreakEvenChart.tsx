"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fmt$$ } from "@/lib/utils";

interface Props {
  totalCashOut: number;
  monthlyBenefit: number;
  breakEvenMonths: number;
}

export default function BreakEvenChart({ totalCashOut, monthlyBenefit, breakEvenMonths }: Props) {
  const horizon = Math.min(Math.max(breakEvenMonths + 24, 60), 120);
  const data = Array.from({ length: horizon + 1 }, (_, i) => ({
    month: i,
    cost: totalCashOut,
    benefit: Math.round(monthlyBenefit * i),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Months", position: "insideBottomRight", offset: -5, fontSize: 10 }}
        />
        <YAxis
          tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <Tooltip formatter={(v) => fmt$$(v as number)} labelFormatter={(l) => `Month ${l}`} />
        <ReferenceLine
          x={breakEvenMonths}
          stroke="#6366f1"
          strokeDasharray="4 2"
          label={{ value: "Break-even", position: "top", fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          name="Cumulative Cost"
        />
        <Line
          type="monotone"
          dataKey="benefit"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="Cumulative Benefit"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
