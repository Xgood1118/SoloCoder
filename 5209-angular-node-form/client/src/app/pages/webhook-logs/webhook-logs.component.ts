import { Component, OnInit } from '@angular/core';
import { FormService } from '../../services/form.service';
import { WebhookLog } from '../../types/form';

@Component({
  selector: 'app-webhook-logs',
  templateUrl: './webhook-logs.component.html',
  styleUrls: ['./webhook-logs.component.css']
})
export class WebhookLogsComponent implements OnInit {
  logs: WebhookLog[] = [];
  loading = false;

  constructor(private formService: FormService) {}

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.loading = true;
    this.formService.getWebhookLogs().subscribe({
      next: (logs) => {
        this.logs = logs;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  replayLog(log: WebhookLog) {
    this.formService.replayWebhook(log.submissionId).subscribe({
      next: (result) => {
        if (result.success) {
          alert('重放成功');
        } else {
          alert('重放失败: ' + result.error);
        }
        this.loadLogs();
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'success': return 'tag-success';
      case 'retrying': return 'tag-warning';
      case 'failed': return 'tag-error';
      default: return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'success': return '成功';
      case 'retrying': return '重试中';
      case 'failed': return '失败';
      default: return status;
    }
  }
}
