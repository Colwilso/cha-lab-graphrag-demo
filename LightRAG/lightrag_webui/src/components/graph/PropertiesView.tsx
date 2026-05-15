import { useMemo } from 'react'
import { useGraphStore, RawNodeType, RawEdgeType } from '@/stores/graph'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import useLightragGraph from '@/hooks/useLightragGraph'
import { useTranslation } from 'react-i18next'
import { GitBranchPlus, Scissors, ExternalLink } from 'lucide-react'
import EditablePropertyRow from './EditablePropertyRow'
import RelationshipView from './RelationshipPanel'

const PAPER_URLS: Record<string, string> = {
  "Sex-biased islet β cell dysfunction is caused by the MODY MAFA S64F variant by inducing premature aging and senescence in males.": "https://pubmed.ncbi.nlm.nih.gov/34644565/",
  "Defining unique structural features in the MAFA and MAFB transcription factors that control Insulin gene activity.": "https://pubmed.ncbi.nlm.nih.gov/39476962/",
  "Genetic background influences the phenotypic penetrance by MAFA (S64F) MODY in male mice.": "https://pubmed.ncbi.nlm.nih.gov/40475642/",
  "Developmental control of DNA damage responses in α- and β-cells shapes the selective beta-cell susceptibility in diabetes.": "https://pubmed.ncbi.nlm.nih.gov/41292712/",
  "Nucleolar stress facilitates islet β cell senescence via hijacking the DNA damage response pathways.": "https://pubmed.ncbi.nlm.nih.gov/41031371/",
  "The role of the beta cell in type 2 diabetes: new findings from the last 5 years.": "https://pubmed.ncbi.nlm.nih.gov/40768044/",
  "Sex-specific regulatory architecture of pancreatic islets from subjects with and without type 2 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/39567827/",
  "Calorie restriction increases insulin sensitivity to promote beta cell homeostasis and longevity in mice.": "https://pubmed.ncbi.nlm.nih.gov/39433757/",
  "Safeguarding genomic integrity in beta-cells: implications for beta-cell differentiation, growth, and dysfunction.": "https://pubmed.ncbi.nlm.nih.gov/39364746/",
  "Exploring senescence as a modifier of β cell extracellular vesicles in type 1 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/39239092/",
  "Single cell regulatory architecture of human pancreatic islets suggests sex differences in β cell function and the pathogenesis of type 2 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/39011095/",
  "SenNet recommendations for detecting senescent cells in different tissues.": "https://pubmed.ncbi.nlm.nih.gov/38831121/",
  "Stress-induced β cell early senescence confers protection against type 1 diabetes.": "https://pubmed.ncbi.nlm.nih.gov/37949065/",
  "Exploring Large MAF Transcription Factors: Functions, Pathology, and Mouse Models with Point Mutations.": "https://pubmed.ncbi.nlm.nih.gov/37895232/",
  "Pancreatic β-cell senescence in diabetes: mechanisms, markers and therapies.": "https://pubmed.ncbi.nlm.nih.gov/37720527/",
  "Species-specific roles for the MAFA and MAFB transcription factors in regulating islet β cell identity.": "https://pubmed.ncbi.nlm.nih.gov/37606041/",
  "MafA is a dedicated activator of the insulin gene in vivo.": "https://pubmed.ncbi.nlm.nih.gov/18515495/",
  "Members of the large Maf transcription family regulate insulin gene transcription in islet beta cells.": "https://pubmed.ncbi.nlm.nih.gov/12917329/",
  "MafA and MafB regulate genes critical to beta-cells in a unique temporal manner.": "https://pubmed.ncbi.nlm.nih.gov/20627934/",
  "A switch from MafB to MafA expression accompanies differentiation to pancreatic beta-cells.": "https://pubmed.ncbi.nlm.nih.gov/16580660/",
  "The MafA transcription factor becomes essential to islet β-cells soon after birth.": "https://pubmed.ncbi.nlm.nih.gov/24520122/",
  "Examining How the MAFB Transcription Factor Affects Islet β-Cell Function Postnatally.": "https://pubmed.ncbi.nlm.nih.gov/30425060/",
  "The MAFB transcription factor impacts islet α-cell function in rodents and represents a unique signature of primate islet β-cells.": "https://pubmed.ncbi.nlm.nih.gov/26554594/",
  "MafB Is Important for Pancreatic β-Cell Maintenance under a MafA-Deficient Condition.": "https://pubmed.ncbi.nlm.nih.gov/31208980/",
  "MAFA missense mutation causes familial insulinomatosis and diabetes mellitus.": "https://pubmed.ncbi.nlm.nih.gov/29339498/",
}

function findPaperUrl(title: string): string | null {
  if (PAPER_URLS[title]) return PAPER_URLS[title]
  const lower = title.toLowerCase()
  for (const [key, url] of Object.entries(PAPER_URLS)) {
    if (key.toLowerCase().startsWith(lower.substring(0, 40))) return url
  }
  return null
}

const SourceRow = ({ title }: { title: string }) => {
  const url = findPaperUrl(title)
  return (
    <div className="py-1.5 px-2 flex items-start gap-2">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline leading-snug flex items-start gap-1"
        >
          <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{title}</span>
        </a>
      ) : (
        <span className="text-xs leading-snug">{title}</span>
      )}
    </div>
  )
}

/**
 * Component that view properties of elements in graph.
 */
const PropertiesView = () => {
  const { getNode, getEdge } = useLightragGraph()
  const selectedNode = useGraphStore.use.selectedNode()
  const secondSelectedNode = useGraphStore.use.secondSelectedNode()
  const focusedNode = useGraphStore.use.focusedNode()
  const selectedEdge = useGraphStore.use.selectedEdge()
  const focusedEdge = useGraphStore.use.focusedEdge()
  const graphDataVersion = useGraphStore.use.graphDataVersion()

  const { currentElement, currentType } = useMemo(() => {
    let type: 'node' | 'edge' | null = null
    let element: RawNodeType | RawEdgeType | null = null
    if (focusedNode) {
      type = 'node'
      element = getNode(focusedNode)
    } else if (selectedNode) {
      type = 'node'
      element = getNode(selectedNode)
    } else if (focusedEdge) {
      type = 'edge'
      element = getEdge(focusedEdge, true)
    } else if (selectedEdge) {
      type = 'edge'
      element = getEdge(selectedEdge, true)
    }

    if (element) {
      return {
        currentElement: type === 'node'
          ? refineNodeProperties(element as any)
          : refineEdgeProperties(element as any),
        currentType: type
      }
    }
    return { currentElement: null, currentType: null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNode, selectedNode, focusedEdge, selectedEdge, graphDataVersion, getNode, getEdge])

  if (selectedNode && secondSelectedNode) {
    return (
      <div className="w-full h-full p-4 text-xs overflow-auto">
        <RelationshipView />
      </div>
    )
  }

  if (!currentElement) {
    return <></>
  }
  return (
    <div className="w-full h-full p-4 text-xs">
      {currentType == 'node' ? (
        <NodePropertiesView node={currentElement as any} />
      ) : (
        <EdgePropertiesView edge={currentElement as any} />
      )}
    </div>
  )
}

type NodeType = RawNodeType & {
  relationships: {
    type: string
    id: string
    label: string
  }[]
}

type EdgeType = RawEdgeType & {
  sourceNode?: RawNodeType
  targetNode?: RawNodeType
}

const refineNodeProperties = (node: RawNodeType): NodeType => {
  const state = useGraphStore.getState()
  const relationships: { type: string; id: string; label: string }[] = []

  if (state.sigmaGraph && state.rawGraph) {
    try {
      if (!state.sigmaGraph.hasNode(node.id)) {
        console.warn('Node not found in sigmaGraph:', node.id)
        return { ...node, relationships: [] }
      }

      const edges = state.sigmaGraph.edges(node.id)

      for (const edgeId of edges) {
        if (!state.sigmaGraph.hasEdge(edgeId)) continue

        const edge = state.rawGraph.getEdge(edgeId, true)
        if (edge) {
          const isTarget = node.id === edge.source
          const neighbourId = isTarget ? edge.target : edge.source

          if (!state.sigmaGraph.hasNode(neighbourId)) continue

          const neighbour = state.rawGraph.getNode(neighbourId)
          if (neighbour) {
            const degree = state.sigmaGraph.degree(neighbourId)
            const entityType = neighbour.properties?.entity_type || ''
            const name = neighbour.properties?.entity_id || neighbour.labels.join(', ')
            relationships.push({
              type: `${entityType} (${degree})`,
              id: neighbourId,
              label: name
            })
          }
        }
      }

      // Sort by degree (extracted from type string) descending
      relationships.sort((a, b) => {
        const degA = parseInt(a.type.match(/\((\d+)\)/)?.[1] || '0')
        const degB = parseInt(b.type.match(/\((\d+)\)/)?.[1] || '0')
        return degB - degA
      })
    } catch (error) {
      console.error('Error refining node properties:', error)
    }
  }

  return { ...node, relationships }
}

const refineEdgeProperties = (edge: RawEdgeType): EdgeType => {
  const state = useGraphStore.getState()
  let sourceNode: RawNodeType | undefined = undefined
  let targetNode: RawNodeType | undefined = undefined

  if (state.sigmaGraph && state.rawGraph) {
    try {
      if (!state.sigmaGraph.hasEdge(edge.dynamicId)) {
        console.warn('Edge not found in sigmaGraph:', edge.id, 'dynamicId:', edge.dynamicId)
        return {
          ...edge,
          sourceNode: undefined,
          targetNode: undefined
        }
      }

      if (state.sigmaGraph.hasNode(edge.source)) {
        sourceNode = state.rawGraph.getNode(edge.source)
      }

      if (state.sigmaGraph.hasNode(edge.target)) {
        targetNode = state.rawGraph.getNode(edge.target)
      }
    } catch (error) {
      console.error('Error refining edge properties:', error)
    }
  }

  return {
    ...edge,
    sourceNode,
    targetNode
  }
}

const PropertyRow = ({
  name,
  value,
  onClick,
  tooltip,
  nodeId,
  edgeId,
  dynamicId,
  entityId,
  entityType,
  sourceId,
  targetId,
  isEditable = false,
  truncate
}: {
  name: string
  value: any
  onClick?: () => void
  tooltip?: string
  nodeId?: string
  entityId?: string
  edgeId?: string
  dynamicId?: string
  entityType?: 'node' | 'edge'
  sourceId?: string
  targetId?: string
  isEditable?: boolean
  truncate?: string
}) => {
  const { t } = useTranslation()

  const getPropertyNameTranslation = (name: string) => {
    const translationKey = `graphPanel.propertiesView.node.propertyNames.${name}`
    const translation = t(translationKey)
    return translation === translationKey ? name : translation
  }

  // Utility function to convert <SEP> to newlines
  const formatValueWithSeparators = (value: any): string => {
    if (typeof value === 'string') {
      return value.replace(/<SEP>/g, ';\n')
    }
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  }

  // Format the value to convert <SEP> to newlines
  const formattedValue = formatValueWithSeparators(value)
  let formattedTooltip = tooltip || formatValueWithSeparators(value)

  // If this is source_id field and truncate info exists, append it to the tooltip
  if (name === 'source_id' && truncate) {
    formattedTooltip += `\n(Truncated: ${truncate})`
  }

  // Use EditablePropertyRow for editable fields (description, entity_id and entity_type)
  if (isEditable && (name === 'description' || name === 'entity_id' || name === 'entity_type'  || name === 'keywords')) {
    return (
      <EditablePropertyRow
        name={name}
        value={value}
        onClick={onClick}
        nodeId={nodeId}
        entityId={entityId}
        edgeId={edgeId}
        dynamicId={dynamicId}
        entityType={entityType}
        sourceId={sourceId}
        targetId={targetId}
        isEditable={true}
        tooltip={tooltip || (typeof value === 'string' ? value : JSON.stringify(value, null, 2))}
      />
    )
  }

  // For non-editable fields, use the regular Text component
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary/60 tracking-wide whitespace-nowrap">
        {getPropertyNameTranslation(name)}
        {name === 'source_id' && truncate && <sup className="text-red-500">†</sup>}
      </span>:
      <Text
        className="hover:bg-primary/20 rounded p-1 overflow-hidden text-ellipsis"
        tooltipClassName="max-w-96 -translate-x-13"
        text={formattedValue}
        tooltip={formattedTooltip}
        side="left"
        onClick={onClick}
      />
    </div>
  )
}

const NodePropertiesView = ({ node }: { node: NodeType }) => {
  const { t } = useTranslation()

  const handleExpandNode = () => {
    useGraphStore.getState().triggerNodeExpand(node.id)
  }

  const handlePruneNode = () => {
    useGraphStore.getState().triggerNodePrune(node.id)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <h3 className="text-md pl-1 font-bold tracking-wide text-blue-700">{t('graphPanel.propertiesView.node.title')}</h3>
        <div className="flex gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 border border-gray-400 hover:bg-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            onClick={handleExpandNode}
            tooltip={t('graphPanel.propertiesView.node.expandNode')}
          >
            <GitBranchPlus className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 border border-gray-400 hover:bg-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            onClick={handlePruneNode}
            tooltip={t('graphPanel.propertiesView.node.pruneNode')}
          >
            <Scissors className="h-4 w-4 text-gray-900 dark:text-gray-300" />
          </Button>
        </div>
      </div>
      <div className="bg-primary/5 max-h-96 overflow-auto rounded p-1">
        <PropertyRow name={t('graphPanel.propertiesView.node.id')} value={String(node.id)} />
        <PropertyRow
          name={t('graphPanel.propertiesView.node.labels')}
          value={node.labels.join(', ')}
          onClick={() => {
            useGraphStore.getState().setSelectedNode(node.id, true)
          }}
        />
        <PropertyRow name={t('graphPanel.propertiesView.node.degree')} value={node.degree} />
      </div>
      <h3 className="text-md pl-1 font-bold tracking-wide text-amber-700">{t('graphPanel.propertiesView.node.properties')}</h3>
      <div className="bg-primary/5 rounded p-1">
        {Object.keys(node.properties)
          .sort()
          .filter((name) => name !== 'created_at' && name !== 'truncate' && name !== 'description' && name !== 'source_id' && name !== 'file_path')
          .map((name) => {
            return (
              <PropertyRow
                key={name}
                name={name}
                value={node.properties[name]}
                nodeId={String(node.id)}
                entityId={node.properties['entity_id']}
                entityType="node"
                isEditable={name === 'entity_id' || name === 'entity_type'}
                truncate={node.properties['truncate']}
              />
            )
          })}
      </div>
      {node.properties.description && (
        <>
          <h3 className="text-md pl-1 font-bold tracking-wide text-amber-700">Description</h3>
          <div className="bg-primary/5 rounded p-2 text-xs leading-relaxed whitespace-pre-wrap break-words max-h-[40vh] overflow-y-auto">
            {String(node.properties.description).split('<SEP>')[0]}
          </div>
        </>
      )}
      {node.properties.file_path && (
        <>
          <h3 className="text-md pl-1 font-bold tracking-wide text-blue-700">Sources</h3>
          <div className="bg-primary/5 rounded p-1 flex flex-col divide-y divide-border/50">
            {String(node.properties.file_path).split('<SEP>').filter(s => s.trim()).map((title, i) => (
              <SourceRow key={i} title={title.trim()} />
            ))}
          </div>
        </>
      )}
      {node.relationships.length > 0 && (
        <>
          <h3 className="text-md pl-1 font-bold tracking-wide text-emerald-700">
            {t('graphPanel.propertiesView.node.relationships')}
          </h3>
          <div className="bg-primary/5 max-h-96 overflow-auto rounded p-1">
            {node.relationships.map(({ type, id, label }) => {
              return (
                <PropertyRow
                  key={id}
                  name={type}
                  value={label}
                  onClick={() => {
                    useGraphStore.getState().setSelectedNode(id, true)
                  }}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

const EdgePropertiesView = ({ edge }: { edge: EdgeType }) => {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-md pl-1 font-bold tracking-wide text-violet-700">{t('graphPanel.propertiesView.edge.title')}</h3>
      <div className="bg-primary/5 max-h-96 overflow-auto rounded p-1">
        <PropertyRow name={t('graphPanel.propertiesView.edge.id')} value={edge.id} />
        {edge.type && <PropertyRow name={t('graphPanel.propertiesView.edge.type')} value={edge.type} />}
        <PropertyRow
          name={t('graphPanel.propertiesView.edge.source')}
          value={edge.sourceNode ? edge.sourceNode.labels.join(', ') : edge.source}
          onClick={() => {
            useGraphStore.getState().setSelectedNode(edge.source, true)
          }}
        />
        <PropertyRow
          name={t('graphPanel.propertiesView.edge.target')}
          value={edge.targetNode ? edge.targetNode.labels.join(', ') : edge.target}
          onClick={() => {
            useGraphStore.getState().setSelectedNode(edge.target, true)
          }}
        />
      </div>
      <h3 className="text-md pl-1 font-bold tracking-wide text-amber-700">{t('graphPanel.propertiesView.edge.properties')}</h3>
      <div className="bg-primary/5 max-h-96 overflow-auto rounded p-1">
        {Object.keys(edge.properties)
          .sort()
          .map((name) => {
            if (name === 'created_at' || name === 'truncate') return null; // Hide created_at and truncate properties
            return (
              <PropertyRow
                key={name}
                name={name}
                value={edge.properties[name]}
                edgeId={String(edge.id)}
                dynamicId={String(edge.dynamicId)}
                entityType="edge"
                sourceId={edge.sourceNode?.properties['entity_id'] || edge.source}
                targetId={edge.targetNode?.properties['entity_id'] || edge.target}
                isEditable={name === 'description' || name === 'keywords'}
                truncate={edge.properties['truncate']}
              />
            )
          })}
      </div>
    </div>
  )
}

export default PropertiesView
