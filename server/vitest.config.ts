import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Valid-format dummy keys so Clerk middleware boots during tests
    // (pk decodes to clerk.example.com$; no real auth is exercised).
    env: {
      CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k',
      CLERK_SECRET_KEY: 'sk_test_dummy0000000000000000000000',
    },
  },
});
