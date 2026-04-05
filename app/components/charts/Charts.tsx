"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#e8ff47", "#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export default function Charts({ data, type = "line" }: { data: any[]; type?: string }) {
  if (!data?.length) return null;
  const keys = Object.keys(data[0]);
  const xKey = keys.find(k => typeof data[0][k] !== "number") ?? keys[0];
  const numKeys = keys.filter(k => typeof data[0][k] === "number");
  if (!numKeys.length) return null;

  const axisStyle = { fill: "#5a5a5a", fontSize: 10, fontFamily: "'Space Mono', monospace" };
  const gridStyle = { stroke: "#1e1e1e" };
  const tooltipStyle = { backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: 11 };

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "pie" ? (
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5a5a5a" }} />
            <Pie data={data} dataKey={numKeys[0]} nameKey={xKey} outerRadius={80} isAnimationActive animationDuration={600}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        ) : type === "bar" || type === "stacked" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
            <XAxis dataKey={xKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5a5a5a" }} />
            {numKeys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} stackId={type === "stacked" ? "a" : undefined} isAnimationActive animationDuration={600} />)}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
            <XAxis dataKey={xKey} tick={axisStyle} />
            <YAxis tick={axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5a5a5a" }} />
            {numKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}