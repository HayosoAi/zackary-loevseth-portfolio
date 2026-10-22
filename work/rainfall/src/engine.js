/* Exact hundredth-inch accumulation. Ratios/conversion use Number at display time. */
(function (root) {
  'use strict';
  const WINDOWS = [1, 3, 6, 12, 24];
  const REFERENCES = {
    '2019–2023': [2019, 2020, 2021, 2022, 2023],
    '2020–2021': [2020, 2021],
    '2020–2023': [2020, 2021, 2022, 2023],
    '2022–2023': [2022, 2023]
  };
  function hundredths(value) {
    if (typeof value !== 'string' || !/^\d+\.\d{2}$/.test(value)) throw Error('Expected nonnegative hundredth-inch string');
    const n = Number(value.replace('.', ''));
    if (!Number.isSafeInteger(n)) throw Error('Amount outside exact integer range');
    return n;
  }
  function createIndex(monthly) {
    const index = new Map();
    for (const row of monthly) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || index.has(row.month)) throw Error('Invalid or duplicate month');
      const value = row.inches === null ? null : hundredths(row.inches);
      index.set(row.month, {hundredths: value, trace_count: row.trace_count, days: row.days});
    }
    return index;
  }
  function monthKeys(year, count) {
    if (!Number.isInteger(year) || !Number.isInteger(count) || count < 1) throw Error('Invalid calendar window');
    const end = year * 12 + 11;
    return Array.from({length: count}, (_, k) => {
      const i = end - count + 1 + k;
      return `${Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`;
    });
  }
  function aggregate(index, keys) {
    if (!keys.length || new Set(keys).size !== keys.length) throw Error('Empty or duplicate requested month');
    const missing = keys.filter(k => !index.has(k) || index.get(k).hundredths === null);
    const partial = keys.reduce((s, k) => s + (index.has(k) ? index.get(k).hundredths || 0 : 0), 0);
    return {start: keys[0], end: keys[keys.length - 1], expected: keys.length,
      observed: keys.length - missing.length, missing, partial: partial / 100,
      total: missing.length ? null : partial / 100, cents: missing.length ? null : partial,
      trace_count: keys.reduce((s, k) => s + (index.get(k)?.trace_count || 0), 0)};
  }
  function percent(target, mean) {
    return target === null || mean === null || mean === 0 ? null : 100 * (target / mean - 1);
  }
  function compare(index, count, reference) {
    if (!WINDOWS.includes(count) || !Object.hasOwn(REFERENCES, reference)) throw Error('Undeclared comparison');
    const target = aggregate(index, monthKeys(2024, count));
    const members = REFERENCES[reference].map(year => ({year, ...aggregate(index, monthKeys(year, count))}));
    const complete = members.filter(x => x.total !== null).length;
    // Do not average a reduced reference set when a requested member is incomplete.
    const mean = complete !== members.length ? null : members.reduce((s, m) => s + m.cents, 0) / members.length / 100;
    const pct = percent(target.total, mean);
    return {count, reference, target, members, mean, complete, requested: members.length,
      eligible: target.total !== null && complete === members.length,
      difference: target.total === null || mean === null ? null : target.total - mean,
      percent: pct, direction: pct === null ? null : pct > 0 ? 'above' : pct < 0 ? 'below' : 'equal'};
  }
  function synthetic(index, month) {
    if (!monthKeys(2024, 12).includes(month)) throw Error('Mask must be a 2024 month');
    const truth = aggregate(index, monthKeys(2024, 12));
    const known = index.get(month)?.hundredths;
    if (truth.total === null || known === null || known === undefined) throw Error('Synthetic mask requires complete known data');
    const masked = new Map(index);
    masked.set(month, {...index.get(month), hundredths: null});
    const partial = aggregate(masked, monthKeys(2024, 12));
    const reference = compare(index, 12, '2019–2023').mean;
    return {month, withheld: known / 100, truth: truth.total, strict: partial.total,
      observed: partial.observed, partial: partial.partial, zeroFill: partial.partial,
      scaled: partial.partial * 12 / 11, lowerBound: partial.partial, upperBound: null,
      reference, direction: partial.partial > reference ? 'above' : 'not_identified'};
  }
  function convert(value, unit) {
    if (!['in', 'mm'].includes(unit)) throw Error('Unsupported unit');
    return value === null ? null : value * (unit === 'mm' ? 25.4 : 1);
  }
  const api = Object.freeze({WINDOWS, REFERENCES, hundredths, createIndex, monthKeys, aggregate, percent, compare, synthetic, convert});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rainfall = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
