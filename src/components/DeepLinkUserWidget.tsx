import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

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
    const { theme } = useTheme();

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
            <View style={[styles.container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.tint} />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={[styles.container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                <Ionicons name="alert-circle-outline" size={24} color={theme.text} />
                <Text style={[styles.errorText, { color: theme.text }]}>User @{username} not found</Text>
            </View>
        );
    }

    const initials = (profile.full_name || profile.username || '?').substring(0, 2).toUpperCase();

    return (
        <View style={[styles.container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <View style={styles.header}>
                <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.info}>
                    <Text style={[styles.name, { color: theme.text }]}>{profile.full_name}</Text>
                    <Text style={[styles.username, { color: theme.tabIconDefault }]}>@{profile.username}</Text>
                </View>
            </View>
            <TouchableOpacity 
                style={[styles.button, { backgroundColor: theme.tint }]} 
                onPress={handlePress}
            >
                <Text style={styles.buttonText}>Chat</Text>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        width: 200,
        marginVertical: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    info: {
        flex: 1,
    },
    name: {
        fontWeight: '600',
        fontSize: 14,
    },
    username: {
        fontSize: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    errorText: {
        marginLeft: 8,
        fontSize: 14,
    }
});