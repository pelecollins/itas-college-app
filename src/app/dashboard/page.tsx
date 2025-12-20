"use client";

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

type SchoolMini = { id: string; name: string };

type MySchoolJoin = {
    id: string;
    schools: SchoolMini | null;
};

type AppJoin = {
    id: string;
    decision_type: string | null;
    platform: string | null;
    deadline_date: string | null;
    status: string | null;
    my_school_id: string | null;
    my_schools: MySchoolJoin | null;
};

type TaskJoin = {
    id: string;
    title: string;
    due_date: string | null;
    done: boolean;
    application_id: string | null;
    applications: AppJoin | null;
};

type CalendarCounts = {
    tasksDue: number;
    appsDue: number;
};

function isoDate(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, days: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
}
function addMonths(d: Date, months: number) {
    return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function daysUntil(dueISO: string) {
    const now = new Date();
    const today = startOfDay(now);
    const [y, m, d] = dueISO.split("-").map(Number);
    const due = new Date(y, (m ?? 1) - 1, d ?? 1);
    const ms = due.getTime() - today.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
}
function dueLabel(dueISO: string) {
    const n = daysUntil(dueISO);
    if (n < 0) return `${Math.abs(n)}d overdue`;
    if (n === 0) return "due today";
    if (n === 1) return "due tomorrow";
    return `due in ${n}d`;
}

function bucketTitle(bucket: "overdue" | "week" | "month") {
    if (bucket === "overdue") return "Overdue";
    if (bucket === "week") return "Due in 7 days";
    return "Due in 30 days";
}

const FUN_MESSAGES = [
    "Nice work! You’re on a roll 🎉",
    "Boom. Task crushed 💥",
    "That’s progress. Keep going 🚀",
    "One step closer — love it ✅",
    "You just made future-you happier 😄",
    "Elite productivity unlocked 🏆",
];

function weekStartISO(d: Date) {
    // Monday-start week
    const x = startOfDay(d);
    const day = x.getDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    return isoDate(addDays(x, diff));
}
function formatWeekLabel(iso: string) {
    const [, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
}

// ---------- Color helpers ----------
function pillClass(kind: "urgency" | "appStatus", value?: string | null) {
    const v = (value ?? "").toLowerCase();

    if (kind === "urgency") {
        if (v === "overdue") return "bg-red-100 text-red-800 border-red-200";
        if (v === "soon") return "bg-amber-100 text-amber-800 border-amber-200";
        if (v === "later") return "bg-sky-100 text-sky-800 border-sky-200";
        return "bg-gray-100 text-gray-800 border-gray-200";
    }

    // application status
    if (v === "not started") return "bg-gray-100 text-gray-800 border-gray-200";
    if (v === "in progress") return "bg-blue-100 text-blue-800 border-blue-200";
    if (v === "submitted") return "bg-green-100 text-green-800 border-green-200";
    if (v === "decided") return "bg-purple-100 text-purple-800 border-purple-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
}

function Pill({
    kind,
    value,
    label,
}: {
    kind: "urgency" | "appStatus";
    value?: string | null;
    label?: string;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${pillClass(
                kind,
                value
            )}`}
            title={label ?? value ?? ""}
        >
            {label ?? value ?? "—"}
        </span>
    );
}

function urgencyForDue(dueISO: string): "overdue" | "soon" | "later" {
    const n = daysUntil(dueISO);
    if (n < 0) return "overdue";
    if (n <= 7) return "soon";
    return "later";
}
// ----------------------------------

function DashboardCalendar({
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
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold">Calendar</h2>
                <div className="flex items-center gap-2">
                    <button className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50" onClick={onPrev}>
                        ←
                    </button>
                    <div className="text-sm text-gray-700 w-40 text-center">{monthLabel}</div>
                    <button className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50" onClick={onNext}>
                        →
                    </button>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-7 text-xs text-gray-600">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-2 text-center">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
                {days.map((d) => {
                    const dISO = isoDate(d);
                    const inMonth = d.getMonth() === monthStart.getMonth();
                    const c = countsByDay[dISO];
                    const isToday = dISO === todayISO;
                    const isSelected = selectedISO === dISO;

                    const hasAny = (c?.tasksDue ?? 0) > 0 || (c?.appsDue ?? 0) > 0;

                    return (
                        <button
                            key={dISO}
                            type="button"
                            onClick={() => onSelectDate(dISO)}
                            className={[
                                "rounded-xl border p-2 min-h-[64px] text-left transition-colors",
                                inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50 opacity-70 hover:opacity-100",
                                isToday ? "ring-2 ring-black" : "",
                                isSelected ? "outline outline-2 outline-offset-0 outline-black" : "",
                            ].join(" ")}
                            aria-label={`Select ${dISO}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-700">{d.getDate()}</div>
                                {hasAny ? (
                                    <div className="text-[10px] text-gray-600">
                                        {c?.tasksDue ? `🧩${c.tasksDue}` : ""}{" "}
                                        {c?.appsDue ? `🎓${c.appsDue}` : ""}
                                    </div>
                                ) : null}
                            </div>

                            {hasAny ? (
                                <div className="mt-2 text-[11px] text-gray-700 space-y-1">
                                    {c?.tasksDue ? <div>{c.tasksDue} task due</div> : null}
                                    {c?.appsDue ? <div>{c.appsDue} app deadline</div> : null}
                                </div>
                            ) : (
                                <div className="mt-2 text-[11px] text-gray-400">—</div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-3 text-xs text-gray-600">Legend: 🧩 tasks due · 🎓 application deadlines</div>
        </div>
    );
}

export default function DashboardPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();

    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [collegeCount, setCollegeCount] = useState(0);
    const [applicationCount, setApplicationCount] = useState(0);
    const [openTaskCount, setOpenTaskCount] = useState(0);
    const [appsByStatus, setAppsByStatus] = useState<Record<string, number>>({});

    const [tasksOverdue, setTasksOverdue] = useState<TaskJoin[]>([]);
    const [tasksWeek, setTasksWeek] = useState<TaskJoin[]>([]);
    const [tasksMonth, setTasksMonth] = useState<TaskJoin[]>([]);

    const [celebrate, setCelebrate] = useState<string | null>(null);

    const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
    const [calendarCountsByDay, setCalendarCountsByDay] = useState<Record<string, CalendarCounts>>({});

    // NEW: day selection + day agenda
    const [selectedDayISO, setSelectedDayISO] = useState<string>(() => isoDate(new Date()));
    const [dayLoading, setDayLoading] = useState(false);
    const [dayTasks, setDayTasks] = useState<TaskJoin[]>([]);
    const [dayApps, setDayApps] = useState<AppJoin[]>([]);

    const [progressSeries, setProgressSeries] = useState<
        { week: string; tasksCompleted: number; applicationsSubmitted: number }[]
    >([]);

    function popCongrats(custom?: string) {
        const msg = custom ?? FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)];
        setCelebrate(msg);
        window.clearTimeout((popCongrats as any)._t);
        (popCongrats as any)._t = window.setTimeout(() => setCelebrate(null), 2500);
    }

    async function signOut() {
        await supabase.auth.signOut();
        router.replace("/login");
    }

    function removeTaskEverywhere(taskId: string) {
        setTasksOverdue((p) => p.filter((t) => t.id !== taskId));
        setTasksWeek((p) => p.filter((t) => t.id !== taskId));
        setTasksMonth((p) => p.filter((t) => t.id !== taskId));
        setDayTasks((p) => p.filter((t) => t.id !== taskId));
        setOpenTaskCount((n) => Math.max(0, n - 1));
    }

    async function toggleTaskFromDashboard(taskId: string, nextDone: boolean, title: string) {
        setError(null);
        setBusyTaskId(taskId);

        try {
            const user = await getUserOrThrow();

            const patch: any = { done: nextDone };
            patch.completed_at = nextDone ? new Date().toISOString() : null;

            const { error } = await supabase
                .from("tasks")
                .update(patch)
                .eq("id", taskId)
                .eq("owner_id", user.id);

            if (error) throw error;

            if (nextDone) {
                removeTaskEverywhere(taskId);
                popCongrats(`✅ "${title}" — done!`);
            } else {
                await loadEverything();
            }

            await Promise.all([loadCalendar(), loadProgressChart(), loadDayAgenda(selectedDayISO)]);
        } catch (e: any) {
            setError(e?.message ?? "Failed to update task");
        } finally {
            setBusyTaskId(null);
        }
    }

    async function loadOverviewAndBuckets(userId: string) {
        const [collegesRes, appsRes, openTasksRes] = await Promise.all([
            supabase.from("my_schools").select("id", { count: "exact", head: true }).eq("owner_id", userId),
            supabase.from("applications").select("id,status", { count: "exact" }).eq("owner_id", userId),
            supabase.from("tasks").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("done", false),
        ]);

        if (collegesRes.error) throw collegesRes.error;
        if (appsRes.error) throw appsRes.error;
        if (openTasksRes.error) throw openTasksRes.error;

        setCollegeCount(collegesRes.count ?? 0);
        setApplicationCount(appsRes.count ?? 0);
        setOpenTaskCount(openTasksRes.count ?? 0);

        const statusCounts: Record<string, number> = {};
        for (const row of appsRes.data ?? []) {
            const s = row.status ?? "Unknown";
            statusCounts[s] = (statusCounts[s] ?? 0) + 1;
        }
        setAppsByStatus(statusCounts);

        const todayISO = isoDate(new Date());
        const in7ISO = isoDate(addDays(new Date(), 7));
        const in30ISO = isoDate(addDays(new Date(), 30));

        const { data: taskData, error: taskError } = await supabase
            .from("tasks")
            .select(
                "id,title,due_date,done,application_id,applications(id,decision_type,platform,deadline_date,status,my_school_id,my_schools(id,schools(id,name)))"
            )
            .eq("owner_id", userId)
            .eq("done", false)
            .not("due_date", "is", null)
            .lte("due_date", in30ISO)
            .order("due_date", { ascending: true });

        if (taskError) throw taskError;

        const rawTasks = (taskData ?? []) as any[];

        const all: TaskJoin[] = rawTasks.map((t) => {
            const app = firstOrNull<any>(t.applications);
            const ms = firstOrNull<any>(app?.my_schools);
            const school = firstOrNull<any>(ms?.schools);

            return {
                ...t,
                applications: app
                    ? {
                        ...app,
                        my_schools: ms
                            ? {
                                ...ms,
                                schools: school ? { id: school.id, name: school.name } : null,
                            }
                            : null,
                    }
                    : null,
            };
        });

        const overdue: TaskJoin[] = [];
        const week: TaskJoin[] = [];
        const month: TaskJoin[] = [];

        for (const t of all) {
            if (!t.due_date) continue;
            if (t.due_date < todayISO) overdue.push(t);
            else if (t.due_date <= in7ISO) week.push(t);
            else month.push(t);
        }

        setTasksOverdue(overdue);
        setTasksWeek(week);
        setTasksMonth(month);
    }

    async function loadCalendar() {
        try {
            const user = await getUserOrThrow();
            const mStart = startOfMonth(calendarMonth);
            const mEnd = endOfMonth(calendarMonth);

            const startISO = isoDate(mStart);
            const endISO = isoDate(mEnd);

            const { data: tasks, error: tErr } = await supabase
                .from("tasks")
                .select("due_date")
                .eq("owner_id", user.id)
                .eq("done", false)
                .not("due_date", "is", null)
                .gte("due_date", startISO)
                .lte("due_date", endISO);

            if (tErr) throw tErr;

            const { data: apps, error: aErr } = await supabase
                .from("applications")
                .select("deadline_date")
                .eq("owner_id", user.id)
                .not("deadline_date", "is", null)
                .gte("deadline_date", startISO)
                .lte("deadline_date", endISO);

            if (aErr) throw aErr;

            const buckets: Record<string, CalendarCounts> = {};

            for (const row of tasks ?? []) {
                const d = (row as any).due_date as string | null;
                if (!d) continue;
                buckets[d] = buckets[d] ?? { tasksDue: 0, appsDue: 0 };
                buckets[d].tasksDue += 1;
            }

            for (const row of apps ?? []) {
                const d = (row as any).deadline_date as string | null;
                if (!d) continue;
                buckets[d] = buckets[d] ?? { tasksDue: 0, appsDue: 0 };
                buckets[d].appsDue += 1;
            }

            setCalendarCountsByDay(buckets);
        } catch (e: any) {
            setError((prev) => prev ?? e?.message ?? "Failed to load calendar");
        }
    }

    // NEW: load the selected day's tasks + app deadlines (with joins for display)
    async function loadDayAgenda(dayISO: string) {
        setDayLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            const [tasksRes, appsRes] = await Promise.all([
                supabase
                    .from("tasks")
                    .select(
                        "id,title,due_date,done,application_id,applications(id,decision_type,platform,deadline_date,status,my_school_id,my_schools(id,schools(id,name)))"
                    )
                    .eq("owner_id", user.id)
                    .eq("done", false)
                    .eq("due_date", dayISO)
                    .order("due_date", { ascending: true }),
                supabase
                    .from("applications")
                    .select("id,decision_type,platform,deadline_date,status,my_school_id,my_schools(id,schools(id,name))")
                    .eq("owner_id", user.id)
                    .eq("deadline_date", dayISO)
                    .order("created_at", { ascending: false }),
            ]);

            if (tasksRes.error) throw tasksRes.error;
            if (appsRes.error) throw appsRes.error;

            const rawTasks = (tasksRes.data ?? []) as any[];
            const normalizedTasks: TaskJoin[] = rawTasks.map((t) => {
                const app = firstOrNull<any>(t.applications);
                const ms = firstOrNull<any>(app?.my_schools);
                const school = firstOrNull<any>(ms?.schools);

                return {
                    ...t,
                    applications: app
                        ? {
                            ...app,
                            my_schools: ms
                                ? {
                                    ...ms,
                                    schools: school ? { id: school.id, name: school.name } : null,
                                }
                                : null,
                        }
                        : null,
                };
            });

            const rawApps = (appsRes.data ?? []) as any[];
            const normalizedApps: AppJoin[] = rawApps.map((a) => {
                const ms = firstOrNull<any>(a.my_schools);
                const school = firstOrNull<any>(ms?.schools);
                return {
                    ...a,
                    my_schools: ms
                        ? { ...ms, schools: school ? { id: school.id, name: school.name } : null }
                        : null,
                };
            });

            setDayTasks(normalizedTasks);
            setDayApps(normalizedApps);
        } catch (e: any) {
            setError(e?.message ?? "Failed to load day agenda");
        } finally {
            setDayLoading(false);
        }
    }

    async function loadProgressChart() {
        try {
            const user = await getUserOrThrow();

            const now = new Date();
            const start = addDays(now, -7 * 11);
            const startISO = start.toISOString();

            const { data: doneTasks, error: dtErr } = await supabase
                .from("tasks")
                .select("completed_at")
                .eq("owner_id", user.id)
                .not("completed_at", "is", null)
                .gte("completed_at", startISO);

            if (dtErr) throw dtErr;

            const { data: submittedApps, error: saErr } = await supabase
                .from("applications")
                .select("submitted_at")
                .eq("owner_id", user.id)
                .not("submitted_at", "is", null)
                .gte("submitted_at", startISO);

            if (saErr) throw saErr;

            const weeks: string[] = [];
            const weekCounts: Record<string, { tasksCompleted: number; applicationsSubmitted: number }> = {};

            let cursor = startOfDay(addDays(now, -7 * 11));
            for (let i = 0; i < 12; i++) {
                const key = weekStartISO(cursor);
                weeks.push(key);
                weekCounts[key] = { tasksCompleted: 0, applicationsSubmitted: 0 };
                cursor = addDays(cursor, 7);
            }

            for (const r of doneTasks ?? []) {
                const ts = (r as any).completed_at as string | null;
                if (!ts) continue;
                const key = weekStartISO(new Date(ts));
                if (!weekCounts[key]) weekCounts[key] = { tasksCompleted: 0, applicationsSubmitted: 0 };
                weekCounts[key].tasksCompleted += 1;
            }

            for (const r of submittedApps ?? []) {
                const ts = (r as any).submitted_at as string | null;
                if (!ts) continue;
                const key = weekStartISO(new Date(ts));
                if (!weekCounts[key]) weekCounts[key] = { tasksCompleted: 0, applicationsSubmitted: 0 };
                weekCounts[key].applicationsSubmitted += 1;
            }

            const series = weeks.map((w) => ({
                week: formatWeekLabel(w),
                tasksCompleted: weekCounts[w]?.tasksCompleted ?? 0,
                applicationsSubmitted: weekCounts[w]?.applicationsSubmitted ?? 0,
            }));

            setProgressSeries(series);
        } catch (e: any) {
            setError((prev) => prev ?? e?.message ?? "Failed to load progress chart");
        }
    }

    async function loadEverything() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();
            setEmail(user.email ?? null);

            await Promise.all([loadOverviewAndBuckets(user.id), loadCalendar(), loadProgressChart(), loadDayAgenda(selectedDayISO)]);
        } catch (e: any) {
            if (String(e?.message).toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setError(e?.message ?? "Failed to load dashboard");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadEverything();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadCalendar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calendarMonth]);

    // When selected day changes, refresh that agenda
    useEffect(() => {
        loadDayAgenda(selectedDayISO);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDayISO]);

    function TaskList({
        title,
        items,
        bucket,
    }: {
        title: string;
        items: TaskJoin[];
        bucket: "overdue" | "week" | "month";
    }) {
        return (
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between">
                    <h2 className="font-semibold">{title}</h2>
                    <span className="text-sm text-gray-600">{items.length}</span>
                </div>

                {items.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-600">Nothing here 🎉</p>
                ) : (
                    <ul className="mt-3 divide-y">
                        {items.slice(0, 12).map((t) => {
                            const collegeName = t.applications?.my_schools?.schools?.name ?? "College";
                            const appLabel = `${t.applications?.decision_type ?? "—"} · ${t.applications?.platform ?? "—"}`;
                            const due = t.due_date ?? "";
                            const disabled = busyTaskId === t.id;

                            const urgency = due ? urgencyForDue(due) : "later";

                            return (
                                <li key={t.id} className="py-3 hover:bg-gray-50 transition-colors rounded-xl px-2 -mx-2">
                                    <div className="flex items-start justify-between gap-4">
                                        <label className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="mt-1"
                                                disabled={disabled}
                                                checked={false}
                                                onChange={(e) => toggleTaskFromDashboard(t.id, e.target.checked, t.title)}
                                            />
                                            <div className="min-w-0">
                                                <div className="font-medium break-words">{t.title}</div>
                                                <div className="text-sm text-gray-600">
                                                    {collegeName} · {appLabel}
                                                </div>
                                            </div>
                                        </label>

                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            {due && (
                                                <Pill kind="urgency" value={urgency} label={dueLabel(due)} />
                                            )}

                                            {t.application_id ? (
                                                <Link href={`/dashboard/applications/${t.application_id}`} className="text-sm underline text-gray-700">
                                                    Open
                                                </Link>
                                            ) : (
                                                <span className="text-sm text-gray-400">No app</span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {items.length > 12 && <p className="mt-3 text-sm text-gray-600">Showing 12 of {items.length}.</p>}
            </div>
        );
    }

    function DayAgenda() {
        const d = selectedDayISO;
        const label = (() => {
            const [y, m, day] = d.split("-").map(Number);
            const dt = new Date(y, (m ?? 1) - 1, day ?? 1);
            return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
        })();

        return (
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between">
                    <div>
                        <h2 className="font-semibold">Due on {label}</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Click an item to open its application.
                        </p>
                    </div>
                    <span className="text-sm text-gray-600">
                        {(dayTasks?.length ?? 0) + (dayApps?.length ?? 0)} item{(dayTasks.length + dayApps.length) === 1 ? "" : "s"}
                    </span>
                </div>

                {dayLoading ? (
                    <div className="mt-4 text-sm text-gray-600">Loading day…</div>
                ) : (dayTasks.length === 0 && dayApps.length === 0) ? (
                    <div className="mt-4 text-sm text-gray-600">Nothing due this day 🎉</div>
                ) : (
                    <div className="mt-4 space-y-4">
                        {/* Tasks due */}
                        <div>
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Tasks</h3>
                                <span className="text-sm text-gray-600">{dayTasks.length}</span>
                            </div>

                            {dayTasks.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-600">No tasks due.</p>
                            ) : (
                                <ul className="mt-2 divide-y">
                                    {dayTasks.map((t) => {
                                        const collegeName = t.applications?.my_schools?.schools?.name ?? "College";
                                        const appLabel = `${t.applications?.decision_type ?? "—"} · ${t.applications?.platform ?? "—"}`;
                                        const due = t.due_date ?? selectedDayISO;
                                        const disabled = busyTaskId === t.id;
                                        const urgency = urgencyForDue(due);

                                        return (
                                            <li key={t.id} className="py-3 rounded-xl px-2 -mx-2 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-start justify-between gap-4">
                                                    <label className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="mt-1"
                                                            disabled={disabled}
                                                            checked={false}
                                                            onChange={(e) => toggleTaskFromDashboard(t.id, e.target.checked, t.title)}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="font-medium break-words">{t.title}</div>
                                                            <div className="text-sm text-gray-600">
                                                                {collegeName} · {appLabel}
                                                            </div>
                                                        </div>
                                                    </label>

                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        <Pill kind="urgency" value={urgency} label={dueLabel(due)} />
                                                        {t.application_id ? (
                                                            <Link
                                                                href={`/dashboard/applications/${t.application_id}`}
                                                                className="text-sm underline text-gray-700"
                                                            >
                                                                Open
                                                            </Link>
                                                        ) : (
                                                            <span className="text-sm text-gray-400">No app</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Application deadlines */}
                        <div>
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Application deadlines</h3>
                                <span className="text-sm text-gray-600">{dayApps.length}</span>
                            </div>

                            {dayApps.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-600">No application deadlines.</p>
                            ) : (
                                <ul className="mt-2 divide-y">
                                    {dayApps.map((a) => {
                                        const collegeName = a.my_schools?.schools?.name ?? "College";
                                        const label = `${a.decision_type ?? "—"} · ${a.platform ?? "—"}`;
                                        return (
                                            <li key={a.id} className="py-3 rounded-xl px-2 -mx-2 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="font-medium break-words">{collegeName}</div>
                                                        <div className="text-sm text-gray-600">{label}</div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Pill kind="appStatus" value={a.status ?? "Unknown"} />
                                                        <Link
                                                            href={`/dashboard/applications/${a.id}`}
                                                            className="text-sm underline text-gray-700"
                                                        >
                                                            Open
                                                        </Link>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {celebrate && (
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div className="font-medium">{celebrate}</div>
                        <button className="text-sm underline text-gray-600" onClick={() => setCelebrate(null)}>
                            close
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-gray-600 mt-1">Signed in as: {email ?? "…"}</p>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/dashboard/colleges" className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                        Colleges
                    </Link>
                    <Link href="/dashboard/map" className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                        Map
                    </Link>
                    <button onClick={loadEverything} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                        Refresh
                    </button>
                    <button onClick={signOut} className="rounded-xl bg-black px-3 py-2 text-sm text-white">
                        Sign out
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border bg-white p-4 shadow-sm text-sm text-red-600">{error}</div>
            )}

            {/* Top stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        <div className="text-sm text-gray-600">Colleges</div>
                    </div>
                    <div className="text-3xl font-semibold mt-1">{collegeCount}</div>
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        <div className="text-sm text-gray-600">Applications</div>
                    </div>
                    <div className="text-3xl font-semibold mt-1">{applicationCount}</div>
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <div className="text-sm text-gray-600">Open tasks</div>
                    </div>
                    <div className="text-3xl font-semibold mt-1">{openTaskCount}</div>
                </div>
            </div>

            {/* Apps by status */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Applications by status</h2>
                {Object.keys(appsByStatus).length === 0 ? (
                    <p className="mt-3 text-sm text-gray-600">No applications yet.</p>
                ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(appsByStatus).map(([k, v]) => (
                            <span key={k} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${pillClass("appStatus", k)}`}>
                                <span>{k}</span>
                                <span className="font-semibold">{v}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Tasks buckets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <TaskList title={bucketTitle("overdue")} items={tasksOverdue} bucket="overdue" />
                <TaskList title={bucketTitle("week")} items={tasksWeek} bucket="week" />
                <TaskList title={bucketTitle("month")} items={tasksMonth} bucket="month" />
            </div>

            {/* Calendar + Day Agenda */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DashboardCalendar
                    month={calendarMonth}
                    countsByDay={calendarCountsByDay}
                    selectedISO={selectedDayISO}
                    onPrev={() => setCalendarMonth((m) => addMonths(m, -1))}
                    onNext={() => setCalendarMonth((m) => addMonths(m, 1))}
                    onSelectDate={(iso) => setSelectedDayISO(iso)}
                />

                <DayAgenda />
            </div>

            {/* Progress */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Progress</h2>
                <p className="text-sm text-gray-600 mt-1">Tasks completed + applications submitted (weekly)</p>

                <div className="mt-4 h-64 min-h-[256px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="tasksCompleted" />
                            <Line type="monotone" dataKey="applicationsSubmitted" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                    Tip: set <code>submitted_at</code> when an application transitions to “Submitted” to power the chart.
                </p>
            </div>

            {loading && <div className="text-sm text-gray-600">Loading…</div>}
        </div>
    );
}