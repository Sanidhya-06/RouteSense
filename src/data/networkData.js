// Fixed sample topology for the Phase 2 network visualization.
export const nodes = [
  { id: 'GW-01', name: 'Gateway', type: 'gateway', x: 90, y: 190 },
  { id: 'ND-01', name: 'Sensor 01', type: 'sensor', x: 220, y: 76 },
  { id: 'ND-02', name: 'Sensor 02', type: 'sensor', x: 220, y: 190 },
  { id: 'ND-03', name: 'Sensor 03', type: 'sensor', x: 220, y: 304 },
  { id: 'RL-01', name: 'Relay 01', type: 'relay', x: 380, y: 126 },
  { id: 'RL-02', name: 'Relay 02', type: 'relay', x: 380, y: 254 },
  { id: 'ND-04', name: 'Sensor 04', type: 'sensor', x: 540, y: 76 },
  { id: 'ND-05', name: 'Sensor 05', type: 'sensor', x: 540, y: 190 },
  { id: 'ND-06', name: 'Sensor 06', type: 'sensor', x: 540, y: 304 },
  { id: 'GW-02', name: 'Gateway 02', type: 'gateway', x: 680, y: 190 },
];

const connections = [
  { source: 'GW-01', target: 'ND-01' },
  { source: 'GW-01', target: 'ND-02' },
  { source: 'GW-01', target: 'ND-03' },
  { source: 'ND-01', target: 'RL-01' },
  { source: 'ND-02', target: 'RL-01' },
  { source: 'ND-02', target: 'RL-02' },
  { source: 'ND-03', target: 'RL-02' },
  { source: 'RL-01', target: 'ND-04' },
  { source: 'RL-01', target: 'ND-05' },
  { source: 'RL-02', target: 'ND-05' },
  { source: 'RL-02', target: 'ND-06' },
  { source: 'ND-04', target: 'GW-02' },
  { source: 'ND-05', target: 'GW-02' },
  { source: 'ND-06', target: 'GW-02' },
];

const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));

// Link cost follows the distance between the existing topology coordinates.
export const links = connections.map((link) => {
  const source = nodeById[link.source];
  const target = nodeById[link.target];
  return {
    ...link,
    weight: Math.hypot(target.x - source.x, target.y - source.y),
  };
});
