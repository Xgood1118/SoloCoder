const { createErrorTracker } = require('../src/error');
const logger = require('../src/utils/logger');

describe('ErrorTracker', () => {
  test('should track consecutive failures', () => {
    const tracker = createErrorTracker({ consecutiveFailureThreshold: 3, logger });

    tracker.recordError('ds1', new Error('fail1'));
    tracker.recordError('ds1', new Error('fail2'));

    expect(tracker.getConsecutiveFailures('ds1')).toBe(2);
    expect(tracker.shouldAlert('ds1')).toBe(false);
  });

  test('should trigger alert when threshold reached', () => {
    const tracker = createErrorTracker({ consecutiveFailureThreshold: 3, logger });

    tracker.recordError('ds1', new Error('fail1'));
    tracker.recordError('ds1', new Error('fail2'));
    tracker.recordError('ds1', new Error('fail3'));

    expect(tracker.shouldAlert('ds1')).toBe(true);
  });

  test('should reset consecutive failures on success', () => {
    const tracker = createErrorTracker({ consecutiveFailureThreshold: 3, logger });

    tracker.recordError('ds1', new Error('fail1'));
    tracker.recordError('ds1', new Error('fail2'));
    tracker.recordSuccess('ds1');

    expect(tracker.getConsecutiveFailures('ds1')).toBe(0);
    expect(tracker.shouldAlert('ds1')).toBe(false);
  });

  test('should return error stats', () => {
    const tracker = createErrorTracker({ consecutiveFailureThreshold: 5, logger });

    tracker.recordError('ds1', new Error('fail1'));
    tracker.recordError('ds1', new Error('fail2'));

    const stats = tracker.getStats('ds1');
    expect(stats.totalErrors).toBe(2);
    expect(stats.consecutiveFailures).toBe(2);
    expect(stats.lastError.message).toBe('fail2');
  });

  test('should limit returned errors', () => {
    const tracker = createErrorTracker({ consecutiveFailureThreshold: 100, logger });

    for (let i = 0; i < 10; i++) {
      tracker.recordError('ds1', new Error(`fail${i}`));
    }

    const errors = tracker.getErrors('ds1', 3);
    expect(errors.length).toBe(3);
    expect(errors[2].message).toBe('fail9');
  });

  test('should track errors independently per datasource', () => {
    const tracker = createErrorTracker({ consecutiveFailureThreshold: 2, logger });

    tracker.recordError('ds1', new Error('fail1'));
    tracker.recordError('ds2', new Error('fail2'));
    tracker.recordError('ds2', new Error('fail3'));

    expect(tracker.getConsecutiveFailures('ds1')).toBe(1);
    expect(tracker.getConsecutiveFailures('ds2')).toBe(2);
    expect(tracker.shouldAlert('ds2')).toBe(true);
    expect(tracker.shouldAlert('ds1')).toBe(false);
  });
});
