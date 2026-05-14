import axios from 'axios'
import { backendBaseUrl } from '@/lib/constants'
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
