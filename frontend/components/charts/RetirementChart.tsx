"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fmt$$ } from "@/lib/utils";

interface Props {
  data: { year: number; value: number }[];
  targetBalance?: number;
  retirementAge?: number;
}

export default function RetirementChart({ data, targetBalance }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v) => "$" + (v / 1000000).toFixed(1) + "M"}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <Tooltip formatter={(v) => fmt$$(v as number)} labelFormatter={(l) => `Age ${l}`} />
        {targetBalance && (
          <ReferenceLine
            y={targetBalance}
            stroke="#f59e0b"
            strokeDasharray="4 2"
            label={{ value: "Target", position: "right", fontSize: 10 }}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#retGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
