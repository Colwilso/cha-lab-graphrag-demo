import { useRegisterEvents, useSetSettings, useSigma } from '@react-sigma/core'
import { AbstractGraph } from 'graphology-types'
// import { useLayoutCircular } from '@react-sigma/layout-circular'
import { useLayoutForceAtlas2 } from '@react-sigma/layout-forceatlas2'
import { useEffect, useState } from 'react'

// import useRandomGraph, { EdgeType, NodeType } from '@/hooks/useRandomGraph'
import { EdgeType, NodeType } from '@/hooks/useLightragGraph'
import useTheme from '@/hooks/useTheme'
import * as Constants from '@/lib/constants'

import { useSettingsStore } from '@/stores/settings'
import { useGraphStore } from '@/stores/graph'

const isButtonPressed = (ev: MouseEvent | TouchEvent) => {
  if (ev.type.startsWith('mouse')) {
    if ((ev as MouseEvent).buttons !== 0) {
      return true
    }
  }
  return false
}

const GraphControl = ({ disableHoverEffect }: { disableHoverEffect?: boolean }) => {
  const sigma = useSigma<NodeType, EdgeType>()
  const registerEvents = useRegisterEvents<NodeType, EdgeType>()
  const setSettings = useSetSettings<NodeType, EdgeType>()

  const maxIterations = useSettingsStore.use.graphLayoutMaxIterations()
  const { assign: assignLayout } = useLayoutForceAtlas2({
    iterations: maxIterations
  })

  const { theme } = useTheme()
  const hideUnselectedEdges = useSettingsStore.use.enableHideUnselectedEdges()
  const enableEdgeEvents = useSettingsStore.use.enableEdgeEvents()
  const renderEdgeLabels = useSettingsStore.use.showEdgeLabel()
  const renderLabels = useSettingsStore.use.showNodeLabel()
  const minEdgeSize = useSettingsStore.use.minEdgeSize()
  const maxEdgeSize = useSettingsStore.use.maxEdgeSize()
  const selectedNode = useGraphStore.use.selectedNode()
  const secondSelectedNode = useGraphStore.use.secondSelectedNode()
  const relationshipAnalysis = useGraphStore.use.relationshipAnalysis()
  const focusedNode = useGraphStore.use.focusedNode()
  const selectedEdge = useGraphStore.use.selectedEdge()
  const focusedEdge = useGraphStore.use.focusedEdge()
  const sigmaGraph = useGraphStore.use.sigmaGraph()
  const hiddenTypes = useGraphStore.use.hiddenTypes()

  // Track system theme changes when theme is set to 'system'
  const [systemThemeIsDark, setSystemThemeIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => setSystemThemeIsDark(e.matches)
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  /**
   * When component mount or maxIterations changes
   * => ensure graph reference and apply layout
   */
  useEffect(() => {
    if (sigmaGraph && sigma) {
      // Ensure sigma binding to sigmaGraph
      try {
        if (typeof sigma.setGraph === 'function') {
          sigma.setGraph(sigmaGraph as unknown as AbstractGraph<NodeType, EdgeType>);
          console.log('Binding graph to sigma instance');
        } else {
          console.error('Sigma missing setGraph function — unexpected: sigma v3 should always have setGraph');
        }
      } catch (error) {
        console.error('Error setting graph on sigma instance:', error);
      }

      assignLayout();
      console.log('Initial layout applied to graph');
    }
  }, [sigma, sigmaGraph, assignLayout, maxIterations])

  /**
   * Ensure the sigma instance is set in the store
   * This provides a backup in case the instance wasn't set in GraphViewer
   */
  useEffect(() => {
    if (sigma) {
      // Double-check that the store has the sigma instance
      const currentInstance = useGraphStore.getState().sigmaInstance;
      if (!currentInstance) {
        console.log('Setting sigma instance from GraphControl');
        useGraphStore.getState().setSigmaInstance(sigma);
      }
    }
  }, [sigma]);

  /**
   * When relationship analysis completes, reposition visible nodes in a
   * left-to-right polar layout: source on left, target on right, path
   * nodes evenly spaced between, neighbors arranged radially around anchors.
   */
  useEffect(() => {
    if (!relationshipAnalysis || !selectedNode || !secondSelectedNode || !sigmaGraph || !sigma) return

    const graph = sigmaGraph
    if (!graph.hasNode(selectedNode) || !graph.hasNode(secondSelectedNode)) return

    const paths: string[][] = relationshipAnalysis.shortest_paths || []
    const primaryPath = paths[0] || [selectedNode, secondSelectedNode]

    // Moderate coordinate space -- path spans 10 units, neighbors at radius 3
    const PATH_LENGTH = 10
    const NEIGHBOR_RADIUS = 3
    const MAX_NEIGHBORS = 8
    const CENTER_Y = 0

    // Collect all path nodes across all shortest paths
    const pathNodeSet = new Set<string>()
    for (const path of paths) {
      for (const n of path) pathNodeSet.add(n)
    }

    // Position primary path nodes left-to-right
    const pathStep = PATH_LENGTH / Math.max(primaryPath.length - 1, 1)
    for (let i = 0; i < primaryPath.length; i++) {
      const nodeId = primaryPath[i]
      if (graph.hasNode(nodeId)) {
        graph.setNodeAttribute(nodeId, 'x', i * pathStep)
        graph.setNodeAttribute(nodeId, 'y', CENTER_Y)
      }
    }

    // Position neighbors in semicircles around the two anchors
    const positioned = new Set<string>(primaryPath)

    for (const anchor of [selectedNode, secondSelectedNode]) {
      if (!graph.hasNode(anchor)) continue
      const anchorX = graph.getNodeAttribute(anchor, 'x') as number
      const neighbors: string[] = []
      try {
        for (const n of graph.neighbors(anchor)) {
          if (!positioned.has(n) && !pathNodeSet.has(n)) neighbors.push(n)
        }
      } catch { /* ignore */ }

      if (neighbors.length === 0) continue
      const visible = neighbors.slice(0, MAX_NEIGHBORS)

      // Left anchor fans above/below on the left side; right anchor on the right
      const isLeft = anchor === selectedNode
      const baseAngle = isLeft ? Math.PI : 0
      const arcSpread = Math.PI * 0.7

      for (let i = 0; i < visible.length; i++) {
        const t = visible.length === 1 ? 0.5 : i / (visible.length - 1)
        const angle = baseAngle - arcSpread / 2 + arcSpread * t
        const nx = anchorX + Math.cos(angle) * NEIGHBOR_RADIUS
        const ny = CENTER_Y + Math.sin(angle) * NEIGHBOR_RADIUS
        if (graph.hasNode(visible[i])) {
          graph.setNodeAttribute(visible[i], 'x', nx)
          graph.setNodeAttribute(visible[i], 'y', ny)
          positioned.add(visible[i])
        }
      }
    }

    // Position alternate-path nodes slightly offset from the main axis
    for (const nodeId of pathNodeSet) {
      if (positioned.has(nodeId)) continue
      if (!graph.hasNode(nodeId)) continue
      graph.setNodeAttribute(nodeId, 'x', PATH_LENGTH * 0.3 + Math.random() * PATH_LENGTH * 0.4)
      graph.setNodeAttribute(nodeId, 'y', CENTER_Y + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random()))
      positioned.add(nodeId)
    }

    // Refresh graph rendering, then fit camera to visible nodes
    sigma.refresh()
    setTimeout(() => {
      const camera = sigma.getCamera()
      camera.animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 300 })
    }, 50)
  }, [relationshipAnalysis, selectedNode, secondSelectedNode, sigmaGraph, sigma])

  // Restore layout when exiting two-node mode
  useEffect(() => {
    if (!secondSelectedNode && sigmaGraph && sigma) {
      assignLayout()
      sigma.refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondSelectedNode])

  /**
   * When component mount
   * => register events
   */
  useEffect(() => {
    const { setFocusedNode, setSelectedNode, setFocusedEdge, setSelectedEdge, clearSelection } =
      useGraphStore.getState()

    // Define event types
    type NodeEvent = { node: string; event: { original: MouseEvent | TouchEvent } }
    type EdgeEvent = { edge: string; event: { original: MouseEvent | TouchEvent } }

    // Register all events, but edge events will only be processed if enableEdgeEvents is true
    const events: Record<string, any> = {
      enterNode: (event: NodeEvent) => {
        if (!isButtonPressed(event.event.original)) {
          const graph = sigma.getGraph()
          if (graph.hasNode(event.node)) {
            setFocusedNode(event.node)
          }
        }
      },
      leaveNode: (event: NodeEvent) => {
        if (!isButtonPressed(event.event.original)) {
          setFocusedNode(null)
        }
      },
      clickNode: (event: NodeEvent) => {
        const graph = sigma.getGraph()
        if (graph.hasNode(event.node)) {
          const mouseEvent = event.event.original as MouseEvent
          const currentSelected = useGraphStore.getState().selectedNode
          const hasAnalysis = useGraphStore.getState().relationshipAnalysis
          if (mouseEvent.shiftKey && currentSelected && currentSelected !== event.node) {
            useGraphStore.getState().setSecondSelectedNode(event.node)
          } else if (hasAnalysis) {
            // Don't disrupt active analysis on normal click
            return
          } else {
            setSelectedNode(event.node)
            useGraphStore.getState().setSecondSelectedNode(null)
            setSelectedEdge(null)
          }
        }
      },
      doubleClickNode: (event: NodeEvent) => {
        const graph = sigma.getGraph()
        if (graph.hasNode(event.node)) {
          const nodeId = event.node
          useGraphStore.getState().setGraphDataFetchAttempted(false)
          useGraphStore.getState().setLastSuccessfulQueryLabel('')
          useSettingsStore.getState().setQueryLabel(nodeId)
          useGraphStore.getState().incrementGraphDataVersion()
        }
      },
      clickStage: () => {
        // Don't clear if we have an active relationship analysis
        if (useGraphStore.getState().relationshipAnalysis) return
        clearSelection()
      }
    }

    // Only add edge event handlers if enableEdgeEvents is true
    if (enableEdgeEvents) {
      events.clickEdge = (event: EdgeEvent) => {
        setSelectedEdge(event.edge)
        setSelectedNode(null)
      }

      events.enterEdge = (event: EdgeEvent) => {
        if (!isButtonPressed(event.event.original)) {
          setFocusedEdge(event.edge)
        }
      }

      events.leaveEdge = (event: EdgeEvent) => {
        if (!isButtonPressed(event.event.original)) {
          setFocusedEdge(null)
        }
      }
    }

    // Register the events
    registerEvents(events)

    // Cleanup function - basic cleanup without relying on specific APIs
    return () => {
      try {
        console.log('Cleaning up graph event listeners')
      } catch (error) {
        console.warn('Error cleaning up graph event listeners:', error)
      }
    }
  }, [registerEvents, enableEdgeEvents, sigma])

  /**
   * When edge size settings change, recalculate edge sizes and refresh the sigma instance
   * to ensure changes take effect immediately
   */
  useEffect(() => {
    if (sigma && sigmaGraph) {
      // Get the graph from sigma
      const graph = sigma.getGraph()

      // Find min and max weight values
      let minWeight = Number.MAX_SAFE_INTEGER
      let maxWeight = 0

      graph.forEachEdge(edge => {
        // Get original weight (before scaling)
        const weight = graph.getEdgeAttribute(edge, 'originalWeight') || 1
        if (typeof weight === 'number') {
          minWeight = Math.min(minWeight, weight)
          maxWeight = Math.max(maxWeight, weight)
        }
      })

      // Scale edge sizes based on weight range and current min/max edge size settings
      const weightRange = maxWeight - minWeight
      if (weightRange > 0) {
        const sizeScale = maxEdgeSize - minEdgeSize
        graph.forEachEdge(edge => {
          const weight = graph.getEdgeAttribute(edge, 'originalWeight') || 1
          if (typeof weight === 'number') {
            const scaledSize = minEdgeSize + sizeScale * Math.pow((weight - minWeight) / weightRange, 0.5)
            graph.setEdgeAttribute(edge, 'size', scaledSize)
          }
        })
      } else {
        // If all weights are the same, use default size
        graph.forEachEdge(edge => {
          graph.setEdgeAttribute(edge, 'size', minEdgeSize)
        })
      }

      // Refresh the sigma instance to apply changes
      sigma.refresh()
    }
  }, [sigma, sigmaGraph, minEdgeSize, maxEdgeSize])


  /**
   * When component mount or hovered node change
   * => Setting the sigma reducers
   */
  useEffect(() => {
    // Check if dark mode is actually applied (handles both 'dark' theme and 'system' theme when OS is dark)
    const isDarkTheme = theme === 'dark' ||
      (theme === 'system' && window.document.documentElement.classList.contains('dark'))
    const labelColor = isDarkTheme ? Constants.labelColorDarkTheme : undefined
    const edgeColor = isDarkTheme ? Constants.edgeColorDarkTheme : undefined

    // Update all dynamic settings directly without recreating the sigma container
    setSettings({
      // Update display settings
      enableEdgeEvents,
      renderEdgeLabels,
      renderLabels,

      // Node reducer for node appearance
      nodeReducer: (node, data) => {
        const graph = sigma.getGraph()

        // Add defensive check for node existence during theme switching
        if (!graph.hasNode(node)) {
          console.warn(`Node ${node} not found in graph during theme switch, returning default data`)
          return { ...data, highlighted: false, labelColor }
        }

        // Hide nodes whose entity_type is in hiddenTypes
        if (hiddenTypes.size > 0) {
          const nodeType = graph.getNodeAttribute(node, 'entity_type') as string
          if (nodeType && hiddenTypes.has(nodeType)) {
            return { ...data, hidden: true, labelColor }
          }
        }

        const newData: NodeType & {
          labelColor?: string
          borderColor?: string
        } = { ...data, highlighted: data.highlighted || false, labelColor }

        if (!disableHoverEffect) {
          newData.highlighted = false
          const _focusedNode = focusedNode || selectedNode
          const _focusedEdge = focusedEdge || selectedEdge

          // Two-node analysis mode: show only path + immediate context, hide everything else
          if (selectedNode && secondSelectedNode && !focusedNode && !focusedEdge) {
            // Build the set of visible nodes: path + direct neighbors of path nodes
            const pathNodes = new Set<string>([selectedNode, secondSelectedNode])
            if (relationshipAnalysis?.shortest_paths) {
              for (const path of relationshipAnalysis.shortest_paths) {
                for (const n of path) pathNodes.add(n)
              }
            }

            // Only include direct neighbors of the two selected nodes (not all path nodes)
            const contextNodes = new Set<string>()
            for (const anchor of [selectedNode, secondSelectedNode]) {
              if (graph.hasNode(anchor)) {
                try {
                  for (const neighbor of graph.neighbors(anchor)) {
                    contextNodes.add(neighbor)
                  }
                } catch { /* ignore */ }
              }
            }

            if (node === selectedNode) {
              newData.highlighted = true
              newData.borderColor = Constants.nodeBorderColorSelected
            } else if (node === secondSelectedNode) {
              newData.highlighted = true
              newData.borderColor = '#F59E0B'
            } else if (pathNodes.has(node)) {
              newData.highlighted = true
            } else if (contextNodes.has(node)) {
              newData.highlighted = false
            } else {
              return { ...data, hidden: true, labelColor }
            }
          } else if (_focusedNode && graph.hasNode(_focusedNode)) {
            try {
              if (node === _focusedNode || graph.neighbors(_focusedNode).includes(node)) {
                newData.highlighted = true
                if (node === selectedNode) {
                  newData.borderColor = Constants.nodeBorderColorSelected
                }
                if (node === secondSelectedNode) {
                  newData.borderColor = '#F59E0B'
                }
              }
            } catch (error) {
              console.error('Error in nodeReducer:', error);
              return { ...data, highlighted: false, labelColor }
            }
          } else if (_focusedEdge && graph.hasEdge(_focusedEdge)) {
            try {
              if (graph.extremities(_focusedEdge).includes(node)) {
                newData.highlighted = true
                newData.size = 3
              }
            } catch (error) {
              console.error('Error accessing edge extremities in nodeReducer:', error);
              return { ...data, highlighted: false, labelColor }
            }
          } else {
            return newData
          }

          if (newData.highlighted) {
            if (isDarkTheme) {
              newData.labelColor = Constants.LabelColorHighlightedDarkTheme
            }
          } else {
            newData.color = Constants.nodeColorDisabled
          }
        }
        return newData
      },

      // Edge reducer for edge appearance
      edgeReducer: (edge, data) => {
        const graph = sigma.getGraph()

        // Add defensive check for edge existence during theme switching
        if (!graph.hasEdge(edge)) {
          console.warn(`Edge ${edge} not found in graph during theme switch, returning default data`)
          return { ...data, hidden: false, labelColor, color: edgeColor }
        }

        // Hide edges connected to hidden-type nodes
        if (hiddenTypes.size > 0) {
          try {
            const [source, target] = graph.extremities(edge)
            const sourceType = graph.getNodeAttribute(source, 'entity_type') as string
            const targetType = graph.getNodeAttribute(target, 'entity_type') as string
            if ((sourceType && hiddenTypes.has(sourceType)) || (targetType && hiddenTypes.has(targetType))) {
              return { ...data, hidden: true, labelColor, color: edgeColor }
            }
          } catch (e) { /* ignore */ }
        }

        const newData = { ...data, hidden: false, labelColor, color: edgeColor }

        if (!disableHoverEffect) {
          const _focusedNode = focusedNode || selectedNode
          // Choose edge highlight color based on theme
          const edgeHighlightColor = isDarkTheme
            ? Constants.edgeColorHighlightedDarkTheme
            : Constants.edgeColorHighlightedLightTheme

          // Two-node analysis mode: show only edges connecting visible nodes
          if (selectedNode && secondSelectedNode && !focusedNode && !focusedEdge) {
            try {
              const [source, target] = graph.extremities(edge)
              const pathNodes = new Set<string>([selectedNode, secondSelectedNode])
              if (relationshipAnalysis?.shortest_paths) {
                for (const path of relationshipAnalysis.shortest_paths) {
                  for (const n of path) pathNodes.add(n)
                }
              }

              // Visible nodes: path + direct neighbors of the two anchors
              const visibleNodes = new Set<string>(pathNodes)
              for (const anchor of [selectedNode, secondSelectedNode]) {
                if (graph.hasNode(anchor)) {
                  try {
                    for (const neighbor of graph.neighbors(anchor)) {
                      visibleNodes.add(neighbor)
                    }
                  } catch { /* ignore */ }
                }
              }

              const sourceVisible = visibleNodes.has(source)
              const targetVisible = visibleNodes.has(target)

              if (!sourceVisible || !targetVisible) {
                newData.hidden = true
              } else if (pathNodes.has(source) && pathNodes.has(target)) {
                newData.color = '#F59E0B'
              } else if (pathNodes.has(source) || pathNodes.has(target)) {
                newData.color = edgeHighlightColor
              }
            } catch { /* ignore */ }
          } else if (_focusedNode && graph.hasNode(_focusedNode)) {
            try {
              if (hideUnselectedEdges) {
                if (!graph.extremities(edge).includes(_focusedNode)) {
                  newData.hidden = true
                }
              } else {
                if (graph.extremities(edge).includes(_focusedNode)) {
                  newData.color = edgeHighlightColor
                }
              }
            } catch (error) {
              console.error('Error in edgeReducer:', error);
              return { ...data, hidden: false, labelColor, color: edgeColor }
            }
          } else {
            const _selectedEdge = selectedEdge && graph.hasEdge(selectedEdge) ? selectedEdge : null;
            const _focusedEdge = focusedEdge && graph.hasEdge(focusedEdge) ? focusedEdge : null;

            if (_selectedEdge || _focusedEdge) {
              if (edge === _selectedEdge) {
                newData.color = Constants.edgeColorSelected
              } else if (edge === _focusedEdge) {
                newData.color = edgeHighlightColor
              } else if (hideUnselectedEdges) {
                newData.hidden = true
              }
            }
          }
        }
        return newData
      }
    })
  }, [
    selectedNode,
    secondSelectedNode,
    relationshipAnalysis,
    focusedNode,
    selectedEdge,
    focusedEdge,
    setSettings,
    sigma,
    disableHoverEffect,
    theme,
    systemThemeIsDark,
    hideUnselectedEdges,
    enableEdgeEvents,
    renderEdgeLabels,
    renderLabels,
    hiddenTypes
  ])

  return null
}

export default GraphControl
