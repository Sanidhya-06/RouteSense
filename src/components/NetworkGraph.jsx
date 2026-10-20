import { links, nodes } from '../data/networkData.js';

const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));

function NetworkGraph({ route, graphLinks = links, large = false }) {
  const nodeNamesByType = {
    gateway: { fill: 'var(--graph-gateway)', halo: 'var(--graph-gateway-halo)' },
    relay: { fill: 'var(--graph-relay)', halo: 'var(--graph-relay-halo)' },
    sensor: { fill: 'var(--graph-sensor)', halo: 'var(--graph-sensor-halo)' },
  };
  const routeNodes = new Set(route?.path ?? []);
  const routeLinks = new Set(
    (route?.path ?? []).slice(1).map((nodeId, index) => {
      const pair = [route.path[index], nodeId].sort();
      return pair.join(':');
    }),
  );
  return (
    <svg
      className={`network-map${large ? ' network-map-large' : ''}`}
      viewBox="0 0 760 380"
      role="img"
      aria-labelledby="network-map-title network-map-description"
      preserveAspectRatio="xMidYMid meet"
    >
      <title id="network-map-title">RouteSense IoT network topology</title>
      <desc id="network-map-description">
        {route ? `Selected route from ${nodeById[route.path[0]]?.name} to ${nodeById[route.path.at(-1)]?.name} uses ${route.path.length} devices.` : ''} A network of {nodes.length} devices connected by {links.length} connections. The highlighted green line shows the selected route.
      </desc>
      <g aria-hidden="true">
        {graphLinks.map(({ source, target }) => {
          const start = nodeById[source];
          const end = nodeById[target];
          if (!start || !end) return null;

          return (
            <line
              key={`${source}-${target}`}
              className={`network-link${routeLinks.has([source, target].sort().join(':')) ? ' network-link-active' : ''}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
            />
          );
        })}
      </g>
      {nodes.map((node) => (
        <g
          className={`network-node${routeNodes.has(node.id) ? ' network-node-active' : ''}`}
          key={node.id}
          transform={`translate(${node.x} ${node.y})`}
          aria-label={`${node.name}, ${node.id}`}
        >
          <circle className={`node-halo node-halo-${node.type}`} fill={nodeNamesByType[node.type]?.halo} r="27" />
          <circle className={`node-core node-core-${node.type}`} fill={nodeNamesByType[node.type]?.fill} r="19" />
          <text className="node-id" textAnchor="middle" y="4">
            {node.id}
          </text>
          <text className="node-label" textAnchor="middle" y="46">
            {node.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default NetworkGraph;
