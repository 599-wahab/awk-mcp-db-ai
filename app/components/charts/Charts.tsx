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
  Legend,
} from "recharts";

interface Props {
  data: any[];
  type?: string;
}

const COLORS = [
  "#4f46e5",
  "#7c3aed",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

export default function Charts({ data, type = "line" }: Props) {
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);

  const xKey = keys.find(
    (k) => typeof data[0][k] !== "number"
  ) || keys[0];

  const numericKeys = keys.filter(
    (k) => typeof data[0][k] === "number"
  );

  if (numericKeys.length === 0) return null;

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "pie" ? (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={data}
              dataKey={numericKeys[0]}
              nameKey={xKey}
              outerRadius={120}
              isAnimationActive={true}
              animationDuration={700}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        ) : type === "bar" || type === "stacked" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {numericKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                stackId={type === "stacked" ? "a" : undefined}
                isAnimationActive
                animationDuration={700}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {numericKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                isAnimationActive
                animationDuration={700}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
