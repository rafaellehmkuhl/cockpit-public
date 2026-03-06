import vue from '@vitejs/plugin-vue'
import path from 'path'
import { type Plugin, defineConfig } from 'vite'
import electron, { startup, treeKillSync } from 'vite-plugin-electron'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'

import { getVersion } from './src/libs/non-browser-utils'

/**
 * Optimises the @mdi/font CSS for modern Chrome:
 * - Strips eot/woff/ttf fallbacks, keeping only woff2 (~3MB saved)
 * - Adds font-display: block so icons stay invisible while loading instead of flashing as squares
 * @returns {Plugin} Vite plugin
 */
function mdiFontOptimise(): Plugin {
  return {
    name: 'mdi-font-optimise',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@mdi/font/css/materialdesignicons')) return
      return code
        .replace(/src: url\("\.\.\/fonts\/materialdesignicons-webfont\.eot[^"]*"\);/, '')
        .replace(
          /src: url\([^)]+\) format\("embedded-opentype"\),\s*url\(([^)]+)\) format\("woff2"\)[^;]+;/,
          'src: url($1) format("woff2");'
        )
        .replace(/font-style: normal;\n}/, 'font-style: normal;\n  font-display: block;\n}')
    },
  }
}

/**
 * Preloads critical assets (MDI font + splash screen images) by injecting link tags
 * into index.html, so the browser starts downloading them immediately rather than
 * waiting for the JS -> CSS/component discovery waterfall.
 * @returns {Plugin} Vite plugin
 */
function preloadCriticalAssets(): Plugin {
  const splashImageNames = ['splash-background', 'cockpit-name-logo']

  return {
    name: 'preload-critical-assets',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return []

        const bundleKeys = Object.keys(ctx.bundle)
        const tags: {
          /**
           *
           */
          tag: string
          /**
           *
           */
          attrs: Record<string, string>
          /**
           *
           */
          injectTo: 'head-prepend'
        }[] = []

        const fontAsset = bundleKeys.find(
          (key) => key.includes('materialdesignicons-webfont') && key.endsWith('.woff2')
        )
        if (fontAsset) {
          tags.push({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${fontAsset}`, crossorigin: 'anonymous' },
            injectTo: 'head-prepend',
          })
        }

        for (const name of splashImageNames) {
          const imageAsset = bundleKeys.find((key) => key.includes(name) && /\.(png|jpg|webp)$/.test(key))
          if (imageAsset) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'preload', as: 'image', href: `/${imageAsset}` },
              injectTo: 'head-prepend',
            })
          }
        }

        return tags
      },
    },
  }
}

// Check if we're running in Electron mode or building the application
const isElectron = process.env.ELECTRON === 'true'
const isBuilding = process.argv.includes('build')
const isLibrary = process.env.BUILD_MODE === 'library'

// Base configuration that will be merged
const baseConfig = {
  plugins: [
    (isElectron || isBuilding) &&
      electron([
        {
          entry: 'src/electron/main.ts',
          vite: {
            build: {
              outDir: 'dist/electron',
            },
          },
          onstart: () => {
            // @ts-ignore: process.electronApp exists in vite-plugin-electron but not in the types
            if (process.electronApp) {
              // @ts-ignore: process.electronApp.pid exists in vite-plugin-electron but not in the types
              treeKillSync(process.electronApp.pid)
            }
            startup()
          },
        },
        {
          entry: 'src/electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist/electron',
            },
          },
        },
      ]),
    vue(),
    mdiFontOptimise(),
    preloadCriticalAssets(),
    vuetify({
      autoImport: true,
    }),
    // Only include PWA plugin when NOT building the library
    !isLibrary &&
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      }),
  ].filter(Boolean),
  define: {
    'process.env': {},
    '__APP_VERSION__': JSON.stringify(getVersion().version),
    '__APP_VERSION_DATE__': JSON.stringify(getVersion().date),
    '__APP_VERSION_LINK__': JSON.stringify(getVersion().link),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  server: {
    host: '0.0.0.0',
  },
}

// Library-specific configuration
const libraryConfig = {
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/libs/external-api/api.ts'),
      name: 'CockpitAPI',
      formats: ['es', 'umd', 'iife'],
      fileName: (format: string) => {
        switch (format) {
          case 'iife':
            return 'cockpit-external-api.browser.js'
          default:
            return `cockpit-external-api.${format}.js`
        }
      },
    },
    rollupOptions: {
      external: ['vue', 'vuetify'],
      output: {
        globals: {
          vue: 'Vue',
          vuetify: 'Vuetify',
        },
      },
    },
    outDir: 'dist/lib',
    // Add copyPublicDir: false to prevent copying public assets
    copyPublicDir: false,
  },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default defineConfig((_configEnv) => {
  if (isLibrary) {
    // For library builds, merge the base config with library-specific settings
    return {
      ...baseConfig,
      ...libraryConfig,
    } as any
  }
  return baseConfig as any
})
