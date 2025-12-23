import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'
  const isAnalyze = process.env.ANALYZE === 'true'

  return {
    // 应用基础路径（用于部署到子路径）
    base: env.VITE_BASE_PATH || '/',

    plugins: [
      react(),
      isAnalyze && visualizer({ open: true, filename: 'bundle-analysis.html' }),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace(/%VITE_APP_NAME%/g, env.VITE_APP_NAME)
        },
      },
    ],
    resolve: {
      alias: {
        // 只需要保留这一行，其他的 react-dom 相关的全部删掉
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        // 支持自定义 API 前缀（从环境变量读取，默认 /api）
        [env.VITE_API_ROUTE_PREFIX || '/api']: {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    build: {
      // 生产环境优化 - 改用 esbuild (更安全且更快)
      minify: 'esbuild',

      // 代码分割优化 - 简化策略以避免依赖循环
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // 将所有第三方依赖打包到一个 vendor chunk 中
            // 这种方式最稳定，避免了复杂拆分导致的加载顺序问题
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          // 输出文件命名
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },

      // 优化配置
      reportCompressedSize: false, // 关闭压缩大小报告以加快构建
      chunkSizeWarningLimit: 2000,
      sourcemap: !isProd,

      // CSS 代码分割
      cssCodeSplit: true,

      // 构建目标
      target: 'es2015',

      // 优化依赖预构建
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },

    // 优化依赖预构建
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'mobx',
        'mobx-react',
        'axios',
        'amis',
        'amis-ui',
        'amis-formula',
      ],
    },

    // esbuild 配置
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
    },
  }
})