import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TemplateService } from '../../services/template.service';
import { FormService } from '../../services/form.service';
import { Template } from '../../types/form';

@Component({
  selector: 'app-templates',
  templateUrl: './templates.component.html',
  styleUrls: ['./templates.component.css']
})
export class TemplatesComponent implements OnInit {
  templates: Template[] = [];
  loading = false;

  constructor(
    private templateService: TemplateService,
    private formService: FormService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading = true;
    this.templateService.getTemplates().subscribe({
      next: (templates) => {
        this.templates = templates;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  useTemplate(template: Template) {
    const formConfig = {
      ...template.formConfig,
      name: template.name + ' (副本)',
      derivedFrom: template.id,
      fields: template.formConfig.fields.map(f => ({
        ...f,
        isLocked: template.isBuiltIn
      }))
    };

    this.formService.createForm(formConfig as any).subscribe({
      next: (form) => {
        this.router.navigate(['/forms', form.id, 'edit']);
      },
      error: (err) => {
        alert('创建失败: ' + (err.error?.error || err.message));
      }
    });
  }

  previewTemplate(template: Template) {
  }

  goBack() {
    this.router.navigate(['/forms']);
  }
}
