const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.ASOBOON_TEST_PORT || 4173);

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'asoboon-production-browser.spec.js',
  workers: 1,
  timeout: 30_000,
  use: {
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/home.html`,
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
