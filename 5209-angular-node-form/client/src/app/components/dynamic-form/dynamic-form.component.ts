import { Component, Input, OnInit, OnChanges, SimpleChanges, EventEmitter, Output } from '@angular/core';
import { FormGroup, FormControl, FormArray, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { FormField, FormConfig } from '../../types/form';
import { isFieldVisible, isFieldRequired } from '../../utils/condition-evaluator';

@Component({
  selector: 'app-dynamic-form',
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.css']
})
export class DynamicFormComponent implements OnInit, OnChanges {
  @Input() formConfig!: FormConfig;
  @Input() initialData: any = {};
  @Input() readOnly = false;
  @Output() formSubmit = new EventEmitter<any>();
  @Output() valueChange = new EventEmitter<any>();

  formGroup!: FormGroup;

  ngOnInit() {
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['formConfig'] && !changes['formConfig'].firstChange) {
      this.buildForm();
    }
    if (changes['initialData'] && !changes['initialData'].firstChange) {
      this.formGroup.patchValue(this.initialData || {});
    }
  }

  buildForm() {
    const group: any = {};
    this.formConfig.fields.forEach(field => {
      const validators = this.getValidators(field);
      const value = this.initialData[field.key] ?? field.defaultValue ?? this.getDefaultValue(field);
      group[field.key] = new FormControl(value, validators);
    });
    this.formGroup = new FormGroup(group);

    this.formGroup.valueChanges.subscribe(values => {
      this.updateFormulas(values);
      this.updateConditionalValidators(values);
      this.valueChange.emit(this.formGroup.value);
    });

    this.updateConditionalValidators(this.formGroup.value);
  }

  getDefaultValue(field: FormField): any {
    switch (field.type) {
      case 'checkbox':
      case 'multiselect':
        return [];
      case 'rating':
        return null;
      case 'file':
        return [];
      default:
        return '';
    }
  }

  getValidators(field: FormField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (field.required) {
      validators.push(this.requiredValidator(field));
    }

    if (field.type === 'text' || field.type === 'textarea') {
      if (field.typeMeta?.minLength !== undefined) {
        validators.push(Validators.minLength(field.typeMeta.minLength));
      }
      if (field.typeMeta?.maxLength !== undefined) {
        validators.push(Validators.maxLength(field.typeMeta.maxLength));
      }
      if (field.validation?.pattern) {
        validators.push(Validators.pattern(field.validation.pattern));
      }
    }

    if (field.type === 'number') {
      if (field.typeMeta?.min !== undefined) {
        validators.push(Validators.min(field.typeMeta.min));
      }
      if (field.typeMeta?.max !== undefined) {
        validators.push(Validators.max(field.typeMeta.max));
      }
    }

    return validators;
  }

  requiredValidator(field: FormField): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      const formValues = this.formGroup?.value || {};

      if (!isFieldVisible(field, formValues)) {
        return null;
      }

      if (!isFieldRequired(field, formValues)) {
        return null;
      }

      if (value === null || value === undefined || value === '') {
        return { required: true };
      }
      if (Array.isArray(value) && value.length === 0) {
        return { required: true };
      }
      return null;
    };
  }

  updateConditionalValidators(values: any) {
    this.formConfig.fields.forEach(field => {
      const control = this.formGroup.get(field.key);
      if (!control) return;

      const validators = this.getValidators(field);
      control.setValidators(validators);
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  updateFormulas(values: any) {
    this.formConfig.fields.forEach(field => {
      if (field.formula) {
        try {
          const result = this.evaluateFormula(field.formula, values);
          const control = this.formGroup.get(field.key);
          if (control && control.value !== result) {
            control.setValue(result, { emitEvent: false });
          }
        } catch (e) {
        }
      }
    });
  }

  evaluateFormula(formula: string, values: any): number {
    let expr = formula;
    Object.keys(values).forEach(key => {
      const val = Number(values[key]) || 0;
      expr = expr.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    });
    return eval(expr);
  }

  isFieldVisible(field: FormField): boolean {
    return isFieldVisible(field, this.formGroup?.value || {});
  }

  isFieldRequired(field: FormField): boolean {
    return isFieldRequired(field, this.formGroup?.value || {});
  }

  getPlaceholder(field: FormField): string {
    let placeholder = field.placeholder || '';
    if (placeholder.includes('{') && placeholder.includes('}')) {
      const values = this.formGroup?.value || {};
      Object.keys(values).forEach(key => {
        placeholder = placeholder.replace(`{${key}}`, values[key] || '');
      });
    }
    return placeholder;
  }

  setRating(field: FormField, value: number) {
    if (this.readOnly) return;
    this.formGroup.get(field.key)?.setValue(value);
  }

  onFileChange(event: Event, field: FormField, input: HTMLInputElement) {
    if (input.files && input.files.length > 0) {
      const currentFiles = this.formGroup.get(field.key)?.value || [];
      const newFiles = Array.from(input.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        file: f
      }));
      this.formGroup.get(field.key)?.setValue([...currentFiles, ...newFiles]);
    }
    input.value = '';
  }

  removeFile(field: FormField, index: number) {
    const files = this.formGroup.get(field.key)?.value || [];
    files.splice(index, 1);
    this.formGroup.get(field.key)?.setValue([...files]);
  }

  isImage(file: any): boolean {
    return file.type?.startsWith('image/') || file.mimetype?.startsWith('image/');
  }

  getFilePath(file: any): string {
    if (file.path) {
      return 'http://localhost:3001' + file.path;
    }
    if (file.url) {
      return file.url;
    }
    return '';
  }

  onSubmit() {
    if (this.formGroup.valid) {
      this.formSubmit.emit(this.formGroup.value);
    } else {
      this.formGroup.markAllAsTouched();
    }
  }

  get formValue() {
    return this.formGroup?.value || {};
  }

  onCheckboxChange(field: FormField, value: any, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const control = this.formGroup.get(field.key);
    const currentValues = control?.value || [];
    
    if (checkbox.checked) {
      control?.setValue([...currentValues, value]);
    } else {
      control?.setValue(currentValues.filter((v: any) => v !== value));
    }
  }

  triggerFileInput(field: FormField) {
    const input = document.querySelector(`input[type="file"][data-field="${field.key}"]`) as HTMLInputElement;
    input?.click();
  }

  getObjectUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  isCheckboxChecked(field: FormField, value: any): boolean {
    const control = this.formGroup.get(field.key);
    const values = control?.value || [];
    return values.includes(value);
  }
}
