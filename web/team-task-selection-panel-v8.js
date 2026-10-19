/* V7→V8 comparison; reads published evidence without mutating scoring data. */
(() => {
  'use strict';
  const esc=v=>String(v??'未提供').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>Number.isFinite(v)?v.toFixed(1):'未确定';
  const ids=['fastAttack','ballControl','lethality','survival','control','adaptability'];
  const labels=['快攻','控球','杀伤','生存','控场','适应力'];
  const result=x=>x?.result||x;
  const repairSources=c=>({qualificationRepair:c.qualificationRepair,stagingRepair:c.stagingRepair,prefixBoundRepair:c.prefixBoundRepair});
  const interval=(x,scale=1)=>{x=result(x);const lo=x?.lowerBound??x?.value,hi=x?.upperBound??x?.value;return Number.isFinite(lo)&&Number.isFinite(hi)?Math.abs(lo-hi)<1e-10?number(scale*lo):number(scale*lo)+'–'+number(scale*hi):'未确定';};
  const baseText=a=>Number.isFinite(a?.absoluteDisplayScore)?number(a.absoluteDisplayScore):Array.isArray(a?.absoluteIntegerRange)?a.absoluteIntegerRange.join('—')+'（底分未定，排序已证）':'未确定';
  const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?(a-b>0?'+':'')+(a-b).toFixed(1):'未确定';
  const gain=(a,b)=>{a=result(a);b=result(b);return a&&b?interval({lowerBound:a.lowerBound-b.upperBound,upperBound:a.upperBound-b.lowerBound},100):'未确定';};
  const table=(heads,rows)=>`<div class="team-impact-scroll" tabindex="0"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const raw=(title,value)=>`<details class="appearance-details"><summary>${esc(title)}</summary><pre>${esc(JSON.stringify(value??null,null,2))}</pre></details>`;
  const loads=new Map();
  const load=row=>{
    const cached=window.BB_TEAM_SELECTION_DETAILS_V8?.[row.subjectId];if(cached)return Promise.resolve(cached);
    if(!loads.has(row.subjectId))loads.set(row.subjectId,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=row.detailScript;
      script.onload=()=>{const full=window.BB_TEAM_SELECTION_DETAILS_V8?.[row.subjectId];if(full)resolve(full);else{loads.delete(row.subjectId);reject(new Error('详情未提供对应球队数据'));}};
      script.onerror=()=>{loads.delete(row.subjectId);reject(new Error('详情读取失败，请核对发布文件后重试'));};document.head.appendChild(script);
    }));return loads.get(row.subjectId);
  };
  const mount=()=>{
    const root=document.getElementById('team-task-selection-comparison');if(!root)return;
    const data=window.BB_TEAM_SELECTION_DIFFERENCES_V8;
    if(!data?.rows?.length){root.innerHTML='<p>球队更新对照数据尚未加载。</p>';return;}
    const rows=data.rows;let selected=rows.find(r=>r.format==='11s'&&/norse/i.test(r.subjectId))||rows[0];
    const mode=document.getElementById('score-version-mode');const visibility=()=>{root.hidden=mode?.value==='history';};mode?.addEventListener('change',visibility);visibility();
    root.innerHTML=`<div class="rankings-heading"><div><p class="eyebrow muted">TEAM TASK SELECTION · V7 → V8</p><h2>十一人制任务择优 · 更新前后对照</h2><p>十一人制30支实际球队使用同一口径：80任务全部真实人选，6共享链全部不同球员有序人对。综合权重沿用22／18／16／15／15／14%；共享链作为独立证据，不重复计入六维。</p></div></div><p>每个候选的两种重掷政策等权比较；事前选人，保留最佳包络上下界，缺项为未确定。结果限于冻结任务与行动策略，尚未实战校准；四组生存效用指数分别展示。七人制暂缓、沿用V7；本页不混入七人制的新结果。</p><div class="ranking-controls"><label>赛制<select data-team-format><option value="11s">十一人制30队</option></select></label><label>球队搜索<input data-team-search type="search" placeholder="输入球队名称"></label></div><p data-team-count aria-live="polite"></p><div data-team-list></div><div data-team-selected aria-live="polite"></div>${raw('发布来源与口径',{version:data.version,generatedAt:data.generatedAt,weights:data.weights,scope:data.scope})}`;
    const list=root.querySelector('[data-team-list]'),detail=root.querySelector('[data-team-selected]'),format=root.querySelector('[data-team-format]'),search=root.querySelector('[data-team-search]');
    const axes=values=>ids.map(id=>values?.find(a=>a.id===id)?.score);
    const ranking=t=>Number.isFinite(t?.rank)?`${t.tied>1?'并列':''}${t.rank} / ${t.poolSize??30}`:'未确定';
    const renderList=()=>{
      const shown=rows.filter(r=>(format.value==='all'||r.format===format.value)&&`${r.name} ${r.subjectId}`.toLowerCase().includes(search.value.toLowerCase()));
      root.querySelector('[data-team-count]').textContent=`显示${shown.length} / ${rows.length}队；名次保持各赛制完整30队池，不随筛选重排。六轴单元格为旧赋分 → 新赋分。`;
      list.innerHTML=table(['球队','赛制','旧综合','新综合','综合变化','旧名次','新名次','名次上升',...labels],shown.map(r=>`<tr${selected.subjectId===r.subjectId?' class="team-selection-active"':''}><td><button type="button" data-team-select="${esc(r.subjectId)}" aria-pressed="${selected.subjectId===r.subjectId}">${esc(r.name)}</button></td><td>${r.format==='sevens'?'七人制':'十一人制'}</td><td>${number(r.oldOverall?.score)}</td><td>${number(r.newOverall?.score)}</td><td>${delta(r.newOverall?.score,r.oldOverall?.score)}</td><td>${ranking(r.oldOverall)}</td><td>${ranking(r.newOverall)}</td><td>${Number.isFinite(r.oldOverall?.rank)&&Number.isFinite(r.newOverall?.rank)?delta(r.oldOverall.rank,r.newOverall.rank):'未确定'}</td>${axes(r.oldAxes).map((a,i)=>`<td>${number(a)} → ${number(axes(r.newAxes)[i])}</td>`).join('')}</tr>`));
    };
    const radar=values=>{
      const adapted=ids.map((id,i)=>{const a=values?.find(a=>a.id===id)||{id,label:labels[i]};return id==='adaptability'?{...a,completedTemplates:Number.isFinite(a.score)?1:0,totalTemplates:1}:a;});
      return window.BB_STANDARD_TASK_VIEW?.radar?.({axes:adapted})||'<p>雷达组件尚未加载，请参照六维表。</p>';
    };
    const renderSelected=()=>{
      const row=selected;
      detail.innerHTML=`<h3>${esc(row.name)} · ${row.format==='sevens'?'七人制':'十一人制'}</h3><p>综合 ${number(row.oldOverall?.score)} → ${number(row.newOverall?.score)}；名次 ${ranking(row.oldOverall)} → ${ranking(row.newOverall)}。共${esc(row.candidateCount)}个候选计算单位；${esc(row.improvedTasks)}项最佳下界高于基线上界；${row.baselineDifferences?.length??0}项重算基线与原记录不同。</p><div class="team-selection-radars"><div><h4>更新前 V7</h4>${radar(row.oldAxes)}</div><div><h4>更新后 V8</h4>${radar(row.newAxes)}</div></div><h4>六维底分与赋分</h4><p>底分表示任务绝对表现；赋分表示同赛制队列位置。全部球队同时改善后，某队底分上升而名次下降仍可能成立。</p>${table(['维度','旧整数底分','新整数底分','旧赋分','新赋分'],ids.map((id,i)=>{const before=row.oldAxes?.find(a=>a.id===id),after=row.newAxes?.find(a=>a.id===id);return `<tr><th>${labels[i]}</th><td>${baseText(before)}</td><td>${baseText(after)}</td><td>${number(before?.score)}</td><td>${number(after?.score)}</td></tr>`;}))}<h4>生存拆解 · 0—100组内任务效用指数</h4><p>组内包含不同条件，均值用于诊断；维持原模板权重。原记录→重算基线体现计算路径差异，基线→择优体现选人变化。</p>${table(['分组','原指数','重算基线','择优指数','定义／轴内占比'],(row.survival||[]).map(g=>`<tr><th scope="row">${esc(g.label)}</th><td>${interval(g.original)}</td><td>${interval(g.baseline)}</td><td>${interval(g.best)}</td><td>${esc(g.definition)}<br>${number(100*g.weight)}%</td></tr>`))}<details class="appearance-details" data-team-load><summary>展开80任务＋6共享链、全部候选及规则证明</summary><div data-team-task-content><button type="button" data-team-retry>加载任务详情</button></div></details>`;
      const disclosure=detail.querySelector('[data-team-load]'),content=detail.querySelector('[data-team-task-content]');let loading=false,done=false;
      const fill=async()=>{if(loading||done)return;loading=true;content.textContent='正在读取该队全部候选…';try{const full=await load(row);if(selected!==row)return;renderTasks(content,full);done=true;}catch(error){content.innerHTML=`<p>${esc(error.message)}</p><button type="button" data-team-retry>重试读取</button>`;}finally{loading=false;}};
      disclosure.addEventListener('toggle',()=>{if(disclosure.open)fill();});content.addEventListener('click',e=>{if(e.target.closest('[data-team-retry]'))fill();});
    };
    const renderTasks=(container,full)=>{
      const names=actorIds=>(actorIds||[]).map(id=>{const p=full.profile?.players?.find(p=>p.id===id);return p?`${p.name} #${p.number}`:id;}).join(' ＋ ')||'未提供';
      const originalActor=t=>t.original?.ruleProof&&!t.original?.teamContract&&!t.original?.conditions?.teamOverride?'原版仅有资格证明，无实际执行者；基线用固定人选':identity(t.baseline);
      const identity=c=>c?.actorIds?.length?names(c.actorIds):c?.actorName||c?.actorNames?.join(' ＋ ')||'未提供';
      const taskIdentity=t=>t.best?.maxEnvelope?.upperBound===0?'全候选规则结果为0，资格／终点见证明':identity(t.best)+(t.best?.maxEnvelope?.value==null?(t.best?.possiblyOptimal?.length>1?'（候选代表，最优未唯一确定）':'（结果保留范围）'):'');
      const tasks=[...(full.tasks||[]),...(full.sharedTasks||[]).map(t=>({...t,axisId:'shared'}))];
      container.innerHTML=`<p>以下均为0—100任务效用指数；差异为指数点，范围保留上下界，不取中点。两政策属于同一候选；受击任务的重掷可能属于来袭方，详见共同资源条件。</p><label>任务维度<select data-team-axis><option value="all">全部${tasks.length}项</option>${ids.slice(0,5).map((id,i)=>`<option value="${id}">${labels[i]}</option>`).join('')}<option value="shared">6共享链</option></select></label><div data-team-task-list></div>${raw('完整任务来源、引擎、资源与计算方法',{schema:full.schema,sources:full.sources,signature:full.signature,engineSha256:full.engineSha256,options:full.options,method:full.method})}`;
      const paint=()=>{container.querySelector('[data-team-task-list]').innerHTML=tasks.filter(t=>container.querySelector('[data-team-axis]').value==='all'||t.axisId===container.querySelector('[data-team-axis]').value).map((t)=>`<details class="appearance-details team-selection-task" data-task-id="${esc(t.templateId)}"><summary>${esc(t.templateId)} · ${esc(t.label)} · ${esc(taskIdentity(t))}</summary><p>最佳包络 ${interval(t.best?.maxEnvelope,100)}；最大下界同分${t.best?.ties?.length??0}组；可能最优${t.best?.possiblyOptimal?.length??0}组。</p>${table(['原人选','原记录','重算基线','最佳包络','重算差异','择优差异'],[`<tr><td>${esc(originalActor(t))}</td><td>${interval(t.original,100)}</td><td>${interval(t.baseline,100)}</td><td>${interval(t.best?.maxEnvelope,100)}</td><td>${gain(t.baseline,t.original)}</td><td>${gain(t.best?.maxEnvelope,t.baseline)}</td></tr>`])}${raw('最大下界同分与可能最优完整名单',{ties:(t.best?.ties||[]).map(names),possiblyOptimal:(t.best?.possiblyOptimal||[]).map(names),selection:t.best?.selection||t.best?.selectionNote})}<details data-all-candidates><summary>全部${t.candidates?.length??0}个人选／完整人对及两政策结果</summary><div data-candidate-body></div></details>${raw('任务合同、终点与共同资源',t.contract||t.best?.result?.conditions||t.original?.conditions)}</details>`).join('');};
      container.querySelector('[data-team-axis]').addEventListener('change',paint);
      container.addEventListener('toggle',e=>{const d=e.target;if(!d.matches('[data-all-candidates]')||!d.open||d.dataset.loaded)return;const t=tasks.find(t=>t.templateId===d.closest('[data-task-id]').dataset.taskId);d.dataset.loaded='true';d.querySelector('[data-candidate-body]').innerHTML=table(['人选／有序人对','两政策等权效用','无团队重掷','有团队重掷','状态与证据'],(t.candidates||[]).map(c=>`<tr><td>${esc(identity(c))}${t.best?.ties?.some(a=>a.join('|')===c.actorIds?.join('|'))?' · 最大下界同分':''}</td><td>${interval(c,100)}</td><td>${interval(result(c)?.policyResults?.withoutTeamRerolls,100)}</td><td>${interval(result(c)?.policyResults?.withTeamRerolls,100)}</td><td>${esc(result(c)?.status)}${raw('规则资格、资源条件及重放来源',{reason:result(c)?.reason,ruleProof:result(c)?.ruleProof,conditions:result(c)?.conditions,teamContract:result(c)?.teamContract,replaySha256:result(c)?.replaySha256,signature:c.signature,...repairSources(c)})}</td></tr>`));},true);paint();
    };
    window.addEventListener('bb-standard-task-ready',()=>{const charts=detail.querySelectorAll('.team-selection-radars > div');if(charts.length===2){charts[0].innerHTML='<h4>更新前 V7</h4>'+radar(selected.oldAxes);charts[1].innerHTML='<h4>更新后 V8</h4>'+radar(selected.newAxes);}});
    list.addEventListener('click',e=>{const button=e.target.closest('[data-team-select]');if(!button)return;selected=rows.find(r=>r.subjectId===button.dataset.teamSelect)||selected;renderList();renderSelected();});format.addEventListener('change',renderList);search.addEventListener('input',renderList);renderList();renderSelected();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
