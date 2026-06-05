import type { Task } from '../../shared/types.js'
import { getTaskById, getAllDependenciesMap } from '../repositories/taskRepository.js'
import { getExecutions } from '../repositories/executionRepository.js'

export function validateDAG(
  taskId: string,
  dependencies: string[],
  allTasks: Task[]
): { valid: boolean; cycle?: string[]; message?: string } {
  const taskIds = new Set(allTasks.map(t => t.id))

  for (const depId of dependencies) {
    if (!taskIds.has(depId)) {
      return { valid: false, message: `Dependency task '${depId}' does not exist` }
    }
  }

  if (dependencies.includes(taskId)) {
    return { valid: false, cycle: [taskId], message: 'Self-dependency is not allowed' }
  }

  const adjList = new Map<string, string[]>()
  for (const task of allTasks) {
    const deps = task.id === taskId ? dependencies : (task.dependencies || [])
    adjList.set(task.id, [...deps])
  }

  if (!adjList.has(taskId)) {
    adjList.set(taskId, dependencies)
  }

  const visited = new Set<string>()
  const recStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): string[] | null {
    visited.add(node)
    recStack.add(node)
    path.push(node)

    const neighbors = adjList.get(node) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor)
        if (cycle) return cycle
      } else if (recStack.has(neighbor)) {
        const cycleStartIdx = path.indexOf(neighbor)
        return [...path.slice(cycleStartIdx), neighbor]
      }
    }

    path.pop()
    recStack.delete(node)
    return null
  }

  for (const task of allTasks) {
    if (!visited.has(task.id)) {
      const cycle = dfs(task.id)
      if (cycle) {
        return { valid: false, cycle, message: `Cycle detected: ${cycle.join(' → ')}` }
      }
    }
  }

  return { valid: true }
}

export function topologicalSort(
  allTasks: Task[],
  dependenciesMap: Map<string, string[]>
): string[] {
  const taskIds = new Set(allTasks.map(t => t.id))
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const task of allTasks) {
    inDegree.set(task.id, 0)
    adjList.set(task.id, [])
  }

  for (const [taskId, deps] of dependenciesMap.entries()) {
    if (!taskIds.has(taskId)) continue
    for (const depId of deps) {
      if (!taskIds.has(depId)) continue
      inDegree.set(taskId, (inDegree.get(taskId) || 0) + 1)
      const edges = adjList.get(depId) || []
      edges.push(taskId)
      adjList.set(depId, edges)
    }
  }

  const queue: string[] = []
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(taskId)
    }
  }

  const result: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    result.push(node)

    const neighbors = adjList.get(node) || []
    for (const neighbor of neighbors) {
      const degree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, degree)
      if (degree === 0) {
        queue.push(neighbor)
      }
    }
  }

  return result
}

export async function checkDependenciesMet(
  taskId: string
): Promise<{ met: boolean; failedDependencies?: string[]; pendingDependencies?: string[] }> {
  const task = await getTaskById(taskId)
  if (!task) return { met: false, failedDependencies: [taskId] }

  const dependencies = task.dependencies || []
  if (dependencies.length === 0) return { met: true }

  const failed: string[] = []
  const pending: string[] = []

  for (const depId of dependencies) {
    const executions = await getExecutions({ taskId: depId })
    if (executions.length === 0) {
      const depTask = await getTaskById(depId)
      pending.push(depTask?.name || depId)
      continue
    }

    const latest = executions[0]
    if (latest.status === 'failed' || latest.status === 'timeout') {
      const depTask = await getTaskById(depId)
      failed.push(depTask?.name || depId)
    } else if (latest.status === 'running' || latest.status === 'skipped') {
      const depTask = await getTaskById(depId)
      pending.push(depTask?.name || depId)
    }
  }

  if (failed.length > 0) {
    return { met: false, failedDependencies: failed }
  }
  if (pending.length > 0) {
    return { met: false, pendingDependencies: pending }
  }

  return { met: true }
}

export async function getAllDependenciesWithTasks() {
  const depsMap = await getAllDependenciesMap()
  return depsMap
}
