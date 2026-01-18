import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ScrollView, Switch, Platform, Button, TextInput } from 'react-native';
import { useFeatureFlags, useAppTheme } from '../src/context/FeatureFlagContext';
import { callService } from '../src/services/CallService';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeIn,
  FadeOut,
  Layout,
} from 'react-native-reanimated';

export default function DevSettingsScreen() {
  const { debugInfo, setOverride, reloadFlags, isLoading } = useFeatureFlags();
  const { theme, isDarkMode } = useAppTheme();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

  const toggleExpand = (key: string, currentValue: string | null) => {
    if (expandedKey === key) {
        setExpandedKey(null);
    } else {
        setExpandedKey(key);
        setCustomInput(currentValue || '');
    }
  };

  const handleSimpleToggle = (key: string, isEnabled: boolean) => {
    setOverride(key, !isEnabled);
  };

  const renderOptions = (item: any) => {
      const options = item.config?.options || [];
      if (!options.length) return null;

      const isCustomValue = !options.includes(item.value) && item.value !== null;

      return (
          <View style={styles.optionsContainer}>
              {options.map((opt: string, idx: number) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (opt === 'Default') setOverride(item.key, undefined, null);
                        else if (opt === 'Custom') {/* Handled by input */}
                        else setOverride(item.key, undefined, opt);
                    }}
                  >
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          {opt !== 'Default' && opt !== 'Custom' && (
                              <View style={[styles.colorPreview, { backgroundColor: opt }]} />
                          )}
                          <Text style={[styles.optionLabel, { color: theme.text }]}>{opt}</Text>
                      </View>
                      {(item.value === opt || (opt === 'Default' && item.value === null)) && (
                          <Ionicons name="checkmark" size={20} color={theme.tint} />
                      )}
                  </TouchableOpacity>
              ))}
              
              {(options.includes('Custom') || isCustomValue) && (
                  <View style={styles.customInputContainer}>
                      <TextInput 
                        style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDarkMode ? '#1c1c1e' : '#fff' }]}
                        placeholder="Enter custom value..."
                        placeholderTextColor={theme.tabIconDefault}
                        value={customInput}
                        onChangeText={setCustomInput}
                        onSubmitEditing={() => setOverride(item.key, undefined, customInput)}
                      />
                      <TouchableOpacity 
                        style={[styles.applyButton, { backgroundColor: theme.tint }]}
                        onPress={() => setOverride(item.key, undefined, customInput)}
                      >
                          <Text style={{color: '#fff', fontWeight: 'bold'}}>Apply</Text>
                      </TouchableOpacity>
                  </View>
              )}
          </View>
      );
  };

  const renderItem = (item: any, index: number) => {
    const isLast = index === debugInfo.length - 1;
    const isExpanded = expandedKey === item.key;
    const isIOS = Platform.OS === 'ios';
    const isCallingFlag = item.key === 'ENABLE_CALLING';
    const isCallingUnsupported = isCallingFlag && !callService.isSupported();
    
    return (
      <Animated.View 
        key={item.key} 
        layout={Layout.springify().damping(25).stiffness(200).mass(0.5)}
        style={{ backgroundColor: theme.cardBackground, overflow: 'hidden', opacity: isCallingUnsupported ? 0.5 : 1 }}
      >
        <TouchableOpacity
          activeOpacity={isCallingUnsupported ? 1 : 0.7}
          style={[styles.item, !isIOS && styles.itemAndroid]}
          onPress={() => !isCallingUnsupported && toggleExpand(item.key, item.value)}
        >
          <View style={styles.itemContent}>
            <Text style={[styles.itemKey, { color: theme.text }]}>{item.key}</Text>
            <Text style={[styles.itemStatus, { color: theme.tabIconDefault }]}>
                {isCallingUnsupported ? 'Unavailable for your platform' : (
                    <>
                      {item.overrideEnabled !== null || item.overrideValue !== null ? 'Overridden' : 'Default'}
                      {item.value && ` (${item.value})`}
                    </>
                )}
            </Text>
          </View>
          
          <View style={styles.rightContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {!isExpanded && (
                    <Switch 
                        value={isCallingUnsupported ? false : item.isEnabled} 
                        onValueChange={() => !isCallingUnsupported && handleSimpleToggle(item.key, item.isEnabled)}
                        disabled={isCallingUnsupported}
                        trackColor={{ 
                            false: '#767577', 
                            true: isIOS ? theme.tint : `${theme.tint}80` 
                        }}
                        thumbColor={item.isEnabled ? (isIOS ? undefined : theme.tint) : (isIOS ? undefined : '#f4f3f4')}
                        ios_backgroundColor="#3e3e3e"
                        style={isIOS ? { transform: [{ scale: 0.8 }] } : {}}
                    />
                )}
                {!isCallingUnsupported && (
                    <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }], marginLeft: 8 }}>
                        <Ionicons name={isIOS ? "chevron-down" : "caret-down"} size={18} color={theme.tabIconDefault} />
                    </View>
                )}
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <Animated.View 
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={[styles.expandedContent, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
          >
            {item.config?.options ? (
                renderOptions(item)
            ) : (
                <View style={styles.optionsContainer}>
                    {[
                    { label: 'Default', enabled: null },
                    { label: 'Always Enabled', enabled: true },
                    { label: 'Always Disabled', enabled: false },
                    ].map((option, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={styles.optionRow}
                        onPress={() => setOverride(item.key, option.enabled as boolean | null)}
                    >
                        <Text style={[styles.optionLabel, { color: theme.text }]}>{option.label}</Text>
                        {item.overrideEnabled === option.enabled && (
                        <Ionicons name="checkmark" size={20} color={theme.tint} />
                        )}
                    </TouchableOpacity>
                    ))}
                </View>
            )}
            <View style={styles.infoBox}>
                 <Text style={[styles.infoText, { color: theme.tabIconDefault }]}>
                     Server: {item.serverEnabled ? 'Enabled' : 'Disabled'} {item.serverValue && `(${item.serverValue})`}
                 </Text>
            </View>
          </Animated.View>
        )}
        
        {!isLast && (
            <View style={[
                styles.separator, 
                { backgroundColor: theme.border },
                isIOS ? { left: 16 } : { left: 0 }
            ]} />
        )}
      </Animated.View>
    );
  };

  const isIOS = Platform.OS === 'ios';

  return (
    <View style={[styles.container, { backgroundColor: isIOS ? (isDarkMode ? '#000' : '#F2F2F7') : theme.background }]}>
      <ScrollView>
        <View style={styles.header}>
            <Text style={[styles.sectionTitle, { color: theme.tabIconDefault }, !isIOS && styles.sectionTitleAndroid]}>FLAGS</Text>
            <Button
                title={isLoading ? 'Syncing...' : 'Sync'}
                onPress={reloadFlags}
                disabled={isLoading}
                color={theme.tint}
            />
        </View>
        
        <Animated.View 
            layout={Layout.springify().damping(25).stiffness(200).mass(0.5)}
            style={[
                styles.listContainer, 
                isIOS ? { backgroundColor: theme.cardBackground, borderColor: theme.border } : [styles.listContainerAndroid, { borderTopColor: theme.border, borderBottomColor: theme.border }]
            ]}
        >
            {debugInfo.length > 0 ? (
                debugInfo.map((item, index) => renderItem(item, index))
            ) : (
                <View style={styles.emptyItem}>
                    <Text style={{ color: theme.tabIconDefault }}>No flags found.</Text>
                </View>
            )}
        </Animated.View>

        <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.tabIconDefault }]}>
                Feature flags allow you to toggle experimental features. Overrides persist locally.
            </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  sectionTitleAndroid: {
      fontWeight: '700',
      fontSize: 12,
  },
  listContainer: {
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContainerAndroid: {
      marginHorizontal: 0,
      borderRadius: 0,
      borderWidth: 0,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
  },
  itemAndroid: {
      paddingVertical: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemKey: {
    fontSize: 17,
    fontWeight: '400',
  },
  itemStatus: {
    fontSize: 12,
    marginTop: 1,
    opacity: 0.6,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedContent: {
      paddingLeft: 16,
  },
  optionsContainer: {
      paddingBottom: 10,
  },
  optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingRight: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  optionLabel: {
      fontSize: 16,
  },
  colorPreview: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 10,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.1)',
  },
  customInputContainer: {
      flexDirection: 'row',
      paddingRight: 16,
      marginTop: 10,
      gap: 10,
      paddingBottom: 10,
  },
  textInput: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
  },
  applyButton: {
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 8,
  },
  infoBox: {
      paddingVertical: 10,
  },
  infoText: {
      fontSize: 12,
      fontStyle: 'italic',
  },
  emptyItem: {
      padding: 20,
      alignItems: 'center',
  },
  separator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
  },
  footer: {
      padding: 16,
      paddingHorizontal: 32,
  },
  footerText: {
      fontSize: 13,
      textAlign: 'left',
  }
});
