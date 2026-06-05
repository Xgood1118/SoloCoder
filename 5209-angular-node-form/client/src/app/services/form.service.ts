import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FormConfig, FormVersion, Submission, Draft, WebhookLog } from '../types/form';

@Injectable({ providedIn: 'root' })
export class FormService {
  private apiUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  getForms(): Observable<FormConfig[]> {
    return this.http.get<FormConfig[]>(`${this.apiUrl}/forms`);
  }

  getForm(id: string): Observable<FormConfig> {
    return this.http.get<FormConfig>(`${this.apiUrl}/forms/${id}`);
  }

  createForm(form: FormConfig): Observable<FormConfig> {
    return this.http.post<FormConfig>(`${this.apiUrl}/forms`, form);
  }

  updateForm(id: string, form: FormConfig, changeNote?: string): Observable<FormConfig> {
    return this.http.patch<FormConfig>(`${this.apiUrl}/forms/${id}`, { ...form, changeNote });
  }

  deleteForm(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/forms/${id}`);
  }

  copyForm(id: string): Observable<FormConfig> {
    return this.http.post<FormConfig>(`${this.apiUrl}/forms/${id}/copy`, {});
  }

  getVersions(formId: string): Observable<FormVersion[]> {
    return this.http.get<FormVersion[]>(`${this.apiUrl}/forms/${formId}/versions`);
  }

  rollbackVersion(formId: string, versionId: string): Observable<FormConfig> {
    return this.http.post<FormConfig>(`${this.apiUrl}/forms/${formId}/versions/${versionId}/rollback`, {});
  }

  shareForm(formId: string, users: string[]): Observable<FormConfig> {
    return this.http.post<FormConfig>(`${this.apiUrl}/forms/${formId}/share`, { users });
  }

  getSubmissions(formId: string, params?: any): Observable<Submission[]> {
    return this.http.get<Submission[]>(`${this.apiUrl}/forms/${formId}/submissions`, { params });
  }

  submitForm(formId: string, data: any): Observable<Submission> {
    return this.http.post<Submission>(`${this.apiUrl}/forms/${formId}/submit`, data);
  }

  addManualSubmission(formId: string, data: any): Observable<Submission> {
    return this.http.post<Submission>(`${this.apiUrl}/forms/${formId}/submissions/manual`, data);
  }

  deleteSubmission(formId: string, id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/forms/${formId}/submissions/${id}`);
  }

  deleteSubmissions(formId: string, ids: string[]): Observable<any> {
    return this.http.delete(`${this.apiUrl}/forms/${formId}/submissions`, { body: { ids } });
  }

  replayWebhook(submissionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/submissions/${submissionId}/replay`, {});
  }

  exportJson(formId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/forms/${formId}/submissions/export/json`, { responseType: 'blob' });
  }

  exportCsv(formId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/forms/${formId}/submissions/export/csv`, { responseType: 'blob' });
  }

  exportExcel(formId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/forms/${formId}/submissions/export/excel`, { responseType: 'blob' });
  }

  getDraft(formId: string, userId = 'anonymous'): Observable<Draft> {
    return this.http.get<Draft>(`${this.apiUrl}/drafts/${formId}?userId=${userId}`);
  }

  saveDraft(formId: string, data: any, userId = 'anonymous'): Observable<Draft> {
    return this.http.post<Draft>(`${this.apiUrl}/drafts/${formId}?userId=${userId}`, { data });
  }

  deleteDraft(draftId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/drafts/${draftId}`);
  }

  getWebhookLogs(formId?: string): Observable<WebhookLog[]> {
    const params = formId ? { formId } : {};
    return this.http.get<WebhookLog[]>(`${this.apiUrl}/webhook-logs`, { params });
  }

  uploadFiles(files: FileList): Observable<any> {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    return this.http.post(`${this.apiUrl}/files`, formData);
  }
}
