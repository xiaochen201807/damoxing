import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 只需要保留这一行，其他的 react-dom 相关的全部删掉
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // AMIS 相关库单独打包
          'amis-vendor': ['amis', 'amis-ui', 'amis-formula'],
          // React 相关库单独打包
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // MobX 相关库单独打包
          'mobx-vendor': ['mobx', 'mobx-react', 'mobx-react-lite'],
        },
      },
    },
    // 启用 gzip 压缩提示
    reportCompressedSize: true,
    // chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
  },
})