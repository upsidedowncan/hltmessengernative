import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';

export function useDeepLinkHandler() {
    const router = useRouter();

    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            const parsed = Linking.parse(url);
            
            // Expected format: hlt://<path>?param=value
            
            // Handle chat by username: hlt://chat?username=<username>
            if (parsed.path === 'chat' && parsed.queryParams?.username) {
                const username = parsed.queryParams.username as string;
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('username', username)
                        .single();

                    if (data && !error) {
                        router.push({
                            pathname: '/chat/[id]',
                            params: {
                                id: data.id,
                                friendId: data.id,
                                friendName: data.full_name || data.username,
                                friendAvatar: data.avatar_url || undefined
                            }
                        });
                        return;
                    } else {
                         console.warn('User not found for deep link username:', username);
                    }
                } catch (e) {
                    console.warn('Error resolving username for deep link:', e);
                }
            }

            if (parsed.path) {
                try {
                    // Try to navigate to the path directly if it matches a route
                    // Ensure path starts with /
                    const path = parsed.path.startsWith('/') ? parsed.path : `/${parsed.path}`;
                    // @ts-ignore
                    router.push({ pathname: path, params: parsed.queryParams });
                } catch (e) {
                    console.warn('Navigation failed for deep link:', parsed.path, e);
                }
            }
        };

        // Handle app launch from deep link
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        // Handle deep links while app is running
        const subscription = Linking.addEventListener('url', handleDeepLink);

        return () => {
            subscription.remove();
        };
    }, [router]);
}
