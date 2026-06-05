import axios from 'axios';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import { NotificationMessage, NotificationChannel, WeChatWorkConfig } from '../types/notifications';
import { AlertLevel } from '../types/alerts';

export class WeChatWorkChannel implements NotificationChannel {
  readonly name = 'wechat_work';
  readonly type = 'wechat_work' as const;
  readonly enabled: boolean;
  readonly levels: AlertLevel[];

  private logger: ModuleLogger;
  private config: WeChatWorkConfig;

  constructor(config: WeChatWorkConfig, enabled: boolean, levels: AlertLevel[]) {
    this.logger = createModuleLogger('WeChatWork');
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
      const markdown = this.formatMessage(message);
      const payload = this.buildPayload(markdown, message);

      await axios.post(this.config.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      this.logger.debug('企业微信通知发送成功', { messageId: message.id });
      return true;
    } catch (error) {
      this.logger.error('企业微信通知发送失败', {
        messageId: message.id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private formatMessage(message: NotificationMessage): string {
    const statusEmoji = message.type === 'triggered' ? '🔴' : '🟢';
    const statusText = message.type === 'triggered' ? '告警触发' : '告警恢复';
    const levelText = this.getLevelText(message.level);

    return `
${statusEmoji} **${statusText} - ${levelText}**

> **指标名**: ${message.metricName}
> **当前值**: ${message.value.toFixed(2)}
> **阈值**: ${message.threshold.toFixed(2)}
> **时间**: ${new Date(message.timestamp).toLocaleString('zh-CN')}

**标签**:
${Object.entries(message.labels)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
`.trim();
  }

  private getLevelText(level: AlertLevel): string {
    const texts: Record<AlertLevel, string> = {
      info: '提示',
      warning: '警告',
      critical: '严重',
    };
    return texts[level];
  }

  private buildPayload(markdown: string, message: NotificationMessage) {
    const payload: any = {
      msgtype: 'markdown',
      markdown: {
        content: markdown,
      },
    };

    if (message.level === 'critical') {
      payload.markdown.mentioned_list = this.config.mentionedList || ['@all'];
    }

    return payload;
  }
}
