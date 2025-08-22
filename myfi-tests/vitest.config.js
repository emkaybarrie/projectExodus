import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts']
  },
  resolve: {
    alias: {
      // Example: point to your app’s vitals logic if you want to import it directly.
      // Update this path to your actual file.
      '@vitals': '../web/js/vitals_v10.js'
    }
  }
});
