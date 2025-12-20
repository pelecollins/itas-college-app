"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";

type School = {
    id: string;
    name: string;
    location_text: string | null;
    website: string | null;
    env_eng: string | null;
    eng_strength: string | null;
    sustainability: string | null;
    vibe_tags: string[] | null;
    logo_url: string | null;
    primary_color: string | null;
};

type MySchool = {
    id: string;
    owner_id: string;
    school_id: string;
    status: string;
    ranking_bucket: string | null;
    rank: number;
    notes: string | null;
    prestige: number | null;
    env_fit: number | null;
    location_fit: number | null;
    vibe_fit: number | null;
    schools: School;
};

type Application = {
    id: string;
    platform: string | null;
    decision_type: string | null;
    deadline_date: string | null;
    status: string;
    portal_url: string | null;
    created_at: string;
};

function clampRating(v: string | number | null) {
    if (v === null || v === "") return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(5, Math.round(n)));
}

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

export default function CollegeDetailPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();
    const params = useParams();

    // IMPORTANT: /dashboard/colleges/[id] where id = my_schools.id
    const mySchoolId = (params as any)?.id as string;

    const [row, setRow] = useState<MySchool | null>(null);
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editStatus, setEditStatus] = useState("Considering");
    const [editBucket, setEditBucket] = useState<string>("Unbucketed");
    const [editRank, setEditRank] = useState<string>("");
    const [editNotes, setEditNotes] = useState("");
    const [editPrestige, setEditPrestige] = useState<string>("");
    const [editEnvFit, setEditEnvFit] = useState<string>("");
    const [editLocationFit, setEditLocationFit] = useState<string>("");
    const [editVibeFit, setEditVibeFit] = useState<string>("");

    // Application form state
    const [showAddApp, setShowAddApp] = useState(false);
    const [platform, setPlatform] = useState("Common App");
    const [decisionType, setDecisionType] = useState("RD");
    const [deadline, setDeadline] = useState("");
    const [appStatus, setAppStatus] = useState("Not started");
    const [portalUrl, setPortalUrl] = useState("");

    // Wikipedia state
    const [wikiSummary, setWikiSummary] = useState<string | null>(null);
    const [wikiLink, setWikiLink] = useState<string | null>(null);
    const [, setWikiLoading] = useState(false);

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            // Load my_schools row + joined school data
            const { data: mySchoolData, error: mySchoolError } = await supabase
                .from("my_schools")
                .select(
                    `
          id, owner_id, school_id, status, ranking_bucket, rank, notes,
          prestige, env_fit, location_fit, vibe_fit,
          schools:schools (
            id, name, location_text, website, env_eng, eng_strength, sustainability, vibe_tags,
            logo_url, primary_color
          )
        `
                )
                .eq("id", mySchoolId)
                .eq("owner_id", user.id)
                .single();

            if (mySchoolError) throw mySchoolError;

            setRow(mySchoolData as any);

            // Fetch wikipedia
            const schoolName = (mySchoolData as any)?.schools?.name;
            if (schoolName) {
                fetchWikipediaSummary(schoolName);
            }

            // Load applications for this my_school
            const { data: appData, error: appError } = await supabase
                .from("applications")
                .select("id,platform,decision_type,deadline_date,status,portal_url,created_at")
                .eq("owner_id", user.id)
                .eq("my_school_id", mySchoolId)
                .order("deadline_date", { ascending: true });

            if (appError) throw appError;
            setApps((appData ?? []) as any);

            // Default collapse/expand logic
            setShowAddApp((appData ?? []).length === 0);
        } catch (e: any) {
            if (String(e?.message ?? "").toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setError(e?.message ?? "Failed to load college");
        } finally {
            setLoading(false);
        }
    }

    async function fetchWikipediaSummary(schoolName: string) {
        setWikiLoading(true);
        try {
            // Wikipedia REST API
            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(schoolName)}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                if (json.type === "standard" && json.extract) {
                    setWikiSummary(json.extract);
                    setWikiLink(json.content_urls?.desktop?.page ?? null);
                }
            }
        } catch (err) {
            // ignore
        } finally {
            setWikiLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mySchoolId]);

    function startEditing() {
        if (!row) return;
        setEditStatus(row.status ?? "Considering");
        setEditBucket(row.ranking_bucket ?? "Unbucketed");
        setEditRank(row.rank != null ? String(row.rank) : "");
        setEditNotes(row.notes ?? "");
        setEditPrestige(row.prestige != null ? String(row.prestige) : "");
        setEditEnvFit(row.env_fit != null ? String(row.env_fit) : "");
        setEditLocationFit(row.location_fit != null ? String(row.location_fit) : "");
        setEditVibeFit(row.vibe_fit != null ? String(row.vibe_fit) : "");
        setIsEditing(true);
    }

    async function saveEdits() {
        if (!row) return;
        setSaving(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            const payload: any = {
                status: editStatus,
                ranking_bucket: editBucket === "Unbucketed" ? null : editBucket,
                rank: editRank === "" ? row.rank : Number(editRank),
                notes: editNotes.trim() === "" ? null : editNotes,
                prestige: clampRating(editPrestige),
                env_fit: clampRating(editEnvFit),
                location_fit: clampRating(editLocationFit),
                vibe_fit: clampRating(editVibeFit),
            };

            const { data, error } = await supabase
                .from("my_schools")
                .update(payload)
                .eq("id", mySchoolId)
                .eq("owner_id", user.id)
                .select(
                    `
          id, owner_id, school_id, status, ranking_bucket, rank, notes,
          prestige, env_fit, location_fit, vibe_fit,
          schools:schools (
            id, name, location_text, website, env_eng, eng_strength, sustainability, vibe_tags,
            logo_url, primary_color
          )
        `
                )
                .single();

            if (error) throw error;

            setRow(data as any);
            setIsEditing(false);
        } catch (e: any) {
            setError(e?.message ?? "Failed to save edits");
        } finally {
            setSaving(false);
        }
    }

    async function createApplication() {
        setError(null);
        try {
            const user = await getUserOrThrow();

            const payload = {
                owner_id: user.id,
                my_school_id: mySchoolId,
                platform: platform || null,
                decision_type: decisionType || null,
                deadline_date: deadline || null,
                status: appStatus || "Not started",
                portal_url: portalUrl.trim() || null,
            };

            const { data, error } = await supabase
                .from("applications")
                .insert(payload)
                .select("id,platform,decision_type,deadline_date,status,portal_url,created_at")
                .single();

            if (error) throw error;

            setApps((prev) => [...prev, data as any]);
            setDeadline("");
            setPortalUrl("");
            // Collapse after adding if this was the first one, or maybe keep it open? 
            // Let's keep it open or just clear fields. User said "can still add multiple if needed but this would be rare".
            // So collapsing seems fine.
            setShowAddApp(false);
        } catch (e: any) {
            setError(e?.message ?? "Failed to create application");
        }
    }

    if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;

    if (!row) {
        return (
            <div className="p-6 space-y-2">
                <div className="text-sm text-gray-600">College not found.</div>
                {error ? <div className="text-sm text-red-600">{error}</div> : null}
                <Link href="/dashboard/colleges" className="text-sm underline text-gray-600">
                    ← Back to colleges
                </Link>
            </div>
        );
    }

    const school = row.schools;
    // Header Style with primary color
    const lightBrandBg = school?.primary_color ? hexToRgba(school.primary_color, 0.1) : "#f9fafb";
    const headerBorder = school?.primary_color ? hexToRgba(school.primary_color, 0.2) : "transparent";

    return (
        <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
            {/* HERDER CARD */}
            <div
                className="rounded-3xl border p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                style={{
                    backgroundColor: lightBrandBg,
                    borderColor: headerBorder
                }}
            >
                <div className="flex items-center gap-5">
                    {school?.logo_url ? (
                        <div className="h-20 w-20 shrink-0 rounded-2xl bg-white p-2 shadow-sm border overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={school.logo_url}
                                alt={school.name}
                                className="h-full w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="h-20 w-20 shrink-0 rounded-2xl bg-white/50 flex items-center justify-center text-3xl font-bold text-gray-400 border">
                            {school.name.substring(0, 1)}
                        </div>
                    )}

                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{school?.name ?? "College"}</h1>
                        <div className="mt-2 text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                            <span>{school?.location_text ?? "No location"}</span>
                            {school?.website && (
                                <>
                                    <span>·</span>
                                    <a className="underline hover:text-black" href={school.website} target="_blank" rel="noreferrer">
                                        Website
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                    {!isEditing ? (
                        <button
                            className="rounded-xl border border-gray-200 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white shadow-sm"
                            onClick={startEditing}
                        >
                            Edit
                        </button>
                    ) : (
                        <>
                            <button
                                className="rounded-xl border border-gray-200 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white"
                                onClick={() => setIsEditing(false)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-60 shadow-md"
                                onClick={saveEdits}
                                disabled={saving}
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </>
                    )}

                    <Link href="/dashboard/colleges" className="rounded-xl border border-gray-200 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white shadow-sm">
                        Back
                    </Link>
                </div>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* LEFT COLUMN: Stats/Inputs */}
                <div className="md:col-span-2 space-y-6">
                    {/* WIKIPEDIA / ABOUT */}
                    {wikiSummary ? (
                        <div className="rounded-2xl border bg-white p-6 shadow-sm">
                            <h2 className="font-semibold text-lg mb-2">About</h2>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {wikiSummary}
                            </p>
                            {wikiLink && (
                                <div className="mt-3">
                                    <a href={wikiLink} target="_blank" rel="noreferrer" className="text-xs text-gray-500 underline hover:text-gray-800">
                                        Read more on Wikipedia
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* EDIT PANEL or READ ONLY GRID */}
                    {isEditing ? (
                        <div className="rounded-2xl border bg-white p-6 shadow-sm">
                            <h2 className="font-semibold text-lg mb-4">Edit Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="text-sm">
                                    <div className="text-gray-600 mb-1">Status</div>
                                    <input
                                        className="w-full rounded-xl border px-3 py-2"
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value)}
                                    />
                                </label>

                                <label className="text-sm">
                                    <div className="text-gray-600 mb-1">Bucket</div>
                                    <select
                                        className="w-full rounded-xl border px-3 py-2"
                                        value={editBucket}
                                        onChange={(e) => setEditBucket(e.target.value)}
                                    >
                                        {["Unbucketed", "Reach", "Match", "Safety"].map((b) => (
                                            <option key={b} value={b}>
                                                {b}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="text-sm">
                                    <div className="text-gray-600 mb-1">Rank</div>
                                    <input
                                        className="w-full rounded-xl border px-3 py-2"
                                        value={editRank}
                                        onChange={(e) => setEditRank(e.target.value)}
                                        inputMode="numeric"
                                    />
                                </label>

                                <label className="text-sm md:col-span-2">
                                    <div className="text-gray-600 mb-1">Notes</div>
                                    <textarea
                                        className="w-full rounded-xl border px-3 py-2 min-h-[110px]"
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                    />
                                </label>

                                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                    <label className="text-sm">
                                        <div className="text-gray-600 mb-1">Prestige (0–5)</div>
                                        <input className="w-full rounded-xl border px-3 py-2" value={editPrestige} onChange={(e) => setEditPrestige(e.target.value)} />
                                    </label>
                                    <label className="text-sm">
                                        <div className="text-gray-600 mb-1">Env fit (0–5)</div>
                                        <input className="w-full rounded-xl border px-3 py-2" value={editEnvFit} onChange={(e) => setEditEnvFit(e.target.value)} />
                                    </label>
                                    <label className="text-sm">
                                        <div className="text-gray-600 mb-1">Location fit (0–5)</div>
                                        <input className="w-full rounded-xl border px-3 py-2" value={editLocationFit} onChange={(e) => setEditLocationFit(e.target.value)} />
                                    </label>
                                    <label className="text-sm">
                                        <div className="text-gray-600 mb-1">Vibe fit (0–5)</div>
                                        <input className="w-full rounded-xl border px-3 py-2" value={editVibeFit} onChange={(e) => setEditVibeFit(e.target.value)} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border bg-white p-6 shadow-sm">
                            <h2 className="font-semibold text-lg mb-4">Details</h2>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase tracking-wide">Status</span>
                                    <span className="font-medium">{row.status}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase tracking-wide">Bucket</span>
                                    <span className="font-medium">{row.ranking_bucket ?? "—"}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500 text-xs uppercase tracking-wide">Rank</span>
                                    <span className="font-medium">#{row.rank}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="block text-gray-500 text-xs uppercase tracking-wide">Notes</span>
                                    <p className="whitespace-pre-wrap text-gray-800">{row.notes || "—"}</p>
                                </div>
                                <div className="col-span-2 border-t pt-4 grid grid-cols-4 gap-2 text-center">
                                    <div>
                                        <span className="block text-gray-400 text-[10px] uppercase">Prestige</span>
                                        <span className="font-semibold text-base">{row.prestige ?? "—"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 text-[10px] uppercase">Env</span>
                                        <span className="font-semibold text-base">{row.env_fit ?? "—"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 text-[10px] uppercase">Loc</span>
                                        <span className="font-semibold text-base">{row.location_fit ?? "—"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-400 text-[10px] uppercase">Vibe</span>
                                        <span className="font-semibold text-base">{row.vibe_fit ?? "—"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Applications */}
                <div className="md:col-span-1 space-y-6">
                    <div className="rounded-2xl border bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-lg">Applications</h2>
                            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {apps.length}
                            </span>
                        </div>

                        {apps.length === 0 && !showAddApp ? (
                            <p className="text-sm text-gray-500 mb-4">No applications created yet.</p>
                        ) : (
                            <ul className="mb-4 space-y-3">
                                {apps.map((a) => (
                                    <li key={a.id} className="rounded-xl border bg-gray-50/50 p-3 hover:bg-gray-50 transition">
                                        <Link href={`/dashboard/applications/${a.id}`} className="block">
                                            <div className="font-medium text-blue-600 hover:underline text-sm mb-1">
                                                {a.decision_type ?? "Application"}
                                                {a.platform ? ` via ${a.platform}` : ""}
                                            </div>
                                            <div className="text-xs text-gray-600 flex justify-between">
                                                <span>{a.status}</span>
                                                <span>Due: {a.deadline_date ?? "—"}</span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {!showAddApp ? (
                            <button
                                onClick={() => setShowAddApp(true)}
                                className="w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-black transition"
                            >
                                + Add application
                            </button>
                        ) : (
                            <div className="rounded-xl border bg-gray-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="font-medium text-sm">New Application</div>
                                    <button onClick={() => setShowAddApp(false)} className="text-xs text-gray-500 hover:text-black">
                                        Cancel
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm">
                                        <div className="text-xs text-gray-500 mb-1">Platform</div>
                                        <input className="w-full rounded-lg border px-2 py-1.5 text-sm bg-white" value={platform} onChange={(e) => setPlatform(e.target.value)} />
                                    </label>

                                    <label className="block text-sm">
                                        <div className="text-xs text-gray-500 mb-1">Decision type</div>
                                        <input className="w-full rounded-lg border px-2 py-1.5 text-sm bg-white" value={decisionType} onChange={(e) => setDecisionType(e.target.value)} />
                                    </label>

                                    <label className="block text-sm">
                                        <div className="text-xs text-gray-500 mb-1">Deadline</div>
                                        <input type="date" className="w-full rounded-lg border px-2 py-1.5 text-sm bg-white" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                                    </label>

                                    <label className="block text-sm">
                                        <div className="text-xs text-gray-500 mb-1">Status</div>
                                        <input className="w-full rounded-lg border px-2 py-1.5 text-sm bg-white" value={appStatus} onChange={(e) => setAppStatus(e.target.value)} />
                                    </label>

                                    <label className="block text-sm">
                                        <div className="text-xs text-gray-500 mb-1">Portal URL</div>
                                        <input className="w-full rounded-lg border px-2 py-1.5 text-sm bg-white" value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} />
                                    </label>

                                    <button className="w-full rounded-lg bg-black text-white py-2 text-sm font-medium mt-2" onClick={createApplication}>
                                        Create
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}