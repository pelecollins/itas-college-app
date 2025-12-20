import React from "react";
import { addDays, isoDate, startOfMonth } from "../_utils";
import { CalendarCounts } from "../_types";

export function DashboardCalendar({
    month,
    countsByDay,
    selectedISO,
    onPrev,
    onNext,
    onSelectDate,
}: {
    month: Date;
    countsByDay: Record<string, CalendarCounts>;
    selectedISO: string | null;
    onPrev: () => void;
    onNext: () => void;
    onSelectDate: (iso: string) => void;
}) {
    const todayISO = isoDate(new Date());
    const monthStart = startOfMonth(month);

    const gridStart = (() => {
        const d = new Date(monthStart);
        const dow = d.getDay(); // 0 Sun
        return addDays(d, -dow);
    })();

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));

    const monthLabel = month.toLocaleString(undefined, { month: "long", year: "numeric" });

    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Calendar</h2>
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
                    <button
                        className="rounded-md p-1.5 hover:bg-white hover:shadow-sm text-gray-500 transition-all"
                        onClick={onPrev}
                        aria-label="Previous month"
                    >
                        ←
                    </button>
                    <div className="text-sm font-medium text-gray-700 w-32 text-center select-none">{monthLabel}</div>
                    <button
                        className="rounded-md p-1.5 hover:bg-white hover:shadow-sm text-gray-500 transition-all"
                        onClick={onNext}
                        aria-label="Next month"
                    >
                        →
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center py-1">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1 min-h-[300px]">
                {days.map((d) => {
                    const dISO = isoDate(d);
                    const inMonth = d.getMonth() === monthStart.getMonth();
                    const c = countsByDay[dISO];
                    const isToday = dISO === todayISO;
                    const isSelected = selectedISO === dISO;

                    const tasksCount = c?.tasksDue ?? 0;
                    const appsCount = c?.appsDue ?? 0;
                    const hasAny = tasksCount > 0 || appsCount > 0;

                    return (
                        <button
                            key={dISO}
                            type="button"
                            onClick={() => onSelectDate(dISO)}
                            className={[
                                "relative rounded-lg flex flex-col items-start justify-start p-1.5 transition-all duration-200 border group",
                                inMonth ? "bg-white border-transparent hover:border-gray-200 hover:shadow-sm" : "bg-gray-50/30 text-gray-300 border-transparent",
                                isToday ? "bg-blue-50/30" : "",
                                isSelected ? "!border-blue-500 !bg-blue-50 ring-1 ring-blue-500 z-10 shadow-md" : "",
                            ].join(" ")}
                            aria-label={`Select ${dISO}`}
                        >
                            <span className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : "text-gray-700"}`}>
                                {d.getDate()}
                            </span>

                            {(inMonth && hasAny) && (
                                <div className="w-full flex flex-col gap-0.5 mt-auto">
                                    {tasksCount > 0 && (
                                        <div className="flex items-center gap-1 bg-amber-100 text-amber-800 rounded px-1 py-0.5 max-w-full">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                            <span className="text-[10px] font-bold leading-none truncate">{tasksCount} Task{tasksCount > 1 ? 's' : ''}</span>
                                        </div>
                                    )}
                                    {appsCount > 0 && (
                                        <div className="flex items-center gap-1 bg-purple-100 text-purple-800 rounded px-1 py-0.5 max-w-full">
                                            <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                                            <span className="text-[10px] font-bold leading-none truncate">{appsCount} App{appsCount > 1 ? 's' : ''}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 justify-start border-t pt-3">
                <span className="font-medium mr-1">Legend:</span>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Tasks Due</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Application Deadlines</span>
                </div>
            </div>
        </div>
    );
}
