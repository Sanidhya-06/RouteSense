/**
 * Find the minimum-cost path in a graph with non-negative weights.
 *
 * Graph shape:
 *   { nodes: ['A', 'B'] } or { nodes: [{ id: 'A' }, { id: 'B' }],
 *     edges: [{ source: 'A', target: 'B', weight: 3 }] }
 * Edges are undirected by default. Set `directed: true` for one-way costs.
 * Edges may also use `from` and `to` in place of `source` and `target`.
 *
 * @returns {{ path: string[], cost: number } | null}
 *          `null` when an endpoint is invalid or the destination is unreachable.
 */
export function dijkstra(graph, sourceId, destinationId) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return null;
  }

  const nodeIds = graph.nodes.map((node) =>
    typeof node === 'object' && node !== null ? node.id : node,
  );
  const knownNodes = new Set(nodeIds);

  if (!knownNodes.has(sourceId) || !knownNodes.has(destinationId)) {
    return null;
  }

  const adjacency = new Map(nodeIds.map((id) => [id, []]));

  for (const edge of graph.edges) {
    if (!edge || typeof edge !== 'object') continue;

    const from = edge.source ?? edge.from;
    const to = edge.target ?? edge.to;
    const weight = edge.weight;

    // Ignore malformed edges and weights that Dijkstra cannot support.
    if (
      !knownNodes.has(from) ||
      !knownNodes.has(to) ||
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      continue;
    }

    adjacency.get(from).push({ node: to, weight });
    if (edge.directed !== true) adjacency.get(to).push({ node: from, weight });
  }

  const distances = new Map(nodeIds.map((id) => [id, Infinity]));
  const previous = new Map();
  const unvisited = new Set(nodeIds);
  distances.set(sourceId, 0);

  while (unvisited.size > 0) {
    let current = null;
    let currentDistance = Infinity;

    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId);
      if (distance < currentDistance) {
        current = nodeId;
        currentDistance = distance;
      }
    }

    if (current === null || currentDistance === Infinity) break;
    if (current === destinationId) break;

    unvisited.delete(current);

    for (const neighbor of adjacency.get(current)) {
      if (!unvisited.has(neighbor.node)) continue;

      const candidateDistance = currentDistance + neighbor.weight;
      if (candidateDistance < distances.get(neighbor.node)) {
        distances.set(neighbor.node, candidateDistance);
        previous.set(neighbor.node, current);
      }
    }
  }

  const cost = distances.get(destinationId);
  if (cost === Infinity) return null;

  const path = [];
  let current = destinationId;
  while (current !== undefined) {
    path.push(current);
    if (current === sourceId) break;
    current = previous.get(current);
  }

  if (path[path.length - 1] !== sourceId) return null;

  return { path: path.reverse(), cost };
}

export default dijkstra;
