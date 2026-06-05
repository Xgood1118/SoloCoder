import { Injectable } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(
    private messageService: NzMessageService,
    private modalService: NzModalService
  ) {}

  success(message: string): void {
    this.messageService.success(message);
  }

  error(message: string): void {
    this.messageService.error(message);
  }

  warning(message: string): void {
    this.messageService.warning(message);
  }

  info(message: string): void {
    this.messageService.info(message);
  }

  confirm(
    title: string,
    content: string,
    onOk: () => void,
    onCancel?: () => void
  ): void {
    this.modalService.confirm({
      nzTitle: title,
      nzContent: content,
      nzOnOk: onOk,
      nzOnCancel: onCancel,
    });
  }

  confirmDelete(
    onOk: () => void,
    content: string = '此操作不可恢复，请谨慎操作'
  ): void {
    this.confirm('确认删除？', content, onOk);
  }
}
