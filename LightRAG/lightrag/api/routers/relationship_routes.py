"""
Routes for the Node Relationship Explorer feature.

Provides an endpoint that analyzes the relationship between two nodes in the
knowledge graph, including paths, common neighbors, link prediction scores,
and an optional LLM-generated summary.
"""

from typing import Optional

import traceback
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lightrag.utils import logger
from lightrag.kg.graph_analysis import analyze_relationship
from ..utils_api import get_combined_auth_dependency


class RelationshipAnalysisRequest(BaseModel):
    source_node: str = Field(
        ...,
        description="Name of the source entity node",
        min_length=1,
    )
    target_node: str = Field(
        ...,
        description="Name of the target entity node",
        min_length=1,
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
        """Analyze the relationship between two nodes in the knowledge graph.

        Returns graph-structural analysis (paths, common neighbors, link
        prediction) and an optional LLM-generated natural language summary.
        """
        try:
            graph = await rag.chunk_entity_relation_graph._get_graph()

            analysis = analyze_relationship(
                graph, request.source_node, request.target_node
            )

            result = {"analysis": analysis, "llm_summary": None}

            if request.include_llm_summary:
                prompt = _build_llm_prompt(analysis)
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


def _build_llm_prompt(analysis: dict) -> str:
    """Build the LLM prompt from analysis results."""
    source = analysis["source"]
    target = analysis["target"]

    source_props = analysis["source_context"].get("properties", {})
    target_props = analysis["target_context"].get("properties", {})

    source_type = source_props.get("entity_type", "unknown")
    source_desc = source_props.get("description", "No description available")
    target_type = target_props.get("entity_type", "unknown")
    target_desc = target_props.get("description", "No description available")

    # Direct edge info
    if analysis["has_direct_edge"]:
        edge_info = f"There IS a direct edge between them with data: {analysis['direct_edge_data']}"
    else:
        edge_info = "There is NO direct edge between them."

    # Paths
    paths = analysis["shortest_paths"]
    if paths:
        paths_str = "\n".join(
            f"  Path {i+1}: {' -> '.join(p)}" for i, p in enumerate(paths)
        )
    else:
        paths_str = "  No paths found (nodes may be disconnected)."

    # Common neighbors
    common = analysis["common_neighbors"]
    common_str = ", ".join(common) if common else "None"

    # Link prediction
    lp = analysis["link_prediction"]
    lp_str = "\n".join(f"  {k}: {v:.4f}" for k, v in lp.items())

    prompt = f"""Analyze the relationship between two entities in a knowledge graph.

Entity 1: "{source}"
  Type: {source_type}
  Description: {source_desc}

Entity 2: "{target}"
  Type: {target_type}
  Description: {target_desc}

Graph Structure:
- Direct edge: {edge_info}
- Shortest paths:
{paths_str}
- Common neighbors: {common_str}
- Link prediction scores:
{lp_str}

Based on the graph data above, provide a 3-5 sentence analysis of the relationship between these two entities. Describe how they are connected, what intermediary entities link them, and how strong the structural relationship appears to be.

IMPORTANT: Do NOT invent or assume relationships that are not supported by the graph data provided above. Only describe what the graph structure shows."""

    return prompt
