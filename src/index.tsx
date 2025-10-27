/* @refresh reload */
import 'solid-devtools';
import './index.css';

import { render, Suspense } from 'solid-js/web';

import App from './app';
import { HashRouter } from '@solidjs/router';
import { routes } from './routes';
import { ConfigProvider } from './context/ConfigContext';

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
          <App>{props.children as Element}</App>
        </ConfigProvider>
      )}
    >
      {routes}
    </HashRouter>
  ),
  root as HTMLElement
);
