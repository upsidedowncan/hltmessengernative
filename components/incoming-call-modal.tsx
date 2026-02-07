import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Modal, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({
  visible,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      statusBarTranslucent={false}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        {/* Caller Info */}
        <View style={styles.callerSection}>
          {callerAvatar ? (
            <Image source={{ uri: callerAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{callerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callType}>
            {callType === 'video' ? '📹 Video Call' : '📞 Audio Call'}
          </Text>
          <Text style={styles.incomingText}>Incoming call...</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* Decline */}
          <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={onDecline}>
            <Ionicons name="call" size={32} color="#fff" />
            <Text style={styles.buttonText}>Decline</Text>
          </TouchableOpacity>

          {/* Accept */}
          <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={onAccept}>
            <Ionicons name="call" size={32} color="#fff" />
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 50,
  },
  callerSection: { alignItems: 'center' },
  avatar: { width: 150, height: 150, borderRadius: 75, marginBottom: 24 },
  avatarPlaceholder: {
    width: 150, height: 150, borderRadius: 75, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  avatarInitial: { fontSize: 64, color: '#fff', fontWeight: '300' },
  callerName: { fontSize: 32, color: '#fff', fontWeight: '600', marginBottom: 8 },
  callType: { fontSize: 18, color: '#888', marginBottom: 8 },
  incomingText: { fontSize: 16, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: 2 },
  actionsSection: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 40 },
  button: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  declineButton: { backgroundColor: '#ef5350' },
  acceptButton: { backgroundColor: '#4CAF50' },
  buttonText: { color: '#fff', fontSize: 12, marginTop: 4 },
});
