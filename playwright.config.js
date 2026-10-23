import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  timeout:process.env.CI?90000:30000,
  fullyParallel:false,
  workers:1,
  use:{baseURL:process.env.CHESS_TEST_URL||'http://127.0.0.1:5173/',headless:true,viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),args:['--enable-unsafe-swiftshader']}},
  webServer:process.env.CHESS_TEST_URL?undefined:{
    command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort',
    url:'http://127.0.0.1:5173/',
    reuseExistingServer:!process.env.CI,
  },
  reporter:'list',
  outputDir:'test-results',
});
