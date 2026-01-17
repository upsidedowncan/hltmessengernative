import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AIService, AISettings, DEFAULT_AI_SETTINGS } from '../services/AIService';
import { useAppTheme } from '../context/FeatureFlagContext';
import { AppBar } from '../components/AppBar';

export const AISettingsScreen = () => {
  const navigation = useNavigation();
  const { theme, isDarkMode } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [availableModels, setAvailableModels] = useState<{ id: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pythonUrl, setPythonUrl] = useState('');

  useEffect(() => {
    loadSettings();
    loadPythonUrl();
  }, []);

  const loadPythonUrl = async () => {
    const url = await AsyncStorage.getItem('python_backend_url');
    setPythonUrl(url || 'https://hltpyexec.vercel.app/api/execute');
  };

  useEffect(() => {
    if (settings.provider) {
      fetchModels(settings.provider);
    }
  }, [settings.provider]);

  const loadSettings = async () => {
    const s = await AIService.getSettings();
    setSettings(s);
  };

  const fetchModels = async (provider: string) => {
    setLoadingModels(true);
    try {
      const response = await AIService.getModels(provider);
      if (response && response.data) {
        setAvailableModels(response.data);
        // If current model is not in the new list, select the first one
        const currentModelExists = response.data.find((m: any) => m.id === settings.model);
        if (!currentModelExists && response.data.length > 0) {
          setSettings(prev => ({ ...prev, model: response.data[0].id }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch models', error);
      Alert.alert('Error', 'Failed to load models for this provider');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = async () => {
    await AIService.saveSettings(settings);
    await AsyncStorage.setItem('python_backend_url', pythonUrl.trim());
    navigation.goBack();
  };

  const updateSetting = (key: keyof AISettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderProviderOption = (id: string, label: string, icon: string) => {
    const isSelected = settings.provider === id;
    return (
      <TouchableOpacity
        style={[
          styles.providerOption,
          { 
            backgroundColor: isSelected ? theme.tint : (isDarkMode ? '#2c2c2e' : '#f2f2f7'),
            borderColor: isSelected ? theme.tint : theme.border,
          }
        ]}
        onPress={() => updateSetting('provider', id)}
      >
        <Ionicons name={icon as any} size={24} color={isSelected ? '#fff' : theme.text} />
        <Text style={[styles.providerLabel, { color: isSelected ? '#fff' : theme.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AppBar
        title="AI Settings"
        showBack
        rightComponent={
          <TouchableOpacity onPress={handleSave}>
            <Text style={{ color: theme.tint, fontWeight: '600', fontSize: 16 }}>Save</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        
        <Text style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>PROVIDER</Text>
        <View style={styles.providerContainer}>
          {renderProviderOption('wafer', 'Wafer (Cerebras)', 'hardware-chip-outline')}
          {renderProviderOption('nebula', 'Nebula (Cloudflare)', 'cloudy-night-outline')}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.tabIconDefault, marginTop: 24 }]}>MODEL</Text>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          onPress={() => setShowModelPicker(true)}
        >
          <Text style={{ color: theme.text, fontSize: 16 }}>{settings.model}</Text>
          {loadingModels ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.tabIconDefault} />
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: theme.tabIconDefault, marginTop: 24 }]}>PARAMETERS</Text>
        <View style={[styles.row, { backgroundColor: theme.cardBackground, borderColor: theme.border, justifyContent: 'space-between' }]}>
          <Text style={{ color: theme.text, fontSize: 16 }}>Temperature</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => updateSetting('temperature', Math.max(0, Number((settings.temperature - 0.1).toFixed(1))))}>
              <Ionicons name="remove-circle-outline" size={24} color={theme.tint} />
            </TouchableOpacity>
            <Text style={{ color: theme.text, width: 30, textAlign: 'center' }}>{settings.temperature}</Text>
            <TouchableOpacity onPress={() => updateSetting('temperature', Math.min(2, Number((settings.temperature + 0.1).toFixed(1))))}>
              <Ionicons name="add-circle-outline" size={24} color={theme.tint} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.row, { backgroundColor: theme.cardBackground, borderColor: theme.border, justifyContent: 'space-between', marginTop: 12 }]}>
          <Text style={{ color: theme.text, fontSize: 16 }}>Max Tokens</Text>
          <TextInput
            style={{ color: theme.text, fontSize: 16, textAlign: 'right', minWidth: 50 }}
            keyboardType="numeric"
            value={String(settings.max_tokens)}
            onChangeText={(text) => updateSetting('max_tokens', Number(text))}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.tabIconDefault, marginTop: 24 }]}>PYTHON SANDBOX</Text>
        <View style={[styles.row, { backgroundColor: theme.cardBackground, borderColor: theme.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>Backend URL</Text>
            <Ionicons name="server-outline" size={20} color={theme.tabIconDefault} />
          </View>
          <TextInput
            style={{ color: theme.tint, fontSize: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}
            placeholder="https://your-project.vercel.app/api/execute"
            placeholderTextColor={theme.tabIconDefault}
            value={pythonUrl}
            onChangeText={setPythonUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ color: theme.tabIconDefault, fontSize: 11 }}>
            Endpoint for Python execution (Vercel, Render, ngrok)
          </Text>
        </View>

      </ScrollView>

      <Modal visible={showModelPicker} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground, paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Model</Text>
              <TouchableOpacity onPress={() => setShowModelPicker(false)}>
                <Ionicons name="close-circle" size={28} color={theme.tabIconDefault} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableModels}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modelItem, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    updateSetting('model', item.id);
                    setShowModelPicker(false);
                  }}
                >
                  <Text style={{ color: item.id === settings.model ? theme.tint : theme.text, fontSize: 16 }}>
                    {item.id} {AIService.isModelRestricted(settings.provider, item.id) ? '(Limit: 1/day)' : ''}
                  </Text>
                  {item.id === settings.model && <Ionicons name="checkmark" size={20} color={theme.tint} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  providerContainer: { flexDirection: 'row', gap: 12 },
  providerOption: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  providerLabel: { fontWeight: '600', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { height: '50%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modelItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
});