/* Presentation integration: V5 assignments and frozen task evidence remain unchanged. */
(() => {
  'use strict';
  const esc = x => String(x ?? '—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const candidateActive=Boolean(window.BB_ROSTER_CANDIDATE_ACTIVE), boundedTeams=candidateActive||window.BB_SURVIVAL_V9_ACTIVE;
  const refreshedTeams=()=>rows().some(row=>row.rosterUpdateScope==='ballControl-survival-only');
  const dimensions = ['fastAttack','ballControl','lethality','survival','control','adaptability'];
  const weights = [22,18,16,15,15,14];
  const labels = ['快攻','控球','杀伤','生存','控场','适应力'];
  const bands = [['A+',95],['A',87.5],['A−',80],['B+',70],['B',60],['B−',50],['C',20],['D',10],['E',0]];
  const axes = row => [...(row?.axes || []),{...(window.BB_TEAM_IMPORTANCE?.axisFor(row)||row?.adaptability),id:'adaptability'}];
  const grade = value => Number.isFinite(value) ? bands.find(([,minimum])=>value>=minimum)?.[0] || 'E' : '—';
  const format = row => row.format==='sevens'?'七人制':'十一人制';
  const rows = () => [...(window.BB_STANDARD_TASK_EXPERIMENT_V1?.dossiers || []),...(window.BB_STANDARD_TASK_EXPERIMENT_V1?.teamDossiers || [])];
  const axis = (row,id) => axes(row).find(a=>a.id===id);
  const rank = a => a?.assignment?.rankRange ? (a.assignment.rankRange[0]===a.assignment.rankRange[1]?a.assignment.rankRange[0]:null) : a?.assignment && Number.isFinite(a.assignment.rank?.better) && Number.isFinite(a.assignment.rank?.tied) && !a.assignment.projected ? a.assignment.poolSize-a.assignment.rank.better-a.assignment.rank.tied+1 : null;
  const money = value => Number.isFinite(value)?value.toLocaleString('zh-CN')+' GP':'未提供';
  const imageUrl = path => path ? path + (path.includes('?') ? '&' : '?') + 'v=overall-v7-images-20261014' : '';
  const profileButton = row => `<button type="button" class="featured-action" data-integrated-profile="${esc(row.subjectId)}" data-format="${esc(row.format)}">${esc(row.name)}</button>`;
  const leagues = row => {
    if(row.subjectType==='team')return row.profile?.leagueNames || [];
    if(row.subjectType==='star')return Object.keys(row.profile?.eligibleByLeague || {});
    const ids = row.profile?.sourceRosters || [];
    return [...new Set((window.ATLAS_DATA?.teams || []).filter(t=>ids.includes(t.rosterId)).flatMap(t=>t.leagueNames || []))];
  };
  const keyOf = row => row.subjectId+'|'+row.format;
  const composite = row => {
    if(row.format==='11s'&&row.subjectType!=='team'&&axis(row,'adaptability')?.evidenceMode==='team-importance-context')return null;
    const values=dimensions.map(id=>axis(row,id)?.score);
    if(values.some(v=>!Number.isFinite(v)||v<0||v>100))return null;
    return values.reduce((sum,v,i)=>sum+weights[i]*v/100,0);
  };
  const totals = new Map();
  const canonical = row => row.subjectType==='team' || dimensions.every(id=>axis(row,id)?.assignment?.canonical===true && !axis(row,id).assignment.projected);
  const comparePool = row => row.format+'|'+(row.subjectType==='team'?'team':'personal');
  const reference=rows().filter(canonical);
  for(const row of rows()){
    const value=composite(row),members=reference.filter(r=>comparePool(r)===comparePool(row));
    const valid=members.map(composite).every(Number.isFinite);
    if(value===null||!valid){totals.set(keyOf(row),{score:null,rank:null,grade:'—',poolSize:members.length,reason:row.format==='11s'&&row.subjectType!=='team'?'球队重要性已接入；按具体球队与指标显示，不合成跨队综合总评':'六维或比较池缺项，待重算'});continue;}
    if(!canonical(row)){totals.set(keyOf(row),{score:value,rank:null,grade:'—',reason:'源变体不进入规范总榜'});continue;}
    const quantize=v=>Math.round(v*1e10)/1e10, input=quantize(value);
    const lower=members.filter(r=>quantize(composite(r))<input).length,tied=members.filter(r=>quantize(composite(r))===input).length;
    const points=members.length>1?100*(lower+(tied-1)/2)/(members.length-1):null;
    totals.set(keyOf(row),{score:value,rank:members.length-lower-tied+1,poolSize:members.length,tied,points,grade:grade(points)});
  }
  if(window.BB_SURVIVAL_V9_ACTIVE)for(const [key,total] of Object.entries(window.BB_TEAM_SURVIVAL_TOTALS_V9||{}))totals.set(key,total);
  if(candidateActive)for(const [key,total] of Object.entries(window.BB_ROSTER_CANDIDATE_V12?.totals||{}))totals.set(key,total);
  const bounded = (value,lo,hi,digits=1) => Number.isFinite(value)?value.toFixed(digits):Number.isFinite(lo)&&Number.isFinite(hi)?lo.toFixed(digits)+'—'+hi.toFixed(digits):'未确定';
  const rankText = total => total.rank??(total.rankRange?.join('—')||'未确定');
  const overall = row => row ? totals.get(keyOf(row)) || {score:null,rank:null,grade:'—'} : {score:null,rank:null,grade:'—'};
  const overallSummary = row => {
    const total=overall(row);if(!Number.isFinite(total.score)&&Number.isFinite(total.lowerBound))return `<div class="integrated-overall"><b>综合分 ${bounded(null,total.lowerBound,total.upperBound)} · ${esc(total.grade)}</b><span>第${rankText(total)} / ${total.poolSize}名 · 总榜赋分 ${bounded(total.points,...(total.pointsRange||[]))}</span><small>${row.rosterUpdateScope==='ballControl-survival-only'?'30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留':candidateActive?'当前军表：生存25/70/5加权几何平均':'V9生存25%抗击倒＋50%抗伤留场／再生保全＋25%后续可用'}；总评生存仍占15%。数值范围未取中点。</small></div>`;if(!Number.isFinite(total.score))return `<p class="st-caption">${esc(total.reason||'综合总评待重算；六维缺项不填零。')}</p>`;
    return `<div class="integrated-overall"><b>综合分 ${total.score.toFixed(1)} · ${esc(total.grade)}</b><span>${total.rank?`${total.tied>1?'并列':''}第${total.rank} / ${total.poolSize}名 · 总榜赋分 ${total.points.toFixed(1)}`:esc(total.reason)}</span><small>22%快攻＋18%控球＋16%杀伤＋15%生存＋15%控场＋14%第六维（个人价值／球队适应力）；等级按总榜赋分，六维雷达保持原赋分。</small></div>`;
  };
  const portrait = row => {
    if(row.importanceRecord&&row.subjectType==='player')return portrait({...row,importanceRecord:null,name:row.profile.name});
    const p=row.profile || {},atlas=window.ATLAS_DATA || {};
    if(p.portrait)return p.portrait;
    if(row.isStarPair)return row.members?.[0]?.portrait||'';
    if(row.subjectType==='team')return (atlas.teams || []).find(t=>t.id===row.subjectId)?.portrait || '';
    if(row.subjectType==='star')return (atlas.stars || []).find(t=>t.id===(p.id??row.subjectId))?.portrait || '';
    const aliases={'High Elf Thrower':'Phoenix Warrior','High Elf Catcher':'White Lion','High Elf Blitzer':'Dragon Prince'};
    for(const roster of atlas.rosters || []){if((p.sourceRosters || []).length&&!p.sourceRosters.includes(roster.id))continue;const position=(roster.positions || []).find(v=>[row.name,aliases[row.name]].includes(v.name));if(position)return (window.BB_BASE_PORTRAITS || {})[roster.id+':'+position.id] || position.portrait || '';}
    return '';
  };
  const rankingPortraits = row => (row.isStarPair?row.members:[{name:row.name,portrait:portrait(row)}]).map(member=>`<img class="integrated-ranking-portrait" src="${esc(imageUrl(member.portrait))}" alt="${esc(member.name)}" loading="lazy">`).join('');
  window.BB_STANDARD_TASK_INTEGRATION = {grade,axes,rank,weights,composite,overall,overallSummary,portrait,imageUrl};
  window.BB_STANDARD_TEAM_COMPARISON = (left,right) => {
    if(!left||!right||left.format!==right.format)return '<p>两队需有相同赛制的完整标准任务缓存，缺失项不赋零分。</p>';
    const body=dimensions.map((id,i)=>{
      const a=axis(left,id),b=axis(right,id),valid=Number.isFinite(a?.score)&&Number.isFinite(b?.score);
      const diff=valid?a.score-b.score:null;
      return `<tr><th>${labels[i]}</th><td>${bounded(a?.score,a?.lowerBound,a?.upperBound)} · ${grade(a?.score)}<small>底分 ${a?.absoluteDisplayScore ?? '—'}</small></td><td>${bounded(b?.score,b?.lowerBound,b?.upperBound)} · ${grade(b?.score)}<small>底分 ${b?.absoluteDisplayScore ?? '—'}</small></td><td>${valid?(diff>0?'+':'')+diff.toFixed(1):'无法比较'}</td></tr>`;
    }).join('');
    return `<h4>${esc(left.name)} ↔ ${esc(right.name)}</h4>${overallSummary(left)}${overallSummary(right)}<div class="integrated-compare-radars"><div>${window.BB_STANDARD_TASK_VIEW.radar(left)}</div><div>${window.BB_STANDARD_TASK_VIEW.radar(right)}</div></div><div class="team-impact-scroll"><table><thead><tr><th>维度</th><th>${esc(left.name)}</th><th>${esc(right.name)}</th><th>左队赋分差</th></tr></thead><tbody>${body}</tbody></table></div><p>使用同赛制30支球队比较池的当前赋分；并列同分，底分同时保留。预算分别为 ${money(left.profile?.budget)} / ${money(right.profile?.budget)}；统一任务资源不等于同预算构筑。六维差表示任务相对表现，不是对局胜率。综合分使用六维22/18/16/15/15/14权重；当前名单补强收益须另行重算。</p>`;
  };
  // One state/query path is shared by restored preferences and every ranking control.
  const rankingContextual = s => s.metric==='teamImportance'&&s.kind!=='team'&&s.format==='11s';
  const rankingLeagues = row => {
    if(row.importanceRecord){
      const team=rows().find(t=>t.subjectType==='team'&&t.format==='11s'&&t.subjectId===row.importanceRecord.teamId);
      if(team)return leagues(team);
    }
    return leagues(row);
  };
  const rankingScope = s => (rankingContextual(s)?window.BB_TEAM_IMPORTANCE.rankingRows(s.teamId,s.importanceMetric):rows())
    .filter(r=>r.format===s.format&&(s.kind==='team'?r.subjectType==='team':r.subjectType!=='team'&&
      (rankingContextual(s)||canonical(r))&&(s.kind==='all'||r.subjectType===s.kind)));
  const rankingSearchText = row => {
    const p=row.profile||{},rosters=new Set(p.sourceRosters||[p.rosterId].filter(Boolean));
    const teamNames=rows().filter(t=>t.subjectType==='team'&&rosters.has(t.profile?.rosterId)).map(t=>t.name);
    const skillNames=new Map((window.BB_SKILL_CATALOG||[]).map(s=>[s.id,s.name]));
    return [row.name,p.name,p.skillText,p.description,row.importanceRecord?.teamName,...teamNames,...rosters,
      ...rankingLeagues(row),...(p.keywords||[]),...(p.skills||[]).flatMap(s=>[typeof s==='string'?s:s.id,skillNames.get(typeof s==='string'?s:s.id)]),
      ...(row.members||[]).flatMap(m=>[m.name,m.skillText,m.specialRules,...(m.keywords||[])])]
      .filter(x=>x!=null).join(' ').normalize('NFKC').toLocaleLowerCase();
  };
  const rankingMatch = (r,s) => (!s.leagues.length||rankingLeagues(r).some(l=>s.leagues.includes(l)))&&
    (!s.search||rankingSearchText(r).includes(s.search.normalize('NFKC').toLocaleLowerCase()));
  const rankingNormalize = (s,changed) => {
    const notices=[],previous={...s};
    if(!['team','player','star','all'].includes(s.kind))s.kind='team';
    if(!['11s','sevens'].includes(s.format))s.format='11s';
    if(s.metric==='teamImpact'){s.metric='teamImportance';s.kind='star';s.importanceMetric='recruitmentGain';}
    if(!['overall','teamImportance',...dimensions].includes(s.metric))s.metric=s.kind==='team'?'overall':'fastAttack';
    if(!['absenceLoss','recruitmentGain','reserveEntryGain'].includes(s.importanceMetric))s.importanceMetric=s.kind==='star'?'recruitmentGain':'absenceLoss';
    const contexts=window.BB_TEAM_IMPORTANCE.data.rows;
    if(!contexts.some(r=>r.teamId===s.teamId))s.teamId=contexts[0]?.teamId||'';
    s.search=typeof s.search==='string'?s.search.trimStart():'';
    s.leagues=Array.isArray(s.leagues)?[...new Set(s.leagues.filter(l=>typeof l==='string'))]:typeof s.league==='string'?[s.league]:[];
    s.reverse=s.reverse===true||s.reverse==='true';
    if(!['10','25','50','all'].includes(s.limit))s.limit='25';
    if(changed==='kind')s.importanceMetric=s.kind==='star'?'recruitmentGain':'absenceLoss';
    window.BB_TEAM_IMPORTANCE.normalizeFilters(s,changed);
    // This also applies after a format change or restoring obsolete preferences.
    if(s.metric==='teamImportance'&&(s.kind==='team'||s.format!=='11s'))s.metric='adaptability';
    const pool=rankingScope(s),available=[...new Set(pool.flatMap(rankingLeagues))];
    const oldLeagues=s.leagues;s.leagues=s.leagues.filter(l=>available.includes(l));
    if(oldLeagues.length!==s.leagues.length)notices.push('已移除当前对象或球队不适用的赛区筛选。');
    const structural=['restore','kind','format','metric','teamId','importanceMetric','reset'].includes(changed);
    if(structural&&pool.length&&s.search&&!pool.some(r=>rankingMatch(r,s))){
      s.search='';notices.push('切换后旧搜索没有匹配对象，已清除旧搜索。');
    }
    if(previous.kind==='star'&&previous.format==='sevens')notices.push('七人制没有明星，已切换为可用的对象或赛制。');
    if(previous.importanceMetric!==s.importanceMetric&&rankingContextual(s))notices.push('已切换为该球队有记录的重要性口径。');
    return {pool,availableLeagues:available,notice:notices.join(' ')};
  };
  const rankingCompare = (a,b,s) => {
    if(rankingContextual(s))return (s.reverse?1:-1)*(a.importanceRecord.rawScore-b.importanceRecord.rawScore)||a.name.localeCompare(b.name);
    if(boundedTeams&&a.subjectType==='team'&&b.subjectType==='team'&&a.format==='11s'&&(candidateActive||['overall','survival'].includes(s.metric))){
      const order=r=>s.metric==='overall'?overall(r).rankRange?.[0]??overall(r).rank:axis(r,s.metric)?.assignment?.rankRange?.[0]??rank(axis(r,s.metric));
      return (s.reverse?-1:1)*((order(a)??Infinity)-(order(b)??Infinity))||a.name.localeCompare(b.name);
    }
    const av=s.metric==='overall'?overall(a).score:axis(a,s.metric)?.score,bv=s.metric==='overall'?overall(b).score:axis(b,s.metric)?.score;
    if(!Number.isFinite(av)||!Number.isFinite(bv))return Number.isFinite(av)?-1:Number.isFinite(bv)?1:a.name.localeCompare(b.name);
    const diff=s.metric==='overall'?Math.round(av*1e10)-Math.round(bv*1e10):av-bv;
    return (s.reverse?1:-1)*diff||a.name.localeCompare(b.name);
  };
  const rankingQuery = (s,changed='') => {
    const normalized=rankingNormalize(s,changed);
    const selected=normalized.pool.filter(r=>rankingMatch(r,s)).sort((a,b)=>rankingCompare(a,b,s));
    return {...normalized,settings:s,contextual:rankingContextual(s),rows:selected,
      visible:s.limit==='all'?selected:selected.slice(0,Number(s.limit))};
  };
  window.BB_STANDARD_RANKING_MODEL={query:rankingQuery,scope:rankingScope,searchText:rankingSearchText,leagues:rankingLeagues};

  const mount = () => {
    const root=document.getElementById('standard-task-rankings');
    if(!root||!rows().length)return;
    const key=window.BB_SURVIVAL_V9_ACTIVE?'bb-standard-ranking-preferences-v9':window.BB_STANDARD_VERSION_MODE==='previous'?'bb-standard-ranking-preferences-v7':'bb-standard-ranking-preferences-v8';
    const contextRows=window.BB_CURRENT_FIVE_AXES?.contextValues?.rows||[];
    const contextTeams=[...new Map(contextRows.map(r=>[r.teamId,r.teamName])).entries()];
    const contextFor=row=>row.importanceRecord||contextRows.find(c=>c.subjectId===(row.isStarPair?row.subjectId.replace(/^star-/, ''):row.subjectId)&&c.teamId===settings.teamId&&c.metricKind==='recruitmentGain');
    const defaults={importanceMetric:'absenceLoss',teamId:contextTeams[0]?.[0]||'',kind:window.BB_STANDARD_VERSION_MODE==='previous'?'all':'team',format:'11s',metric:'overall',leagues:[],search:'',limit:'25',reverse:false};
    let settings={...defaults};try{settings={...defaults,...JSON.parse(localStorage.getItem(key)||'{}')};}catch(_){}
    if(!['all','team','player','star'].includes(settings.kind))settings.kind=defaults.kind;
    if(!['11s','sevens'].includes(settings.format))settings.format=defaults.format;
    if(!contextTeams.some(([id])=>id===settings.teamId))settings.teamId=defaults.teamId;
    if(!['overall','teamImportance','teamImpact',...dimensions].includes(settings.metric))settings.metric=defaults.metric;
    if(!['absenceLoss','recruitmentGain','reserveEntryGain'].includes(settings.importanceMetric))settings.importanceMetric='absenceLoss';
    if(!['10','25','50','all'].includes(settings.limit))settings.limit=defaults.limit;
    const leagueNames=[...new Set(rows().flatMap(leagues))].sort();
    settings.leagues=(Array.isArray(settings.leagues)?settings.leagues:settings.league?[settings.league]:[]).filter(l=>leagueNames.includes(l));
    root.innerHTML=`<div class="rankings-heading"><div><p class="eyebrow muted">THE LEADERBOARD</p><h2>综合总榜与六维单项榜</h2>${refreshedTeams()?'<p>当前30队高手军表：30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留。</p>':candidateActive?'<p><strong>候选版：30支新十一人制1150K军表，生存使用V11风险抗伤与嗜血内耗。新旧军表收益以同口径V11比较；历史页面V9另列。</strong></p>':window.BB_SURVIVAL_V9_ACTIVE?'<p><strong>V9：仅十一人制生存改为全队25/50/25；其他五维、个人和七人制冻结。15队赋分保留范围，5队总榜名次保留范围；结果来自64种整数配置，未取中点。</strong></p>':''}<p>总评使用所选版本六维赋分加权，个人与球队、不同赛制分别排名；单项分数和历史评分保留。球队为当前十一人制30队六维；个人第六维为最佳球队贡献；球队内明细另区分净补强、缺阵损失和替补入场，个人价值按最佳合法球队出场贡献跨队比较，并按14%计入综合总评；其他五项及搭档保留，七人制保留原分。</p></div></div><div class="ranking-controls"><label>对象<select data-integrated-filter="kind"><option value="all">基础球员＋明星</option><option value="player">基础球员</option><option value="star">明星</option><option value="team">球队</option></select></label><label>赛制<select data-integrated-filter="format"><option value="11s">十一人制</option><option value="sevens">七人制</option></select></label><label>排名项目<select data-integrated-filter="metric"><option value="overall">综合总评</option>${dimensions.map((id,i)=>`<option value="${id}">${labels[i]}</option>`).join('')}<option value="teamImportance">球队内重要性明细</option></select></label><label data-impact-team-label hidden>参考球队<select data-integrated-filter="teamId">${contextTeams.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label><label data-importance-metric-label hidden>重要性口径<select data-integrated-filter="importanceMetric"><option value="absenceLoss">现役球员缺阵损失</option><option value="recruitmentGain">明星新增净补强</option><option value="reserveEntryGain">替补入场净增益</option></select></label><details class="integrated-leagues"><summary>赛区 <span data-integrated-league-count></span></summary><div class="integrated-league-tools"><input type="search" data-integrated-league-search placeholder="搜索赛区…" aria-label="搜索榜单赛区"><button type="button" data-integrated-league-clear>清除</button><button type="button" data-integrated-league-close>关闭</button></div><div class="integrated-league-options">${leagueNames.map(l=>`<label><input type="checkbox" data-integrated-league="${esc(l)}" ${settings.leagues.includes(l)?'checked':''}>${esc(l)}</label>`).join('')}</div></details><label>显示<select data-integrated-filter="limit"><option value="10">前10条</option><option value="25">前25条</option><option value="50">前50条</option><option value="all">全部</option></select></label><label>搜索<input type="search" data-integrated-filter="search" placeholder="名字、球队、技能"></label><button type="button" class="ranking-cost-toggle" data-integrated-reverse>反向排序</button></div><p data-integrated-summary aria-live="polite"></p><div class="team-impact-scroll" tabindex="0" aria-label="标准任务排名表，可横向滚动"><table><thead><tr><th>赛制池名次</th><th>档案 · 点击打开图鉴</th><th data-integrated-value-heading>综合分 · 等级</th><th data-integrated-basis-heading>总榜赋分</th><th>费用 / 预算</th></tr></thead><tbody data-integrated-list></tbody></table></div><details class="appearance-details"><summary>等级、并列和比较范围</summary><p>等级仅为当前单项赋分的区间标签：A+ ≥95，A ≥87.5，A− ≥80，B+ ≥70，B ≥60，B− ≥50，C ≥20，D ≥10，其余E。总评等级使用加权综合分在规范总榜内的midrank赋分套用相同等级区间；它不是胜率或官方Tier。</p><p>个人规范池311份：十一人制187份（基础球员124＋单体明星60＋搭档组合3），七人制124份；球队各赛制30支。过滤只缩小显示范围，保留完整比较池赋分和名次；同底分并列同分，不按名字打破能力并列。12份源变体仍可在图鉴查看，不加入规范榜。球队重要性使用所选球队、所选指标的实际军表／招募对象单独成池，保留逐人购入技能；不会混入187对象的其他五项比较池。</p></details><details class="appearance-details"><summary>综合权重与计算依据 · 点击查看</summary><p>快攻22%、控球18%、杀伤16%、生存15%、控场15%、适应力14%，合计100%。沿用项目已有权重作为初始方案：优先推进与球权，保留攻击、留场、空间控制与职责覆盖。这是设计取舍，不是实际比赛拟合结论。球员、明星与球队采用同一组权重，以便解释一致；分别使用各自的同赛制赋分池。</p><p>底分未唯一确定时，仅在所有可行结果都导出相同名次与赋分的证据下给出相对分，底分仍显示范围；否则待复算。第一步：综合分S＝Σ（当前六维未舍入赋分×对应权重），不使用雷达整数、面积或个人分数平均来算球队。${refreshedTeams()?'当前30队高手军表：控球＝主力处理球、前8人接应各50%的几何平均；生存ABC＝25%／70%／5%的几何平均。六维已接入；球队杀伤采用已确认联合优化版；个人采用统一动作净收益版。':candidateActive?'当前30支十一人制1150K军表：控球＝50%主力处理球＋50%全队接应。主力取各控球任务首发前三人平均，再对16任务等权；接应取首发11人接准确快传、接交接球、散球回收三项平均。传接球使用不同真实队友及共享重掷，不单列多人配合加分；底分不先取整再赋分。生存ABC为45%／45%／10%，其他四维不变。':window.BB_SURVIVAL_V9_ACTIVE?'V9仅生存改为固定首发11人聚合，25%抗击倒＋50%留场／再生保全＋25%后续可用；其他五维保持V8，适应力不重算。生存整数范围枚举全部组合后计算赋分与总榜，不能取中点。':'V8仅更新十一人制30队，输入来自逐任务择优后的实际名单规则任务赋分；'}七人制保持V7；个人五项已接入；搭档是一个评价对象，保留两个身体和一次合约费用。各维按其最新交付的资源口径计算；杀伤使用全队共享资源的正常模式样本均值，抽样参考范围不作为严格概率界；${refreshedTeams()?'当前名单可展开六维最新交付证据；杀伤含抽样误差与模型边界。':'共享6任务独立列证据，不重复加进80模板。V7使用原固定分工，切换后显示原结果。'}第二步：按S在规范池排序；总榜赋分P＝100×（较低S人数＋（同S人数−1）/2）÷（N−1），等级按P分区。S、P和名次分别展示；P不回写六维，权重不重复作用。</p><p>浮点比较精度为1e-10综合分，避免算术舍入制造假并列差异；排序计算使用未显示舍入的值。任何一维或规范比较池缺项时，综合总评待复算，不补零、不重新分配权重。球队适应力为七职责替代深度；个人第六维使用已交付的球队重要性，旧职责份额已归档。逐队净补强、缺阵损失、替补入场增益分别列为候选试算，只有相同球队、相同指标可比较；不跨队取最大值或均值，不跨队合成综合总评。教练水平、价格、采购预算与培养价值不作为未验证乘数。</p></details>`;
    root.querySelectorAll('[data-integrated-filter]').forEach(control=>{control.value=settings[control.dataset.integratedFilter]??'';});
    const render=(changed='')=>{
      const result=window.BB_STANDARD_RANKING_MODEL.query(settings,changed);
      const contextual=result.contextual;
      root.querySelector('[data-impact-team-label]').hidden=!contextual;
      root.querySelector('[data-importance-metric-label]').hidden=!contextual;
      root.querySelector('[data-integrated-filter="kind"] option[value="player"]').textContent=contextual?'当前军表球员':'基础球员';
      const overallOption=root.querySelector('[data-integrated-filter="metric"] option[value="overall"]');overallOption.disabled=false;overallOption.textContent='综合总评';
      root.querySelector('[data-integrated-filter="metric"] option[value="teamImportance"]').disabled=settings.kind==='team'||settings.format!=='11s';
      for(const option of root.querySelector('[data-integrated-filter="importanceMetric"]').options){
        const count=contextual?window.BB_TEAM_IMPORTANCE.metricCount(settings,option.value):null;
        const label=option.value==='absenceLoss'?(settings.kind==='star'?'现役明星缺阵损失':'现役球员缺阵损失'):option.value==='recruitmentGain'?'明星新增净补强':'替补入场净增益';
        option.disabled=contextual&&count===0;
        option.textContent=label+(contextual?(count?'（'+count+'条）':'（此队无对应对象）'):'');
      }
      root.querySelectorAll('[data-integrated-filter]').forEach(control=>{const value=String(settings[control.dataset.integratedFilter]??'');if(control.value!==value)control.value=value;});
      root.querySelectorAll('[data-integrated-league]').forEach(control=>{control.disabled=!result.availableLeagues.includes(control.dataset.integratedLeague);control.checked=settings.leagues.includes(control.dataset.integratedLeague);});
      root.querySelector('[data-integrated-league-count]').textContent=settings.leagues.length?'（已选'+settings.leagues.length+'）':'（全部）';
      root.querySelector('[data-integrated-filter="metric"] option[value="adaptability"]').textContent=settings.kind!=='team'&&settings.format==='11s'?'个人价值（最佳球队贡献）':'适应力';
      const chosen=result.rows,visible=result.visible;
      root.querySelector('[data-integrated-summary]').textContent=`${format({format:settings.format})} · ${contextual?'球队重要性 · '+window.BB_IMPORTANCE_AXIS_DATA.metricLabels[settings.importanceMetric]:settings.metric==='overall'?'综合总评':(settings.metric==='adaptability'&&settings.kind!=='team'&&settings.format==='11s'?'个人价值':labels[dimensions.indexOf(settings.metric)])} · 匹配${chosen.length}条，显示${visible.length}条；筛选不重新赋分。${boundedTeams&&settings.kind==='team'&&settings.format==='11s'&&(candidateActive||['overall','survival'].includes(settings.metric))?' 有范围时按最好可能名次排列，行序不代表确定强弱。':''}`;
      if(refreshedTeams()&&settings.kind==='team'&&settings.format==='11s')root.querySelector('[data-integrated-summary]').textContent+=' 六维已接入；杀伤为已确认的联合优化版，总评为样本均值参考。';
      if(settings.kind!=='team'&&settings.format==='11s'&&['lethality','overall'].includes(settings.metric))root.querySelector('[data-integrated-summary]').textContent+=' 单人杀伤：合法普通/犯规/专项择优，免费RR为0、资源持续；杀伤为样本均值参考；搭档按32身体机会归一。';
      if(contextual)root.querySelector('[data-integrated-summary]').textContent+=' 只比较所选球队、所选指标；有符号能力点保留，已在队明星使用缺阵口径，不重复招募。雷达赋分为同队同指标midrank，非实战胜率。';
      if(settings.kind!=='team'&&settings.format==='11s'&&['overall'].includes(settings.metric))root.querySelector('[data-integrated-summary]').textContent+=' 第六维采用最佳合法球队出场贡献，按14%权重计入综合分；这是适配上限，非实战胜率。';
      if(result.notice)root.querySelector('[data-integrated-summary]').textContent+=' '+result.notice;
      const totalMode=settings.metric==='overall';
      root.querySelector('thead th').textContent=contextual?'同队同指标名次':'赛制池名次';
      root.querySelector('[data-integrated-filter="metric"]').value=settings.metric;
      root.querySelector('[data-integrated-value-heading]').textContent=contextual?'重要性赋分 · 等级':totalMode?'综合分 · 总榜等级':'单项赋分 · 等级';
      root.querySelector('[data-integrated-basis-heading]').textContent=contextual?'原始能力点 · '+window.BB_IMPORTANCE_AXIS_DATA.metricLabels[settings.importanceMetric]:totalMode?'总榜赋分':settings.metric==='adaptability'&&settings.kind!=='team'&&settings.format==='11s'?'原始能力点':settings.format==='11s'&&settings.metric==='lethality'?(settings.kind==='team'?'净损失 K · 样本均值':'净损失 K／机会 · 样本均值'):'绝对底分';
      root.querySelector('[data-integrated-list]').innerHTML=visible.map(r=>{
        const a=axis(r,settings.metric),total=overall(r),value=totalMode?total.score:a?.score,poolRank=totalMode?total.rank:rank(a),poolSize=totalMode?total.poolSize:a?.assignment?.poolSize,tied=totalMode?total.tied:a?.assignment?.rank?.tied,image=portrait(r);
        if(contextual){const c=contextFor(r),n=c.comparison;return `<tr><td>${n.rank} / ${n.poolSize}</td><td><div class="integrated-ranking-person">${image?rankingPortraits(r):''}<button type="button" class="featured-action" data-importance-record="${esc(c.recordId)}">${esc(r.name)}</button></div><small>${esc(c.teamName)} · ${esc(window.BB_IMPORTANCE_AXIS_DATA.metricLabels[c.metricKind])}</small></td><td><b>${Number.isFinite(n.score)?n.score.toFixed(1):'单对象不赋相对分'}</b> · ${grade(n.score)}</td><td>${c.rawScore.toFixed(4)}</td><td>${money(r.profile?.cost)}</td></tr>`;}
        return `<tr><td>${poolRank??(totalMode?total.rankRange?.join('—'):a?.assignment?.rankRange?.join('—'))??'待重算'} / ${poolSize??'—'}${tied>1?' · 并列':''}</td><td><div class="integrated-ranking-person">${image?`<button type="button" data-integrated-profile="${esc(r.subjectId)}" data-format="${esc(r.format)}" aria-label="打开${esc(r.name)}图鉴">${rankingPortraits(r)}</button>`:'<span class="integrated-image-missing">暂无图片</span>'}<div>${profileButton(r)}<small>${r.subjectType==='team'?'实际球队':r.subjectType==='star'?'明星':'基础球员'} · ${esc(leagues(r).join('、'))}</small></div></div></td><td><b>${bounded(value,totalMode?total.lowerBound:a?.lowerBound,totalMode?total.upperBound:a?.upperBound)}</b> · ${totalMode?total.grade:Number.isFinite(value)?grade(value):grade(a?.lowerBound)+'—'+grade(a?.upperBound)}</td><td>${totalMode?bounded(total.points,...(total.pointsRange||[])):(Number.isFinite(a?.absoluteDisplayScore)?Number.isInteger(a.absoluteDisplayScore)?a.absoluteDisplayScore:a.absoluteDisplayScore.toFixed(4):null)??a?.absoluteIntegerRange?.join('—')??(Number.isFinite(a?.absoluteLowerBound)&&Number.isFinite(a?.absoluteUpperBound)?bounded(null,a.absoluteLowerBound,a.absoluteUpperBound):'未提供')}</td><td>${money(r.subjectType==='team'?r.profile?.budget:r.profile?.cost)}</td></tr>`;
      }).join('') || `<tr><td colspan="5">${overallOption.disabled&&settings.metric==='overall'?'球队重要性以具体球队为前提，暂没有跨队个人综合榜；请选快攻等单项或球队重要性。':settings.format==='sevens'&&settings.kind==='star'?'七人制不包含明星。':'当前搜索没有匹配对象；本范围有 '+result.pool.length+' 条可用档案，可清除搜索重新查看。'} <button type="button" class="featured-action" data-integrated-clear-filters>清除搜索与赛区筛选</button></td></tr>`;
      root.querySelector('[data-integrated-reverse]').setAttribute('aria-pressed',String(Boolean(settings.reverse)));
      try{localStorage.setItem(key,JSON.stringify(settings));}catch(_){}
    };
    const changeFilter=event=>{
      if(event.target.matches('[data-integrated-league-search]')){const q=event.target.value.toLocaleLowerCase();root.querySelectorAll('[data-integrated-league]').forEach(c=>{c.parentElement.hidden=!c.dataset.integratedLeague.toLocaleLowerCase().includes(q);});return;}
      if(event.target.matches('[data-integrated-league]')){settings.leagues=Array.from(root.querySelectorAll('[data-integrated-league]:checked')).map(c=>c.dataset.integratedLeague);render('leagues');return;}
      const name=event.target.dataset.integratedFilter;if(!name)return;
      settings[name]=event.target.value;render(name);
    };
    root.addEventListener('input',changeFilter);root.addEventListener('change',changeFilter);
    root.addEventListener('click',event=>{if(event.target.closest('[data-integrated-clear-filters]')){settings.search='';settings.leagues=[];root.querySelector('[data-integrated-filter="search"]').value='';root.querySelectorAll('[data-integrated-league]').forEach(c=>c.checked=false);render('reset');return;}if(event.target.closest('[data-integrated-league-clear]')){settings.leagues=[];root.querySelectorAll('[data-integrated-league]').forEach(c=>{c.checked=false;});render();return;}if(event.target.closest('[data-integrated-league-close]')){root.querySelector('.integrated-leagues').open=false;return;}if(event.target.closest('[data-integrated-reverse]')){settings.reverse=!settings.reverse;render();}});
    root.querySelector('.integrated-leagues').addEventListener('keydown',event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary').focus();}});
    render('restore');
  };
  document.addEventListener('error',event=>{const img=event.target;if(img?.tagName!=='IMG')return;img.hidden=true;const parent=img.parentElement;if(parent&&!parent.querySelector('.image-unavailable')){const note=document.createElement('span');note.className='image-unavailable';note.textContent='图片未加载';parent.appendChild(note);}},true);
  document.addEventListener('click',event=>{
    const contextButton=event.target.closest('[data-importance-record]');if(contextButton){if(!window.BB_OPEN_IMPORTANCE_PROFILE?.(contextButton.dataset.importanceRecord)){const note=document.querySelector('[data-integrated-summary]');if(note)note.textContent='该详情未能加载，请刷新页面后重试。';}return;}
    const button=event.target.closest('[data-integrated-profile]');if(!button)return;
    const row=rows().find(r=>r.subjectId===button.dataset.integratedProfile&&r.format===button.dataset.format);if(!row)return;
    const atlasId=candidateActive&&row.subjectType==='team'&&row.format==='11s'
      ?window.ATLAS_DATA?.teams?.find(t=>t.rosterId===row.profile?.rosterId&&t.format==='standard')?.id
      :row.subjectId;
    if(window.BB_OPEN_ATLAS_PROFILE?.({id:atlasId,name:row.name,kind:row.subjectType,format:row.format,profile:row.profile}))return;
    if(!window.BB_OPEN_STANDARD_TASK_PROFILE?.({name:row.name,kind:row.subjectType,format:row.format,profile:row.profile})){
      const note=document.querySelector('[data-integrated-summary]');
      if(note)note.textContent='该档案暂未找到对应图鉴，请尝试更换赛制或刷新页面。';
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
