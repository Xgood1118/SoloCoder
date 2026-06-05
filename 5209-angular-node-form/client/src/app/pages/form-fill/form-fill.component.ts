import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormService } from '../../services/form.service';
import { FormConfig, Draft } from '../../types/form';

@Component({
  selector: 'app-form-fill',
  templateUrl: './form-fill.component.html',
  styleUrls: ['./form-fill.component.css']
})
export class FormFillComponent implements OnInit {
  formId!: string;
  formConfig!: FormConfig;
  loading = true;
  submitted = false;
  submissionId: string | null = null;
  showDraftSaved = false;
  draftData: any = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formService: FormService
  ) {}

  ngOnInit() {
    this.formId = this.route.snapshot.paramMap.get('id')!;
    this.loadForm();
  }

  loadForm() {
    this.loading = true;
    this.formService.getForm(this.formId).subscribe({
      next: (form) => {
        this.formConfig = form;
        this.loading = false;
        this.loadDraft();
      },
      error: (err) => {
        alert('加载表单失败: ' + err.message);
        this.loading = false;
      }
    });
  }

  loadDraft() {
    this.formService.getDraft(this.formId).subscribe({
      next: (draft: Draft) => {
        if (draft && draft.data) {
          this.draftData = draft.data;
        }
      },
      error: () => {
      }
    });
  }

  onSubmit(data: any) {
    this.formService.submitForm(this.formId, data).subscribe({
      next: (submission) => {
        this.submitted = true;
        this.submissionId = submission.id;
        this.formService.deleteDraft(this.formId).subscribe();
      },
      error: (err) => {
        alert('提交失败: ' + (err.error?.error || err.message));
      }
    });
  }

  saveDraft(data: any) {
    this.formService.saveDraft(this.formId, data).subscribe({
      next: () => {
        this.showDraftSaved = true;
        setTimeout(() => { this.showDraftSaved = false; }, 2000);
      },
      error: (err) => {
        alert('保存草稿失败: ' + err.message);
      }
    });
  }

  exportData(data: any) {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.formConfig.name}-填写数据.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack() {
    this.router.navigate(['/forms']);
  }
}
