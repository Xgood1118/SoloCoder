import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Task } from '@/store/taskStore'

interface DAGEditorProps {
  tasks: Task[]
  dependencies: string[]
  onChange: (dependencies: string[]) => void
}

type TaskNodeData = Record<string, unknown>

function TaskNode({ data }: { data: TaskNodeData }) {
  const hasCycle = data.hasCycle as boolean
  const label = data.label as string
  const taskType = data.taskType as string
  return (
    <div
      className={`px-4 py-2.5 rounded-lg border font-mono text-sm min-w-[120px] text-center ${
        hasCycle
          ? 'bg-brand-red/20 border-brand-red text-brand-red'
          : 'bg-brand-surface border-brand-cyan/40 text-brand-text'
      }`}
    >
      <div className="font-medium">{label}</div>
      <div className="text-[10px] text-brand-muted mt-0.5">{taskType}</div>
    </div>
  )
}

const nodeTypes = { taskNode: TaskNode }

function detectCycle(tasks: Task[], deps: string[]): boolean {
  const adj = new Map<string, string[]>()
  tasks.forEach((t) => adj.set(t.id, []))
  deps.forEach((dep) => {
    const parts = dep.split('->')
    if (parts.length === 2) {
      adj.get(parts[0])?.push(parts[1])
    }
  })

  const visited = new Set<string>()
  const stack = new Set<string>()

  function dfs(node: string): boolean {
    visited.add(node)
    stack.add(node)
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (stack.has(neighbor)) {
        return true
      }
    }
    stack.delete(node)
    return false
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) return true
    }
  }
  return false
}

export default function DAGEditor({ tasks, dependencies, onChange }: DAGEditorProps) {
  const hasCycle = detectCycle(tasks, dependencies)

  const initialNodes: Node<TaskNodeData>[] = tasks.map((task, i) => ({
    id: task.id,
    type: 'taskNode',
    position: { x: 200 * (i % 4), y: 120 * Math.floor(i / 4) },
    data: {
      label: task.name,
      taskType: task.type,
      hasCycle: false,
    },
  }))

  const initialEdges: Edge[] = dependencies.map((dep, i) => {
    const parts = dep.split('->')
    return {
      id: `e-${i}`,
      source: parts[0],
      target: parts[1],
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: hasCycle ? '#FF5252' : '#00E5FF', strokeWidth: 2 },
    }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const newDep = `${connection.source}->${connection.target}`
      const newDeps = [...dependencies, newDep]
      if (detectCycle(tasks, newDeps)) return
      setEdges((eds) => addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#00E5FF', strokeWidth: 2 } }, eds))
      onChange(newDeps)
    },
    [dependencies, onChange, setEdges, tasks]
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const deletedIds = new Set(deletedEdges.map((e) => `${e.source}->${e.target}`))
      onChange(dependencies.filter((d) => !deletedIds.has(d)))
    },
    [dependencies, onChange]
  )

  return (
    <div className={`border rounded-lg overflow-hidden ${hasCycle ? 'border-brand-red' : 'border-brand-border'}`}>
      {hasCycle && (
        <div className="bg-brand-red/20 text-brand-red text-xs font-mono px-4 py-2">
          检测到循环依赖！
        </div>
      )}
      <div className="h-80 bg-brand-bg">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={(changes) => {
            onEdgesChange(changes)
            const deleted = changes.filter((c) => c.type === 'remove')
            if (deleted.length > 0) {
              onEdgesDelete(deleted.map((c) => (c as unknown as Edge)))
            }
          }}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#2A2D3A" gap={20} />
          <Controls
            style={{ background: '#1A1D27', borderColor: '#2A2D3A' }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
