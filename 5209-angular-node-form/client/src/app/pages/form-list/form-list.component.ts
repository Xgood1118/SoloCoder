import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormService } from '../../services/form.service';
import { FormConfig } from '../../types/form';

@Component({
  selector: 'app-form-list',
  templateUrl: './form-list.component.html',
  styleUrls: ['./form-list.component.css']
})
export class FormListComponent implements OnInit {
  forms: FormConfig[] = [];
  loading = false;

  constructor(private formService: FormService, private router: Router) {}

  ngOnInit() {
    this.loadForms();
  }

  loadForms() {
    this.loading = true;
    this.formService.getForms().subscribe({
      next: (forms) => {
        this.forms = forms;
        this.loading = false;
      },
      error: (err) => {
        console.error('Load forms error:', err);
        this.loading = false;
      }
    });
  }

  createForm() {
    this.router.navigate(['/forms', 'new']);
  }

  editForm(id: string) {
    this.router.navigate(['/forms', id, 'edit']);
  }

  viewForm(id: string) {
    this.router.navigate(['/forms', id]);
  }

  viewSubmissions(id: string) {
    this.router.navigate(['/forms', id, 'submissions']);
  }

  copyForm(id: string) {
    this.formService.copyForm(id).subscribe({
      next: (form) => {
        this.loadForms();
      },
      error: (err) => {
        alert('复制失败: ' + err.message);
      }
    });
  }

  deleteForm(id: string) {
    if (!confirm('确定要删除这个表单吗？')) return;
    this.formService.deleteForm(id).subscribe({
      next: () => {
        this.loadForms();
      },
      error: (err) => {
        alert('删除失败: ' + err.message);
      }
    });
  }

  exportJson(form: FormConfig) {
    const dataStr = JSON.stringify(form, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goToTemplates() {
    this.router.navigate(['/templates']);
  }
}
