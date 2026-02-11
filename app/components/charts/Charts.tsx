"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Card from "../ui/Card";

const COLORS = ["#4f46e5", "#7c3aed", "#06b6d4", "#10b981", "#f59e0b"];

interface ChartData {
  [key: string]: string | number;
}

export default function Charts({
  data,
  type,
  onDrillDown,
}: {
  data: ChartData[];
  type: "bar" | "pie" | "line";
  onDrillDown?: (value: string) => void;
}) {
  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);
  const xKey = keys[0];
  const yKey = keys.find(k => typeof data[0][k] === "number") || keys[1];

  return (
    <Card>
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" && (
            <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                outerRadius={120}
                onClick={(d: any) =>
                  onDrillDown && onDrillDown(d.payload[xKey])
                }
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          )}

          {type === "bar" && (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey={yKey}
                fill="#4f46e5"
                onClick={(d: any) =>
                  onDrillDown && onDrillDown(d.payload[xKey])
                }
              />
            </BarChart>
          )}

          {type === "line" && (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey={yKey} stroke="#4f46e5" />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
