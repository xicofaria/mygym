"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtShortDate } from "@/lib/format";

export type ChartLine = { key: string; name: string; color?: string };

const DEFAULT_COLORS = ["#4f46e5", "#059669", "#db2777", "#d97706", "#0891b2"];

export function ProgressChart({
  data,
  xKey = "date",
  lines,
  height = 220,
  unit = "",
  minimal = false,
}: {
  data: Record<string, unknown>[];
  xKey?: string;
  lines: ChartLine[];
  height?: number;
  unit?: string;
  minimal?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 8,
            right: 8,
            bottom: 0,
            left: minimal ? 0 : -18,
          }}
        >
          {!minimal && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-black/10 dark:text-white/10"
            />
          )}
          <XAxis
            dataKey={xKey}
            hide={minimal}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => fmtShortDate(v)}
            minTickGap={24}
          />
          <YAxis
            hide={minimal}
            width={38}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 2", "dataMax + 2"]}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(120,120,130,0.25)",
              background: "rgba(24,24,27,0.92)",
              color: "#fafafa",
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtShortDate(String(v))}
            formatter={(value, name) => [`${value}${unit}`, name]}
          />
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              strokeWidth={2.2}
              dot={minimal ? false : { r: 2.5 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
