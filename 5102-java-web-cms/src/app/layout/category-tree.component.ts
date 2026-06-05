import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { NzFormatEmitEvent, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { ApiService } from '../core/services/api.service';
import { Category } from '../core/models/category.model';

@Component({
  selector: 'app-category-tree',
  template: `
    <div class="category-tree">
      <div class="tree-header">
        <h3>分类导航</h3>
        <div class="tree-actions">
          <button nz-button nzType="link" (click)="expandAll()">全部展开</button>
          <button nz-button nzType="link" (click)="collapseAll()">全部收起</button>
        </div>
      </div>
      <nz-tree
        [nzData]="treeNodes"
        [nzCheckable]="true"
        [nzCheckedKeys]="checkedKeys"
        [nzExpandedKeys]="expandedKeys"
        (nzCheckBoxChange)="onCheckBoxChange($event)"
        (nzClick)="onNodeClick($event)"
      ></nz-tree>
    </div>
  `,
  styleUrls: ['./category-tree.component.scss'],
})
export class CategoryTreeComponent implements OnInit {
  @Output() categorySelect = new EventEmitter<string[]>();

  categories: Category[] = [];
  treeNodes: NzTreeNodeOptions[] = [];
  checkedKeys: string[] = [];
  expandedKeys: string[] = [];

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe((categories) => {
      this.categories = categories;
      this.treeNodes = this.buildTree(categories);
      this.expandedKeys = this.getAllNodeKeys(categories);
    });
  }

  private buildTree(categories: Category[]): NzTreeNodeOptions[] {
    return categories.map((cat) => ({
      key: cat.id,
      title: `${cat.name} (${cat.documentCount})`,
      children: cat.children ? this.buildTree(cat.children) : undefined,
      isLeaf: !cat.children || cat.children.length === 0,
    }));
  }

  private getAllNodeKeys(categories: Category[]): string[] {
    const keys: string[] = [];
    const traverse = (cats: Category[]) => {
      cats.forEach((cat) => {
        if (cat.children && cat.children.length > 0) {
          keys.push(cat.id);
          traverse(cat.children);
        }
      });
    };
    traverse(categories);
    return keys;
  }

  onCheckBoxChange(event: NzFormatEmitEvent): void {
    if (event.keys) {
      this.checkedKeys = event.keys;
      this.categorySelect.emit(this.checkedKeys);
      this.router.navigate(['/documents'], {
        queryParams: { categoryIds: this.checkedKeys.join(',') },
      });
    }
  }

  onNodeClick(event: NzFormatEmitEvent): void {
    const node = event.node;
    if (node) {
      this.checkedKeys = [node.key];
      this.categorySelect.emit([node.key]);
      this.router.navigate(['/documents'], {
        queryParams: { categoryIds: node.key },
      });
    }
  }

  expandAll(): void {
    this.expandedKeys = this.getAllNodeKeys(this.categories);
  }

  collapseAll(): void {
    this.expandedKeys = [];
  }
}
