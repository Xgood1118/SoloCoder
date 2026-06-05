const { mergeResults, reorderFields, groupResults } = require('../src/query/merger');

describe('Result Merger', () => {
  const ds1Data = [
    { id: 1, name: 'Alice', dept: 'Engineering' },
    { id: 2, name: 'Bob', dept: 'Marketing' },
    { id: 3, name: 'Charlie', dept: 'Engineering' },
  ];

  const ds2Data = [
    { id: 1, salary: 90000, level: 'Senior' },
    { id: 2, salary: 70000, level: 'Junior' },
    { id: 4, salary: 80000, level: 'Mid' },
  ];

  test('inner join - only matching rows', () => {
    const result = mergeResults(
      [
        { datasourceId: 'ds1', data: ds1Data },
        { datasourceId: 'ds2', data: ds2Data },
      ],
      {
        joinFields: [
          { field: 'id', datasourceId: 'ds1' },
          { field: 'id', datasourceId: 'ds2' },
        ],
        joinType: 'inner',
        nullHandling: 'keep_null',
      }
    );

    expect(result.length).toBe(2);
    expect(result.every((r) => r._source.includes('ds1') && r._source.includes('ds2'))).toBe(true);
    expect(result.find((r) => r.name === 'Alice')).toBeDefined();
    expect(result.find((r) => r.name === 'Bob')).toBeDefined();
    expect(result.find((r) => r.name === 'Charlie')).toBeUndefined();
  });

  test('left join - keeps all rows from first datasource', () => {
    const result = mergeResults(
      [
        { datasourceId: 'ds1', data: ds1Data },
        { datasourceId: 'ds2', data: ds2Data },
      ],
      {
        joinFields: [
          { field: 'id', datasourceId: 'ds1' },
          { field: 'id', datasourceId: 'ds2' },
        ],
        joinType: 'left',
        nullHandling: 'keep_null',
      }
    );

    expect(result.length).toBe(3);
    const charlie = result.find((r) => r.name === 'Charlie');
    expect(charlie).toBeDefined();
    expect(charlie.salary).toBeNull();
    expect(charlie._source).toEqual(['ds1']);
  });

  test('null handling drop - removes rows with null join fields', () => {
    const dataWithNull = [
      { id: 1, name: 'Alice' },
      { id: null, name: 'Unknown' },
      { id: 3, name: 'Charlie' },
    ];

    const result = mergeResults(
      [
        { datasourceId: 'ds1', data: dataWithNull },
        { datasourceId: 'ds2', data: ds2Data },
      ],
      {
        joinFields: [
          { field: 'id', datasourceId: 'ds1' },
          { field: 'id', datasourceId: 'ds2' },
        ],
        joinType: 'left',
        nullHandling: 'drop',
      }
    );

    expect(result.find((r) => r.name === 'Unknown')).toBeUndefined();
  });

  test('empty string is NOT treated as null', () => {
    const dataWithEmpty = [
      { id: '', name: 'Empty' },
      { id: 1, name: 'Alice' },
    ];

    const result = mergeResults(
      [
        { datasourceId: 'ds1', data: dataWithEmpty },
        { datasourceId: 'ds2', data: ds2Data },
      ],
      {
        joinFields: [
          { field: 'id', datasourceId: 'ds1' },
          { field: 'id', datasourceId: 'ds2' },
        ],
        joinType: 'left',
        nullHandling: 'drop',
      }
    );

    expect(result.find((r) => r.name === 'Empty')).toBeDefined();
  });

  test('single datasource returns data with source marker', () => {
    const result = mergeResults(
      [{ datasourceId: 'ds1', data: ds1Data }],
      {
        joinFields: [{ field: 'id', datasourceId: 'ds1' }],
        joinType: 'inner',
        nullHandling: 'keep_null',
      }
    );

    expect(result.length).toBe(3);
    expect(result.every((r) => r._source.includes('ds1'))).toBe(true);
  });

  test('multi-field join', () => {
    const dsA = [
      { tenant: 't1', user_id: 1, name: 'Alice' },
      { tenant: 't1', user_id: 2, name: 'Bob' },
      { tenant: 't2', user_id: 1, name: 'Charlie' },
    ];
    const dsB = [
      { tenant: 't1', user_id: 1, role: 'admin' },
      { tenant: 't2', user_id: 1, role: 'viewer' },
    ];

    const result = mergeResults(
      [
        { datasourceId: 'dsA', data: dsA },
        { datasourceId: 'dsB', data: dsB },
      ],
      {
        joinFields: [
          { field: 'tenant', datasourceId: 'dsA' },
          { field: 'tenant', datasourceId: 'dsB' },
          { field: 'user_id', datasourceId: 'dsA' },
          { field: 'user_id', datasourceId: 'dsB' },
        ],
        joinType: 'inner',
        nullHandling: 'keep_null',
      }
    );

    expect(result.length).toBe(2);
    expect(result.find((r) => r.name === 'Alice' && r.role === 'admin')).toBeDefined();
    expect(result.find((r) => r.name === 'Charlie' && r.role === 'viewer')).toBeDefined();
  });
});

describe('reorderFields', () => {
  test('should reorder fields according to fieldOrder', () => {
    const rows = [{ c: 3, a: 1, b: 2 }];
    const result = reorderFields(rows, ['a', 'b']);
    const keys = Object.keys(result[0]);
    expect(keys.indexOf('a')).toBeLessThan(keys.indexOf('b'));
    expect(keys.indexOf('b')).toBeLessThan(keys.indexOf('c'));
  });
});

describe('groupResults', () => {
  test('should group by specified fields', () => {
    const rows = [
      { dept: 'Engineering', name: 'Alice' },
      { dept: 'Engineering', name: 'Bob' },
      { dept: 'Marketing', name: 'Charlie' },
    ];

    const result = groupResults(rows, ['dept']);
    expect(result.length).toBe(2);

    const eng = result.find((g) => g.groupBy.dept === 'Engineering');
    expect(eng.count).toBe(2);

    const mkt = result.find((g) => g.groupBy.dept === 'Marketing');
    expect(mkt.count).toBe(1);
  });
});
