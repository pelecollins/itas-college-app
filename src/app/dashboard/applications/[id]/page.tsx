"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number) {
    const h = hex.trim().replace("#", "");
    if (![3, 6].includes(h.length)) return `rgba(0,0,0,0)`;
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].some((x) => Number.isNaN(x))) return `rgba(0,0,0,0)`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type SchoolMini = {
    id: string;
    name: string;
    logo_url?: string | null;
    primary_color?: string | null;
};

type MySchoolMini = {
    id: string;
    schools: SchoolMini | null;
};

type ApplicationRow = {
    id: string;
    created_at: string;
    owner_id: string;

    my_school_id: string;

    platform: string | null;
    decision_type: string | null;
    deadline_date: string | null;
    status: string;
    portal_url: string | null;

    submitted_at: string | null;
    decided_at: string | null;

    my_schools: MySchoolMini | null;
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

function normalizeParamId(raw: unknown): string | null {
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
    return null;
}

function isNoRowsError(err: any) {
    const msg = String(err?.message ?? "").toLowerCase();
    const code = String(err?.code ?? "").toLowerCase();
    return code === "pgrst116" || msg.includes("0 rows") || msg.includes("no rows");
}

function normalizeJoinOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeApplication(raw: any): ApplicationRow {
    const mySchoolRaw = normalizeJoinOne<any>(raw?.my_schools);
    const schoolRaw = normalizeJoinOne<any>(mySchoolRaw?.schools);

    const my_schools: MySchoolMini | null = mySchoolRaw
        ? {
            id: String(mySchoolRaw.id),
            schools: schoolRaw
                ? {
                    id: String(schoolRaw.id),
                    name: String(schoolRaw.name),
                    logo_url: schoolRaw.logo_url ?? null,
                    primary_color: schoolRaw.primary_color ?? null,
                }
                : null,
        }
        : null;

    return {
        id: String(raw.id),
        created_at: String(raw.created_at),
        owner_id: String(raw.owner_id),
        my_school_id: String(raw.my_school_id),

        platform: raw.platform ?? null,
        decision_type: raw.decision_type ?? null,
        deadline_date: raw.deadline_date ?? null,
        status: String(raw.status ?? "Not started"),
        portal_url: raw.portal_url ?? null,

        submitted_at: raw.submitted_at ?? null,
        decided_at: raw.decided_at ?? null,

        my_schools,
    };
}

export default function ApplicationDetailPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();
    const params = useParams();
    const applicationIdParam = normalizeParamId((params as any)?.id);

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

    async function fetchApplicationById(userId: string, id: string) {
        const { data, error: appError } = await supabase
            .from("applications")
            .select(
                `
        id,
        created_at,
        owner_id,
        my_school_id,
        platform,
        decision_type,
        deadline_date,
        status,
        portal_url,
        submitted_at,
        decided_at,
        my_schools (
          id,
          schools (
            id,
            name,
            logo_url,
            primary_color
          )
        )
      `
            )
            .eq("id", id)
            .eq("owner_id", userId)
            .single();

        return { data, error: appError };
    }

    async function fetchLatestApplicationByMySchoolId(userId: string, mySchoolId: string) {
        const { data, error: appError } = await supabase
            .from("applications")
            .select(
                `
        id,
        created_at,
        owner_id,
        my_school_id,
        platform,
        decision_type,
        deadline_date,
        status,
        portal_url,
        submitted_at,
        decided_at,
        my_schools (
          id,
          schools (
            id,
            name,
            logo_url,
            primary_color
          )
        )
      `
            )
            .eq("my_school_id", mySchoolId)
            .eq("owner_id", userId)
            .order("created_at", { ascending: false })
            .limit(1);

        return { data: (data && (data as any)[0]) ?? null, error: appError };
    }

    async function loadTasks(userId: string, appId: string) {
        const { data: taskData, error: taskError } = await supabase
            .from("tasks")
            .select("id,created_at,owner_id,application_id,title,due_date,done,completed_at")
            .eq("application_id", appId)
            .eq("owner_id", userId)
            .order("done", { ascending: true })
            .order("due_date", { ascending: true });

        if (taskError) throw taskError;
        setTasks((taskData ?? []) as TaskRow[]);
    }

    async function load() {
        setLoading(true);
        setError(null);

        try {
            if (!applicationIdParam) {
                setApp(null);
                setTasks([]);
                setError("Missing application id in the URL.");
                return;
            }

            // IMPORTANT FIX:
            const user = await getUserOrThrow();

            // 1) Primary: param is applications.id
            const { data: appData, error: appError } = await fetchApplicationById(user.id, applicationIdParam);

            // 2) Fallback: param is my_school_id (recover)
            if (appError && isNoRowsError(appError)) {
                const fallback = await fetchLatestApplicationByMySchoolId(user.id, applicationIdParam);
                if (fallback.error) throw fallback.error;

                if (fallback.data?.id) {
                    router.replace(`/dashboard/applications/${fallback.data.id}`);
                    return;
                }

                setApp(null);
                setTasks([]);
                setError("No application found for that id.");
                return;
            }

            if (appError) throw appError;
            if (!appData) throw new Error("No application returned.");

            const a = normalizeApplication(appData);
            setApp(a);

            setPlatform(a.platform ?? "Common App");
            setDecisionType(a.decision_type ?? "RD");
            setDeadline(a.deadline_date ?? "");
            setStatus(a.status ?? "Not started");
            setPortalUrl(a.portal_url ?? "");

            await loadTasks(user.id, a.id);
        } catch (e: any) {
            if (String(e?.message ?? "").toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setApp(null);
            setTasks([]);
            setError(e?.message ?? "Failed to load application");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationIdParam]);

    async function saveApplicationEdits(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSavingApp(true);

        try {
            const user = await getUserOrThrow();
            if (!app) throw new Error("Missing application.");

            const { data: current, error: currentErr } = await supabase
                .from("applications")
                .select("status,submitted_at,decided_at")
                .eq("id", app.id)
                .eq("owner_id", user.id)
                .single();

            if (currentErr) throw currentErr;

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
            if (status === "Submitted" && !prevSubmittedAt) patch.submitted_at = nowISO;
            if (status === "Decided" && !prevDecidedAt) patch.decided_at = nowISO;

            const { error: updateErr } = await supabase
                .from("applications")
                .update(patch)
                .eq("id", app.id)
                .eq("owner_id", user.id);

            if (updateErr) throw updateErr;

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
            if (!app) throw new Error("Missing application.");

            const payload = {
                owner_id: user.id,
                application_id: app.id,
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

            const patch: any = { done: nextDone, completed_at: nextDone ? new Date().toISOString() : null };

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

            const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("owner_id", user.id);
            if (error) throw error;

            setTasks((prev) => prev.filter((t) => t.id !== taskId));
        } catch (e: any) {
            setError(e?.message ?? "Failed to delete task");
        }
    }

    if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;

    if (!app) {
        return (
            <div className="p-6 space-y-2">
                <div className="text-sm text-gray-600">Application not found.</div>
                {error ? <div className="text-sm text-red-600">{error}</div> : null}
                <button onClick={() => router.back()} className="text-sm underline text-gray-600">
                    ← Back
                </button>
            </div>
        );
    }

    const school = app.my_schools?.schools;
    const schoolName = school?.name ?? "College";
    const logoUrl = school?.logo_url;
    const primaryColor = school?.primary_color;

    // Header Style
    const lightBrandBg = primaryColor ? hexToRgba(primaryColor, 0.1) : "#f9fafb";
    const headerBorder = primaryColor ? hexToRgba(primaryColor, 0.2) : "transparent";

    return (
        <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
            {/* HEADER CARD */}
            <div
                className="rounded-3xl border p-6 flex flex-col md:flex-row items-center justify-between gap-6"
                style={{
                    backgroundColor: lightBrandBg,
                    borderColor: headerBorder
                }}
            >
                <div className="flex items-center gap-5 w-full md:w-auto">
                    {logoUrl ? (
                        <div className="h-16 w-16 shrink-0 rounded-xl bg-white p-2 shadow-sm border overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={logoUrl}
                                alt={schoolName}
                                className="h-full w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="h-16 w-16 shrink-0 rounded-xl bg-white/50 flex items-center justify-center text-2xl font-bold text-gray-400 border">
                            {schoolName.substring(0, 1)}
                        </div>
                    )}

                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 truncate">{schoolName}</h1>
                        <div className="text-sm text-gray-600 mt-1">
                            Application created: {friendlyDateTime(app.created_at)}
                            {app.portal_url && (
                                <>
                                    {" · "}
                                    <a className="underline hover:text-black" href={app.portal_url} target="_blank" rel="noreferrer">
                                        Portal
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center w-full md:w-auto justify-end">
                    <Link href={`/dashboard/colleges/${app.my_school_id}`} className="rounded-xl border border-gray-200 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white shadow-sm">
                        View College
                    </Link>
                    <button className="rounded-xl border border-gray-200 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white shadow-sm" onClick={() => router.back()}>
                        Back
                    </button>
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border bg-white p-4 md:p-6 shadow-sm">
                    <h2 className="font-semibold text-lg mb-4">Application details</h2>

                    <form className="space-y-4" onSubmit={saveApplicationEdits}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="text-sm">
                                <div className="text-gray-600 mb-1">Platform</div>
                                <input className="w-full rounded-xl border px-3 py-2" value={platform} onChange={(e) => setPlatform(e.target.value)} />
                            </label>

                            <label className="text-sm">
                                <div className="text-gray-600 mb-1">Decision type</div>
                                <input className="w-full rounded-xl border px-3 py-2" value={decisionType} onChange={(e) => setDecisionType(e.target.value)} />
                            </label>

                            <label className="text-sm">
                                <div className="text-gray-600 mb-1">Deadline</div>
                                <input type="date" className="w-full rounded-xl border px-3 py-2" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                            </label>

                            <label className="text-sm">
                                <div className="text-gray-600 mb-1">Status</div>
                                <input className="w-full rounded-xl border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)} />
                            </label>

                            <label className="text-sm md:col-span-2">
                                <div className="text-gray-600 mb-1">Portal URL</div>
                                <input className="w-full rounded-xl border px-3 py-2" value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} />
                            </label>
                        </div>

                        <div className="pt-2">
                            <button className="w-full md:w-auto rounded-xl bg-black text-white px-6 py-2 text-sm font-medium disabled:opacity-60" disabled={savingApp} type="submit">
                                {savingApp ? "Saving…" : "Save changes"}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border bg-white p-4 md:p-6 shadow-sm">
                    <h2 className="font-semibold text-lg mb-4">Tasks</h2>

                    <form onSubmit={addTask} className="rounded-xl border bg-gray-50 p-4 mb-4">
                        <div className="grid grid-cols-1 gap-3">
                            <label className="text-sm">
                                <div className="text-gray-600 mb-1">Task title</div>
                                <input placeholder="e.g. Request transcript" className="w-full rounded-xl border px-3 py-2 bg-white" value={title} onChange={(e) => setTitle(e.target.value)} />
                            </label>

                            <div className="flex gap-2">
                                <label className="text-sm flex-1">
                                    <div className="text-gray-600 mb-1">Due date</div>
                                    <input type="date" className="w-full rounded-xl border px-3 py-2 bg-white" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                </label>
                                <div className="flex items-end">
                                    <button className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium mb-[1px]" type="submit">
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>

                    {tasks.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No tasks yet.</p>
                    ) : (
                        <ul className="divide-y border-t border-gray-100">
                            {tasks.map((t) => (
                                <li key={t.id} className="py-3 flex items-start justify-between gap-3 group">
                                    <button className="text-left min-w-0" onClick={() => toggleTask(t.id, !t.done)} title="Toggle complete">
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 h-4 w-4 rounded border flex items-center justify-center transition-colors ${t.done ? "bg-black border-black" : "bg-white border-gray-300"}`}>
                                                {t.done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div>
                                                <span className={`font-medium block ${t.done ? "line-through text-gray-400" : "text-gray-900"}`}>{t.title}</span>
                                                {t.due_date && <span className="text-xs text-gray-500 block mt-0.5">Due: {t.due_date}</span>}
                                            </div>
                                        </div>
                                    </button>

                                    <button className="text-xs text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1" onClick={() => deleteTask(t.id)}>
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}