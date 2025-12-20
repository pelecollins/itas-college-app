import React from "react";

export function pillClass(kind: "urgency" | "appStatus", value?: string | null) {
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

export function Pill({
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
