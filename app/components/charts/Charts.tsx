"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

export default function Charts({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);

  const numericKeys = keys.filter(
    (k) => typeof data[0][k] === "number"
  );

  const labelKey = keys.find(
    (k) => typeof data[0][k] !== "number"
  );

  if (!labelKey || numericKeys.length === 0) return null;

  // MULTI LINE CHART (for multiple income columns)
  if (numericKeys.length > 1) {
    return (
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} />
            <YAxis />
            <Tooltip />

            {numericKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // SINGLE METRIC → BAR
  return (
    <div className="h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={labelKey} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={numericKeys[0]} fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
