import { EventEmitter } from 'events';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import config from '../config/env';
import { NotificationChannel, NotificationMessage } from '../types/notifications';
import { WeChatWorkChannel } from './WeChatWorkChannel';
import { EmailChannel } from './EmailChannel';
import { DingTalkChannel } from './DingTalkChannel';
import { WebhookChannel } from './WebhookChannel';
import { AlertLevel } from '../types/alerts';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class NotificationManager extends EventEmitter {
  private logger: ModuleLogger;
  private channels: NotificationChannel[] = [];

  constructor() {
    super();
    this.logger = createModuleLogger('NotificationManager');
    this.initializeChannels();
  }

  private initializeChannels(): void {
    const defaultLevels: AlertLevel[] = ['warning', 'critical'];

    if (config.wechatWorkEnabled && config.wechatWorkWebhook) {
      this.channels.push(
        new WeChatWorkChannel(
          {
            webhookUrl: config.wechatWorkWebhook,
          },
          config.wechatWorkEnabled,
          defaultLevels
        )
      );
      this.logger.info('企业微信通知渠道已启用');
    }

    if (config.emailEnabled && config.emailTo) {
      this.channels.push(
        new EmailChannel(
          {
            smtpHost: config.emailSmtpHost,
            smtpPort: config.emailSmtpPort,
            smtpSecure: config.emailSmtpSecure,
            user: config.emailUser,
            password: config.emailPassword,
            from: config.emailFrom,
            to: config.emailTo.split(','),
          },
          config.emailEnabled,
          defaultLevels
        )
      );
      this.logger.info('邮件通知渠道已启用');
    }

    if (config.dingtalkEnabled && config.dingtalkWebhook) {
      this.channels.push(
        new DingTalkChannel(
          {
            webhookUrl: config.dingtalkWebhook,
            secret: config.dingtalkSecret,
            isAtAll: true,
          },
          config.dingtalkEnabled,
          defaultLevels
        )
      );
      this.logger.info('钉钉通知渠道已启用');
    }

    if (config.webhookEnabled && config.webhookUrl) {
      this.channels.push(
        new WebhookChannel(
          {
            url: config.webhookUrl,
            method: config.webhookMethod as 'GET' | 'POST' | 'PUT',
            timeout: config.webhookTimeout,
          },
          config.webhookEnabled,
          defaultLevels
        )
      );
      this.logger.info('Webhook通知渠道已启用');
    }

    this.logger.info(`已启用 ${this.channels.length} 个通知渠道`);
  }

  async sendNotification(message: NotificationMessage): Promise<void> {
    this.logger.info('发送告警通知', {
      messageId: message.id,
      metric: message.metricName,
      level: message.level,
      channelCount: this.channels.length,
    });

    const promises = this.channels.map((channel) =>
      this.sendWithRetry(channel, message)
    );

    await Promise.allSettled(promises);
  }

  private async sendWithRetry(
    channel: NotificationChannel,
    message: NotificationMessage
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const success = await channel.send(message);
        if (success) {
          return true;
        }

        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY * attempt);
          this.logger.warn(`通知重试 ${attempt}/${MAX_RETRIES}`, {
            channel: channel.name,
            messageId: message.id,
          });
        }
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY * attempt);
          this.logger.warn(`通知重试 ${attempt}/${MAX_RETRIES}`, {
            channel: channel.name,
            messageId: message.id,
            error: (error as Error).message,
          });
        }
      }
    }

    this.logger.error('通知发送失败，已达最大重试次数', {
      channel: channel.name,
      messageId: message.id,
    });
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getChannels(): NotificationChannel[] {
    return [...this.channels];
  }

  addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
    this.logger.info('已添加通知渠道', { channel: channel.name });
  }

  removeChannel(channelName: string): boolean {
    const index = this.channels.findIndex((c) => c.name === channelName);
    if (index !== -1) {
      this.channels.splice(index, 1);
      this.logger.info('已移除通知渠道', { channel: channelName });
      return true;
    }
    return false;
  }
}
