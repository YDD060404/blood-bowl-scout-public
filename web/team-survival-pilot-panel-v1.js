/* Three-team diagnostic; no writes to scoring or ranking stores. */
(() => {
  'use strict';
  const esc = value => String(value ?? '未提供').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fixed = value => Number.isFinite(value) ? value.toFixed(2) : '未确定';
  const interval = value => !value ? '未确定' : Math.abs(value.upperBound-value.lowerBound)<1e-9 ? fixed(100*value.lowerBound) : `${fixed(100*value.lowerBound)}—${fixed(100*value.upperBound)}`;
  const table = (heads, rows) => `<div class="survival-pilot-scroll" tabindex="0"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const composition = value => Object.entries(value).map(([name,count])=>`${name} × ${count}`).join('；') || '无';
  const task = (row,id) => row.tasks.find(t=>t.templateId===id);
  const chart = value => value ? `<div class="survival-pilot-bar" role="img" aria-label="${esc(interval(value))}"><span style="width:${100*value.lowerBound}%"></span>${value.upperBound-value.lowerBound>1e-9?`<i style="left:${100*value.lowerBound}%;width:${100*(value.upperBound-value.lowerBound)}%"></i>`:''}</div>` : '';
  const start = () => {
    const root=document.getElementById('team-survival-pilot');
    if(!root)return;
    const data=window.BB_TEAM_SURVIVAL_PILOT_V1;
    if(!data?.rows?.length){root.textContent='三队生存试验数据尚未加载。';return;}
    const metrics=[['survival-01','ST3受击后仍站立'],['survival-04','ST3受击后未离场'],['survival-16','后续两次激活机会比例']];
    root.innerHTML=`<p class="eyebrow muted">TEAM SURVIVAL · THREE-TEAM PILOT</p><h2>历史三队试验 · 矮人／诺斯／侏儒</h2><p>本面板保留推广前的V8三队试验；当前30队V9生存与总榜变化见上方“全队生存新旧对照”。</p><div class="survival-pilot-note"><strong>如何读：</strong>固定球衣号1—11作为试验首发。每个任务从11人中等概率选一人受威胁，分别计算后取均值；不是11人同时留场概率，也不是实战受击频率。每次任务独立重置，未模拟整场伤者递减和替补上场。</div><h3>同一条件，先比较三项结果</h3><div class="survival-pilot-cards">${data.rows.map(row=>`<article><h4>${esc(row.name)} · 首发11人</h4>${metrics.map(([id,label])=>`<p>${esc(label)}<strong>${interval(task(row,id).lineupMean)}${id==='survival-16'?' / 100':'%'}</strong></p>${chart(task(row,id).lineupMean)}`).join('')}</article>`).join('')}</div><p class="muted">第三项是两次行动机会完成比例的期望，100表示两次都可完成；不是“两回合均成功”的概率。实色为下界，斜线为未确定范围，不取中点。受击任务的重掷属于来袭方；继承无／有团队重掷各50%的原任务政策。</p><p><strong>目前说明了什么：</strong>矮人的全队普通受击留场与后续行动结果优于这两队；诺斯的受击后站立更好。侏儒树人的耐受优势不再代替其余9名首发。这里只比较三支参考名单，不据此授予30队第一或“超强”等级。</p><label>查看球队 <select data-survival-team>${data.rows.map(row=>`<option value="${esc(row.teamId)}">${esc(row.name)}</option>`).join('')}</select></label><div data-survival-detail aria-live="polite"></div><details><summary>计算依据、适用范围与来源</summary><p>首发选定不读取任务结果；购入技能沿用名单。每名首发权重1/11，任一缺失则全队均值显示未确定，不填零、不改分母。任务之间不合成新权重，特殊威胁不与普通受击等权相加，条件恢复不与完整攻击概率混加。各球员多回合任务也分别重置资源，不代表全队联合行动。</p><p>医师、诱导、替补与真实阵型未进入本试验；冻结策略不是全局最优，最新版FAQ等效性尚未全部核实，未实战校准。</p><p>生成时间 ${esc(data.generatedAt)}；<span>完整计算与来源JSON（后台资料）</span> · <span>结果报告（后台资料）</span></p><p>固定来自V8；切换历史评分不会改写本研究结果。</p></details>`;
    const detail=root.querySelector('[data-survival-detail]');
    const render=()=>{
      const row=data.rows.find(r=>r.teamId===root.querySelector('[data-survival-team]').value);
      detail.innerHTML=`<h3>${esc(row.name)} · 阵容与任务对照</h3><p><strong>首发：</strong>${esc(composition(row.lineupComposition))}</p><p><strong>替补：</strong>${esc(composition(row.benchComposition))}。替补不计首发均值，未测算整场补位收益。预算 ${(row.budget/1000).toFixed(0)}K。</p><p>当前V8生存底分 <strong>${fixed(row.historicalV8.survivalBase)}</strong>，相对赋分 <strong>${fixed(row.historicalV8.survivalAssigned)}</strong>；保持原值。下面没有新生存分。</p>${data.sections.map(section=>`<h4>${esc(section.label)}</h4>${section.id==='armour'?'<p>survival-07沿用V8完整攻击口径，未发生护甲检定也算未破甲；不是“已经倒地之后的护甲耐受率”。</p>':''}${section.id==='recovery'?'<p>起点分别是已经KO或指定伤退节点，未纳入医师；不是普通受击后回场率。</p>':''}${table(['任务','V8长板包络','固定11人均值','原无重掷政策','原有重掷政策','已知／分母'],row.tasks.filter(t=>t.section===section.id).map(t=>`<tr><th scope="row">${esc(t.label)}<small>${esc(t.templateId)}${t.kind==='expected-opportunity-fraction'?' · 机会比例':t.kind==='conditional-probability'?' · 条件概率':' · 事件概率'}</small></th><td>${interval(t.v8Best)}</td><td><strong>${interval(t.lineupMean)}</strong></td><td>${interval(t.policyMeans.withoutTeamRerolls)}</td><td>${interval(t.policyMeans.withTeamRerolls)}</td><td>${t.available} / ${t.denominator}</td></tr>`))}`).join('')}<p>上表均为0—100：概率行以百分比理解，机会行以期望比例理解；各行条件不同，不能相加。V8长板可取全名单人选，均值仅取固定11名首发。</p><details><summary>逐人查看：属性与16项生存结果</summary><label>选择任务 <select data-survival-task>${row.tasks.map(t=>`<option value="${esc(t.templateId)}"${t.templateId==='survival-04'?' selected':''}>${esc(t.label)}</option>`).join('')}</select></label><div data-survival-players></div></details><details><summary>冻结来源与校验指纹</summary><p>${esc(row.source)}</p><code>${esc(row.sourceSha256)}</code></details>`;
      const renderPlayers=()=>{
        const selected=task(row,detail.querySelector('[data-survival-task]').value);
        detail.querySelector('[data-survival-players]').innerHTML=table(['球员','名单','ST／AV','技能（含购入）','任务结果','无重掷','有重掷'],selected.individuals.map(person=>{
          const p=row.players.find(p=>p.id===person.playerId);
          return `<tr><th scope="row">${esc(p.name)} #${p.number}</th><td>${person.starter?'首发 · 权重1/11':'替补 · 不计均值'}</td><td>${p.st} / ${p.av}+</td><td class="survival-pilot-skills">${esc(p.skillText)}</td><td>${interval(person.result)}</td><td>${interval(person.policies.withoutTeamRerolls)}</td><td>${interval(person.policies.withTeamRerolls)}</td></tr>`;
        }));
      };
      detail.querySelector('[data-survival-task]').addEventListener('change',renderPlayers);renderPlayers();
    };
    root.querySelector('[data-survival-team]').addEventListener('change',render);render();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
