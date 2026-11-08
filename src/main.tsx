import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { PwaTabsProvider } from '@/src/context/PwaTabsContext';
import { ThemeCustomizerProvider } from '@/src/context/ThemeCustomizerContext';
import { PageTransitionProvider } from '@/src/context/PageTransitionContext';
import { LanguageProvider } from '@/src/context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ThemeCustomizerProvider>
            <PageTransitionProvider>
              <PwaTabsProvider>
                <App />
              </PwaTabsProvider>
            </PageTransitionProvider>
          </ThemeCustomizerProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>
);
