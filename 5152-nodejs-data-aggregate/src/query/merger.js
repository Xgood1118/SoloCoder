function toKeyPart(value) {
  if (value === undefined) return '__UNDEFINED__';
  return JSON.stringify(value);
}

function buildJoinKey(row, fields) {
  return fields.map(f => toKeyPart(row[f])).join('||');
}

function isNullish(value) {
  return value === null || value === undefined;
}

function mergeResults(subQueryResults, joinConfig) {
  const { joinFields, joinType, nullHandling } = joinConfig;

  if (subQueryResults.length === 0) return [];

  if (subQueryResults.length === 1) {
    const { datasourceId, data } = subQueryResults[0];
    return data.map(row => ({ ...row, _source: [datasourceId] }));
  }

  const fieldsByDs = {};
  for (const jf of joinFields) {
    if (!fieldsByDs[jf.datasourceId]) fieldsByDs[jf.datasourceId] = [];
    fieldsByDs[jf.datasourceId].push(jf.field);
  }

  const allFieldNamesByDs = {};
  for (const sq of subQueryResults) {
    const fieldSet = new Set();
    for (const row of sq.data) {
      for (const key of Object.keys(row)) {
        fieldSet.add(key);
      }
    }
    allFieldNamesByDs[sq.datasourceId] = Array.from(fieldSet);
  }

  const conflictingFields = new Set();
  const fieldToDs = {};
  for (const dsId of Object.keys(allFieldNamesByDs)) {
    for (const field of allFieldNamesByDs[dsId]) {
      if (!fieldToDs[field]) fieldToDs[field] = [];
      fieldToDs[field].push(dsId);
    }
  }
  for (const field of Object.keys(fieldToDs)) {
    if (fieldToDs[field].length > 1) conflictingFields.add(field);
  }

  function shouldDrop(row, datasourceId) {
    if (nullHandling !== 'drop') return false;
    const fields = fieldsByDs[datasourceId] || [];
    return fields.some(f => isNullish(row[f]));
  }

  const dsMaps = {};
  for (const sq of subQueryResults) {
    const { datasourceId, data } = sq;
    const map = new Map();
    for (const row of data) {
      if (shouldDrop(row, datasourceId)) continue;
      const key = buildJoinKey(row, fieldsByDs[datasourceId] || []);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    dsMaps[datasourceId] = map;
  }

  const firstDsId = subQueryResults[0].datasourceId;
  const firstData = subQueryResults[0].data.filter(row => !shouldDrop(row, firstDsId));
  const otherDsIds = subQueryResults.slice(1).map(sq => sq.datasourceId);

  function prefixField(field, dsId) {
    return conflictingFields.has(field) ? `${dsId}_${field}` : field;
  }

  function buildRowFromDs(row, dsId) {
    const result = {};
    for (const [key, value] of Object.entries(row)) {
      result[prefixField(key, dsId)] = value;
    }
    return result;
  }

  function buildNullRowForDs(dsId) {
    const result = {};
    for (const field of allFieldNamesByDs[dsId]) {
      result[prefixField(field, dsId)] = null;
    }
    return result;
  }

  const merged = [];

  for (const firstRow of firstData) {
    const firstKey = buildJoinKey(firstRow, fieldsByDs[firstDsId] || []);

    const matchEntries = [];
    let allMatched = true;

    for (const dsId of otherDsIds) {
      const matches = dsMaps[dsId].get(firstKey) || [];
      if (matches.length === 0) {
        allMatched = false;
        if (joinType === 'inner') break;
      }
      matchEntries.push({ dsId, matches });
    }

    if (joinType === 'inner' && !allMatched) continue;

    const firstPart = buildRowFromDs(firstRow, firstDsId);

    let combos = [{ row: firstPart, sources: [firstDsId] }];

    for (const { dsId, matches } of matchEntries) {
      if (matches.length > 0) {
        const newCombos = [];
        for (const combo of combos) {
          for (const matchRow of matches) {
            const matchPart = buildRowFromDs(matchRow, dsId);
            newCombos.push({
              row: { ...combo.row, ...matchPart },
              sources: [...combo.sources, dsId],
            });
          }
        }
        combos = newCombos;
      } else {
        const nullPart = buildNullRowForDs(dsId);
        for (const combo of combos) {
          combo.row = { ...combo.row, ...nullPart };
        }
      }
    }

    for (const combo of combos) {
      merged.push({ ...combo.row, _source: combo.sources });
    }
  }

  return merged;
}

function reorderFields(rows, fieldOrder) {
  if (!fieldOrder || fieldOrder.length === 0) return rows;

  return rows.map(row => {
    const ordered = {};
    for (const field of fieldOrder) {
      if (field in row) {
        ordered[field] = row[field];
      }
    }
    for (const key of Object.keys(row)) {
      if (!(key in ordered)) {
        ordered[key] = row[key];
      }
    }
    return ordered;
  });
}

function groupResults(rows, groupByFields) {
  if (!groupByFields || groupByFields.length === 0) return rows;

  const groups = new Map();

  for (const row of rows) {
    const key = groupByFields.map(f => toKeyPart(row[f])).join('||');
    if (!groups.has(key)) {
      const groupBy = {};
      for (const field of groupByFields) {
        groupBy[field] = row[field];
      }
      groups.set(key, { groupBy, count: 0, rows: [] });
    }
    const group = groups.get(key);
    group.count += 1;
    group.rows.push(row);
  }

  return Array.from(groups.values());
}

module.exports = { mergeResults, reorderFields, groupResults };
