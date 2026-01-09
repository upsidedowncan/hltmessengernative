import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

export function useDeepLinkHandler() {
    const navigation = useNavigation<any>();

    useEffect(() => {
        const handleDeepLink = (event: { url: string }) => {
            const { url } = event;
            const parsed = Linking.parse(url);
            
            // Expected format: hltmessenger://<ScreenName>?param=value
            // path will be <ScreenName>
            
            if (parsed.path) {
                // You might need a mapping here if screen names in navigation 
                // don't match exact paths, or pass to a router
                try {
                    navigation.navigate(parsed.path, parsed.queryParams);
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
    }, [navigation]);
}