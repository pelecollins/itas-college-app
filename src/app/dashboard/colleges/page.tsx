"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCenter,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type School = {
    id: string;
    name: string;
    location_text: string | null;
    website: string | null;
    env_eng: string | null; // 'strong' | 'available' | 'none'
    eng_strength: string | null;
    sustainability: string | null;
    vibe_tags: string[] | null;
    lat?: number | null;
    lng?: number | null;
};

type MySchoolRow = {
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
    created_at: string;
    schools: School;
};

function clampRating(v: string) {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(5, Math.round(n)));
}

// ---------- Color helpers ----------
function pillClass(kind: "status" | "bucket" | "env", value?: string | null) {
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
    kind: "status" | "bucket" | "env";
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

function CountPill({
    bucket,
    count,
    onClick,
}: {
    bucket: "Reach" | "Match" | "Safety" | "Unbucketed";
    count: number;
    onClick?: () => void;
}) {
    const key = bucket === "Unbucketed" ? "unbucketed" : bucket;
    const clickable = Boolean(onClick);

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!clickable}
            className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                pillClass("bucket", key),
                clickable ? "hover:opacity-90" : "cursor-default",
            ].join(" ")}
            title={clickable ? `Filter to ${bucket}` : bucket}
        >
            <span className="font-medium">{bucket}</span>
            <span className="font-semibold">{count}</span>
        </button>
    );
}
// ----------------------------------

function SortableMySchoolRow({
    row,
    onRemove,
    dragEnabled,
}: {
    row: MySchoolRow;
    onRemove: (id: string) => void;
    dragEnabled: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: row.id, disabled: !dragEnabled });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    const s = row.schools;

    return (
        <li
            ref={setNodeRef}
            style={style}
            className="py-3 bg-white hover:bg-gray-50 transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Drag handle */}
                        <button
                            type="button"
                            className={[
                                "select-none rounded-lg border px-2 py-1 text-xs text-gray-700",
                                dragEnabled
                                    ? "cursor-grab active:cursor-grabbing hover:bg-gray-50"
                                    : "cursor-not-allowed opacity-50",
                            ].join(" ")}
                            {...(dragEnabled ? attributes : {})}
                            {...(dragEnabled ? listeners : {})}
                            aria-label="Drag to reorder"
                            title={
                                dragEnabled
                                    ? "Drag to reorder"
                                    : "Switch Sort to Rank and clear filters to reorder"
                            }
                        >
                            ↕
                        </button>

                        <span className="text-xs rounded-full bg-black text-white px-2 py-0.5">
                            #{row.rank}
                        </span>

                        <Link href={`/dashboard/colleges/${row.id}`} className="font-medium underline">
                            {s?.name ?? "Unknown school"}
                        </Link>

                        <Pill kind="status" value={row.status} />
                        {row.ranking_bucket && <Pill kind="bucket" value={row.ranking_bucket} />}
                        {!row.ranking_bucket && <Pill kind="bucket" value="unbucketed" label="Unbucketed" />}

                        {s?.env_eng && <Pill kind="env" value={s.env_eng} label={`EnvE: ${s.env_eng}`} />}
                    </div>

                    <div className="text-sm text-gray-600 mt-1">
                        {s?.location_text ?? "—"}
                        {s?.eng_strength ? ` · Eng: ${s.eng_strength}` : ""}
                        {s?.sustainability ? ` · Sustain: ${s.sustainability}` : ""}
                    </div>

                    <div className="text-sm text-gray-600 mt-1">
                        Ratings: P {row.prestige ?? "—"} · E {row.env_fit ?? "—"} · L{" "}
                        {row.location_fit ?? "—"} · V {row.vibe_fit ?? "—"}
                    </div>

                    {row.notes && <p className="mt-2 text-sm text-gray-700">{row.notes}</p>}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {s?.website && (
                        <a className="text-sm underline" href={s.website} target="_blank" rel="noreferrer">
                            Website
                        </a>
                    )}
                    <button
                        type="button"
                        className="text-sm underline text-red-600"
                        onClick={() => onRemove(row.id)}
                    >
                        Remove
                    </button>
                </div>
            </div>
        </li>
    );
}

export default function CollegesPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [myList, setMyList] = useState<MySchoolRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    // catalog search
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<School[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

    // add-to-list fields
    const [status, setStatus] = useState("Considering");
    const [bucket, setBucket] = useState<string>(""); // Reach/Match/Safety optional
    const [notes, setNotes] = useState("");

    const [prestige, setPrestige] = useState<string>("");
    const [envFit, setEnvFit] = useState<string>("");
    const [locationFit, setLocationFit] = useState<string>("");
    const [vibeFit, setVibeFit] = useState<string>("");

    // optional: add custom school to catalog
    const [customName, setCustomName] = useState("");
    const [customLocation, setCustomLocation] = useState("");
    const [customWebsite, setCustomWebsite] = useState("");

    // filters + sort
    const [filterBucket, setFilterBucket] = useState<string>("");
    const [filterEnv, setFilterEnv] = useState<string>("");
    const [sortBy, setSortBy] = useState<string>("rank"); // rank | name | status

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    async function loadMyList() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            const { data, error } = await supabase
                .from("my_schools")
                .select(
                    `
          id, school_id, status, ranking_bucket, rank, notes,
          prestige, env_fit, location_fit, vibe_fit, created_at,
          schools:schools (
            id, name, location_text, website, env_eng, eng_strength, sustainability, vibe_tags, lat, lng
          )
        `
                )
                .eq("owner_id", user.id)
                .order("rank", { ascending: true })
                .order("created_at", { ascending: false });

            if (error) throw error;

            const normalized = (data ?? []).map((r: any, idx: number) => ({
                ...r,
                rank: Number.isFinite(r.rank) ? r.rank : idx + 1,
            })) as MySchoolRow[];

            setMyList(normalized);
        } catch (e: any) {
            if (String(e?.message).toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setError(e?.message ?? "Failed to load your list");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMyList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function runSearch(q: string) {
        const trimmed = q.trim();
        setQuery(q);

        if (trimmed.length < 2) {
            setResults([]);
            setSelectedSchoolId("");
            return;
        }

        setSearching(true);
        setError(null);

        try {
            const { data, error } = await supabase
                .from("schools")
                .select("id,name,location_text,website,env_eng,eng_strength,sustainability,vibe_tags,lat,lng")
                .ilike("name", `%${trimmed}%`)
                .order("is_seeded", { ascending: false })
                .order("name", { ascending: true })
                .limit(20);

            if (error) throw error;
            setResults((data ?? []) as School[]);
        } catch (e: any) {
            setError(e?.message ?? "Search failed");
        } finally {
            setSearching(false);
        }
    }

    async function addSelectedToMyList(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        try {
            const user = await getUserOrThrow();
            if (!selectedSchoolId) {
                setError("Pick a school from the search results first.");
                return;
            }

            // Append new school to bottom: max rank + 1
            const maxRank = myList.reduce((m, r) => Math.max(m, r.rank ?? 0), 0);
            const nextRank = Number.isFinite(maxRank) ? maxRank + 1 : 1;

            const payload = {
                owner_id: user.id,
                school_id: selectedSchoolId,
                status,
                ranking_bucket: bucket.trim() || null,
                rank: nextRank,
                notes: notes.trim() || null,
                prestige: clampRating(prestige),
                env_fit: clampRating(envFit),
                location_fit: clampRating(locationFit),
                vibe_fit: clampRating(vibeFit),
            };

            const { error } = await supabase.from("my_schools").insert(payload);
            if (error) throw error;

            // reset add fields
            setSelectedSchoolId("");
            setStatus("Considering");
            setBucket("");
            setNotes("");
            setPrestige("");
            setEnvFit("");
            setLocationFit("");
            setVibeFit("");

            await loadMyList();
        } catch (e: any) {
            const msg = e?.message ?? "Failed to add school";
            if (String(msg).toLowerCase().includes("duplicate")) {
                setError("That school is already in your list.");
            } else {
                setError(msg);
            }
        }
    }

    async function addCustomSchoolToCatalog(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        try {
            const name = customName.trim();
            if (!name) {
                setError("Custom school name is required.");
                return;
            }

            const payload = {
                name,
                location_text: customLocation.trim() || null,
                website: customWebsite.trim() || null,
                is_seeded: false,
            };

            const { data, error } = await supabase
                .from("schools")
                .insert(payload)
                .select("id")
                .single();

            if (error) throw error;

            // auto-select newly created school for immediate add-to-list
            setSelectedSchoolId(data.id);
            setQuery(name);
            setResults([]);
            setCustomName("");
            setCustomLocation("");
            setCustomWebsite("");
        } catch (e: any) {
            setError(e?.message ?? "Failed to add custom school");
        }
    }

    async function removeFromMyList(mySchoolId: string) {
        setError(null);
        try {
            const { error } = await supabase.from("my_schools").delete().eq("id", mySchoolId);
            if (error) throw error;
            await loadMyList();
        } catch (e: any) {
            setError(e?.message ?? "Failed to remove");
        }
    }

    async function persistRanks(next: MySchoolRow[]) {
        const results = await Promise.all(
            next.map((r, idx) =>
                supabase
                    .from("my_schools")
                    .update({ rank: idx + 1 })
                    .eq("id", r.id)
            )
        );

        const firstError = results.find((r) => r.error)?.error;
        if (firstError) throw firstError;
    }

    // Derived list for display
    const filtersActive = Boolean(filterBucket || filterEnv);
    const dragEnabled = sortBy === "rank" && !filtersActive;

    const displayed = myList
        .filter((r) => !filterBucket || r.ranking_bucket === filterBucket)
        .filter((r) => !filterEnv || (r.schools?.env_eng ?? "") === filterEnv)
        .slice()
        .sort((a, b) => {
            if (sortBy === "name") return (a.schools?.name ?? "").localeCompare(b.schools?.name ?? "");
            if (sortBy === "status") return (a.status ?? "").localeCompare(b.status ?? "");
            return (a.rank ?? 9999) - (b.rank ?? 9999);
        });

    // Counts (based on displayed list -> respects current filters)
    const counts = displayed.reduce(
        (acc, r) => {
            const b = (r.ranking_bucket ?? "").toLowerCase();
            if (b === "reach") acc.reach += 1;
            else if (b === "match") acc.match += 1;
            else if (b === "safety") acc.safety += 1;
            else acc.unbucketed += 1;
            return acc;
        },
        { reach: 0, match: 0, safety: 0, unbucketed: 0 }
    );

    async function onDragEnd(event: DragEndEvent) {
        if (!dragEnabled) return;

        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = myList.findIndex((r) => r.id === active.id);
        const newIndex = myList.findIndex((r) => r.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = arrayMove(myList, oldIndex, newIndex).map((r, idx) => ({
            ...r,
            rank: idx + 1,
        }));

        setMyList(reordered);

        try {
            await persistRanks(reordered);
        } catch (e: any) {
            setError(e?.message ?? "Failed to save new order");
            await loadMyList();
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Colleges</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Search from the catalog, add to your ranked list, and track impressions.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/map"
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        View map
                    </Link>
                </div>
            </div>

            {/* Bucket counts */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="font-semibold">Buckets</h2>
                        <p className="text-sm text-gray-600">
                            Quick view of Reach / Match / Safety. (Counts respect filters.)
                        </p>
                    </div>

                    {(filterBucket || filterEnv) && (
                        <button
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                                setFilterBucket("");
                                setFilterEnv("");
                            }}
                            type="button"
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    <CountPill
                        bucket="Reach"
                        count={counts.reach}
                        onClick={() => setFilterBucket("Reach")}
                    />
                    <CountPill
                        bucket="Match"
                        count={counts.match}
                        onClick={() => setFilterBucket("Match")}
                    />
                    <CountPill
                        bucket="Safety"
                        count={counts.safety}
                        onClick={() => setFilterBucket("Safety")}
                    />
                    <CountPill
                        bucket="Unbucketed"
                        count={counts.unbucketed}
                        onClick={() => setFilterBucket("")}
                    />
                </div>

                <div className="mt-3 text-xs text-gray-500">
                    Tip: click a bucket to filter your list to that category.
                </div>
            </div>

            {/* Add a school (collapsed by default) */}
            <details className="rounded-2xl border bg-white p-4 shadow-sm" open={false}>
                <summary className="cursor-pointer font-semibold select-none">
                    Add a school{" "}
                    <span className="text-sm font-normal text-gray-600">
                        (search catalog / add custom)
                    </span>
                </summary>

                <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <input
                                className="w-full rounded-xl border px-3 py-2"
                                placeholder="Search schools (e.g., Harvard, MIT, Stanford)…"
                                value={query}
                                onChange={(e) => runSearch(e.target.value)}
                            />

                            <div className="mt-2 text-sm text-gray-600">
                                {searching
                                    ? "Searching…"
                                    : results.length > 0
                                        ? "Select a result below."
                                        : "Type 2+ characters to search."}
                            </div>

                            {results.length > 0 && (
                                <div className="mt-2 rounded-xl border overflow-hidden">
                                    {results.map((s) => {
                                        const active = selectedSchoolId === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => setSelectedSchoolId(s.id)}
                                                className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 ${active ? "bg-gray-50" : ""
                                                    }`}
                                            >
                                                <div className="font-medium flex items-center gap-2 flex-wrap">
                                                    {s.name}
                                                    {s.env_eng ? (
                                                        <Pill
                                                            kind="env"
                                                            value={s.env_eng}
                                                            label={`EnvE: ${s.env_eng}`}
                                                        />
                                                    ) : null}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {s.location_text ?? "—"}
                                                    {s.eng_strength ? ` · Eng: ${s.eng_strength}` : ""}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <form onSubmit={addSelectedToMyList} className="space-y-3">
                            <select
                                className="w-full rounded-xl border px-3 py-2"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option>Considering</option>
                                <option>Building</option>
                                <option>Ready</option>
                                <option>Submitted</option>
                                <option>Waiting</option>
                                <option>Decision</option>
                            </select>

                            <select
                                className="w-full rounded-xl border px-3 py-2"
                                value={bucket}
                                onChange={(e) => setBucket(e.target.value)}
                            >
                                <option value="">Bucket (optional)</option>
                                <option value="Reach">Reach</option>
                                <option value="Match">Match</option>
                                <option value="Safety">Safety</option>
                            </select>

                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    className="rounded-xl border px-3 py-2"
                                    placeholder="Prestige (0–5)"
                                    value={prestige}
                                    onChange={(e) => setPrestige(e.target.value)}
                                />
                                <input
                                    className="rounded-xl border px-3 py-2"
                                    placeholder="Env fit (0–5)"
                                    value={envFit}
                                    onChange={(e) => setEnvFit(e.target.value)}
                                />
                                <input
                                    className="rounded-xl border px-3 py-2"
                                    placeholder="Location (0–5)"
                                    value={locationFit}
                                    onChange={(e) => setLocationFit(e.target.value)}
                                />
                                <input
                                    className="rounded-xl border px-3 py-2"
                                    placeholder="Vibe (0–5)"
                                    value={vibeFit}
                                    onChange={(e) => setVibeFit(e.target.value)}
                                />
                            </div>

                            <textarea
                                className="w-full rounded-xl border px-3 py-2"
                                placeholder="Notes (why you like it, concerns, vibe, etc.)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />

                            <button className="w-full rounded-xl bg-black text-white px-4 py-2">
                                Add to My List
                            </button>
                        </form>
                    </div>

                    <details className="pt-1" open={false}>
                        <summary className="cursor-pointer text-sm text-gray-700 underline select-none">
                            Can’t find a school? Add a custom one
                        </summary>

                        <form
                            onSubmit={addCustomSchoolToCatalog}
                            className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3"
                        >
                            <input
                                className="rounded-xl border px-3 py-2"
                                placeholder="School name (required)"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                required
                            />
                            <input
                                className="rounded-xl border px-3 py-2"
                                placeholder="Location (e.g., Cambridge, MA)"
                                value={customLocation}
                                onChange={(e) => setCustomLocation(e.target.value)}
                            />
                            <input
                                className="rounded-xl border px-3 py-2"
                                placeholder="Website (optional)"
                                value={customWebsite}
                                onChange={(e) => setCustomWebsite(e.target.value)}
                            />

                            <div className="md:col-span-3">
                                <button className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                                    Add to catalog & select it
                                </button>
                            </div>
                        </form>
                    </details>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
            </details>

            {/* My list + filters */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="font-semibold">My List</h2>
                        <p className="text-sm text-gray-600">
                            {dragEnabled
                                ? "Drag ↕ to reorder."
                                : "To reorder: set Sort = Rank and clear filters."}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            className="rounded-xl border px-3 py-2 text-sm"
                            value={filterBucket}
                            onChange={(e) => setFilterBucket(e.target.value)}
                        >
                            <option value="">All buckets</option>
                            <option value="Reach">Reach</option>
                            <option value="Match">Match</option>
                            <option value="Safety">Safety</option>
                        </select>

                        <select
                            className="rounded-xl border px-3 py-2 text-sm"
                            value={filterEnv}
                            onChange={(e) => setFilterEnv(e.target.value)}
                        >
                            <option value="">All EnvE</option>
                            <option value="strong">EnvE strong</option>
                            <option value="available">EnvE available</option>
                            <option value="none">No EnvE</option>
                        </select>

                        <select
                            className="rounded-xl border px-3 py-2 text-sm"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="rank">Sort: rank</option>
                            <option value="name">Sort: name</option>
                            <option value="status">Sort: status</option>
                        </select>

                        {(filterBucket || filterEnv) && (
                            <button
                                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => {
                                    setFilterBucket("");
                                    setFilterEnv("");
                                }}
                                type="button"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <p className="mt-3 text-sm text-gray-600">Loading…</p>
                ) : displayed.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-600">
                        No schools match your filters (or you haven’t added any yet).
                    </p>
                ) : sortBy === "rank" ? (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onDragEnd}
                    >
                        <SortableContext
                            items={displayed.map((r) => r.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="mt-3 divide-y">
                                {displayed.map((row) => (
                                    <SortableMySchoolRow
                                        key={row.id}
                                        row={row}
                                        onRemove={removeFromMyList}
                                        dragEnabled={dragEnabled}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                ) : (
                    <ul className="mt-3 divide-y">
                        {displayed.map((row) => (
                            <SortableMySchoolRow
                                key={row.id}
                                row={row}
                                onRemove={removeFromMyList}
                                dragEnabled={false}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}