import React from "react";
import Link from "next/link";

export function DashboardStats({
    collegeCount,
    applicationCount,
    openTaskCount,
}: {
    collegeCount: number;
    applicationCount: number;
    openTaskCount: number;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/colleges" className="block transition-transform hover:-translate-y-1">
                <StatCard
                    label="Colleges"
                    value={collegeCount}
                    icon="🏛️"
                    color="blue"
                    hoverEffect={false} // Handle hover in parent Link
                />
            </Link>
            <StatCard
                label="Applications"
                value={applicationCount}
                icon="🎓"
                color="purple"
            />
            <StatCard
                label="Open Tasks"
                value={openTaskCount}
                icon="⚡"
                color="amber"
            />
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    color,
    hoverEffect = true,
}: {
    label: string;
    value: number;
    icon: string;
    color: "blue" | "purple" | "amber";
    hoverEffect?: boolean;
}) {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600",
        purple: "bg-purple-50 text-purple-600",
        amber: "bg-amber-50 text-amber-600",
    };

    return (
        <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${hoverEffect ? "transition-transform hover:-translate-y-1 hover:shadow-md" : "hover:shadow-md"}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`rounded-xl p-3 text-2xl ${colorClasses[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
