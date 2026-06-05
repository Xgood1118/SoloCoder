import nodemailer from 'nodemailer';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import { NotificationMessage, NotificationChannel, EmailConfig } from '../types/notifications';
import { AlertLevel } from '../types/alerts';

export class EmailChannel implements NotificationChannel {
  readonly name = 'email';
  readonly type = 'email' as const;
  readonly enabled: boolean;
  readonly levels: AlertLevel[];

  private logger: ModuleLogger;
  private config: EmailConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: EmailConfig, enabled: boolean, levels: AlertLevel[]) {
    this.logger = createModuleLogger('Email');
    this.config = config;
    this.enabled = enabled;
    this.levels = levels;

    if (enabled) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.user,
          pass: this.config.password,
        },
      });
    } catch (error) {
      this.logger.error('邮件服务初始化失败', { error: (error as Error).message });
      this.transporter = null;
    }
  }

  async send(message: NotificationMessage): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      return false;
    }

    if (!this.levels.includes(message.level)) {
      return false;
    }

    try {
      const subject = this.formatSubject(message);
      const html = this.formatMessage(message);

      await this.transporter.sendMail({
        from: this.config.from,
        to: this.config.to.join(','),
        subject,
        html,
      });

      this.logger.debug('邮件通知发送成功', { messageId: message.id });
      return true;
    } catch (error) {
      this.logger.error('邮件通知发送失败', {
        messageId: message.id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private formatSubject(message: NotificationMessage): string {
    const statusText = message.type === 'triggered' ? '告警触发' : '告警恢复';
    const levelText = this.getLevelText(message.level);
    return `[${statusText}] ${levelText} - ${message.metricName}`;
  }

  private formatMessage(message: NotificationMessage): string {
    const statusColor = message.type === 'triggered' ? '#dc3545' : '#28a745';
    const statusText = message.type === 'triggered' ? '告警触发' : '告警恢复';
    const levelText = this.getLevelText(message.level);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { background: ${statusColor}; color: white; padding: 15px; border-radius: 5px; }
    .content { margin-top: 20px; }
    .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
    .label { font-weight: bold; margin-right: 10px; }
    .tags { margin-top: 15px; }
    .tag { display: inline-block; background: #e9ecef; padding: 3px 8px; margin: 2px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${statusText} - ${levelText}</h2>
  </div>
  <div class="content">
    <div class="metric">
      <p><span class="label">指标名:</span> ${message.metricName}</p>
      <p><span class="label">当前值:</span> ${message.value.toFixed(2)}</p>
      <p><span class="label">阈值:</span> ${message.threshold.toFixed(2)}</p>
      <p><span class="label">时间:</span> ${new Date(message.timestamp).toLocaleString('zh-CN')}</p>
    </div>
    <div class="tags">
      ${Object.entries(message.labels)
        .map(([k, v]) => `<span class="tag">${k}: ${v}</span>`)
        .join('')}
    </div>
  </div>
</body>
</html>
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
}
