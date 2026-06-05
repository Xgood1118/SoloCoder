import { AlertLevel, MetricLabels } from './alerts';

export type NotificationChannelType = 'wechat_work' | 'email' | 'dingtalk' | 'webhook';

export interface NotificationMessage {
  id: string;
  title: string;
  content: string;
  level: AlertLevel;
  metricName: string;
  value: number;
  threshold: number;
  labels: MetricLabels;
  timestamp: number;
  type: 'triggered' | 'resolved';
}

export interface NotificationChannel {
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  levels: AlertLevel[];
  send(message: NotificationMessage): Promise<boolean>;
}

export interface ChannelConfig {
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  levels: AlertLevel[];
  config: Record<string, string>;
}

export interface WeChatWorkConfig {
  webhookUrl: string;
  mentionedList?: string[];
  mentionedMobileList?: string[];
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  user: string;
  password: string;
  from: string;
  to: string[];
}

export interface DingTalkConfig {
  webhookUrl: string;
  secret?: string;
  atMobiles?: string[];
  atUserIds?: string[];
  isAtAll?: boolean;
}

export interface WebhookConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
}
