"""
Routes for the Node Relationship Explorer feature.

Provides an endpoint that analyzes relationships among multiple nodes in the
knowledge graph, including Steiner tree structure, shared hubs, link prediction
scores, and an optional LLM-generated summary.
"""

from typing import Optional

import traceback
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lightrag.utils import logger
from lightrag.kg.graph_analysis import analyze_multi_node_relationship
from ..utils_api import get_combined_auth_dependency


class RelationshipAnalysisRequest(BaseModel):
    node_ids: list[str] = Field(
        ...,
        min_length=2,
        description="List of node IDs to analyze",
    )
    include_llm_summary: bool = Field(
        default=True,
        description="Whether to include an LLM-generated summary of the relationship",
    )


def create_relationship_routes(rag, api_key: Optional[str] = None):
    """Factory function to create the relationship analysis router.

    Args:
        rag: LightRAG instance with initialized storages.
        api_key: Optional API key for authentication.

    Returns:
        FastAPI APIRouter with relationship analysis endpoints.
    """
    router = APIRouter(tags=["graph"])

    combined_auth = get_combined_auth_dependency(api_key)

    @router.post(
        "/graph/relationship-analysis", dependencies=[Depends(combined_auth)]
    )
    async def relationship_analysis(request: RelationshipAnalysisRequest):
        """Analyze the relationships among multiple nodes in the knowledge graph.

        Returns graph-structural analysis (Steiner tree, pairwise metrics,
        shared hubs, link prediction) and an optional LLM-generated summary.
        """
        try:
            graph = await rag.chunk_entity_relation_graph._get_graph()

            analysis = analyze_multi_node_relationship(graph, request.node_ids)

            result = {"analysis": analysis, "llm_summary": None}

            if request.include_llm_summary:
                prompt = _build_llm_prompt(analysis, graph)
                try:
                    summary = await rag.llm_model_func(prompt)
                    result["llm_summary"] = summary
                except Exception as e:
                    logger.warning(
                        f"LLM summary generation failed: {str(e)}"
                    )
                    result["llm_summary"] = None

            return result

        except Exception as e:
            logger.error(f"Error in relationship analysis: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"Error analyzing relationship: {str(e)}",
            )

    return router


def _build_llm_prompt(analysis: dict, graph) -> str:
    """Build the LLM prompt from multi-node analysis results.

    Args:
        analysis: Result dict from analyze_multi_node_relationship.
        graph: NetworkX graph for fetching node properties.
    """
    node_ids = analysis["node_ids"]
    connected_nodes = analysis["connected_nodes"]
    disconnected_nodes = analysis["disconnected_nodes"]
    missing_nodes = analysis.get("missing_nodes", [])
    steiner_tree_nodes = analysis["steiner_tree_nodes"]
    steiner_tree_edges = analysis["steiner_tree_edges"]
    shared_hubs = analysis["shared_hubs"]
    link_prediction = analysis["link_prediction"]

    # Entity descriptions
    entity_lines = []
    for node_id in node_ids:
        if node_id in graph:
            props = dict(graph.nodes[node_id])
            entity_type = props.get("entity_type", "unknown")
            description = props.get("description", "No description available")
            entity_lines.append(
                f'- "{node_id}" (type: {entity_type}): {description}'
            )
        else:
            entity_lines.append(f'- "{node_id}": NOT FOUND in graph')
    entities_str = "\n".join(entity_lines)

    # Steiner tree structure
    intermediary_nodes = [
        n for n in steiner_tree_nodes if n not in connected_nodes
    ]
    if steiner_tree_edges:
        tree_edges_str = "\n".join(
            f"  {e[0]} -- {e[1]}" for e in steiner_tree_edges
        )
        tree_section = (
            f"Steiner tree edges:\n{tree_edges_str}\n"
            f"Intermediary nodes (not in input set): "
            f"{', '.join(intermediary_nodes) if intermediary_nodes else 'None'}"
        )
    else:
        tree_section = "No Steiner tree could be constructed (nodes are disconnected)."

    # Disconnected nodes
    if disconnected_nodes or missing_nodes:
        disconnected_str = (
            f"Disconnected from main group: {', '.join(disconnected_nodes)}\n"
            f"Missing from graph entirely: {', '.join(missing_nodes)}"
        )
    else:
        disconnected_str = "All nodes are connected."

    # Shared hubs
    if shared_hubs:
        hubs_str = "\n".join(
            f"  {h['node']} (neighbor of {h['count']} input nodes)"
            for h in shared_hubs
        )
    else:
        hubs_str = "  None found"

    # Link prediction for unconnected pairs
    if link_prediction:
        lp_lines = []
        for pair_key, scores in link_prediction.items():
            lp_lines.append(f"  {pair_key}:")
            for algo, score in scores.items():
                lp_lines.append(f"    {algo}: {score:.4f}")
        lp_str = "\n".join(lp_lines)
    else:
        lp_str = "  All pairs have direct edges (no prediction needed)."

    prompt = f"""Analyze the relationships among the following entities in a knowledge graph.

Entities:
{entities_str}

Connectivity:
{disconnected_str}

Spanning Structure (Steiner Tree):
{tree_section}

Shared Hubs (nodes neighboring 3+ of the input entities):
{hubs_str}

Link Prediction Scores (for pairs WITHOUT a direct edge):
{lp_str}

Instructions for your response format:
1. Start with "## Synthesis" -- a 2-3 sentence summary of how these entities relate to each other as a group. State the key finding plainly.
2. Then "## Direct Connections" -- describe each pair that shares a direct edge, citing the edge description from the graph data.
3. Then "## Structural Role" -- describe any hub or bridging nodes and the overall topology (star, chain, cluster, etc).
4. Then "## Unconnected Pairs" -- for each pair without a direct edge, state that plainly and include the link prediction scores.
5. Finally "## Speculative Connections" -- ONLY if link prediction scores are high (preferential attachment > 500 or adamic_adar > 0.3) for any unconnected pair. Hypothesize what the connection might be based on shared neighbors. If no scores meet the threshold, write "No speculative connections warranted."

Rules:
- Describe ONLY what the graph structure shows. Do not add interpretive language or make claims beyond what is evidenced.
- If nodes are not connected, state this plainly.
- Do NOT use filler phrases like 'sophisticated', 'comprehensive', 'at its core', or 'what makes this particularly valuable'.
- Keep each section concise. Do not repeat information across sections."""

    return prompt
