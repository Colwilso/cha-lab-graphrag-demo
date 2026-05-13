import { useSigma } from '@react-sigma/core'
import { animateNodes } from 'sigma/utils'
import { useLayoutCirclepack } from '@react-sigma/layout-circlepack'
import { useLayoutCircular } from '@react-sigma/layout-circular'
import { LayoutHook, LayoutWorkerHook, WorkerLayoutControlProps } from '@react-sigma/layout-core'
import { useLayoutForce, useWorkerLayoutForce } from '@react-sigma/layout-force'
import { useLayoutForceAtlas2, useWorkerLayoutForceAtlas2 } from '@react-sigma/layout-forceatlas2'
import { useLayoutNoverlap, useWorkerLayoutNoverlap } from '@react-sigma/layout-noverlap'
import { useLayoutRandom } from '@react-sigma/layout-random'
import { useCallback, useMemo, useState, useEffect, useRef } from 'react'

import Button from '@/components/ui/Button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/Command'
import { controlButtonVariant } from '@/lib/constants'
import { useSettingsStore } from '@/stores/settings'

import { GripIcon, PlayIcon, PauseIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type LayoutName =
  | 'Circular'
  | 'Circlepack'
  | 'Random'
  | 'Noverlaps'
  | 'Force Directed'
  | 'Force Atlas'

// Extend WorkerLayoutControlProps to include mainLayout
interface ExtendedWorkerLayoutControlProps extends WorkerLayoutControlProps {
  mainLayout: LayoutHook;
}

const WorkerLayoutControl = ({ layout, autoRunFor, mainLayout }: ExtendedWorkerLayoutControlProps) => {
  const sigma = useSigma()
  const [isRunning, setIsRunning] = useState(false)
  const animationTimerRef = useRef<number | null>(null)
  const { t } = useTranslation()

  const updatePositions = useCallback(() => {
    try {
      const graph = sigma.getGraph()
      if (!graph || graph.order === 0) return
      const { positions } = mainLayout
      const pos = positions()
      animateNodes(graph, pos, { duration: 150 })
    } catch (error) {
      console.error('Error updating positions:', error)
      if (animationTimerRef.current) {
        window.clearInterval(animationTimerRef.current)
        animationTimerRef.current = null
      }
      setIsRunning(false)
    }
  }, [sigma, mainLayout])

  const handleClick = useCallback(() => {
    if (isRunning) {
      console.log('Stopping layout animation')
      if (animationTimerRef.current) {
        window.clearInterval(animationTimerRef.current)
        animationTimerRef.current = null
      }
      try {
        if (typeof layout.kill === 'function') {
          layout.kill()
        } else if (typeof layout.stop === 'function') {
          layout.stop()
        }
      } catch (error) {
        console.error('Error stopping layout algorithm:', error)
      }
      setIsRunning(false)
    } else {
      console.log('Starting layout animation')
      updatePositions()
      animationTimerRef.current = window.setInterval(() => {
        updatePositions()
      }, 200)
      setIsRunning(true)
    }
  }, [isRunning, layout, updatePositions])

  useEffect(() => {
    let timeout: number | undefined

    if (autoRunFor !== undefined && autoRunFor > -1 && sigma.getGraph().order > 0) {
      console.log('Auto-starting layout animation')
      updatePositions()
      animationTimerRef.current = window.setInterval(() => {
        updatePositions()
      }, 200)
      setIsRunning(true)

      if (autoRunFor > 0) {
        timeout = window.setTimeout(() => {
          console.log('Auto-stopping layout animation after timeout')
          if (animationTimerRef.current) {
            window.clearInterval(animationTimerRef.current)
            animationTimerRef.current = null
          }
          setIsRunning(false)
        }, autoRunFor)
      }
    }

    return () => {
      if (animationTimerRef.current) {
        window.clearInterval(animationTimerRef.current)
        animationTimerRef.current = null
      }
      if (timeout) {
        window.clearTimeout(timeout)
      }
      setIsRunning(false)
    }
  }, [autoRunFor, sigma, updatePositions])

  return (
    <Button
      size="icon"
      onClick={handleClick}
      tooltip={isRunning ? t('graphPanel.sideBar.layoutsControl.stopAnimation') : t('graphPanel.sideBar.layoutsControl.startAnimation')}
      variant={controlButtonVariant}
    >
      {isRunning ? <PauseIcon /> : <PlayIcon />}
    </Button>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

const ParamSlider = ({ label, value, min, max, step, onChange }: SliderProps) => (
  <div className="flex flex-col gap-0.5 px-2 py-1">
    <div className="flex justify-between text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span>{value.toFixed(step < 1 ? Math.max(2, -Math.floor(Math.log10(step))) : 0)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 accent-primary cursor-pointer"
    />
  </div>
)

/**
 * Component that controls the layout of the graph with parameter sliders.
 */
const LayoutsControl = () => {
  const sigma = useSigma()
  const { t } = useTranslation()
  const [layout, setLayout] = useState<LayoutName>('Force Atlas')
  const [opened, setOpened] = useState<boolean>(false)
  const [slidersOpen, setSlidersOpen] = useState<boolean>(false)

  // Force layout params
  const [forceRepulsion, setForceRepulsion] = useState(0.15)
  const [forceAttraction, setForceAttraction] = useState(0.0001)
  const [forceGravity, setForceGravity] = useState(0.005)

  // ForceAtlas2 params
  const [fa2Gravity, setFa2Gravity] = useState(1.0)
  const [fa2ScalingRatio, setFa2ScalingRatio] = useState(80)
  const [fa2SlowDown, setFa2SlowDown] = useState(5)

  const maxIterations = useSettingsStore.use.graphLayoutMaxIterations()

  const layoutCircular = useLayoutCircular()
  const layoutCirclepack = useLayoutCirclepack()
  const layoutRandom = useLayoutRandom()
  const layoutNoverlap = useLayoutNoverlap({
    maxIterations: maxIterations,
    settings: {
      margin: 5,
      expansion: 1.1,
      gridSize: 1,
      ratio: 1,
      speed: 3,
    }
  })
  const layoutForce = useLayoutForce({
    maxIterations: maxIterations,
    settings: {
      attraction: forceAttraction,
      repulsion: forceRepulsion,
      gravity: forceGravity,
      inertia: 0.4,
      maxMove: 200
    }
  })
  const layoutForceAtlas2 = useLayoutForceAtlas2({
    iterations: maxIterations * 2,
    settings: {
      gravity: fa2Gravity,
      scalingRatio: fa2ScalingRatio,
      barnesHutOptimize: true,
      barnesHutTheta: 0.5,
      strongGravityMode: false,
      slowDown: fa2SlowDown,
      adjustSizes: true,
    }
  })
  const workerNoverlap = useWorkerLayoutNoverlap()
  const workerForce = useWorkerLayoutForce()
  const workerForceAtlas2 = useWorkerLayoutForceAtlas2()

  const layouts = useMemo(() => {
    return {
      Circular: {
        layout: layoutCircular
      },
      Circlepack: {
        layout: layoutCirclepack
      },
      Random: {
        layout: layoutRandom
      },
      Noverlaps: {
        layout: layoutNoverlap,
        worker: workerNoverlap
      },
      'Force Directed': {
        layout: layoutForce,
        worker: workerForce
      },
      'Force Atlas': {
        layout: layoutForceAtlas2,
        worker: workerForceAtlas2
      }
    } as { [key: string]: { layout: LayoutHook; worker?: LayoutWorkerHook } }
  }, [
    layoutCirclepack,
    layoutCircular,
    layoutForce,
    layoutForceAtlas2,
    layoutNoverlap,
    layoutRandom,
    workerForce,
    workerNoverlap,
    workerForceAtlas2
  ])

  const runLayout = useCallback(
    (newLayout: LayoutName) => {
      console.debug('Running layout:', newLayout)
      const { positions } = layouts[newLayout].layout

      try {
        const graph = sigma.getGraph()
        if (!graph) {
          console.error('No graph available')
          return
        }

        const pos = positions()
        console.log('Positions calculated, animating nodes')
        animateNodes(graph, pos, { duration: 400 })
        setLayout(newLayout)
      } catch (error) {
        console.error('Error running layout:', error)
      }
    },
    [layouts, sigma]
  )

  return (
    <div>
      <div>
        {layouts[layout] && 'worker' in layouts[layout] && (
          <WorkerLayoutControl
            layout={layouts[layout].worker!}
            mainLayout={layouts[layout].layout}
          />
        )}
      </div>
      <div>
        <Popover open={opened} onOpenChange={setOpened}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant={controlButtonVariant}
              onClick={() => setOpened((e: boolean) => !e)}
              tooltip={t('graphPanel.sideBar.layoutsControl.layoutGraph')}
            >
              <GripIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={5}
            sticky="always"
            className="p-1 min-w-auto"
          >
            <Command>
              <CommandList>
                <CommandGroup>
                  {Object.keys(layouts).map((name) => (
                    <CommandItem
                      onSelect={() => {
                        runLayout(name as LayoutName)
                      }}
                      key={name}
                      className="cursor-pointer text-xs"
                    >
                      {t(`graphPanel.sideBar.layoutsControl.layouts.${name}`)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Popover open={slidersOpen} onOpenChange={setSlidersOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant={controlButtonVariant}
              onClick={() => setSlidersOpen((e) => !e)}
              tooltip="Layout Parameters"
            >
              <SlidersHorizontalIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-64 p-2"
          >
            <div className="text-xs font-semibold px-2 pb-1 border-b mb-2">Force Directed</div>
            <ParamSlider label="Repulsion" value={forceRepulsion} min={0.01} max={2.0} step={0.01} onChange={(v) => { setForceRepulsion(v); runLayout('Force Directed') }} />
            <ParamSlider label="Attraction" value={forceAttraction} min={0.00001} max={0.01} step={0.00001} onChange={(v) => { setForceAttraction(v); runLayout('Force Directed') }} />
            <ParamSlider label="Gravity" value={forceGravity} min={0.001} max={0.1} step={0.001} onChange={(v) => { setForceGravity(v); runLayout('Force Directed') }} />

            <div className="text-xs font-semibold px-2 pb-1 border-b mb-2 mt-3">Force Atlas 2</div>
            <ParamSlider label="Scaling Ratio" value={fa2ScalingRatio} min={1} max={200} step={1} onChange={(v) => { setFa2ScalingRatio(v); runLayout('Force Atlas') }} />
            <ParamSlider label="Gravity" value={fa2Gravity} min={0.01} max={10} step={0.01} onChange={(v) => { setFa2Gravity(v); runLayout('Force Atlas') }} />
            <ParamSlider label="Slow Down" value={fa2SlowDown} min={0.1} max={20} step={0.1} onChange={(v) => { setFa2SlowDown(v); runLayout('Force Atlas') }} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export default LayoutsControl
