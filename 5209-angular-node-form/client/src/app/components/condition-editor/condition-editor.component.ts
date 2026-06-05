import { Component, Input } from '@angular/core';
import { Condition, FormField } from '../../types/form';

@Component({
  selector: 'app-condition-editor',
  templateUrl: './condition-editor.component.html',
  styleUrls: ['./condition-editor.component.css']
})
export class ConditionEditorComponent {
  @Input() condition!: Condition;
  @Input() fields: FormField[] = [];

  operators = [
    { value: 'eq', label: '等于' },
    { value: 'ne', label: '不等于' },
    { value: 'gt', label: '大于' },
    { value: 'lt', label: '小于' },
    { value: 'gte', label: '大于等于' },
    { value: 'lte', label: '小于等于' },
    { value: 'contains', label: '包含' },
    { value: 'empty', label: '为空' },
    { value: 'notEmpty', label: '不为空' },
    { value: 'and', label: '且 (复合)' },
    { value: 'or', label: '或 (复合)' }
  ];

  isCompound(op: string): boolean {
    return op === 'and' || op === 'or';
  }

  isValueNeeded(op: string): boolean {
    return !['empty', 'notEmpty', 'and', 'or'].includes(op);
  }

  toggleCompound() {
    if (this.isCompound(this.condition.op)) {
      if (!this.condition.children || this.condition.children.length === 0) {
        this.condition.children = [
          { op: 'eq', field: '', value: '' },
          { op: 'eq', field: '', value: '' }
        ];
      }
    }
  }

  addChild() {
    if (!this.condition.children) {
      this.condition.children = [];
    }
    this.condition.children.push({ op: 'eq', field: '', value: '' });
  }

  removeChild(index: number) {
    this.condition.children?.splice(index, 1);
  }
}
