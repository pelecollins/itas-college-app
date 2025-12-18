"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";

type ApplicationRow = {
    id: string;
    created_at: string;
    owner_id: string;
    college_id: string;

    platform: string | null;
    decision_type: string | null;
    deadline_date: string | null;
    status: string;
    portal_url: string | null;

    submitted_at: string | null;
    decided_at: string | null;

    colleges?: {
        id: string;
        name: string;
    } | null;
};

type TaskRow = {
    id: string;
    created_at: string;
    owner_id: string;
    application_id: string;
    title: string;
    due_date: string | null;
    done: boolean;
    completed_at: string | null;
};

function friendlyDateTime(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString();
}

export default function ApplicationDetailPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();
    const params = useParams();
    const applicationId = params.id as string;

    const [app, setApp] = useState<ApplicationRow | null>(null);
    const [tasks, setTasks] = useState<TaskRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingApp, setSavingApp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // task form
    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState("");

    // application edit form state
    const [platform, setPlatform] = useState("Common App");
    const [decisionType, setDecisionType] = useState("RD");
    const [deadline, setDeadline] = useState("");
    const [status, setStatus] = useState("Not started");
    const [portalUrl, setPortalUrl] = useState("");

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            const { data: appData, error: appError } = await supabase
                .from("applications")
                .select(
                    "id,created_at,owner_id,college_id,platform,decision_type,deadline_date,status,portal_url,submitted_at,decided_at,colleges(id,name)"
                )
                .eq("id", applicationId)
                .eq("owner_id", user.id)
                .single();

            if (appError) throw appError;

            const a = appData as ApplicationRow;
            setApp(a);

            // hydrate edit form from DB
            setPlatform(a.platform ?? "Common App");
            setDecisionType(a.decision_type ?? "RD");
            setDeadline(a.deadline_date ?? "");
            setStatus(a.status ?? "Not started");
            setPortalUrl(a.portal_url ?? "");

            const { data: taskData, error: taskError } = await supabase
                .from("tasks")
                .select("id,created_at,owner_id,application_id,title,due_date,done,completed_at")
                .eq("application_id", applicationId)
                .eq("owner_id", user.id)
                .order("done", { ascending: true })
                .order("due_date", { ascending: true });

            if (taskError) throw taskError;
            setTasks((taskData ?? []) as TaskRow[]);
        } catch (e: any) {
            if (String(e?.message).toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setError(e?.message ?? "Failed to load application");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationId]);

    async function saveApplicationEdits(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSavingApp(true);

        try {
            const user = await getUserOrThrow();

            // Fetch current timestamps so we only set submitted_at/decided_at once
            const { data: current, error: currentErr } = await supabase
                .from("applications")
                .select("status,submitted_at,decided_at")
                .eq("id", applicationId)
                .eq("owner_id", user.id)
                .single();

            if (currentErr) throw currentErr;

            const prevStatus = (current?.status as string) ?? "Not started";
            const prevSubmittedAt = (current?.submitted_at as string | null) ?? null;
            const prevDecidedAt = (current?.decided_at as string | null) ?? null;

            const patch: any = {
                platform: platform || null,
                decision_type: decisionType || null,
                deadline_date: deadline || null,
                status,
                portal_url: portalUrl.trim() || null,
            };

            const nowISO = new Date().toISOString();

            // set submitted_at the first time we transition into Submitted
            if (status === "Submitted" && !prevSubmittedAt) {
                patch.submitted_at = nowISO;
            }

            // set decided_at the first time we transition into Decided
            if (status === "Decided" && !prevDecidedAt) {
                patch.decided_at = nowISO;
            }

            // Optional: if user moves backwards (Submitted -> In progress), we keep submitted_at.
            // That preserves the historical first-submit moment.

            const { error: updateErr } = await supabase
                .from("applications")
                .update(patch)
                .eq("id", applicationId)
                .eq("owner_id", user.id);

            if (updateErr) throw updateErr;

            // reload to refresh timestamps displayed + ensure UI matches DB
            await load();
        } catch (e: any) {
            setError(e?.message ?? "Failed to save application");
        } finally {
            setSavingApp(false);
        }
    }

    async function addTask(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const trimmed = title.trim();
        if (!trimmed) return;

        try {
            const user = await getUserOrThrow();

            const payload = {
                owner_id: user.id,
                application_id: applicationId,
                title: trimmed,
                due_date: dueDate || null,
                done: false,
                completed_at: null,
            };

            const { error } = await supabase.from("tasks").insert(payload);
            if (error) throw error;

            setTitle("");
            setDueDate("");

            await load();
        } catch (e: any) {
            setError(e?.message ?? "Failed to add task");
        }
    }

    async function toggleTask(taskId: string, nextDone: boolean) {
        setError(null);

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

            setTasks((prev) =>
                prev
                    .map((t) => (t.id === taskId ? { ...t, done: nextDone, completed_at: patch.completed_at } : t))
                    .sort((a, b) => Number(a.done) - Number(b.done))
            );
        } catch (e: any) {
            setError(e?.message ?? "Failed to update task");
        }
    }

    async function deleteTask(taskId: string) {
        setError(null);

        try {
            const user = await getUserOrThrow();

            const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", taskId)
                .eq("owner_id", user.id);

            if (error) throw error;

            setTasks((prev) => prev.filter((t) => t.id !== taskId));
        } catch (e: any) {
            setError(e?.message ?? "Failed to delete task");
        }
    }

    if (loading) {
        return <div className="p-6 text-sm text-gray-600">Loading…</div>;
    }

    if (!app) {
        return <div className="p-6 text-sm text-gray-600">Application not found.</div>;
    }

    const collegeName = app.colleges?.name ?? "College";
    const backHref = `/dashboard/colleges/${app.college_id}`;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="text-sm underline text-gray-600">
                        ← Back
                    </button>

                    <Link href={backHref} className="text-sm underline text-gray-600">
                        View college
                    </Link>
                </div>

                <h1 className="text-2xl font-semibold">
                    {collegeName}: {app.decision_type ?? "—"} application
                </h1>

                <p className="text-sm text-gray-600">
                    Platform: {app.platform ?? "—"} · Deadline: {app.deadline_date ?? "—"} · Status: {app.status}
                </p>

                {app.portal_url && (
                    <a href={app.portal_url} target="_blank" rel="noreferrer" className="text-sm underline inline-block">
                        Open portal
                    </a>
                )}
            </div>

            {/* Application editor */}
            <form onSubmit={saveApplicationEdits} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-semibold">Application details</h2>
                    <div className="text-xs text-gray-600">
                        Submitted: {friendlyDateTime(app.submitted_at)} · Decided: {friendlyDateTime(app.decided_at)}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="rounded-xl border px-3 py-2" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                        <option>Common App</option>
                        <option>Coalition</option>
                        <option>School Portal</option>
                        <option>Other</option>
                    </select>

                    <select
                        className="rounded-xl border px-3 py-2"
                        value={decisionType}
                        onChange={(e) => setDecisionType(e.target.value)}
                    >
                        <option>ED</option>
                        <option>EA</option>
                        <option>REA</option>
                        <option>RD</option>
                    </select>

                    <input
                        type="date"
                        className="rounded-xl border px-3 py-2"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                    />

                    <select className="rounded-xl border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option>Not started</option>
                        <option>In progress</option>
                        <option>Submitted</option>
                        <option>Decided</option>
                    </select>

                    <input
                        className="rounded-xl border px-3 py-2 md:col-span-2"
                        placeholder="Application portal URL (optional)"
                        value={portalUrl}
                        onChange={(e) => setPortalUrl(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        disabled={savingApp}
                        className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-60"
                    >
                        {savingApp ? "Saving…" : "Save changes"}
                    </button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
            </form>

            {/* Add task */}
            <form onSubmit={addTask} className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-semibold">Tasks</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                        className="rounded-xl border px-3 py-2 md:col-span-2"
                        placeholder="Task title (e.g., Draft personal statement)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <input type="date" className="rounded-xl border px-3 py-2" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                    <button className="rounded-xl bg-black text-white px-4 py-2">Add task</button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
            </form>

            {/* Task list */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                {tasks.length === 0 ? (
                    <p className="text-sm text-gray-600">No tasks yet — add your first one above.</p>
                ) : (
                    <ul className="divide-y">
                        {tasks.map((t) => (
                            <li key={t.id} className="py-3 flex items-start justify-between gap-3">
                                <label className="flex items-start gap-3 cursor-pointer flex-1">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={t.done}
                                        onChange={(e) => toggleTask(t.id, e.target.checked)}
                                    />
                                    <div className="flex-1">
                                        <div className={t.done ? "line-through text-gray-500" : "font-medium"}>{t.title}</div>
                                        <div className="text-sm text-gray-600">
                                            Due: {t.due_date ?? "—"} · Completed: {friendlyDateTime(t.completed_at)}
                                        </div>
                                    </div>
                                </label>

                                <button onClick={() => deleteTask(t.id)} className="text-sm underline text-gray-600">
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}