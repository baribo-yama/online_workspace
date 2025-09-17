import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // 環境変数のデフォルト値を設定
    'import.meta.env.VITE_WEBSOCKET_URL': JSON.stringify(process.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080')
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase関連を分離
          'firebase': ['firebase/app', 'firebase/firestore'],
          // LiveKit関連を分離
          'livekit': ['livekit-client', '@livekit/components-react', '@livekit/components-styles'],
          // React関連を分離
          'react': ['react', 'react-dom'],
          'react-router': ['react-router-dom'],
          // UI関連を分離
          'ui': ['lucide-react'],
          // その他のユーティリティ
          'utils': ['jose', 'ws']
        }
      }
    },
    // チャンクサイズ警告の閾値を調整
    chunkSizeWarningLimit: 1000
  },
  // 開発時の最適化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/firestore',
      'livekit-client',
      '@livekit/components-react',
      'lucide-react'
    ]
  }
})
