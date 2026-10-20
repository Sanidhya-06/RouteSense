import { useEffect, useState } from 'react';
import NetworkGraph from './components/NetworkGraph.jsx';
import { links, nodes } from './data/networkData.js';
import { dijkstra } from './utils/dijkstra.js';

const DEFAULT_LATENCY_MS = 10;
const DEFAULT_CONGESTION_PERCENT = 10;
const DEFAULT_BATTERY_PERCENT = 100;
const LOW_BATTERY_THRESHOLD = 30;
const LOW_BATTERY_PENALTY = 50;
const linkKey = (source, target) => [source, target].sort().join(':');
const nodeNames = Object.fromEntries(nodes.map(({ id, name }) => [id, name]));

function createDefaultConditions() {
  return {
    links: Object.fromEntries(links.map((link) => [linkKey(link.source, link.target), { latency: DEFAULT_LATENCY_MS, congestion: DEFAULT_CONGESTION_PERCENT }])),
    batteries: Object.fromEntries(nodes.map((node) => [node.id, DEFAULT_BATTERY_PERCENT])),
  };
}

// Each edge cost is delay × (1 + traffic% / 100), plus 50 for forwarding
// through an intermediate device with battery below 30%.
function getWeightedLinks(conditions, destinationId) {
  return links.flatMap(({ source, target }) => {
    const { latency, congestion } = conditions.links[linkKey(source, target)];
    const baseCost = latency * (1 + congestion / 100);
    const direction = (from, to) => ({ source: from, target: to, directed: true, weight: baseCost + (to !== destinationId && conditions.batteries[to] < LOW_BATTERY_THRESHOLD ? LOW_BATTERY_PENALTY : 0) });
    return [direction(source, target), direction(target, source)];
  });
}

function getRouteDetails(path, conditions, destinationId) {
  const edges = path.slice(1).map((to, index) => {
    const from = path[index];
    const { latency, congestion } = conditions.links[linkKey(from, to)];
    const baseCost = latency * (1 + congestion / 100);
    const batteryPenalty = to !== destinationId && conditions.batteries[to] < LOW_BATTERY_THRESHOLD ? LOW_BATTERY_PENALTY : 0;
    return { from, to, latency, congestion, baseCost, batteryPenalty, cost: baseCost + batteryPenalty };
  });
  return { edges, latency: edges.reduce((sum, edge) => sum + edge.latency, 0), cost: edges.reduce((sum, edge) => sum + edge.cost, 0) };
}

function getBand(value, moderateAt, highAt) {
  if (value < moderateAt) return { label: 'Good', tone: 'good' };
  if (value <= highAt) return { label: 'Moderate', tone: 'moderate' };
  return { label: 'High', tone: 'high' };
}

function getBatteryStatus(value) {
  if (value < 15) return { label: 'Critical', tone: 'critical' };
  if (value < LOW_BATTERY_THRESHOLD) return { label: 'Low', tone: 'low' };
  return { label: 'Good', tone: 'good' };
}

function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('routesense-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [screen, setScreen] = useState('configure');
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [route, setRoute] = useState(null);
  const [previousRoute, setPreviousRoute] = useState(null);
  const [conditions, setConditions] = useState(createDefaultConditions);
  const [message, setMessage] = useState('Choose a starting device and destination to begin.');
  const [selectedLinkKey, setSelectedLinkKey] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const selectedLink = links.find((link) => linkKey(link.source, link.target) === selectedLinkKey);

  function calculateRoute() {
    if (!nodes.some((node) => node.id === sourceId) || !nodes.some((node) => node.id === destinationId)) {
      setRoute(null);
      setMessage('Choose a valid starting device and destination.');
      return false;
    }
    const result = dijkstra({ nodes, edges: getWeightedLinks(conditions, destinationId) }, sourceId, destinationId);
    if (!result) {
      setRoute(null);
      setPreviousRoute(null);
      setMessage('No available connection can reach that destination. Choose another destination.');
      return false;
    }
    const detail = getRouteDetails(result.path, conditions, destinationId);
    const nextRoute = { ...result, ...detail, sourceId, destinationId, conditions };
    setPreviousRoute(route && route.sourceId === sourceId && route.destinationId === destinationId && route.path.join('|') !== nextRoute.path.join('|') ? route : null);
    setRoute(nextRoute);
    setMessage('');
    setScreen('results');
    return true;
  }

  function updateLink(field, value) {
    if (value === '') return;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || (field === 'congestion' && number > 100)) return;
    setConditions((current) => ({ ...current, links: { ...current.links, [selectedLinkKey]: { ...current.links[selectedLinkKey], [field]: number } } }));
  }

  function updateBattery(value) {
    if (!selectedNodeId || value === '') return;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 100) return;
    setConditions((current) => ({ ...current, batteries: { ...current.batteries, [selectedNodeId]: number } }));
  }

  function resetConditions() {
    setConditions(createDefaultConditions());
    setRoute(null);
    setPreviousRoute(null);
    setMessage('Network conditions restored. Calculate a route to see the result.');
  }

  const routePathText = route?.path.map((id) => nodeNames[id]).join(' → ');
  const routeChanged = Boolean(previousRoute && route && previousRoute.path.join('|') !== route.path.join('|'));
  const previousRouteCurrentCost = previousRoute && route ? getRouteDetails(previousRoute.path, route.conditions, previousRoute.destinationId).cost : null;
  const costChange = routeChanged ? route.cost - previousRouteCurrentCost : 0;
  const costComparisonText = Math.abs(costChange) < 0.05
    ? 'The new and previous paths have the same calculated cost under current conditions; Dijkstra selected the new path as an equally low-cost option.'
    : `Under current conditions, the new route costs ${Math.abs(costChange).toFixed(1)} points ${costChange < 0 ? 'less' : 'more'} than the previous route would cost. ${costChange < 0 ? 'That lower calculated cost is why Dijkstra selected it.' : 'Although its cost is higher than the previous path, it is the lowest-cost available route for the selected endpoints.'}`;
  const selectedLinkCondition = selectedLink ? conditions.links[selectedLinkKey] : null;
  const selectedBattery = selectedNodeId ? conditions.batteries[selectedNodeId] : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('routesense-theme', theme);
    } catch {
      // The current session theme still works when storage is unavailable.
    }
  }, [theme]);

  return <div className="app-shell" data-theme={theme}>
    <header className="topbar app-topbar">
      <a className="brand" href="#configure" aria-label="RouteSense home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 23.5 14.5 8l5 10 5-6 2.5 11.5" /><circle cx="7" cy="23.5" r="2" /><circle cx="14.5" cy="8" r="2" /><circle cx="19.5" cy="18" r="2" /><circle cx="24.5" cy="12" r="2" /></svg></span><span>Route<span className="brand-accent">Sense</span></span></a>
      <nav className="screen-nav" aria-label="Routing screens">
        <button className={`nav-item${screen === 'configure' ? ' nav-item-active' : ''}`} aria-current={screen === 'configure' ? 'page' : undefined} onClick={() => setScreen('configure')}>Configure Network</button>
        <button className={`nav-item${screen === 'results' ? ' nav-item-active' : ''}`} aria-current={screen === 'results' ? 'page' : undefined} onClick={() => setScreen('results')} disabled={!route}>Results</button>
      </nav>
      <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-pressed={theme === 'dark'} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}>
        {theme === 'light' ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>}
        <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
      </button>
    </header>

    <main className="main-content">
      <header className="context-bar"><div className="breadcrumb">RouteSense <span>/</span> <strong>{screen === 'configure' ? 'Configure Network' : 'Results'}</strong></div><div className="topbar-status"><span /> Local simulation</div></header>
      <div className="page-content">
        <section className="page-heading"><div><div className="eyebrow">{screen === 'configure' ? 'STEP 1 · CONFIGURE' : 'STEP 2 · RESULTS'}</div><h1>{screen === 'configure' ? 'Configure your network' : 'Your route results'}</h1><p>{screen === 'configure' ? 'Choose endpoints and set the conditions data should travel through.' : 'Review the calculated path and the conditions that influenced it.'}</p></div></section>

        {screen === 'configure' ? <>
          <section className="configure-grid">
            <article className="panel endpoint-panel">
              <div className="panel-header"><div><h2>Choose a route</h2><p>Pick the device where data starts and where it should arrive.</p></div></div>
              <div className="endpoint-fields">
                <div className="form-field"><label htmlFor="source-node">Starting device</label><select id="source-node" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select a starting device</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.id})</option>)}</select></div>
                <div className="endpoint-arrow" aria-hidden="true">→</div>
                <div className="form-field"><label htmlFor="destination-node">Destination device</label><select id="destination-node" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Select a destination</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.id})</option>)}</select></div>
              </div>
              <button className="primary-button" type="button" disabled={!sourceId || !destinationId} onClick={calculateRoute}>Calculate route <span aria-hidden="true">→</span></button>
              {message && <p className="form-message" role="status">{message}</p>}
            </article>
            <article className="panel condition-panel">
              <div className="panel-header"><div><h2>Network conditions</h2><p>Change a connection or a device. Updates are saved until you recalculate.</p></div><button className="text-button" type="button" onClick={resetConditions}>Reset defaults</button></div>
              <div className="condition-pickers">
                <div className="form-field"><label htmlFor="connection-select">Connection</label><select id="connection-select" value={selectedLinkKey} onChange={(event) => setSelectedLinkKey(event.target.value)}><option value="">Choose a connection</option>{links.map((link) => { const key = linkKey(link.source, link.target); return <option key={key} value={key}>{nodeNames[link.source]} ↔ {nodeNames[link.target]}</option>; })}</select></div>
                {selectedLink && selectedLinkCondition && <div className="selected-editors"><label><span><strong>Network Delay</strong><small>Time for data to cross this connection (ms)</small></span><input aria-label="Network delay in milliseconds" type="number" min="0" step="1" value={selectedLinkCondition.latency} onChange={(event) => updateLink('latency', event.target.value)} /><em>ms</em><i className={`condition-status tone-${getBand(selectedLinkCondition.latency, 20, 50).tone}`}><b />{getBand(selectedLinkCondition.latency, 20, 50).label}</i></label><label><span><strong>Network Traffic</strong><small>How busy this connection is (percent)</small></span><input aria-label="Network traffic percentage" type="number" min="0" max="100" step="1" value={selectedLinkCondition.congestion} onChange={(event) => updateLink('congestion', event.target.value)} /><em>%</em><i className={`condition-status tone-${getBand(selectedLinkCondition.congestion, 30, 60).tone}`}><b />{getBand(selectedLinkCondition.congestion, 30, 60).label}</i></label></div>}
                <div className="form-field"><label htmlFor="device-select">Device battery</label><select id="device-select" value={selectedNodeId} onChange={(event) => setSelectedNodeId(event.target.value)}><option value="">Choose a device</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.id})</option>)}</select></div>
                {selectedNodeId && <div className="selected-editors battery-edit"><label><span><strong>{nodeNames[selectedNodeId]} battery</strong><small>Low battery can make a device less suitable for forwarding data.</small></span><input aria-label="Device battery percentage" type="number" min="0" max="100" step="1" value={selectedBattery} onChange={(event) => updateBattery(event.target.value)} /><em>%</em><i className={`condition-status tone-${getBatteryStatus(selectedBattery).tone}`}><b />{getBatteryStatus(selectedBattery).label}</i></label><p>Below 30%, this device adds a 50 point cost penalty when it forwards data.</p></div>}
              </div>
              <div className="metric-key"><span><i className="tone-good" />Good</span><span><i className="tone-moderate" />Moderate</span><span><i className="tone-high" />High</span><small>Delay: Good &lt;20 ms, Moderate 20–50 ms, High &gt;50 ms. Traffic: Good &lt;30%, Moderate 30–60%, High &gt;60%.</small></div>
            </article>
          </section>
          <article className="panel configure-map panel-spaced"><div className="panel-header"><div><h2>Network topology</h2><p>All available devices and connections</p></div><span className="online-badge"><span /> {nodes.length} devices</span></div><MapLegend /><div className="map-container"><NetworkGraph route={route} graphLinks={links} /></div></article>
        </> : <>
          {!route ? <article className="panel empty-results"><h2>No route calculated yet</h2><p>Choose a starting device and destination, then calculate a route to see results here.</p><button className="primary-button" onClick={() => setScreen('configure')}>Configure network</button></article> : <>
            <article className="panel results-map"><div className="panel-header"><div><h2>Selected route</h2><p>{nodeNames[route.sourceId]} to {nodeNames[route.destinationId]}</p></div><button className="secondary-button" onClick={() => setScreen('configure')}>Adjust conditions</button></div><MapLegend /><div className="map-container results-map-container"><NetworkGraph route={route} graphLinks={links} large /></div></article>
            <section className="results-grid"><article className="panel route-detail"><div className="eyebrow">ROUTE SEQUENCE</div><h2>{routePathText}</h2><div className="result-stats"><div><strong>{route.cost.toFixed(1)}</strong><span>Total route cost</span></div><div><strong>{route.latency.toFixed(1)} ms</strong><span>Estimated delay</span></div><div><strong>{route.path.length - 1}</strong><span>Hops</span></div></div><div className="why-route"><h3>Why this route?</h3><p>This route has the lowest combined cost found across available paths. Its {route.edges.length} connection{route.edges.length === 1 ? '' : 's'} add up to {route.cost.toFixed(1)} cost points: {route.edges.map((edge) => `${nodeNames[edge.from]}–${nodeNames[edge.to]} ${edge.cost.toFixed(1)}`).join(', ')}. Cost uses delay adjusted for traffic, plus a penalty for forwarding through a device below 30% battery.</p></div></article>
              {routeChanged && <article className="panel route-change"><div className="eyebrow">ROUTE CHANGED</div><h2>Conditions changed the best path</h2><div className="comparison"><div><small>Previous route · original conditions</small><p>{previousRoute.path.map((id) => nodeNames[id]).join(' → ')}</p><strong>{previousRoute.cost.toFixed(1)} cost · {previousRoute.latency.toFixed(1)} ms</strong></div><div><small>Previous route · current conditions</small><p>{previousRoute.path.map((id) => nodeNames[id]).join(' → ')}</p><strong>{previousRouteCurrentCost.toFixed(1)} cost</strong></div><div><small>New route · current conditions</small><p>{routePathText}</p><strong>{route.cost.toFixed(1)} cost · {route.latency.toFixed(1)} ms</strong></div></div><p className="comparison-note">{costComparisonText}</p></article>}
            </section>
            <div className="result-actions"><button className="secondary-button" onClick={() => setScreen('configure')}>Adjust conditions</button><button className="primary-button" onClick={calculateRoute}>Recalculate route</button></div>
          </>}
          {message && <p className="form-message" role="status">{message}</p>}
        </>}
        <footer className="page-footer"><span>RouteSense <span className="footer-separator">·</span> IoT network simulation</span><span>Local environment <i /></span></footer>
      </div>
    </main>
  </div>;
}

function MapLegend() {
  return <div className="map-legend" aria-label="Network map legend"><span><i className="legend-dot legend-gateway" />Gateway</span><span><i className="legend-dot legend-relay" />Relay</span><span><i className="legend-dot legend-sensor" />Sensor</span><span><i className="legend-line" />Connection</span><span><i className="legend-line legend-line-route" />Selected route</span></div>;
}

export default App;
