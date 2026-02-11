"use client";

import Card from "../ui/Card";

interface KPIProps {
  data: any[];
}

export default function KPI({ data }: KPIProps) {
  if (!data || data.length !== 1) return null;

  const row = data[0];
  const keys = Object.keys(row);

  const numericKey = keys.find(
    k => typeof row[k] === "number"
  );

  if (!numericKey) return null;

  return (
    <Card>
      <div className="text-center py-6">
        <p className="text-sm text-gray-500 uppercase tracking-wide">
          {numericKey.replace(/_/g, " ")}
        </p>
        <p className="text-4xl font-bold text-indigo-600 mt-2">
          {new Intl.NumberFormat().format(row[numericKey])}
        </p>
      </div>
    </Card>
  );
}
