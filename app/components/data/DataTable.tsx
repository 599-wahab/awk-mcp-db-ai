//app/components/data/DataTable.tsx
"use client";

import { useState } from "react";
import Card from "../ui/Card";

interface DataTableProps {
  data: any[];
}

export default function DataTable({ data }: DataTableProps) {
  if (!data || data.length === 0) return null;

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const columns = Object.keys(data[0]);

  const sortedData = [...data];
  if (sortConfig) {
    sortedData.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Query Results</h3>
          <p className="text-sm text-gray-600">
            {data.length} rows • {columns.length} columns
          </p>
        </div>
        <button className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>
      
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => requestSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col.replace(/_/g, ' ').toUpperCase()}
                    {sortConfig?.key === col && (
                      <span className="text-gray-400">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.slice(0, 100).map((row, i) => (
              <tr 
                key={i} 
                className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {typeof row[col] === 'number' 
                      ? new Intl.NumberFormat().format(row[col])
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            Showing first 100 of {data.length} rows
          </div>
        )}
      </div>
    </Card>
  );
}