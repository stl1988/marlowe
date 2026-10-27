import { createRoot } from 'react-dom/client';

// Import polyfills first
import './lib/polyfills.ts';

// Import i18n configuration
import './lib/i18n';

import App from './App.tsx';
import { registerServiceWorker } from './lib/registerSW';
import './index.css';

// Using Inter Variable font for modern, clean typography
import '@fontsource-variable/inter';

// Prism token colors are defined in index.css (scoped .code-highlight /
// .code-highlight-dark palettes), so no prismjs theme CSS is needed here.

createRoot(document.getElementById("root")!).render(<App />);

// Static registration works in both Vite and Marlowe's browser/esbuild builds.
void registerServiceWorker();