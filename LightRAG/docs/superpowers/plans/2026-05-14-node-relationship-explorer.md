# Node Relationship Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select two nodes on the knowledge graph and get an LLM-powered analysis of how they're related, including graph-science link prediction for discovering missing connections.

**Architecture:** Add multi-select to the existing Sigma.js graph (shift+click for second node). New backend endpoint `/graph/relationship-analysis` accepts two node IDs, runs NetworkX path-finding + link prediction algorithms, then passes the structural context to the LLM for a natural language summary. Results display in a slide-out panel.

**Tech Stack:** NetworkX (link prediction, shortest paths), existing Bedrock LLM via `use_llm_func_with_cache`, React + Zustand (frontend state), Sigma.js (graph highlighting).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `lightrag/api/routers/relationship_routes.py` | API endpoint for relationship analysis |
| Create | `lightrag/kg/graph_analysis.py` | Graph algorithms: paths, common neighbors, link prediction |
| Create | `lightrag_webui/src/components/graph/RelationshipPanel.tsx` | UI panel showing analysis results |
| Modify | `lightrag_webui/src/stores/graph.ts` | Add `secondSelectedNode` state + multi-select logic |
| Modify | `lightrag_webui/src/hooks/useLightragGraph.tsx` | Add shift+click handler for second node selection |
| Modify | `lightrag_webui/src/features/GraphViewer.tsx` | Wire up RelationshipPanel, highlight path between nodes |
| Modify | `lightrag/api/lightrag_server.py` | Register new router |
| Create | `lightrag_webui/src/api/relationship.ts` | Frontend API client for relationship endpoint |

---

### Task 1: Graph Analysis Module (Backend)

**Files:**
- Create: `lightrag/kg/graph_analysis.py`

- [ ] **Step 1: Create graph_analysis.py with path-finding functions**

```python
"""Graph analysis utilities for relationship exploration."""

import networkx as nx
from networkx.algorithms import link_prediction


def find_shortest_paths(graph: nx.Graph, source: str, target: str, max_paths: int = 3):
    """Find shortest paths between two nodes. Returns list of paths or empty if disconnected."""
    if not graph.has_node(source) or not graph.has_node(target):
        return []
    try:
        paths = list(nx.all_shortest_paths(graph, source, target))
        return paths[:max_paths]
    except nx.NetworkXNoPath:
        return []


def find_common_neighbors(graph: nx.Graph, source: str, target: str):
    """Find nodes that are neighbors of both source and target."""
    if not graph.has_node(source) or not graph.has_node(target):
        return []
    source_neighbors = set(graph.neighbors(source))
    target_neighbors = set(graph.neighbors(target))
    common = source_neighbors & target_neighbors
    return list(common)


def get_node_context(graph: nx.Graph, node_id: str, max_neighbors: int = 10):
    """Get a node's properties and top neighbors by degree for LLM context."""
    if not graph.has_node(node_id):
        return None
    props = dict(graph.nodes[node_id])
    neighbors = list(graph.neighbors(node_id))
    neighbor_data = []
    for n in sorted(neighbors, key=lambda x: graph.degree(x), reverse=True)[:max_neighbors]:
        edge_data = graph.edges[node_id, n] if graph.has_edge(node_id, n) else {}
        neighbor_data.append({
            "id": n,
            "type": graph.nodes[n].get("entity_type", ""),
            "edge_description": edge_data.get("description", ""),
        })
    return {"id": node_id, "properties": props, "neighbors": neighbor_data}


def predict_links(graph: nx.Graph, source: str, target: str):
    """Run link prediction algorithms between two nodes.
    Returns scores from multiple algorithms to suggest if a link should exist."""
    if not graph.has_node(source) or not graph.has_node(target):
        return {}

    results = {}
    node_pair = [(source, target)]

    # Common Neighbors index
    preds = nx.common_neighbor_centrality(graph, node_pair)
    for u, v, score in preds:
        results["common_neighbor_centrality"] = round(score, 4)

    # Jaccard Coefficient
    preds = nx.jaccard_coefficient(graph, node_pair)
    for u, v, score in preds:
        results["jaccard_coefficient"] = round(score, 4)

    # Adamic-Adar Index
    preds = nx.adamic_adar_index(graph, node_pair)
    for u, v, score in preds:
        results["adamic_adar_index"] = round(score, 4)

    # Preferential Attachment
    preds = nx.preferential_attachment(graph, node_pair)
    for u, v, score in preds:
        results["preferential_attachment"] = score

    # Resource Allocation Index
    preds = nx.resource_allocation_index(graph, node_pair)
    for u, v, score in preds:
        results["resource_allocation_index"] = round(score, 4)

    return results


def analyze_relationship(graph: nx.Graph, source: str, target: str):
    """Full relationship analysis between two nodes."""
    directly_connected = graph.has_edge(source, target)
    edge_data = None
    if directly_connected:
        edge_data = dict(graph.edges[source, target])

    shortest_paths = find_shortest_paths(graph, source, target)
    common = find_common_neighbors(graph, source, target)
    link_scores = predict_links(graph, source, target)
    source_context = get_node_context(graph, source)
    target_context = get_node_context(graph, target)

    # Get properties of intermediate nodes on paths
    path_details = []
    for path in shortest_paths:
        path_nodes = []
        for node_id in path:
            node_props = graph.nodes[node_id]
            path_nodes.append({
                "id": node_id,
                "type": node_props.get("entity_type", ""),
                "description": node_props.get("description", "")[:200],
            })
        path_details.append(path_nodes)

    # Common neighbor details
    common_details = []
    for node_id in common[:10]:
        node_props = graph.nodes[node_id]
        common_details.append({
            "id": node_id,
            "type": node_props.get("entity_type", ""),
            "description": node_props.get("description", "")[:200],
        })

    return {
        "source": source,
        "target": target,
        "directly_connected": directly_connected,
        "edge_data": edge_data,
        "shortest_paths": path_details,
        "path_length": len(shortest_paths[0]) - 1 if shortest_paths else None,
        "common_neighbors": common_details,
        "link_prediction_scores": link_scores,
        "source_context": source_context,
        "target_context": target_context,
    }
```

- [ ] **Step 2: Commit**

```bash
git add lightrag/kg/graph_analysis.py
git commit -m "feat: add graph analysis module with path-finding and link prediction"
```

---

### Task 2: Relationship Analysis API Endpoint

**Files:**
- Create: `lightrag/api/routers/relationship_routes.py`
- Modify: `lightrag/api/lightrag_server.py` (register router)

- [ ] **Step 1: Create the relationship routes module**

```python
"""API routes for node relationship analysis."""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lightrag.kg.graph_analysis import analyze_relationship


class RelationshipRequest(BaseModel):
    source_node: str
    target_node: str
    include_llm_summary: bool = True


class RelationshipResponse(BaseModel):
    source: str
    target: str
    directly_connected: bool
    edge_data: Optional[dict] = None
    shortest_paths: list = []
    path_length: Optional[int] = None
    common_neighbors: list = []
    link_prediction_scores: dict = {}
    llm_summary: Optional[str] = None


RELATIONSHIP_PROMPT = """You are analyzing the relationship between two entities in a knowledge graph about diabetes and beta-cell research.

## Source Entity: {source_name}
Type: {source_type}
Description: {source_description}

## Target Entity: {target_name}
Type: {target_type}
Description: {target_description}

## Graph Structure Between Them:
- Directly connected: {directly_connected}
{edge_info}
{path_info}
{common_info}

## Link Prediction Scores:
{link_scores}

## Instructions:
Provide a concise analysis (3-5 sentences) of how these two entities are related based on the graph structure above. If they are directly connected, explain the nature of their relationship. If not directly connected, explain the indirect connections through shared neighbors or paths.

If the link prediction scores are high but no direct edge exists, note this as a potentially missing relationship and suggest what the connection might be based on the graph context.

Do NOT invent relationships that are not supported by the graph data above. Only describe connections that are evidenced by the paths, shared neighbors, or existing edges shown."""


def create_relationship_routes(rag, api_key: Optional[str] = None):
    router = APIRouter()

    from lightrag.api.utils_auth import combine_auth_dependency
    combined_auth = combine_auth_dependency(api_key)

    @router.post("/graph/relationship-analysis", dependencies=[Depends(combined_auth)])
    async def analyze_node_relationship(request: RelationshipRequest):
        graph_storage = rag.chunk_entity_relation_graph
        if graph_storage is None:
            raise HTTPException(status_code=500, detail="Graph storage not initialized")

        # Access the underlying NetworkX graph
        graph = await graph_storage._get_graph()

        if not graph.has_node(request.source_node):
            raise HTTPException(status_code=404, detail=f"Source node '{request.source_node}' not found")
        if not graph.has_node(request.target_node):
            raise HTTPException(status_code=404, detail=f"Target node '{request.target_node}' not found")

        # Run graph analysis
        analysis = analyze_relationship(graph, request.source_node, request.target_node)

        llm_summary = None
        if request.include_llm_summary:
            # Build prompt context
            source_ctx = analysis["source_context"]
            target_ctx = analysis["target_context"]

            edge_info = ""
            if analysis["directly_connected"] and analysis["edge_data"]:
                edge_info = f"- Direct edge description: {analysis['edge_data'].get('description', 'N/A')}"

            path_info = ""
            if analysis["shortest_paths"]:
                path_strs = []
                for path in analysis["shortest_paths"][:3]:
                    path_str = " -> ".join(f"{n['id']} ({n['type']})" for n in path)
                    path_strs.append(f"  - {path_str}")
                path_info = f"- Shortest paths (length {analysis['path_length']}):\n" + "\n".join(path_strs)
            else:
                path_info = "- No path exists between these nodes (they are in disconnected components)"

            common_info = ""
            if analysis["common_neighbors"]:
                common_strs = [f"  - {n['id']} ({n['type']})" for n in analysis["common_neighbors"][:5]]
                common_info = f"- Common neighbors ({len(analysis['common_neighbors'])} total):\n" + "\n".join(common_strs)

            link_scores = "\n".join(
                f"- {k}: {v}" for k, v in analysis["link_prediction_scores"].items()
            ) or "No scores available"

            prompt = RELATIONSHIP_PROMPT.format(
                source_name=request.source_node,
                source_type=source_ctx["properties"].get("entity_type", "Unknown") if source_ctx else "Unknown",
                source_description=source_ctx["properties"].get("description", "N/A")[:500] if source_ctx else "N/A",
                target_name=request.target_node,
                target_type=target_ctx["properties"].get("entity_type", "Unknown") if target_ctx else "Unknown",
                target_description=target_ctx["properties"].get("description", "N/A")[:500] if target_ctx else "N/A",
                directly_connected=analysis["directly_connected"],
                edge_info=edge_info,
                path_info=path_info,
                common_info=common_info,
                link_scores=link_scores,
            )

            # Call LLM
            try:
                llm_summary = await rag.llm_model_func(prompt)
            except Exception as e:
                llm_summary = f"LLM analysis unavailable: {str(e)}"

        return RelationshipResponse(
            source=analysis["source"],
            target=analysis["target"],
            directly_connected=analysis["directly_connected"],
            edge_data=analysis["edge_data"],
            shortest_paths=analysis["shortest_paths"],
            path_length=analysis["path_length"],
            common_neighbors=analysis["common_neighbors"],
            link_prediction_scores=analysis["link_prediction_scores"],
            llm_summary=llm_summary,
        )

    return router
```

- [ ] **Step 2: Register the router in lightrag_server.py**

Find where other routers are registered (look for `create_graph_routes`) and add:

```python
from lightrag.api.routers.relationship_routes import create_relationship_routes

# After graph routes registration:
relationship_router = create_relationship_routes(rag, api_key)
app.include_router(relationship_router)
```

- [ ] **Step 3: Commit**

```bash
git add lightrag/api/routers/relationship_routes.py lightrag/api/lightrag_server.py
git commit -m "feat: add relationship analysis API endpoint with LLM summary"
```

---

### Task 3: Frontend Multi-Select State

**Files:**
- Modify: `lightrag_webui/src/stores/graph.ts`

- [ ] **Step 1: Add second node selection state to graph store**

Add to the store state interface (near line 85):
```typescript
secondSelectedNode: string | null
```

Add to the initial state (near line 155):
```typescript
secondSelectedNode: null,
```

Add action:
```typescript
setSecondSelectedNode: (nodeId: string | null) => set({ secondSelectedNode: nodeId }),
```

Add to all reset blocks (near lines 190, 197):
```typescript
secondSelectedNode: null,
```

- [ ] **Step 2: Commit**

```bash
git add lightrag_webui/src/stores/graph.ts
git commit -m "feat: add second node selection state for relationship explorer"
```

---

### Task 4: Frontend API Client

**Files:**
- Create: `lightrag_webui/src/api/relationship.ts`

- [ ] **Step 1: Create API client module**

```typescript
import axios from 'axios'
import { backendBaseUrl } from '@/lib/constants'
import { useAuthStore } from '@/stores/state'
import { useSettingsStore } from '@/stores/settings'

export type RelationshipAnalysis = {
  source: string
  target: string
  directly_connected: boolean
  edge_data: Record<string, any> | null
  shortest_paths: Array<Array<{ id: string; type: string; description: string }>>
  path_length: number | null
  common_neighbors: Array<{ id: string; type: string; description: string }>
  link_prediction_scores: Record<string, number>
  llm_summary: string | null
}

export const analyzeRelationship = async (
  sourceNode: string,
  targetNode: string
): Promise<RelationshipAnalysis> => {
  const token = localStorage.getItem('LIGHTRAG-API-TOKEN')
  const apiKey = useSettingsStore.getState().apiKey

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (apiKey) headers['X-API-Key'] = apiKey

  const response = await axios.post(
    `${backendBaseUrl}/graph/relationship-analysis`,
    { source_node: sourceNode, target_node: targetNode, include_llm_summary: true },
    { headers }
  )
  return response.data
}
```

- [ ] **Step 2: Commit**

```bash
git add lightrag_webui/src/api/relationship.ts
git commit -m "feat: add frontend API client for relationship analysis"
```

---

### Task 5: Relationship Panel Component

**Files:**
- Create: `lightrag_webui/src/components/graph/RelationshipPanel.tsx`

- [ ] **Step 1: Create the RelationshipPanel component**

This component displays when two nodes are selected. It shows:
- The two selected node names with a "Compare" button
- Loading state while analysis runs
- Results: direct connection info, path visualization, common neighbors, link prediction scores, LLM summary

```typescript
import { useState, useCallback } from 'react'
import { useGraphStore } from '@/stores/graph'
import { analyzeRelationship, type RelationshipAnalysis } from '@/api/relationship'
import { XIcon, GitCompareArrowsIcon, LoaderIcon, ArrowRightIcon } from 'lucide-react'
import Button from '@/components/ui/Button'
import ReactMarkdown from 'react-markdown'

export default function RelationshipPanel() {
  const selectedNode = useGraphStore.use.selectedNode()
  const secondSelectedNode = useGraphStore.use.secondSelectedNode()
  const setSecondSelectedNode = useGraphStore.getState().setSecondSelectedNode
  const rawGraph = useGraphStore.use.rawGraph()

  const [analysis, setAnalysis] = useState<RelationshipAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!selectedNode || !secondSelectedNode) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const result = await analyzeRelationship(selectedNode, secondSelectedNode)
      setAnalysis(result)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [selectedNode, secondSelectedNode])

  const handleClear = useCallback(() => {
    setSecondSelectedNode(null)
    setAnalysis(null)
    setError(null)
  }, [setSecondSelectedNode])

  if (!selectedNode || !secondSelectedNode) return null

  const sourceNode = rawGraph?.getNode(selectedNode)
  const targetNode = rawGraph?.getNode(secondSelectedNode)

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 max-h-[50vh] overflow-auto rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[200px]">
            {selectedNode}
          </span>
          <ArrowRightIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="px-2 py-0.5 rounded bg-secondary/50 truncate max-w-[200px]">
            {secondSelectedNode}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!analysis && !loading && (
            <Button size="sm" onClick={handleAnalyze}>
              <GitCompareArrowsIcon className="size-4 mr-1" />
              Analyze
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleClear}>
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <LoaderIcon className="size-4 animate-spin" />
          Analyzing relationship...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 py-2">{error}</div>
      )}

      {analysis && (
        <div className="space-y-3 text-sm">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              analysis.directly_connected
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
            }`}>
              {analysis.directly_connected ? 'Directly Connected' : `${analysis.path_length ? `${analysis.path_length} hops apart` : 'Not Connected'}`}
            </span>
            {analysis.common_neighbors.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {analysis.common_neighbors.length} shared neighbor{analysis.common_neighbors.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* LLM Summary */}
          {analysis.llm_summary && (
            <div className="prose dark:prose-invert prose-sm max-w-none">
              <ReactMarkdown>{analysis.llm_summary}</ReactMarkdown>
            </div>
          )}

          {/* Shortest Paths */}
          {analysis.shortest_paths.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Shortest Path{analysis.shortest_paths.length > 1 ? 's' : ''}</div>
              {analysis.shortest_paths.map((path, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1 text-xs">
                  {path.map((node, j) => (
                    <span key={j} className="flex items-center gap-1">
                      {j > 0 && <ArrowRightIcon className="size-3 text-muted-foreground" />}
                      <span className="px-1.5 py-0.5 rounded bg-muted">{node.id}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Common Neighbors */}
          {analysis.common_neighbors.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Shared Neighbors</div>
              <div className="flex flex-wrap gap-1">
                {analysis.common_neighbors.map((n) => (
                  <span key={n.id} className="px-1.5 py-0.5 rounded bg-muted text-xs">
                    {n.id} <span className="text-muted-foreground">({n.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Link Prediction */}
          {Object.keys(analysis.link_prediction_scores).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Link Prediction Scores</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {Object.entries(analysis.link_prediction_scores).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono">{typeof value === 'number' ? value.toFixed(4) : value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add lightrag_webui/src/components/graph/RelationshipPanel.tsx
git commit -m "feat: add RelationshipPanel component for two-node analysis"
```

---

### Task 6: Wire Up Multi-Select in Graph Events

**Files:**
- Modify: `lightrag_webui/src/hooks/useLightragGraph.tsx` or `lightrag_webui/src/features/GraphViewer.tsx`

- [ ] **Step 1: Find the click handler for node selection**

Look for the existing `setSelectedNode` call in the graph event handling. The pattern to implement:
- Normal click: sets `selectedNode` (existing behavior)
- Shift+click on a different node when one is already selected: sets `secondSelectedNode`
- Shift+click on the same node or on empty space: clears `secondSelectedNode`

In the click handler (likely in `GraphEvents` component or `useLightragGraph` hook), modify:

```typescript
// In the node click handler:
const handleClickNode = (event: { node: string; event: { original: MouseEvent } }) => {
  const nodeId = event.node
  const isShift = event.event.original.shiftKey

  if (isShift && selectedNode && nodeId !== selectedNode) {
    // Shift+click with existing selection = set second node
    useGraphStore.getState().setSecondSelectedNode(nodeId)
  } else {
    // Normal click = primary selection (clear second)
    useGraphStore.getState().setSecondSelectedNode(null)
    useGraphStore.getState().setSelectedNode(nodeId)
  }
}
```

- [ ] **Step 2: Add RelationshipPanel to GraphViewer**

In `GraphViewer.tsx`, import and render the panel:
```typescript
import RelationshipPanel from '@/components/graph/RelationshipPanel'

// Inside the graph container div (after SigmaContainer or at the end of the viewer):
<RelationshipPanel />
```

- [ ] **Step 3: Highlight the second selected node and path**

In the graph rendering logic, add visual distinction for the second selected node (different color/size). If using the sigma reducers pattern, add a case for `secondSelectedNode` in the node reducer to give it a distinct highlight color.

- [ ] **Step 4: Commit**

```bash
git add lightrag_webui/src/hooks/useLightragGraph.tsx lightrag_webui/src/features/GraphViewer.tsx
git commit -m "feat: wire up shift+click multi-select and relationship panel in graph viewer"
```

---

### Task 7: Build and Test End-to-End

- [ ] **Step 1: Rebuild WebUI**

```bash
cd lightrag_webui && bun run build
```

- [ ] **Step 2: Restart server and test**

```bash
# Kill existing server
lsof -i :9621 -t | xargs kill
# Start server from project root
cd /Users/colwilso/workplace/cha-lab-demo/LightRAG
/Users/colwilso/workplace/cha-lab-demo/.venv/bin/lightrag-server
```

- [ ] **Step 3: Manual test flow**

1. Open http://localhost:9621, go to Knowledge Graph tab
2. Click a node (e.g., "MAFA") -- should highlight as primary selection
3. Shift+click a second node (e.g., "MAFB") -- should highlight differently
4. RelationshipPanel should appear at bottom with both names and "Analyze" button
5. Click "Analyze" -- should show loading, then results with paths, common neighbors, link prediction scores, and LLM summary
6. Click X to dismiss and clear second selection

- [ ] **Step 4: Test edge cases via API**

```bash
# Directly connected nodes
curl -s http://localhost:9621/graph/relationship-analysis \
  -X POST -H "Content-Type: application/json" \
  -d '{"source_node": "MAFA", "target_node": "MAFB"}' | python3 -m json.tool | head -30

# Distant/unconnected nodes
curl -s http://localhost:9621/graph/relationship-analysis \
  -X POST -H "Content-Type: application/json" \
  -d '{"source_node": "MAFA", "target_node": "Type 1 Diabetes"}' | python3 -m json.tool | head -30
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete node relationship explorer with link prediction"
```
