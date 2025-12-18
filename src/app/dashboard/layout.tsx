import Link from "next/link";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
                <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="rounded-xl border px-3 py-2 text-sm font-medium"
                        >
                            Home
                        </Link>

                        <Link
                            href="/dashboard/colleges"
                            className="rounded-xl border px-3 py-2 text-sm"
                        >
                            Colleges
                        </Link>
                    </div>

                    <div className="text-sm text-gray-600">
                        Ita’s College App App
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl">{children}</main>
        </div>
    );
}