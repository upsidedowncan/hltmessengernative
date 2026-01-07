import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Platform,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { useAppTheme } from '../context/FeatureFlagContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

interface DialogAction {
  label: string;
  onPress: () => void;
  type?: 'primary' | 'secondary' | 'destructive';
}

interface DialogProps {
  visible: boolean;
  title: string;
  description?: string;
  actions: DialogAction[];
  onClose: () => void;
  forceCustom?: boolean;
}

/**
 * Material Design 2 Dialog.
 * Used on Android by default, or on iOS when forceCustom is true.
 */
export const Dialog: React.FC<DialogProps> = ({
  visible,
  title,
  description,
  actions,
  onClose,
  forceCustom = false,
}) => {
  const { theme } = useAppTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  const rOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const rContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      opacity.value = withTiming(1, { duration: 150 });
      scale.value = withTiming(1, { duration: 150 });
    } else {
      opacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) runOnJS(setShouldRender)(false);
      });
      scale.value = withTiming(0.95, { duration: 150 });
    }
  }, [visible]);

  useEffect(() => {
    if (visible && Platform.OS === 'ios' && !forceCustom) {
      Alert.alert(
        title,
        description,
        actions.map(action => ({
          text: action.label,
          onPress: action.onPress,
          style: action.type === 'destructive' ? 'destructive' : 
                 action.type === 'secondary' ? 'cancel' : 'default'
        })),
        { cancelable: true, onDismiss: onClose }
      );
      onClose();
    }
  }, [visible, forceCustom]);

  const isNativeIOS = Platform.OS === 'ios' && !forceCustom;
  if (isNativeIOS || !shouldRender) return null;

  return (
    <Modal transparent visible={shouldRender} animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, rOverlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.dialogContainer, 
            { backgroundColor: theme.cardBackground },
            rContainerStyle
          ]}
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text }]}>
              {title}
            </Text>
            {description && (
              <Text style={[styles.description, { color: theme.tabIconDefault }]}>
                {description}
              </Text>
            )}
          </View>

          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  action.onPress();
                  onClose();
                }}
                style={styles.actionButton}
                activeOpacity={0.5}
              >
                <Text 
                  style={[
                    styles.actionLabel, 
                    { 
                      color: action.type === 'destructive' ? '#D93025' : theme.tint,
                    }
                  ]}
                >
                  {action.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 4,
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 8,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  content: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 64,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.25,
  },
});