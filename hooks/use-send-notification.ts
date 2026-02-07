import { supabase } from '@/services/supabase';

// Helper to build deep links (adjust scheme/host as needed)
const buildDeepLink = (screen?: string, params?: Record<string, string>) => {
    // Scheme from app.json is 'swift'
    // Format: swift://<screen>?param=value
    if (!screen) return undefined;
    
    let url = `swift://${screen}`;
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
            
            console.log(`[Notifications] Sending to user ${userId}: ${title}`);
            
            const result = await supabase.functions.invoke('send-push', {
                body: { user_id: userId, title, body, deep_link }
            });

            const { data, error } = result;
            const response = 'response' in result ? (result as any).response : undefined;

            console.log(`[Notifications] Response:`, { data, error, status: response?.status });

            if (error) {
                console.error('[Notifications] Supabase function error:', error);
                throw error;
            }
            
            return data;
        } catch (err: any) {
            console.error('[Notifications] Failed to send notification:', err);
            throw err;
        }
    };

    return { sendNotification };
}
