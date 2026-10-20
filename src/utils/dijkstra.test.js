import test from 'node:test';
import assert from 'node:assert/strict';
import { dijkstra } from './dijkstra.js';

test('returns the ordered path and cost for a normal route', () => {
  const graph = {
    nodes: ['A', 'B', 'C'],
    edges: [
      { source: 'A', target: 'B', weight: 2 },
      { source: 'B', target: 'C', weight: 3 },
    ],
  };

  assert.deepEqual(dijkstra(graph, 'A', 'C'), { path: ['A', 'B', 'C'], cost: 5 });
});

test('chooses the lower-cost option among alternative paths', () => {
  const graph = {
    nodes: ['A', 'B', 'C', 'D'],
    edges: [
      { source: 'A', target: 'B', weight: 2 },
      { source: 'B', target: 'D', weight: 8 },
      { source: 'A', target: 'C', weight: 3 },
      { source: 'C', target: 'D', weight: 1 },
    ],
  };

  assert.deepEqual(dijkstra(graph, 'A', 'D'), { path: ['A', 'C', 'D'], cost: 4 });
});

test('returns null when the destination is unreachable', () => {
  const graph = {
    nodes: ['A', 'B', 'C'],
    edges: [{ source: 'A', target: 'B', weight: 1 }],
  };

  assert.equal(dijkstra(graph, 'A', 'C'), null);
});

test('returns null for an invalid endpoint and does not mutate the graph', () => {
  const graph = {
    nodes: ['A', 'B'],
    edges: [{ source: 'A', target: 'B', weight: 4 }],
  };
  const original = structuredClone(graph);

  assert.equal(dijkstra(graph, 'missing', 'B'), null);
  assert.deepEqual(graph, original);
});

test('respects directed edges for destination-aware routing costs', () => {
  const graph = {
    nodes: ['A', 'B', 'C'],
    edges: [
      { source: 'A', target: 'B', weight: 2, directed: true },
      { source: 'C', target: 'B', weight: 1, directed: true },
    ],
  };

  assert.deepEqual(dijkstra(graph, 'A', 'B'), { path: ['A', 'B'], cost: 2 });
  assert.equal(dijkstra(graph, 'B', 'A'), null);
});
