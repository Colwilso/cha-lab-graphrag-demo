import axios from 'axios'
import { backendBaseUrl } from '@/lib/constants'
import { useSettingsStore } from '@/stores/settings'

export type MultiNodeAnalysis = {
  node_ids: string[]
  connected_nodes: string[]
  disconnected_nodes: string[]
  steiner_tree_nodes: string[]
  steiner_tree_edges: [string, string][]
  pairwise: Record<string, { has_direct_edge: boolean, path_length: number | null, common_neighbor_count: number }>
  shared_hubs: Array<{ node: string, count: number }>
  link_prediction: Record<string, Record<string, number>>
  llm_summary: string | null
}

export const analyzeRelationship = async (nodeIds: string[]): Promise<MultiNodeAnalysis> => {
  const token = localStorage.getItem('LIGHTRAG-API-TOKEN')
  const apiKey = useSettingsStore.getState().apiKey
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (apiKey) headers['X-API-Key'] = apiKey

  const response = await axios.post(
    `${backendBaseUrl}/graph/relationship-analysis`,
    { node_ids: nodeIds, include_llm_summary: true },
    { headers }
  )
  const data = response.data
  return {
    ...data.analysis,
    llm_summary: data.llm_summary,
  }
}
