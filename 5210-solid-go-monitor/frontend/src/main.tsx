import { render } from 'solid-js/web';
import { Router, Routes, Route, A } from '@solidjs/router';
import './styles.css';
import { createSignal, createResource, onMount, onCleanup } from 'solid-js';

import Dashboard from './pages/Dashboard';
import Probes from './pages/Probes';
import ProbeDetail from './pages/ProbeDetail';
import Alerts from './pages/Alerts';
import Events from './pages/Events';
import { api } from './api';
import type { Overview } from './types';

function Nav() {
  const [overview, setOverview] = createSignal<Overview | null>(null);

  const load = async () => {
    try {
      const data = await api.getOverview();
      setOverview(data);
    } catch (e) {}
  };

  let timer: number;
  onMount(() => {
    load();
    timer = window.setInterval(load, 5000);
  });
  onCleanup(() => clearInterval(timer));

  return (
    <nav class="nav">
      <div class="nav-brand">
        <span class="logo">📊</span>
        <span>监控面板</span>
      </div>
      <div class="nav-links">
        <A href="/" end class="nav-link">总览</A>
        <A href="/probes" class="nav-link">探针</A>
        <A href="/alerts" class="nav-link">
          告警
          {overview()?.alerts ? (
            <span class="badge alert-badge">{overview()?.alerts}</span>
          ) : null}
        </A>
        <A href="/events" class="nav-link">事件</A>
      </div>
      <div class="nav-stats">
        <span class="stat up">● {overview()?.up ?? 0}</span>
        <span class="stat down">● {overview()?.down ?? 0}</span>
        <span class="stat disabled">● {overview()?.disabled ?? 0}</span>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div class="app">
        <Nav />
        <main class="main">
          <Routes>
            <Route path="/" component={Dashboard} />
            <Route path="/probes" component={Probes} />
            <Route path="/probes/:id" component={ProbeDetail} />
            <Route path="/alerts" component={Alerts} />
            <Route path="/events" component={Events} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

render(() => <App />, document.getElementById('root')!);
