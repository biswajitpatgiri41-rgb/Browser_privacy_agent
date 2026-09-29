
import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

function manifestPlugin() {
  return {
    name: 'manifest',
    writeBundle() {
      const manifestPath = resolve(__dirname, 'manifest.chrome.json');
      const distDir = resolve(__dirname, 'dist');
      const distManifestPath = resolve(distDir, 'manifest.json');

      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        
        // Update paths to reference built files
        manifest.action.default_popup = 'src/popup/popup.html';
        manifest.background.service_worker = 'background.js';
        manifest.background.type = 'module';
        
        // Add content_scripts if content.js exists
        manifest.content_scripts = [
          {
            matches: ['<all_urls>'],
            js: ['content.js'],
            run_at: 'document_idle',
            all_frames: false,
          },
        ];
        
        // Remove icons since they don't exist
        delete manifest.icons;

        // Ensure dist directory exists
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true });
        }

        writeFileSync(distManifestPath, JSON.stringify(manifest, null, '\t'));
        console.log('Manifest written to dist/manifest.json');
      }
    },
  };
}

export default defineConfig({
  plugins: [manifestPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        background: 'src/background/service-worker.ts',
        content: 'src/content/content-script.ts',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
