import {
  getUserById,
  listUserRoles,
  getDepartmentById,
  getDepartmentDescendantIds,
  listAllDepartments,
} from './repositories';
import { DepartmentRecord } from './types';
import { Errors } from './utils/errors';

export interface DepartmentNode {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  level: number;
  children: DepartmentNode[];
}

function buildTree(allDepts: DepartmentRecord[], visibleIds: Set<number>): DepartmentNode[] {
  const visible = allDepts.filter(d => visibleIds.has(d.id));
  const map = new Map<number, DepartmentNode>();
  for (const d of visible) {
    map.set(d.id, { id: d.id, name: d.name, parent_id: d.parent_id, path: d.path, level: d.level, children: [] });
  }

  const roots: DepartmentNode[] = [];
  for (const d of visible) {
    const node = map.get(d.id)!;
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortTree(nodes: DepartmentNode[]): void {
    nodes.sort((a, b) => a.level - b.level || a.id - b.id);
    for (const n of nodes) sortTree(n.children);
  }
  sortTree(roots);
  return roots;
}

export function getVisibleDepartmentTree(userId: number): DepartmentNode[] {
  const user = getUserById(userId);
  if (!user) throw Errors.NotFound('User not found');

  const roles = listUserRoles(userId);
  const isAdmin = roles.some(r => r.code === 'admin');
  const isDeptAdmin = roles.some(r => r.code === 'dept_admin');

  const allDepts = listAllDepartments();
  let visibleIds: Set<number>;

  if (isAdmin) {
    visibleIds = new Set(allDepts.map(d => d.id));
  } else if (isDeptAdmin && user.department_id) {
    const descIds = getDepartmentDescendantIds(user.department_id);
    visibleIds = new Set(descIds);
  } else if (user.department_id) {
    visibleIds = new Set([user.department_id]);
  } else {
    visibleIds = new Set();
  }

  return buildTree(allDepts, visibleIds);
}
