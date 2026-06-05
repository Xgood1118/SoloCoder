import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormService } from '../../services/form.service';
import { FormConfig, Submission } from '../../types/form';

@Component({
  selector: 'app-submissions',
  templateUrl: './submissions.component.html',
  styleUrls: ['./submissions.component.css']
})
export class SubmissionsComponent implements OnInit {
  formId!: string;
  form!: FormConfig;
  submissions: Submission[] = [];
  selectedIds: string[] = [];
  startDate = '';
  endDate = '';
  filterField = '';
  filterOperator = 'eq';
  filterValue = '';
  showManualModal = false;
  manualData: any = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formService: FormService
  ) {}

  ngOnInit() {
    this.formId = this.route.snapshot.paramMap.get('id')!;
    this.loadForm();
    this.loadSubmissions();
  }

  loadForm() {
    this.formService.getForm(this.formId).subscribe({
      next: (form) => {
        this.form = form;
        this.manualData = {};
        form.fields.forEach(f => {
          if (f.type === 'checkbox' || f.type === 'multiselect' || f.type === 'file') {
            this.manualData[f.key] = [];
          } else if (f.type === 'rating') {
            this.manualData[f.key] = null;
          } else {
            this.manualData[f.key] = '';
          }
        });
      }
    });
  }

  loadSubmissions() {
    const params: any = {};
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;
    if (this.filterField && this.filterValue) {
      params.field = this.filterField;
      params.operator = this.filterOperator;
      params.value = this.filterValue;
    }

    this.formService.getSubmissions(this.formId, params).subscribe({
      next: (subs) => {
        this.submissions = subs;
        this.selectedIds = [];
      }
    });
  }

  toggleSelect(id: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedIds.push(id);
    } else {
      this.selectedIds = this.selectedIds.filter(sid => sid !== id);
    }
  }

  toggleSelectAll(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedIds = this.submissions.map(s => s.id);
    } else {
      this.selectedIds = [];
    }
  }

  deleteSubmission(id: string) {
    if (!confirm('确定要删除这条提交记录吗？')) return;
    this.formService.deleteSubmission(this.formId, id).subscribe({
      next: () => {
        this.loadSubmissions();
      }
    });
  }

  batchDelete() {
    if (this.selectedIds.length === 0) {
      alert('请先选择要删除的记录');
      return;
    }
    if (!confirm(`确定要删除选中的 ${this.selectedIds.length} 条记录吗？`)) return;
    this.formService.deleteSubmissions(this.formId, this.selectedIds).subscribe({
      next: () => {
        this.loadSubmissions();
      }
    });
  }

  exportJson() {
    this.formService.exportJson(this.formId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.form.name}-submissions.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  exportCsv() {
    this.formService.exportCsv(this.formId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.form.name}-submissions.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  exportExcel() {
    this.formService.exportExcel(this.formId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.form.name}-submissions.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  replayWebhook(submissionId: string) {
    this.formService.replayWebhook(submissionId).subscribe({
      next: (result) => {
        if (result.success) {
          alert('重放成功');
        } else {
          alert('重放失败: ' + result.error);
        }
      }
    });
  }

  addManual() {
    this.showManualModal = true;
  }

  submitManual() {
    this.formService.addManualSubmission(this.formId, this.manualData).subscribe({
      next: () => {
        this.showManualModal = false;
        this.loadSubmissions();
        alert('补录成功');
      },
      error: (err) => {
        alert('补录失败: ' + (err.error?.error || err.message));
      }
    });
  }

  goBack() {
    this.router.navigate(['/forms']);
  }

  getFieldValue(data: any, key: string): string {
    const value = data[key];
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'object' ? v.originalName || v.name : v).join(', ');
    }
    if (typeof value === 'object') {
      return value.originalName || value.name || JSON.stringify(value);
    }
    return String(value);
  }
}
