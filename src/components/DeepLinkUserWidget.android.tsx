import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Text, Button, Avatar, ActivityIndicator, IconButton, Surface } from 'react-native-paper';

type DeepLinkUserWidgetProps = {
    username: string;
};

type Profile = {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
};

export const DeepLinkUserWidget = ({ username }: DeepLinkUserWidgetProps) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { isDarkMode } = useTheme();
    const { theme: m3Theme } = useMaterial3Theme();
    const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url')
                    .eq('username', username)
                    .single();

                if (error) throw error;
                setProfile(data);
            } catch (error) {
                console.warn('Error fetching profile for widget:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [username]);

    const handlePress = () => {
        if (!profile) return;
        router.push({
            pathname: '/chat/[id]',
            params: {
                id: profile.id,
                friendId: profile.id,
                friendName: profile.full_name || profile.username,
                friendAvatar: profile.avatar_url || undefined
            }
        });
    };

    if (loading) {
        return (
            <Surface style={[styles.container, { backgroundColor: m3.surfaceContainer }]} elevation={1}>
                <View style={styles.loadingContent}>
                    <ActivityIndicator size="small" color={m3.primary} />
                </View>
            </Surface>
        );
    }

    if (!profile) {
        return (
            <Surface style={[styles.container, { backgroundColor: m3.surfaceContainerHighest }]} elevation={0}>
                <View style={styles.errorContent}>
                    <IconButton icon="alert-circle-outline" size={24} iconColor={m3.error} />
                    <Text variant="bodyMedium" style={{ color: m3.onSurfaceVariant }}>User @{username} not found</Text>
                </View>
            </Surface>
        );
    }

    const initials = (profile.full_name || profile.username || '?').substring(0, 2).toUpperCase();

    return (
        <Surface style={[styles.container, { backgroundColor: m3.surfaceContainer }]} elevation={1}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Avatar.Text 
                        size={40} 
                        label={initials} 
                        style={{ backgroundColor: m3.primaryContainer }}
                        color={m3.onPrimaryContainer}
                    />
                    <View style={styles.info}>
                        <Text variant="titleMedium" style={{ color: m3.onSurface }}>{profile.full_name}</Text>
                        <Text variant="bodySmall" style={{ color: m3.onSurfaceVariant }}>@{profile.username}</Text>
                    </View>
                </View>
                <Button 
                    mode="contained" 
                    onPress={handlePress}
                    style={{ marginTop: 12, borderRadius: 8 }}
                    contentStyle={{ height: 36 }}
                    labelStyle={{ fontSize: 13, marginVertical: 0 }}
                    buttonColor={m3.primary}
                    textColor={m3.onPrimary}
                    icon="chat-processing-outline"
                >
                    Chat
                </Button>
            </View>
        </Surface>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 220,
        marginVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    content: {
        padding: 12,
    },
    loadingContent: {
        paddingVertical: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    info: {
        marginLeft: 12,
        flex: 1,
    },
});