"""
Graph analysis utilities for the Node Relationship Explorer feature.

Provides path-finding, neighbor analysis, link prediction, and relationship
analysis on NetworkX graphs.
"""

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
