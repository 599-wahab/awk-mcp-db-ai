"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#4f46e5", "#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export default function Charts({ data, type = "line" }: { data: any[]; type?: string }) {
  if (!data?.length) return null;
  const keys = Object.keys(data[0]);
  const xKey = keys.find(k => typeof data[0][k] !== "number") ?? keys[0];
  const numKeys = keys.filter(k => typeof data[0][k] === "number");
  if (!numKeys.length) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "pie" ? (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey={numKeys[0]} nameKey={xKey} outerRadius={90} isAnimationActive animationDuration={600}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        ) : type === "bar" || type === "stacked" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {numKeys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} stackId={type === "stacked" ? "a" : undefined} isAnimationActive animationDuration={600} radius={[3, 3, 0, 0]} />)}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {numKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}