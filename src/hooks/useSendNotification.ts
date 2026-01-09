import { supabase } from '../services/supabase';

// Helper to build deep links (adjust scheme/host as needed)
const buildDeepLink = (screen?: string, params?: Record<string, string>) => {
    // Scheme from app.json is 'hltmessenger'
    // Format: hltmessenger://<screen>?param=value
    if (!screen) return undefined;
    
    let url = `hltmessenger://${screen}`;
    if (params) {
        const queryString = new URLSearchParams(params).toString();
        url += `?${queryString}`;
    }
    return url;
};

export function useSendNotification() {
    const sendNotification = async ({
        userId,
        title,
        body,
        screen,
        params
    }: {
        userId: string;
        title: string;
        body: string;
        screen?: string;
        params?: Record<string, string>;
    }) => {
        try {
            const deep_link = buildDeepLink(screen, params);
            
            const { data, error } = await supabase.functions.invoke('send-push', {
                body: { user_id: userId, title, body, deep_link }
            });

            if (error) {
                console.error('Failed to send notification:', error);
                throw error;
            }
            
            return data;
        } catch (err) {
            console.error('Error in useSendNotification:', err);
            throw err;
        }
    };

    return { sendNotification };
}