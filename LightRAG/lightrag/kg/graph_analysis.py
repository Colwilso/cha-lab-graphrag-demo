"""
Graph analysis utilities for the Node Relationship Explorer feature.

Provides path-finding, neighbor analysis, link prediction, and relationship
analysis on NetworkX graphs.
"""

from collections import Counter
from typing import Any

import networkx as nx


def find_shortest_paths(
    graph: nx.Graph, source: str, target: str, max_paths: int = 3
) -> list[list[str]]:
    """Find shortest paths between source and target nodes.

    Args:
        graph: NetworkX graph instance.
        source: Source node identifier.
        target: Target node identifier.
        max_paths: Maximum number of shortest paths to return.

    Returns:
        List of paths (each path is a list of node IDs), or empty list if
        nodes are disconnected or do not exist.
    """
    try:
        all_paths = nx.all_shortest_paths(graph, source, target)
        paths = []
        for path in all_paths:
            paths.append(path)
            if len(paths) >= max_paths:
                break
        return paths
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return []


def find_common_neighbors(graph: nx.Graph, source: str, target: str) -> list[str]:
    """Find nodes that are neighbors of both source and target.

    Args:
        graph: NetworkX graph instance.
        source: Source node identifier.
        target: Target node identifier.

    Returns:
        List of node IDs that neighbor both source and target.
    """
    if source not in graph or target not in graph:
        return []

    source_neighbors = set(graph.neighbors(source))
    target_neighbors = set(graph.neighbors(target))
    return sorted(source_neighbors & target_neighbors)


def get_node_context(
    graph: nx.Graph, node_id: str, max_neighbors: int = 10
) -> dict[str, Any]:
    """Get node properties and top neighbors for LLM context.

    Args:
        graph: NetworkX graph instance.
        node_id: Node identifier.
        max_neighbors: Maximum number of neighbors to include.

    Returns:
        Dict with 'properties' (node attributes) and 'neighbors' (list of
        neighbor node IDs sorted by edge weight descending).
    """
    if node_id not in graph:
        return {"properties": {}, "neighbors": []}

    properties = dict(graph.nodes[node_id])

    # Sort neighbors by edge weight (descending) if available
    neighbors_with_weight = []
    for neighbor in graph.neighbors(node_id):
        edge_data = graph.edges[node_id, neighbor]
        weight = edge_data.get("weight", 0)
        neighbors_with_weight.append((neighbor, weight))

    neighbors_with_weight.sort(key=lambda x: x[1], reverse=True)
    neighbors = [n for n, _ in neighbors_with_weight[:max_neighbors]]

    return {"properties": properties, "neighbors": neighbors}


def predict_links(
    graph: nx.Graph, source: str, target: str
) -> dict[str, float]:
    """Run link prediction algorithms on a node pair.

    Args:
        graph: NetworkX graph instance (must be undirected for link prediction).
        source: Source node identifier.
        target: Target node identifier.

    Returns:
        Dict mapping algorithm name to prediction score.
    """
    if source not in graph or target not in graph:
        return {
            "jaccard_coefficient": 0.0,
            "adamic_adar_index": 0.0,
            "preferential_attachment": 0.0,
            "resource_allocation_index": 0.0,
        }

    # Link prediction requires an undirected graph
    if graph.is_directed():
        undirected = graph.to_undirected()
    else:
        undirected = graph

    pair = [(source, target)]
    scores: dict[str, float] = {}

    for name, func in [
        ("jaccard_coefficient", nx.jaccard_coefficient),
        ("adamic_adar_index", nx.adamic_adar_index),
        ("preferential_attachment", nx.preferential_attachment),
        ("resource_allocation_index", nx.resource_allocation_index),
    ]:
        try:
            preds = func(undirected, pair)
            for _, _, score in preds:
                scores[name] = score
        except (nx.NetworkXError, ZeroDivisionError):
            scores[name] = 0.0

    return scores


def analyze_relationship(
    graph: nx.Graph, source: str, target: str
) -> dict[str, Any]:
    """Orchestrate full relationship analysis between two nodes.

    Combines path finding, common neighbors, node context, direct edge info,
    and link prediction into a single result dictionary.

    Args:
        graph: NetworkX graph instance.
        source: Source node identifier.
        target: Target node identifier.

    Returns:
        Dict containing all analysis results.
    """
    # Check if there is a direct edge
    has_direct_edge = graph.has_edge(source, target) if (source in graph and target in graph) else False
    direct_edge_data = dict(graph.edges[source, target]) if has_direct_edge else None

    result: dict[str, Any] = {
        "source": source,
        "target": target,
        "source_exists": source in graph,
        "target_exists": target in graph,
        "has_direct_edge": has_direct_edge,
        "direct_edge_data": direct_edge_data,
        "shortest_paths": find_shortest_paths(graph, source, target),
        "common_neighbors": find_common_neighbors(graph, source, target),
        "source_context": get_node_context(graph, source),
        "target_context": get_node_context(graph, target),
        "link_prediction": predict_links(graph, source, target),
    }

    return result


def analyze_multi_node_relationship(
    graph: nx.Graph, node_ids: list[str]
) -> dict[str, Any]:
    """Analyze relationships among multiple nodes using a Steiner tree approximation.

    Computes the minimal subgraph connecting all reachable input nodes, pairwise
    metrics, shared hubs, and link prediction for unconnected pairs.

    Args:
        graph: NetworkX graph instance.
        node_ids: List of node identifiers to analyze.

    Returns:
        Dict with connected/disconnected nodes, Steiner tree structure,
        pairwise metrics, shared hubs, and link prediction scores.
    """
    # Validate node existence
    existing_nodes = [n for n in node_ids if n in graph]
    missing_nodes = [n for n in node_ids if n not in graph]

    if len(existing_nodes) < 2:
        return {
            "node_ids": node_ids,
            "missing_nodes": missing_nodes,
            "connected_nodes": existing_nodes,
            "disconnected_nodes": [],
            "steiner_tree_nodes": existing_nodes,
            "steiner_tree_edges": [],
            "pairwise": {},
            "shared_hubs": [],
            "link_prediction": {},
        }

    # Group existing nodes by connected component
    undirected = graph.to_undirected() if graph.is_directed() else graph
    components = list(nx.connected_components(undirected))
    node_to_component: dict[str, int] = {}
    for idx, comp in enumerate(components):
        for n in comp:
            node_to_component[n] = idx

    # Find the largest group of input nodes that share a component
    comp_groups: dict[int, list[str]] = {}
    for n in existing_nodes:
        comp_id = node_to_component.get(n, -1)
        comp_groups.setdefault(comp_id, []).append(n)

    largest_group = max(comp_groups.values(), key=len)
    connected_nodes = largest_group
    disconnected_nodes = [n for n in existing_nodes if n not in largest_group]

    # Build Steiner tree approximation for connected nodes
    steiner_tree_node_set: set[str] = set()
    steiner_tree_edge_set: set[tuple[str, str]] = set()

    if len(connected_nodes) >= 2:
        # Start with the shortest path between the first two nodes
        try:
            initial_path = nx.shortest_path(
                undirected, connected_nodes[0], connected_nodes[1]
            )
            steiner_tree_node_set.update(initial_path)
            for i in range(len(initial_path) - 1):
                edge = tuple(sorted((initial_path[i], initial_path[i + 1])))
                steiner_tree_edge_set.add(edge)
        except nx.NetworkXNoPath:
            pass

        # For each remaining node, find shortest path to the tree
        for node in connected_nodes[2:]:
            if node in steiner_tree_node_set:
                continue

            best_path: list[str] | None = None
            best_length = float("inf")

            for tree_node in list(steiner_tree_node_set):
                try:
                    path = nx.shortest_path(undirected, node, tree_node)
                    if len(path) < best_length:
                        best_length = len(path)
                        best_path = path
                except nx.NetworkXNoPath:
                    continue

            if best_path is not None:
                steiner_tree_node_set.update(best_path)
                for i in range(len(best_path) - 1):
                    edge = tuple(sorted((best_path[i], best_path[i + 1])))
                    steiner_tree_edge_set.add(edge)

    steiner_tree_nodes = sorted(steiner_tree_node_set)
    steiner_tree_edges = [list(e) for e in sorted(steiner_tree_edge_set)]

    # Pairwise analysis for all connected node pairs
    pairwise: dict[str, dict[str, Any]] = {}
    for i, node_a in enumerate(connected_nodes):
        for node_b in connected_nodes[i + 1:]:
            key = f"{node_a}|{node_b}"
            has_direct_edge = graph.has_edge(node_a, node_b)

            try:
                path = nx.shortest_path(undirected, node_a, node_b)
                path_length = len(path) - 1
            except nx.NetworkXNoPath:
                path_length = -1

            common = find_common_neighbors(graph, node_a, node_b)

            pairwise[key] = {
                "has_direct_edge": has_direct_edge,
                "path_length": path_length,
                "common_neighbor_count": len(common),
            }

    # Shared hubs: nodes that appear as neighbors of 3+ input nodes
    neighbor_counts: Counter[str] = Counter()
    for node in connected_nodes:
        if node in graph:
            for neighbor in graph.neighbors(node):
                if neighbor not in connected_nodes:
                    neighbor_counts[neighbor] += 1

    shared_hubs = [
        {"node": node, "count": count}
        for node, count in neighbor_counts.most_common()
        if count >= 3
    ]

    # Link prediction for pairs without direct edges
    link_prediction: dict[str, dict[str, float]] = {}
    for i, node_a in enumerate(connected_nodes):
        for node_b in connected_nodes[i + 1:]:
            if not graph.has_edge(node_a, node_b):
                key = f"{node_a}|{node_b}"
                link_prediction[key] = predict_links(graph, node_a, node_b)

    return {
        "node_ids": node_ids,
        "missing_nodes": missing_nodes,
        "connected_nodes": connected_nodes,
        "disconnected_nodes": disconnected_nodes,
        "steiner_tree_nodes": steiner_tree_nodes,
        "steiner_tree_edges": steiner_tree_edges,
        "pairwise": pairwise,
        "shared_hubs": shared_hubs,
        "link_prediction": link_prediction,
    }
