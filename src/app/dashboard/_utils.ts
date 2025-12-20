export function isoDate(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
}

export function daysUntil(dueISO: string) {
    const now = new Date();
    const today = startOfDay(now);
    const [y, m, d] = dueISO.split("-").map(Number);
    const due = new Date(y, (m ?? 1) - 1, d ?? 1);
    const ms = due.getTime() - today.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function dueLabel(dueISO: string) {
    const n = daysUntil(dueISO);
    if (n < 0) return `${Math.abs(n)}d overdue`;
    if (n === 0) return "due today";
    if (n === 1) return "due tomorrow";
    return `due in ${n}d`;
}

export function urgencyForDue(dueISO: string): "overdue" | "soon" | "later" {
    const n = daysUntil(dueISO);
    if (n < 0) return "overdue";
    if (n <= 7) return "soon";
    return "later";
}

export function weekStartISO(d: Date) {
    // Monday-start week
    const x = startOfDay(d);
    const day = x.getDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    return isoDate(addDays(x, diff));
}

export function formatWeekLabel(iso: string) {
    const [, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
}
