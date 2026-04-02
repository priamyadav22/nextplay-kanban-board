import { supabase } from './supabase'

export async function ensureAnonymousSession() {
    const {
        data: { session },
        error: sessionError,

    } = await supabase.auth.getSession()

    if (sessionError) {
        throw sessionError
    }

    if (session) {
        return session
    }

    const { data, error } = await supabase.auth.signInAnonymously()

    if (error) {
        throw error
    }

    return data.session

}