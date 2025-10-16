import { type Session, type SupabaseClient } from "@supabase/supabase-js";

export const setSession = async (supabase: SupabaseClient, session: Session) => {
    const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
    });

    if (sessionError) {
        console.error('Session set failed', sessionError.message);
        return null;
    }
    return true;
}

export const getSession = async (supabase: SupabaseClient) => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('Session get failed', sessionError.message);
        return null;
    }
    return session;
}