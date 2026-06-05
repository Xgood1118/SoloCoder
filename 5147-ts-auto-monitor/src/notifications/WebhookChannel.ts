import axios from 'axios';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import { NotificationMessage, NotificationChannel, WebhookConfig } from '../types/notifications';
import { AlertLevel } from '../types/alerts';

export class WebhookChannel implements NotificationChannel {
  readonly name = 'webhook';
  readonly type = 'webhook' as const;
  readonly enabled: boolean;
  readonly levels: AlertLevel[];

  private logger: ModuleLogger;
  private config: WebhookConfig;

  constructor(config: WebhookConfig, enabled: boolean, levels: AlertLevel[]) {
    this.logger = createModuleLogger('Webhook');
    this.config = config;
    this.enabled = enabled;
    this.levels = levels;
  }

  async send(message: NotificationMessage): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    if (!this.levels.includes(message.level)) {
      return false;
    }

    try {
      const payload = this.formatMessage(message);

      await axios({
        method: this.config.method,
        url: this.config.url,
        data: payload,
        headers: this.config.headers || { 'Content-Type': 'application/json' },
        timeout: this.config.timeout || 5000,
      });

      this.logger.debug('Webhook通知发送成功', { messageId: message.id });
      return true;
    } catch (error) {
      this.logger.error('Webhook通知发送失败', {
        messageId: message.id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private formatMessage(message: NotificationMessage) {
    return {
      id: message.id,
      title: message.title,
      content: message.content,
      level: message.level,
      type: message.type,
      metric: {
        name: message.metricName,
        value: message.value,
        threshold: message.threshold,
        labels: message.labels,
      },
      timestamp: message.timestamp,
    };
  }
}
