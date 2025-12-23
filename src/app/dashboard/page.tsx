"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";

// Shared Types & Utils
import {
    addDays,
    endOfMonth,
    formatWeekLabel,
    isoDate,
    startOfDay,
    startOfMonth,
    weekStartISO,
} from "./_utils";
import { AppJoin, CalendarCounts, TaskJoin } from "./_types";

// Components
import { DashboardCalendar } from "./_components/DashboardCalendar";
import { DayAgenda } from "./_components/DayAgenda";
import { DashboardStats } from "./_components/DashboardStats";
import { DashboardTaskList } from "./_components/DashboardTaskList";
import { ReviewProgress } from "./_components/ReviewProgress";
import { StatusPieChart } from "./_components/StatusPieChart";

/* -------------------------------------------------------------------------------- */
/* Helper Functions (that were specific to logic and not just formatting)             */
/* -------------------------------------------------------------------------------- */

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

const FUN_MESSAGES = [
    "Nice work! You’re on a roll 🎉",
    "Boom. Task crushed 💥",
    "That’s progress. Keep going 🚀",
    "One step closer — love it ✅",
    "You just made future-you happier 😄",
    "Elite productivity unlocked 🏆",
];

/* -------------------------------------------------------------------------------- */
/* PAGE COMPONENT                                                                   */
/* -------------------------------------------------------------------------------- */

export default function DashboardPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();

    // User / Loading
    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Interactive State
    const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
    const [celebrate, setCelebrate] = useState<string | null>(null);

    // Data State
    const [collegeCount, setCollegeCount] = useState(0);
    const [applicationCount, setApplicationCount] = useState(0);
    const [openTaskCount, setOpenTaskCount] = useState(0);
    const [appsByStatus, setAppsByStatus] = useState<Record<string, number>>({});

    const [tasksOverdue, setTasksOverdue] = useState<TaskJoin[]>([]);
    const [tasksWeek, setTasksWeek] = useState<TaskJoin[]>([]);
    const [tasksMonth, setTasksMonth] = useState<TaskJoin[]>([]);

    // Calendar & Day Agenda
    const [viewMode, setViewMode] = useState<"month" | "upcoming">("month");
    const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
    const [calendarCountsByDay, setCalendarCountsByDay] = useState<Record<string, CalendarCounts>>({});

    const [selectedDayISO, setSelectedDayISO] = useState<string>(() => isoDate(new Date()));
    const [dayLoading, setDayLoading] = useState(false);
    const [dayTasks, setDayTasks] = useState<TaskJoin[]>([]);
    const [dayApps, setDayApps] = useState<AppJoin[]>([]);

    // Chart Data
    const [progressSeries, setProgressSeries] = useState<
        { week: string; tasksCompleted: number; applicationsSubmitted: number }[]
    >([]);

    // Toast
    function popCongrats(custom?: string) {
        const msg = custom ?? FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)];
        setCelebrate(msg);
        window.clearTimeout((popCongrats as any)._t);
        (popCongrats as any)._t = window.setTimeout(() => setCelebrate(null), 2500);
    }

    // Auth
    async function signOut() {
        await supabase.auth.signOut();
        router.replace("/login");
    }

    // Logic: Remove Task
    function removeTaskEverywhere(taskId: string) {
        setTasksOverdue((p) => p.filter((t) => t.id !== taskId));
        setTasksWeek((p) => p.filter((t) => t.id !== taskId));
        setTasksMonth((p) => p.filter((t) => t.id !== taskId));
        setDayTasks((p) => p.filter((t) => t.id !== taskId));
        setOpenTaskCount((n) => Math.max(0, n - 1));
    }

    // Logic: Toggle Task
    async function toggleTaskFromDashboard(taskId: string, nextDone: boolean, title: string) {
        setError(null);
        setBusyTaskId(taskId);

        try {
            const user = await getUserOrThrow();
            const patch: any = { done: nextDone };
            patch.completed_at = nextDone ? new Date().toISOString() : null;

            const { error: dbErr } = await supabase
                .from("tasks")
                .update(patch)
                .eq("id", taskId)
                .eq("owner_id", user.id);

            if (dbErr) throw dbErr;

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

    // Logic: Load Initial Data
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

        // Status Breakdown
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

    // Logic: Load Calendar
    async function loadCalendar() {
        try {
            const user = await getUserOrThrow();

            // Calculate grid range exactly as the UI does
            let gridStart: Date;
            if (viewMode === "upcoming") {
                const d = new Date();
                const dow = d.getDay();
                gridStart = addDays(d, -dow);
            } else {
                const monthStart = startOfMonth(calendarMonth);
                const d = new Date(monthStart);
                const dow = d.getDay();
                gridStart = addDays(d, -dow);
            }

            // Grid is always 6 weeks (42 days)
            const gridEnd = addDays(gridStart, 42);

            const startISO = isoDate(gridStart);
            const endISO = isoDate(gridEnd);

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

    // Logic: Load Day Agenda
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

    // Logic: Chart
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
            const weekCounts: Record<string, { tasksCompleted: number }> = {};

            let cursor = startOfDay(addDays(now, -7 * 11));
            for (let i = 0; i < 12; i++) {
                const key = weekStartISO(cursor);
                weeks.push(key);
                weekCounts[key] = { tasksCompleted: 0 };
                cursor = addDays(cursor, 7);
            }

            for (const r of doneTasks ?? []) {
                const ts = (r as any).completed_at as string | null;
                if (!ts) continue;
                const key = weekStartISO(new Date(ts));
                if (!weekCounts[key]) weekCounts[key] = { tasksCompleted: 0 };
                weekCounts[key].tasksCompleted += 1;
            }

            const series = weeks.map((w) => ({
                week: formatWeekLabel(w),
                tasksCompleted: weekCounts[w]?.tasksCompleted ?? 0,
                applicationsSubmitted: 0, // Ignored by component now
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

    // Effect: Init SWR (sort of)
    useEffect(() => {
        loadEverything();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Effect: Calendar View Changes
    useEffect(() => {
        loadCalendar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calendarMonth, viewMode]);

    // Effect: Day Selection Change
    useEffect(() => {
        loadDayAgenda(selectedDayISO);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDayISO]);


    const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const name = email ? email.split("@")[0] : "Friend";

    if (loading) {
        return <div className="p-12 text-center text-gray-500">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-8 pb-12">

            {/* TOAST */}
            <div className={`fixed top-20 right-4 z-50 transform transition-all duration-500 ${celebrate ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
                }`}>
                <div className="rounded-xl bg-gray-900 text-white px-6 py-3 shadow-xl text-sm font-medium">
                    {celebrate}
                </div>
            </div>

            {/* HEADER */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Hi, {name} 👋
                    </h1>
                    <div className="text-sm text-gray-500 hidden sm:block">
                        {dateStr}
                    </div>
                </div>
                <p className="text-gray-500">
                    Here’s what’s happening with your applications today.
                </p>
            </div>

            {/* ERROR */}
            {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-red-600 text-sm">
                    {error}
                </div>
            )}

            {/* STATS */}
            <DashboardStats
                collegeCount={collegeCount}
                applicationCount={applicationCount}
                openTaskCount={openTaskCount}
            />

            {/* MAIN GRID: Calendar (Wide) + Agenda (Narrow) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* CALENDAR (Left Col - Wider now) */}
                <div className="lg:col-span-8 h-[500px]">
                    <DashboardCalendar
                        month={calendarMonth}
                        viewMode={viewMode}
                        countsByDay={calendarCountsByDay}
                        selectedISO={selectedDayISO}
                        onPrev={() => setCalendarMonth(cm => addDays(cm, -30))} // Approximation, but startOfMonth fixes it
                        onNext={() => setCalendarMonth(cm => addDays(cm, 32))}
                        onViewModeChange={(m) => setViewMode(m)}
                        onSelectDate={(iso) => setSelectedDayISO(iso)}
                    />
                </div>

                {/* AGENDA (Right Col - Narrower) */}
                <div className="lg:col-span-4 h-[500px]">
                    <DayAgenda
                        selectedISO={selectedDayISO}
                        tasks={dayTasks}
                        apps={dayApps}
                        loading={dayLoading}
                        busyTaskId={busyTaskId}
                        onToggleTask={toggleTaskFromDashboard}
                    />
                </div>
            </div>

            {/* TASKS & PROGRESS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {/* Overdue - Always visible if tasks exist, or maybe keep it conditional but ensure logic is right.
                        User asked for "Overdue card". I'll keep the condition but maybe add an empty state or just trust the condition.
                        Actually, improving the empty state in the list component is better.
                    */}
                    {/* Overdue - Always visible as requested */}
                    <DashboardTaskList
                        title="Overdue"
                        items={tasksOverdue}
                        bucket="overdue"
                        busyTaskId={busyTaskId}
                        onToggle={toggleTaskFromDashboard}
                    />

                    {/* Due Soon */}
                    <DashboardTaskList
                        title="Due in 7 days"
                        items={tasksWeek}
                        bucket="week"
                        busyTaskId={busyTaskId}
                        onToggle={toggleTaskFromDashboard}
                    />

                    {/* Upcoming */}
                    <DashboardTaskList
                        title="Upcoming (30 days)"
                        items={tasksMonth}
                        bucket="month"
                        busyTaskId={busyTaskId}
                        onToggle={toggleTaskFromDashboard}
                    />
                </div>

                <div className="space-y-6">
                    {/* Application Status Pie Chart */}
                    <div className="h-[350px]">
                        <StatusPieChart appsByStatus={appsByStatus} />
                    </div>

                    {/* History Chart */}
                    <ReviewProgress data={progressSeries} />
                </div>
            </div>
        </div>
    );
}