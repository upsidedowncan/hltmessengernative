import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { useAppTheme } from '../src/context/FeatureFlagContext';
import { AppBar } from '../src/components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Button, 
  CircularProgress, 
  ContextMenu, 
  Chip, 
  DateTimePicker, 
  LinearProgress, 
  Picker, 
  Slider, 
  Switch 
} from '@expo/ui/jetpack-compose';

const SectionTitle = ({ children }: { children: string }) => {
  const { theme } = useAppTheme();
  return (
    <Text style={[
      styles.sectionTitle, 
      { 
        color: theme.tabIconDefault,
        textTransform: 'uppercase',
        fontWeight: '700',
        fontSize: 12,
        opacity: 1,
        letterSpacing: 1,
      }
    ]}>
      {children}
    </Text>
  );
};

export default function ComponentTestScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  // State
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sliderValue, setSliderValue] = useState(0.5);
  const [switchChecked, setSwitchChecked] = useState(false);

  const handleFilterToggle = (filter: string) => {
    if (selectedFilters.includes(filter)) {
      setSelectedFilters(selectedFilters.filter(f => f !== filter));
    } else {
      setSelectedFilters([...selectedFilters, filter]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppBar 
        isNative={false}
        title="Expo UI (Compose)"
        showBackButton={true}
      />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionTitle>Button</SectionTitle>
        <View style={styles.previewBox}>
          <Button
            style={{ width: 200 }}
            variant="default"
            onPress={() => Alert.alert('Pressed!')}>
            Default Button
          </Button>
          <Button
            style={{ width: 200, marginTop: 10 }}
            variant="bordered"
            onPress={() => Alert.alert('Pressed!')}>
            Bordered Button
          </Button>
        </View>

        <SectionTitle>Progress Indicators</SectionTitle>
        <View style={styles.previewBox}>
          <Text style={{marginBottom: 10, color: theme.text}}>Circular</Text>
          <CircularProgress progress={0.5} style={{ width: 50, height: 50 }} color={theme.tint} />
          
          <Text style={{marginTop: 20, marginBottom: 10, color: theme.text}}>Linear</Text>
          <LinearProgress progress={0.7} style={{ width: '100%', height: 4 }} color={theme.tint} />
        </View>

        <SectionTitle>Chips</SectionTitle>
        <View style={styles.previewBox}>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
            <Chip
              variant="assist"
              label="Assist"
              leadingIcon="filled.Add"
              onPress={() => {}}
            />
            <Chip
              variant="filter"
              label="Filter Me"
              leadingIcon="filled.Star"
              selected={selectedFilters.includes('Filter Me')}
              onPress={() => handleFilterToggle('Filter Me')}
            />
            <Chip
              variant="input"
              label="Input"
              leadingIcon="filled.Create"
              onDismiss={() => {}}
            />
            <Chip
              variant="suggestion"
              label="Suggestion"
              leadingIcon="filled.LocationOn"
              onPress={() => {}}
            />
          </View>
        </View>

        <SectionTitle>Context Menu</SectionTitle>
        <View style={styles.previewBox}>
          <ContextMenu style={{ width: 150, height: 50 }}>
            <ContextMenu.Items>
              <Button onPress={() => {}}>Option 1</Button>
              <Button onPress={() => {}}>Option 2</Button>
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              <Button variant="bordered" style={{ width: 150, height: 50 }}>
                Open Menu
              </Button>
            </ContextMenu.Trigger>
          </ContextMenu>
        </View>

        <SectionTitle>Pickers</SectionTitle>
        <View style={styles.previewBox}>
          <Text style={{marginBottom: 10, color: theme.text}}>Segmented</Text>
          <Picker
            options={['One', 'Two', 'Three']}
            selectedIndex={selectedIndex}
            onOptionSelected={({ nativeEvent: { index } }) => setSelectedIndex(index)}
            variant="segmented"
          />
          
          <Text style={{marginTop: 20, marginBottom: 10, color: theme.text}}>Radio</Text>
          <Picker
            options={['Option A', 'Option B', 'Option C']}
            selectedIndex={selectedIndex}
            onOptionSelected={({ nativeEvent: { index } }) => setSelectedIndex(index)}
            variant="radio"
          />
        </View>

        <SectionTitle>Date & Time</SectionTitle>
        <View style={styles.previewBox}>
          <DateTimePicker
            onDateSelected={date => setSelectedDate(new Date(date))}
            displayedComponents='date'
            initialDate={selectedDate.toISOString()}
            variant='picker'
          />
          <View style={{height: 10}} />
          <DateTimePicker
            onDateSelected={date => setSelectedDate(new Date(date))}
            displayedComponents='hourAndMinute'
            initialDate={selectedDate.toISOString()}
            variant='picker'
          />
        </View>

        <SectionTitle>Controls</SectionTitle>
        <View style={styles.previewBox}>
          <Text style={{color: theme.text}}>Slider: {sliderValue.toFixed(2)}</Text>
          <Slider
            style={{ minHeight: 40, width: '100%' }}
            value={sliderValue}
            onValueChange={(value) => setSliderValue(value)}
          />
          
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 10}}>
            <Text style={{color: theme.text}}>Switch</Text>
            <Switch
              value={switchChecked}
              onValueChange={checked => setSwitchChecked(checked)}
              color={theme.tint}
              variant="switch"
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16 },
  sectionTitle: { marginBottom: 8, marginTop: 32, marginLeft: 4 },
  previewBox: { 
    padding: 20, 
    backgroundColor: 'rgba(128,128,128,0.05)', 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(128,128,128,0.1)' 
  },
});