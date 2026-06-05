import { v4 as uuidv4 } from 'uuid';
import type {
  AlertRule,
  AlertEvent,
  AlertCondition,
  AggregationResult,
  AlertStatus,
  LogicalOperator,
} from '../types';

interface ConditionState {
  conditionId: string;
  currentValue: number | null;
  isSatisfied: boolean;
  firstSatisfiedAt: number | null;
  lastSatisfiedAt: number | null;
}

interface RuleState {
  ruleId: string;
  conditions: Map<string, ConditionState>;
  activeAlertId: string | null;
  isCurrentlyFiring: boolean;
  lastEvaluationAt: number;
}

export interface AlertEventCallback {
  (event: AlertEvent): void;
}

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private ruleStates: Map<string, RuleState> = new Map();
  private alertEvents: Map<string, AlertEvent> = new Map();
  private callback: AlertEventCallback;

  constructor(callback: AlertEventCallback) {
    this.callback = callback;
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.initializeRuleState(rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.ruleStates.delete(ruleId);
  }

  updateRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.initializeRuleState(rule);
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  processAggregationResults(results: AggregationResult[]): void {
    for (const result of results) {
      this.processSingleResult(result);
    }
  }

  private processSingleResult(result: AggregationResult): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      this.evaluateRule(rule, result);
    }
  }

  private evaluateRule(rule: AlertRule, result: AggregationResult): void {
    const state = this.ruleStates.get(rule.id);
    if (!state) return;

    for (const condition of rule.conditions) {
      if (!this.matchCondition(condition, result)) continue;

      const conditionId = this.getConditionId(condition);
      const conditionState = state.conditions.get(conditionId);
      if (!conditionState) continue;

      conditionState.currentValue = result.value;
      conditionState.lastSatisfiedAt = Date.now();

      const isSatisfied = this.checkConditionThreshold(condition, result.value);

      if (isSatisfied) {
        if (!conditionState.isSatisfied) {
          conditionState.firstSatisfiedAt = Date.now();
        }
        conditionState.isSatisfied = true;
      } else {
        conditionState.isSatisfied = false;
        conditionState.firstSatisfiedAt = null;
      }
    }

    this.checkRuleFiring(rule, state);
    state.lastEvaluationAt = Date.now();
  }

  private matchCondition(condition: AlertCondition, result: AggregationResult): boolean {
    if (condition.metricName !== result.metricName) return false;
    if (condition.aggregationType !== result.aggregationType) return false;

    if (condition.dimensions) {
      for (const [key, value] of Object.entries(condition.dimensions)) {
        if (result.dimensions[key] !== value) return false;
      }
    }

    return true;
  }

  private checkConditionThreshold(condition: AlertCondition, value: number): boolean {
    if (condition.direction === 'above') {
      return value > condition.threshold;
    } else {
      return value < condition.threshold;
    }
  }

  private checkRuleFiring(rule: AlertRule, state: RuleState): void {
    const allConditions = Array.from(state.conditions.values());
    const satisfiedConditions = allConditions.filter((c) => c.isSatisfied);

    let shouldFire = false;
    if (rule.operator === 'AND') {
      shouldFire = allConditions.every((c) => c.isSatisfied);
    } else {
      shouldFire = satisfiedConditions.length > 0;
    }

    if (shouldFire) {
      const durationSatisfied = this.checkDuration(rule.operator, allConditions);

      if (durationSatisfied && !state.isCurrentlyFiring) {
        this.triggerAlert(rule, state, allConditions);
        state.isCurrentlyFiring = true;
      }
    } else if (state.isCurrentlyFiring) {
      this.resolveAlert(state, allConditions);
      state.isCurrentlyFiring = false;
    }
  }

  private checkDuration(
    operator: LogicalOperator,
    conditions: ConditionState[]
  ): boolean {
    const now = Date.now();

    if (operator === 'AND') {
      return conditions.every((c) => {
        if (!c.firstSatisfiedAt) return false;
        const condition = this.getConditionById(c.conditionId);
        if (!condition) return false;
        return now - c.firstSatisfiedAt >= condition.duration;
      });
    } else {
      return conditions.some((c) => {
        if (!c.firstSatisfiedAt) return false;
        const condition = this.getConditionById(c.conditionId);
        if (!condition) return false;
        return now - c.firstSatisfiedAt >= condition.duration;
      });
    }
  }

  private triggerAlert(
    rule: AlertRule,
    state: RuleState,
    conditions: ConditionState[]
  ): void {
    const metricValues: Record<string, number> = {};
    const thresholdValues: Record<string, number> = {};

    for (const cond of conditions) {
      const condition = this.getConditionById(cond.conditionId);
      if (condition) {
        metricValues[condition.metricName] = cond.currentValue || 0;
        thresholdValues[condition.metricName] = condition.threshold;
      }
    }

    const event: AlertEvent = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      level: rule.level,
      status: 'active',
      triggeredAt: Date.now(),
      metricValues,
      thresholdValues,
      duration: 0,
    };

    this.alertEvents.set(event.id, event);
    state.activeAlertId = event.id;
    this.callback(event);
  }

  private resolveAlert(state: RuleState, conditions: ConditionState[]): void {
    if (!state.activeAlertId) return;

    const event = this.alertEvents.get(state.activeAlertId);
    if (!event) return;

    event.status = 'resolved';
    event.resolvedAt = Date.now();
    event.duration = event.resolvedAt - event.triggeredAt;

    this.callback(event);
    state.activeAlertId = null;
  }

  acknowledgeAlert(alertId: string, notes?: string): void {
    const event = this.alertEvents.get(alertId);
    if (!event) return;

    event.status = 'acknowledged';
    event.acknowledgedAt = Date.now();
    if (notes) {
      event.notes = notes;
    }

    this.callback(event);
  }

  getAlertEvent(alertId: string): AlertEvent | undefined {
    return this.alertEvents.get(alertId);
  }

  getAlertEvents(status?: AlertStatus): AlertEvent[] {
    let events = Array.from(this.alertEvents.values());
    if (status) {
      events = events.filter((e) => e.status === status);
    }
    return events.sort((a, b) => b.triggeredAt - a.triggeredAt);
  }

  private initializeRuleState(rule: AlertRule): void {
    const conditions = new Map<string, ConditionState>();

    for (const condition of rule.conditions) {
      const conditionId = this.getConditionId(condition);
      conditions.set(conditionId, {
        conditionId,
        currentValue: null,
        isSatisfied: false,
        firstSatisfiedAt: null,
        lastSatisfiedAt: null,
      });
    }

    this.ruleStates.set(rule.id, {
      ruleId: rule.id,
      conditions,
      activeAlertId: null,
      isCurrentlyFiring: false,
      lastEvaluationAt: Date.now(),
    });
  }

  private getConditionId(condition: AlertCondition): string {
    const dimStr = condition.dimensions
      ? Object.entries(condition.dimensions)
          .sort()
          .map(([k, v]) => `${k}=${v}`)
          .join('|')
      : '';
    return `${condition.metricName}|${condition.aggregationType}|${dimStr}`;
  }

  private getConditionById(conditionId: string): AlertCondition | null {
    for (const rule of this.rules.values()) {
      for (const condition of rule.conditions) {
        if (this.getConditionId(condition) === conditionId) {
          return condition;
        }
      }
    }
    return null;
  }
}
