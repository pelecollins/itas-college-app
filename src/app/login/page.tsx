"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

function getOrigin() {
    // On the login page, window exists, but this keeps TS happy + avoids edge cases.
    if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;

    // Fallback for safety (shouldn't really be used on this client page)
    return process.env.NEXT_PUBLIC_SITE_URL ?? "https://itas-college-app.vercel.app";
}

export default function LoginPage() {
    const supabase = useMemo(() => supabaseBrowser(), []);
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If a session already exists, go to dashboard
    useEffect(() => {
        let mounted = true;

        (async () => {
            const { data, error } = await supabase.auth.getSession();
            if (!mounted) return;

            if (error) {
                // Not fatal — just show error.
                setError(error.message);
                return;
            }

            if (data.session) router.replace("/dashboard");
        })();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) router.replace("/dashboard");
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, [router, supabase]);

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSent(false);

        const origin = getOrigin();

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${origin}/auth/callback`,
            },
        });

        setLoading(false);
        if (error) setError(error.message);
        else setSent(true);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold">Sign in</h1>
                <p className="mt-1 text-sm text-gray-600">We’ll email you a magic link to sign in.</p>

                <form onSubmit={handleSignIn} className="mt-4 space-y-3">
                    <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-black px-3 py-2 text-white disabled:opacity-60"
                    >
                        {loading ? "Sending…" : "Send magic link"}
                    </button>
                </form>

                {sent ? <p className="mt-3 text-sm text-green-700">Check your email for the sign-in link.</p> : null}
                {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>
        </div>
    );
}