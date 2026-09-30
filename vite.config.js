import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Matches the default Supabase Auth Site URL, so email confirmation / reset links work.
  server: { port: 3000, strictPort: true },
})
