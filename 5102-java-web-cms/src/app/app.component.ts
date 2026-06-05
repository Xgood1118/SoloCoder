import { Component, OnInit } from '@angular/core';
import { I18nService } from './core/services/i18n.service';

@Component({
  selector: 'app-root',
  template: `
    <router-outlet></router-outlet>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class AppComponent implements OnInit {
  constructor(private i18nService: I18nService) {}

  ngOnInit(): void {
    this.i18nService.init();
  }
}
