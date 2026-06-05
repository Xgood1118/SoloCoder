import crypto from 'crypto';
import axios from 'axios';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import { NotificationMessage, NotificationChannel, DingTalkConfig } from '../types/notifications';
import { AlertLevel } from '../types/alerts';

export class DingTalkChannel implements NotificationChannel {
  readonly name = 'dingtalk';
  readonly type = 'dingtalk' as const;
  readonly enabled: boolean;
  readonly levels: AlertLevel[];

  private logger: ModuleLogger;
  private config: DingTalkConfig;

  constructor(config: DingTalkConfig, enabled: boolean, levels: AlertLevel[]) {
    this.logger = createModuleLogger('DingTalk');
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
      const url = this.buildSignedUrl();
      const payload = this.buildPayload(markdown, message);

      await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      this.logger.debug('钉钉通知发送成功', { messageId: message.id });
      return true;
    } catch (error) {
      this.logger.error('钉钉通知发送失败', {
        messageId: message.id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private buildSignedUrl(): string {
    if (!this.config.secret) {
      return this.config.webhookUrl;
    }

    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${this.config.secret}`;
    const sign = crypto
      .createHmac('sha256', this.config.secret)
      .update(stringToSign)
      .digest('base64');
    const encodedSign = encodeURIComponent(sign);

    return `${this.config.webhookUrl}&timestamp=${timestamp}&sign=${encodedSign}`;
  }

  private formatMessage(message: NotificationMessage): string {
    const statusEmoji = message.type === 'triggered' ? '🔴' : '🟢';
    const statusText = message.type === 'triggered' ? '告警触发' : '告警恢复';
    const levelText = this.getLevelText(message.level);

    return `
${statusEmoji} **${statusText} - ${levelText}**

**指标名**: ${message.metricName}
**当前值**: ${message.value.toFixed(2)}
**阈值**: ${message.threshold.toFixed(2)}
**时间**: ${new Date(message.timestamp).toLocaleString('zh-CN')}

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
        title: `告警通知 - ${this.getLevelText(message.level)}`,
        text: markdown,
      },
    };

    if (message.level === 'critical' || this.config.isAtAll) {
      payload.at = {
        isAtAll: true,
      };
    } else if (this.config.atMobiles) {
      payload.at = {
        atMobiles: this.config.atMobiles,
      };
    }

    return payload;
  }
}
