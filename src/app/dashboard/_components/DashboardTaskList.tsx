import React from "react";
import Link from "next/link";
import { TaskJoin } from "../_types";
import { Pill } from "./Pill";
import { dueLabel, urgencyForDue } from "../_utils";

export function DashboardTaskList({
    title,
    items,
    bucket,
    busyTaskId,
    onToggle,
}: {
    title: string;
    items: TaskJoin[];
    bucket?: "overdue" | "week" | "month";
    busyTaskId: string | null;
    onToggle: (taskId: string, checked: boolean, title: string) => void;
}) {
    // If specific styling is needed per bucket, use the prop.
    // For now, consistent styling.

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between mb-4">
                <h2 className="font-semibold text-gray-900">{title}</h2>
                <span className="inline-flex h-5 items-center justify-center rounded-full bg-gray-100 px-2 text-xs font-medium text-gray-600">
                    {items.length}
                </span>
            </div>

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-2xl mb-2">🎉</div>
                    <p className="text-sm text-gray-500">All caught up!</p>
                </div>
            ) : (
                <ul className="space-y-1">
                    {items.slice(0, 12).map((t) => {
                        const collegeName = t.applications?.my_schools?.schools?.name ?? "College";
                        const appLabel = `${t.applications?.decision_type ?? "—"} · ${t.applications?.platform ?? "—"}`;
                        const due = t.due_date ?? "";
                        const disabled = busyTaskId === t.id;

                        const urgency = due ? urgencyForDue(due) : "later";

                        return (
                            <li key={t.id} className="group relative flex items-start justify-between gap-3 rounded-xl p-3 transition-all hover:bg-gray-50">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="relative pt-0.5">
                                        <input
                                            type="checkbox"
                                            className="peer h-4 w-4 shrink-0 cursor-pointer rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                            disabled={disabled}
                                            checked={false} // Always false until they vanish
                                            onChange={(e) => onToggle(t.id, e.target.checked, t.title)}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-gray-900 break-words leading-tight">{t.title}</div>
                                        <div className="mt-0.5 text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                                            <span className="truncate max-w-[150px] font-medium text-gray-600">{collegeName}</span>
                                            <span className="text-gray-300">•</span>
                                            <span className="truncate">{appLabel}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    {due && (
                                        <Pill kind="urgency" value={urgency} label={dueLabel(due)} />
                                    )}

                                    {t.application_id && (
                                        <Link
                                            href={`/dashboard/applications/${t.application_id}`}
                                            className="text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            View App →
                                        </Link>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {items.length > 12 && (
                <div className="mt-4 border-t pt-3 text-center">
                    <span className="text-xs text-gray-500">Showing 12 of {items.length} tasks</span>
                </div>
            )}
        </div>
    );
}
