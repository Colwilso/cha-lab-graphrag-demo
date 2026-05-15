import { useState } from 'react'
import { ArrowRight, Loader2, Link2, Unlink2, X, History, Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Button from '@/components/ui/Button'
import { useGraphStore, AnalysisHistoryEntry } from '@/stores/graph'
import { analyzeRelationship, MultiNodeAnalysis } from '@/api/relationship'

const RelationshipView = () => {
  const selectedNodes = useGraphStore.use.selectedNodes()
  const activeAnalysis = useGraphStore.use.activeAnalysis()
  const analysisHistory = useGraphStore.use.analysisHistory()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shouldRender = selectedNodes.length >= 2 || activeAnalysis || analysisHistory.length > 0
  if (!shouldRender) return null

  const analysis = activeAnalysis as MultiNodeAnalysis | null

  const handleAnalyze = async () => {
    if (selectedNodes.length < 2) return
    setIsLoading(true)
    setError(null)
    useGraphStore.getState().setActiveAnalysis(null)
    try {
      const result = await analyzeRelationship(selectedNodes)
      useGraphStore.getState().setActiveAnalysis(result)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Analysis failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveAndClose = () => {
    useGraphStore.getState().saveAnalysisToHistory()
  }

  const handleClear = () => {
    useGraphStore.getState().clearSelectedNodes()
  }

  const handleRestoreHistory = (id: string) => {
    useGraphStore.getState().restoreAnalysisFromHistory(id)
  }

  const handleRemoveHistory = (id: string) => {
    const state = useGraphStore.getState()
    const filtered = state.analysisHistory.filter(e => e.id !== id)
    // Direct state update for removal -- no dedicated action needed
    useGraphStore.setState({ analysisHistory: filtered })
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-md pl-1 font-bold tracking-wide text-violet-700">Relationship</h3>
        {selectedNodes.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleClear} className="h-6 text-xs">
            Clear
          </Button>
        )}
      </div>

      {/* Selected node pills */}
      {selectedNodes.length > 0 && (
        <div className="bg-primary/5 rounded p-2 flex flex-wrap items-center gap-1.5">
          {selectedNodes.map((nodeId, i) => (
            <span key={nodeId} className="flex items-center gap-0.5">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mx-0.5" />}
              <span
                className={`rounded px-2 py-0.5 font-medium truncate max-w-[120px] ${
                  i === 0
                    ? 'bg-primary/10 text-primary'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {nodeId}
              </span>
              <button
                className="text-muted-foreground hover:text-foreground ml-0.5"
                onClick={() => useGraphStore.getState().removeSelectedNode(nodeId)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Analyze button */}
      {selectedNodes.length >= 2 && !analysis && !isLoading && !error && (
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
          <div className="flex items-center gap-2 flex-wrap">
            {analysis.connected_nodes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
                <Link2 className="h-3 w-3" />
                {analysis.connected_nodes.length} connected
              </span>
            )}
            {analysis.disconnected_nodes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 font-medium text-yellow-700 dark:text-yellow-400">
                <Unlink2 className="h-3 w-3" />
                {analysis.disconnected_nodes.length} disconnected
              </span>
            )}
          </div>

          {/* Steiner tree path */}
          {analysis.steiner_tree_nodes.length > 0 && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-emerald-700">Steiner Tree</h3>
              <div className="bg-primary/5 rounded p-2">
                <div className="flex flex-wrap items-center gap-1">
                  {analysis.steiner_tree_nodes.map((nodeId, i) => (
                    <span key={nodeId} className="flex items-center gap-1">
                      {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          selectedNodes.includes(nodeId)
                            ? 'bg-primary/20 font-medium'
                            : 'bg-muted'
                        }`}
                      >
                        {nodeId}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Shared hubs */}
          {analysis.shared_hubs.length > 0 && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-blue-700">
                Shared Hubs ({analysis.shared_hubs.length})
              </h3>
              <div className="bg-primary/5 rounded p-2 flex flex-wrap gap-1">
                {analysis.shared_hubs.slice(0, 15).map((hub) => (
                  <span
                    key={hub}
                    className="rounded-full bg-muted px-2 py-0.5 cursor-pointer hover:bg-primary/20"
                    onClick={() => useGraphStore.getState().setSelectedNode(hub, true)}
                  >
                    {hub}
                  </span>
                ))}
                {analysis.shared_hubs.length > 15 && (
                  <span className="text-muted-foreground px-1">
                    +{analysis.shared_hubs.length - 15} more
                  </span>
                )}
              </div>
            </>
          )}

          {/* Link prediction for unconnected pairs */}
          {Object.keys(analysis.link_prediction).length > 0 && (
            <>
              <h3 className="text-md pl-1 font-bold tracking-wide text-amber-700">Link Prediction</h3>
              <div className="bg-primary/5 rounded p-2 space-y-1.5">
                {Object.entries(analysis.link_prediction).map(([pairKey, scores]) => (
                  <div key={pairKey}>
                    <div className="text-muted-foreground mb-0.5">{pairKey}</div>
                    <div className="pl-2 space-y-0.5">
                      {Object.entries(scores).map(([metric, score]) => (
                        <div key={metric} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{metric.replace(/_/g, ' ')}</span>
                          <span className="font-mono">{typeof score === 'number' ? score.toFixed(4) : score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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

          {/* Save & Close */}
          <Button onClick={handleSaveAndClose} size="sm" variant="outline" className="w-full mt-1">
            <Save className="h-3 w-3 mr-1" />
            Save & Close
          </Button>
        </>
      )}

      {/* History section */}
      {analysisHistory.length > 0 && (
        <>
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
            <History className="h-3 w-3 text-muted-foreground" />
            <h3 className="text-md pl-1 font-bold tracking-wide text-muted-foreground">History</h3>
          </div>
          <div className="space-y-1">
            {analysisHistory.map((entry: AnalysisHistoryEntry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between bg-primary/5 rounded px-2 py-1.5 cursor-pointer hover:bg-primary/10"
                onClick={() => handleRestoreHistory(entry.id)}
              >
                <span className="truncate text-xs">
                  {entry.nodeIds.join(' -- ')}
                </span>
                <button
                  className="text-muted-foreground hover:text-destructive shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveHistory(entry.id)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default RelationshipView
