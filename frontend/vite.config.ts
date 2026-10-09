import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // The current Rolldown optimizer drops the React mount and application routes.
  // Preserve them until the optimizer can be enabled with the bundle check passing.
  build: { rolldownOptions: { treeshake: false } },
  plugins: [
    react(),
    tailwindcss(),
  ],
});
