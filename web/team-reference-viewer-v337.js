/* Read-only reference-roster evidence. Never receives a selected or edited team card. */
(() => {
  const VERSION = '1.0.0-reference-roster-viewer-v337';
  const SOURCE_SHA256 = '5cefb2c05264c6bcbe5b27bdf0bdd097b1ead72eba0cd11fbf4a346887dd400b';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const canonical = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value)
    ? value.map(x => JSON.parse(canonical(x))) : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))])) : value);
  function rosterSignature(team) {
    const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
    return canonical({...pick(team,['id','rosterId','name','format','budget','rerolls','apothecary']),
      players:team.players.map(p=>pick(p,['id','number','name','positionId','position','ma','st','ag','pa','av','skills','keywords','boughtSkill','captain','veteran']))});
  }
  const coordinate = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) ? '('+p.x+','+p.y+')' : '未记录';
  const number = value => Number.isFinite(value) ? value.toLocaleString('en-US') : '未记录';
  function probability(p, digits=2, unit='%') {
    if (!p || !Number.isFinite(p.lowerBound) || !Number.isFinite(p.upperBound)) return '未计算';
    const lower=(p.lowerBound*100).toFixed(digits),upper=(p.upperBound*100).toFixed(digits);
    return p.exact && Math.abs(p.upperBound-p.lowerBound)<=1e-10 ? lower+unit : lower===upper ? '≈'+lower+unit+'（保留区间）' : lower+'–'+upper+unit;
  }
  const person = (certificate,id) => certificate.team.players.find(p=>p.id===id);
  const playerName = p => p ? '#'+p.number+' '+p.name : '未记录执行者';
  const skillName = s => typeof s==='string' ? s : s.id+(s.value!=null?' '+s.value+'+':'')+(s.keyword?' ['+s.keyword+']':'');
  const resources = distribution => Object.entries(distribution||{}).filter(([,mass])=>Number.isFinite(mass)).sort((a,b)=>Number(b[0])-Number(a[0])).map(([n,mass])=>esc(n)+' 枚 '+(mass*100).toFixed(2)+'%').join('；') || '未记录';
  function actions(inputs,certificate) {
    return (inputs||[]).map(input => input.kind==='endActivation' ? '结束激活' : input.kind==='playerAction'
      ? playerName(person(certificate,input.playerId))+' '+({move:'Move',secure:'Secure'}[input.action]||input.action)+' '+(input.path||[]).map(step=>coordinate(step.to)).join(' → ')
      : input.kind).join('；') || '不行动对照';
  }
  function resultCell(result,certificate,loss) {
    if (!result) return '<td>未计算；缺项不记为 0%</td>';
    return '<td><b>'+probability(result.bestDeclaredTaskProbability)+'</b>'+
      (loss?'<small>相对完整名单的局部损失 '+probability(loss,2,' pp')+'</small>':'')+
      '<small>Turnover '+probability(result.selectedPolicyTurnover)+'</small>'+
      '<small>剩余团队重掷：'+resources(result.selectedPolicyRemainingRerolls)+'</small>'+
      '<details><summary>执行者与有限路线</summary><p>'+esc(actions(result.selectedInputs,certificate))+'</p><small>候选 '+number(result.candidateCount)+'；排除非法 '+number(result.excludedIllegalCount)+'；选择'+(result.selectionCertain?'确定':'有区间不确定性')+'；未解析质量 '+(Number.isFinite(result.unresolved)?(result.unresolved*100).toFixed(8)+'%':'未记录')+'</small></details></td>';
  }
  function resultsTable(group,certificate,{locked=false,support=false}={}) {
    const rows = [{id:'baseline',...group.baseline},...group.comparisons];
    const label = row => row.id==='baseline' ? (locked?'完整名单 · 固定职责':'完整名单 · 同一有限候选组合')
      : row.id==='without-player' ? (locked?'终点 Thrall 缺阵 · 固定职责，只让 Runner 行动':support?'终点 Thrall 缺阵 · 场上 Thrall 走 3 步接任':'焦点队员缺阵 · 真实场上队友接任')
      : '下一进攻段参考 · 原名单替补 '+playerName(person(certificate,row.reservePlayerId));
    let html=rows.map(row=>'<tr data-team-evidence-case="'+esc(row.id)+'"><th scope="row">'+esc(label(row))+'</th>'+['withoutTeamRerolls','withTeamRerolls'].map(policy=>resultCell(row.byRerollPolicy?.[policy],certificate,row.lossByRerollPolicy?.[policy])).join('')+'</tr>').join('');
    if (!rows.some(row=>row.reservePlayerId)) html+='<tr><th scope="row">下一进攻段替补</th><td colspan="2">N/A · 此认证名单没有替补，不生成替补比较，不记为 0%</td></tr>';
    return '<div class="team-impact-scroll reference-evidence-scroll" tabindex="0" role="region" aria-label="参考名单任务结果，可横向滚动"><table><thead><tr><th>声明状态</th><th>禁止团队与 Leader 重掷</th><th>允许声明的有限重掷池</th></tr></thead><tbody>'+html+'</tbody></table></div>';
  }
  function supportCosts(s,certificate) {
    if (!s.supportCostDiagnostics?.length) return '';
    const rows=s.supportCostDiagnostics.map(d=>'<tr><th scope="row">'+(d.comparisonId==='baseline'?'完整名单':d.comparisonId==='without-player'?'缺阵后重新分工':'下一进攻段替补')+' · '+(d.policy==='withoutTeamRerolls'?'禁止团队/Leader':'允许有限重掷')+'</th><td>'+d.helperEventPlayerIds.map((id,i)=>esc(playerName(person(certificate,id)))+' 被移出 '+probability(d.measures['helperRemoved'+i],4)).join('<br>')+'</td><td>'+resources(d.remainingTeamRerolls)+'</td></tr>').join('');
    return '<details><summary>支援的咬伤与资源成本</summary><p>接任把咬伤风险转移给真正行动的 Thrall；零任务损失不等于零行动、零重掷机会成本或零伤害成本。以下事件来自同一结果树，不能相加为总分。</p><div class="team-impact-scroll reference-evidence-scroll" tabindex="0" role="region" aria-label="实际支援者被移出与资源分布"><table><thead><tr><th>状态与政策</th><th>实际 Thrall 被移出</th><th>剩余团队重掷分布</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
  }
  function scenario(s,certificate) {
    const support=s.type==='vampire-support-touchdown';
    const title=support?'持球 8 格达阵与支援接任':(s.reference.pressure==='marked'?'单标记地上球':'开阔地上球')+' · 取球职责';
    const context=support ? '同一位 '+playerName(s.roles.carrier)+' 起始持球，从 '+coordinate(s.reference.origin)+' 到 '+coordinate(s.reference.goal)+'。移除的是非持球者 '+playerName(s.roles.focal)+'，原支援格 '+coordinate(s.reference.supportAt)+'；真正的备用场上队友 '+playerName(s.roles.reassignedSupport)+' 从 '+coordinate(s.reference.backupAt)+' 先走 3 步到支援格并结束激活，再让 Runner 行动。两次行动共享有限资源。'
      : '焦点队员 '+playerName(s.roles.focal)+'；地上球 '+coordinate(s.reference.ballAt)+'；'+(s.reference.markerAt?'一名声明对手位于 '+coordinate(s.reference.markerAt):'没有额外盯防者')+'。目标是队伍持球且无 Turnover；不含达阵或后续守球。焦点按 Sure Hands、AG 目标、MA、球衣号选择。';
    const formation=s.formation.map(p=>'<li>'+esc((p.team==='A'?'己方 ':'对方 ')+playerName(p))+' · '+esc(p.location==='pitch'?coordinate(p.pos):p.location==='reserves'?'替补席':p.location)+(p.veteran?' · Veteran':'')+'</li>').join('');
    return '<details class="player-suite-axis reference-scenario" data-reference-scenario="'+esc(s.id)+'"><summary>'+esc(title)+'</summary><p>'+esc(context)+'</p>'+
      '<p>正常天气；'+(support?'达阵且无 Turnover':'成功取球且无 Turnover')+'。起始团队重掷 '+certificate.team.rerolls+' 枚；左列禁止 Team/Leader，个人技能与已声明的 Sevens Veteran 仍可用，右列共享名单实际池和可用 Leader。实际达阵或失败 Turnover 提前终止行动序列。</p>'+
      (support?'<p><b>固定职责对照</b>：只让 Runner 行动，显示终点支援缺失造成的局部损失。</p>'+resultsTable(s.lockedRoleComparison,certificate,{locked:true,support:true})+'<p><b>公平的有限候选组合</b>：完整与缺阵状态都获得同一组候选，并各自排除非法方案。完整组合已经允许备用 Thrall 接任；因此这组任务可保持 100% → 100%，不能将固定职责的损失冒充整体最优损失。</p>':'<p>完整名单与缺阵后使用同一套声明候选，分别排除各自非法方案，再选择一个最佳合法方案；各人的概率不相加。</p>')+
      resultsTable(s,certificate,{support})+supportCosts(s,certificate)+
      '<details><summary>实际站位与适用边界</summary><p>这是声明的进攻段中参考棋盘，不是模拟开球，也不证明从开球可达。原替补始终留在替补席，只有独立的下一进攻段参考允许原有替补占缺失槽位。只比较有限路线，不是全回合最优教练策略。</p><ul class="team-task-lineup">'+formation+'</ul><small>条件 SHA-256：'+esc(s.contextSha256)+'。完整条件键、所有候选及 replay 见原始 JSON。</small></details></details>';
  }
  function certificateDetails(c) {
    const counts=c.team.players.length,starters=c.format==='sevens'?7:11,bench=counts-starters;
    const rows=c.team.players.map(p=>'<tr><th scope="row">'+esc(playerName(p))+'</th><td>'+[p.ma,p.st,p.ag,p.pa??'—',p.av].map(esc).join(' / ')+'</td><td>'+esc((p.skills||[]).map(skillName).join(', ')||'无')+'</td><td>'+esc(p.boughtSkill||'无')+(p.captain?' · Captain':'')+(p.veteran?' · Veteran':'')+'</td></tr>').join('');
    return '<p><b>认证：名单合法</b> · '+counts+' 人 / 参考场上 '+starters+' / 初始替补 '+bench+'。已计成本 '+number(c.cost.total)+' / 预算 '+number(c.budget)+' gp，未花 '+number(c.unspentBudget)+' gp。</p>'+
      '<p>声明 Skill Tier '+c.declaredTier.value+'；技能点 '+c.skillPoints.spent+' / '+c.skillPoints.allowance+'，Primary '+c.skillPoints.primary+'，Secondary '+c.skillPoints.secondary+'，Elite '+c.skillPoints.elite+'。Tier 仅用于名单技能预算，不由任务概率推导。<span>查看固定 Tier 来源审计（后台资料）</span></p>'+
      '<details><summary>完整名单、购入技能与成本证书</summary><p>球员 '+number(c.cost.players)+'；重掷 '+number(c.cost.rerolls)+'；职员 '+number(c.cost.staff)+'；Fans '+number(c.cost.fans)+'；诱导 '+number(c.cost.inducements)+' gp。药剂师 '+(c.team.apothecary?'有':'无')+'；未列 Fans / Coaches / Cheerleaders 明确声明为 0，不声称恢复购买历史。</p><div class="team-impact-scroll reference-evidence-scroll" tabindex="0" role="region" aria-label="认证名单属性与技能"><table><thead><tr><th>实际球员</th><th>MA / ST / AG / PA / AV</th><th>原有技能</th><th>购入与身份</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>名单/技能/预算认证与任务站位合法性分别验证；只覆盖这份声明名单，不能推广到全部现行赛事。</p></details>';
  }
  function render() {
    const d=window.BB_TEAM_BROWSER_DATA_V337;
    const unavailable=message=>'<p class="reference-evidence-unavailable">'+esc(message)+' 缺项不记为 0%，也不转用旧雷达均值。</p>';
    if (!d || d.artifactVersion!=='team-browser-evidence-v337/1') return unavailable('尚未载入 v3.37 参考名单证据。');
    if (d.sourceJsonSha256!==SOURCE_SHA256 || d.suiteVersion!==window.BB_TEAM_TASK_EVIDENCE_V337?.VERSION || d.engine?.sha256!==window.BB_BLOODBOARD_ENGINE?.META?.sha256) return unavailable('证据来源、任务套件或规则引擎不一致，已停止显示缓存结果。');
    const bodies=d.certificates.map(c=>{
      const source=window.ATLAS_DATA.teams.find(t=>t.id===c.teamId);
      const valid=c.legal && source && !source.simulated && rosterSignature(source)===c.sourceAtlasSignature;
      return '<details class="team-task-experiment reference-roster" data-reference-roster="'+esc(c.teamId)+'"><summary>'+esc(c.name)+' · '+(c.format==='sevens'?'七人制':'十一人制')+' · 已保存参考名单</summary>'+
        (valid?certificateDetails(c)+d.scenarios.filter(s=>s.certificateTeamId===c.teamId).map(s=>scenario(s,c)).join(''):unavailable('源名单或技能已变化，原证书与任务结果失效；须重新认证和计算。'))+'</details>';
    }).join('');
    return '<p>仅四份已保存参考名单：Human / Vampire / Dwarf 十一人制与 Vampire 七人制，共 '+d.summary.portfolios+' 个任务组合、'+d.summary.bestPolicyResults+' 个最佳政策结果。这里独立于上方当前卡片、筛选和临时编辑，不代表修改后球队。</p>'+bodies+
      '<p>任务之间不求平均，也不赋球队六维、Strength 或全队排名。区间保留上下界；固定引擎内部重掷策略未重优化。<span>方法与边界（后台资料）</span> · <a href="'+esc(d.sourceFile)+'">完整证书、条件、候选与 replay JSON</a></p><small>数据 SHA-256：'+esc(d.sourceJsonSha256)+' · 引擎 '+esc(d.engine.version)+' · '+esc(d.suiteVersion)+'</small>';
  }
  window.BB_TEAM_REFERENCE_VIEWER_V337=Object.freeze({VERSION,SOURCE_SHA256,render,scenario,resultsTable,probability,canonical,rosterSignature});
  const target=document.getElementById('team-reference-evidence-content');
  if (target) target.innerHTML=render();
})();
