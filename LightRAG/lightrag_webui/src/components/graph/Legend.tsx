import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGraphStore } from '@/stores/graph'
import { Card } from '@/components/ui/Card'
import { ScrollArea } from '@/components/ui/ScrollArea'

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  biologicalprocess: 'Biological Process',
  celltype: 'Cell Type',
  naturalobject: 'Tissue',
  creature: 'Organism',
  concept: 'Biological Process',
  artifact: 'Method',
  content: 'Data',
  location: 'Tissue',
  event: 'Process',
  unknown: 'Other',
  gene: 'Gene',
  protein: 'Protein',
  mutation: 'Mutation',
  disease: 'Disease',
  pathway: 'Pathway',
  organism: 'Organism',
  tissue: 'Tissue',
  method: 'Method',
  drug: 'Drug',
  molecule: 'Molecule',
  phenotype: 'Phenotype',
  data: 'Data',
  person: 'Person',
  organization: 'Organization',
  other: 'Other',
}

function displayTypeName(type: string): string {
  const lower = type.toLowerCase()
  if (TYPE_DISPLAY_NAMES[lower]) return TYPE_DISPLAY_NAMES[lower]
  // Convert camelCase/PascalCase to spaced title case
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, s => s.toUpperCase())
}

interface LegendProps {
  className?: string
}

const Legend: React.FC<LegendProps> = ({ className }) => {
  const { t } = useTranslation()
  const typeColorMap = useGraphStore.use.typeColorMap()
  const hiddenTypes = useGraphStore.use.hiddenTypes()
  const toggleHiddenType = useGraphStore.getState().toggleHiddenType
  const setHiddenTypes = useGraphStore.getState().setHiddenTypes

  const handleClick = useCallback((type: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+click: solo this type (hide all others)
      const allTypes = Array.from(typeColorMap.keys())
      if (hiddenTypes.size === allTypes.length - 1 && !hiddenTypes.has(type)) {
        // If already solo'd on this type, show all
        setHiddenTypes(new Set())
      } else {
        const newHidden = new Set(allTypes.filter(t => t !== type))
        setHiddenTypes(newHidden)
      }
    } else {
      toggleHiddenType(type)
    }
  }, [typeColorMap, hiddenTypes, toggleHiddenType, setHiddenTypes])

  const handleShowAll = useCallback(() => {
    setHiddenTypes(new Set())
  }, [setHiddenTypes])

  // Deduplicate types that share the same display name
  const deduplicatedTypes = useMemo(() => {
    if (!typeColorMap || typeColorMap.size === 0) return []
    const seen = new Map<string, { rawTypes: string[], color: string }>()
    for (const [type, color] of typeColorMap.entries()) {
      const displayName = displayTypeName(type)
      if (!seen.has(displayName)) {
        seen.set(displayName, { rawTypes: [type], color })
      } else {
        seen.get(displayName)!.rawTypes.push(type)
      }
    }
    return Array.from(seen.entries()).map(([displayName, { rawTypes, color }]) => ({
      displayName, rawTypes, color
    }))
  }, [typeColorMap])

  if (!typeColorMap || typeColorMap.size === 0) {
    return null
  }

  return (
    <Card className={`p-2 max-w-xs ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">{t('graphPanel.legend')}</h3>
        {hiddenTypes.size > 0 && (
          <button
            onClick={handleShowAll}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Show all
          </button>
        )}
      </div>
      <ScrollArea className="max-h-80">
        <div className="flex flex-col gap-0.5">
          {deduplicatedTypes.map(({ displayName, rawTypes, color }) => {
            const isHidden = rawTypes.every(t => hiddenTypes.has(t))
            return (
              <div
                key={displayName}
                className={`flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer hover:bg-accent transition-opacity ${isHidden ? 'opacity-30' : ''}`}
                onClick={(e) => {
                  // Toggle all raw types that map to this display name
                  rawTypes.forEach(t => {
                    if (e.shiftKey) {
                      // Handled below
                    } else {
                      toggleHiddenType(t)
                    }
                  })
                  if (e.shiftKey) {
                    // Solo: hide everything except these raw types
                    const allRawTypes = deduplicatedTypes.flatMap(d => d.rawTypes)
                    if (isHidden || !rawTypes.every(t => !hiddenTypes.has(t))) {
                      setHiddenTypes(new Set(allRawTypes.filter(t => !rawTypes.includes(t))))
                    } else {
                      const othersHidden = allRawTypes.filter(t => !rawTypes.includes(t)).every(t => hiddenTypes.has(t))
                      if (othersHidden) {
                        setHiddenTypes(new Set())
                      } else {
                        setHiddenTypes(new Set(allRawTypes.filter(t => !rawTypes.includes(t))))
                      }
                    }
                  }
                }}
                title={`Click to ${isHidden ? 'show' : 'hide'}. Shift+click to solo.`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: isHidden ? '#666' : color }}
                />
                <span className={`text-xs truncate ${isHidden ? 'line-through' : ''}`} title={displayName}>
                  {displayName}
                </span>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      {hiddenTypes.size > 0 && (
        <div className="text-[10px] text-muted-foreground mt-1 px-1">
          {hiddenTypes.size} type{hiddenTypes.size > 1 ? 's' : ''} hidden
        </div>
      )}
    </Card>
  )
}

export default Legend
