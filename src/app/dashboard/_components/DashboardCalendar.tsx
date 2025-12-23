import React from "react";
import { addDays, isoDate, startOfMonth } from "../_utils";
import { CalendarCounts } from "../_types";

export function DashboardCalendar({
    month,
    viewMode,
    countsByDay,
    selectedISO,
    onPrev,
    onNext,
    onViewModeChange,
    onSelectDate,
}: {
    month: Date;
    viewMode: "month" | "upcoming";
    countsByDay: Record<string, CalendarCounts>;
    selectedISO: string | null;
    onPrev: () => void;
    onNext: () => void;
    onViewModeChange: (mode: "month" | "upcoming") => void;
    onSelectDate: (iso: string) => void;
}) {
    const todayISO = isoDate(new Date());

    // Calculate grid start based on view mode
    const gridStart = (() => {
        if (viewMode === "upcoming") {
            // Start from previous Sunday of today
            const d = new Date();
            const dow = d.getDay();
            return addDays(d, -dow);
        } else {
            // Standard month view
            const monthStart = startOfMonth(month);
            const d = new Date(monthStart);
            const dow = d.getDay(); // 0 Sun
            return addDays(d, -dow);
        }
    })();

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));

    const monthLabel = month.toLocaleString(undefined, { month: "long", year: "numeric" });
    const monthStartForMonthView = startOfMonth(month);

    return (
        <div className="rounded-2xl border bg-white p-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Calendar</h2>

                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex items-center p-0.5 bg-gray-100 rounded-lg">
                        <button
                            onClick={() => onViewModeChange("month")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "month"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => onViewModeChange("upcoming")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "upcoming"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Upcoming
                        </button>
                    </div>

                    {/* Navigation (Only show in Month mode) */}
                    {viewMode === "month" ? (
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 ml-2">
                            <button
                                className="rounded-md p-1.5 hover:bg-white hover:shadow-sm text-gray-500 transition-all"
                                onClick={onPrev}
                                aria-label="Previous month"
                            >
                                ←
                            </button>
                            <div className="text-sm font-medium text-gray-700 w-32 text-center select-none">
                                {monthLabel}
                            </div>
                            <button
                                className="rounded-md p-1.5 hover:bg-white hover:shadow-sm text-gray-500 transition-all"
                                onClick={onNext}
                                aria-label="Next month"
                            >
                                →
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 ml-2 px-3 py-1.5">
                            <span className="text-sm font-medium text-gray-700">Next 6 Weeks</span>
                        </div>
                    )}
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

                    // Formatting Logic:
                    // In "Upcoming" mode, show all days as active (white).
                    // In "Month" mode, gray out days not in the current month.
                    const isGrayedOut =
                        viewMode === "month" && d.getMonth() !== monthStartForMonthView.getMonth();

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
                                isGrayedOut
                                    ? "bg-gray-50/30 text-gray-300 border-transparent"
                                    : "bg-white border-transparent hover:border-gray-200 hover:shadow-sm",
                                isToday ? "bg-blue-50/30" : "",
                                isSelected
                                    ? "!border-blue-500 !bg-blue-50 ring-1 ring-blue-500 z-10 shadow-md"
                                    : "",
                            ].join(" ")}
                            aria-label={`Select ${dISO}`}
                        >
                            <span
                                className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : isGrayedOut ? "text-gray-300" : "text-gray-700"
                                    }`}
                            >
                                {d.getDate()}
                            </span>

                            {/* Always show if hasAny, regardless of month boundary */}
                            {hasAny && (
                                <div className={`w-full flex flex-col gap-0.5 mt-auto ${isGrayedOut ? 'opacity-60' : ''}`}>
                                    {tasksCount > 0 && (
                                        <div className="flex items-center gap-1 bg-amber-100 text-amber-800 rounded px-1 py-0.5 max-w-full">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                            <span className="text-[10px] font-bold leading-none truncate">
                                                {tasksCount} Task{tasksCount > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    )}
                                    {appsCount > 0 && (
                                        <div className="flex items-center gap-1 bg-purple-100 text-purple-800 rounded px-1 py-0.5 max-w-full">
                                            <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                                            <span className="text-[10px] font-bold leading-none truncate">
                                                {appsCount} App{appsCount > 1 ? "s" : ""}
                                            </span>
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
