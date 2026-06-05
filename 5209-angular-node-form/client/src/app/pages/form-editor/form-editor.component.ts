import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormService } from '../../services/form.service';
import { FormConfig, FormField, FieldType, Condition, FormVersion } from '../../types/form';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'time', label: '时间' },
  { value: 'select', label: '下拉单选' },
  { value: 'multiselect', label: '下拉多选' },
  { value: 'radio', label: '单选框' },
  { value: 'checkbox', label: '复选框' },
  { value: 'file', label: '文件上传' },
  { value: 'rating', label: '评分' }
];

@Component({
  selector: 'app-form-editor',
  templateUrl: './form-editor.component.html',
  styleUrls: ['./form-editor.component.css']
})
export class FormEditorComponent implements OnInit {
  formId: string | null = null;
  formConfig: FormConfig = {
    name: '',
    description: '',
    webhookUrl: '',
    fields: []
  };
  selectedFieldIndex: number = -1;
  fieldTypes = FIELD_TYPES;
  versions: FormVersion[] = [];
  showVersionsModal = false;
  showShareModal = false;
  shareUsers = '';
  isNew = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formService: FormService
  ) {}

  ngOnInit() {
    this.formId = this.route.snapshot.paramMap.get('id');
    if (this.formId && this.formId !== 'new') {
      this.isNew = false;
      this.loadForm(this.formId);
    } else {
      this.isNew = true;
    }
  }

  loadForm(id: string) {
    this.formService.getForm(id).subscribe({
      next: (form) => {
        this.formConfig = { ...form };
        this.loadVersions();
      },
      error: (err) => {
        alert('加载表单失败: ' + err.message);
        this.router.navigate(['/forms']);
      }
    });
  }

  loadVersions() {
    if (!this.formId) return;
    this.formService.getVersions(this.formId).subscribe({
      next: (versions) => {
        this.versions = versions;
      },
      error: (err) => console.error('Load versions error:', err)
    });
  }

  addField(type: FieldType) {
    const field: FormField = {
      key: `field_${Date.now()}`,
      label: `新${this.getFieldTypeName(type)}`,
      type,
      required: false,
      placeholder: '',
      helpText: '',
      typeMeta: this.getDefaultTypeMeta(type),
      options: this.hasOptions(type) ? [{ label: '选项1', value: 'option1' }] : undefined
    };
    this.formConfig.fields.push(field);
    this.selectedFieldIndex = this.formConfig.fields.length - 1;
  }

  getDefaultTypeMeta(type: FieldType) {
    switch (type) {
      case 'text':
        return { minLength: 1, maxLength: 100 };
      case 'textarea':
        return { minLength: 1, maxLength: 2000 };
      case 'number':
        return {};
      case 'file':
        return { maxFiles: 5, maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'] };
      default:
        return {};
    }
  }

  getFieldTypeName(type: FieldType): string {
    const found = this.fieldTypes.find(f => f.value === type);
    return found ? found.label : type;
  }

  hasOptions(type: FieldType): boolean {
    return ['select', 'multiselect', 'radio', 'checkbox'].includes(type);
  }

  removeField(index: number) {
    this.formConfig.fields.splice(index, 1);
    if (this.selectedFieldIndex >= this.formConfig.fields.length) {
      this.selectedFieldIndex = this.formConfig.fields.length - 1;
    }
  }

  moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.formConfig.fields.length) return;
    const temp = this.formConfig.fields[index];
    this.formConfig.fields[index] = this.formConfig.fields[newIndex];
    this.formConfig.fields[newIndex] = temp;
    this.selectedFieldIndex = newIndex;
  }

  addOption(field: FormField) {
    if (!field.options) field.options = [];
    const idx = field.options.length + 1;
    field.options.push({ label: `选项${idx}`, value: `option${idx}` });
  }

  removeOption(field: FormField, index: number) {
    field.options?.splice(index, 1);
  }

  saveForm() {
    if (!this.formConfig.name.trim()) {
      alert('请输入表单名称');
      return;
    }

    if (this.isNew) {
      this.formService.createForm(this.formConfig).subscribe({
        next: (form) => {
          alert('创建成功');
          this.router.navigate(['/forms', form.id, 'edit']);
        },
        error: (err) => {
          alert('保存失败: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.formService.updateForm(this.formId!, this.formConfig).subscribe({
        next: (form) => {
          this.formConfig = form;
          this.loadVersions();
          alert('保存成功');
        },
        error: (err) => {
          alert('保存失败: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  rollbackVersion(version: FormVersion) {
    if (!confirm(`确定要回滚到版本 ${version.versionNumber} 吗？`)) return;
    this.formService.rollbackVersion(this.formId!, version.id).subscribe({
      next: (form) => {
        this.formConfig = form;
        this.showVersionsModal = false;
        this.loadVersions();
        alert('回滚成功');
      },
      error: (err) => {
        alert('回滚失败: ' + err.message);
      }
    });
  }

  shareForm() {
    const users = this.shareUsers.split(',').map(u => u.trim()).filter(u => u);
    this.formService.shareForm(this.formId!, users).subscribe({
      next: () => {
        this.showShareModal = false;
        alert('分享成功');
      },
      error: (err) => {
        alert('分享失败: ' + err.message);
      }
    });
  }

  exportJson() {
    const dataStr = JSON.stringify(this.formConfig, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.formConfig.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  addCondition(type: 'show' | 'required', field: FormField) {
    const condition: Condition = {
      op: 'eq',
      field: '',
      value: ''
    };
    if (type === 'show') {
      field.conditionalShow = condition;
    } else {
      field.conditionalRequired = condition;
    }
  }

  toggleConditionOp(condition: Condition) {
    if (condition.op === 'and' || condition.op === 'or') {
      condition.op = condition.op === 'and' ? 'or' : 'and';
      if (!condition.children) {
        condition.children = [
          { op: 'eq', field: '', value: '' },
          { op: 'eq', field: '', value: '' }
        ];
      }
      delete condition.field;
      delete condition.value;
    } else {
      condition.op = condition.op === 'eq' ? 'and' : 'eq';
      if (condition.op === 'and') {
        condition.children = [
          { op: 'eq', field: '', value: '' },
          { op: 'eq', field: '', value: '' }
        ];
        delete condition.field;
        delete condition.value;
      }
    }
  }

  addChildCondition(condition: Condition) {
    if (!condition.children) {
      condition.children = [];
    }
    condition.children.push({ op: 'eq', field: '', value: '' });
  }

  removeChildCondition(parent: Condition, index: number) {
    parent.children?.splice(index, 1);
  }

  goBack() {
    this.router.navigate(['/forms']);
  }

  onPreviewSubmit(data: any) {
    alert('预览提交成功！\n' + JSON.stringify(data, null, 2));
  }
}
