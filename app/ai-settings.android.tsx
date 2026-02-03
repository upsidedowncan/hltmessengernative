import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert, Modal } from 'react-native';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIService, AISettings, DEFAULT_AI_SETTINGS } from '@/services/ai-service';
import { useTheme } from '@/contexts/theme-context';
import { SettingsTile } from '@/components';

export default function AISettingsScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const { theme: m3Theme } = useMaterial3Theme();
  const m3 = m3Theme[isDarkMode ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [availableModels, setAvailableModels] = useState<{ id: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pythonUrl, setPythonUrl] = useState('');
  const [temperature, setTemperature] = useState(DEFAULT_AI_SETTINGS.temperature.toString());
  const [maxTokens, setMaxTokens] = useState(DEFAULT_AI_SETTINGS.max_tokens.toString());

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
    setTemperature(s.temperature.toString());
    setMaxTokens(s.max_tokens.toString());
  };

  const fetchModels = async (provider: string) => {
    setLoadingModels(true);
    try {
      const response = await AIService.getModels(provider);
      if (response && response.data) {
        setAvailableModels(response.data);
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

  const handleTemperatureChange = (delta: number) => {
    const newTemp = Math.max(0, Math.min(2, Number((parseFloat(temperature) + delta).toFixed(1))));
    setTemperature(newTemp.toString());
    updateSetting('temperature', newTemp);
  };

  return (
    <View style={[styles.container, { backgroundColor: m3.background }]}>
      <Appbar.Header elevated={false} style={{ backgroundColor: m3.surface }}>
        <Appbar.BackAction color={m3.onSurface} onPress={() => router.back()} />
        <Appbar.Content title="AI Settings" titleStyle={{ color: m3.onSurface }} />
        <Appbar.Action icon="content-save-outline" iconColor={m3.primary} onPress={handleSave} />
      </Appbar.Header>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            <Text variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>PROVIDER</Text>
            <Surface style={[styles.sectionContent, { backgroundColor: m3.surfaceContainerHighest }]} elevation={1}>
              <SegmentedButtons
                style={styles.picker}
                buttons={[
                  { label: 'Wafer', value: 'wafer' },
                  { label: 'Nebula', value: 'nebula' },
                ]}
                value={settings.provider}
                onValueChange={(value) => updateSetting('provider', value)}
              />
            </Surface>

            <Text variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>MODEL</Text>
            <Surface style={[styles.sectionContent, { backgroundColor: m3.surfaceContainerHighest }]} elevation={1}>
              <SettingsTile
                title={settings.model}
                icon="chip"
                onPress={() => setShowModelPicker(true)}
                surfaceColor={m3.surfaceContainerHighest}
                iconColor={m3.primary}
                textColor={m3.onSurface}
                iconBackgroundColor={m3.primaryContainer}
                rightElement="chevron"
                elevation={0}
                sideChild={loadingModels && <ActivityIndicator size="small" color={m3.primary} />}
              />
            </Surface>

            <Text variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>PARAMETERS</Text>
            <Surface style={[styles.sectionContent, { backgroundColor: m3.surfaceContainerHighest }]} elevation={1}>
              <SettingsTile
                title="Temperature"
                icon="thermometer"
                surfaceColor={m3.surfaceContainerHighest}
                iconColor={m3.primary}
                textColor={m3.onSurface}
                iconBackgroundColor={m3.primaryContainer}
                elevation={0}
                sideInput={
                  <View style={styles.tempContainer}>
                    <Slider
                      style={{ height: 24, width: 100 }}
                      value={parseFloat(temperature)}
                      onValueChange={(value: number) => setTemperature(value.toFixed(1))}
                    />
                    <Text variant="bodySmall" style={{ color: m3.onSurface, width: 36, textAlign: 'right' }}>
                      {temperature}
                    </Text>
                  </View>
                }
              />
              <View style={[styles.divider, { backgroundColor: m3.outlineVariant }]} />
              <SettingsTile
                title="Max Tokens"
                icon="chart-bar"
                surfaceColor={m3.surfaceContainerHighest}
                iconColor={m3.primary}
                textColor={m3.onSurface}
                iconBackgroundColor={m3.primaryContainer}
                elevation={0}
                sideInput={
                  <TextInput
                    style={styles.input}
                    mode="flat"
                    dense
                    keyboardType="numeric"
                    value={maxTokens}
                    onChangeText={(text) => {
                      setMaxTokens(text);
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) {
                        updateSetting('max_tokens', num);
                      }
                    }}
                    textColor={m3.onSurface}
                    theme={{ colors: { surface: 'transparent', onSurface: m3.onSurface } }}
                  />
                }
              />
            </Surface>

            <Text variant="labelMedium" style={[styles.sectionHeader, { color: m3.onSurfaceVariant }]}>PYTHON SANDBOX</Text>
            <Surface style={[styles.sectionContent, { backgroundColor: m3.surfaceContainerHighest }]} elevation={1}>
              <SettingsTile
                title="Backend"
                icon="server-network"
                surfaceColor={m3.surfaceContainerHighest}
                iconColor={m3.primary}
                textColor={m3.onSurface}
                iconBackgroundColor={m3.primaryContainer}
                elevation={0}
                sideInput={
                  <TextInput
                    style={styles.urlInput}
                    mode="flat"
                    dense
                    placeholder="https://your-project.vercel.app/api/execute"
                    placeholderTextColor={m3.onSurfaceVariant}
                    value={pythonUrl}
                    onChangeText={setPythonUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textColor={m3.primary}
                    theme={{ colors: { surface: 'transparent', onSurface: m3.primary } }}
                  />
                }
              />
            </Surface>
          </>
        }
      />

      <Modal visible={showModelPicker} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: m3.surfaceContainerHighest }]}>
            <View style={[styles.modalHeader, { borderBottomColor: m3.outlineVariant }]}>
              <Text variant="titleMedium" style={{ color: m3.onSurface }}>Select Model</Text>
              <IconButton icon="close-circle" size={28} iconColor={m3.onSurfaceVariant} onPress={() => setShowModelPicker(false)} />
            </View>
            <FlatList
              data={availableModels}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableRipple
                  onPress={() => {
                    updateSetting('model', item.id);
                    setShowModelPicker(false);
                  }}
                  style={[styles.modelItem, { borderBottomColor: m3.outlineVariant }]}
                >
                  <View style={styles.modelRow}>
                    <Text variant="bodyLarge" style={{ color: item.id === settings.model ? m3.primary : m3.onSurface }}>
                      {item.id} {AIService.isModelRestricted(settings.provider, item.id) ? '(Limit: 1/day)' : ''}
                    </Text>
                    {item.id === settings.model && <IconButton icon="check" size={20} iconColor={m3.primary} />}
                  </View>
                </TouchableRipple>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionContent: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  picker: { marginBottom: 0, borderRadius: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  tempContainer: { flexDirection: 'row', alignItems: 'center', width: 150 },
  input: { width: 80, backgroundColor: 'transparent', marginVertical: -8 },
  urlInput: { width: 200, backgroundColor: 'transparent', marginVertical: -8, textAlign: 'right' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { height: '50%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  modelItem: { paddingVertical: 4 },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
});
