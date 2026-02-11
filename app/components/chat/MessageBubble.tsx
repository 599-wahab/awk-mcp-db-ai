"use client";

import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../data/DataTable";
import Charts from "../charts/Charts";
import KPI from "../data/KPI";

interface Props {
  message: any;
  onDrillDown?: (value: string) => void;
}

export default function MessageBubble({ message, onDrillDown }: Props) {
  const data = message.result;
  const type = message.visualization;

  return (
    <div className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white border shadow-sm">
        <p className="mb-4">{message.content}</p>

        <AnimatePresence mode="wait">
          {!message.isUser && data && (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {type === "kpi" && <KPI data={data} />}
              {type === "table" && <DataTable data={data} />}
              {(type === "bar" || type === "pie" || type === "line") && (
                <Charts
                  data={data}
                  type={type}
                  onDrillDown={onDrillDown}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
