import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { theme } from './theme';
import { AppRouter } from './router';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light" defaultColorScheme="light">
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </MantineProvider>
  </React.StrictMode>
);
