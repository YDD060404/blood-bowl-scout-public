(() => {
  'use strict';
  const DATA = window.BLOOD_BOWL_TEAMWORK_V339;
  const root = document.getElementById('teamwork-v339-content');
  if (!root) return;
  if (!DATA || DATA.schema !== 'v339-teamwork-browser-data/1') {
    root.innerHTML = '<p class="v339-na">V3.39 浏览器数据未载入。</p>';
    return;
  }

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const contextById = new Map(DATA.contexts.map(context => [context.id, context]));
  const conditionLabels = {
    'complete-roster': '完整名单',
    'focal-support-removed-reallocate': '焦点支援缺阵后重分工',
    'next-drive-true-reserve': '下一 Drive 真实替补'
  };
  const planLabel = (row) => row.planLabel || row.planId;
  const pct = value => `${(value * 100).toFixed(2)}%`;
  const pp = interval => `${interval[0] > 0 ? '+' : ''}${(interval[0] * 100).toFixed(2)}${interval[1] === interval[0] ? '' : ` 至 ${interval[1] > 0 ? '+' : ''}${(interval[1] * 100).toFixed(2)}`} 个百分点`;
  const options = (values, label) => `<select><option value="">全部${label}</option>${values.map(([value,text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('')}</select>`;

  root.innerHTML = `
    <div class="v339-summary-grid" aria-label="V3.39 样本数量">
      <div><b>${DATA.summary.scenarioContexts}</b><span>固定情境</span></div>
      <div><b>${DATA.summary.candidateRows}</b><span>计划结果行</span></div>
      <div><b>${DATA.summary.calculated}</b><span>已计算</span></div>
      <div><b>${DATA.summary.notApplicable}</b><span>不适用</span></div>
      <div><b>${DATA.summary.pairedDifferences}</b><span>配对差值</span></div>
    </div>
    <p class="v339-caveat">固定局部站位 · 不代表整场胜率或球队整体强度 · N/A 表示该计划在该名单条件下不适用，不按 0 处理。</p>
    <div class="v339-filterbar" aria-label="筛选团队支援样本">
      <label>球队 ${options([...new Map(DATA.contexts.map(c=>[c.teamId,[c.teamId,c.teamLabel]])).values()], '球队')}</label>
      <label>赛制 ${options([['11s','十一人制'],['7s','七人制']], '赛制')}</label>
      <label>局面 ${options([...new Map(DATA.contexts.map(c=>[c.scenarioKind,[c.scenarioKind,c.scenarioLabel]])).values()], '局面')}</label>
      <label>名单条件 ${options(Object.entries(conditionLabels), '条件')}</label>
      <label>结果 ${options([['calculated','已计算'],['not-applicable','不适用']], '结果')}</label>
      <button type="button" class="v339-reset">清除筛选</button>
      <span class="v339-count" aria-live="polite"></span>
    </div>
    <div class="v339-results" tabindex="0" aria-label="团队支援概率结果表"></div>
    <p class="v339-source-note">${esc(DATA.method.engine)}；${esc(DATA.method.enumeration)}。相对单独阻挡为同情境候选计划减去 block-only 基准；正、零、负差值均保留，控场覆盖以分布并列比较，不压成单一差值。</p>
    <p class="v339-links"><span>方法、假设与限制（后台资料）</span><span>完整结果 JSON（后台资料）</span></p>`;

  const controls = [...root.querySelectorAll('.v339-filterbar select')];
  const count = root.querySelector('.v339-count');
  const tableHost = root.querySelector('.v339-results');
  function render() {
    const [team, format, scenario, condition, status] = controls.map(el => el.value);
    const rows = DATA.rows.filter(row => {
      const context = contextById.get(row.scenarioId);
      return (!team || row.teamId === team) && (!format || row.format === format) &&
        (!scenario || context.scenarioKind === scenario) && (!condition || row.condition === condition) &&
        (!status || row.status === status);
    });
    count.textContent = `显示 ${rows.length} / ${DATA.rows.length} 行`;
    if (!rows.length) { tableHost.innerHTML = '<p class="v339-na">没有符合筛选条件的结果。</p>'; return; }
    tableHost.innerHTML = `<table><thead><tr><th>球队 / 对手</th><th>名单条件 / 局面</th><th>计划</th><th>安全击倒</th><th>Turnover</th><th>相对单独阻挡</th><th>终点控场覆盖 · 8 邻格</th><th>重掷资源</th></tr></thead><tbody>${rows.map(row => {
      const context = contextById.get(row.scenarioId);
      const statusCell = row.status === 'calculated' ? (() => {
        const m = row.metrics;
        const remaining = Object.entries(m.teamRerollsRemaining).map(([n,p])=>`${n} 次 ${pct(p)}`).join('，');
        const spent = Object.entries(m.teamRerollsSpent).map(([n,p])=>`${n} 次 ${pct(p)}`).join('，');
        const coverage = Object.entries(m.endpointControlCoverageAdjacentSquares.distribution).map(([n,p])=>`${n} 格 ${pct(p)}`).join('；');
        const pair = row.pairedToBlockOnly;
        return `<td><b>${pct(m.safeKnockdown.observedLower)}</b><small>精确值；未覆盖质量 ${(m.unresolvedMass*100).toFixed(4)}%</small></td><td>${pct(m.turnover.observedLower)}</td><td>${pair ? `<span class="v339-delta">击倒 ${pp(pair.safeKnockdown.interval)}</span><small>Turnover ${pp(pair.turnover.interval)}</small>` : '<span class="v339-no-pair">无对应 block-only 配对差值</span>'}</td><td>${esc(coverage)}</td><td>起始 ${m.resourceStart.teamRerolls} 次球队重掷；剩余：${esc(remaining)}<small>已用：${esc(spent)}；Leader ${esc(Object.keys(m.leaderRerollUse).join(', '))}；Veteran ${esc(Object.keys(m.veteranState).join(', '))}</small></td>`;
      })() : `<td colspan="5"><span class="v339-status-na">N/A</span> ${esc(row.reason)}</td>`;
      return `<tr><td><strong>${esc(row.teamLabel)}</strong><small>对手：${esc(context.opponentLabel)}</small></td><td>${esc(row.conditionLabel || conditionLabels[row.condition] || row.condition)}<small>${esc(row.contextLabel || context.scenarioLabel)} · ${row.format === '7s' ? '七人制' : '十一人制'}</small></td><td>${esc(planLabel(row))}<small>${row.status === 'calculated' ? `引擎枚举 ${row.leaves} 个终端分支` : '该计划不适用'}</small></td>${statusCell}</tr>`;
    }).join('')}</tbody></table>`;
  }
  controls.forEach(control => control.addEventListener('change', render));
  root.querySelector('.v339-reset').addEventListener('click', () => { controls.forEach(control => { control.value = ''; }); render(); });
  window.renderTeamworkV339 = render;
  render();
})();
