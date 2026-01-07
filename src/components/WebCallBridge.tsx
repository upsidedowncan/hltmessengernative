import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export type WebCallBridgeHandle = {
  startCall: (peerId: string) => void;
  acceptCall: () => void;
  endCall: () => void;
  toggleMute: (muted: boolean) => void;
};

interface Props {
  userId: string;
  onStatusChange: (status: string) => void;
  onRemoteStream: () => void;
  onCallEnd: () => void;
  onReady?: () => void;
}

export const WebCallBridge = forwardRef<WebCallBridgeHandle, Props>(({ userId, onStatusChange, onRemoteStream, onCallEnd, onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);

  // We use a hosted version because local HTML strings are not considered "Secure Context" 
  // and thus cannot access the microphone in most WebViews.
  const bridgeUrl = 'https://hltcallbridge.vercel.app';

  useImperativeHandle(ref, () => ({
    startCall: (peerId: string) => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'start', peerId }));
    },
    acceptCall: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'accept' }));
    },
    endCall: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'end' }));
    },
    toggleMute: (muted: boolean) => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'mute', muted }));
    }
  }));

  const onMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'status':
          onStatusChange(data.status);
          if (data.status === 'Ready' && onReady) onReady();
          break;
        case 'incoming-call':
          onStatusChange('Incoming');
          break;
        case 'remote-stream':
          onRemoteStream();
          break;
        case 'call-end':
          onCallEnd();
          break;
        case 'log':
          console.log('[WebView Log]', data.message);
          break;
        case 'error':
          console.error('[WebView Peer Error]', data.error);
          break;
      }
    } catch (e) {
      console.error('Bridge message error', e);
    }
  };

  const onLoad = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'init', userId }));
  };

  return (
    <View style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}>
      <WebView
        ref={webViewRef}
        source={{ uri: bridgeUrl }}
        onMessage={onMessage}
        onLoad={onLoad}
        originWhitelist={['*']}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onPermissionRequest={(event) => {
          event.grant(event.resources);
        }}
      />
    </View>
  );
});
