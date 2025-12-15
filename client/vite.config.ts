import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'
  const isAnalyze = process.env.ANALYZE === 'true'

  return {
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
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    build: {
      // 生产环境优化
      minify: 'terser', // 使用 terser 压缩（比 esbuild 压缩率更高）
      terserOptions: {
        compress: {
          drop_console: isProd, // 生产环境移除 console
          drop_debugger: isProd, // 移除 debugger
          pure_funcs: isProd ? ['console.log', 'console.debug'] : [], // 移除特定函数调用
        },
      },

      // 代码分割优化（增强版）
      rollupOptions: {
        output: {
          // 更细粒度的 chunk 分割
          manualChunks: (id) => {
            // AMIS 相关库（最大的依赖，细分）
            if (id.includes('node_modules/amis')) {
              if (id.includes('amis-ui')) return 'amis-ui';
              if (id.includes('amis-formula')) return 'amis-formula';
              if (id.includes('amis-core')) return 'amis-core';
              return 'amis';
            }

            // React 生态
            if (id.includes('node_modules/react')) {
              if (id.includes('react-dom')) return 'react-dom';
              if (id.includes('react-router')) return 'react-router';
              return 'react';
            }

            // MobX 状态管理
            if (id.includes('node_modules/mobx')) {
              return 'mobx';
            }

            // Axios 及其他网络库
            if (id.includes('node_modules/axios')) {
              return 'axios';
            }

            // ECharts（大库，独立出来）
            if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
              return 'echarts';
            }

            // Lodash（如果使用）
            if (id.includes('node_modules/lodash')) {
              return 'lodash';
            }

            // Moment/dayjs 等日期库
            if (id.includes('node_modules/moment') || id.includes('node_modules/dayjs')) {
              return 'date-lib';
            }

            // 其他第三方库
            if (id.includes('node_modules')) {
              // 将剩余的node_modules按照包名再细分
              const match = id.match(/node_modules\/([^\/]+)/);
              if (match) {
                const packageName = match[1];
                // 大于500KB的库单独打包
                if (packageName.startsWith('@') || packageName.length > 5) {
                  return 'vendor';
                }
              }
              return 'vendor';
            }
          },

          // 输出文件命名（带 hash，利于缓存）
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },

      // 优化配置
      reportCompressedSize: true, // 显示压缩后大小
      chunkSizeWarningLimit: 2000, // chunk 大小警告阈值提升到2MB（AMIS是大型库）
      sourcemap: !isProd, // 仅开发环境生成 sourcemap

      // CSS 代码分割
      cssCodeSplit: true,

      // 构建目标（支持现代浏览器）
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
        'mobx-react-lite',
        'axios',
        'amis',
        'amis-ui',
        'amis-formula',
      ],
    },

    // 性能优化
    esbuild: {
      // 生产环境移除 console 和 debugger
      drop: isProd ? ['console', 'debugger'] : [],
      // 压缩标识符
      minifyIdentifiers: isProd,
      minifySyntax: isProd,
      minifyWhitespace: isProd,
    },
  }
})