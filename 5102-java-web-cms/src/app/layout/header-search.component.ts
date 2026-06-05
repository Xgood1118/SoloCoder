import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { ApiService } from '../core/services/api.service';
import { SearchResultItem } from '../core/models/common.model';

@Component({
  selector: 'app-header-search',
  template: `
    <nz-autocomplete [nzDataSource]="searchResults" [nzBackfill]="true">
      <input
        type="text"
        nz-input
        placeholder="搜索文档..."
        [(ngModel)]="searchKeyword"
        (ngModelChange)="onSearchChange($event)"
        (nzOnSearch)="onSearch($event)"
        (keyup.enter)="goToSearch()"
      />
      <ng-template #nzTemplate let-item>
        <div class="search-result-item" (click)="goToDetail(item.id)">
          <div class="result-title" [innerHTML]="item.highlightTitle || item.title"></div>
          <div class="result-summary" [innerHTML]="item.highlightSummary || item.summary"></div>
        </div>
      </ng-template>
    </nz-autocomplete>
  `,
  styles: [
    `
      .search-result-item {
        padding: 8px 0;
        .result-title {
          font-size: 14px;
          margin-bottom: 4px;
        }
        .result-summary {
          font-size: 12px;
          color: #999;
        }
        ::ng-deep .highlight {
          color: #f5222d;
          background: #fff1f0;
          padding: 0 2px;
        }
      }
    `,
  ],
})
export class HeaderSearchComponent implements OnInit {
  searchKeyword = '';
  searchResults: SearchResultItem[] = [];
  private searchSubject = new Subject<string>();

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((keyword) => this.apiService.search(keyword))
      )
      .subscribe((response) => {
        this.searchResults = response.items.slice(0, 10);
      });
  }

  onSearchChange(keyword: string): void {
    if (keyword) {
      this.searchSubject.next(keyword);
    } else {
      this.searchResults = [];
    }
  }

  onSearch(keyword: string): void {
    this.searchSubject.next(keyword);
  }

  goToSearch(): void {
    if (this.searchKeyword) {
      this.router.navigate(['/search'], {
        queryParams: { keyword: this.searchKeyword },
      });
    }
  }

  goToDetail(id: string): void {
    this.router.navigate(['/documents', id]);
  }
}
