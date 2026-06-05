import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DateService {
  format(value: string | number | Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    let date: Date;

    if (typeof value === 'string') {
      date = new Date(value);
    } else if (typeof value === 'number') {
      date = new Date(value * (value > 10000000000 ? 1 : 1000));
    } else {
      date = value;
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    const pad = (n: number): string => n.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  formatDate(value: string | number | Date): string {
    return this.format(value, 'YYYY-MM-DD');
  }

  formatDateTime(value: string | number | Date): string {
    return this.format(value, 'YYYY-MM-DD HH:mm:ss');
  }

  relativeTime(value: string | number | Date): string {
    let date: Date;

    if (typeof value === 'string') {
      date = new Date(value);
    } else if (typeof value === 'number') {
      date = new Date(value * (value > 10000000000 ? 1 : 1000));
    } else {
      date = value;
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes} 分钟前`;
    } else if (hours < 24) {
      return `${hours} 小时前`;
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return this.formatDate(date);
    }
  }
}
