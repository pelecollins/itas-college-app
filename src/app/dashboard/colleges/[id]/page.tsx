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
    const [platform, setPlatform] = useState("Common App");
    const [decisionType, setDecisionType] = useState("RD");
    const [deadline, setDeadline] = useState("");
    const [appStatus, setAppStatus] = useState("Not started");
    const [portalUrl, setPortalUrl] = useState("");

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow(supabase);

            // Load my_schools row + joined school data
            const { data: mySchoolData, error: mySchoolError } = await supabase
                .from("my_schools")
                .select(
                    `
          id, owner_id, school_id, status, ranking_bucket, rank, notes,
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

            // Load applications for this my_school
            const { data: appData, error: appError } = await supabase
                .from("applications")
                .select("id,platform,decision_type,deadline_date,status,portal_url,created_at")
                .eq("owner_id", user.id)
                .eq("my_school_id", mySchoolId)
                .order("deadline_date", { ascending: true });

            if (appError) throw appError;
            setApps((appData ?? []) as any);
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
            const user = await getUserOrThrow(supabase);

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
            id, name, location_text, website, env_eng, eng_strength, sustainability, vibe_tags
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
            const user = await getUserOrThrow(supabase);

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

    return (
        <div className="mx-auto max-w-5xl p-4 md:p-8">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold truncate">{school?.name ?? "College"}</h1>
                    <div className="text-sm text-gray-600 mt-1">
                        {school?.location_text ?? "—"}
                        {school?.website ? (
                            <>
                                {" · "}
                                <a className="underline" href={school.website} target="_blank" rel="noreferrer">
                                    Website
                                </a>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <button
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={startEditing}
                        >
                            Edit
                        </button>
                    ) : (
                        <>
                            <button
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => setIsEditing(false)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                className="rounded-xl bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
                                onClick={saveEdits}
                                disabled={saving}
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </>
                    )}

                    <Link href="/dashboard/colleges" className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                        Back
                    </Link>
                </div>
            </div>

            {error ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                </div>
            ) : null}

            {/* EDIT PANEL */}
            {isEditing ? (
                <div className="mt-6 rounded-2xl border bg-white p-4 md:p-6">
                    <h2 className="font-semibold">Your inputs</h2>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <input
                                className="w-full rounded-xl border px-3 py-2"
                                value={editLocationFit}
                                onChange={(e) => setEditLocationFit(e.target.value)}
                            />
                        </label>

                        <label className="text-sm">
                            <div className="text-gray-600 mb-1">Vibe fit (0–5)</div>
                            <input className="w-full rounded-xl border px-3 py-2" value={editVibeFit} onChange={(e) => setEditVibeFit(e.target.value)} />
                        </label>
                    </div>
                </div>
            ) : null}

            {/* APPLICATIONS */}
            <div className="mt-6 rounded-2xl border bg-white p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Applications</h2>
                    <span className="text-sm text-gray-600">{apps.length}</span>
                </div>

                <div className="mt-4 rounded-xl border bg-gray-50 p-4">
                    <div className="font-medium text-sm">Add application</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-sm">
                            <div className="text-gray-600 mb-1">Platform</div>
                            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={platform} onChange={(e) => setPlatform(e.target.value)} />
                        </label>

                        <label className="text-sm">
                            <div className="text-gray-600 mb-1">Decision type</div>
                            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={decisionType} onChange={(e) => setDecisionType(e.target.value)} />
                        </label>

                        <label className="text-sm">
                            <div className="text-gray-600 mb-1">Deadline (YYYY-MM-DD)</div>
                            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                        </label>

                        <label className="text-sm">
                            <div className="text-gray-600 mb-1">Status</div>
                            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={appStatus} onChange={(e) => setAppStatus(e.target.value)} />
                        </label>

                        <label className="text-sm md:col-span-2">
                            <div className="text-gray-600 mb-1">Portal URL</div>
                            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} />
                        </label>
                    </div>

                    <div className="mt-3">
                        <button className="rounded-xl bg-black text-white px-3 py-2 text-sm" onClick={createApplication}>
                            Create application
                        </button>
                    </div>
                </div>

                {apps.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-600">No applications yet.</p>
                ) : (
                    <ul className="mt-4 divide-y">
                        {apps.map((a) => (
                            <li key={a.id} className="py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">
                                            <Link className="underline" href={`/dashboard/applications/${a.id}`}>
                                                {a.decision_type ?? "—"} · {a.platform ?? "—"}
                                            </Link>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">
                                            Deadline: {a.deadline_date ?? "—"} · Status: {a.status ?? "—"}
                                        </div>
                                    </div>
                                    {a.portal_url ? (
                                        <a className="text-sm underline" href={a.portal_url} target="_blank" rel="noreferrer">
                                            Portal
                                        </a>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}