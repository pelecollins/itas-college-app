"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { getUserOrThrow } from "@/lib/auth/getUser";

import Map, { Marker, Popup, MapRef } from "react-map-gl";
import mapboxgl from "mapbox-gl";

type School = {
    id: string;
    name: string;
    location_text: string | null;
    website: string | null;
    lat: number | null;
    lng: number | null;
};

type MySchoolRow = {
    id: string; // my_schools.id
    school_id: string;
    rank: number;
    status: string;
    ranking_bucket: string | null;
    schools: School;
};

type Pin = {
    mySchoolId: string;
    schoolId: string;
    name: string;
    locationText: string | null;
    website: string | null;
    lat: number;
    lng: number;
    rank: number;
    status: string;
    bucket: string | null;
};

export default function SchoolsMapPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();
    const mapRef = useRef<MapRef | null>(null);

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [pins, setPins] = useState<Pin[]>([]);
    const [missingCoords, setMissingCoords] = useState<MySchoolRow[]>([]);
    const [selected, setSelected] = useState<Pin | null>(null);

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const user = await getUserOrThrow();

            const { data, error } = await supabase
                .from("my_schools")
                .select(
                    `
          id, school_id, rank, status, ranking_bucket,
          schools:schools ( id, name, location_text, website, lat, lng )
        `
                )
                .eq("owner_id", user.id)
                .order("rank", { ascending: true });

            if (error) throw error;

            const rows = (data ?? []) as any as MySchoolRow[];

            const pinsLocal: Pin[] = [];
            const missing: MySchoolRow[] = [];

            for (const r of rows) {
                const s = r.schools;
                const lat = s?.lat ?? null;
                const lng = s?.lng ?? null;

                if (typeof lat === "number" && typeof lng === "number") {
                    pinsLocal.push({
                        mySchoolId: r.id,
                        schoolId: r.school_id,
                        name: s.name,
                        locationText: s.location_text ?? null,
                        website: s.website ?? null,
                        lat,
                        lng,
                        rank: r.rank,
                        status: r.status,
                        bucket: r.ranking_bucket ?? null,
                    });
                } else {
                    missing.push(r);
                }
            }

            setPins(pinsLocal);
            setMissingCoords(missing);
        } catch (e: any) {
            if (String(e?.message).toLowerCase().includes("not signed")) {
                router.replace("/login");
                return;
            }
            setError(e?.message ?? "Failed to load map data");
        } finally {
            setLoading(false);
        }
    }

    // Fit bounds to pins once loaded
    useEffect(() => {
        if (!mapRef.current) return;
        if (pins.length === 0) return;

        const bounds = new mapboxgl.LngLatBounds();
        for (const p of pins) bounds.extend([p.lng, p.lat]);

        try {
            mapRef.current.fitBounds(bounds, {
                padding: 60,
                duration: 800,
                maxZoom: 10,
            });
        } catch {
            // ignore fit errors
        }
    }, [pins]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!token) {
        return (
            <div className="p-6 space-y-3">
                <h1 className="text-2xl font-semibold">School Map</h1>
                <div className="rounded-2xl border bg-white p-4 shadow-sm text-sm text-red-600">
                    Missing <code>NEXT_PUBLIC_MAPBOX_TOKEN</code>. Add it to{" "}
                    <code>.env.local</code> and restart the dev server.
                </div>
                <Link href="/dashboard/colleges" className="underline text-sm">
                    ← Back to colleges
                </Link>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">School Map</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Pins show all schools in your list with coordinates.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/dashboard/colleges" className="rounded-xl border px-3 py-2 text-sm">
                        ← Colleges
                    </Link>
                    <button
                        onClick={() => load()}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border bg-white p-4 shadow-sm text-sm text-red-600">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="rounded-2xl border bg-white p-4 shadow-sm text-sm text-gray-600">
                    Loading map…
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Map */}
                    <div className="lg:col-span-2 rounded-2xl border bg-white shadow-sm overflow-hidden">
                        <div className="h-[520px]">
                            <Map
                                ref={mapRef}
                                mapboxAccessToken={token}
                                initialViewState={{
                                    latitude: 39.5,
                                    longitude: -98.35,
                                    zoom: 3.2,
                                }}
                                mapStyle="mapbox://styles/mapbox/streets-v12"
                                onClick={() => setSelected(null)}
                            >
                                {pins.map((p) => (
                                    <Marker key={p.mySchoolId} latitude={p.lat} longitude={p.lng} anchor="bottom">
                                        <button
                                            type="button"
                                            className="rounded-full border bg-white px-2 py-1 text-xs shadow-sm hover:bg-gray-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelected(p);
                                            }}
                                            title={p.name}
                                        >
                                            #{p.rank}
                                        </button>
                                    </Marker>
                                ))}

                                {selected && (
                                    <Popup
                                        latitude={selected.lat}
                                        longitude={selected.lng}
                                        anchor="top"
                                        closeOnClick={false}
                                        onClose={() => setSelected(null)}
                                    >
                                        <div className="space-y-1">
                                            <div className="font-semibold">{selected.name}</div>
                                            <div className="text-xs text-gray-600">
                                                {selected.locationText ?? "—"}
                                            </div>
                                            <div className="text-xs text-gray-700">
                                                #{selected.rank} · {selected.status}
                                                {selected.bucket ? ` · ${selected.bucket}` : ""}
                                            </div>
                                            <div className="flex items-center gap-3 pt-1">
                                                <Link
                                                    href={`/dashboard/colleges/${selected.mySchoolId}`}
                                                    className="text-xs underline"
                                                >
                                                    Open
                                                </Link>
                                                {selected.website && (
                                                    <a
                                                        className="text-xs underline"
                                                        href={selected.website}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Website
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </Popup>
                                )}
                            </Map>
                        </div>

                        <div className="p-3 text-xs text-gray-600 border-t">
                            Tip: click a pin to open a popup. “Open” goes to the school detail page.
                        </div>
                    </div>

                    {/* Side panel */}
                    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
                        <div>
                            <h2 className="font-semibold">Summary</h2>
                            <div className="mt-2 text-sm text-gray-700">
                                <div>Mapped: {pins.length}</div>
                                <div>Missing coords: {missingCoords.length}</div>
                            </div>
                        </div>

                        {missingCoords.length > 0 && (
                            <div>
                                <h3 className="font-semibold">Missing coordinates</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    These won’t show on the map until their school record has <code>lat</code> and{" "}
                                    <code>lng</code>.
                                </p>
                                <ul className="mt-3 divide-y">
                                    {missingCoords.slice(0, 12).map((r) => (
                                        <li key={r.id} className="py-2">
                                            <Link href={`/dashboard/colleges/${r.id}`} className="text-sm underline">
                                                {r.schools?.name ?? "Unknown"}
                                            </Link>
                                            <div className="text-xs text-gray-600">
                                                {r.schools?.location_text ?? "—"}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {missingCoords.length > 12 && (
                                    <div className="text-xs text-gray-500 mt-2">
                                        Showing 12 of {missingCoords.length}.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-gray-500">
                            If you want, we can add a tiny “Admin: set coordinates” tool later, or batch-fill
                            coordinates via a one-time script.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}