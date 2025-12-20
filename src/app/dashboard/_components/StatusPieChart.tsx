import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = {
    "not started": "#e5e7eb", // gray-200
    "in progress": "#60a5fa", // blue-400
    "submitted": "#34d399",   // emerald-400
    "decided": "#a78bfa",     // violet-400
};

const DEFAULT_COLOR = "#9ca3af"; // gray-400

export function StatusPieChart({
    appsByStatus,
}: {
    appsByStatus: Record<string, number>;
}) {
    const data = Object.entries(appsByStatus).map(([status, count]) => ({
        name: status,
        value: count,
    })).filter(x => x.value > 0);

    // Sort to keep consistent colors if possible, or mapping is better?
    // Let's just map colors based on name

    if (data.length === 0) {
        return (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm h-full flex flex-col items-center justify-center text-gray-400">
                <p>No applications yet</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm h-full">
            <h2 className="font-semibold text-gray-900 mb-4">Application Status</h2>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => {
                                const k = entry.name.toLowerCase();
                                const fill = (COLORS as any)[k] ?? DEFAULT_COLOR;
                                return <Cell key={`cell-${index}`} fill={fill} stroke="none" />;
                            })}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
