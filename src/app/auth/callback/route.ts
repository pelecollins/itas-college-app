import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    // If no code, go back to login
    if (!code) {
        return NextResponse.redirect(new URL("/login", url.origin));
    }

    // Prepare a response we can attach cookies to
    const response = NextResponse.redirect(new URL("/dashboard", url.origin));

    // Create SSR client that can READ/WRITE cookies
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    // NextResponse doesn't expose request cookies directly; read from request headers
                    const cookieHeader = request.headers.get("cookie") ?? "";
                    // Minimal cookie parsing into { name, value } pairs
                    return cookieHeader
                        .split(";")
                        .map((c) => c.trim())
                        .filter(Boolean)
                        .map((c) => {
                            const idx = c.indexOf("=");
                            return idx === -1
                                ? { name: c, value: "" }
                                : { name: c.slice(0, idx), value: c.slice(idx + 1) };
                        });
                },
                setAll(cookies) {
                    cookies.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // Exchange code for a session and set auth cookies on the response
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    }

    return response;
}