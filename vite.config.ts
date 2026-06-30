import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/simple-kanban/',
  build: {
    outDir: '/users/tom/oestler/client/dist/simple-kanban',
    emptyOutDir: true,
  },
})
