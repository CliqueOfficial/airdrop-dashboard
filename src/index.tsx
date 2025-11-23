/* @refresh reload */
import 'solid-devtools';
import './index.css';

import { render, Suspense } from 'solid-js/web';

import App from './app';
import { HashRouter } from '@solidjs/router';
import { routes } from './routes';
import { ConfigProvider } from './hooks/context/ConfigContext';
import { ClientContextProvider } from './hooks/context/ClientContext';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?'
  );
}

render(
  () => (
    <HashRouter
      root={(props) => (
        <ConfigProvider>
          <ClientContextProvider>
            <App>{props.children as Element}</App>
          </ClientContextProvider>
        </ConfigProvider>
      )}
    >
      {routes}
    </HashRouter>
  ),
  root as HTMLElement
);
