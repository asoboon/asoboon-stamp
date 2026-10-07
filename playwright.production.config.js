const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'asoboon-production-browser.spec.js',
  workers: 1,
  timeout: 30_000,
  use: {
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/home.html',
    reuseExistingServer: true,
    timeout: 15_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
