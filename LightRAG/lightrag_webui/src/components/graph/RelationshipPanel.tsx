import { useState } from 'react'
import { ArrowRight, Loader2, Link2, Unlink2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Button from '@/components/ui/Button'
import { useGraphStore } from '@/stores/graph'
import { analyzeRelationship, RelationshipAnalysis } from '@/api/relationship'

const RelationshipView = () => {
  const selectedNode = useGraphStore.use.selectedNode()
  const secondSelectedNode = useGraphStore.use.secondSelectedNode()
  const relationshipAnalysis = useGraphStore.use.relationshipAnalysis()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!selectedNode || !secondSelectedNode) return null

  const analysis = relationshipAnalysis as RelationshipAnalysis | null

  const handleAnalyze = async () => {
    setIsLoading(true)
    setError(null)
    useGraphStore.getState().setRelationshipAnalysis(null)
    try {
      const result = await analyzeRelationship(selectedNode, secondSelectedNode)
      useGraphStore.getState().setRelationshipAnalysis(result)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    useGraphStore.getState().setSecondSelectedNode(null)
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-md pl-1 font-bold tracking-wide text-violet-700">Relationship</h3>
        <Button size="sm" variant="ghost" onClick={handleClear} className="h-6 text-xs">
          Clear
        </Button>
      </div>

      {/* Node pair */}
      <div className="bg-primary/5 rounded p-2 flex items-center gap-2">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-primary font-medium truncate max-w-[45%]">{selectedNode}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400 font-medium truncate max-w-[45%]">{secondSelectedNode}</span>
      </div>

      {/* Analyze button */}
      {!analysis && !isLoading && !error && (
        <Button onClick={handleAnalyze} size="sm" className="w-full">
          Analyze Relationship
        </Button>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-3 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded bg-destructive/10 p-2 text-destructive">
          {error}
          <Button onClick={handleAnalyze} size="sm" variant="outline" className="mt-2 w-full">
            Retry
          </Button>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <>
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {analysis.has_direct_edge ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
                <Link2 className="h-3 w-3" />
                Directly Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 font-medium text-yellow-700 dark:text-yellow-400">
                <Unlink2 className="h-3 w-3" />
                {analysis.shortest_paths.length > 0
                  ? `${analysis.shortest_paths[0].length - 1} hops`
                  : 'Disconnected'}
              </span>
            )}
          </div>

          {/* Shortest Paths */}
          {analysis.shortest_paths.length > 0 && !analysis.has_direct_edge && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-emerald-700">Path</h3>
              <div className="bg-primary/5 rounded p-2 space-y-1">
                {analysis.shortest_paths.slice(0, 2).map((path, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1">
                    {path.map((nodeId, j) => (
                      <span key={j} className="flex items-center gap-1">
                        {j > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="rounded bg-muted px-1.5 py-0.5">{nodeId}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Link Prediction */}
          {Object.keys(analysis.link_prediction).length > 0 && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-amber-700">Link Prediction</h3>
              <div className="bg-primary/5 rounded p-2 space-y-0.5">
                {Object.entries(analysis.link_prediction).map(([metric, score]) => (
                  <div key={metric} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{metric.replace(/_/g, ' ')}</span>
                    <span className="font-mono">{typeof score === 'number' ? score.toFixed(4) : score}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Common Neighbors */}
          {analysis.common_neighbors.length > 0 && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-blue-700">
                Shared Neighbors ({analysis.common_neighbors.length})
              </h3>
              <div className="bg-primary/5 rounded p-2 flex flex-wrap gap-1">
                {analysis.common_neighbors.slice(0, 15).map((neighbor) => (
                  <span
                    key={neighbor}
                    className="rounded-full bg-muted px-2 py-0.5 cursor-pointer hover:bg-primary/20"
                    onClick={() => useGraphStore.getState().setSelectedNode(neighbor, true)}
                  >
                    {neighbor}
                  </span>
                ))}
                {analysis.common_neighbors.length > 15 && (
                  <span className="text-muted-foreground px-1">
                    +{analysis.common_neighbors.length - 15} more
                  </span>
                )}
              </div>
            </>
          )}

          {/* LLM Summary */}
          {analysis.llm_summary && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-violet-700">Analysis</h3>
              <div className="bg-primary/5 rounded p-2 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{analysis.llm_summary}</ReactMarkdown>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default RelationshipView
