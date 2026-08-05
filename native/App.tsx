import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { handleNativeRequest } from './src/bridge';
import type { NativeResponse } from './src/bridgeTypes';

const APP_URL = 'https://freecal.vercel.app';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const respond = (response: NativeResponse) => {
    webViewRef.current?.injectJavaScript(
      `window.__freeCalNativeResponse(${JSON.stringify(response)});true;`
    );
  };

  const onMessage = (event: WebViewMessageEvent) => {
    void handleNativeRequest(event.nativeEvent.data, respond);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        onMessage={onMessage}
        onLoadStart={() => {
          setLoading(true);
          setLoadError(null);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={(event) => {
          setLoading(false);
          setLoadError(event.nativeEvent.description);
        }}
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        style={styles.webview}
      />
      {loading && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}
      {loadError && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>Failed to load FreeCal.</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 24,
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorDetail: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
});
