import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Template } from '../types/form';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private apiUrl = 'http://localhost:3000/api/templates';

  constructor(private http: HttpClient) {}

  getTemplates(): Observable<Template[]> {
    return this.http.get<Template[]>(this.apiUrl);
  }

  getTemplate(id: string): Observable<Template> {
    return this.http.get<Template>(`${this.apiUrl}/${id}`);
  }

  createTemplate(template: Template): Observable<Template> {
    return this.http.post<Template>(this.apiUrl, template);
  }
}
