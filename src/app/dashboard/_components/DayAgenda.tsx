import React from "react";
import Link from "next/link";
import { AppJoin, TaskJoin } from "../_types";
import { Pill } from "./Pill";
import { urgencyForDue } from "../_utils";

export function DayAgenda({
    selectedISO,
    tasks,
    apps,
    loading,
    busyTaskId,
    onToggleTask,
}: {
    selectedISO: string;
    tasks: TaskJoin[];
    apps: AppJoin[];
    loading: boolean;
    busyTaskId: string | null;
    onToggleTask: (taskId: string, checked: boolean, title: string) => void;
}) {
    const label = (() => {
        const [y, m, day] = selectedISO.split("-").map(Number);
        const dt = new Date(y, (m ?? 1) - 1, day ?? 1);
        return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    })();

    const count = tasks.length + apps.length;

    return (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">{label}</h2>
                    <p className="text-sm text-gray-500 mt-1">Your agenda for the day</p>
                </div>
                {count > 0 && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {count} item{count === 1 ? "" : "s"}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
                    <span className="text-sm">Loading...</span>
                </div>
            ) : count === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                    <div className="bg-blue-50 rounded-full h-16 w-16 flex items-center justify-center mb-4 text-2xl">
                        🌤️
                    </div>
                    <h3 className="text-gray-900 font-medium">Clear travels</h3>
                    <p className="text-gray-500 text-sm mt-1 max-w-[200px]">
                        Nothing due on this day. Use the time to relax or get ahead.
                    </p>
                </div>
            ) : (
                <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Tasks */}
                    {tasks.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 pl-1">Tasks</h3>
                            <ul className="space-y-2">
                                {tasks.map((t) => {
                                    const collegeName = t.applications?.my_schools?.schools?.name ?? "College";
                                    const appLabel = `${t.applications?.decision_type ?? "—"} · ${t.applications?.platform ?? "—"}`;
                                    const disabled = busyTaskId === t.id;

                                    const linkHref = t.application_id ? `/dashboard/applications/${t.application_id}` : null;

                                    return (
                                        <li key={t.id} className="bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    disabled={disabled}
                                                    checked={false}
                                                    onChange={(e) => onToggleTask(t.id, e.target.checked, t.title)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    {linkHref ? (
                                                        <Link href={linkHref} className="block group/link">
                                                            <div className="font-medium text-gray-900 group-hover/link:text-blue-600 transition-colors">
                                                                {t.title}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {collegeName} • {appLabel}
                                                            </div>
                                                        </Link>
                                                    ) : (
                                                        <div>
                                                            <div className="font-medium text-gray-900">{t.title}</div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {collegeName} • {appLabel}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Applications */}
                    {apps.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 pl-1">Deadlines</h3>
                            <div className="space-y-2">
                                {apps.map((a) => {
                                    const collegeName = a.my_schools?.schools?.name ?? "Unknown College";
                                    return (
                                        <Link
                                            key={a.id}
                                            href={`/dashboard/applications/${a.id}`}
                                            className="block bg-white border border-l-4 border-l-purple-500 rounded-xl p-3 shadow-sm hover:shadow-md transition-all hover:translate-x-1"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-gray-900">{collegeName}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {a.decision_type} · {a.platform}
                                                    </div>
                                                </div>
                                                <Pill kind="appStatus" value={a.status} />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
