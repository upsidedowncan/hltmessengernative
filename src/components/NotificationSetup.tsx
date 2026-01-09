import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { Colors } from '../constants/Colors';
import { useNativePush } from '../hooks/useNativePush';

const NOTIFICATION_HUB_URL = 'https://hlt-messenger-notifications.vercel.app'; 

export const NotificationSetup = () => {
    const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'native-active'>('loading');
    
    // Only triggers on native platforms
    const { permissionStatus } = useNativePush();

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [permissionStatus]);

    const checkStatus = async () => {
        if (Platform.OS === 'android' && permissionStatus === 'granted') {
            setStatus('native-active');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);

        if (data && data.length > 0) {
            setStatus('enabled');
        } else {
            setStatus('disabled');
        }
    };

    const openHub = () => {
        Linking.openURL(NOTIFICATION_HUB_URL);
    };

    if (status === 'native-active') {
        return (
            <View style={styles.container}>
                <Text style={styles.successText}>✓ Notifications Active (Device)</Text>
            </View>
        );
    }

    if (status === 'enabled') {
        return (
            <View style={styles.container}>
                <Text style={styles.successText}>✓ Notifications Active (Hub)</Text>
            </View>
        );
    }

    // iOS or others requiring PWA Hub
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Enable Notifications</Text>
            <Text style={styles.description}>
                {Platform.OS === 'ios' 
                    ? "iOS requires our Notification Hub for push messages." 
                    : "Set up the Notification Hub to receive alerts."}
            </Text>
            <TouchableOpacity style={styles.button} onPress={openHub}>
                <Text style={styles.buttonText}>Open Setup Guide</Text>
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
        backgroundColor: Colors.primary || '#000',
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