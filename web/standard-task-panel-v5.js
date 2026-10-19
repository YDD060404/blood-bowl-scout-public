/* Precomputed standard-task evidence viewer. No simulation or ranking is run here. */
(() => {
  'use strict';
  const mount = () => {
    const root = document.getElementById('standard-task-experiment');
    if (!root || root.dataset.stMounted) return;
    root.dataset.stMounted = 'true';
    const data = window.BB_STANDARD_TASK_EXPERIMENT_V1;
    const esc = value => String(value ?? '未提供').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const list = value => Array.isArray(value) ? value : [];
    const num = value => Number.isFinite(value);
    const show = value => value == null ? '未提供' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    const score = value => num(value) ? Math.round(value) : '待完成';
    const range = (row, scale = 1) => num(row?.lowerBound) && num(row?.upperBound) ? `${Math.floor(row.lowerBound * scale)}–${Math.ceil(row.upperBound * scale)}` : '范围未提供';
    const detail = (label, value) => `<div class="st-fact"><span>${esc(label)}</span><span>${esc(show(value))}</span></div>`;
    if (!data) { root.innerHTML = '<div class="st-empty">标准任务六维赋分缓存尚未加载，未生成评分。</div>'; return; }
    const dossiers = [...list(data.dossiers),...list(data.teamDossiers)];
    const personKey = row => `${row.subjectId}|${row.format ?? ''}`;
    const detailLoads = new Map();
    const loadDetails = d => {
      const key=d.subjectId+'|'+d.format;
      const read=()=>{
        const row=window.BB_STANDARD_TASK_DETAIL_CACHE_V1?.[key];
        if(!row)throw new Error('静态详情缓存没有对应档案；请收起后重新展开重试。');
        const current=window.BB_CURRENT_FIVE_AXES.applyDetail(row);
        if(!current)throw new Error('详情转换没有返回有效档案。');
        return current;
      };
      if(window.BB_STANDARD_TASK_DETAIL_CACHE_V1?.[key])return Promise.resolve().then(read);
      if(!d.detailScript)return Promise.resolve(d);
      if(!detailLoads.has(key)){
        const pending=new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.src=d.detailScript+(d.detailScript.includes('?')?'&':'?')+'v='+encodeURIComponent(window.BB_CURRENT_FIVE_AXES.version);
          script.onload=()=>{try{resolve(read());}catch(error){reject(error);}};
          script.onerror=()=>reject(new Error('详情缓存读取失败，请核对文件；收起后重新展开可重试。'));
          document.head.appendChild(script);
        }).catch(error=>{detailLoads.delete(key);throw error;});
        detailLoads.set(key,pending);
      }
      return detailLoads.get(key);
    };
    const templates = new Map(list(data.templates).map(row => [row.id, row]));
    const rules = data.rules || {};
    const summary = data.summary || {};
    const refreshedTeams = dossiers.some(d=>d.rosterUpdateScope==='ballControl-survival-only');
    const impact = window.BB_STANDARD_TASK_RULE_IMPACT_V1 || {};
    const rawAudit = data.skillAudit || {};
    const audit = {...rawAudit,entries:list(rawAudit.entries).map(row=>({...impact.skills?.[row.id],...row}))};
    const statusText = status => ({'relative-assigned':'同条件赋分完成','certified-display':'整数分精度已确定；底层概率界仍保存，不取中点',complete:'精确计算完成',interval:'已计算 · 保留范围','not-applicable':'不具备本任务的规则资格','solver-error':'计算出错','not-calculated':'尚未计算',pending:'待计算','pending-definition':'全局个人定义待完成','out-of-range':'超出当前任务路线范围','proven-impossible':'规则已证明无法完成',passed:'断言通过',verified:'已验收',incomplete:'部分证据待补'}[status] || show(status));
    const rawDetails = (label, value) => `<details class="st-evidence-raw"><summary>${esc(label)}</summary><pre>${esc(JSON.stringify(value ?? null,null,2))}</pre></details>`;
    const categoryLabels={A:'敏捷',D:'诡计',G:'通用',M:'变异',P:'传球',S:'力量'};
    const categories=value=>list(value).map(code=>`${code} · ${categoryLabels[code] ?? code}`).join('、')||'—';
    const money=value=>num(value)?value.toLocaleString('zh-CN'):'未提供';
    const table=(head,rows)=>`<div style="overflow-x:auto"><table><thead><tr>${head.map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${esc(show(value))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const differences=rows=>list(rows).length?table(['字段','原图鉴 atlas','冻结引擎 engine'],list(rows).map(row=>[row.field,row.atlas,row.engine])):'<p>所核对字段无差异。</p>';
    const factsView=facts=>{
      if(!facts)return '<p>长期事实资料尚未提供。</p>';
      const advancement=facts.advancement||{},titles=list(advancement.titles ?? advancement.titles6),costs=advancement.sppCosts||{};
      const positions=list(facts.positions ?? facts.positions130),stars=list(facts.stars ?? facts.stars66),teams=list(facts.teams ?? facts.teams60);
      const spp=table(['成长档位','随机主类技能','自选主类技能','自选次类技能','属性提升'],titles.map((title,index)=>[`${index+1} · ${title}`,costs.randomPrimary?.[index],costs.primary?.[index],costs.secondary?.[index],costs.characteristic?.[index]]));
      return `<p>以下是冻结来源中的价格、权限、采购成本和成长规则事实；不生成培养预测、性价比排名或即时六维加分。</p><p>资料范围：冻结引擎7.0.1的属性、价格与技能权限，60支当前参考球队的采购账目，以及League联赛成长成本表。</p><details><summary>League 成长与 SPP · ${titles.length} 个档位</summary><p>表内单位为 SPP，按相应成长档位读取。赛事采购 Skill Points 与 League SPP 分别适用。</p>${spp}<p>技能类别：${esc(Object.entries(advancement.skillCategories ?? categoryLabels).map(([code,name])=>`${code} · ${categoryLabels[code] ?? name} (${name})`).join('；'))}。</p>${advancement.randomSecondary?.cost==null?'<p>冻结表未列随机次类技能成本，保留未提供。</p>':''}</details><details><summary>职位价格与球队技能权限 · ${positions.length} 份基础档案</summary>${positions.map(position=>`<details><summary>${esc(position.name)} · ${esc(position.profileId)} · ${esc(money(position.cost))}</summary>${table(['球队','主类权限','次类权限','权限来源一致','属性来源一致'],list(position.rosterAccess).map(access=>[access.rosterName ?? access.rosterId,categories(access.primary),categories(access.secondary),access.eligibilityMatchesEngine===true?'一致':access.eligibilityMatchesEngine===false?'存在差异':'未核对',access.atlasProfileMatchesEngine===true?'一致':access.atlasProfileMatchesEngine===false?'存在差异':'未核对']))}${list(position.rosterAccess).filter(access=>access.eligibilityMatchesEngine===false||list(access.profileDifferences).length).map(access=>`<details><summary>${esc(access.rosterName ?? access.rosterId)} · 双源差异</summary>${differences(access.profileDifferences)}${access.eligibilityMatchesEngine===false?detail('历史技能权限来源',access.skillEligibilitySource):''}<p>原图鉴与冻结引擎值分别保留，事实展示不改写图鉴。</p></details>`).join('')}</details>`).join('')}</details><details><summary>明星价格与招募事实 · ${stars.length} 名</summary>${stars.map(star=>`<details><summary>${esc(star.name)} · ${esc(money(star.cost))}</summary>${detail('招募限制',star.playsFor)}${detail('价格解释',star.purchaseCostInterpretation)}<p>明星不套用普通职位球员的 League 成长成本表。</p>${list(star.profileDifferences).length?differences(star.profileDifferences):'<p>所核对图鉴字段与冻结引擎一致。</p>'}</details>`).join('')}</details><details><summary>实际参考球队采购账目 · ${teams.length} 支</summary><p>金额按当前参考名单与赛制列示；任务动作资源仍使用各任务冻结的共同预算。</p>${table(['球队','赛制','采购预算','采购 RR','球员成本','RR 成本','职员成本','总成本','剩余预算','合法性'],teams.map(team=>[team.name,team.format,money(team.budget),team.purchasedRerolls,money(team.costs?.players),money(team.costs?.rerolls),money(team.costs?.staff),money(team.costs?.total),money(team.remainingBudget),team.legality?.status==='valid'?'名单已验证':team.legality?.status ?? '未提供']))}</details><details><summary>即时任务与长期效果的适用界限</summary>${list(advancement.skillsExcludedFromImmediateSixAxes).map(row=>`<div class="st-fact"><span>${esc(row.name ?? row.skillId)}</span><span>${esc(row.exclusionReason ?? row.mechanism)}</span></div>`).join('')}<ul>${list(facts.limitations).map(limit=>`<li>${esc(limit)}</li>`).join('')}</ul></details>`;
    };
    const auditRows = new Map();
    const auditLoads = new Map();
    const auditCard = (row, kind) => {
      const key=kind+':'+row.id;auditRows.set(key,row);
      return `<details data-audit-key="${esc(key)}"><summary>${esc(row.label ?? row.name ?? row.id)} · ${esc(statusText(row.status))}</summary>${detail('计算节点',row.nodes)}${detail('生效接口',row.interfaces)}${detail('规则机制',row.mechanism)}${detail('规则来源',row.source ?? row.ruleSource)}${detail('正常触发证据',row.triggerTest)}${detail('不触发证据',row.nonTriggerTest)}${detail('关键互动证据',row.interactionTest)}${detail('资格与次数限制',row.gates)}${kind==='star'?detail('有限使用窗口',row.finiteWindow):''}${detail('已验收范围与限制',row.limitation)}<div data-audit-evidence></div></details>`;
    };
    const loadAudit = (key,row) => {
      const cached=window.BB_STANDARD_TASK_AUDIT_DETAILS_V3?.[key];
      if(cached)return Promise.resolve(cached);
      if(!row.detailScript)return Promise.resolve({cases:[],limitation:'此条目尚未提供静态复现详情。'});
      if(!auditLoads.has(key))auditLoads.set(key,new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=row.detailScript;
        script.onload=()=>{const result=window.BB_STANDARD_TASK_AUDIT_DETAILS_V3?.[key];if(result)resolve(result);else{auditLoads.delete(key);reject(new Error('审计详情未包含对应条目，请核对缓存版本。'));}};
        script.onerror=()=>{auditLoads.delete(key);reject(new Error('审计详情读取失败，可重新展开重试。'));};
        document.head.appendChild(script);
      }));
      return auditLoads.get(key);
    };
    const auditEvidence = full => {
      const layerNames={normalTrigger:'正常触发',trigger:'正常触发',normal:'正常触发',nonTrigger:'不触发',nontrigger:'不触发',non:'不触发',keyInteraction:'关键互动',interaction:'关键互动'};
      const cases=list(full.cases);
      return detail('详情范围与限制',full.limitation ?? full.limits ?? '以以下具体局面和断言为验收范围。')+cases.map((item,index)=>{
        const layer=item.layer ?? item.type ?? item.kind ?? item.role;
        const calls=list(item.calls);
        const events=list(item.events).length?list(item.events):calls.flatMap(call=>list(call.events ?? call.result?.events));
        const assertions=list(item.assertions);
        return `<details class="st-audit-case"><summary>${esc(layerNames[layer] ?? '验收案例')} · ${esc(item.label ?? item.title ?? item.id ?? '案例 '+(index+1))} · ${esc(statusText(item.status ?? '证据状态未提供'))}</summary>${detail('验收断言数量',assertions.length)}${detail('实际输入与骰面记录',calls.length || (item.input?1:0))}${detail('来源文件',item.sourceFile ?? item.source ?? item.fixtureSourceFile)}${detail('来源 SHA-256',item.sourceSha256)}${events.length?`<details><summary>实际规则结算事件 · ${events.length} 条</summary><ul>${events.map(event=>`<li>${esc(event.text ?? event.message ?? show(event))}</li>`).join('')}</ul></details>`:'<p>事件记录见完整复现数据。</p>'}${rawDetails('验收断言',assertions)}${rawDetails('完整输入、骰面、事件和结果',item)}${item.fixtureSource?`<details><summary>复现脚本</summary><pre>${esc(item.fixtureSource)}</pre></details>`:''}</details>`;
      }).join('')+(cases.length?'':'<p>该条目暂无可展示的复现案例。</p>');
    };
    root.innerHTML = `<div class="st-heading"><div><p class="st-kicker">STANDARD TASKS · ${esc(data.version)}</p><h2>标准任务六维赋分</h2></div><span class="st-badge">${refreshedTeams ? "当前军表 · 六维已接入" : data.summary.rosterCandidateTeams ? "候选军表 · V11生存" : data.summary.survivalV9Teams ? "V9 · 十一人制全队生存" : data.summary.updatedElevenPlayerTeams ? "V8 · 十一人制任务择优" : "V7 · 历史标准任务赋分"}</span></div>
      <p class="st-intro">先计算标准任务底分，再按同赛制比较池进行0—100名次赋分，用赋分绘制六维雷达。十一人制个人使用187个规范合约／基础档案，七人制使用130个规范档案，球队按各赛制30支分池；12份变体不改变比较池。同底分并列同分，绝对底分与真实任务概率保留。综合分按六维22/18/16/15/15/14权重计算；总榜赋分和等级在规范池内另列，六维雷达不变。</p><p>十一人制个人第六维采用最佳合法球队出场贡献，衡量适配上限，按14%进入综合分。球队内补强／缺阵／替补明细保留，切换明细不改变全局评分。球队适应力沿用已确认的替代深度模型。</p>
      ${refreshedTeams ? '<p>当前30队高手军表：30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留。个人第六维采用最佳球队贡献；跨队综合总评已启用；七人制保留原分。</p>' : data.summary.rosterCandidateTeams ? `<p>候选版重算十一人制${data.summary.rosterCandidateTeams}队1150K军表。新旧军表按同口径V11生存比较，历史V9另列；个人与七人制保留V7。V11生存来自首发11人的ABC聚合；原16项生存模板继续保留为独立诊断，不再次计入生存轴。</p>` : data.summary.survivalV9Teams ? `<p>V9仅重算十一人制30队生存：5280个首发任务单元，15项相对赋分保留范围；其他五维、个人与七人制冻结。16项生存中7项合成、9项独立诊断，权重与新旧差异见全队生存专页。</p>` : data.summary.updatedElevenPlayerTeams ? `<p>本阶段更新十一人制${data.summary.updatedElevenPlayerTeams}队、${data.summary.teamCandidateCells}个候选；七人制与个人保持V7。</p>` : ""}<div class="st-summary">${(refreshedTeams ? [['当前更新维度','快攻 / 控球 / 杀伤 / 生存 / 控场 / 适应力'],['当前控球任务',16],['当前军表球队',summary.teams ?? summary.rosterCandidateTeams ?? '待统计']] : [['已注册模板',summary.templates],['已定义节点',summary.nodes],['球员/明星档案',summary.dossiers ?? dossiers.length],['任务覆盖维度',summary.completeAxes],['个人精确单元',summary.computedCells],['个人范围单元',summary.intervalCells],['未完成单元',summary.pendingCells],['球队与共享链',`${summary.teams ?? 0} / ${summary.sharedTeamCells ?? 0}`]]).map(([label,value])=>`<div><b>${esc(value ?? '待统计')}</b><span>${label}</span></div>`).join('')}</div>
      <details class="st-section"><summary>评测完成清单</summary>${list(data.foundation?.checklist).map(row=>`<div class="st-fact"><span>${esc(row.label ?? row.id)}</span><span>${esc(row.status==='complete'?'评测范围已完成':statusText(row.status))}<br>${esc(show(row.scope))}</span></div>`).join('') || '<p>基础完成清单尚未提供。</p>'}<p>区间表示底层概率的上下界。已评测数量与精确概率数量分别列示；规则证明的真实零分属于已评测任务。范围不是统计置信区间。</p>${detail('个人任务状态统计',summary.statuses)}${detail(refreshedTeams?'当前控球任务状态':window.BB_ROSTER_CANDIDATE_ACTIVE?'本阶段30队已选任务状态（含共享）':'球队任务状态统计',refreshedTeams?summary.candidateSelectedTaskStatuses:window.BB_ROSTER_CANDIDATE_ACTIVE?summary.candidateSelectedTaskStatuses:summary.teamStatuses)}</details>
      <details class="st-section"><summary>冻结规则与计算口径</summary>${detail('引擎版本',rules.engineVersion)}${detail('引擎 SHA-256',rules.engineSha256)}${detail('规则来源',rules.rules)}${detail('FAQ 状态',rules.faqStatus)}${detail('缓存生成时间',data.generatedAt)}${detail('已接入求解器模板',summary.templatesWithSolver)}<p>底分 = 100 × 标准任务收益期望；页面主分 = 100 ×（底分较低人数＋（同底分人数−1）/2）÷（比较池人数−1）。本版在六维显示层恢复旧midrank规则，其他五维使用V4已确定的整数底分，保留其精度与并列；候选十一人制的V11生存使用未先取整的ABC底分。不同赛制、个人与球队不混池；相对赋分不是概率或实战校准。</p></details>
      <div class="st-controls"><label>类型<select data-filter="kind"><option value="all">全部档案</option><option value="team">球队</option><option value="player">基础球员</option><option value="star">明星</option></select></label><label>赛制<select data-filter="format"><option value="all">全部赛制</option>${[...new Set(dossiers.map(d=>d.format).filter(Boolean))].map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select></label><label>搜索<input data-filter="search" type="search" placeholder="球员或球队名字" /></label><label class="st-select-person">选中档案<select data-filter="person"></select></label></div><p class="st-match" aria-live="polite"></p><div class="st-dossier"></div>
      <details class="st-section"><summary>${esc(summary.nodes ?? list(data.nodes).length)} 个底层计算节点说明</summary><div class="st-nodes">${list(data.nodes).map(n=>`<div><h4>${esc(n.id)} · ${esc(n.label)}</h4><p>${esc(n.description)}</p></div>`).join('') || '<p>节点定义未提供。</p>'}</div></details>
      <details class="st-section"><summary>属性与规则参数映射</summary>${list(impact.attributes).map(row=>detail(row.id,{parameters:row.parameters,nodes:row.nodes,limitation:row.limitation})).join('')}</details>
      <details class="st-section"><summary>技能覆盖审计 · ${esc(audit.verified ?? '待核验')} / ${esc(audit.total ?? '待统计')} 已验证</summary><p>逐项查看正常触发、不触发、关键互动的真实输入、骰面、结算事件和断言。验收只覆盖所列局面，未建模不视为零贡献。</p><div class="st-audit">${list(audit.entries).map(row=>auditCard(row,'skill')).join('') || '<p>审计条目未提供。</p>'}</div></details>
      <details class="st-section"><summary>明星规则声明与验收 · ${esc(rawAudit.stars?.verified ?? '待核验')} / ${esc(rawAudit.stars?.total ?? '待统计')}</summary><p>正常触发、不触发、关键互动和有限次数窗口分别提供证据；声明或注册不能代替执行验收。</p><div class="st-audit">${list(rawAudit.stars?.entries ?? data.starAudit?.registry ?? data.stars?.registry).map(row=>auditCard(row,'star')).join('') || '<p>明星注册表未提供。</p>'}</div></details>
      <details class="st-section"><summary>阵容贡献与长期培养 · 独立模块</summary><p>阵容贡献须共享球、行动顺序、重掷和特殊动作资源；长期培养另计价格、成长及伤病。两者不并入当前场上能力。</p><p>${esc(data.teamStatus.status)}：${esc(data.teamStatus.scope)}</p><p>${esc(data.growthStatus.status)}。${esc(data.growthStatus.scope)}</p><details data-foundation-facts><summary>价格、技能权限、SPP 与采购事实</summary><div data-facts-content></div></details></details>`;
    const factsSection=root.querySelector('[data-foundation-facts]');
    factsSection?.addEventListener('toggle',()=>{if(!factsSection.open||factsSection.dataset.loaded)return;factsSection.dataset.loaded='true';factsSection.querySelector('[data-facts-content]').innerHTML=factsView(data.foundationFacts);});
    root.querySelectorAll('[data-audit-key]').forEach(element=>element.addEventListener('toggle',async()=>{
      if(!element.open||element.dataset.auditLoaded)return;
      element.dataset.auditLoaded='loading';const target=element.querySelector('[data-audit-evidence]');target.textContent='正在读取这项规则的静态验收证据…';
      try{const key=element.dataset.auditKey;target.innerHTML=auditEvidence(await loadAudit(key,auditRows.get(key)));element.dataset.auditLoaded='true';}
      catch(error){target.textContent=error.message;delete element.dataset.auditLoaded;}
    }));
    const controls = Object.fromEntries([...root.querySelectorAll('[data-filter]')].map(el=>[el.dataset.filter,el]));
    const display = root.querySelector('.st-dossier');
    const radar = axes => {
      const rows = axes.slice(0,6);
      if (!rows.length) return '<p>尚无维度定义。</p>';
      const point = (i,v) => { const a = -Math.PI/2 + i*2*Math.PI/rows.length; return [140+95*v/100*Math.cos(a),140+95*v/100*Math.sin(a)]; };
      const full = row => num(row.score) && num(row.completedTemplates) && row.completedTemplates === row.totalTemplates;
      let svg = '<svg class="st-radar" viewBox="0 0 280 280" role="img" aria-label="标准任务六维雷达；雷达使用同赛制相对赋分，绝对底分与任务概率单列">';
      for (const radius of [25,50,75,100]) svg += `<polygon class="st-radar-grid" points="${rows.map((_,i)=>point(i,radius).join(',')).join(' ')}"/>`;
      rows.forEach((row,i)=> { const p = point(i,100), label = point(i,123); svg += `<line class="st-radar-grid" x1="140" y1="140" x2="${p[0]}" y2="${p[1]}"/><text x="${label[0]}" y="${label[1]}" text-anchor="middle">${esc(row.label)}</text>`; if(full(row)){const q=point(i,Math.min(100,Math.max(0,row.score)));svg+=`<circle class="st-radar-dot" cx="${q[0]}" cy="${q[1]}" r="4"/>`;const next=rows[(i+1)%rows.length];if(full(next)){const r=point((i+1)%rows.length,Math.min(100,Math.max(0,next.score)));svg+=`<line class="st-radar-edge" x1="${q[0]}" y1="${q[1]}" x2="${r[0]}" y2="${r[1]}"/>`;}} });
      rows.forEach((row,i)=>{if(!full(row)&&num(row.lowerBound)&&num(row.upperBound)){const lo=point(i,row.lowerBound),hi=point(i,row.upperBound);svg+=`<line class="st-radar-range" x1="${lo[0]}" y1="${lo[1]}" x2="${hi[0]}" y2="${hi[1]}"><title>${esc(row.label)}：结果范围 ${range(row)}，没有主分</title></line>`;}});
      return svg+'</svg><p class="st-caption">雷达使用0—100相对赋分；分赛制、个人/球队分池，同底分同赋分。绝对底分和任务概率另列，赋分不是成功率。</p>';
    };
    const viewAxes = row => {
      const axes=list(row?.axes).slice();
      if(row?.format==='11s'&&row?.subjectType!=='team')return axes.filter(a=>a.id!=='adaptability').concat(window.BB_TEAM_IMPORTANCE.axisFor(row));
      if (!axes.some(a=>a.id==='adaptability')) {
        const a=row?.adaptability || {};
        axes.push({...a,id:'adaptability',label:a.evidenceMode==='team-importance'?'球队重要性':'适应',completedTemplates:['complete','certified-display'].includes(a.status)&&num(a.score)?1:0,totalTemplates:1,exactTemplates:a.status==='complete'?1:0});
      }
      return axes;
    };
    const absoluteBase = a => num(a?.absoluteDisplayScore) ? ['survival-v11','ball-control-5050'].includes(a.evidenceMode) ? a.absoluteDisplayScore.toFixed(4) : a.absoluteDisplayScore : Array.isArray(a?.absoluteIntegerRange) ? a.absoluteIntegerRange.join("—") + "（整数底分范围；赋分精度见主分）" : num(a?.absoluteLowerBound)&&num(a?.absoluteUpperBound) ? a.absoluteLowerBound.toFixed(4)+"—"+a.absoluteUpperBound.toFixed(4)+"（底分范围）" : "未确定";
    const precision = a => ['team-importance-context','best-team-field-contribution'].includes(a?.evidenceMode)?a.precision:a?.status==='pending-definition' ? '全局个人定义待完成；不填零、不用旧职责份额、不跨队合成' : a?.assignment ? `规范比较池 ${a.assignment.poolSize} · ${a.assignment.projected?'变体插入赋分':'并列同分'} · 绝对底分 ${absoluteBase(a)}` : a?.scoreStatus==='certified-display'||a?.status==='certified-display'||a?.displayCertificate ? '整数分精度已确定；底层概率界仍保存，不取中点' : '精确概率聚合';
    const controlEvidence = d => {
      const a=d.axes.find(a=>a.id==='ballControl'),e=a?.aggregation;
      if(!d.ballControlVersion||!e)return '';
      const display=r=>num(r?.lowerBound)&&num(r?.upperBound)?(100*r.lowerBound).toFixed(4)+(Math.abs(r.upperBound-r.lowerBound)>1e-8?'—'+(100*r.upperBound).toFixed(4):''):'未确定';
      return '<details class="st-section"><summary>控球50／50相乘式 · 计算依据</summary><p>主力处理球50%：16项任务逐项取首发前三人平均。接应50%：接准确快传、接交接球、散球回收各取首发11人中前8人平均，再三项等权。主力P与接应R以√(P×R)合成；这是几何平均评分，不是整条行动成功率。不单列多人配合加分。上方逐任务数值为最佳单人诊断，最终计分采用本节聚合结果。</p>'+detail('主力处理球底分',display(e.primary))+detail('全队接应底分',display(e.reception))+rawDetails('逐人、逐任务计分证据与边界',e)+'</details>';
    };
    const currentRosterEvidence = d => d.rosterUpdateScope==='ballControl-survival-only' ? `<details class="st-section"><summary>当前军表与生存ABC · 计算依据</summary><p>30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留。明星是否首发以固定首发名单为准。控球对无重掷、允许军表资源两政策各取一半；后者使用购买重掷与大厨每半场整数2枚，Leader仅在首发在场且符合资格时生效。生存仍使用V11固定1枚重掷任务，其吉祥物、贿赂、医师未建模；杀伤资源与罚下计价按下方独立证据。</p>${detail('军表来源',d.profile?.sourceRoster)}${detail('固定首发11人',d.profile?.starterIds)}${detail('首发选择依据',d.starterSelection)}${rawDetails('生存ABC聚合与边界',d.survivalScore?.aggregation ?? d.axes?.find(a=>a.id==='survival')?.aggregation ?? d.survivalScore)}${detail('本轮计算来源',d.calculationProvenance)}</details>` : '';
    const coverage = a => a.integrationCurrent ? '当前独立指标；来源与范围见展开依据' : a.heldFromPreviousRoster ? '沿用旧名单评分，待重算' : a.evidenceMode==='ball-control-5050' ? '主力前三人／接应前8人，50/50几何平均，底分不先取整' : a.evidenceMode==='survival-v11' ? '首发11人ABC，25/70/5几何平均' : `已评测 ${esc(a.completedTemplates ?? '未知')} / ${esc(a.totalTemplates ?? 16)} · 精确概率 ${esc(a.exactTemplates ?? (a.lowerBound===a.upperBound?a.completedTemplates:'未提供'))}`;
    const isComplete = a => num(a.score) && num(a.completedTemplates) && a.completedTemplates===a.totalTemplates;
    const cells = row => viewAxes(row).map(a=>`<div class="st-axis"><div><b>${esc(a.label)}</b><span>${a.status==='no-matching-roster-context'?'无相同技能军表实例':a.status==='pending-definition'?'当前不赋分':a.heldFromPreviousRoster?'旧名单赋分':isComplete(a)?'六维相对赋分':'结果范围 · 见任务状态'}</span></div><strong>${a.status==='no-matching-roster-context'?'暂无匹配':a.status==='pending-definition'?'待定义':isComplete(a)?score(a.score):esc(range(a))}${isComplete(a)?` <small class="integrated-grade">${window.BB_STANDARD_TASK_INTEGRATION?.grade(a.score) ?? ''}</small>`:''}</strong><div class="st-axis-meta">${a.id==='adaptability'?esc(precision(a)):`${coverage(a)} · 百分位 ${isComplete(a)&&num(a.percentile)?Math.round(a.percentile):'未提供'}<br>${esc(precision(a))}`}</div></div>`).join('');
    const find = (person, kind, format) => {
      const name=typeof person==='string'?person:person?.name;
      const targetKind=kind==='team'?'team':kind==='star'?'star':'player';
      if(targetKind==='star'&&person&&typeof person==='object'&&(person.isStarPair||list(person.members).length)){
        return dossiers.find(d=>d.subjectType==='star'&&d.format==='11s'&&
          (d.subjectId===person.id||d.profile?.id===person.id))||null;
      }
      const aliases={'Phoenix Warrior':'High Elf Thrower','White Lion':'High Elf Catcher','Dragon Prince':'High Elf Blitzer'};
      const names=[name,aliases[name]].filter(Boolean);
      const matches=dossiers.filter(d=>d.subjectType===targetKind && (!format || d.format===format) && (targetKind==='team'&&typeof person==='object'?(d.subjectId===person.id||(window.BB_ROSTER_CANDIDATE_ACTIVE&&d.profile?.id===person.id)):names.includes(d.name)));
      if (person && typeof person==='object') {
        if(targetKind==='team'){const sameRoster=(a,b)=>JSON.stringify(list(a).map(p=>[p.id,p.number,p.positionId,p.ma,p.st,p.ag,p.pa,p.av,p.skills,p.boughtSkill,p.veteran,p.captain,p.keywords]))===JSON.stringify(list(b).map(p=>[p.id,p.number,p.positionId,p.ma,p.st,p.ag,p.pa,p.av,p.skills,p.boughtSkill,p.veteran,p.captain,p.keywords]));return matches.find(d=>person.rosterId===d.profile?.rosterId&&sameRoster(person.players,d.profile?.players))||null;}
        const skillKey = skills => list(skills).map(s=>JSON.stringify(typeof s==='string'?[s,null]:[s.id,s.value ?? null])).sort().join('|');
        const keywordKey=keywords=>list(keywords).map(value=>String(value).normalize('NFKC').trim()).sort().join('|');
        const exactMatches=matches.filter(d=>['ma','st','ag','pa','av'].every(k=>!Object.hasOwn(person,k) || d.profile?.[k]===person[k]) && (!Array.isArray(person.skills) || skillKey(person.skills)===skillKey(d.profile?.skills)) && (!Array.isArray(person.keywords) || keywordKey(person.keywords)===keywordKey(d.profile?.keywords)) && (!list(person.sourceRosters).length || list(person.sourceRosters).some(id=>list(d.profile?.sourceRosters).includes(id))));
        if(exactMatches.length && new Set(exactMatches.map(row=>row.subjectId)).size===1)return exactMatches[0];
      }
      return typeof person === 'object' || new Set(matches.map(row=>row.subjectId)).size>1 ? null : matches[0] || null;
    };
    window.BB_STANDARD_TASK_VIEW={radar:row=>radar(viewAxes(row)),cells,find,summary:row=>row?.rosterUpdateScope==='ballControl-survival-only'?'<span class="st-caption">30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留</span>':row?`<span class="st-caption">标准任务六维赋分 · ${viewAxes(row).filter(a=>num(a.completedTemplates)&&a.completedTemplates===a.totalTemplates).length} / ${viewAxes(row).length} 维任务已覆盖 · 精度见详情，综合权重见总榜说明</span>`:'<span class="st-caption">标准任务六维赋分档案尚未提供</span>'};
    const portrait = d => {
      const p=d.profile || {}, atlas=window.ATLAS_DATA || {};
      if(p.portrait) return p.portrait;
      if(d.subjectType==='team')return list(atlas.teams).find(t=>t.id===d.subjectId)?.portrait || '';
      if(d.subjectType === 'star') return list(atlas.stars).find(s=>s.id===(p.id ?? d.subjectId))?.portrait || '';
      for(const roster of list(atlas.rosters)){if(list(p.sourceRosters).length && !p.sourceRosters.includes(roster.id))continue;const position=list(roster.positions).find(v=>v.name===d.name);if(position)return (window.BB_BASE_PORTRAITS || {})[`${roster.id}:${position.id}`] || position.portrait || '';}
      return '';
    };
    const pairMembers = d => list(d?.members).length ? d.members : list(d?.profile?.members);
    const memberPortraits = d => pairMembers(d).map(member => {
      const url=member.portrait;
      return `<span class="paired-star-member-portrait">${url?`<img src="${esc(window.BB_STANDARD_TASK_INTEGRATION?.imageUrl(url) || url)}" alt="${esc(member.name)} 肖像" loading="lazy">`:'<span class="st-no-portrait">暂无头像</span>'}</span>`;
    }).join('');
    const memberDetails = d => `<section class="paired-star-members" aria-label="双人明星组合成员"><h4>两位真实成员 · 各自结算</h4>${pairMembers(d).map(member=>
      `<article class="paired-star-member"><b>${esc(member.name)}</b><p>MA ${esc(member.ma)} · ST ${esc(member.st)} · AG ${esc(member.ag==null?'—':member.ag+'+')} · PA ${esc(member.pa==null?'—':member.pa+'+')} · AV ${esc(member.av==null?'—':member.av+'+')}</p><p><b>技能：</b>${esc(member.skillText ?? list(member.skills).map(skill=>skill.name ?? skill.id ?? skill).join('、'))}</p><p><b>专属规则：</b>${esc(member.specialRules ?? member.rule?.summary ?? '未提供')}</p></article>`).join('')}<p>组合一次合约；这里没有合成的 MA/ST 等个人属性。</p></section>`;
    const importanceDetails = value => {
      const metric={recruitmentGain:'补强收益',absenceLoss:'缺阵损失',reserveEntryGain:'替补入场收益'};
      const rows=(Array.isArray(value)?value:list(value?.rows ?? value?.contexts ?? value?.records ?? (value?.metricKind?[value]:[])))
        .filter(row=>Object.hasOwn(metric,row.metricKind)&&row.unit==='abilityPoints');
      if(!rows.length)return '<details class="st-section"><summary>球队重要性详情 · 暂无匹配上下文</summary><p>没有当前合法球队的匹配记录；不记为零，也不据此给出个人适应力或总评。</p></details>';
      const groups=new Map();
      for(const row of rows){const key=row.teamId+'|'+row.metricKind;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
      const valueText=n=>num(n)?n.toFixed(3):'未提供';
      return `<details class="st-section"><summary>球队重要性详情 · ${rows.length} 条上下文</summary><p>单位为 abilityPoints。补强、缺阵与替补入场是不同反事实，只在同队同指标内比较；这些明细只在同队同指标比较；个人第六维另取合法球队最佳出场贡献。</p>${[...groups.values()].map(group=>{
        const first=group[0];
        return `<details><summary>${esc(first.teamName ?? first.teamId)} · ${esc(metric[first.metricKind] ?? first.metricKind)} · ${group.length} 条</summary>${table(['对象/成员','候选变化','原阵容','变动后','队内名次','合约价','人数','条件','状态','来源案例'],group.map(row=>[list(row.memberIds).join(' + ')||row.subjectId,valueText(row.rawScore),valueText(row.baselineScore),valueText(row.afterScore),row.withinTeamRank??'不适用',row.contractPrice==null?'未提供':money(row.contractPrice),row.registeredBodies,row.conditions,row.modelStatus,row.sourceCaseId??'未提供']))}</details>`;
      }).join('')}</details>`;
    };
    const contextualAdaptabilityDetails = (d,a) => {
      if(d.format==='11s' && d.subjectType!=='team'){
        const api=window.BB_TEAM_IMPORTANCE,options=api.contextsFor(d),current=api.contextAxisFor(d),record=current.aggregation?.record;
        if(!record){const related=api.relatedFor(d);return `<div class="st-adapt"><h4>球队重要性</h4><p>当前基础档案没有相同技能的军表实例，不能直接套用。${related.length?'以下是同位置的实际军表球员，已含各自购入技能，可打开查看：':'当前军表未使用这个基础位置；不是零分。'}</p>${related.map(r=>`<button type="button" class="featured-action" data-importance-record="${esc(r.recordId)}">${esc(r.teamName)} ${esc(r.subjectName)} #${r.number??'—'} · ${r.rawScore.toFixed(4)} · ${esc(r.profile.skillText)}</button>`).join('')}</div>`;}
        return `<div class="st-adapt"><h4>球队内重要性明细</h4><label>球队／球员实例<select data-importance-context>${options.map(r=>`<option value="${esc(r.recordId)}" ${r.recordId===record.recordId?'selected':''}>${esc(r.teamName)} · ${esc(window.BB_IMPORTANCE_AXIS_DATA.metricLabels[r.metricKind])}${r.number?' #'+r.number:''}</option>`).join('')}</select></label><strong>${num(current.score)?score(current.score):'单对象不赋相对分'}</strong><p>${esc(record.teamName)} · ${esc(window.BB_IMPORTANCE_AXIS_DATA.metricLabels[record.metricKind])}：<b>${record.rawScore.toFixed(4)} 能力点</b>。同队同指标 ${record.comparison.rank} / ${record.comparison.poolSize}。</p><p>此处切换只改变球队内明细；第六维和综合分始终使用最佳合法球队出场贡献。保留负值。</p></div>`;
      }
      if(a.integrationCurrent)return `<div class="st-adapt"><h4>适应力 · 七职责替代深度</h4><strong>${num(a.score)?score(a.score):'待完成'}</strong>${detail('原始底分',a.absoluteDisplayScore)}<p>按当前球队首发职责和合格替补人数计算备份深度；一人再强只计一人，不代表实战成功率。</p>${rawDetails('完整职责与来源',a.aggregation)}</div>`;
      return `<div class="st-adapt"><h4>适应 · ${a.heldFromPreviousRoster?'旧名单赋分':'相对赋分'}</h4><strong>${['complete','certified-display'].includes(a.status)&&num(a.score)?score(a.score):esc(range(a))}</strong>${a.heldFromPreviousRoster?'<p>沿用旧名单评分，待重算。</p>':''}${detail('状态',statusText(a.scoreStatus ?? a.status ?? 'incomplete'))}${detail('主分精度',precision(a))}${detail('绝对适应底分',a.absoluteDisplayScore)}${detail('赋分依据',a.assignment)}${detail('底分精度证据',a.absoluteCertificate)}${detail('角色任务平均',num(a.roleMean)?Number(a.roleMean.toFixed(2)):null)}${detail('压力场景较低分位',num(a.pressureLowQuantile)?Number(a.pressureLowQuantile.toFixed(2)):null)}<p>50% 角色平均 + 50% 压力较低分位；两项权重待验证。先计算绝对适应底分，再按同赛制规范池赋分；本版按14%权重纳入六维综合分。</p></div>`;
    };
    const adaptabilityDetails=(d,a)=>{
      if(d.format!=='11s'||d.subjectType==='team')return contextualAdaptabilityDetails(d,a);
      const v=window.BB_TEAM_IMPORTANCE.axisFor(d),g=v.aggregation,b=g?.best;
      const global=`<div class="st-adapt"><h4>个人价值 · 最佳球队贡献</h4><strong>${num(v.score)?score(v.score):'无合法当前位置'}</strong><p>${b?esc(b.teamName)+' · '+v.absoluteScore.toFixed(4)+' 能力点；合法球队 '+g.legalTeamCount+' 支。':'此历史属性变体不匹配现行位置，不进入规范榜，也不填零。'}</p><p>衡量最佳适配下的出场贡献：同一合法阵容有本人时的能力，减去移除本人且不补人的能力。空位对照仍用11人分母，避免与强化同位置球员作降配比较；不按价格折算，按14%计入综合评价。</p>${g?rawDetails('最佳方案、本人缺席对照与全部合法球队',g):''}</div>`;
      return global+'<details class="st-section"><summary>查看具体球队的重要性明细</summary>'+contextualAdaptabilityDetails(d,a)+'</details>';
    };
    let filtered=[];
    const renderPerson = () => {
      const d=filtered.find(row=>personKey(row)===controls.person.value);
      if(!d){display.innerHTML='<div class="st-empty">没有匹配的球员档案。</div>';return;}
      const axes=d.format==='11s'&&d.subjectType!=='team'?list(d.axes).filter(a=>a.id!=='adaptability'):list(d.axes), adap=window.BB_TEAM_IMPORTANCE?.axisFor(d) || d.adaptability || {}, refreshed=d.rosterUpdateScope==='ballControl-survival-only', image=window.BB_STANDARD_TASK_INTEGRATION?.portrait(d) || portrait(d), p=d.profile || {}, paired=Boolean(d.isStarPair || p.isStarPair), pairCost=p.cost ?? list(window.ATLAS_DATA?.stars).find(star=>star.id===d.subjectId)?.cost;
      const complete = row => num(row.score) && num(row.completedTemplates) && row.completedTemplates===row.totalTemplates;
      display.innerHTML=`<article class="st-card"><div class="st-person"><button type="button" data-open-profile>${paired?`<span class="paired-star-portraits">${memberPortraits(d)}</span>`:image?`<img src="${esc(window.BB_STANDARD_TASK_INTEGRATION?.imageUrl(image) || image)}" alt="${esc(d.name)}" loading="lazy">`: '<span class="st-no-portrait">暂无头像</span>'}<strong>${esc(d.name)}</strong></button><p data-profile-note aria-live="polite"></p>${window.BB_STANDARD_TASK_INTEGRATION?.overallSummary(d) || ''}<p>${d.subjectType==='team'?'实际参考球队':d.subjectType==='star'?'明星':'基础球员'} · ${esc(d.format)}</p><p>${d.subjectType==='team'?esc(`${list(p.players).length}名实际球员 · 原名单采购重掷${p.rerolls ?? '未提供'} · ${refreshed?'控球按军表可用资源；生存固定1RR':'任务统一1RR'}`):paired?esc(`两名真实成员 · 一次合约 ${num(pairCost)?money(pairCost)+' 金币':'价格见图鉴'}`):esc(['ma','st','ag','pa','av'].map(k=>`${k.toUpperCase()} ${p[k] ?? '—'}`).join(' · '))}</p><p>${d.subjectType==='team'?esc(d.teamScope):paired?'':esc(p.skillText ?? show(p.skills))}</p>${paired?memberDetails(d):''}${refreshed?'<p>30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留。</p>':window.BB_ROSTER_CANDIDATE_ACTIVE&&d.subjectType==='team'&&d.format==='11s'?'<p><a href="#roster-candidate-comparison">候选军表：同口径V11新旧差异 →</a></p>':d.survivalVersion?'<p><a href="#team-survival-v9">V9生存：全队11人聚合与新旧差异 →</a></p>':''}${radar(viewAxes(d))}</div><div class="st-metrics"><h3>六维相对赋分 <small>0—100</small></h3>${axes.map(a=>`<div class="st-axis"><div><b>${esc(a.label)}</b><span>${a.heldFromPreviousRoster?'旧名单赋分':complete(a)?'六维相对赋分':'结果范围 · 见逐项状态'}</span></div><strong>${complete(a)?score(a.score):esc(range(a))}</strong><div class="st-axis-meta">${coverage(a)}${!complete(a)?' · 尚无主分':''}<br>${esc(precision(a))}<br>比较池百分位：${complete(a)&&num(a.percentile)?esc(Math.round(a.percentile)):'未提供'}</div></div>`).join('')}${adaptabilityDetails(d,adap)}</div></article><div class="st-task-groups">${axes.map(a=>`<details class="st-section"><summary>${esc(a.label)} · 标准任务证据 · ${coverage(a)}</summary><div data-task-axis="${esc(a.id)}"></div></details>`).join('')}${d.format==='11s'&&d.subjectType!=='team'?importanceDetails(d.teamImportance):''}${rawDetails('各维本轮来源',d.integrationProvenance)}${controlEvidence(d)}${currentRosterEvidence(d)}${list(d.sharedTasks).length?`<details class="st-section"><summary>${list(d.sharedTasks).length}条多人共享任务 · 独立证据，不重复加分</summary><div data-task-axis="shared"></div></details>`:''}</div>`;
      display.querySelector('[data-importance-context]')?.addEventListener('change',event=>{window.BB_TEAM_IMPORTANCE.selectFor(d,event.target.value);renderPerson();});
      display.querySelector('[data-open-profile]').addEventListener('click',()=>{
        const open=window.BB_OPEN_ATLAS_PROFILE;
        const atlasTeam=d.subjectType==='team'?(window.ATLAS_DATA?.teams||[]).find(t=>t.id===d.subjectId&&t.format===(d.format==='sevens'?'sevens':'standard')):null;
        if(!open||open({name:atlasTeam?.name||d.name,kind:d.subjectType,format:d.format,profile:d.profile,sourceRosters:d.profile?.sourceRosters})===false)display.querySelector('[data-profile-note]').textContent='图鉴尚无完全匹配的这份档案，请查看本页实验详情。';
      });
      display.querySelectorAll('img').forEach(img=>img.addEventListener('error',event=>{event.target.hidden=true;}));
      display.querySelectorAll('[data-task-axis]').forEach(container=>container.parentElement.addEventListener('toggle',()=>{
        if(!container.parentElement.open || container.dataset.loaded)return;
        container.dataset.loaded='true';
        const current=axes.find(a=>a.id===container.dataset.taskAxis);if(current?.integrationCurrent){container.innerHTML=(Array.isArray(current.aggregation?.taskEvidence)?table(['任务','原始任务值','下界','上界'],current.aggregation.taskEvidence.map(t=>[t.label??t.templateId,t.value??'未提供',t.lowerBound,t.upperBound])):'')+(current.evidenceMode==='individual-persistent-lethality'?`<p>${esc(current.aggregation.meaning)}</p><p>${esc(current.aggregation.resources)}</p><p>${esc(current.aggregation.formula)}</p><p>${esc(current.aggregation.uncertainty)}</p>${current.aggregation.profileException?`<p>本档计价/身份边界：${esc(current.aggregation.profileException.reason)} 图鉴报价 ${esc(current.aggregation.pricing.atlasCost)}，本榜本人损失计价 ${esc(current.aggregation.pricing.sourceSelfLossCost)}。</p>`:''}${table(['项目','净值 K／机会','标准误 K'],[['统一动作净杀伤 · 主分',current.aggregation.main.netK.toFixed(4),current.aggregation.main.seK.toFixed(4)]])}`:'')+(current.evidenceMode==='shared-turn-lethality'?`<p>${esc(current.aggregation.meaning)}</p><p>${esc(current.aggregation.uncertainty)}</p>${table(['参考对手','净损失 K','参考范围 K'],current.aggregation.modes.normal.opponents.map(o=>[o.name,o.defaultScore.netValueK.pointK.toFixed(4),o.defaultScore.netValueK.lower.toFixed(4)+'—'+o.defaultScore.netValueK.upper.toFixed(4)]))}`:'')+rawDetails('当前计算口径与来源',current.aggregation);return;}const axisTemplates=[...templates.values()].filter(t=>t.axisId===container.dataset.taskAxis);
        if(container.dataset.taskAxis==='shared')axisTemplates.push(...list(data.sharedTeamTemplates));
        container.innerHTML=axisTemplates.map(t=>{
          const task=[...list(d.tasks),...list(d.sharedTasks)].find(task=>task.templateId===t.id) || {};
          return `<details class="st-task" data-task-id="${esc(t.id)}"><summary>${esc(t.id)} · ${esc(task.conditions?.definition??t.label)} <span>${task.status==='complete'&&num(task.value)?`${(task.value*100).toFixed(2)} / 100 任务收益`:task.status==='interval'?`已计算范围 ${esc(range(task,100))} / 100`:esc(statusText(task.status))}</span></summary>${detail('计算状态',statusText(task.status))}${detail('规则不可能证明 / 真实零分',task.ruleProof)}${detail('契约修订',task.contractRevision)}${detail('规则资格、未解析或错误原因',task.reason)}${detail('终点条件',t.endpoint)}${detail('当前模板权重',task.survivalWeight!==undefined?task.survivalWeight===0?'独立诊断，不进入V9生存合成':task.survivalWeight:t.weight ?? '独立共享链，不重复计分')}${detail('节点',t.nodeIds)}${detail('冻结参数',t.parameters)}${detail('冻结资源',t.resources)}${detail('实际资源消耗',task.resources)}${detail('规则来源',task.source)}${detail('求解方法 / 范围',task.method)}${detail('模板求解状态',t.solverStatus)}${detail('条件',task.conditions ?? t.conditions)}${detail('来源任务集版本',task.sourceSuiteVersion ?? t.sourceSuiteVersion)}${detail('各策略结果',task.policyResults)}${detail('完整结果分布',task.outcomeDistributions)}${detail('技能触发记录 / 状态',task.triggerRecords)}</details>`;
        }).join('') || '<p>本维度模板未提供。</p>';
        container.querySelectorAll('[data-task-id]').forEach(taskElement => taskElement.addEventListener('toggle', async () => {
          if (!taskElement.open || taskElement.dataset.detailLoaded) return;
          taskElement.dataset.detailLoaded = 'loading';
          const details = document.createElement('div'); details.className = 'st-full-evidence'; details.textContent = '正在读取预计算详情…'; taskElement.appendChild(details);
          try {
            const full = await loadDetails(d), task = [...list(full.tasks),...list(full.sharedTasks)].find(row => row.templateId === taskElement.dataset.taskId);
            details.innerHTML = task ? (full.candidateVersion?detail('任务择优人选',list(task.actorIds).map(id=>{const p=list(full.profile?.players).find(p=>p.id===id);return p?'#'+p.number+' '+p.name:id;}))+detail('选人依据',task.selection)+detail('完整重放规格SHA-256',task.replaySha256)+detail('本队计算来源',full.calculationProvenance):'') + detail('实际名单与任务角色',task.teamContract ?? full.teamScope) + detail('规则不可能证明 / 真实零分',task.ruleProof) + detail('契约修订',task.contractRevision) + detail('条件与分母',task.conditions) + detail('收益类型',task.utility) + detail('完整起始局面 / 声明序列',task.replay ?? (full.candidateVersion?'本轮紧凑缓存未导出完整重放；条件与角色映射不是完整重放。可按冻结输入、来源与预算复跑。':task.conditions ?? '见原始证据链接')) + detail('终局结果分布',task.outcomeDistributions) + detail('实际资源与剩余资源分布',task.resources) + detail('求解预算',task.solverOptions ?? full.solverOptions) + detail('技能触发记录范围',task.triggerRecords ?? '源缓存未导出；不宣称完整覆盖') : '<p>该任务无详细缓存。</p>';
            taskElement.dataset.detailLoaded = 'true';
          } catch (error) { details.textContent = error.message; delete taskElement.dataset.detailLoaded; }
        }));
      }));
    };
    window.BB_OPEN_STANDARD_TASK_PROFILE = ({name,kind,format,profile,sourceRosters}={}) => {
      const row=find(profile?{...profile,name:name ?? profile.name,sourceRosters:sourceRosters ?? profile.sourceRosters}:name,kind,format);
      if(!row)return false;
      const mode=document.getElementById('score-version-mode');
      if(mode&&mode.value==='history'){mode.value='experiment';mode.dispatchEvent(new Event('change'));}
      controls.kind.value='all';controls.format.value='all';controls.search.value='';filter();controls.person.value=personKey(row);renderPerson();root.hidden=false;root.scrollIntoView({behavior:'smooth',block:'start'});return true;
    };
    window.BB_OPEN_IMPORTANCE_PROFILE = id => {
      const d=window.BB_TEAM_IMPORTANCE.rowFor(id);if(!d)return false;
      const native=dossiers.find(row=>row.subjectId===d.subjectId&&row.format==='11s'&&window.BB_TEAM_IMPORTANCE.contextsFor(row).some(r=>r.recordId===id));
      if(native){window.BB_TEAM_IMPORTANCE.selectFor(native,id);return window.BB_OPEN_STANDARD_TASK_PROFILE({name:native.name,kind:native.subjectType,format:'11s',profile:native.profile});}
      const r=d.importanceRecord,p=d.profile;
      display.innerHTML=`<article class="st-card"><div class="st-person"><h3>${esc(d.name)} · ${esc(r.teamName)}</h3>${window.BB_STANDARD_TASK_INTEGRATION.portrait(d)?`<img class="paired-star-detail-portrait" src="${esc(window.BB_STANDARD_TASK_INTEGRATION.imageUrl(window.BB_STANDARD_TASK_INTEGRATION.portrait(d)))}" alt="${esc(d.name)}" loading="lazy">`:""}<p>${['ma','st','ag','pa','av'].map(k=>k.toUpperCase()+' '+esc(p[k]??'—')).join(' · ')}</p><p>${esc(p.skillText)}</p><p>当前实际军表实例；购入技能已计入本项研究。其余五维没有完全相同的个人档案时，不借用基础球员分。</p></div><div class="st-metrics"><h4>球队重要性 · ${esc(window.BB_IMPORTANCE_AXIS_DATA.metricLabels[r.metricKind])}</h4><strong>${r.rawScore.toFixed(4)} 能力点</strong><p>同队同指标第${r.comparison.rank} / ${r.comparison.poolSize}；赋分 ${num(r.comparison.score)?r.comparison.score.toFixed(1):'单对象不赋分'}。</p>${importanceDetails([r])}<button class="featured-action" data-importance-team>查看当前球队完整军表</button></div></article>`;
      display.querySelector('[data-importance-team]').addEventListener('click',()=>{const team=list(data.teamDossiers).find(t=>t.subjectId===r.teamId);if(team)window.BB_OPEN_STANDARD_TASK_PROFILE({name:team.name,kind:'team',format:'11s',profile:team.profile});});
      const fold=root.closest('details');if(fold)fold.open=true;
      root.hidden=false;root.scrollIntoView({behavior:'smooth',block:'start'});return true;
    };
    document.addEventListener('click',event=>{const button=event.target.closest('[data-importance-record]');if(button&&!button.closest('#standard-task-rankings'))window.BB_OPEN_IMPORTANCE_PROFILE(button.dataset.importanceRecord);});
    const mode=document.getElementById('score-version-mode');
    const syncMode=()=>{if(mode)root.hidden=mode.value==='history';};
    mode?.addEventListener('change',syncMode);syncMode();
    const filter = () => {
      const previous=controls.person.value, query=controls.search.value.trim().toLocaleLowerCase();
      filtered=dossiers.filter(d=>(controls.kind.value==='all'||d.subjectType===controls.kind.value)&&(controls.format.value==='all'||d.format===controls.format.value)&&String(d.name || '').toLocaleLowerCase().includes(query));
      controls.person.innerHTML=filtered.map(d=>`<option value="${esc(personKey(d))}">${esc(d.name)} · ${esc(d.format)}${filtered.some(other=>other.subjectId!==d.subjectId&&other.name===d.name)?' · '+esc(list(d.profile?.sourceRosters).join(' / ')||d.subjectId):''}</option>`).join('');
      if(filtered.some(d=>personKey(d)===previous))controls.person.value=previous;
      root.querySelector('.st-match').textContent=`匹配 ${filtered.length} 个档案，当前仅展开选中档案。不同赛制分别评测；此列表不按分数排名。`;
      renderPerson();
    };
    controls.kind.addEventListener('change',filter);controls.format.addEventListener('change',filter);controls.search.addEventListener('input',filter);controls.person.addEventListener('change',renderPerson);filter();
    window.dispatchEvent(new CustomEvent('bb-standard-task-ready'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
