const { createConcurrencyController, TimeoutError } = require('../src/concurrency');

describe('ConcurrencyController', () => {
  test('should acquire and release slots', async () => {
    const controller = createConcurrencyController({
      globalMaxConcurrent: 2,
      defaultDatasourceMaxConcurrent: 2,
    });

    controller.setDatasourceMaxConcurrent('ds1', 2);
    const release = await controller.acquire('ds1');
    const stats = controller.getStats();
    expect(stats.globalActive).toBe(1);
    expect(stats.perDatasource.ds1.active).toBe(1);

    release();
    const statsAfter = controller.getStats();
    expect(statsAfter.globalActive).toBe(0);
  });

  test('should queue when datasource limit reached', async () => {
    const controller = createConcurrencyController({
      globalMaxConcurrent: 10,
      defaultDatasourceMaxConcurrent: 1,
    });

    const release1 = await controller.acquire('ds1');
    let slot2Acquired = false;

    const acquirePromise = controller.acquire('ds1').then((release) => {
      slot2Acquired = true;
      return release;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(slot2Acquired).toBe(false);

    release1();

    const release2 = await acquirePromise;
    expect(slot2Acquired).toBe(true);
    release2();
  });

  test('should timeout when waiting too long', async () => {
    const controller = createConcurrencyController({
      globalMaxConcurrent: 1,
      defaultDatasourceMaxConcurrent: 1,
      queryTimeoutMs: 100,
    });

    const release1 = await controller.acquire('ds1');

    await expect(controller.acquire('ds1')).rejects.toThrow('timed out');

    release1();
  });

  test('should set per-datasource max concurrent', async () => {
    const controller = createConcurrencyController({
      globalMaxConcurrent: 10,
      defaultDatasourceMaxConcurrent: 1,
    });

    controller.setDatasourceMaxConcurrent('ds1', 3);

    const r1 = await controller.acquire('ds1');
    const r2 = await controller.acquire('ds1');
    const r3 = await controller.acquire('ds1');

    const stats = controller.getStats();
    expect(stats.perDatasource.ds1.active).toBe(3);

    r1();
    r2();
    r3();
  });

  test('should enforce global limit', async () => {
    const controller = createConcurrencyController({
      globalMaxConcurrent: 2,
      defaultDatasourceMaxConcurrent: 10,
    });

    const r1 = await controller.acquire('ds1');
    const r2 = await controller.acquire('ds2');

    let ds3Acquired = false;
    const p = controller.acquire('ds3').then((r) => {
      ds3Acquired = true;
      return r;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ds3Acquired).toBe(false);

    r1();

    const r3 = await p;
    expect(ds3Acquired).toBe(true);

    r2();
    r3();
  });
});
