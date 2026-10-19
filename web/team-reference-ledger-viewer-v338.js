/* Filterable V338 roster ledger and bounded retrieval evidence. Read-only; never emits team strength. */
(() => {
  const VERSION = '1.0.0-reference-roster-ledger-viewer-v338';
  const ENGINE_SHA = 'b8d38f981a9ccffe9c6a602df90b5976b21779ae029081cd618f74d7aabe5441';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtName = f => f === 'sevens' ? '七人制' : '十一人制';
  const statusName = s => ({valid:'可计算',invalid:'未通过固定引擎', 'missing-evidence':'缺必要选择'}[s] || '状态未知');
  const money = n => Number.isFinite(n) ? (n / 1000).toLocaleString('zh-CN') + 'K' : 'N/A';
  const pct = p => {
    if (!p || !Number.isFinite(p.lowerBound) || !Number.isFinite(p.upperBound)) return 'N/A · 未生成概率';
    const lo = p.lowerBound * 100, hi = p.upperBound * 100;
    const precision = Math.max(2, Math.min(6, Math.ceil(-Math.log10(Math.max(hi - lo, 1e-8))) + 1));
    const a = lo.toFixed(precision), b = hi.toFixed(precision);
    return p.exact && Math.abs(hi - lo) < 1e-8 ? a + '%' : a + '–' + b + '%（区间）';
  };
  const percentagePoints = p => {
    if (!p || !Number.isFinite(p.lowerBound) || !Number.isFinite(p.upperBound)) return 'N/A · 未生成概率';
    const lo = p.lowerBound * 100, hi = p.upperBound * 100;
    const precision = Math.max(2, Math.min(6, Math.ceil(-Math.log10(Math.max(hi - lo, 1e-8))) + 1));
    const signed = value => {
      const rounded = Number(value.toFixed(precision));
      const normalized = Object.is(rounded, -0) ? 0 : rounded;
      const [whole, decimals = ''] = Math.abs(normalized).toFixed(precision).split('.');
      return (normalized > 0 ? '+' : normalized < 0 ? '−' : '') + whole + '.' + decimals.replace(/0+$/, '').padEnd(2, '0');
    };
    const a = signed(lo), b = signed(hi);
    return p.exact && Math.abs(hi - lo) < 1e-8 ? a + ' 个百分点' : a + '–' + b + ' 个百分点（区间）';
  };
  const coord = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) ? '格 (' + p.x + ',' + p.y + ')' : '未声明';
  const probState = p => !p ? '未生成' : p.exact ? '精确枚举' : '保留区间';
  function explainIssue(value) {
    const text = String(value ?? '');
    let match = text.match(/Skill Points: (\d+) spent, but a Tier (\d+) team has (\d+)/i);
    if (match) return '技能点超出该 Tier 的赛事额度：已用 ' + match[1] + '，该 Tier 允许 ' + match[3] + '。';
    match = text.match(/Choose the team's League: (.*?) \(p\.(\d+);/i);
    if (match) return '缺少赛区选择：可选 ' + match[1] + '（规则书第 ' + match[2] + ' 页）。';
    match = text.match(/Choose the team's alignment\s*[—-]\s*(.*?) \(p\.(\d+);/i);
    if (match) return '缺少阵营选择：可选 ' + match[1] + '（规则书第 ' + match[2] + ' 页）。';
    if (/not a .* roster player/i.test(text)) return '固定引擎的球队名单库不包含该球员位置。';
    if (/neither a Primary nor a Secondary skill/i.test(text)) return '固定引擎的技能资格表不允许该球员学习此技能。';
    if (/use the roster profile unchanged/i.test(text)) return '该位置属性与固定引擎的锦标赛/七人制档案不同。';
    if (/players with Insignificant/i.test(text)) return 'Insignificant 球员人数超过其余球员人数，未通过当前草案限制。';
    return text || '来源没有提供更具体的原因。';
  }
  function blockerText(c) {
    const entries = [];
    (c.hardErrors || []).forEach(x => entries.push({kind:'固定引擎阻断', text:explainIssue(x.text || x), raw:x.text || x}));
    (c.profileIssues || []).forEach(x => entries.push({kind:'名单/位置数据差异', text:explainIssue(x.text || x), raw:x.text || x}));
    (c.metadataErrors || []).forEach(x => entries.push({kind:'缺必要选择', text:explainIssue(x.text || x), raw:x.text || x}));
    if (c.missingFields?.length) entries.push({kind:'缺失字段', text:c.missingFields.join('、')});
    if (c.costEvidence?.status === 'incomplete-unknown-position') entries.push({kind:'价格 N/A', text:'固定引擎缺少位置价格：' + (c.costEvidence.missingPricePlayers || []).map(p => '#' + p.number + ' ' + p.positionId).join('、')});
    return entries;
  }
  function safeDetail(obj) { return obj == null ? '未声明' : typeof obj === 'string' ? obj : JSON.stringify(obj); }
  function assumptionText(assumptions) {
    if (!assumptions) return '未提供';
    const fields = [['play','赛事类型'],['league','赛区'],['favoured','阵营选择'],['dedicatedFans','球迷数'],['assistantCoaches','助理教练'],['cheerleaders','啦啦队'],['staffMetadata','职员假设'],['selectionMetadata','名单选择假设']];
    return fields.filter(([key]) => assumptions[key] !== undefined).map(([key,label]) => label + '：' + (assumptions[key] === null ? '缺失' : safeDetail(assumptions[key]))).join('；');
  }
  function provenanceText(d) {
    const vals = Object.entries(d).filter(([key,value]) => !['type','positionId','field'].includes(key) && value !== undefined).map(([key,value]) => key + '=' + safeDetail(value));
    return (d.type || '版本差异') + (d.positionId ? ' · ' + d.positionId : '') + (d.field ? ' · ' + d.field : '') + (vals.length ? ' · ' + vals.join('；') : '');
  }
  function routeSummary(row, certificate, result) {
    const inputs = result?.selectedInputs;
    if (!Array.isArray(inputs)) return '未保存所选候选的细节';
    const names = new Map(certificate.team.players.map(p => [p.id, '#' + p.number + ' ' + p.name]));
    const steps = inputs.map(input => {
      if (input.kind === 'endActivation') return '结束激活';
      if (input.kind !== 'playerAction') return input.kind;
      const path = (input.path || []).map(step => coord(step.to)).join(' → ');
      return (names.get(input.playerId) || input.playerId) + ' 执行 ' + input.action + (path ? '：' + path : '');
    });
    return steps.join('；') || '不行动对照';
  }
  function resultTable(s, certificate, policy) {
    const rows = [{id:'baseline', ...s.baseline}, ...(s.comparisons || [])];
    const caseName = row => row.id === 'baseline' ? '完整名单' : row.id === 'without-player' ? '焦点球员缺阵 · 同一有限候选集重规划' : row.reservePlayerId ? '下一进攻段替补接任 · #' + certificate.team.players.find(p => p.id === row.reservePlayerId)?.number : row.id;
    const body = rows.map(row => {
      const result = row.byRerollPolicy?.[policy];
      const delta = row.lossByRerollPolicy?.[policy];
      if (!result) return '<tr><th>' + esc(caseName(row)) + '</th><td colspan="4">N/A · 此条件未计算，不记为 0%</td></tr>';
      return '<tr><th scope="row">' + esc(caseName(row)) + '</th><td><b>' + esc(pct(result.bestDeclaredTaskProbability)) + '</b><small>' + esc(probState(result.bestDeclaredTaskProbability)) + ' · 所选 ' + esc(pct(result.selectedPolicyProbability)) + '</small></td><td>' + esc(pct(result.selectedPolicyTurnover)) + '</td><td>' + esc(Object.entries(result.selectedPolicyRemainingRerolls || {}).map(([n,m]) => n + ' 枚：' + (m*100).toFixed(2) + '%').join('；') || '未记录') + '</td><td><small>合法候选 ' + (result.legalCandidateCount ?? '未记录') + '；排除非法 ' + (result.excludedIllegalCount ?? '未记录') + '；选择' + (result.selectionCertain ? '确定' : '有不确定性') + '</small><details><summary>查看所选行动</summary><p>' + esc(routeSummary(row, certificate, result)) + '</p></details>' + (delta ? '<small>完整名单 − 当前名单（百分点）：' + esc(percentagePoints(delta)) + '（仅限此声明策略集）</small>' : '') + '</td></tr>';
    }).join('');
    return '<div class="team-impact-scroll reference-evidence-scroll v338-evidence-scroll" tabindex="0" role="region" aria-label="取球任务概率和有限策略对比"><table><thead><tr><th>名单状态</th><th>任务成功概率</th><th>Turnover 风险</th><th>行动后团队重掷</th><th>策略范围与差值</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  function scenarioView(s, certificate, policy) {
    const r = s.reference, pressure = r.pressure === 'marked' ? '受标记取球' : '开阔取球';
    const weather = r.weather === 'perfect' ? '晴好天气' : (r.weather || '未声明');
    const leaderResource = r.resources.leaderRerollInitiallyAvailable ? '名单声明有初始可用 Leader 重掷' : '名单没有初始可用 Leader 重掷';
    const condition = pressure + '；球在 ' + coord(r.ballAt) + '；' + (r.markerAt ? '一名对手在 ' + coord(r.markerAt) : '无额外声明标记者') + '；' + weather + '；团队重掷池：' + r.resources.teamRerolls + ' 枚；' + leaderResource;
    const formation = (r.formation || []).map(p => {
      const location = p.location === 'pitch' ? coord(p.at) : p.location;
      const skills = (p.skills || []).map(skill => typeof skill === 'string' ? skill : skill.id).join('、');
      const row = '己方 #' + p.number + ' ' + p.name + ' · ' + location + (skills ? ' · ' + skills : '') + (p.veteran ? ' · Veteran' : '');
      return '<li>' + esc(row) + '</li>';
    }).join('');
    const focal = s.roles?.focal;
    const focalLine = focal ? '#' + focal.number + ' ' + focal.name + '（' + focal.id + '）' : '未声明';
    const policyLabel = policy === 'withoutTeamRerolls' ? '禁止 Team/Leader 重掷' : '允许使用名单实际可用的 Team/Leader 重掷资源';
    return '<details class="v338-context-card" data-context="' + esc(r.pressure) + '"><summary>' + esc(pressure) + ' · ' + esc(fmtName(s.reference.format)) + '</summary><p>' + esc(s.scope) + '</p><p><b>公开条件：</b>' + esc(condition) + '</p><p><b>焦点球员（缺阵对照对象）：</b>' + esc(focalLine) + '</p><p><b>成功事件：</b>队伍在行动序列结束时持球，且没有 Turnover。不包含后续持球保护、达阵或整回合最优策略。</p><p><b>比较规则：</b>' + esc(s.semantics?.comparison || '按已保存的有限候选策略比较') + ' 当前显示“' + policyLabel + '”。</p>' + resultTable(s, certificate, policy) + '<details><summary>查看完整参考站位、重掷与事件定义</summary><p>球员选择：' + esc(s.roles?.focalSelection || '见任务证据') + '</p><p>有限候选规则：' + esc(s.roles?.candidatePolicy || '见任务证据') + '</p><p>参考事件：' + esc(s.reference.event?.events?.map(e => e.type).join(' + ') || 'teamHasBall + noTurnover') + '。</p><p>资源与名单约束：' + esc(s.reference.deploymentPolicy || '') + '</p><ul class="team-task-lineup v338-formation">' + formation + '</ul><p>限制：' + esc(r.limitation || s.scope) + '</p><small>条件键 SHA-256：' + esc(s.contextSha256 || '未记录') + '；完整候选与回放见原始 JSON。</small></details></details>';
  }
  function certificateView(c, scenarios, pressure, policy) {
    const status = statusName(c.status), issueList = blockerText(c);
    const cost = c.cost ? money(c.cost.total) + ' / ' + money(c.budget) + ' 预算' : 'N/A · 固定引擎无法确认完整成本';
    const skill = c.skillPoints ? c.skillPoints.spent + ' / ' + c.skillPoints.allowance + ' 技能点' : '未记录';
    const matching = scenarios.filter(s => pressure === 'all' || s.reference.pressure === pressure);
    const issues = issueList.length ? '<ul class="v338-reason-list">' + issueList.map(issue => '<li><b>' + esc(issue.kind) + '：</b>' + esc(issue.text) + (issue.raw && issue.raw !== issue.text ? '<details><summary>查看固定引擎原始提示</summary><small>' + esc(issue.raw) + '</small></details>' : '') + '</li>').join('') + '</ul>' : '';
    const differences = (c.provenanceDifferences || []).map(d => '<li>' + esc(provenanceText(d)) + '</li>').join('');
    const eligible = c.status === 'valid' && c.legal;
    const contexts = eligible ? matching.map(s => scenarioView(s, c, policy)).join('') || '<p class="v338-na">此筛选条件下没有保存任务。任务概率 N/A；未生成条件不按 0% 处理。</p>' : '<p class="v338-na">资格受阻，任务概率 N/A；没有生成任务概率，也不会用 0% 或其他名单的结果替代。</p>';
    const rosterPlayers = (c.team?.players || []).map(p => '#' + p.number + ' ' + p.position + (p.boughtSkill ? '（购入 ' + p.boughtSkill + '）' : '') + (p.veteran ? '（Veteran）' : '')).join('；');
    const scope = c.scope || c.ruleAuthority?.engine?.rules || '按声明的固定版本校验';
    return '<details class="team-task-experiment v338-roster-card" data-status="' + esc(c.status) + '"><summary><span class="v338-status v338-status-' + esc(c.status) + '">' + esc(status) + '</span> ' + esc(c.name) + ' · ' + esc(fmtName(c.format)) + ' · ' + (eligible ? '成本 ' + esc(cost) + ' · ' + esc(skill) : '无概率结果') + '</summary><div class="v338-roster-meta"><p><b>资格：</b>' + esc(status) + (c.legal ? '；固定引擎接受' : '；当前固定引擎下不生成任务') + '。这不等同于断言较新规则中的现实队伍非法。</p><p><b>名单来源：</b>' + esc(scope) + '。预算与技能点分别按固定引擎结果列示；不同版本资料差异不静默替换。</p>' + (c.costEvidence?.missingPricePlayers?.length ? '<p><b>价格缺项：</b>' + esc(c.costEvidence.missingPricePlayers.map(p => '#' + p.number + ' ' + p.positionId).join('、')) + '；已知小计 ' + esc(c.costEvidence.partialEngineSubtotalDiagnostic ? money(c.costEvidence.partialEngineSubtotalDiagnostic.total) : 'N/A') + '，总价保持 N/A。</p>' : '') + issues + (differences ? '<details><summary>来源版本差异（' + (c.provenanceDifferences || []).length + '）</summary><ul class="v338-reason-list">' + differences + '</ul></details>' : '') + '<details><summary>查看本参考名单与计价假设</summary><p>' + esc(rosterPlayers || '名单缺失') + '</p><p>当前记录成本 ' + esc(c.cost ? money(c.cost.total) : 'N/A') + ' / 预算 ' + esc(money(c.budget)) + '；重掷 ' + esc(c.team?.rerolls ?? 'N/A') + '；技能点 ' + esc(skill) + '；引擎规则 ' + esc(c.ruleAuthority?.engine?.version || '未记录') + '。</p><p>名单假设：' + esc(assumptionText(c.assumptions)) + '</p></details></div>' + contexts + '</details>';
  }
  function init() {
    const root = document.getElementById('team-reference-ledger-content');
    if (!root) return;
    const engineApi = window.BB_TEAM_TASK_EVIDENCE_V338;
    const d = window.BB_TEAM_TASK_EVIDENCE_V338_DATA;
    if (!engineApi || !d || !Array.isArray(d.certificates) || !Array.isArray(d.scenarios)) {
      root.innerHTML = '<p class="reference-evidence-unavailable">v3.38 账本数据没有载入。缺失条件不记为零。</p>'; return;
    }
    if (engineApi.VERSION !== '1.0.0-reference-roster-coverage-v338' || d.artifactVersion !== 'team-task-evidence-browser-v338/1') {
      root.innerHTML = '<p class="reference-evidence-unavailable">任务构建器版本与数据不匹配，已停止展示。</p>'; return;
    }
    if (d.engine?.sha256 !== ENGINE_SHA || window.BB_BLOODBOARD_ENGINE?.META?.sha256 !== ENGINE_SHA) {
      root.innerHTML = '<p class="reference-evidence-unavailable">固定引擎指纹不匹配，缓存概率已停止展示。</p>'; return;
    }
    const summary = d.summary;
    root.innerHTML = '<div class="v338-summary-grid"><div><b>' + summary.templates + '</b><span>参考名单</span></div><div><b>' + summary.byStatus.valid + '</b><span>可计算</span></div><div><b>' + summary.byStatus.invalid + '</b><span>固定引擎未通过</span></div><div><b>' + summary.byStatus['missing-evidence'] + '</b><span>缺必要选择</span></div><div><b>' + summary.plannedContexts + '</b><span>已声明任务条件</span></div><div><b>' + summary.bestPolicyResults + '</b><span>最佳策略结果</span></div></div>' +
      '<p class="v338-ledger-caveat">资格结论只针对本项目固定的 Bloodboard V5 step 6 / 5.0.6 与登记来源。11 份“未通过”可能来自固定引擎与较新资料差异，不等于现实新版规则非法；15 份缺必要选择保持 N/A。被阻断的名单不会生成概率，也不会参与任何球队总分。</p>' +
      '<div class="v338-filterbar"><label>赛制<select id="v338-format"><option value="all">全部</option><option value="11s">十一人制</option><option value="sevens">七人制</option></select></label><label>名单资格<select id="v338-status"><option value="all">全部资格</option><option value="valid">可计算</option><option value="invalid">固定引擎未通过</option><option value="missing-evidence">缺必要选择</option></select></label><label>任务条件<select id="v338-pressure"><option value="all">开阔与受标记</option><option value="open">开阔取球</option><option value="marked">受标记取球</option></select></label><label>重掷条件<select id="v338-policy"><option value="withoutTeamRerolls">禁止 Team/Leader 重掷</option><option value="withTeamRerolls">允许名单实际有限重掷</option></select></label><label class="v338-search-label">搜索<input id="v338-search" type="search" placeholder="球队或种族名"></label><span id="v338-count" aria-live="polite"></span></div><div id="v338-roster-list" class="v338-roster-list"></div>' +
      '<p class="v338-source-note">引擎：' + esc(d.engine.version) + ' · SHA-256 ' + esc(d.engine.sha256) + ' · 账本条件及来源哈希见 <span>证据说明（后台资料）</span>、<span>任务清单（后台资料）</span>、<span>验证结果（后台资料）</span>、<span>完整概率与复算记录（后台资料）</span>。Dark Elf 的有限取球策略中，缺阵看似更好可由完整名单先让路消除；这是策略范围限制，不是球队变强或减员加分。</p>';
    const renderList = () => {
      const format = document.getElementById('v338-format').value, status = document.getElementById('v338-status').value;
      const pressure = document.getElementById('v338-pressure').value, policy = document.getElementById('v338-policy').value;
      const term = document.getElementById('v338-search').value.trim().toLowerCase();
      const filtered = d.certificates.filter(c => (format === 'all' || c.format === format) && (status === 'all' || c.status === status) && (!term || (c.name + ' ' + c.rosterId + ' ' + c.teamId).toLowerCase().includes(term)));
      document.getElementById('v338-count').textContent = '显示 ' + filtered.length + ' / ' + d.certificates.length + ' 份';
      const html = filtered.map(c => certificateView(c, d.scenarios.filter(s => s.certificateTeamId === c.teamId), pressure, policy)).join('');
      document.getElementById('v338-roster-list').innerHTML = html || '<p class="v338-na">没有符合筛选条件的名单。</p>';
    };
    ['v338-format','v338-status','v338-pressure','v338-policy'].forEach(id => document.getElementById(id).addEventListener('change', renderList));
    document.getElementById('v338-search').addEventListener('input', renderList);
    renderList();
  }
  window.BB_TEAM_REFERENCE_LEDGER_V338 = Object.freeze({ VERSION, pct, percentagePoints, statusName, certificateView });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
