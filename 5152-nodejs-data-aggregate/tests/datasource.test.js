const {
  createDatasource,
  getDatasource,
  getAllDatasources,
  getEnabledDatasources,
  updateDatasource,
  deleteDatasource,
  setEnabled,
  incrementFailure,
  incrementSuccess,
  getErrorRate,
  VALID_TYPES,
} = require('../src/models/datasource');

describe('Datasource Model', () => {
  beforeEach(() => {
    const all = getAllDatasources();
    for (const ds of all) {
      deleteDatasource(ds.id);
    }
  });

  test('should create a datasource with valid data', () => {
    const ds = createDatasource({
      name: 'Test MySQL',
      type: 'mysql',
      connection: { host: 'localhost', port: 3306, database: 'test', user: 'root', password: 'secret' },
      queryPermissions: ['users', 'orders'],
    });

    expect(ds.id).toBeDefined();
    expect(ds.name).toBe('Test MySQL');
    expect(ds.type).toBe('mysql');
    expect(ds.enabled).toBe(true);
    expect(ds.consecutiveFailures).toBe(0);
  });

  test('should reject invalid type', () => {
    expect(() => createDatasource({ name: 'Bad', type: 'oracle', connection: {} })).toThrow('Invalid datasource type');
  });

  test('should reject missing name', () => {
    expect(() => createDatasource({ type: 'mysql', connection: {} })).toThrow('name is required');
  });

  test('should reject missing connection', () => {
    expect(() => createDatasource({ name: 'Test', type: 'mysql' })).toThrow('Connection info is required');
  });

  test('should enable/disable datasource', () => {
    const ds = createDatasource({
      name: 'Test',
      type: 'mysql',
      connection: { host: 'localhost', port: 3306 },
    });

    const disabled = setEnabled(ds.id, false);
    expect(disabled.enabled).toBe(false);
    expect(getEnabledDatasources().length).toBe(0);

    const enabled = setEnabled(ds.id, true);
    expect(enabled.enabled).toBe(true);
    expect(getEnabledDatasources().length).toBe(1);
  });

  test('should track failure and success counts', () => {
    const ds = createDatasource({
      name: 'Test',
      type: 'mysql',
      connection: { host: 'localhost', port: 3306 },
    });

    incrementFailure(ds.id);
    incrementFailure(ds.id);
    expect(getDatasource(ds.id).consecutiveFailures).toBe(2);
    expect(getDatasource(ds.id).totalFailures).toBe(2);

    incrementSuccess(ds.id);
    expect(getDatasource(ds.id).consecutiveFailures).toBe(0);
    expect(getDatasource(ds.id).totalQueries).toBe(3);
  });

  test('should calculate error rate', () => {
    const ds = createDatasource({
      name: 'Test',
      type: 'mysql',
      connection: { host: 'localhost', port: 3306 },
    });

    expect(getErrorRate(ds.id)).toBe(0);

    incrementSuccess(ds.id);
    incrementFailure(ds.id);
    expect(getErrorRate(ds.id)).toBe(0.5);
  });

  test('should delete datasource', () => {
    const ds = createDatasource({
      name: 'Test',
      type: 'mysql',
      connection: { host: 'localhost', port: 3306 },
    });

    expect(deleteDatasource(ds.id)).toBe(true);
    expect(getDatasource(ds.id)).toBeUndefined();
  });

  test('should update datasource', () => {
    const ds = createDatasource({
      name: 'Test',
      type: 'mysql',
      connection: { host: 'localhost', port: 3306 },
    });

    const updated = updateDatasource(ds.id, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
  });

  test('should list all valid types', () => {
    expect(VALID_TYPES).toEqual(['mysql', 'postgresql', 'mongodb', 'rest_api']);
  });
});
