import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Language = 'zh-CN' | 'en-US' | 'ja-JP';

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private currentLangSubject = new BehaviorSubject<Language>('zh-CN');
  currentLang$ = this.currentLangSubject.asObservable();

  private translations: Record<Language, Record<string, unknown>> = {
    'zh-CN': {},
    'en-US': {},
    'ja-JP': {},
  };

  get currentLang(): Language {
    return this.currentLangSubject.value;
  }

  setLanguage(lang: Language): void {
    this.currentLangSubject.next(lang);
    localStorage.setItem('cms_lang', lang);
  }

  loadTranslations(lang: Language, translations: Record<string, unknown>): void {
    this.translations[lang] = translations;
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: unknown = this.translations[this.currentLang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    let result = String(value ?? key);

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, String(paramValue));
      }
    }

    return result;
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.translate(key, params);
  }

  init(): void {
    const savedLang = localStorage.getItem('cms_lang') as Language | null;
    if (savedLang && ['zh-CN', 'en-US', 'ja-JP'].includes(savedLang)) {
      this.setLanguage(savedLang);
    }
  }
}
