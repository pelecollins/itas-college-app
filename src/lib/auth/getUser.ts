import { supabaseBrowser } from "@/lib/supabase/browser";

export async function getUserOrThrow() {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
}