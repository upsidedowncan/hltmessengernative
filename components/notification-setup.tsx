import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/colors';
import { useNativePush } from '@/hooks/use-native-push';

const NOTIFICATION_HUB_URL = 'https://hlt-messenger-notifications.vercel.app'; 

export const NotificationSetup = () => {
    const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'native-active'>('loading');
    const [checking, setChecking] = useState(false);
    
    const { permissionStatus, expoPushToken } = useNativePush();

    const checkAndSaveSubscription = async () => {
        setChecking(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setStatus('disabled');
                setChecking(false);
                return;
            }

            // Check if subscription exists
            const { data: existing } = await supabase
                .from('push_subscriptions')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (existing) {
                setStatus('enabled');
            } else if (expoPushToken && permissionStatus === 'granted') {
                console.log('[NotificationSetup] Saving new token...');
                
                // First try insert
                const { error: insertError } = await supabase
                    .from('push_subscriptions')
                    .insert({
                        user_id: user.id,
                        subscription: { token: expoPushToken, platform: Platform.OS },
                        platform: Platform.OS
                    });

                if (insertError) {
                    // If duplicate, that's fine - token already exists
                    if (insertError.code === '23505') {
                        console.log('[NotificationSetup] Token already exists');
                        setStatus('enabled');
                    } else {
                        console.log('[NotificationSetup] Insert error:', insertError.message);
                        // Try update by token as fallback
                        await supabase
                            .from('push_subscriptions')
                            .update({
                                subscription: { token: expoPushToken, platform: Platform.OS },
                                platform: Platform.OS,
                                updated_at: new Date().toISOString()
                            })
                            .eq('subscription->>token', expoPushToken);
                        setStatus('enabled');
                    }
                } else {
                    console.log('[NotificationSetup] Token saved successfully');
                    setStatus('enabled');
                }
            } else {
                setStatus('disabled');
            }
        } catch (e) {
            console.error('[NotificationSetup] Error:', e);
            setStatus('disabled');
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        // Wait a bit for useNativePush to get the token
        const timer = setTimeout(() => {
            checkAndSaveSubscription();
        }, 1000);

        // Also check when permission or token changes
        if (permissionStatus || expoPushToken) {
            checkAndSaveSubscription();
        }

        return () => clearTimeout(timer);
    }, [permissionStatus, expoPushToken]);

    const checkStatus = async () => {
        await checkAndSaveSubscription();
    };

    const openHub = () => {
        Linking.openURL(NOTIFICATION_HUB_URL);
    };

    if (checking) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" color={Colors.light.tint} />
                <Text style={styles.description}>Setting up notifications...</Text>
            </View>
        );
    }

    if (status === 'native-active' || status === 'enabled') {
        return (
            <View style={styles.container}>
                <Text style={styles.successText}>✓ Notifications Active</Text>
                {Platform.OS === 'android' && expoPushToken && (
                    <Text style={styles.description}>
                        Token: {expoPushToken.substring(0, 15)}...
                    </Text>
                )}
            </View>
        );
    }

    // Disabled state
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Enable Notifications</Text>
            <Text style={styles.description}>
                {Platform.OS === 'ios' 
                    ? "iOS requires our Notification Hub for push messages." 
                    : "Set up notifications to receive alerts."}
            </Text>
            <TouchableOpacity style={styles.button} onPress={checkStatus}>
                <Text style={styles.buttonText}>Retry Setup</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        marginVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee'
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 12,
    },
    button: {
        backgroundColor: Colors.light.tint || '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
    successText: {
        color: '#10b981',
        fontWeight: '600',
    }
});
