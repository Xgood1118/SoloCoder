import fs from 'fs';
import path from 'path';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import { AlertRule, Operator, AlertLevel } from '../types/alerts';

interface ParsedLine {
  metricName: string;
  operator: Operator;
  threshold: number;
  level: AlertLevel;
  duration?: number;
  priority?: number;
}

export class RuleParser {
  private logger: ModuleLogger;

  constructor() {
    this.logger = createModuleLogger('RuleParser');
  }

  parseFile(filePath: string): AlertRule[] {
    const absolutePath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      this.logger.warn('告警规则文件不存在', { filePath: absolutePath });
      return [];
    }

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      this.logger.error('读取告警规则文件失败', {
        error: (error as Error).message,
        filePath: absolutePath,
      });
      return [];
    }
  }

  parseContent(content: string): AlertRule[] {
    const lines = content.split('\n');
    const rules: AlertRule[] = [];
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        continue;
      }

      try {
        const parsed = this.parseLine(trimmedLine);
        const rule = this.buildRule(parsed, lineNumber);
        rules.push(rule);
      } catch (error) {
        this.logger.warn('解析告警规则失败，跳过该条规则', {
          line: lineNumber,
          content: trimmedLine,
          error: (error as Error).message,
        });
      }
    }

    this.logger.info('告警规则解析完成', { count: rules.length });
    return rules;
  }

  private parseLine(line: string): ParsedLine {
    const parts = line.split('|');

    if (parts.length < 4) {
      throw new Error(`格式错误，需要至少4个字段，实际有${parts.length}个`);
    }

    const metricName = parts[0].trim();
    const operatorStr = parts[1].trim();
    const thresholdStr = parts[2].trim();
    const levelStr = parts[3].trim();

    if (!metricName) {
      throw new Error('指标名不能为空');
    }

    const operator = this.parseOperator(operatorStr);
    const threshold = this.parseThreshold(thresholdStr);
    const level = this.parseLevel(levelStr);

    const result: ParsedLine = {
      metricName,
      operator,
      threshold,
      level,
    };

    if (parts.length > 4) {
      const durationStr = parts[4].trim();
      if (durationStr) {
        result.duration = parseInt(durationStr, 10);
        if (isNaN(result.duration)) {
          throw new Error(`持续周期格式错误: ${durationStr}`);
        }
      }
    }

    if (parts.length > 5) {
      const priorityStr = parts[5].trim();
      if (priorityStr) {
        result.priority = parseInt(priorityStr, 10);
        if (isNaN(result.priority)) {
          throw new Error(`优先级格式错误: ${priorityStr}`);
        }
      }
    }

    return result;
  }

  private parseOperator(str: string): Operator {
    const operatorMap: Record<string, Operator> = {
      '>': 'gt',
      'gt': 'gt',
      '<': 'lt',
      'lt': 'lt',
      '=': 'eq',
      '==': 'eq',
      'eq': 'eq',
      '!=': 'ne',
      '<>': 'ne',
      'ne': 'ne',
      'outside': 'outside',
      '区间外': 'outside',
    };

    const operator = operatorMap[str.toLowerCase()];
    if (!operator) {
      throw new Error(`不支持的操作符: ${str}`);
    }

    return operator;
  }

  private parseThreshold(str: string): number {
    const value = parseFloat(str);
    if (isNaN(value)) {
      throw new Error(`阈值格式错误: ${str}`);
    }
    return value;
  }

  private parseLevel(str: string): AlertLevel {
    const levelMap: Record<string, AlertLevel> = {
      info: 'info',
      提示: 'info',
      warning: 'warning',
      warn: 'warning',
      警告: 'warning',
      critical: 'critical',
      error: 'critical',
      严重: 'critical',
      紧急: 'critical',
    };

    const level = levelMap[str.toLowerCase()];
    if (!level) {
      throw new Error(`不支持的告警级别: ${str}`);
    }

    return level;
  }

  private buildRule(parsed: ParsedLine, lineNumber: number): AlertRule {
    const warningThreshold = parsed.threshold * 0.9;
    const criticalThreshold = parsed.threshold;

    return {
      id: `rule-${lineNumber}-${Date.now()}`,
      metricName: parsed.metricName,
      operator: parsed.operator,
      thresholds: {
        warning: warningThreshold,
        critical: criticalThreshold,
      },
      duration: parsed.duration || 3,
      level: parsed.level,
      priority: parsed.priority || this.getDefaultPriority(parsed.level),
      labels: {},
      enabled: true,
    };
  }

  private getDefaultPriority(level: AlertLevel): number {
    const priorities: Record<AlertLevel, number> = {
      info: 100,
      warning: 200,
      critical: 300,
    };
    return priorities[level];
  }
}
