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
    env_eng: string | null; // strong | available | none
    eng_strength: string | null;
    sustainability: string | null;
    vibe_tags: string[] | null;
};

type MySchool = {
    id: string;
    school_id: string;
    status: string;
    ranking_bucket: string | null; // Reach/Match/Safety
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

// ---------- Color helpers ----------
function pillClass(kind: "status" | "bucket" | "env" | "appStatus", value?: string | null) {
    const v = (value ?? "").toLowerCase();

    if (kind === "bucket") {
        if (v === "reach") return "bg-rose-100 text-rose-800 border-rose-200";
        if (v === "match") return "bg-emerald-100 text-emerald-800 border-emerald-200";
        if (v === "safety") return "bg-cyan-100 text-cyan-800 border-cyan-200";
        if (v === "unbucketed") return "bg-gray-100 text-gray-800 border-gray-200";
        return "bg-gray-100 text-gray-800 border-gray-200";
    }

    if (kind === "env") {
        if (v === "strong") return "bg-green-100 text-green-800 border-green-200";
        if (v === "available") return "bg-amber-100 text-amber-800 border-amber-200";
        if (v === "none") return "bg-gray-100 text-gray-700 border-gray-200";
        return "bg-gray-100 text-gray-800 border-gray-200";
    }

    if (kind === "appStatus") {
        if (v === "not started") return "bg-gray-100 text-gray-800 border-gray-200";
        if (v === "in progress") return "bg-blue-100 text-blue-800 border-blue-200";
        if (v === "submitted") return "bg-green-100 text-green-800 border-green-200";
        if (v === "decided") return "bg-purple-100 text-purple-800 border-purple-200";
        return "bg-gray-100 text-gray-800 border-gray-200";
    }

    // status
    if (v === "considering") return "bg-gray-100 text-gray-800 border-gray-200";
    if (v === "building") return "bg-blue-100 text-blue-800 border-blue-200";
    if (v === "ready") return "bg-indigo-100 text-indigo-800 border-indigo-200";
    if (v === "submitted") return "bg-green-100 text-green-800 border-green-200";
    if (v === "waiting") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (v === "decision") return "bg-purple-100 text-purple-800 border-purple-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
}

function Pill({
    kind,
    value,
    label,
}: {
    kind: "status" | "bucket" | "env" | "appStatus";
    value?: string | null;
    label?: string;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${pillClass(kind, value)}`}
            title={label ?? value ?? ""}
        >
            {label ?? value ?? "—"}
        </span>
    );
}

function clampRating(v: string | number | null) {
    if (v === null || v === "") return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(5, Math.round(n)));
}

// ----------------------------------

export default function CollegeDetailPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();
    const params = useParams();
    const mySchoolId = params.id as string;

    const [row, setRow] = useState<MySchool | null>(null);
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editStatus, setEditStatus] = useState("");
    const [editBucket, setEditBucket] = useState("");
    const [editRank, setEditRank] = useState<string>("");
    const [editNotes, setEditNotes] = useState("");
    const [editPrestige, setEditPrestige] = useState<string>("");
    const [editEnvFit, setEditEnvFit] = useState<string>("");
    const [editLocationFit, setEditLocationFit] = useState<string>("");
    const [editVibeFit, setEditVibeFit] = useState<string>("");

    // Application form state
    const [platform, setPlatform] = useState("Common App");
    const [decisionType, setDecisionType] = useState("RD");
    const [deadline, setDeadline] = useState("");
    const [appStatus, setAppStatus] = useState("Not started");
    const [portalUrl, setPortalUrl] = useState("");

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            // Load my_schools row + joined school catalog data
            const { data: mySchoolData, error: mySchoolError } = await supabase
                .from("my_schools")
                .select(
                    `
          id, school_id, status, ranking_bucket, rank, notes,
          prestige, env_fit, location_fit, vibe_fit,
          schools:schools (
            id, name, location_text, website, env_eng, eng_strength, sustainability, vibe_tags
          )
        `
                )
                .eq("id", mySchoolId)
                .eq("owner_id", user.id)
                .single();

            if (mySchoolError) throw mySchoolError;
            setRow(mySchoolData as any);

            // Load applications for THIS my_schools entry
            const { data: appData, error: appError } = await supabase
                .from("applications")
                .select("id,platform,decision_type,deadline_date,status,portal_url,created_at")
                .eq("owner_id", user.id)
                .eq("my_school_id", mySchoolId)
                .order("deadline_date", { ascending: true });

            if (appError) throw appError;
            setApps((appData ?? []) as Application[]);
        } catch (e: any) {
            if (String(e?.message).toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setError(e?.message ?? "Failed to load college");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mySchoolId]);

    function startEditing() {
        if (!row) return;
        setEditStatus(row.status || "Considering");
        setEditBucket(row.ranking_bucket || "");
        setEditRank(String(row.rank ?? ""));
        setEditNotes(row.notes || "");
        setEditPrestige(row.prestige != null ? String(row.prestige) : "");
        setEditEnvFit(row.env_fit != null ? String(row.env_fit) : "");
        setEditLocationFit(row.location_fit != null ? String(row.location_fit) : "");
        setEditVibeFit(row.vibe_fit != null ? String(row.vibe_fit) : "");
        setIsEditing(true);
    }

    async function saveChanges() {
        setError(null);
        try {
            const user = await getUserOrThrow();
            const updates = {
                status: editStatus,
                ranking_bucket: editBucket || null,
                rank: editRank ? Number(editRank) : null,
                notes: editNotes || null,
                prestige: clampRating(editPrestige),
                env_fit: clampRating(editEnvFit),
                location_fit: clampRating(editLocationFit),
                vibe_fit: clampRating(editVibeFit),
            };

            const { error: updateError } = await supabase
                .from("my_schools")
                .update(updates)
                .eq("id", mySchoolId)
                .eq("owner_id", user.id);

            if (updateError) throw updateError;

            await load();
            setIsEditing(false);
        } catch (e: any) {
            setError(e?.message ?? "Failed to save changes");
        }
    }

    async function addApplication(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        try {
            const user = await getUserOrThrow();

            const payload = {
                owner_id: user.id,
                my_school_id: mySchoolId,
                platform: platform || null,
                decision_type: decisionType || null,
                deadline_date: deadline || null,
                status: appStatus,
                portal_url: portalUrl.trim() || null,
            };

            const { error } = await supabase.from("applications").insert(payload);
            if (error) throw error;

            // reset form
            setPlatform("Common App");
            setDecisionType("RD");
            setDeadline("");
            setAppStatus("Not started");
            setPortalUrl("");

            await load();
        } catch (e: any) {
            setError(e?.message ?? "Failed to add application");
        }
    }

    if (loading) return <div className="p-6 text-sm text-gray-600">Loading…</div>;
    if (!row) return <div className="p-6 text-sm text-gray-600">College not found.</div>;

    const school = row.schools;
    const bucketLabel = row.ranking_bucket ?? "Unbucketed";

    return (
        <div className="p-6 space-y-6">
            {/* Header / Main Details */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <button onClick={() => router.back()} className="text-sm underline text-gray-600">
                        ← Back
                    </button>

                    <div className="flex items-center gap-3">
                        {school.website ? (
                            <a href={school.website} target="_blank" rel="noreferrer" className="text-sm underline">
                                Website
                            </a>
                        ) : null}
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="text-xs border px-2 py-1 rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveChanges}
                                    className="text-xs bg-black text-white px-2 py-1 rounded"
                                >
                                    Save
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={startEditing}
                                className="text-xs border px-3 py-1 rounded hover:bg-gray-50 font-medium"
                            >
                                Edit info
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold break-words">{school.name}</h1>
                        <div className="mt-1 text-sm text-gray-600">
                            {school.location_text ?? "—"}
                            {school.eng_strength ? ` · Eng: ${school.eng_strength}` : ""}
                            {school.sustainability ? ` · Sustain: ${school.sustainability}` : ""}
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs rounded-full bg-black text-white px-2 py-0.5">#{row.rank}</span>
                            <Pill kind="bucket" value={row.ranking_bucket ?? "unbucketed"} label={bucketLabel} />
                            <Pill kind="status" value={row.status} />
                            {school.env_eng ? (
                                <Pill kind="env" value={school.env_eng} label={`EnvE: ${school.env_eng}`} />
                            ) : null}
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                            <select
                                className="w-full rounded-md border p-1 text-sm"
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                            >
                                <option>Considering</option>
                                <option>Building</option>
                                <option>Ready</option>
                                <option>Submitted</option>
                                <option>Waiting</option>
                                <option>Decision</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Bucket</label>
                            <select
                                className="w-full rounded-md border p-1 text-sm"
                                value={editBucket}
                                onChange={(e) => setEditBucket(e.target.value)}
                            >
                                <option value="">Without bucket</option>
                                <option value="Reach">Reach</option>
                                <option value="Match">Match</option>
                                <option value="Safety">Safety</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Rank</label>
                            <input
                                type="number"
                                className="w-full rounded-md border p-1 text-sm"
                                value={editRank}
                                onChange={(e) => setEditRank(e.target.value)}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Prestige (0-5)</label>
                                <input
                                    className="w-full rounded-md border p-1 text-sm"
                                    value={editPrestige}
                                    onChange={(e) => setEditPrestige(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Env Fit (0-5)</label>
                                <input
                                    className="w-full rounded-md border p-1 text-sm"
                                    value={editEnvFit}
                                    onChange={(e) => setEditEnvFit(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Loc Fit (0-5)</label>
                                <input
                                    className="w-full rounded-md border p-1 text-sm"
                                    value={editLocationFit}
                                    onChange={(e) => setEditLocationFit(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Vibe (0-5)</label>
                                <input
                                    className="w-full rounded-md border p-1 text-sm"
                                    value={editVibeFit}
                                    onChange={(e) => setEditVibeFit(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                            <textarea
                                className="w-full rounded-md border p-2 text-sm"
                                rows={3}
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mt-3 text-sm text-gray-600">
                            Ratings: P {row.prestige ?? "—"} · E {row.env_fit ?? "—"} · L {row.location_fit ?? "—"} · V{" "}
                            {row.vibe_fit ?? "—"}
                        </div>

                        {row.notes ? <p className="mt-3 text-sm text-gray-700">{row.notes}</p> : null}
                    </>
                )}

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>

            {/* Add application (collapsed by default) */}
            <details className="rounded-2xl border bg-white p-4 shadow-sm" open={false}>
                <summary className="cursor-pointer font-semibold select-none">
                    Add application <span className="text-sm font-normal text-gray-600">(rarely needed)</span>
                </summary>

                <form onSubmit={addApplication} className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                            className="rounded-xl border px-3 py-2"
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                        >
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

                        <select
                            className="rounded-xl border px-3 py-2"
                            value={appStatus}
                            onChange={(e) => setAppStatus(e.target.value)}
                        >
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
                        <button className="rounded-xl bg-black text-white px-4 py-2">Add application</button>
                    </div>
                </form>
            </details>

            {/* Applications list */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between">
                    <h2 className="font-semibold">Applications</h2>
                    <span className="text-sm text-gray-600">{apps.length}</span>
                </div>

                {apps.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-600">No applications yet for this college.</p>
                ) : (
                    <ul className="mt-3 divide-y">
                        {apps.map((a) => (
                            <li key={a.id} className="py-3 hover:bg-gray-50 transition-colors rounded-xl px-2 -mx-2">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link href={`/dashboard/applications/${a.id}`} className="font-medium underline">
                                                {a.decision_type ?? "—"} · {a.platform ?? "—"}
                                            </Link>
                                            <Pill kind="appStatus" value={a.status} />
                                        </div>

                                        <div className="text-sm text-gray-600 mt-1">
                                            Deadline: {a.deadline_date ?? "—"}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {a.portal_url ? (
                                            <a href={a.portal_url} target="_blank" rel="noreferrer" className="text-sm underline">
                                                Portal
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}