import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { ApiService } from '../../core/api.service';
import { DependencyGraph, QueueItem, DependencyEdge } from '../../models';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  status: string;
  hasCycle: boolean;
}

interface GraphEdge {
  from: GraphNode;
  to: GraphNode;
  hasCycle: boolean;
}

@Component({
  selector: 'app-dependency-graph',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    MatTooltipModule,
    StatusBadgeComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>account_tree</mat-icon>
        依赖关系图
        <span class="spacer"></span>
        <button mat-stroked-button routerLink="/queue">
          <mat-icon>view_kanban</mat-icon>
          队列总览
        </button>
      </div>

      <mat-card class="graph-card">
        <div class="graph-toolbar">
          <button mat-icon-button (click)="zoomIn()" matTooltip="放大">
            <mat-icon>zoom_in</mat-icon>
          </button>
          <button mat-icon-button (click)="zoomOut()" matTooltip="缩小">
            <mat-icon>zoom_out</mat-icon>
          </button>
          <button mat-icon-button (click)="resetView()" matTooltip="重置视图">
            <mat-icon>center_focus_strong</mat-icon>
          </button>
          <span class="zoom-level">{{ (zoom * 100) | number:'1.0-0' }}%</span>
          @if (cycleDetected) {
            <span class="cycle-warning">
              <mat-icon>warning</mat-icon>
              检测到循环依赖！
            </span>
          }
        </div>

        <div class="canvas-container" #canvasContainer>
          <svg [attr.viewBox]="viewBox" class="dag-svg">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
              <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
            </defs>

            @for (edge of edges; track $index) {
              <line
                [attr.x1]="edge.from.x" [attr.y1]="edge.from.y"
                [attr.x2]="edge.to.x" [attr.y2]="edge.to.y"
                [attr.stroke]="edge.hasCycle ? '#ef4444' : '#64748b'"
                stroke-width="2"
                [attr.marker-end]="edge.hasCycle ? 'url(#arrowhead-red)' : 'url(#arrowhead)'"
                [attr.stroke-dasharray]="edge.hasCycle ? '6,3' : ''"
              />
            }

            @for (node of nodes; track node.id) {
              <g [attr.transform]="'translate(' + node.x + ',' + node.y + ')'" class="dag-node">
                <rect x="-60" y="-20" width="120" height="40" rx="8"
                      [attr.fill]="node.hasCycle ? '#ef444433' : '#282c34'"
                      [attr.stroke]="node.hasCycle ? '#ef4444' : '#363c48'"
                      stroke-width="1.5" />
                <text text-anchor="middle" y="5"
                      [attr.fill]="node.hasCycle ? '#ef4444' : '#e2e8f0'"
                      font-size="11" font-family="JetBrains Mono, monospace">
                  {{ node.label }}
                </text>
              </g>
            }
          </svg>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .graph-card { padding: 0; overflow: hidden; }
    .graph-toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px; border-bottom: 1px solid #363c48;
    }
    .zoom-level { color: #64748b; font-size: 13px; margin-left: 4px; }
    .cycle-warning {
      display: flex; align-items: center; gap: 4px;
      color: #ef4444; font-size: 13px; margin-left: auto;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .canvas-container {
      width: 100%; height: 600px; overflow: hidden;
      background: #1a1d23; position: relative;
    }
    .dag-svg { width: 100%; height: 100%; }
    .dag-node { cursor: pointer; transition: all 0.2s ease; }
    .dag-node:hover rect { stroke: #3b82f6; stroke-width: 2; }
    .spacer { flex: 1; }
  `],
})
export class DependencyGraphComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  nodes: GraphNode[] = [];
  edges: GraphEdge[] = [];
  zoom = 1;
  viewBox = '0 0 1200 600';
  cycleDetected = false;

  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadGraph();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  loadGraph(): void {
    this.api.get<DependencyGraph>('/queue/graph').subscribe({
      next: (graph) => {
        this.layoutGraph(graph);
      },
      error: () => this.snackBar.open('加载依赖图失败', '关闭', { duration: 3000 }),
    });
  }

  private layoutGraph(graph: DependencyGraph): void {
    const nodeSpacingX = 200;
    const nodeSpacingY = 100;
    const startX = 100;
    const startY = 80;

    const inDegree = new Map<string, number>();
    graph.nodes.forEach((n) => inDegree.set(n.id, 0));
    graph.edges.forEach((e) => {
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    });

    const levels = new Map<string, number>();
    const queue: string[] = [];

    graph.nodes.forEach((n) => {
      if ((inDegree.get(n.id) || 0) === 0) {
        queue.push(n.id);
        levels.set(n.id, 0);
      }
    });

    let idx = 0;
    while (idx < queue.length) {
      const current = queue[idx++];
      const currentLevel = levels.get(current) || 0;
      graph.edges.filter((e) => e.from === current).forEach((e) => {
        const newLevel = currentLevel + 1;
        if ((levels.get(e.to) || 0) < newLevel) {
          levels.set(e.to, newLevel);
        }
        const deg = inDegree.get(e.to) || 0;
        inDegree.set(e.to, deg - 1);
        if (deg - 1 === 0) {
          queue.push(e.to);
        }
      });
    }

    this.cycleDetected = graph.nodes.some((n) => !levels.has(n.id));

    const levelGroups = new Map<number, string[]>();
    graph.nodes.forEach((n) => {
      const level = levels.get(n.id) ?? 0;
      const group = levelGroups.get(level) || [];
      group.push(n.id);
      levelGroups.set(level, group);
    });

    const nodeMap = new Map<string, GraphNode>();
    levelGroups.forEach((ids, level) => {
      ids.forEach((id, index) => {
        const item = graph.nodes.find((n) => n.id === id);
        const node: GraphNode = {
          id,
          x: startX + level * nodeSpacingX,
          y: startY + index * nodeSpacingY,
          label: item ? item.deployRequestId.slice(0, 8) : id.slice(0, 8),
          status: item?.status || 'queued',
          hasCycle: !levels.has(id),
        };
        nodeMap.set(id, node);
      });
    });

    this.nodes = Array.from(nodeMap.values());
    this.edges = graph.edges.map((e) => ({
      from: nodeMap.get(e.from) || { id: e.from, x: 0, y: 0, label: '', status: '', hasCycle: false },
      to: nodeMap.get(e.to) || { id: e.to, x: 0, y: 0, label: '', status: '', hasCycle: false },
      hasCycle: !levels.has(e.from) || !levels.has(e.to),
    }));

    this.updateViewBox();
  }

  zoomIn(): void {
    this.zoom = Math.min(this.zoom * 1.2, 3);
    this.updateViewBox();
  }

  zoomOut(): void {
    this.zoom = Math.max(this.zoom / 1.2, 0.3);
    this.updateViewBox();
  }

  resetView(): void {
    this.zoom = 1;
    this.updateViewBox();
  }

  private updateViewBox(): void {
    const w = 1200 / this.zoom;
    const h = 600 / this.zoom;
    this.viewBox = `0 0 ${w} ${h}`;
  }
}
