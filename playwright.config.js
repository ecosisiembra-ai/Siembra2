// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/report', open: 'never' }],
  ],

  use: {
    // Servidor local — levantado automáticamente por webServer abajo
    baseURL: 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'on-first-retry',
    // Simular dispositivo móvil para los tests de padres/alumno
    viewport: { width: 390, height: 844 },
  },

  // Proyectos: desktop (Chrome) + móvil (Safari iOS)
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Levantar servidor estático local antes de los tests
  webServer: {
    command: 'npx serve . -p 3001',
    url:     'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
