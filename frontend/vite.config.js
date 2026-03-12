import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'charts'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/cmdk') || id.includes('node_modules/vaul')) {
            return 'ui-vendor'
          }
          if (id.includes('node_modules/sweetalert2') || id.includes('node_modules/axios') || id.includes('node_modules/framer-motion')) {
            return 'app-vendor'
          }
        },
      },
    },
  },
})
