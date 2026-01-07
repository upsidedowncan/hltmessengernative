import React, { useState, useRef } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, Platform, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../context/FeatureFlagContext';
import { Button, TextField, Tile, AppBar, BottomSheet, BottomSheetRef, Dialog, Card, Switch, Puller, PullerRef, ContextMenu, ChatListElement } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../context/ToastContext';

const SectionTitle = ({ children }: { children: string }) => {
  const { theme } = useAppTheme();
  const isAndroid = Platform.OS === 'android';
  return (
    <Text style={[
      styles.sectionTitle, 
      { 
        color: theme.tabIconDefault,
        textTransform: isAndroid ? 'uppercase' : 'none',
        fontWeight: isAndroid ? '700' : '600',
        fontSize: isAndroid ? 12 : 13,
        opacity: isAndroid ? 1 : 0.6,
        letterSpacing: isAndroid ? 1 : 0,
      }
    ]}>
      {children}
    </Text>
  );
};

export const ComponentTestScreen = () => {
  const { theme } = useAppTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetRef>(null);
  const pullerRef = useRef<PullerRef>(null);
  
  // Dialog State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [forceCustomDialog, setForceCustomDialog] = useState(false);

  // Switch State
  const [switchValue, setSwitchValue] = useState(false);
  const [forceCustomSwitch, setForceCustomSwitch] = useState(false);

  // Context Menu State
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
  const [forceCustomMenu, setForceCustomMenu] = useState(false);

  // Puller State
  const [pullerGestureEnabled, setPullerGestureEnabled] = useState(true);

  // Component Variables State
  const [btnTitle, setBtnTitle] = useState('Interactive Button');
  const [btnLoading, setBtnLoading] = useState(false);
  const [btnColor, setBtnColor] = useState(theme.tint);
  
  const [appBarTitle, setAppBarTitle] = useState('Component Lab');
  const [backTitle, setBackTitle] = useState('Back');
  const [showBackButton, setShowBackButton] = useState(true);
  const [headerTransparent, setHeaderTransparent] = useState(false);

  const [tileTitle, setTileTitle] = useState('Dynamic Tile');
  const [tileDestructive, setTileDestructive] = useState(false);

  const renderLabContent = () => (
    <View style={{ flex: 1 }}>
      <AppBar 
        isNative={false}
        title={appBarTitle}
        backTitle={backTitle}
        showBackButton={showBackButton}
        transparent={headerTransparent}
        rightComponent={
          <TouchableOpacity onPress={() => Alert.alert('Lab Info', 'Customize components below!')}>
            <Ionicons name="flask" size={24} color={theme.tint} />
          </TouchableOpacity>
        }
      />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* TOAST LAB */}
        <SectionTitle>Toast Lab (New!)</SectionTitle>
        <View style={styles.previewBox}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <Button title="Success" size="small" color="#4CAF50" onPress={() => showToast('Saved!', 'Your profile has been updated successfully.', 'success')} />
            <Button title="Error" size="small" color="#F44336" onPress={() => showToast('Failed', 'Unable to connect to the server. Check your network.', 'error')} />
            <Button title="Warning" size="small" color="#FF9800" onPress={() => showToast('Low Battery', 'Plug in your charger to continue the call.', 'warning')} />
            <Button title="Info" size="small" color="#2196F3" onPress={() => showToast('New Message', 'Gemini sent you a new high-fidelity interaction.', 'info')} />
          </View>
          <Text style={{ color: theme.tabIconDefault, fontSize: 11, marginTop: 12, textAlign: 'center' }}>
            Try pulling UP on the snackbar to reveal description!
          </Text>
        </View>

        {/* CHAT LIST LAB */}
        <SectionTitle>Chat List Lab (Swipeable)</SectionTitle>
        <View style={styles.section}>
          <ChatListElement 
            title="Gemini AI"
            subtitle="Swipe far to archive or delete!"
            time="12:45 PM"
            unreadCount={3}
            onPress={() => Alert.alert('Chat Pressed')}
            onDelete={() => showToast('Deleted', 'The conversation with Gemini has been removed.', 'error')}
            onArchive={() => showToast('Archived', 'Chat moved to your archives safely.', 'success')}
          />
        </View>

        {/* APPBAR CONTROLS */}
        <SectionTitle>App Bar Controls</SectionTitle>
        <View style={styles.controlsGroup}>
          <TextField label="Header Title" value={appBarTitle} onChangeText={setAppBarTitle} groupPosition="top" />
          <Tile title="Show Back Button" groupPosition="middle" chevron={false} rightElement={<Switch value={showBackButton} onValueChange={setShowBackButton} />} />
          <TextField label="Back Button Text (iOS)" value={backTitle} onChangeText={setBackTitle} groupPosition="bottom" />
        </View>

        {/* BUTTON PREVIEW & CONTROLS */}
        <SectionTitle>Button Lab</SectionTitle>
        <View style={styles.previewBox}>
          <Button title={btnTitle} onPress={() => Alert.alert('Pressed!')} loading={btnLoading} color={btnColor} />
        </View>
        <View style={styles.controlsGroup}>
          <TextField label="Button Label" value={btnTitle} onChangeText={setBtnTitle} groupPosition="top" />
          <TextField label="Custom Color (Hex)" value={btnColor} onChangeText={setBtnColor} groupPosition="middle" />
          <Tile title="Loading State" groupPosition="bottom" chevron={false} rightElement={<Switch value={btnLoading} onValueChange={setBtnLoading} />} />
        </View>

        {/* CONTEXT MENU LAB */}
        <SectionTitle>Context Menu Lab</SectionTitle>
        <View style={styles.previewBox}>
          <TouchableOpacity 
            onLongPress={(e) => {
              setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
              setMenuVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.mockButton, { backgroundColor: theme.tint }]}>
              <Ionicons name="menu" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Long Press for Menu</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.controlsGroup}>
          <Tile title="Force iOS Style" subtitle="Show blurred iOS menu even on Android" chevron={false} rightElement={<Switch value={forceCustomMenu} onValueChange={setForceCustomMenu} />} />
        </View>

        {/* SWITCH LAB */}
        <SectionTitle>Switch Lab</SectionTitle>
        <View style={styles.previewBox}>
          <Switch value={switchValue} onValueChange={setSwitchValue} forceCustom={forceCustomSwitch} />
        </View>
        <View style={styles.controlsGroup}>
          <Tile title="Force Custom Switch" subtitle="Show custom Android switch even on iOS" chevron={false} rightElement={<Switch value={forceCustomSwitch} onValueChange={setForceCustomSwitch} />} />
        </View>

        {/* PULLER LAB */}
        <SectionTitle>Puller Lab (The Unique One)</SectionTitle>
        <View style={[styles.previewBox, { height: 100 }]}>
          <Text style={{ color: theme.tabIconDefault, fontSize: 12, textAlign: 'center', marginBottom: 12 }}>Puller bar anchored at the bottom!</Text>
          <Button title="Toggle Puller via Code" onPress={() => pullerRef.current?.toggle()} type="ghost" size="small" />
        </View>
        <View style={styles.controlsGroup}>
          <Tile title="Enable Gestures" subtitle="Try pulling up the bar below" chevron={false} rightElement={<Switch value={pullerGestureEnabled} onValueChange={setPullerGestureEnabled} />} />
        </View>

        {/* BOTTOM SHEET LAB */}
        <SectionTitle>Bottom Sheet Lab</SectionTitle>
        <View style={styles.previewBox}>
          <Button title="Open Bottom Sheet" onPress={() => sheetRef.current?.expand()} type="secondary" icon="arrow-up-circle-outline" />
        </View>

        {/* DIALOG LAB */}
        <SectionTitle>Dialog Lab</SectionTitle>
        <View style={styles.previewBox}>
          <Button title="Trigger Dialog" onPress={() => setDialogVisible(true)} type="secondary" icon="alert-circle-outline" />
        </View>
        <View style={styles.controlsGroup}>
          <Tile title="Force Custom UI" subtitle="Show custom dialog even on iOS" chevron={false} rightElement={<Switch value={forceCustomDialog} onValueChange={setForceCustomDialog} />} />
        </View>

        {/* STATIC SAMPLES */}
        <SectionTitle>Static Theme Samples</SectionTitle>
        <View style={styles.section}>
          <Tile title="Dark Mode" icon="moon" iconBackgroundColor="#5856D6" rightElement={<Text style={{color: theme.tabIconDefault}}>{Platform.OS}</Text>} />
          <Tile title="Accent Color" icon="color-palette" iconBackgroundColor={theme.tint} subtitle={theme.tint} />
        </View>
      </ScrollView>

      <Puller 
        ref={pullerRef}
        gestureEnabled={pullerGestureEnabled}
        baseContent={
          <View style={styles.pullerBase}>
            <Ionicons name="add" size={24} color={theme.tint} />
            <View style={[styles.mockInput, { backgroundColor: theme.border + '40' }]}><Text style={{ color: theme.tabIconDefault }}>Pull me up...</Text></View>
            <TouchableOpacity onPress={() => pullerRef.current?.toggle()}><Ionicons name="chevron-up" size={24} color={theme.tint} /></TouchableOpacity>
          </View>
        }
        expandedContent={
          <View style={styles.pullerExpanded}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
              <View style={styles.pullerAction}><View style={[styles.pullerIcon, { backgroundColor: '#007AFF' }]}><Ionicons name="image" size={24} color="#fff" /></View><Text style={{ color: theme.text, fontSize: 12, marginTop: 4 }}>Photos</Text></View>
              <View style={styles.pullerAction}><View style={[styles.pullerIcon, { backgroundColor: '#FF9500' }]}><Ionicons name="camera" size={24} color="#fff" /></View><Text style={{ color: theme.text, fontSize: 12, marginTop: 4 }}>Camera</Text></View>
              <View style={styles.pullerAction}><View style={[styles.pullerIcon, { backgroundColor: '#5856D6' }]}><Ionicons name="document" size={24} color="#fff" /></View><Text style={{ color: theme.text, fontSize: 12, marginTop: 4 }}>File</Text></View>
              <View style={styles.pullerAction}><View style={[styles.pullerIcon, { backgroundColor: '#FF3B30' }]}><Ionicons name="location" size={24} color="#fff" /></View><Text style={{ color: theme.text, fontSize: 12, marginTop: 4 }}>Location</Text></View>
            </View>
          </View>
        }
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ContextMenu 
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        forceCustom={forceCustomMenu}
        anchorPosition={menuAnchor}
        behindContent={
          <BottomSheet ref={sheetRef} behindContent={renderLabContent()}>
            <View style={{ padding: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 }}>Depth Effect</Text>
              <Text style={{ fontSize: 16, color: theme.tabIconDefault, marginBottom: 24, lineHeight: 22 }}>Observe how the screen content behind this sheet scales down and rounds its corners.</Text>
              <Button title="Close Lab Sheet" onPress={() => sheetRef.current?.close()} type="primary" />
            </View>
          </BottomSheet>
        }
        items={[
          { label: 'Edit Profile', icon: 'create-outline', onPress: () => {} },
          { label: 'Share Link', icon: 'share-outline', onPress: () => {} },
          { label: 'Logout', icon: 'log-out-outline', destructive: true, onPress: () => {} },
        ]}
      />

      <Dialog visible={dialogVisible} onClose={() => setDialogVisible(false)} forceCustom={forceCustomDialog} title="Confirmation" description="High-fidelity custom dialog with smooth transitions." actions={[{ label: 'Cancel', onPress: () => {}, type: 'secondary' }, { label: 'Confirm', onPress: () => {}, type: 'primary' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  sectionTitle: { marginBottom: 8, marginTop: 32, marginLeft: 4 },
  section: { gap: 8 },
  previewBox: { padding: 20, backgroundColor: 'rgba(128,128,128,0.05)', borderRadius: 16, marginBottom: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)' },
  controlsGroup: { marginBottom: 16 },
  mockButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  pullerBase: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  mockInput: { flex: 1, height: 36, borderRadius: 18, justifyContent: 'center', paddingHorizontal: 12 },
  pullerExpanded: { padding: 20, paddingTop: 10, alignItems: 'center' },
  pullerAction: { alignItems: 'center' },
  pullerIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
});
