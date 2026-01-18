import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/services/supabase';
import { useAppTheme } from '../../src/context/FeatureFlagContext';
import { TextField, Tile, AppBar } from '../../src/components';
import { Button, CircularProgress } from '@expo/ui/jetpack-compose';

export default function ProfileScreen() {
  <Text>The Profile page failed to load. Please reboot the app.</Text>
};