import { useState } from 'react'
import { X, ArrowRight, Loader2, Link2, Unlink2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Button from '@/components/ui/Button'
import { useGraphStore } from '@/stores/graph'
import { analyzeRelationship, RelationshipAnalysis } from '@/api/relationship'

const RelationshipPanel = () => {
  const selectedNode = useGraphStore.use.selectedNode()
  const secondSelectedNode = useGraphStore.use.secondSelectedNode()

  const [analysis, setAnalysis] = useState<RelationshipAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!selectedNode || !secondSelectedNode) return null

  const handleAnalyze = async () => {
    setIsLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const result = await analyzeRelationship(selectedNode, secondSelectedNode)
      setAnalysis(result)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    useGraphStore.getState().setSecondSelectedNode(null)
    setAnalysis(null)
    setError(null)
  }

  return (
    <div className="absolute top-2 right-2 z-50 w-[380px] max-h-[70vh] overflow-auto rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-primary truncate max-w-[120px]">{selectedNode}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400 truncate max-w-[120px]">{secondSelectedNode}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} className="h-6 w-6 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Analyze button */}
      {!analysis && !isLoading && !error && (
        <Button onClick={handleAnalyze} size="sm" className="mb-3 w-full">
          Analyze Relationship
        </Button>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing relationship...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 rounded bg-destructive/10 p-2 text-sm text-destructive">
          {error}
          <Button onClick={handleAnalyze} size="sm" variant="outline" className="mt-2 w-full">
            Retry
          </Button>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="space-y-3">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            {analysis.has_direct_edge ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                <Link2 className="h-3 w-3" />
                Directly Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                <Unlink2 className="h-3 w-3" />
                {analysis.shortest_paths.length > 0
                  ? `${analysis.shortest_paths[0].length - 1} hops apart`
                  : 'Not Connected'}
              </span>
            )}
          </div>

          {/* LLM Summary */}
          {analysis.llm_summary && (
            <div className="rounded border p-3">
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Summary</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{analysis.llm_summary}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Shortest Paths */}
          {analysis.shortest_paths.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Shortest Paths</h4>
              <div className="space-y-1">
                {analysis.shortest_paths.map((path, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1 text-xs">
                    {path.map((nodeId, j) => (
                      <span key={j} className="flex items-center gap-1">
                        {j > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="rounded bg-muted px-1.5 py-0.5">{nodeId}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Common Neighbors */}
          {analysis.common_neighbors.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Common Neighbors ({analysis.common_neighbors.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {analysis.common_neighbors.slice(0, 20).map((neighbor) => (
                  <span key={neighbor} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {neighbor}
                  </span>
                ))}
                {analysis.common_neighbors.length > 20 && (
                  <span className="text-xs text-muted-foreground">
                    +{analysis.common_neighbors.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Link Prediction Scores */}
          {Object.keys(analysis.link_prediction).length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Link Prediction</h4>
              <div className="grid grid-cols-1 gap-y-0.5 text-xs">
                {Object.entries(analysis.link_prediction).map(([metric, score]) => (
                  <div key={metric} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{metric.replace(/_/g, ' ')}</span>
                    <span className="font-mono">{typeof score === 'number' ? score.toFixed(4) : score}</span>
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

export default RelationshipPanel
