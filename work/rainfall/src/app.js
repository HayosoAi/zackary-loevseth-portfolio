(function () {
  'use strict';
  const data = JSON.parse(document.getElementById('frozen-data').textContent);
  const R = Rainfall, index = R.createIndex(data.monthly);
  const byId = id => document.getElementById(id);
  const referenceNames = Object.keys(R.REFERENCES);
  const monthName = key => new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', {month:'short', year:'numeric', timeZone:'UTC'});
  const range = x => `${monthName(x.start)}–${monthName(x.end)}`;
  let unit = 'in';
  const number = (n, digits) => n === null ? 'Unavailable' : n.toLocaleString('en-US', {minimumFractionDigits:digits, maximumFractionDigits:digits});
  const amount = (n, mean = false) => n === null ? 'Unavailable' : `${number(R.convert(n, unit), mean ? (unit === 'in' ? 4 : 4) : unit === 'in' ? 2 : 3)} ${unit}`;
  const pct = n => n === null ? 'Unavailable' : `${n > 0 ? '+' : ''}${number(n, 6)}%`;
  const table = (caption, headers, rows) => `<table><caption>${caption}</caption><thead><tr>${headers.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((x, i) => i ? `<td>${x}</td>` : `<th scope="row">${x}</th>`).join('')}</tr>`).join('')}</tbody></table>`;
  for (const side of ['a','b']) {
    byId(`window-${side}`).innerHTML = R.WINDOWS.map(n => `<option value="${n}">${n} ${n === 1 ? 'month' : 'months'}</option>`).join('');
    byId(`reference-${side}`).innerHTML = referenceNames.map(x => `<option value="${x}">${x} (${R.REFERENCES[x].length} windows)</option>`).join('');
  }
  const months2024 = data.monthly.filter(x => x.month.startsWith('2024-'));
  byId('mask-month').innerHTML = months2024.map(x => `<option value="${x.month}">${monthName(x.month)}</option>`).join('');
  function selection(side) { return R.compare(index, Number(byId(`window-${side}`).value), byId(`reference-${side}`).value); }
  function totalChart(c, maxValue, side) {
    const w = 480, left = 10, right = 400, plotWidth = right - left;
    const values = [{label:'Target total', value:c.target.total, fill:'#155575'}, {label:'Selected reference mean', value:c.mean, fill:'#6b7f89'}];
    const desc = values.map(x => `${x.label}: ${amount(x.value, x.label.includes('mean'))}`).join('. ');
    const bars = values.map((x, i) => {
      const y = 28 + i * 66;
      return `<text x="10" y="${y}" font-size="12" fill="#172d3a">${x.label}</text><rect x="${left}" y="${y+9}" width="${plotWidth}" height="14" rx="2" fill="#eef2f2"/>${x.value === null ? '' : `<rect x="${left}" y="${y+9}" width="${x.value/maxValue*plotWidth}" height="14" rx="2" fill="${x.fill}"/>`}<text x="10" y="${y+42}" font-size="12" fill="#172d3a">${amount(x.value, i===1)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} 190" role="img" aria-labelledby="chart-${side}-title" aria-describedby="chart-${side}-desc"><title id="chart-${side}-title">Comparison ${side.toUpperCase()}: target total and reference mean (${unit})</title><desc id="chart-${side}-desc">${desc}. Shared scale from zero to ${amount(maxValue)}. Exact values also appear in the comparison text and reference table.</desc>${bars}<line x1="10" y1="162" x2="400" y2="162" stroke="#70848e"/><text x="10" y="180" font-size="11" fill="#495f6a">0 ${unit}</text><text x="400" y="180" text-anchor="end" font-size="11" fill="#495f6a">${amount(maxValue)} · shared maximum</text></svg>`;
  }
  function renderComparison(c, side, maxValue) {
    const missing = c.members.filter(x => x.missing.length);
    const unavailable = missing.length ? `<p class="unavailable"><strong>Reference unavailable.</strong> Endpoint ${missing[0].year} requires ${missing[0].missing.join(', ')}, outside this extract. ${c.complete}/${c.requested} requested windows are complete; the full selected mean stays unavailable. No endpoint is dropped.</p>` : '';
    byId(`result-${side}`).innerHTML = `<p class="result-window">Target: ${range(c.target)} · ${c.count} calendar months</p><p class="result-number ${c.direction || ''}">${pct(c.percent)} <small>${c.direction ? `${c.direction} selected mean` : ''}</small></p><p class="result-description">Target <strong>${amount(c.target.total)}</strong> · reference mean <strong>${amount(c.mean, true)}</strong><br>${c.complete}/${c.requested} requested reference windows complete</p>${unavailable}`;
    byId(`chart-${side}`).innerHTML = totalChart(c, maxValue, side);
    byId(`members-${side}`).innerHTML = table(`Reference endpoint set ${c.reference}; totals in ${unit}`,
      ['Endpoint year','Exact window','Coverage','Full total','Unavailable months'], c.members.map(m => [m.year, range(m), `${m.observed}/${m.expected} months`, amount(m.total), m.missing.join(', ') || 'None']));
  }
  function renderMatrix() {
    const selectedB = selection('b');
    byId('matrix').innerHTML = `<table><caption>Percent difference from the selected short mean (not a climate normal)</caption><thead><tr><th scope="col">Target window</th>${referenceNames.map(x => `<th scope="col">${x}<br>${R.REFERENCES[x].length} endpoints</th>`).join('')}</tr></thead><tbody>${R.WINDOWS.map(n => `<tr><th scope="row">${n} ${n === 1 ? 'month' : 'months'}</th>${referenceNames.map(ref => {
      const c = R.compare(index,n,ref), selected = selectedB.count === n && selectedB.reference === ref;
      return `<td><button type="button" class="${c.direction || 'na'}" data-window="${n}" data-reference="${ref}" aria-pressed="${selected}" aria-label="Set comparison B to ${n} months, reference endpoints ${ref}: ${pct(c.percent)}${c.direction ? ` ${c.direction}` : ''}">${pct(c.percent)}</button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
    byId('all-results').innerHTML = table(`All 20 fixed comparisons; totals in ${unit}`,
      ['Months','Reference endpoints','Target','Reference mean','Difference','Percent','Complete / requested'],
      R.WINDOWS.flatMap(n => referenceNames.map(ref => { const c = R.compare(index,n,ref); return [n,ref,amount(c.target.total),amount(c.mean,true),amount(c.difference,true),pct(c.percent),`${c.complete}/${c.requested}`]; })));
    byId('matrix').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const n = button.dataset.window, ref = button.dataset.reference;
      byId('window-b').value = n; byId('reference-b').value = ref;
      renderComparisons(true);
      // Re-render replaces buttons; retain the user's exact cell in keyboard focus.
      Array.from(byId('matrix').querySelectorAll('button')).find(b => b.dataset.window === n && b.dataset.reference === ref).focus({preventScroll:true});
    }));
  }
  function renderComparisons(announce) {
    unit = byId('units').value;
    const a = selection('a'), b = selection('b');
    // One shared absolute scale. Reference member totals are included for stable context.
    const maxValue = Math.max(...[a,b].flatMap(c => [c.target.total, c.mean, ...c.members.map(m => m.total)]).filter(x => x !== null), 0.01);
    renderComparison(a,'a',maxValue); renderComparison(b,'b',maxValue); renderMatrix();
    byId('comparison-note').textContent = a.direction && b.direction && a.direction !== b.direction
      ? `A is ${a.direction} its selected mean; B is ${b.direction} its selected mean. Different accumulated dates and reference choices can change the description. This contrast is descriptive arithmetic.`
      : !a.eligible || !b.eligible ? 'At least one selected reference is incomplete. Its comparison is withheld even when other requested members are complete.'
      : `A and B are ${a.direction === b.direction ? `both ${a.direction}` : `${a.direction} and ${b.direction}`} their selected means. These are dependent descriptive comparisons from one short record.`;
    if (announce) {
      const status = (c, side) => `Comparison ${side}: ${c.count} months, ${c.reference}, ${pct(c.percent)}.${c.eligible ? '' : ` ${c.complete} of ${c.requested} requested reference windows complete; required months are outside this extract. Full selected mean withheld.`}`;
      byId('announcement').textContent = `${status(a, 'A')} ${status(b, 'B')} Rainfall units ${unit}.`;
    }
  }
  function renderMonthly() {
    byId('monthly-intro').textContent = `February contributes ${amount(12.66)} of the ${amount(19.13)} calendar-year total. October–December accumulates ${amount(0.16)}. Trace amounts count as numeric zero at the reported precision; see the trace counts below.`;
    const maxValue = 14, x0=52, plot=940, y0=225, height=173, bw=45, step=plot/12;
    const grid = [0,7,14].map(v => `<line x1="${x0}" y1="${y0-v/maxValue*height}" x2="1010" y2="${y0-v/maxValue*height}" stroke="#c6d0d2"/><text x="43" y="${y0-v/maxValue*height+4}" text-anchor="end" font-size="12" fill="#495f6a">${number(R.convert(v,unit), unit==='in'?0:1)}</text>`).join('');
    const bars = months2024.map((m,i) => {
      const v=Number(m.inches), x=x0+i*step+16, h=v/maxValue*height;
      return `<rect x="${x}" y="${y0-h}" width="${bw}" height="${h}" fill="${i===1?'#155575':'#6b7f89'}" rx="2"/><text x="${x+bw/2}" y="${y0-h-8}" text-anchor="middle" font-size="12" fill="#172d3a">${number(R.convert(v,unit), unit==='in'?2:3)}</text><text x="${x+bw/2}" y="250" text-anchor="middle" font-size="12" fill="#172d3a">${monthName(m.month).slice(0,3)}</text>`;
    }).join('');
    byId('monthly-chart').innerHTML = `<svg viewBox="0 0 1040 275" role="img" aria-labelledby="monthly-svg-title" aria-describedby="monthly-svg-desc"><title id="monthly-svg-title">2024 monthly precipitation (${unit})</title><desc id="monthly-svg-desc">Complete observed months. February is the largest at ${amount(12.66)}. Calendar 2024 totals ${amount(19.13)}. All monthly values and trace flags are in the following data table.</desc><text x="8" y="22" font-size="12" fill="#495f6a">${unit}</text>${grid}${bars}</svg>`;
    byId('monthly-table').innerHTML = table(`Complete 2024 monthly observations; ${unit}`,
      ['Month','Total','Observed days','Trace flags'], months2024.map(m => [monthName(m.month),amount(Number(m.inches)),m.days,m.trace_count]));
  }
  function renderMask() {
    const m=R.synthetic(index,byId('mask-month').value);
    const cards=[['Strict full-year total','Unavailable','One month deliberately withheld'],['Observed 11-month partial',amount(m.partial),'A partial sum, not a complete total'],['Zero-fill assumption',amount(m.zeroFill),'Assumes the missing month is zero'],['Equal-month scaling',amount(m.scaled,true),'Partial × 12/11; not adopted'],['Known complete truth',amount(m.truth),'Available only because this is synthetic'],['Fixed annual reference',amount(m.reference,true),'2019–2023; five complete years']];
    const interval=`[${amount(m.lowerBound)}, ∞)`;
    const interpretation=m.direction==='above' ? 'The partial sum alone already exceeds the reference, so “above” follows under nonnegativity. The exact full total remains unknown.' : 'Totals below and above the reference are both compatible with the retained partial sum and nonnegativity. The direction is not identified without an observation or an added assumption.';
    byId('mask-result').innerHTML=`<p>Hidden known amount: <strong>${monthName(m.month)}, ${amount(m.withheld)}</strong>. Retained coverage: 11 of 12 months.</p><dl class="mask-grid">${cards.map(c=>`<div class="mask-stat"><dt>${c[0]}</dt><dd>${c[1]}</dd><small>${c[2]}</small></div>`).join('')}</dl><p class="boundary"><strong>Mathematical boundary if truly unknown: ${interval}.</strong> Nonnegativity supplies this lower bound; these inputs supply no finite upper bound. ${interpretation}</p>`;
    byId('masks-table').innerHTML=table(`Synthetic masks only; strict total unavailable in every row; ${unit}`,
      ['Hidden month','Known withheld','11-month partial / zero fill','Scaled assumption','Known complete truth','Direction from lower bound'], months2024.map(x=>{const m=R.synthetic(index,x.month);return [monthName(x.month),amount(m.withheld),amount(m.partial),amount(m.scaled,true),amount(m.truth),m.direction==='above'?'Above':'Not identified'];}));
  }
  function renderAll(announce) {renderComparisons(announce);renderMonthly();renderMask();}
  function reset() {
    byId('units').value='in'; byId('window-a').value='3'; byId('window-b').value='12';
    byId('reference-a').value='2019–2023';byId('reference-b').value='2019–2023';byId('mask-month').value='2024-02';
  }
  for(const id of ['window-a','window-b','reference-a','reference-b']) byId(id).addEventListener('change',()=>renderComparisons(true));
  byId('units').addEventListener('change',()=>renderAll(true));
  byId('mask-month').addEventListener('change',()=>{renderMask();byId('announcement').textContent=`Synthetic demonstration hides ${monthName(byId('mask-month').value)}. The primary comparisons are unchanged.`;});
  byId('reset').addEventListener('click',()=>{reset();renderAll(true);byId('announcement').textContent=`Demo reset. ${byId('announcement').textContent} Synthetic demonstration hides February 2024 again. Primary observations are unchanged.`;});
  reset();renderAll(false);
})();
