(() => {
  const DATA = window.ATLAS_DATA;
  window.BB_TEAM_ROSTER_ADJUSTMENTS_V701?.apply(DATA);
  const DIMS = DATA.dimensions;
  const ROLE_LABELS = ["持球推进", "得分接应", "稳定突袭", "封路保护", "开路支援"];
  const SCORING = window.BB_SCORING;
  const COACH_MODEL = window.BB_EVALUATION_V3;
  const COACH_PRESETS = COACH_MODEL.COACH_LEVELS;
  const SKILL_CATALOG = window.BB_SKILL_CATALOG || [];
  const SKILL_EFFECTS = window.BB_SKILL_EFFECTS || {};
  const STAR_RULE_EVIDENCE = window.BB_STAR_RULE_EVIDENCE_V392 || { rules: [] };
  const SKILL_ELIGIBILITY = window.BB_SKILL_ELIGIBILITY || { rosters: {}, skillCategories: {} };
  const BASE_PORTRAITS = window.BB_BASE_PORTRAITS || {};
  const BASE_PORTRAIT_ASSET_VERSION = "base-portraits-official-refresh-20260930";
  const TEAM_ART_ASSET_VERSION = "team-art-high-elf-20260930";
  const LEAGUE_ART = {
    "Old World Classic": "assets/leagues/old-world-classic-pixel.webp",
    "Sylvanian Spotlight": "assets/leagues/sylvanian-spotlight-pixel.webp",
    "Badlands Brawl": "assets/leagues/badlands-brawl-pixel.webp",
    "Lustrian Superleague": "assets/leagues/lustrian-superleague-pixel.webp",
    "Chaos Clash": "assets/leagues/chaos-clash-pixel.webp",
    "Worlds Edge Superleague": "assets/leagues/worlds-edge-superleague-pixel.webp",
    "Elven Kingdoms League": "assets/leagues/elven-kingdoms-league-pixel.webp",
    "Halfling Thimble Cup": "assets/leagues/halfling-thimble-cup-pixel.webp",
    "Woodland League": "assets/leagues/woodland-league-pixel.webp",
    "Underworld Challenge": "assets/leagues/underworld-challenge-pixel.webp"
  };
  const PORTRAIT_CROPS = window.BB_PORTRAIT_CROPS || {};
  const LEAGUE_REPRESENTATIVES = {
    "Old World Classic": { rosterId: "bretonnian", starId: "griff" },
    "Sylvanian Spotlight": { rosterId: "vampire", starId: "luthor" },
    "Badlands Brawl": { rosterId: "blackOrc", starId: "varag" },
    "Lustrian Superleague": { rosterId: "lizardmen", starId: "anqiPanqi" },
    "Chaos Clash": { rosterId: "khorne", starId: "scyla" },
    "Worlds Edge Superleague": { rosterId: "dwarf", starId: "grombrindal" },
    "Elven Kingdoms League": { rosterId: "highElf", starId: "eldril" },
    "Halfling Thimble Cup": { rosterId: "halfling", starId: "puggy" },
    "Woodland League": { rosterId: "woodElf", starId: "jordell" },
    "Underworld Challenge": { rosterId: "underworld", starId: "blackGobbo" }
  };
  const browseFilterStorageKey = "bb-atlas-browse-filters-v1";
  const coachSkillStorageKey = "bb-atlas-coach-skill-v1";
  const requestedParams = new URLSearchParams(window.location.search);
  const requestedView = requestedParams.get("view");
  let savedBrowseFilters = {};
  try {
    const parsedFilters = JSON.parse(window.localStorage.getItem(browseFilterStorageKey) || "{}");
    if (parsedFilters && typeof parsedFilters === "object") savedBrowseFilters = parsedFilters;
  } catch (_) {}
  const validFormat = value => value === "sevens" || value === "standard";
  const requestedLeague = requestedParams.has("league") ? requestedParams.get("league") : savedBrowseFilters.league;
  const requestedLeagues = requestedParams.has("league")
    ? (DATA.leagues.includes(requestedLeague) ? [requestedLeague] : [])
    : Array.isArray(savedBrowseFilters.leagues)
      ? savedBrowseFilters.leagues.filter(league => DATA.leagues.includes(league))
      : (DATA.leagues.includes(requestedLeague) ? [requestedLeague] : []);
  const requestedFormat = requestedParams.has("format") ? requestedParams.get("format") : savedBrowseFilters.format;
  const initialLeague = requestedLeagues[0] || "";
  const initialFormat = validFormat(requestedFormat) ? requestedFormat : "";
  let savedCoachSkill = 60;
  try {
    const value = Number(window.localStorage.getItem(coachSkillStorageKey));
    if (COACH_PRESETS.some(preset => preset.coachSkill === value)) savedCoachSkill = value;
  } catch (_) {}
  let scoreVersionMode = window.BB_STANDARD_VERSION_MODE || "candidate";
  const standardMode = () => scoreVersionMode !== "history";
  function standardRow(person, kind) {
    if (!person || person.simulated) return null;
    const format = kind === "team" ? (person.format === "sevens" ? "sevens" : "11s") : kind === "star" ? "11s" : state.format === "sevens" ? "sevens" : "11s";
    if (kind === "star" && person.isStarPair) return window.BB_STANDARD_TASK_EXPERIMENT_V1?.dossiers?.find(row => row.subjectId === person.id && row.format === "11s") || null;
    if(window.BB_ROSTER_CANDIDATE_ACTIVE&&kind==='team'&&format==='11s')return window.BB_STANDARD_TASK_EXPERIMENT_V1?.teamDossiers?.find(r=>r.subjectId===person.id&&r.format===format)||null;
    return window.BB_STANDARD_TASK_VIEW?.find(person, kind, format) || null;
  }
  function renderStandardRail(item, kind) {
    const selected = state.selectedId === item.id;
    const row = standardRow(item, kind);
    const measured = Array.isArray(row?.tasks) ? row.tasks.filter(task => task.status === "complete").length : null;
    const refreshedTeam = kind === 'team' && row?.rosterUpdateScope === 'ballControl-survival-only';
    const taskStatus = measured == null ? '任务缓存待计算' : refreshedTeam ? '六维已接入；杀伤为抽样参考' : row?.format==='11s'&&kind!=='team' ? '当前个人指标 · 精度见详情' : measured + ' / 80 项概率精确 · 六维6/6';
    const artKind = kind === "team" ? "teams" : kind === "star" ? "stars" : "players";
    const artAttrs = leagueBackdropAttrs(item, artKind, state.league);
    return '<article class="rail-card standard-rail ' + (kind === 'team' ? 'team-rail-card team-art-card ' : kind === 'star' ? 'star-rail-card star-art-card ' : 'player-rail-card ') + (selected ? 'is-selected ' : '') + (artAttrs ? ' atlas-art-card' : '') + '"' + artAttrs + ' data-select="' + esc(item.id) + '" role="button" tabindex="0"><div class="rail-card-top ' + (kind === 'team' ? 'team-art-top' : kind === 'star' ? 'star-art-top' : 'base-art-top') + '"><span class="card-kicker">' + (kind === "team" ? refreshedTeam ? '当前名单 · 六维更新' : '实际名单 · 共享任务' : kind === "star" ? item.isStarPair ? '双人明星组合 · 一次合约' : '明星 · 标准任务' : '基础球员 · 标准任务') + '</span>' + (kind === 'star' ? '<span class="star-rail-portrait-frame"' + (item.isStarPair ? '' : ' data-star-id="' + esc(item.id) + '"') + '>' + portraitMark(item, 'rail-portrait star-rail-portrait', 'emblem') + '</span>' : portraitMark(item, kind === 'team' ? 'rail-team-art' : 'rail-portrait', 'emblem')) + '</div><h3>' + esc(kind === "team" ? fullTeamName(item) : item.name) + '</h3><p>' + esc(kind === "team" ? item.formatName : row?.format === "sevens" ? "七人制" : "十一人制") + '</p><div class="rail-card-bottom"><span>' + taskStatus + '</span>' + (row ? window.BB_STANDARD_TASK_INTEGRATION.overallSummary(row) : '') + (row ? '<span class="integrated-rail-radar">' + window.BB_STANDARD_TASK_VIEW.radar(row) + '</span>' : '') + '</div></article>';
  }
  function renderStandardTeamFacts(team) {
    const legality = teamLegality(team);
    const stars = DATA.stars.filter(star => team.format === "standard" && team.leagueNames.some(league => starTeamBundle(star).every(member => (member.eligibleByLeague?.[league] || []).includes(team.rosterName))));
    return '<div class="featured-meta"><span class="meta-chip">名单：' + esc(legality.status === 'valid' ? 'V7.0.1 校验通过' : legality.status === 'simulation-unverified' ? '临时编辑待校验' : '需检查构筑') + '</span><span class="meta-chip">' + (team.apothecary ? '有队医' : '无队医') + '</span><span class="meta-chip">' + esc(team.leagueNames.join('、')) + '</span></div><button type="button" class="featured-action" data-open-team-players="' + esc(team.id) + '">查看这支球队的球员档案与编辑入口 →</button>' + renderTeamRosterAdjustment(team) + renderTeamMatchup(team) + '<details class="appearance-details"><summary>本队可招募明星 · ' + stars.length + ' 名</summary><p>按赛区和球队招募资格列出；价格与个人能力可查看。双人组合必须整组符合资格；总预算、人数上限与赛制采购限制仍需单独检查。列表不表示当前预算可直接买入，个人赋分也不等于球队补强收益。</p><ul>' + stars.map(star => '<li><button type="button" class="featured-action" data-open-star-profile="' + esc(star.id) + '" data-team-id="' + esc(team.id) + '">' + esc(star.name) + '</button> · ' + esc(fullCurrency(star.pairTotalCost || star.cost)) + (star.pairTotalCost ? '（整组）' : '') + '</li>').join('') + '</ul></details>';
  }
  function renderStandardStarEligibility(star) {
    return '<details class="appearance-details"><summary>可用赛区、球队与费用</summary><p>' + (star.isStarPair ? '两位成员一次合约费用 ' : '费用 ') + esc(fullCurrency(star.cost)) + (star.pairTotalCost ? ' · 配对合计 ' + esc(fullCurrency(star.pairTotalCost)) : '') + '</p><ul>' + Object.entries(star.eligibleByLeague || {}).map(([league,teams]) => '<li><b>' + esc(league) + '</b> · ' + esc(teams.join('、')) + '</li>').join('') + '</ul><p>招募资格与价格单列；规则触发或补强收益以任务证据为准。</p></details>';
  }
  function pairedStarMemberDetails(pair) {
    return '<section class="paired-star-members" aria-label="搭档组合两位成员的真实卡面"><h4>组合成员 · 分别结算</h4>' + pair.members.map(member =>
      '<article class="paired-star-member"><div class="paired-star-member-head">' + portraitMark(member, 'paired-star-detail-portrait', 'emblem') + '<b>' + esc(member.name) + '</b></div>' +
      '<p>MA ' + esc(member.ma) + ' · ST ' + esc(member.st) + ' · AG ' + esc(member.ag == null ? '—' : member.ag + '+') + ' · PA ' + esc(member.pa == null ? '—' : member.pa + '+') + ' · AV ' + esc(member.av == null ? '—' : member.av + '+') + '</p>' +
      '<p><b>技能与特性：</b>' + esc(member.skillText || editorSkillText(member.skills)) + '</p>' +
      '<p><b>专属规则：</b>' + esc(member.specialRules || member.rule?.summary || '未提供') + '</p></article>').join('') +
      '<small>两人各有独立属性、技能、行动与受伤状态；组合分来自共同研究对象，不能将属性取平均当作单人。</small></section>';
  }
  function renderStandardFeatured(kind, item) {
    const row = standardRow(item, kind);
    const candidateTeam=Boolean(window.BB_ROSTER_CANDIDATE_ACTIVE&&kind==='team'&&row?.format==='11s');
    const refreshedTeam=candidateTeam&&row?.rosterUpdateScope==='ballControl-survival-only';
    if(candidateTeam)item={...item,...row.profile};
    const candidateSkillLabel=skill=>typeof skill==='string'?skill:skill?(skill.name||skill.id||skill.skillId||JSON.stringify(skill))+(skill.value!=null?' ('+skill.value+')':''):'无';
    const view = window.BB_STANDARD_TASK_VIEW;
    const title = kind === "team" ? fullTeamName(item) : item.name;
    const stats = kind === "team" ? '<p>预算 ' + esc(fullCurrency(item.budget)) + (refreshedTeam ? ' · 购买重掷 ' : ' · 重掷 ') + item.rerolls + (refreshedTeam && row.resourceValuation?.chef ? ' · 大厨折算2枚（含削弱对手）' : '') + ' · ' + item.players.length + ' 名球员</p>' : item.isStarPair ? '<p>两名真实成员 · 一次合约 ' + esc(fullCurrency(item.cost)) + ' · 各自属性与规则见下方</p>' : playerStats(item);
    const chart = row && view ? view.radar(row) : '<div class="st-empty">' + (kind === "team" ? '当前实际名单没有完全匹配的团队任务缓存，编辑或缺失后须重新计算。' : '当前属性与技能组合尚无实验缓存；编辑后需重新计算，不能沿用原始分数。') + '</div>';
    const cells = row && view ? view.cells(row) : '';
    const importance=kind!=='team'&&row?.format==='11s'?window.BB_TEAM_IMPORTANCE?.axisFor(row):null;
    const importanceNote=importance?.teamName?'<p class="st-caption">个人价值：最佳适配 '+esc(importance.teamName)+' · 出场贡献 '+importance.absoluteScore.toFixed(4)+' 能力点；按14%计入综合评价，详情可看全部合法球队。</p>':importance?'<p class="st-caption">历史属性变体不匹配现行合法位置，不进入规范榜。</p>':'';
    const action = row ? '<button class="featured-action" data-open-standard-task-profile="' + esc(kind) + '" data-profile-subject="' + esc(row.subjectId) + '" data-profile-name="' + esc(row.name) + '" data-profile-format="' + esc(row.format) + '">展开当前任务与计算依据 →</button>' : '';
    const facts = kind === "team" ? '<ul class="st-roster">' + item.players.map(player => '<li><b>' + esc((candidateTeam?'#'+(player.number??'—')+' ':'')+(candidateTeam&&player.star?'★ ':'')+player.name) + '</b><small>MA ' + player.ma + ' · ST ' + player.st + ' · AG ' + player.ag + ' · PA ' + (player.pa ?? '—') + ' · AV ' + player.av + '</small><small>' + esc(candidateTeam?'原生技能：'+((player.skills||[]).map(candidateSkillLabel).join('、')||'无'):player.skillText || (player.skills || []).map(skill => skill.id || skill).join('、')) + (candidateTeam?'</small><small>'+((row.profile?.starterIds||[]).includes(player.id)?'固定首发 · ':'替补 · ')+(player.star?'明星 · ':'')+'追加技能：'+esc(candidateSkillLabel(player.boughtSkill)):'') + '</small>'+(() => {const record=window.BB_TEAM_IMPORTANCE?.recordForActor(row?.subjectId,player);return record?'<button type="button" class="featured-action" data-importance-record="'+esc(record.recordId)+'">球队重要性 '+record.rawScore.toFixed(4)+' · '+esc(window.BB_IMPORTANCE_AXIS_DATA.metricLabels[record.metricKind])+'</button>':'';})()+'</li>').join('') + '</ul>' : item.isStarPair ? pairedStarMemberDetails(item) : '<div class="featured-skill"><b>技能与特性</b><p>' + esc(item.skillText || '无初始技能') + '</p><small>' + esc((item.keywords || []).join(' · ')) + '</small></div>' + (kind === "star" ? '<details class="appearance-details"><summary>明星专属规则原文</summary><p>' + esc(item.specialRules || '未提供') + '</p><p>有限使用次数和团队收益须在合法共享行动链中兑现；未核实部分不作无条件加分。</p></details>' : appearanceDetails(item));
    const artAttrs = leagueBackdropAttrs(item, kind === 'team' ? 'teams' : kind === 'star' ? 'stars' : 'players', state.league);
    return '<article class="featured-card standard-featured' + (artAttrs ? ' atlas-art-card' : '') + '"' + artAttrs + '><div class="featured-main"><div class="featured-copy"><div class="featured-kicker"><span>规则驱动标准任务 · ' + (scoreVersionMode === 'previous' ? '历史V7' : kind !== 'team' ? '个人评分' : row?.format === 'sevens' ? '七人制评分' : (refreshedTeam ? '当前高手军表 · 六维更新' : candidateTeam ? '1150K候选军表 · V11生存' : window.BB_SURVIVAL_V9_ACTIVE ? '十一人制全队生存V9' : '历史十一人制任务择优V8')) + '</span><span class="model-pending">' + (kind === "team" ? refreshedTeam ? '当前名单 · 六维已接入' : '真实名单 · 共享资源' : '个人价值 · 最佳球队贡献') + '</span></div><div class="featured-title-row ' + (kind === 'team' ? 'team-art-title-row' : '') + '">' + portraitMark(item, kind === 'team' ? 'featured-team-art' : kind === 'star' ? 'featured-portrait featured-star-portrait' : 'featured-portrait', 'featured-mark') + '<div><h3>' + esc(title) + '</h3><p>' + esc(kind === "team" ? refreshedTeam ? '当前高手军表' : item.intro || '实际参考名单' : item.isStarPair ? '两位成员组成一份合法合约；个人属性、技能与规则分别展示。' : item.description || '相同局面和有限资源下的标准任务') + '</p></div></div>' + stats + importanceNote + '<p>先计算标准任务底分，再在同赛制规范比较池中赋0—100分并绘制六维雷达。同底分并列同分；主分表示相对位置，绝对底分和任务概率另列。个人与球队分池，价格和培养价值单列。</p>' + (kind === 'team' ? refreshedTeam ? '<p>30队六维当前版；杀伤采用已确认的联合分工优化表；控球50/50前8接应、生存25/70/5几何保留。控球主力与前8人接应各50%，以几何平均合成；生存ABC为25%／70%／5%几何平均。任务细节按需展开。</p>' : '<p>80个模板均用实际名单和同一棋盘计算，另有6条多人共享行动链。统一1枚球队重掷，不启用Leader；保留真实Veteran/队长状态及其规则资源，原采购重掷数在名单中单列。' + (row?.format==='sevens' ? '七人制评分与任务保持V7不变。' : candidateTeam ? '当前控球采用50%主力处理球＋50%全队接应；主力逐任务取首发前三人，接应逐项取首发前8人均值，两部分以几何平均合成。传接球使用不同真实队友，共享重掷，不另加多人配合分。生存ABC为25%／70%／5%几何平均。' : window.BB_SURVIVAL_V9_ACTIVE ? 'V9生存使用固定首发11人：抗击倒25%、抗伤留场／再生保全50%、后续可用25%；其余五维冻结V8。结果范围见雷达与全队生存新旧对照。' : '历史V8逐任务择优。') + (candidateTeam ? ' 七人制与个人不变。控球底分保留完整精度再赋分，其他四维保持；生存按首发11人聚合。' : ' 七人制仍沿用V7。V8其余维度逐任务比较全部真实人选；V9生存采用全队聚合。') + '6条共享链比较所有不同球员的有序人对，独立展示、不重复加分。V7保留原固定分工。冻结行动策略不代表全局最优教练，不同采购预算也不是同预算强度。</p>' : '') + (row && view ? (refreshedTeam ? '' : view.summary(row)) + window.BB_STANDARD_TASK_INTEGRATION.overallSummary(row) : '') + action + '</div><div class="featured-chart-wrap">' + chart + '</div></div><div class="st-featured-cells">' + cells + '</div>' + facts + (kind === 'team' ? refreshedTeam ? '<p>当前名单已列出；各维度来源可在任务详情中展开。</p>' : window.BB_ROSTER_CANDIDATE_ACTIVE&&row?.format==='11s' ? '<p>当前展示候选军表和任务缓存；展开标准任务查看完整名单与证据。</p>' : renderStandardTeamFacts(item) : kind === 'star' ? renderStandardStarEligibility(item) : '') + '<details class="appearance-details"><summary>阵容贡献与长期培养</summary><p>阵容贡献须在具体队伍共享资源任务中比较移除/替换前后；培养须另算成本、成长和永久伤病。当前实验缓存不从个人雷达平均或面积推导这两项。</p><p>长期培养资料独立于当前评分。</p></details>' + (kind === "team" ? '' : renderPlayerEditor(item)) + '<a class="detail-link" href="../全赛区球队与球员六维图鉴_v0.1.md">原始名单与历史静态图鉴 ↗</a></article>';
  }
  const state = { view: ["teams", "players", "stars"].includes(requestedView) ? requestedView : ( ["teams", "players", "stars"].includes(savedBrowseFilters.view) ? savedBrowseFilters.view : "teams"), league: initialLeague, leagues: requestedLeagues, format: initialFormat, search: typeof savedBrowseFilters.search === "string" ? savedBrowseFilters.search : "", selectedId: "", teamScope: "", editor: null, rankPlayerData: [], coachSkill: savedCoachSkill };
  let globalSearchResults = [];
  let globalSearchActiveIndex = -1;
  const rankingPreferenceKey = "bb-atlas-ranking-preferences-v2";
  const rankingState = { kind: "teams", source: "legacy", metric: "overall", leagues: [], format: "", search: "", limit: "25", reverse: false, taskPolicy: "withoutTeamRerolls" };
  let rankingModes = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(rankingPreferenceKey) || "{}");
    if (["teams", "players", "stars"].includes(saved.kind)) rankingState.kind = saved.kind;
    if (["raw", "legacy", "calibrated"].includes(saved.source)) rankingState.source = saved.source;
    if (typeof saved.metric === "string") rankingState.metric = saved.metric;
    if (Array.isArray(saved.leagues)) rankingState.leagues = saved.leagues.filter(league => DATA.leagues.includes(league));
    else if (DATA.leagues.includes(saved.league)) rankingState.leagues = [saved.league];
    if (validFormat(saved.format)) rankingState.format = saved.format;
    if (["10", "25", "50", "all"].includes(saved.limit)) rankingState.limit = saved.limit;
    if (typeof saved.search === "string") rankingState.search = saved.search;
    rankingState.reverse = saved.reverse === true;
    if (saved.taskPolicy === "withTeamRerolls") rankingState.taskPolicy = saved.taskPolicy;
    if (saved.modes && typeof saved.modes === "object" && !Array.isArray(saved.modes)) rankingModes = saved.modes;
  } catch (_) {}
  for (const kind of ["teams", "players", "stars"]) {
    const mode = rankingModes[kind];
    if (!mode || typeof mode !== "object") continue;
    if (["raw", "legacy", "calibrated"].includes(mode.source)) rankingModes[kind].source = mode.source;
    else delete rankingModes[kind].source;
    if (typeof mode.metric !== "string") delete rankingModes[kind].metric;
    if (typeof mode.reverse !== "boolean") delete rankingModes[kind].reverse;
  }
  if (!rankingModes[rankingState.kind]) rankingModes[rankingState.kind] = {};
  Object.assign(rankingModes[rankingState.kind], { source: rankingState.source, metric: rankingState.metric, reverse: rankingState.reverse });
  function persistRankingPreferences() {
    try { window.localStorage.setItem(rankingPreferenceKey, JSON.stringify(Object.assign({}, rankingState, { modes: rankingModes }))); } catch (_) {}
  }
  const rankingLeagueMatches = leagues => !rankingState.leagues.length || (leagues || []).some(league => rankingState.leagues.includes(league));
  const rankingLeagueSummary = () => !rankingState.leagues.length ? "所有赛区" : rankingState.leagues.length === 1 ? rankingState.leagues[0] : rankingState.leagues.length + " 个赛区";
  function updateRankingLeaguePicker() {
    const summary = document.getElementById("ranking-league-summary");
    const options = document.getElementById("ranking-league-options");
    if (!summary || !options) return;
    const search = document.getElementById("ranking-league-search");
    const query = search ? search.value : "";
    options.innerHTML = '<label class="ranking-league-option"><input type="checkbox" value=""' + (!rankingState.leagues.length ? ' checked' : '') + '> <span>所有赛区</span></label>' +
      DATA.leagues.map(league => '<label class="ranking-league-option" data-league-option><input type="checkbox" value="' + esc(league) + '"' + (rankingState.leagues.includes(league) ? ' checked' : '') + '> <span>' + esc(league) + '</span></label>').join("");
    refreshRankingLeagueSelection();
    if (search) search.value = query;
    if (query) {
      const normalized = query.trim().toLocaleLowerCase();
      options.querySelectorAll("[data-league-option]").forEach(option => {
        option.hidden = !option.textContent.toLocaleLowerCase().includes(normalized);
      });
    }
  }
  function refreshRankingLeagueSelection() {
    const summary = document.getElementById("ranking-league-summary");
    const options = document.getElementById("ranking-league-options");
    if (!summary || !options) return;
    summary.textContent = rankingLeagueSummary();
    summary.title = rankingState.leagues.join("、") || "所有赛区";
    options.querySelector('input[value=""]').checked = !rankingState.leagues.length;
    options.querySelectorAll("[data-league-option] input").forEach(input => { input.checked = rankingState.leagues.includes(input.value); });
  }
  const isRawRanking = () => rankingState.kind !== "teams" && rankingState.source === "raw";
  const isCalibratedRanking = () => rankingState.kind !== "teams" && rankingState.source === "calibrated";
  const isLegacyRanking = () => rankingState.kind === "teams" || rankingState.source === "legacy";
  const teamTaskPreferenceKey = "bb-atlas-team-task-preferences-v1";
  let teamTaskPreferences = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(teamTaskPreferenceKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) teamTaskPreferences = saved;
  } catch (_) {}
  const teamTaskReferenceCache = new Map();
  const teamTaskResultCache = new Map();
  const carrierPreferenceKey = "bb-atlas-carrier-threat-preferences-v1";
  let carrierThreatPreferences = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(carrierPreferenceKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) carrierThreatPreferences = saved;
  } catch (_) {}
  const carrierThreatResultCache = new Map();
  const rolePreferenceKey = "bb-atlas-role-task-preferences-v1";
  let roleTaskPreferences = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(rolePreferenceKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) roleTaskPreferences = saved;
  } catch (_) {}
  const roleTaskResultCache = new Map();
  const suitePreferenceKey = "bb-atlas-player-task-suite-preferences-v1";
  let suitePreferences = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(suitePreferenceKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) suitePreferences = saved;
  } catch (_) {}
  const suiteResultCache = new Map();
  const railEl = document.getElementById("catalog-list");
  const featuredEl = document.getElementById("featured-panel");
  const searchInput = document.getElementById("search");
  searchInput.value = state.search;
  const leagueStrip = document.getElementById("league-strip");
  const formatSwitch = document.getElementById("format-switch");
  const formatRow = document.getElementById("format-row");
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const scoreGrade = (grades, i) => (grades && grades[i]) || "C";
  const gradeClass = value => ({"A+":"grade-ap","A":"grade-a","A−":"grade-am","B+":"grade-bp","B":"grade-b","B−":"grade-bm","C":"grade-c","D":"grade-d","E":"grade-e"}[value] || "grade-c");
  const gradeTag = value => '<span class="grade ' + gradeClass(value) + '">' + esc(value) + '</span>';
  const GRADE_BANDS = [["A+",0.05],["A",0.125],["A−",0.20],["B+",0.30],["B",0.40],["B−",0.50],["C",0.80],["D",0.90],["E",1]];
  const OVERALL_WEIGHTS = [0.25,0.20,0.15,0.15,0.10,0.15];
  const TEAM_OVERALL_WEIGHTS = [0.22,0.18,0.16,0.15,0.15,0.14];
  const TEAM_PLAYER_REPLACEMENT_WEIGHTS = TEAM_OVERALL_WEIGHTS.slice(0, 5);
  const TEAM_PLAYER_REPLACEMENT_WEIGHT_TOTAL = TEAM_PLAYER_REPLACEMENT_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  function teamPlayerReplacementValue(scores) {
    return TEAM_PLAYER_REPLACEMENT_WEIGHTS.reduce((sum, weight, dimension) =>
      sum + weight * (Number(scores?.[dimension]) || 0), 0) / TEAM_PLAYER_REPLACEMENT_WEIGHT_TOTAL;
  }
  const PLAYER_OVERALL_DIMENSIONS = [0, 1, 2, 3, 4];
  const PLAYER_WEIGHT_TOTAL = PLAYER_OVERALL_DIMENSIONS.reduce((sum, dimension) => sum + OVERALL_WEIGHTS[dimension], 0);
  const PLAYER_SPECIALIST_SHARE = 0.35;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const itemColor = item => item.color || item.teamColor || "#596c5c";
  const fullTeamName = team => team.rosterName + " · " + team.formatName + "阵容";
  const fullCurrency = amount => Math.round(Number(amount) || 0).toLocaleString("en-US") + " 金币";

  function persistBrowseFilters() {
    try { window.localStorage.setItem(browseFilterStorageKey, JSON.stringify({ view: state.view, league: state.league, leagues: state.leagues, format: state.format, search: state.search })); } catch (_) {}
  }

  function currentLeagueLabel() {
    return state.leagues.length ? state.leagues.join("、") : "所有赛区";
  }

  function emblem(color, kind) {
    return '<span class="' + (kind || "emblem") + '" style="--team-color:' + esc(color || "#596c5c") + '" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M24 3 40 12v20L24 45 8 32V12Z" fill="currentColor" opacity=".88"/><path d="M24 11 33 16v12l-9 8-9-8V16Z" fill="none" stroke="#f6e9c7" stroke-width="1.6"/><path d="m19 24 4 3 7-8" fill="none" stroke="#f6e9c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function portraitMark(item, imageClass, emblemClass, eager = false) {
    if (item.isStarPair) return '<span class="paired-star-portraits" aria-label="' + esc(item.name) + ' 两位成员肖像">' +
      item.members.map(member => '<span class="paired-star-member-portrait">' + portraitMark(member, imageClass, emblemClass, eager) + '</span>').join('') + '</span>';
    const portraitUrl = window.BB_STANDARD_TASK_INTEGRATION?.imageUrl(item.portrait) || item.portrait;
    return item.portrait
      ? '<img class="' + imageClass + '" src="' + esc(portraitUrl) + '" alt="' + esc(item.name) + ' 像素模型" loading="' + (eager ? "eager" : "lazy") + '" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add(\'portrait-missing\')">'
      : emblem(itemColor(item), emblemClass);
  }

  function positionPortraitCrop(frame) {
    const image = frame.querySelector("img");
    if (!image) return;
    if (!image.complete || !image.naturalWidth) {
      if (!image.dataset.cropLoadBound) {
        image.dataset.cropLoadBound = "true";
        image.addEventListener("load", () => {
          delete image.dataset.cropLoadBound;
          positionPortraitCrop(frame);
        }, { once: true });
      }
      return;
    }
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (!width || !height) return;
    const cropId = frame.dataset.starId || frame.dataset.playerId || "";
    const crop = PORTRAIT_CROPS[cropId] || {};
    const leagueFrame = frame.classList.contains("league-player-frame");
    const focalX = clamp(Number(leagueFrame ? crop.leagueX : crop.x) || Number(crop.x) || 0.5, 0, 1);
    const focalY = clamp(Number(leagueFrame ? crop.leagueY : crop.y) || Number(crop.y) || 0.28, 0, 1);
    const zoom = Number(leagueFrame ? crop.league : crop.rail) || (leagueFrame ? 2.1 : 1.85);
    const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const scale = coverScale * zoom;
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    const left = clamp(width / 2 - focalX * imageWidth, width - imageWidth, 0);
    const top = clamp(height / 2 - focalY * imageHeight, height - imageHeight, 0);
    image.style.width = imageWidth + "px";
    image.style.height = imageHeight + "px";
    image.style.left = left + "px";
    image.style.top = top + "px";
  }

  function positionPortraitCrops() {
    document.querySelectorAll(".star-rail-portrait-frame, .league-player-frame").forEach(positionPortraitCrop);
  }

  let portraitCropResizeQueued = false;
  window.addEventListener("resize", () => {
    if (portraitCropResizeQueued) return;
    portraitCropResizeQueued = true;
    window.requestAnimationFrame(() => {
      portraitCropResizeQueued = false;
      positionPortraitCrops();
    });
  }, { passive: true });

  function point(i, radius, cx, cy, sides = 6) {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / sides;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  }

  function polygonPoints(values, maxR, cx, cy) {
    const sides = values.length;
    return values.map((value, i) => {
      const p = point(i, maxR * Math.max(0, Math.min(100, Number(value) || 0)) / 100, cx, cy, sides);
      return p[0].toFixed(1) + "," + p[1].toFixed(1);
    }).join(" ");
  }

  function radarSVG(scores, grades, compact, profileKind = "player") {
    compact = !!compact;
    const dimensionCount = profileKind === "team" ? DIMS.length : DIMS.length - 1;
    const dimensionLabels = profileKind === "team" ? DIMS.slice(0, dimensionCount - 1).concat("阵容韧性") : DIMS.slice(0, dimensionCount);
    const cx = compact ? 75 : 180, cy = compact ? 60 : 145, r = compact ? 30 : 88;
    const gradeRadius = {"A+":98,"A":92,"A−":86,"B+":78,"B":70,"B−":62,"C":48,"D":32,"E":18};
    const plotted = Array.from({ length: dimensionCount }, (_, i) => gradeRadius[scoreGrade(grades, i)] || 48);
    const levels = compact ? [35, 70, 100] : [20, 40, 60, 80, 100];
    let svg = '<svg class="radar ' + (compact ? "radar-compact" : "") + '" viewBox="' + (compact ? "0 0 150 120" : "0 0 360 286") + '" role="img" aria-label="' + (profileKind === "team" ? "旧球队任务代理：快攻、控球、杀伤、生存、控场、阵容韧性；不是规范六维" : "旧球员五项任务代理：快攻、控球、杀伤、生存、控场；角色覆盖另列，不是规范六维") + '">';
    levels.forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(dimensionCount).fill(level), r, cx, cy) + '"></polygon>'; });
    for (let i = 0; i < dimensionCount; i++) {
      const p = point(i, r, cx, cy, dimensionCount);
      svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"></line>';
    }
    svg += '<polygon class="data" points="' + polygonPoints(plotted.length ? plotted : [0,0,0,0,0,0], r, cx, cy) + '"></polygon>';
    plotted.forEach((value, i) => {
      const p = point(i, r * value / 100, cx, cy, dimensionCount);
      svg += '<circle class="point" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (compact ? 1.8 : 3) + '"></circle>';
    });
    dimensionLabels.forEach((label, i) => {
      const labelPoint = point(i, compact ? 50 : 119, cx, cy, dimensionCount), gradePoint = point(i, r * plotted[i] / 100 + (compact ? 5 : 10), cx, cy, dimensionCount);
      svg += '<text class="axis-label" x="' + labelPoint[0].toFixed(1) + '" y="' + labelPoint[1].toFixed(1) + '">' + esc(label) + '</text>';
      svg += '<text class="value-label" x="' + gradePoint[0].toFixed(1) + '" y="' + gradePoint[1].toFixed(1) + '">' + esc(scoreGrade(grades, i)) + "</text>";
    });
    return svg + '<text x="' + cx + '" y="' + (compact ? 114 : 277) + '" text-anchor="middle" fill="#9aa99c" font-size="' + (compact ? 6 : 9) + '">旧任务代理 · 非正式六维</text></svg>';
  }

  function calibrationFor(person, requestedFormat = state.format) {
    if (!person || person.simulated) return null;
    // UI properties use standard/sevens; source records use 11s/sevens.
    const format = requestedFormat === "sevens" ? "sevens" : "standard";
    return person.provisionalCalibrations && person.provisionalCalibrations[format] || null;
  }

  function provisionalTotalLabel(calibration) {
    return Number.isFinite(calibration.total)
      ? calibration.total.toFixed(1) + ' · ' + esc(calibration.totalGrade || '未分级')
      : '— · 未分级（覆盖不足）';
  }

  function legacyNumberText(value, digits = 1, suffix = '') {
    return value != null && value !== '' && Number.isFinite(Number(value))
      ? Number(value).toFixed(digits) + suffix
      : '无法计算（旧版说明未适配）';
  }

  function canonicalRadarSVG(person) {
    const calibration = calibrationFor(person);
    const axes = COACH_MODEL.AXES;
    const cx = 180, cy = 145, radius = 88;
    let svg = '<svg class="radar canonical-radar" viewBox="0 0 360 286" role="img" aria-label="暂定六维同条件赋分六边形：快攻、控球、杀伤、生存、控场、适应力；灰缺项表示覆盖不足。">';
    [20, 40, 60, 80, 100].forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(6).fill(level), radius, cx, cy) + '"></polygon>'; });
    const plotted = calibration ? calibration.scores : Array(6).fill(null);
    const complete = plotted.every(value => Number.isFinite(value));
    if (complete) svg += '<polygon class="data" points="' + polygonPoints(plotted, radius, cx, cy) + '"></polygon>';
    axes.forEach((axis, i) => {
      const edge = point(i, radius, cx, cy), label = point(i, 119, cx, cy);
      svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + edge[0] + '" y2="' + edge[1] + '"></line><text class="axis-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(axis.labelZh) + '</text>';
      if (Number.isFinite(plotted[i])) {
        const marker = point(i, radius * Math.max(0, Math.min(100, plotted[i])) / 100, cx, cy);
        svg += '<circle class="point" cx="' + marker[0] + '" cy="' + marker[1] + '" r="3"></circle>';
        const grade = calibration.grades[i] || '—';
        const gradePoint = point(i, Math.min(radius + 10, radius * plotted[i] / 100 + 10), cx, cy);
        svg += '<text class="value-label" x="' + gradePoint[0] + '" y="' + gradePoint[1] + '">' + esc(grade) + '</text>';
      } else {
        const blank = point(i, 7, cx, cy);
        svg += '<circle cx="' + blank[0] + '" cy="' + blank[1] + '" r="3" fill="#7d8989"></circle>';
      }
    });
    if (!calibration) svg += '<text x="180" y="140" text-anchor="middle" fill="#e7c876" font-size="12">此对象暂缺标定</text>';
    else if (!complete) svg += '<text x="180" y="140" text-anchor="middle" fill="#a9b8ab" font-size="8">灰轴：任务族覆盖不足</text>';
    return svg + '<text x="180" y="277" text-anchor="middle" fill="#9aa99c" font-size="9">暂定同条件赋分 · 非胜率</text></svg>';
  }

  function sixAxisCandidateFor(person, kind) {
    if (!person || person.simulated) return null;
    const format = kind === "team" ? (person.format === "sevens" ? "sevens" : "11s") : kind === "star" ? "11s" : state.format === "sevens" ? "sevens" : "11s";
    const subjectType = kind === "star" ? "star" : "player";
    return (window.BB_SIX_AXIS_CANDIDATE_V413 || window.BB_SIX_AXIS_CANDIDATE_V412 || window.BB_SIX_AXIS_CANDIDATE_V411)?.dossiers?.find(row =>
      row.subjectType === subjectType && row.subjectId === person.id && row.format === format) || null;
  }

  function sixAxisCandidateRadar(candidate) {
    const axes = [
      { id: "fastAttack", labelZh: "快攻" }, { id: "ballControl", labelZh: "控球" },
      { id: "lethality", labelZh: "杀伤" }, { id: "survival", labelZh: "生存" },
      { id: "control", labelZh: "控场" }, { id: "adaptability", labelZh: "适应力" }
    ];
    const cx = 180, cy = 145, radius = 88;
    const values = axes.map(axis => candidate.axisScores?.[axis.id]);
    let svg = '<svg class="radar canonical-radar" viewBox="0 0 360 286" role="img" aria-label="Bloodboard V7.0.1 任务赋分六维候选雷达；缺失维度不连至零分">';
    [20, 40, 60, 80, 100].forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(6).fill(level), radius, cx, cy) + '"></polygon>'; });
    axes.forEach((axis, i) => {
      const edge = point(i, radius, cx, cy), label = point(i, 119, cx, cy);
      svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + edge[0] + '" y2="' + edge[1] + '"></line><text class="axis-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(axis.labelZh) + '</text>';
    });
    values.forEach((value, i) => {
      const next = (i + 1) % values.length;
      if (!Number.isFinite(value) || !Number.isFinite(values[next])) return;
      const from = point(i, radius * Math.max(0, Math.min(100, value)) / 100, cx, cy);
      const to = point(next, radius * Math.max(0, Math.min(100, values[next])) / 100, cx, cy);
      svg += '<line class="data" x1="' + from[0] + '" y1="' + from[1] + '" x2="' + to[0] + '" y2="' + to[1] + '"></line>';
    });
    values.forEach((value, i) => {
      const p = Number.isFinite(value) ? point(i, radius * Math.max(0, Math.min(100, value)) / 100, cx, cy) : point(i, 7, cx, cy);
      svg += '<circle class="point" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (Number.isFinite(value) ? '3' : '2') + '"' + (Number.isFinite(value) ? '' : ' fill="#7d8989"') + '></circle>';
    });
    return svg + '<text x="180" y="277" text-anchor="middle" fill="#e7c876" font-size="9">V3.139 六维总评候选 · 暂定 · 非胜率</text></svg>';
  }

  function sixAxisCandidateCells(candidate) {
    if (!candidate) return '<div class="detail-scores canonical-scores">当前筛选赛制暂无可用的六维候选；切换赛制或在六维评价区查看完整任务记录。</div>';
    const axes = [
      { id: "fastAttack", labelZh: "快攻" }, { id: "ballControl", labelZh: "控球" },
      { id: "lethality", labelZh: "杀伤" }, { id: "survival", labelZh: "生存" },
      { id: "control", labelZh: "控场" }, { id: "adaptability", labelZh: "适应力" }
    ];
    const evidenceLabel = status => ({
      "v7-task-proxy": "V7同条件任务",
      "mixed-v7-and-explicit-legacy-special-action": "V7任务＋V410特攻代理",
      "rule-floor-no-ball": "No Ball规则下限",
      "legacy-v410-fallback-no-comparable-v7-task": "V410旧版回退",
      "legacy-v410-role-coverage-proxy": "V410角色代理"
    })[status] || "证据来源待核";
    return '<div class="detail-scores canonical-scores">' + axes.map(axis => {
      const dimension = candidate.dimensions?.find(row => row.id === axis.id);
      const score = candidate.axisScores?.[axis.id];
      const basis = candidate.scoreBasis?.[axis.id] || "—";
      return '<div class="score-cell" title="' + esc(dimension?.notes?.join(" ") || evidenceLabel(basis)) + '"><span class="score-label">' + esc(axis.labelZh) + '</span><span class="score-value"><b>' + (Number.isFinite(score) ? score.toFixed(1) : '—') + '</b><small>' + esc(evidenceLabel(basis)) + '</small></span></div>';
    }).join('') + '</div><p class="canonical-profile-note"><b>暂定总评 ' + esc(candidate.overallGrade || "—") + ' · ' + (Number.isFinite(candidate.overallScore) ? candidate.overallScore.toFixed(1) : '—') + ' 分 · 第 ' + esc(candidate.overallRank || "—") + ' 名。</b>六项先分别赋分，再按 22/18/16/15/15/14 权重确定顺序，最后在同赛制球员与明星中反向排名赋总分和等级。卡片标签区分任务证据、规则下限与旧版回退；分数是候选相对排名点，不是成功概率。球队整体与明星逐队收益仍按球队情境单独计算。</p>';
  }

  function canonicalScoreCells(person) {
    if (person && person.players && person.teamOverallStatus) return teamScoreCells(person);
    const calibration = calibrationFor(person);
    if (!calibration) return '<div class="detail-scores canonical-scores">' + (person && person.players ? '球队正式六维尚未生成。当前可展开查看旧任务代理按各任务轴分别选出的阵容；不以单人分数均值代替球队能力。完整规则任务、团队协同与跨队校准仍待接入。' : '暂定六维分数未生成；模拟修改须重新计算任务档案。') + '</div>';
    return '<div class="detail-scores canonical-scores">' + COACH_MODEL.AXES.map((axis, index) =>
      '<div class="score-cell" title="' + esc(axis.definition) + '"><span class="score-label">' + esc(axis.labelZh) + '</span><span class="score-value"><b>' + (Number.isFinite(calibration.scores[index]) ? calibration.scores[index].toFixed(1) : '—') + '</b>' +
      (calibration.grades[index] ? gradeTag(calibration.grades[index]) : '<small>覆盖不足</small>') + '</span></div>'
    ).join('') + '</div><p class="canonical-profile-note"><b>暂定综合赋分 ' + (Number.isFinite(calibration.total) ? calibration.total.toFixed(1) : '—') + ' · ' + esc(calibration.totalGrade || '未分级') + '</b>。六项先按同条件任务表现分别赋分，再按 25/20/15/15/15/10 权重计算；同一赛制与球员/明星比较组内排名分档。' +
      '覆盖：' + Math.round(calibration.totalCoverage * 100) + '%；这是可复算的相对标定，不是比赛胜率、官方 Tier 或球队 Strength。灰轴/缺项不代表零分。</p>' + renderMobilityCalibrationCoverage(person);
  }

  function mobilityCoverageText(calibration) {
    const coverage = calibration?.coverage?.[0];
    if (coverage?.explicitConstraint) return 'No Ball：机动按显式约束记 0/E；持球达阵任务 N/A，不是失败概率 0%';
    const family = coverage?.families?.find(item => item.id === 'held-touchdown-distance-curve');
    if (!family) return '持球达阵族暂无可赋分覆盖；缺项不记零';
    const excluded = family.tasks.filter(task => task.status === 'endpoint-unverified');
    return '持球达阵距离覆盖 ' + family.rankedTaskCount + '/' + family.declaredTaskCount + '；采用族权重 ' + Math.round(family.usedWeight * 100) + '%（声明 40%）' +
      (family.rankedTaskCount < family.minimumRankedTasks ? '；不足 ' + family.minimumRankedTasks + ' 项，整个达阵族未计入' : '') +
      (excluded.length ? '；8格终点语义待核对，未计入；等级变化来自覆盖变化，不代表实际能力下降' : '');
  }

  function renderMobilityCalibrationCoverage(person) {
    const calibration = calibrationFor(person);
    if (!calibration) return '';
    const coverage = calibration.coverage[0];
    const family = coverage?.families?.find(item => item.id === 'held-touchdown-distance-curve');
    const summary = mobilityCoverageText(calibration);
    const baseline = window.BB_PROVISIONAL_CALIBRATION?.records?.[person.id + '|' + calibration.format];
    const gradeChanged = baseline?.profileSignature === calibration.profileSignature && baseline.grades[0] !== calibration.grades[0];
    const hasSemanticExclusion = family?.tasks.some(task => task.status === 'endpoint-unverified');
    let html = '<div class="canonical-profile-note mobility-calibration-note"><b>机动标定 v3.36 · ' + esc(summary) + '</b>' +
      (gradeChanged ? '<p>机动等级：' + esc(baseline.grades[0] || '未分级') + ' → ' + esc(calibration.grades[0] || '未分级') + (hasSemanticExclusion ? '。当前只有 4/6 格两项进入达阵族；这不是实际能力下降的结论。' : '。比较组或覆盖变化会改变相对赋分，不能直接解释为规则成功率变化。') + '</p>' : '') +
      '<p>仍为 35% 无球自身最大有效距离 + 40% 已持球 4/6/8 格达阵曲线 + 25% 无球脱离。只替换中间任务族，没有重复加分；其余五轴与综合权重不变。相较修正后的 v3.34 基线，本轮所有综合等级保持不变。</p>';
    if (family) {
      const labels = {touchdown4:'已持球 4 格达阵',touchdown6:'已持球 6 格达阵',touchdown8:'已持球 8 格达阵'};
      const statuses = {'ranked':'同条件赋分完成','out-of-range':'超出合法范围，未计入','not-applicable':'N/A 不适用，未计入','endpoint-unverified':'终点语义待核对，未计入','insufficient-cohort':'同条件样本不足，未计入'};
      const rows = family.tasks.map(task => {
        const admitted = task.status === 'ranked' && family.usedWeight > 0;
        const raw = task.raw ? touchdownProbabilityText(task.raw) : '—';
        const status = task.status === 'endpoint-unverified' ? '终点站立持球与引擎记录达阵存在未解释差异；原始记录在下方保留，不赋此项排名点' : task.reason || statuses[task.status] || task.status;
        return '<tr><th scope="row">' + esc(labels[task.taskId] || task.taskId) + '</th><td>' + raw + '</td><td>' + (Number.isFinite(task.points) ? task.points.toFixed(1) : '—') + '</td><td>' +
          (admitted ? '计入' : '未计入') + '<small>' + esc(status) + (task.status === 'ranked' && !admitted ? '；但达阵族未达到最低两项门槛' : '') + '</small>' +
          (task.peerCount > 0 ? '<small>同条件比较组 ' + task.peerCount + ' 名</small>' : '') + '</td></tr>';
      }).join('');
      html += '<details class="player-suite-axis"><summary>查看 4/6/8 格任务覆盖、同条件赋分与排除原因</summary><p>实际采用族权重覆盖 ' + Math.round(coverage.weightCoverage * 100) + '%；按声明权重计算的任务覆盖 ' + Math.round(coverage.weightedTaskCoverage * 100) + '%。这两个比例含义不同，不能把有轴分当作覆盖完整。</p>' +
        '<div class="team-impact-scroll touchdown-evidence-scroll" tabindex="0" role="region" aria-label="机动达阵任务覆盖表，可横向滚动"><table><thead><tr><th>达阵任务</th><th>可赋分原始概率</th><th>相对排名点</th><th>计分采用与限制</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
    }
    return html + '<p>只有相同赛制、任务、初始棋盘和资源政策的组内才比较，至少 5 名才赋分。主条件无通用帮手、正常天气、起始 1 枚团队重掷但禁止花费、无 Leader。受标记 8 格与起点/终点 Thrall 对照不进入评分；N/A、超范围、区间或语义待核对项不补零、不用旧移动结果回填。</p>' +
      '<span>v3.36 公式、覆盖与终点语义说明（后台资料）</span> · <span>逐人前后差异与排除记录（后台资料）</span></div>';
  }

  function calibratedCompactRadar(person) {
    const candidate = sixAxisCandidateFor(person, person.eligibleByLeague ? "star" : "player");
    if (candidate) {
      const values = ["fastAttack", "ballControl", "lethality", "survival", "control", "adaptability"].map(id => candidate.axisScores?.[id]);
      const cx = 75, cy = 59, radius = 34;
      let svg = '<svg class="radar radar-compact" viewBox="0 0 150 120" role="img" aria-label="V3.139 六维总评候选雷达；估算值见详情">';
      [35,70,100].forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(6).fill(level), radius, cx, cy) + '"></polygon>'; });
      for (let i = 0; i < 6; i++) {
        const edge = point(i, radius, cx, cy, 6), label = point(i, 48, cx, cy, 6);
        svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + edge[0] + '" y2="' + edge[1] + '"></line><text class="axis-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(COACH_MODEL.AXES[i].labelZh.slice(0,2)) + '</text>';
      }
      values.forEach((value, i) => {
        const next = (i + 1) % values.length;
        if (!Number.isFinite(value) || !Number.isFinite(values[next])) return;
        const a = point(i, radius * Math.max(0, Math.min(100, value)) / 100, cx, cy, 6);
        const b = point(next, radius * Math.max(0, Math.min(100, values[next])) / 100, cx, cy, 6);
        svg += '<line class="data" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"></line>';
      });
      values.forEach((value, i) => {
        if (!Number.isFinite(value)) return;
        const p = point(i, radius * Math.max(0, Math.min(100, value)) / 100, cx, cy, 6);
        svg += '<circle class="point" cx="' + p[0] + '" cy="' + p[1] + '" r="1.8"></circle>';
      });
      return svg + '<text x="75" y="114" text-anchor="middle" fill="#9aa99c" font-size="6">V3.139 暂定六维</text></svg>';
    }
    const calibration = calibrationFor(person);
    if (!calibration) return canonicalRadarSVG(person);
    const cx = 75, cy = 59, radius = 34, values = calibration.scores;
    let svg = '<svg class="radar radar-compact" viewBox="0 0 150 120" role="img" aria-label="暂定赋分六边形；轴顺序为快攻、控球、杀伤、生存、控场、适应力">';
    [35,70,100].forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(6).fill(level), radius, cx, cy) + '"></polygon>'; });
    for (let i=0;i<6;i++) {
      const edge=point(i,radius,cx,cy,6), label=point(i,48,cx,cy,6);
      svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + edge[0] + '" y2="' + edge[1] + '"></line>';
      svg += '<text class="axis-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(COACH_MODEL.AXES[i].labelZh.slice(0,2)) + '</text>';
    }
    if (values.every(Number.isFinite)) svg += '<polygon class="data" points="' + polygonPoints(values, radius, cx, cy) + '"></polygon>';
    values.forEach((value,i) => {
      if (!Number.isFinite(value)) return;
      const p=point(i,radius*value/100,cx,cy,6);
      svg += '<circle class="point" cx="' + p[0] + '" cy="' + p[1] + '" r="1.8"></circle>';
    });
    return svg + '<text x="75" y="114" text-anchor="middle" fill="#9aa99c" font-size="6">暂定赋分 · ' + esc(calibration.totalGrade || '—') + '</text></svg>';
  }

  function compactSixAxisRadar(values, label, enlarged = false) {
    const cx = 75, cy = 55, radius = enlarged ? 46 : 30;
    const labelRadius = enlarged ? 56 : 47;
    const finite = Array.from({ length: 6 }, (_, index) => values?.[index] != null && Number.isFinite(Number(values[index])) ? Number(values[index]) : null);
    let svg = '<svg class="radar radar-compact paired-six-radar" viewBox="' + (enlarged ? '0 -5 150 125' : '0 0 150 120') + '" role="img" aria-label="' + esc(label || "六维候选画像") + '">';
    [35, 70, 100].forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(6).fill(level), radius, cx, cy) + '"></polygon>'; });
    for (let i = 0; i < 6; i++) {
      const edge = point(i, radius, cx, cy, 6), name = point(i, labelRadius, cx, cy, 6);
      svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + edge[0] + '" y2="' + edge[1] + '"></line>' +
        '<text class="axis-label" x="' + name[0] + '" y="' + name[1] + '">' + esc(DIMS[i].slice(0, 2)) + '</text>';
    }
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      if (finite[i] == null || finite[next] == null) continue;
      const from = point(i, radius * clamp(finite[i], 0, 100) / 100, cx, cy, 6);
      const to = point(next, radius * clamp(finite[next], 0, 100) / 100, cx, cy, 6);
      svg += '<line class="data" x1="' + from[0] + '" y1="' + from[1] + '" x2="' + to[0] + '" y2="' + to[1] + '"></line>';
    }
    finite.forEach((value, index) => {
      if (value == null) return;
      const marker = point(index, radius * clamp(value, 0, 100) / 100, cx, cy, 6);
      svg += '<circle class="point" cx="' + marker[0] + '" cy="' + marker[1] + '" r="2"></circle>';
    });
    if (finite.every(value => value == null)) svg += '<text x="75" y="58" text-anchor="middle" fill="#a9b8ab" font-size="8">暂无六维</text>';
    return svg + '<text x="75" y="112" text-anchor="middle" fill="#9aa99c" font-size="6">六维候选画像</text></svg>';
  }

  function compactObjectRadar(item, kind, requestedFormat, enlarged = false, teamContext = null) {
    if (kind === "teams") {
      return compactSixAxisRadar(teamCanRank(item) ? item.overallAssignedDimensions : [], "球队六维候选图：" + fullTeamName(item), enlarged);
    }
    if (item?.isStarPair) {
      const row = standardRow(item, "star");
      const values = ["fastAttack", "ballControl", "lethality", "survival", "control"].map(id => row?.axes?.find(axis => axis.id === id)?.score);
      values.push(row?.adaptability?.score);
      return compactSixAxisRadar(values, "双人组合当前六维：" + item.name, enlarged);
    }
    if (item?.simulated) return compactSixAxisRadar([], "临时模拟档案暂无已验证六维：" + item.name, enlarged);
    const format = kind === "stars" || kind === "star" ? "11s" : requestedFormat === "sevens" ? "sevens" : "11s";
    const roster = kind === "players" && teamContext ? DATA.rosters.find(candidate => candidate.id === teamContext.rosterId) : null;
    const basePosition = roster?.positions?.find(position => position.id === item.positionId || position.name === item.name);
    const contextualPlayer = basePosition ? Object.assign({}, basePosition, item, { positionId: basePosition.id }) : item;
    const contextualRow = roster && basePosition ? rosterPlayerCandidate(contextualPlayer, roster, format) : null;
    const row = contextualRow || CANDIDATE_AXIS_ROWS.find(candidate => candidate.subjectType === (kind === "stars" || kind === "star" ? "star" : "player") &&
      candidate.subjectId === item.id && candidate.format === format);
    if (row) {
      const values = ["fastAttack", "ballControl", "lethality", "survival", "control", "adaptability"].map(axis => row.axisScores?.[axis]);
      return compactSixAxisRadar(values, "Bloodboard V7.0.1 六维任务赋分候选图：" + item.name, enlarged);
    }
    const calibration = item.provisionalCalibrations?.[format === "sevens" ? "sevens" : "standard"];
    return compactSixAxisRadar(calibration?.scores || [], "暂定六维候选图：" + item.name, enlarged);
  }

  function objectVisualPair(item, kind, className = "object-visual-pair", format, teamContext = null) {
    const roster = kind === "players" && teamContext ? DATA.rosters.find(candidate => candidate.id === teamContext.rosterId) : null;
    const basePosition = roster?.positions?.find(position => position.id === item.positionId || position.name === item.name);
    const canonical = kind === "stars" || kind === "star"
      ? DATA.stars.find(person => person.id === item.id)
      : kind === "players" && basePosition
        ? PLAYER_PROFILES.find(person => person.sourceRosters?.includes(teamContext.rosterId) &&
          person.sourcePositionIds?.includes(basePosition.id) && person.name === basePosition.name)
        : null;
    const visualItem = canonical ? Object.assign({}, canonical, item, {
      positionId: basePosition?.id || item.positionId,
      portrait: item.portrait || canonical.portrait || (basePosition && BASE_PORTRAITS[teamContext.rosterId + ":" + basePosition.id]) || ""
    }) : item;
    const imageClass = kind === "teams" ? "object-visual-image team-visual-image" : "object-visual-image";
    const enlarged = className === "matchup-star-visual-pair" || className === "matchup-skill-visual-pair";
    const chart = compactObjectRadar(visualItem, kind, format, enlarged, teamContext);
    return '<span class="' + className + '" aria-label="' + esc((kind === "teams" ? fullTeamName(item) : item.name) + '：图片与六维图') + '">' +
      '<span class="object-visual-photo">' + portraitMark(visualItem, imageClass, "emblem") + '</span>' + chart + '</span>';
  }

  function scoreCells(scores, grades, assignedScores, profileKind = "player") {
    const dimensionLabels = profileKind === "team" ? DIMS : DIMS.slice(0, 5);
    return '<div class="detail-scores">' + dimensionLabels.map((label, i) =>
      '<div class="score-cell"><span class="score-label">' + esc(label) + '</span><span class="score-value"><b>' + esc(scores[i] || 0) + '</b>' +
      (assignedScores ? '<small class="assigned-value">赋 ' + assignedScores[i].toFixed(1) + '</small>' : '') + gradeTag(scoreGrade(grades, i)) + "</span></div>"
    ).join("") + "</div>";
  }

  function playerRoleVector(item) {
    const roles = item && item.scoreBreakdown && item.scoreBreakdown.adaptability && item.scoreBreakdown.adaptability.roles || [];
    if (!roles.length) return "";
    return '<section class="role-vector-panel"><h4>适应力候选 · 个人角色覆盖向量</h4><p>当前仍是旧任务代理中的职责向量展示，不代表正式适应力总分；各职责单独列出任务值与阈值覆盖度。</p><div class="role-vector-grid">' + roles.map(role =>
      '<article><b>' + esc(role.label) + '</b><span>任务值 R ' + Number(role.score).toFixed(1) + '</span><span>单角色覆盖 C ' + Number(role.coverage).toFixed(1) + '%</span><small>可用阈值 ' + Number(role.minimum).toFixed(1) + ' · 可靠阈值 ' + Number(role.reliable).toFixed(1) + '</small></article>'
    ).join("") + '</div><small>阈值只用于解释每种职责自身的可靠程度；五种任务之间的权重尚未校准，因此不生成一个“角色覆盖总分”。</small></section>';
  }

  function assignRankedGrades(items, scoreFor, setGrade) {
    const ordered = items.slice().sort((a, b) => scoreFor(b) - scoreFor(a));
    let start = 0;
    while (start < ordered.length) {
      const score = scoreFor(ordered[start]);
      let end = start + 1;
      while (end < ordered.length && scoreFor(ordered[end]) === score) end++;
      const percentile = (start + end) / (2 * ordered.length);
      const grade = (GRADE_BANDS.find(([, upperBound]) => percentile < upperBound) || GRADE_BANDS[GRADE_BANDS.length - 1])[0];
      ordered.slice(start, end).forEach(item => setGrade(item, grade));
      start = end;
    }
  }

  function rankGrades(items, dimensions = DIMS.map((_, index) => index)) {
    dimensions.forEach(dimension => assignRankedGrades(items,
      item => Number(item.scores && item.scores[dimension]) || 0,
      (item, grade) => {
        item.grades = item.grades || Array(DIMS.length).fill("C");
        item.grades[dimension] = grade;
      }
    ));
  }

  function rankedDimensionScores(items, dimensions = DIMS.map((_, index) => index)) {
    const assignedScores = items.map(() => Array(DIMS.length).fill(0));
    const itemIndexes = new Map(items.map((item, index) => [item, index]));
    dimensions.forEach(dimension => {
      const ordered = items.slice().sort((a, b) =>
        (Number(b.scores && b.scores[dimension]) || 0) - (Number(a.scores && a.scores[dimension]) || 0));
      let start = 0;
      while (start < ordered.length) {
        const score = Number(ordered[start].scores && ordered[start].scores[dimension]) || 0;
        let end = start + 1;
        while (end < ordered.length && (Number(ordered[end].scores && ordered[end].scores[dimension]) || 0) === score) end++;
        const averageRank = (start + 1 + end) / 2;
        const points = ordered.length < 2 ? 100 : 100 * (ordered.length - averageRank) / (ordered.length - 1);
        ordered.slice(start, end).forEach(item => {
          assignedScores[itemIndexes.get(item)][dimension] = points;
        });
        start = end;
      }
    });
    return assignedScores;
  }

  function rankOverall(items) {
    const assignedScores = rankedDimensionScores(items, PLAYER_OVERALL_DIMENSIONS);
    items.forEach((item, index) => {
      item.overallScore = PLAYER_OVERALL_DIMENSIONS.reduce((total, dimension) =>
        total + OVERALL_WEIGHTS[dimension] * (Number(item.scores && item.scores[dimension]) || 0), 0) / PLAYER_WEIGHT_TOTAL;
      item.overallAssignedDimensions = assignedScores[index];
      // Adaptability is a derived/contextual profile, so the personal total
      // uses only the five non-derived task dimensions.
      const weightedRms = Math.sqrt(PLAYER_OVERALL_DIMENSIONS.reduce((total, dimension) =>
        total + OVERALL_WEIGHTS[dimension] * assignedScores[index][dimension] ** 2, 0) / PLAYER_WEIGHT_TOTAL);
      const bestSpecialty = Math.max(...PLAYER_OVERALL_DIMENSIONS.map(dimension => assignedScores[index][dimension]));
      item.overallAssignedScore = (1 - PLAYER_SPECIALIST_SHARE) * weightedRms + PLAYER_SPECIALIST_SHARE * bestSpecialty;
    });
    assignRankedGrades(items, item => item.overallAssignedScore, (item, grade) => { item.overallGrade = grade; });
  }

  function rankTeamOverall(items) {
    items.forEach(item => {
      item.overallScore = TEAM_OVERALL_WEIGHTS.reduce((total, weight, dimension) =>
        total + weight * (Number(item.scores && item.scores[dimension]) || 0), 0);
      // Each source axis is already a ranked player-task score (or a team-task
      // percentile blend for survival/control). Aggregate those points once;
      // re-ranking the six team axes here would amplify tiny cohort differences
      // and double-assign the same evidence before the final team ranking.
      item.overallAssignedDimensions = DIMS.map((_, dimension) =>
        Math.max(0, Math.min(100, Number(item.scores && item.scores[dimension]) || 0)));
      item.overallAssignedScore = TEAM_OVERALL_WEIGHTS.reduce((total, weight, dimension) =>
        total + weight * item.overallAssignedDimensions[dimension], 0);
      item.teamOverallStatus = item.teamStaticEvidence ? "roster-capability-proxy-v3-player-task-static-v6.1" : "roster-capability-proxy-v3-player-task";
    });
    const ordered = items.slice().sort((a, b) => b.overallAssignedScore - a.overallAssignedScore);
    let start = 0;
    while (start < ordered.length) {
      let end = start + 1;
      while (end < ordered.length && ordered[end].overallAssignedScore === ordered[start].overallAssignedScore) end++;
      const rank = (start + 1 + end) / 2;
      ordered.slice(start, end).forEach(item => { item.teamRank = rank; });
      start = end;
    }
    assignRankedGrades(items, item => item.overallAssignedScore,
      (item, grade) => { item.overallGrade = grade; });
  }

  function teamPercentilePoints(items, valueFor) {
    const ordered = items.slice().sort((a, b) => (Number(valueFor(b)) || 0) - (Number(valueFor(a)) || 0));
    const points = new Map();
    let start = 0;
    while (start < ordered.length) {
      let end = start + 1;
      while (end < ordered.length && (Number(valueFor(ordered[end])) || 0) === (Number(valueFor(ordered[start])) || 0)) end++;
      const averageRank = (start + 1 + end) / 2;
      const score = ordered.length < 2 ? 100 : 100 * (ordered.length - averageRank) / (ordered.length - 1);
      ordered.slice(start, end).forEach(item => points.set(item.id, score));
      start = end;
    }
    return points;
  }

  function teamStaticTaskMeasures(record) {
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const survival = mean(policies.map(policy => {
      const metrics = record.baseline.byRerollPolicy[policy];
      return 0.5 * (metrics.targetStandingWithTackleZone.value + metrics.targetRemainsOnPitch.value) * 100;
    }));
    const coverage = mean(policies.map(policy => record.baseline.byRerollPolicy[policy].expectedUniqueTackleZoneSquares.value));
    return { survival, coverage };
  }

  function teamStaticStrengthEffect(record) {
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const averageDelta = metric => policies.reduce((total, policy) => {
      const baseline = record.baseline.byRerollPolicy[policy][metric]?.value;
      const allST3 = record.allST3Counterfactual.byRerollPolicy[policy][metric]?.value;
      return total + (Number(baseline) - Number(allST3));
    }, 0) / policies.length;
    return {
      controlSquares: averageDelta("expectedUniqueTackleZoneSquares"),
      controlStanding: averageDelta("targetStandingWithTackleZone"),
      survivalStanding: averageDelta("targetStandingWithTackleZone"),
      survivalOnPitch: averageDelta("targetRemainsOnPitch")
    };
  }

  // Same-roster ST3 ablation isolates the contribution of roster Strength
  // under the V6.1 fixed-pressure task. Award only above-median contribution
  // and cap the uplift at 25 points; teams with no such benefit keep their
  // player/task scores unchanged instead of receiving a Strength penalty.
  const TEAM_STRENGTH_BONUS_PER_PERCENTILE_POINT = 0.5;
  function strengthRetentionBonus(percentile) {
    return Math.min(25, Math.max(0, (Number(percentile) || 0) - 50) * TEAM_STRENGTH_BONUS_PER_PERCENTILE_POINT);
  }

  function teamStaticStrengthControlChange(record) {
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const average = (scenario, metric) => policies.reduce((total, policy) =>
      total + record[scenario].byRerollPolicy[policy][metric].value, 0) / policies.length;
    return {
      coveredSquares: average("baseline", "expectedUniqueTackleZoneSquares") - average("allST3Counterfactual", "expectedUniqueTackleZoneSquares"),
      standingWithZonePp: (average("baseline", "targetStandingWithTackleZone") - average("allST3Counterfactual", "targetStandingWithTackleZone")) * 100
    };
  }

  function teamLegality(team) {
    if (team.simulated) return { status: "simulation-unverified", valid: false, reason: ["当前阵容含临时编辑；基准名单的 V7.0.1 校验结果不能证明模拟阵容合法。"] };
    return window.BB_TEAM_LEGALITY_V701?.[team.id] || { status: "missing-evidence", valid: false, reason: [] };
  }

  const teamCanRank = team => teamLegality(team).status === "valid";

  function renderTeamRosterAdjustment(team) {
    const adjustment = team.rosterAdjustment;
    if (!adjustment) return "";
    const detail = adjustment.kind === "tier-budget"
      ? '原购入技能：' + adjustment.removedSkill + '（球员 #' + adjustment.playerNumber + '）；技能点 ' + adjustment.originalSpent + ' → Tier 上限 ' + adjustment.allowed + '。被移除技能已记入修正记录，原构筑可按记录恢复为模拟备选。'
      : adjustment.kind === "profile-correction"
        ? '球员 #' + adjustment.playerNumber + '：' + adjustment.skill + ' ' + adjustment.from + '+ → ' + adjustment.to + '+。'
        : '球员 #' + adjustment.playerNumber + ' 指定为 Veteran，MA 应用 −1。';
    return '<details class="team-impact-details"><summary>查看 V7.0.1 参考名单修正</summary><p>' + esc(adjustment.reason) + '</p><small>' + esc(detail) + '</small></details>';
  }

  function teamRadar(team) {
    const axes = DIMS;
    const rankable = teamCanRank(team);
    const values = rankable ? (team.overallAssignedDimensions || Array(6).fill(0)) : [];
    const cx = 180, cy = 145, radius = 88;
    let svg = '<svg class="radar canonical-radar" viewBox="0 0 360 286" role="img" aria-label="球队六维实验标定雷达；赛制内排序赋分，队伍构筑规则状态见说明">';
    [20,40,60,80,100].forEach(level => { svg += '<polygon class="grid" points="' + polygonPoints(Array(6).fill(level), radius, cx, cy) + '"></polygon>'; });
    axes.forEach((axis, i) => {
      const edge = point(i, radius, cx, cy), label = point(i, 119, cx, cy);
      svg += '<line class="axis" x1="' + cx + '" y1="' + cy + '" x2="' + edge[0] + '" y2="' + edge[1] + '"></line><text class="axis-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(axis) + '</text>';
    });
    if (rankable) svg += '<polygon class="data" points="' + polygonPoints(values, radius, cx, cy) + '"></polygon>';
    values.forEach((value, i) => {
      const p = point(i, radius * Math.max(0, Math.min(100, value)) / 100, cx, cy);
      const label = point(i, Math.min(radius + 10, radius * value / 100 + 10), cx, cy);
      svg += '<circle class="point" cx="' + p[0] + '" cy="' + p[1] + '" r="3"></circle><text class="value-label" x="' + label[0] + '" y="' + label[1] + '">' + esc(scoreGrade(team.grades, i)) + '</text>';
    });
    if (!rankable) svg += '<text x="180" y="145" text-anchor="middle" fill="#e7c876" font-size="12">構築需修正 · 暂不排名</text>';
    return svg + '<text x="180" y="277" text-anchor="middle" fill="#e7c876" font-size="9">阵容能力代理 · 同赛制排名赋分 · 暂定</text></svg>';
  }

  function teamScoreCells(team) {
    const labels = DIMS;
    const legality = teamLegality(team);
    const rankable = legality.status === "valid";
    const legalityLabel = legality.status === "valid" ? "V7.0.1 校验通过" : legality.status === "invalid" ? "V7.0.1 校验未通过" : legality.status === "needs-setup" ? "V7.0.1 待补配置" : legality.status === "simulation-unverified" ? "临时模拟未校验" : "V7.0.1 缺少校验记录";
    const axisHtml = labels.map((label, i) => {
      const evidence = team.teamStaticEvidence;
      const playerAxis = team.teamPlayerTaskEvidence?.axes?.[i];
      const evidenceNote = playerAxis ? '<small>入选球员任务画像 ' + playerAxis.matchedProfiles + '/' + playerAxis.profileCount + ' · 指数衰减阵容汇总</small>' : '';
      const teamTaskNote = evidence?.percentileParts && i === 3 ? '<small>球员阵容任务 ' + evidence.percentileParts.survivalProxy.toFixed(1) + ' · V6.1 整队留场 ' + evidence.percentileParts.survivalTask.toFixed(1) + '</small>' : evidence?.percentileParts && i === 4 ? '<small>球员阵容任务 ' + evidence.percentileParts.controlProxy.toFixed(1) + ' · V6.1 整队控区 ' + evidence.percentileParts.controlTask.toFixed(1) + '</small>' : '';
      const strengthControl = evidence?.record && i === 4 ? teamStaticStrengthControlChange(evidence.record) : null;
      const strengthNote = strengthControl ? '<small>当前力量对照同名单全 ST3：控制格差值 ' + (strengthControl.coveredSquares >= 0 ? '+' : '−') + Math.abs(strengthControl.coveredSquares).toFixed(2) + ' 格；受击者站立留区差 ' + (strengthControl.standingWithZonePp >= 0 ? '+' : '−') + Math.abs(strengthControl.standingWithZonePp).toFixed(2) + ' 个百分点</small>' : '';
      const strengthBonus = evidence?.percentileParts && (i === 3 || i === 4)
        ? '<small>同名单全 ST3 反事实力量贡献：+' + (i === 3 ? evidence.percentileParts.survivalStrengthBonus : evidence.percentileParts.controlStrengthBonus).toFixed(1) + ' 分（对应贡献名次点 ' + (i === 3 ? evidence.percentileParts.survivalStrengthPercentile : evidence.percentileParts.controlStrengthPercentile).toFixed(1) + '）</small>'
        : '';
      return '<div class="score-cell"><span class="score-label">' + esc(label) + '</span><span class="score-value"><b>' + (Number(team.scores?.[i]) || 0).toFixed(1) + '</b><small>' + (rankable ? '已赋分的球员/团队任务汇总 · 总评输入 ' + (Number(team.overallAssignedDimensions?.[i]) || 0).toFixed(1) : '构筑修正后再比较') + '</small>' + evidenceNote + teamTaskNote + strengthNote + strengthBonus + (rankable ? gradeTag(scoreGrade(team.grades, i)) : '<span class="ranking-grade-placeholder">—</span>') + '</span></div>';
    }).join('');
    const total = rankable
      ? '球队实验总评 ' + esc(team.overallGrade || '—') + ' · ' + team.overallAssignedScore.toFixed(1) + ' 赋分 · ' + (Number.isInteger(team.teamRank) ? '第 ' + team.teamRank : '并列第 ' + team.teamRank) + ' 名'
      : '球队评级暂缓 · 该参考阵容需先通过 V7.0.1 校验';
    return '<div class="detail-scores canonical-scores">' + axisHtml + '</div><p class="canonical-profile-note"><b>' + total + '</b>。' + (rankable ? '球队六维总评直接按上述已赋分的任务汇总值计算，不再对六个球队维度重复排名赋分；最终球队总评再于同赛制队伍中排名定级。快攻、控球、杀伤、生存、控场由同赛制 V7.0.1 同条件球员任务排名点按各轴最佳 11/7 人汇总，名次贡献按 e^(−0.38×序位) 衰减；阵容专属购入技能与属性变动用旧规则公式的个人边际差作暂定修正。生存、控场的基础值分别是球员阵容任务分与 V6.1 整队受击留场/静态控区任务同赛制名次点的均值；之后另计同名单全 ST3 反事实力量贡献：将控制格增量、站立率增量与留场率增量分别按赛制内名次赋分，合成后每高于中位 1 点加 0.5 分，单轴最多 +25，低于中位不倒扣。适应力 = 50% 角色覆盖 + 50% 队伍贡献，纳入五类角色；角色覆盖以至少一名球员达到 50 个同条件任务排名点计为可用，队伍贡献为低人数阵容保留的五类角色任务总能力占完整阵容的比例。' : '当前显示的轴值仅供检查原始阵容输入，不参与球队名次或等级。') + '构筑状态：' + esc(legalityLabel) + '。球队分仍是实验比较指数，并非胜率。' + (legality.reason?.length ? '<details><summary>查看 V7.0.1 校验条件/问题</summary><small>' + esc(legality.reason.join('；')) + '</small></details>' : '') + '</p>';
  }

  function rankCoachStrength(items) {
    const ordered = items.slice().sort((a, b) => b.coachEvaluation.realizedStrength - a.coachEvaluation.realizedStrength);
    let start = 0;
    while (start < ordered.length) {
      const score = ordered[start].coachEvaluation.realizedStrength;
      let end = start + 1;
      while (end < ordered.length && ordered[end].coachEvaluation.realizedStrength === score) end++;
      const averageRank = (start + 1 + end) / 2;
      const points = ordered.length < 2 ? 100 : 100 * (ordered.length - averageRank) / (ordered.length - 1);
      ordered.slice(start, end).forEach(team => {
        team.coachAssignedScore = points;
        team.coachRank = averageRank;
      });
      start = end;
    }
    assignRankedGrades(items, team => team.coachEvaluation.realizedStrength, (team, grade) => { team.coachGrade = grade; });
  }

  function profileSignature(person) {
    const keywords = Array.from(person.keywords || []).sort();
    const skills = Array.from(person.skills || [], skill => [skill.id, skill.value == null ? null : skill.value])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify([
      person.name, person.ma, person.st, person.ag, person.pa, person.av,
      person.cost, keywords, skills
    ]);
  }

  function createUniqueProfiles() {
    const bySignature = new Map();
    const byRosterPosition = new Map();
    DATA.rosters.forEach(roster => (roster.positions || []).forEach(basePlayer => {
      const player = Object.assign({}, basePlayer, { positionId: basePlayer.id, color: roster.color, appearances: [], descriptionVariants: [], sourceRosters: [] });
      const signature = profileSignature(player);
      let profile = bySignature.get(signature);
      if (!profile) {
        profile = Object.assign(player, {
          id: "profile-" + bySignature.size,
          portrait: BASE_PORTRAITS[roster.id + ":" + basePlayer.id] || basePlayer.portrait || "",
          sourcePositionIds: [],
          sourceRosters: []
        });
        bySignature.set(signature, profile);
      }
      if (!profile.portrait) profile.portrait = BASE_PORTRAITS[roster.id + ":" + basePlayer.id] || basePlayer.portrait || "";
      if (!profile.sourceRosters.includes(roster.id)) profile.sourceRosters.push(roster.id);
      if (!profile.sourcePositionIds.includes(basePlayer.id)) profile.sourcePositionIds.push(basePlayer.id);
      if (basePlayer.description && !profile.descriptionVariants.some(row => row.text === basePlayer.description)) {
        profile.descriptionVariants.push({ text: basePlayer.description, teamName: roster.name });
      }
      byRosterPosition.set(roster.id + ":" + basePlayer.id, profile);
    }));
    DATA.rosters.forEach(roster => {
      const rosterTeams = DATA.teams.filter(team => team.rosterId === roster.id);
      (roster.positions || []).forEach(basePlayer => {
        const profile = byRosterPosition.get(roster.id + ":" + basePlayer.id);
        if (!profile) return;
        rosterTeams.forEach(team => {
          const selectedCount = team.players.filter(person => person.positionId === basePlayer.id).length;
          profile.appearances.push({
            teamId: team.id, teamName: fullTeamName(team), searchName: team.name, rosterName: team.rosterName, format: team.format,
            formatName: team.formatName, leagueNames: team.leagueNames, selectedCount
          });
        });
      });
    });
    return Array.from(bySignature.values());
  }

  function collapseBasePlayerNameVariants(profiles) {
    const groups = new Map();
    profiles.forEach(profile => {
      const key = String(profile.name || "").normalize("NFKC").trim().toLocaleLowerCase();
      const rows = groups.get(key) || [];
      rows.push(profile);
      groups.set(key, rows);
    });
    return Array.from(groups.values()).map(rows => {
      const ordered = rows.slice().sort((a, b) => {
        const skillDelta = (a.skills || []).length - (b.skills || []).length;
        if (skillDelta) return skillDelta;
        const rosterDelta = (b.sourceRosters || []).length - (a.sourceRosters || []).length;
        return rosterDelta || String(a.id).localeCompare(String(b.id));
      });
      const preferred = ordered[0];
      const appearances = new Map();
      rows.flatMap(profile => profile.appearances || []).forEach(entry => {
        const current = appearances.get(entry.teamId);
        if (!current) appearances.set(entry.teamId, Object.assign({}, entry));
        else current.selectedCount += Number(entry.selectedCount) || 0;
      });
      return Object.assign({}, preferred, {
        sourceRosters: [...new Set(rows.flatMap(profile => profile.sourceRosters || []))],
        sourcePositionIds: [...new Set(rows.flatMap(profile => profile.sourcePositionIds || [profile.positionId]))],
        appearances: Array.from(appearances.values()),
        descriptionVariants: rows.flatMap(profile => profile.descriptionVariants || [])
      });
    });
  }

  const PLAYER_PROFILES = createUniqueProfiles();
  function attachProvisionalCalibration(person) {
    const records = window.BB_PROVISIONAL_CALIBRATION_V336?.records || {};
    const signature = window.BB_TASK_RANKINGS?.signature?.(person);
    const matchingRecord = format => {
      const record = records[person.id + '|' + format];
      return record && signature && record.profileSignature === signature ? record : null;
    };
    person.provisionalCalibrations = {
      standard: matchingRecord('11s'),
      sevens: matchingRecord('sevens')
    };
    return person;
  }
  [...PLAYER_PROFILES, ...DATA.stars.filter(star => !star.isStarPair)].forEach(person => {
    const calculated = SCORING.scorePlayer(person);
    person.scores = calculated.scores;
    person.scoreBreakdown = calculated.breakdown;
    attachProvisionalCalibration(person);
  });
  const PLAYER_CATALOG_PROFILES = collapseBasePlayerNameVariants(PLAYER_PROFILES);
  const currentPlayerCatalog = () => standardMode() ? PLAYER_PROFILES : PLAYER_CATALOG_PROFILES;
  const playersAndStars = PLAYER_CATALOG_PROFILES.concat(DATA.stars.filter(star => !star.isStarPair));
  rankGrades(playersAndStars, PLAYER_OVERALL_DIMENSIONS);
  rankOverall(playersAndStars);

  function templateSlots(person, team) {
    if (!person || !team || !person.sourceRosters.includes(team.rosterId)) return [];
    const positionIds = new Set(person.sourcePositionIds || [person.positionId]);
    return team.players.filter(player => positionIds.has(player.positionId));
  }

  function editedTeamPlayer(player, editor) {
    if (!editor || !editor.applied) return player;
    return Object.assign({}, player, editor.stats, {
      skills: editor.skills.map(skill => Object.assign({}, skill)),
      boughtSkill: ""
    });
  }

  let teamCacheKey = "";
  let teamCache = [];
  let starTeamFitCacheKey = "";
  const starTeamFitCache = new Map();
  const teamSkillUpgradeCache = new Map();
  const CANDIDATE_AXIS_KEYS = ["fastAttack", "ballControl", "lethality", "survival", "control"];
  const CANDIDATE_AXIS_ROWS = (window.BB_SIX_AXIS_CANDIDATE_V413 || window.BB_SIX_AXIS_CANDIDATE_V412 || window.BB_SIX_AXIS_CANDIDATE_V411)?.dossiers || [];
  const candidateSkillKey = skills => (skills || []).map(skill => typeof skill === "string" ? skill : skill.id).filter(Boolean).sort().join("|");
  const playerCandidateRows = CANDIDATE_AXIS_ROWS.filter(row => row.subjectType === "player");
  const starCandidateRows = new Map(CANDIDATE_AXIS_ROWS.filter(row => row.subjectType === "star").map(row =>
    [(row.starId || row.subjectId) + "|" + row.format, row]));
  function rosterPlayerCandidate(player, roster, format) {
    const base = (roster?.positions || []).find(position => position.id === player.positionId);
    if (!base) return null;
    const expectedSkills = candidateSkillKey(base.skills);
    return playerCandidateRows.find(row => row.format === (format === "sevens" ? "sevens" : "11s") &&
      row.profile?.name === base.name && (row.profile.sourceRosters || []).includes(roster.id) &&
      candidateSkillKey(row.profile.skills) === expectedSkills) || null;
  }
  function teamPlayerTaskAggregation(players, team, options = {}) {
    const roster = DATA.rosters.find(row => row.id === team.rosterId);
    const limit = team.format === "sevens" ? 7 : 11;
    const requiredIds = new Set((options.requiredPlayerIds || []).map(String));
    const legacy = players.map(player => ({ player, scores: SCORING.scorePlayer(player).scores }));
    const scored = legacy.map(({ player, scores: legacyScores }) => {
      const starRow = starCandidateRows.get(player.id + "|" + (team.format === "sevens" ? "sevens" : "11s"));
      const row = starRow || rosterPlayerCandidate(player, roster, team.format);
      const base = roster && (roster.positions || []).find(position => position.id === player.positionId);
      const baseScores = base ? SCORING.scorePlayer(base).scores : legacyScores;
      const noBall = (player.skills || []).some(skill => (typeof skill === "string" ? skill : skill.id) === "noBall");
      const axisScores = CANDIDATE_AXIS_KEYS.map((axis, index) => {
        if (noBall && index < 2) return 0;
        const candidateScore = Number(row?.axisScores?.[axis]);
        if (!Number.isFinite(candidateScore)) return Number(legacyScores[index]) || 0;
        // Keep the V7.0.1 same-task player rank points, then apply any roster-only
        // purchase, legal format adjustment, or temporary edit as an explicit
        // legacy marginal proxy. The task score itself is never relabeled as a
        // new Bloodboard probability.
        return Math.max(0, Math.min(100, candidateScore + (Number(legacyScores[index]) || 0) - (Number(baseScores[index]) || 0)));
      });
      return { player, row, axisScores };
    });
    const requiredEntries = scored.filter(entry => requiredIds.has(String(entry.player.id)));
    if (requiredEntries.length !== requiredIds.size) throw new Error("Required star player(s) must be present in the candidate roster.");
    if (requiredEntries.length > limit) throw new RangeError("Required star bundle exceeds the active lineup limit.");
    const weights = Array.from({ length: limit }, (_, rank) => Math.exp(-0.38 * rank));
    const axes = CANDIDATE_AXIS_KEYS.map((axis, index) => {
      const optional = scored.filter(entry => !requiredIds.has(String(entry.player.id)))
        .sort((a, b) => b.axisScores[index] - a.axisScores[index]);
      // A recommended Star Player must actually occupy one of the active slots.
      // Sorting and slicing the combined list used to silently drop a weaker star.
      const selected = requiredEntries.concat(optional.slice(0, Math.max(0, limit - requiredEntries.length)))
        .sort((a, b) => b.axisScores[index] - a.axisScores[index]);
      const value = selected.reduce((sum, entry, rank) => sum + entry.axisScores[index] * weights[rank], 0) /
        weights.reduce((sum, weight) => sum + weight, 0);
      return {
        score: value,
        selected: selected.map(entry => ({ id: entry.player.id, name: entry.player.name, score: entry.axisScores[index], basis: entry.row?.scoreBasis?.[axis] || "legacy-profile-fallback" })),
        matchedProfiles: selected.filter(entry => entry.row).length,
        profileCount: selected.length
      };
    });
    // The sixth team axis is roster-specific: measure whether role-task
    // capability survives the loss of an active player, with the remaining
    // legal roster allowed to take over. Use the same ranked role evidence as
    // the player dossiers where available; keep V410 role values explicitly
    // tagged for gaps (currently screen protection and small cohorts).
    const teamRoles = [
      { id: "carrierProgression", label: "持球推进", legacyIndex: 0 },
      { id: "scoringReception", label: "得分接应", legacyIndex: 1 },
      { id: "stableBlitzer", label: "稳定突袭", legacyIndex: 2 },
      { id: "screenProtector", label: "封路保护", legacyIndex: 3 },
      { id: "openingSupport", label: "开路支援", legacyIndex: 4 }
    ];
    const roleEntries = players.map(player => {
      const starRow = starCandidateRows.get(player.id + "|" + (team.format === "sevens" ? "sevens" : "11s"));
      const taskProfile = scored.find(entry => entry.player === player);
      const row = starRow || taskProfile?.row || rosterPlayerCandidate(player, roster, team.format);
      const base = roster && (roster.positions || []).find(position => position.id === player.positionId);
      const current = SCORING.scorePlayer(player);
      const baseRoles = base ? SCORING.scorePlayer(base).breakdown.adaptability.roles : [];
      const legacyRoles = current.breakdown.adaptability.roles || [];
      const byId = new Map((row?.adaptabilityDetail?.roleScores || []).map(role => [role.id, role]));
      const noBall = (player.skills || []).some(skill => (typeof skill === "string" ? skill : skill.id) === "noBall");
      const roleValues = teamRoles.map(role => {
        if (noBall && (role.id === "carrierProgression" || role.id === "scoringReception")) {
          return { score: 0, status: "not-applicable-no-ball", source: "规则不适用：No Ball" };
        }
        const candidate = byId.get(role.id);
        const legacy = legacyRoles[role.legacyIndex];
        const ordinary = baseRoles[role.legacyIndex];
        if (candidate && Number.isFinite(Number(candidate.score))) {
          const adjustment = base && legacy && ordinary ? Number(legacy.score) - Number(ordinary.score) : 0;
          const candidateStatus = candidate.status || row?.adaptabilityDetail?.roleStatus?.[role.id] || "";
          const candidateSource = candidate.source || "";
          const exactV7 = candidateStatus.startsWith("v7-") && candidateSource.includes("Bloodboard V7.0.1");
          return {
            score: Math.max(0, Math.min(100, Number(candidate.score) + adjustment)),
            status: exactV7 ? candidateStatus : "legacy-fallback",
            source: exactV7 ? candidateSource : (candidateSource || "V410 角色代理")
          };
        }
        return {
          score: Number(legacy?.score) || 0,
          status: "legacy-fallback",
          source: "V410 角色代理"
        };
      });
      const axisScore = taskProfile?.axisScores || [];
      return { player, row, roleValues, axisScore };
    });
    const roleTasks = (eligible, activeLimit = limit) => teamRoles.map((_, roleIndex) => {
      const required = eligible.filter(entry => requiredIds.has(String(entry.player.id)));
      if (required.length > activeLimit) throw new RangeError("Required star bundle exceeds a role task's active lineup limit.");
      const optional = eligible.filter(entry => !requiredIds.has(String(entry.player.id)))
        .sort((a, b) => b.roleValues[roleIndex].score - a.roleValues[roleIndex].score);
      const ordered = required.concat(optional.slice(0, Math.max(0, activeLimit - required.length)))
        .sort((a, b) => b.roleValues[roleIndex].score - a.roleValues[roleIndex].score);
      const weights = Array.from({ length: activeLimit }, (_, rank) => Math.exp(-0.38 * rank));
      return ordered.reduce((sum, entry, rank) => sum + entry.roleValues[roleIndex].score * weights[rank], 0) /
        weights.reduce((sum, weight) => sum + weight, 0);
    });
    const roleBaseline = roleTasks(roleEntries);
    const roleRequired = roleEntries.filter(entry => requiredIds.has(String(entry.player.id)));
    const roleOptional = roleEntries.filter(entry => !requiredIds.has(String(entry.player.id)));
    const priorityValue = entry => {
      const weights = [0.22, 0.18, 0.16, 0.15, 0.15];
      return entry.axisScore.reduce((sum, score, index) => sum + score * weights[index], 0) /
        weights.slice(0, entry.axisScore.length).reduce((sum, weight) => sum + weight, 0);
    };
    const orderedLineup = roleRequired.concat(roleOptional.slice().sort((a, b) => priorityValue(b) - priorityValue(a))
      .slice(0, Math.max(0, limit - roleRequired.length))).slice(0, limit);
    const lowPlayerTargets = team.format === "sevens" ? [4, 5] : [6, 7];
    const lowRosterScenarios = lowPlayerTargets.map(targetCount => {
      const availableCount = Math.min(targetCount, orderedLineup.length);
      const lowRequired = roleRequired.filter(entry => orderedLineup.includes(entry)).slice(0, availableCount);
      const lowOptional = orderedLineup.filter(entry => !requiredIds.has(String(entry.player.id)))
        .sort((a, b) => priorityValue(b) - priorityValue(a))
        .slice(0, Math.max(0, availableCount - lowRequired.length));
      const lowLineup = lowRequired.concat(lowOptional).slice(0, availableCount);
      const lowTasks = roleTasks(lowLineup, availableCount);
      const retainedByRole = lowTasks.map((value, roleIndex) => roleBaseline[roleIndex] > 0
        ? Math.max(0, Math.min(100, 100 * value / roleBaseline[roleIndex]))
        : 100);
      return {
        targetCount,
        availableCount,
        retainedByRole: retainedByRole.map(value => Math.round(value * 10) / 10),
        retainedOverall: roleBaseline.reduce((sum, value) => sum + value, 0) > 0
          ? Math.max(0, Math.min(100, 100 * lowTasks.reduce((sum, value) => sum + value, 0) /
            roleBaseline.reduce((sum, value) => sum + value, 0)))
          : 100,
        playerNames: Array.from(lowLineup.reduce((counts, entry) => {
          counts.set(entry.player.name, (counts.get(entry.player.name) || 0) + 1);
          return counts;
        }, new Map()), ([name, count]) => count > 1 ? name + " × " + count : name)
      };
    });
    const roleRetained = teamRoles.map((_, roleIndex) => lowRosterScenarios.reduce((sum, scenario) =>
      sum + scenario.retainedByRole[roleIndex], 0) / Math.max(1, lowRosterScenarios.length));
    const roleCoverageCount = teamRoles.filter((_, roleIndex) => roleEntries.some(entry =>
      entry.roleValues[roleIndex].status !== "not-applicable-no-ball" && entry.roleValues[roleIndex].score >= 50)).length;
    const roleCoverageScore = 100 * roleCoverageCount / teamRoles.length;
    const teamContributionScore = lowRosterScenarios.reduce((sum, scenario) => sum + scenario.retainedOverall, 0) /
      Math.max(1, lowRosterScenarios.length);
    const adaptabilityScore = (roleCoverageScore + teamContributionScore) / 2;
    const adaptability = {
      score: Math.round(adaptabilityScore * 10) / 10,
      roleCoverageScore: Math.round(roleCoverageScore * 10) / 10,
      roleCoverageCount,
      roleCoverageTotal: teamRoles.length,
      teamContributionScore: Math.round(teamContributionScore * 10) / 10,
      method: `适应力 = 50% 角色覆盖 + 50% 队伍贡献。角色覆盖为五类职责中至少有一名同条件任务排名点达到 50 的职责比例；队伍贡献为低人数候选阵容保留的五类角色任务总能力 ÷ 完整名单角色任务总能力。${team.format === "sevens" ? "七人制比较 4/5 人" : "十一人制比较 6/7 人"}；候选阵容从优先上场名单按前五维加权重组。V7 已覆盖任务优先，缺项显式沿用 V410 代理；50 点阈值与等权合成是待校准的明确暂定值。`,
      lowRosterScenarios,
      roles: teamRoles.map((role, roleIndex) => ({
        id: role.id,
        label: role.label,
        baseline: Math.round(roleBaseline[roleIndex] * 10) / 10,
        retained: Math.round(roleRetained[roleIndex] * 10) / 10,
        v7TaskCount: roleEntries.filter(entry => entry.roleValues[roleIndex].status.startsWith("v7-")).length,
        legacyFallbackCount: roleEntries.filter(entry => entry.roleValues[roleIndex].status === "legacy-fallback").length,
        notApplicableCount: roleEntries.filter(entry => entry.roleValues[roleIndex].status === "not-applicable-no-ball").length,
        sources: [...new Set(roleEntries.map(entry => entry.roleValues[roleIndex].source))]
      }))
    };
    return {
      scores: axes.map(axis => Math.round(axis.score * 10) / 10).concat(adaptability.score),
      axes,
      adaptability,
      method: `前五维分别选取该队最佳 ${limit} 人；使用 V7.0.1 同赛制任务排名点并按 e^(−0.38×序位) 汇总，缺项使用明确标记的 V410 代理。适应力纳入五类角色，以角色覆盖和低人数阵容任务能力保持率各 50% 合成；阵容专属属性/技能调整沿用同位置旧公式边际值。`
    };
  }
  function computedTeams() {
    const activeEdit = state.editor && state.editor.applied && !state.editor.isStar ? state.editor : null;
    const cacheKey = JSON.stringify({ coachSkill: state.coachSkill, edit: activeEdit ? { profileId: activeEdit.profileId, teamId: activeEdit.teamId, slotId: activeEdit.slotId, stats: activeEdit.stats, skills: activeEdit.skills } : null });
    if (cacheKey === teamCacheKey) return teamCache;
    const teams = DATA.teams.map(team => {
      const editor = activeEdit && activeEdit.teamId === team.id ? activeEdit : null;
      const players = team.players.map(player => editedTeamPlayer(player, editor && player.id === editor.slotId ? editor : null));
      const roster = DATA.rosters.find(item => item.id === team.rosterId);
      const ordinaryByPosition = Object.fromEntries((roster && roster.positions || []).map(player => [player.id, player]));
      const evaluation = SCORING.teamScores(players, team.format, ordinaryByPosition);
      const playerTaskAggregation = teamPlayerTaskAggregation(players, team);
      const computed = Object.assign({}, team, {
        players,
        simulated: Boolean(editor),
        scores: evaluation.scores.map((score, index) => index < 5 ? playerTaskAggregation.scores[index] : index === 5 ? playerTaskAggregation.scores[5] : score),
        rawScores: evaluation.rawScores.map((score, index) => index < 5 ? playerTaskAggregation.scores[index] : index === 5 ? playerTaskAggregation.scores[5] : score),
        teamPlayerTaskEvidence: playerTaskAggregation,
        teamKillProfile: evaluation.killProfile,
        teamRosterSelection: evaluation.rosterSelection,
        playerImportance: evaluation.playerImportance,
        teamAdaptability: evaluation.adaptability,
        candidateTeamAdaptability: playerTaskAggregation.adaptability
      });
      const staticEvidence = !editor ? window.BB_TEAM_STRENGTH_CONTEXT_V416?.results.find(row => row.teamId === team.id) : null;
      if (staticEvidence && staticEvidence.baseline?.engineSha256 === window.BB_BLOODBOARD_ENGINE?.META?.sha256) {
        computed.teamStaticEvidence = teamStaticTaskMeasures(staticEvidence);
        computed.teamStaticEvidence.strengthEffect = teamStaticStrengthEffect(staticEvidence);
        computed.teamStaticEvidence.record = staticEvidence;
        computed.teamStaticEvidence.source = "Bloodboard V6.1 · 固定 ST4 相邻阻挡压力集";
        computed.teamStaticEvidence.baselineRawScores = evaluation.scores.slice();
      }
      computed.coachEvaluation = COACH_MODEL.evaluateCoachSkill(computed, { coachSkill: state.coachSkill, format: team.format });
      return computed;
    });
    const groups = new Map();
    teams.forEach(team => {
      if (!groups.has(team.format)) groups.set(team.format, []);
      groups.get(team.format).push(team);
    });
    groups.forEach(group => {
      const eligible = group.filter(teamCanRank);
      const excluded = group.filter(team => !teamCanRank(team));
      const withStaticEvidence = eligible.filter(team => team.teamStaticEvidence);
      if (withStaticEvidence.length === eligible.length && eligible.length > 1) {
        const dynamicSurvival = teamPercentilePoints(eligible, team => team.scores[3]);
        const taskSurvival = teamPercentilePoints(eligible, team => team.teamStaticEvidence.survival);
        const dynamicControl = teamPercentilePoints(eligible, team => team.scores[4]);
        const taskControl = teamPercentilePoints(eligible, team => team.teamStaticEvidence.coverage);
        const controlAreaStrength = teamPercentilePoints(eligible, team => team.teamStaticEvidence.strengthEffect.controlSquares);
        const controlStandingStrength = teamPercentilePoints(eligible, team => team.teamStaticEvidence.strengthEffect.controlStanding);
        const survivalStandingStrength = teamPercentilePoints(eligible, team => team.teamStaticEvidence.strengthEffect.survivalStanding);
        const survivalOnPitchStrength = teamPercentilePoints(eligible, team => team.teamStaticEvidence.strengthEffect.survivalOnPitch);
        eligible.forEach(team => {
          const controlStrengthPercentile = (controlAreaStrength.get(team.id) + controlStandingStrength.get(team.id)) / 2;
          const survivalStrengthPercentile = (survivalStandingStrength.get(team.id) + survivalOnPitchStrength.get(team.id)) / 2;
          const survivalBase = (dynamicSurvival.get(team.id) + taskSurvival.get(team.id)) / 2;
          const controlBase = (dynamicControl.get(team.id) + taskControl.get(team.id)) / 2;
          team.teamStaticEvidence.percentileParts = {
            survivalProxy: dynamicSurvival.get(team.id),
            survivalTask: taskSurvival.get(team.id),
            controlProxy: dynamicControl.get(team.id),
            controlTask: taskControl.get(team.id),
            survivalStrengthPercentile,
            controlStrengthPercentile,
            survivalStrengthBonus: strengthRetentionBonus(survivalStrengthPercentile),
            controlStrengthBonus: strengthRetentionBonus(controlStrengthPercentile)
          };
          team.scores[3] = Math.min(100, survivalBase + team.teamStaticEvidence.percentileParts.survivalStrengthBonus);
          team.scores[4] = Math.min(100, controlBase + team.teamStaticEvidence.percentileParts.controlStrengthBonus);
          team.teamOverallStatus = "roster-capability-proxy-v3-player-task-static-v6.1";
        });
      }
      rankGrades(eligible);
      rankTeamOverall(eligible);
      rankCoachStrength(eligible);
      excluded.forEach(team => {
        team.teamOverallStatus = "roster-capability-proxy-v3-player-task";
        team.grades = Array(DIMS.length).fill("");
        team.overallGrade = "";
        team.overallScore = null;
        team.overallAssignedDimensions = null;
        team.overallAssignedScore = null;
        team.teamRank = null;
        team.coachGrade = "";
        team.coachRank = null;
      });
    });
    teamCacheKey = cacheKey;
    teamCache = teams;
    return teamCache;
  }

  function starTeamBundle(star) {
    if (star.isStarPair) return star.members;
    const pair = star.pair && DATA.stars.find(candidate => candidate.id === star.pair);
    return pair ? [star, pair] : [star];
  }
  function currentStar(id) {
    return DATA.stars.find(star => star.id === id || star.isStarPair && star.members.some(member => member.id === id || 'star-' + member.id === id));
  }

  function starTeamFit(star, leagueFilter = rankingState.leagues, formatFilter = rankingState.format) {
    if (teamCacheKey !== starTeamFitCacheKey) {
      starTeamFitCache.clear();
      starTeamFitCacheKey = teamCacheKey;
    }
    const leagueFilters = Array.isArray(leagueFilter) ? leagueFilter : leagueFilter ? [leagueFilter] : [];
    const fitCacheKey = [star.id, leagueFilters.join(",") || "*", formatFilter || "*"].join("|");
    if (starTeamFitCache.has(fitCacheKey)) return starTeamFitCache.get(fitCacheKey);

    const bundle = starTeamBundle(star);
    const packageCost = Number(star.pairTotalCost) || Number(star.cost) || 0;
    const matches = [];
    const candidateTeams = DATA.teams.filter(team => team.format === "standard" && teamCanRank(team) &&
      (!formatFilter || team.format === formatFilter) &&
      (!leagueFilters.length || (team.leagueNames || []).some(league => leagueFilters.includes(league))));
    for (const team of candidateTeams) {
      if (formatFilter && team.format !== formatFilter) continue;
      const eligibleLeagues = (team.leagueNames || []).filter(league =>
        (!leagueFilters.length || leagueFilters.includes(league)) &&
        bundle.every(member => (member.eligibleByLeague && member.eligibleByLeague[league] || []).includes(team.rosterName)));
      if (!eligibleLeagues.length) continue;

      const editor = state.editor && state.editor.applied && !state.editor.isStar && state.editor.teamId === team.id
        ? state.editor : null;
      let basePlayers = team.players.map(player => editedTeamPlayer(player, editor && player.id === editor.slotId ? editor : null));
      const squadLimit = 16;
      if (basePlayers.length + bundle.length > squadLimit) {
        const weakest = basePlayers.map(player => {
          const scores = SCORING.scorePlayer(player).scores;
          const value = teamPlayerReplacementValue(scores);
          return { player, value };
        }).sort((a, b) => a.value - b.value).slice(0, basePlayers.length + bundle.length - squadLimit);
        const remove = new Set(weakest.map(entry => entry.player));
        basePlayers = basePlayers.filter(player => !remove.has(player));
      }

      const baseline = state.teamData.find(candidate => candidate.id === team.id) || team;
      const afterPlayerTasks = teamPlayerTaskAggregation(basePlayers.concat(bundle), team, { requiredPlayerIds: bundle.map(member => member.id) });
      const beforeScores = baseline.rawScores || baseline.scores || [];
      const afterScores = afterPlayerTasks.scores;
      const axisDelta = afterScores.map((value, dimension) => value - (Number(beforeScores[dimension]) || 0));
      const weightedDelta = TEAM_OVERALL_WEIGHTS.reduce((sum, weight, dimension) => sum + weight * axisDelta[dimension], 0);
      matches.push({ teamId: team.id, rosterId: team.rosterId, rosterName: team.rosterName, formatName: team.formatName, leagues: eligibleLeagues, axisDelta, weightedDelta });
    }

    const summedImpact = matches.reduce((sum, match) => sum + match.weightedDelta, 0);
    const fit = {
      packageCost,
      rosterCount: new Set(matches.map(match => match.rosterId)).size,
      buildCount: matches.length,
      candidateBuildCount: candidateTeams.length,
      candidateRosterCount: new Set(candidateTeams.map(team => team.rosterId)).size,
      applicabilityRate: candidateTeams.length ? matches.length / candidateTeams.length : null,
      meanWeightedDelta: matches.length ? matches.reduce((sum, match) => sum + match.weightedDelta, 0) / matches.length : null,
      scopeAdjustedImpact: candidateTeams.length ? summedImpact / candidateTeams.length : null,
      matches: matches.sort((a, b) => b.weightedDelta - a.weightedDelta || a.rosterName.localeCompare(b.rosterName) || a.formatName.localeCompare(b.formatName))
    };
    starTeamFitCache.set(fitCacheKey, fit);
    return fit;
  }

  function signedPoints(value) {
    const points = Number(value) || 0;
    return (points >= 0 ? "+" : "−") + Math.abs(points).toFixed(1);
  }

  function signedPrecisePoints(value, digits = 2) {
    const points = Number(value) || 0;
    return (points >= 0 ? "+" : "−") + Math.abs(points).toFixed(digits);
  }

  function starTeamFitDetails(star) {
    const fit = starTeamFit(star, "", "");
    if (!fit.buildCount) return '<details class="appearance-details"><summary>可选球队贡献 · 暂无可评估的十一人制参考阵容</summary></details>';
    const costs = star.pairTotalCost
      ? '按配对明星总价 ' + esc(fullCurrency(fit.packageCost)) + ' 计算'
      : '按明星费用 ' + esc(fullCurrency(fit.packageCost)) + ' 计算';
    return '<details class="appearance-details star-team-fit"><summary>可选球队贡献 · ' + fit.rosterCount + '/' + fit.candidateRosterCount + ' 个种族 / ' + fit.buildCount + ' 套可用阵容</summary>' +
      '<p class="star-team-fit-note">只评估十一人制。逐套把明星' + (star.pair ? '组合' : '') + '加入其合法可用的球队参考阵容，并确保该明星（配对时两人）进入十一人场上组，再按相同阵容选择规则补齐其余位置。变化使用展示舍入前的队伍分数；适用数量只表示规则名单允许雇佣，不代表增益强度。范围调整后总影响 = 可用参考阵容的六维加权变化总和 ÷ 当前筛选内全部候选阵容数；' + costs + '。可用范围：' + fit.buildCount + '/' + fit.candidateBuildCount + ' 套（' + (fit.applicabilityRate == null ? '—' : (fit.applicabilityRate * 100).toFixed(0) + '%') + '）。若组合导致总人数超过16人，会按前五维加权原始分移出最低的一名原球员。数值仍基于当前六维代理；没有把临场站位、队友战术、规则触发频率或预算重建纳入代理总分；有固定条件任务证据的明星规则会在下方单独列出，不当作整场无条件收益。</p><ul>' +
      fit.matches.map(match => '<li><b>' + esc(match.leagues.join("、") + ' · ' + match.rosterName + ' · ' + match.formatName) + '</b><br><span>六维加权变化 ' + signedPrecisePoints(match.weightedDelta, 3) + ' · ' + DIMS.slice(0, 6).map((dimension, index) => dimension + ' ' + signedPrecisePoints(match.axisDelta[index], 2)).join(' / ') + '</span></li>').join("") +
      '</ul>' + renderTeamStarRuleEvidence(star) + '</details>';
  }

  function setHeading(title, note, count) {
    document.getElementById("result-heading").innerHTML = "<b>" + esc(title) + "</b><span>" + esc(note) + "</span>";
    document.getElementById("result-count").textContent = count;
  }

  function searchValue(item) {
    return [item.name, item.rosterName, item.position, item.description, item.intro, item.skillText]
      .concat(item.keywords || [], item.leagueNames || [], item.leagues || [], item.teamNames || [],
        (item.members || []).flatMap(member => [member.id, member.name, member.skillText, member.specialRules, ...(member.keywords || [])]))
      .join(" ").toLocaleLowerCase();
  }

  function textMatches(item) {
    return !state.search || searchValue(item).includes(state.search.toLocaleLowerCase());
  }

  function updateControls() {
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-league]").forEach(button => {
      const active = button.dataset.league ? state.leagues.includes(button.dataset.league) : state.leagues.length === 0;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-format]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.format === state.format);
      button.setAttribute("aria-pressed", String(button.dataset.format === state.format));
    });
    formatRow.hidden = state.view === "stars";
    document.getElementById("format-hint").textContent = state.format
      ? "只显示" + (state.format === "standard" ? "十一人制" : "七人制")
      : "未筛选时同时显示两种赛制";
  }

  function filteredTeams() {
    return state.teamData.filter(team => (!state.leagues.length || team.leagueNames.some(league => state.leagues.includes(league))) &&
      (!state.format || team.format === state.format) && textMatches(team));
  }

  function playersWithSimulation() {
    const people = [...currentPlayerCatalog(), ...DATA.stars.filter(star => !star.isStarPair)].map(person => {
      if (!state.editor || !state.editor.applied || state.editor.profileId !== person.id) return Object.assign({}, person);
      const edited = Object.assign({}, person, state.editor.stats, {
        skills: state.editor.skills.map(skill => Object.assign({}, skill)),
        boughtSkill: "",
        simulated: true
      });
      const calculated = SCORING.scorePlayer(edited);
      edited.scores = calculated.scores;
      edited.scoreBreakdown = calculated.breakdown;
      edited.skillText = editorSkillText(edited.skills);
      return edited;
    });
    rankGrades(people, PLAYER_OVERALL_DIMENSIONS);
    rankOverall(people);
    people.forEach(person => {
      const format = state.format || person.format || "standard";
      person.coachEvaluation = COACH_MODEL.evaluateCoachSkill(person, { coachSkill: state.coachSkill, format });
    });
    return people;
  }

  function filteredProfiles(playerData) {
    const profileLookup = new Map(playerData.map(person => [person.id, person]));
    return currentPlayerCatalog().map(baseProfile => {
      const profile = profileLookup.get(baseProfile.id) || baseProfile;
      let appearances = profile.appearances.filter(entry => (!state.leagues.length || entry.leagueNames.some(league => state.leagues.includes(league))) &&
        (!state.format || entry.format === state.format) && (!state.teamScope || entry.teamId === state.teamScope));
      if (!appearances.length) return null;
      const baseText = [profile.name, profile.position, profile.description, profile.skillText]
        .concat(profile.keywords || []).join(" ").toLocaleLowerCase();
      if (state.search && !baseText.includes(state.search.toLocaleLowerCase())) {
        appearances = appearances.filter(entry => [entry.teamName, entry.searchName, entry.rosterName].concat(entry.leagueNames || [])
          .join(" ").toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
      }
      if (state.search && !baseText.includes(state.search.toLocaleLowerCase()) && !appearances.length) return null;
      return Object.assign({}, profile, { visibleAppearances: appearances });
    }).filter(Boolean);
  }

  function filteredStars(playerData) {
    const stars = new Map(playerData.map(person => [person.id, person]));
    return DATA.stars.map(person => stars.get(person.id) || person).filter(person => (!state.leagues.length || state.leagues.some(league => person.eligibleByLeague[league])) && textMatches(Object.assign({}, person, {
      leagues: Object.keys(person.eligibleByLeague || {})
    })));
  }

  function rankingMetrics(kind) {
    if (kind !== "teams" && rankingState.source === "raw") return window.BB_TASK_RANKINGS.METRICS;
    if (kind !== "teams" && rankingState.source === "calibrated") return [{ id: "calibrated-overall", label: "暂定综合赋分" }]
      .concat(COACH_MODEL.AXES.map((axis, index) => ({ id: "calibrated-dimension-" + index, label: "暂定维度 · " + axis.labelZh })));
    const metrics = [{ id: "overall", label: "综合总评" }]
      .concat((kind === "teams" ? DIMS.map((label, index) => ({
        id: "dimension-" + index,
        label: label
      })) : DIMS.slice(0, 5).map((label, index) => ({ id: "dimension-" + index, label }))))
      .concat(ROLE_LABELS.map((label, index) => ({ id: "role-" + index, label: "角色任务 · " + label })));
    if (kind !== "teams") metrics.push(
      { id: "ma", label: "最高移动力" }, { id: "st", label: "最高力量" },
      { id: "ag", label: "敏捷目标值" }, { id: "pa", label: "传球目标值" },
      { id: "av", label: "护甲值" }, { id: "cost", label: "最低价格" }
    );
    if (kind === "stars") metrics.push(
      { id: "personal-cost-efficiency", label: "个人性价比（前五维任务值 / 价格）" },
      { id: "star-team-impact", label: "球队适配价值（覆盖范围 × 阵容增益）" },
      { id: "cost-efficiency", label: "可用球队增量性价比（六维变化 / 价格）" }
    );
    return metrics;
  }

  function updateRankingMetricOptions() {
    if (rankingState.kind === "teams") rankingState.source = "legacy";
    if (isRawRanking() && !rankingState.format) rankingState.format = "standard";
    if (isCalibratedRanking() && !rankingState.format) rankingState.format = "standard";
    const metricSelect = document.getElementById("ranking-metric");
    const metrics = rankingMetrics(rankingState.kind);
    if (!metrics.some(metric => metric.id === rankingState.metric)) rankingState.metric = metrics[0].id;
    const categoryForMetric = metric => {
      if (isRawRanking()) return (metric.label.split(" · ")[0] || "规则任务");
      if (isCalibratedRanking()) return metric.id === "calibrated-overall" ? "综合评分" : "六维画像";
      if (metric.id === "overall" || metric.id.startsWith("dimension-")) return "总评与六维";
      if (metric.id.startsWith("role-")) return "角色职责";
      if (["ma", "st", "ag", "pa", "av", "cost"].includes(metric.id)) return "属性与价格";
      if (metric.id.includes("cost") || metric.id === "star-team-impact") return "明星适配与性价比";
      return "其他";
    };
    const groupedMetrics = new Map();
    metrics.forEach(metric => {
      const category = categoryForMetric(metric);
      const group = groupedMetrics.get(category) || [];
      group.push(metric);
      groupedMetrics.set(category, group);
    });
    metricSelect.innerHTML = [...groupedMetrics].map(([category, group]) =>
      '<optgroup label="' + esc(category) + '">' + group.map(metric =>
        '<option value="' + esc(metric.id) + '">' + esc(metric.label) + '</option>'
      ).join("") + '</optgroup>'
    ).join("");
    metricSelect.value = rankingState.metric;
    const valueToggle = document.getElementById("star-cost-toggle");
    valueToggle.hidden = rankingState.kind !== "stars" || isRawRanking() || isCalibratedRanking();
    valueToggle.setAttribute("aria-pressed", String(rankingState.metric === "cost-efficiency"));
    valueToggle.textContent = rankingState.metric === "cost-efficiency" ? "返回球队适配排行" : "查看明星性价比排行";
    const directionToggle = document.getElementById("ranking-direction-toggle");
    directionToggle.setAttribute("aria-pressed", String(rankingState.reverse));
    directionToggle.title = "当前 " + rankingOrderLabel() + "；点击反转排序方向";
    const sourceSelect = document.getElementById("ranking-source");
    sourceSelect.value = rankingState.source;
    sourceSelect.disabled = rankingState.kind === "teams";
    document.getElementById("ranking-task-policy-label").hidden = !isRawRanking();
    document.getElementById("ranking-task-policy").value = rankingState.taskPolicy;
    const formatSelect = document.getElementById("ranking-format");
    formatSelect.options[0].disabled = isRawRanking() || isCalibratedRanking();
    formatSelect.value = rankingState.format;
    document.querySelector(".coach-skill-control").hidden = isRawRanking();
  }

  function initializeRankings() {
    updateRankingLeaguePicker();
    document.getElementById("ranking-league-search").addEventListener("input", event => {
      const query = event.target.value.trim().toLocaleLowerCase();
      document.querySelectorAll("#ranking-league-options [data-league-option]").forEach(option => {
        option.hidden = query && !option.textContent.toLocaleLowerCase().includes(query);
      });
    });
    document.getElementById("ranking-league-options").addEventListener("change", event => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      const value = event.target.value;
      if (!value) rankingState.leagues = [];
      else {
        rankingState.leagues = rankingState.leagues.filter(league => league !== value);
        if (event.target.checked) rankingState.leagues.push(value);
      }
      refreshRankingLeagueSelection();
      renderRankings(state.rankPlayerData);
    });
    document.getElementById("ranking-league-clear").addEventListener("click", () => {
      rankingState.leagues = [];
      refreshRankingLeagueSelection();
      renderRankings(state.rankPlayerData);
    });
    updateRankingMetricOptions();
    for (const field of ["kind", "format", "limit", "search"]) document.getElementById("ranking-" + field).value = rankingState[field];
  }

  const catalogSearchPanel = document.getElementById("catalog-search-results");

  function closeGlobalSearchResults() {
    globalSearchActiveIndex = -1;
    catalogSearchPanel.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function globalSearchCandidates(query) {
    const normalized = query.toLocaleLowerCase();
    const teams = DATA.teams.map(item => ({ kind: "teams", item, name: item.rosterName,
      search: [searchValue(item), item.formatName, ...(item.leagueNames || [])].join(" ").toLocaleLowerCase(),
      detail: [item.formatName, ...(item.leagueNames || [])].filter(Boolean).join(" · ") }));
    const players = PLAYER_CATALOG_PROFILES.map(item => {
      const appearances = item.appearances || [];
      return { kind: "players", item, name: item.name,
        search: [searchValue(item), ...appearances.flatMap(entry => [entry.teamName, entry.rosterName, ...(entry.leagueNames || [])])].join(" ").toLocaleLowerCase(),
        detail: [item.position, appearances.length + " 套球队/赛制档案", item.cost ? fullCurrency(item.cost) : ""].filter(Boolean).join(" · ") };
    });
    const stars = DATA.stars.map(item => {
      const leagues = Object.keys(item.eligibleByLeague || {});
      return { kind: "stars", item, name: item.name,
        search: [searchValue(item), ...(item.keywords || []), ...leagues, ...Object.values(item.eligibleByLeague || {}).flat()].join(" ").toLocaleLowerCase(),
        detail: [item.position, item.cost ? fullCurrency(item.cost) : "", leagues.slice(0, 2).join(" · ")].filter(Boolean).join(" · ") };
    });
    const rank = row => row.name.toLocaleLowerCase().startsWith(normalized) ? 0 : 1;
    const matching = rows => rows.filter(row => row.search.includes(normalized)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "en"));
    return [
      { kind: "teams", label: "球队阵容", items: matching(teams) },
      { kind: "players", label: "基础球员", items: matching(players) },
      { kind: "stars", label: "明星球员", items: matching(stars) }
    ];
  }

  function renderGlobalSearchResults(query) {
    const normalized = String(query || "").trim();
    globalSearchResults = [];
    globalSearchActiveIndex = -1;
    if (normalized.length < 2) {
      closeGlobalSearchResults();
      return;
    }
    const groups = globalSearchCandidates(normalized);
    const hasResults = groups.some(group => group.items.length);
    if (!hasResults) {
      catalogSearchPanel.innerHTML = '<div class="catalog-search-empty">没有找到球队、基础球员或明星。当前分类仍会按“' + esc(normalized) + '”筛选位置、技能和说明文字。</div>';
    } else {
      catalogSearchPanel.innerHTML = groups.filter(group => group.items.length).map(group => {
        const options = group.items.slice(0, 4).map(row => {
          const index = globalSearchResults.push({ kind: row.kind, item: row.item }) - 1;
          const visualItem = row.kind === "teams" ? (state.teamData || []).find(team => team.id === row.item.id) || row.item : row.item;
          return '<button type="button" class="catalog-search-option" role="option" aria-selected="false" id="catalog-search-option-' + index + '" data-search-result-index="' + index + '">' + objectVisualPair(visualItem, row.kind, "search-result-visual", visualItem.format) + '<span class="search-result-copy"><b>' + esc(row.name) + '</b><small>' + esc(row.detail || group.label) + '</small></span></button>';
        }).join("");
        return '<div class="catalog-search-group" role="group" aria-label="' + esc(group.label) + '"><div class="catalog-search-group-title"><span>' + esc(group.label) + '</span><small>显示 ' + Math.min(group.items.length, 4) + ' / 共 ' + group.items.length + '</small></div>' + options + '</div>';
      }).join("") + '<div class="catalog-search-empty">点击结果直接跳转；继续输入可缩小范围。方向键选择，回车打开，Esc 关闭。</div>';
    }
    catalogSearchPanel.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function setGlobalSearchActive(index) {
    const options = [...catalogSearchPanel.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    globalSearchActiveIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => option.setAttribute("aria-selected", String(optionIndex === globalSearchActiveIndex)));
    const active = options[globalSearchActiveIndex];
    searchInput.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  }

  function openGlobalSearchResult(result) {
    const { kind, item } = result;
    state.view = kind;
    state.search = "";
    state.selectedId = item.id;
    state.teamScope = "";
    if (kind === "teams") {
      state.format = item.format || "";
      state.leagues = (item.leagueNames || []).filter(league => DATA.leagues.includes(league));
    } else if (kind === "players") {
      const appearances = item.appearances || [];
      const appearance = appearances.find(entry => entry.format === state.format) || appearances.find(entry => entry.format === "standard") || appearances[0];
      state.format = appearance?.format || "";
      state.leagues = [];
    } else {
      const eligibleLeagues = Object.keys(item.eligibleByLeague || {});
      const league = state.leagues.find(value => eligibleLeagues.includes(value)) || eligibleLeagues[0] || "";
      state.leagues = league ? [league] : [];
      state.format = "";
    }
    state.league = state.leagues[0] || "";
    searchInput.value = "";
    closeGlobalSearchResults();
    persistBrowseFilters();
    const url = new URL(window.location.href);
    if (kind === "teams") url.searchParams.delete("view");
    else url.searchParams.set("view", kind);
    url.hash = "catalog";
    window.history.replaceState(null, "", url);
    render();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function starHasFormat(star, format) {
    if (format === "sevens") return false;
    const evaluatedFormat = format || "standard";
    const leagues = rankingState.leagues.length ? rankingState.leagues : Object.keys(star.eligibleByLeague || {});
    return leagues.some(league => {
      const eligibleRosters = star.eligibleByLeague[league] || [];
      return DATA.teams.some(team => team.format === evaluatedFormat && team.leagueNames.includes(league) && eligibleRosters.includes(team.rosterName));
    });
  }

  function rankingItems(playerData) {
    let items;
    if (rankingState.kind === "teams") {
      items = state.teamData.filter(team => teamCanRank(team) && rankingLeagueMatches(team.leagueNames) &&
        (!rankingState.format || team.format === rankingState.format));
    } else if (rankingState.kind === "players") {
      const livePlayers = new Map(playerData.map(person => [person.id, person]));
      items = PLAYER_CATALOG_PROFILES.map(profile => {
        const person = livePlayers.get(profile.id) || profile;
        const appearances = profile.appearances.filter(entry => rankingLeagueMatches(entry.leagueNames) &&
          (!rankingState.format || entry.format === rankingState.format));
        return appearances.length ? Object.assign({}, person, { visibleAppearances: appearances }) : null;
      }).filter(Boolean);
    } else {
      const liveStars = new Map(playerData.map(person => [person.id, person]));
      items = DATA.stars.filter(star => !star.isStarPair).map(star => liveStars.get(star.id) || star).filter(star =>
        rankingState.leagues.some(league => star.eligibleByLeague[league]) || !rankingState.leagues.length).filter(star => starHasFormat(star, rankingState.format));
    }
    const query = rankingState.search.toLocaleLowerCase();
    if (query) items = items.filter(item => {
      const appearances = item.visibleAppearances || [];
      const haystack = [item.name, item.rosterName, item.position, item.description, item.intro, item.skillText]
        .concat(item.keywords || [], item.leagueNames || [], item.leagues || [], appearances.flatMap(entry => [entry.rosterName, entry.teamName, ...(entry.leagueNames || [])]))
        .join(" ").toLocaleLowerCase();
      return haystack.includes(query);
    });
    if (rankingState.metric === "pa") items = items.filter(item => item.pa != null && item.pa !== "");
    if (isCalibratedRanking()) {
      const format = rankingState.format === "sevens" ? "sevens" : "standard";
      items = items.map(item => {
        const calibration = calibrationFor(item, format);
        return calibration ? Object.assign({}, item, { provisionalCalibration: calibration }) : null;
      }).filter(Boolean);
    }
    return items;
  }

  function rankingValue(item) {
    if (isRawRanking()) return item.taskRanking?.sortValue ?? null;
    if (isCalibratedRanking()) {
      const calibration = item.provisionalCalibration;
      if (rankingState.metric === "calibrated-overall") return Number.isFinite(calibration.total) ? calibration.total : null;
      if (rankingState.metric.startsWith("calibrated-dimension-")) return calibration.scores[Number(rankingState.metric.slice("calibrated-dimension-".length))];
    }
    if (rankingState.metric === "overall") return Number(item.overallAssignedScore) || 0;
    if (rankingState.metric.startsWith("dimension-")) return Number(item.scores && item.scores[Number(rankingState.metric.slice(10))]) || 0;
    if (rankingState.metric === "personal-cost-efficiency") {
      const cost = Number(item.cost) || 0;
      return cost > 0 ? (Number(item.overallScore) || 0) * 100000 / cost : null;
    }
    if (rankingState.metric === "cost-efficiency") {
      const fit = starTeamFit(item);
      return fit.packageCost > 0 && fit.scopeAdjustedImpact != null ? fit.scopeAdjustedImpact * 100000 / fit.packageCost : null;
    }
    if (rankingState.metric === "star-team-impact") {
      const fit = starTeamFit(item);
      return fit.scopeAdjustedImpact;
    }
    if (rankingState.metric.startsWith("role-")) {
      const role = Number(rankingState.metric.slice(5));
      return rankingState.kind === "teams"
        ? Number(item.teamAdaptability && item.teamAdaptability.baselineByRole && item.teamAdaptability.baselineByRole[role]) || 0
        : Number(item.scoreBreakdown && item.scoreBreakdown.adaptability && item.scoreBreakdown.adaptability.roles && item.scoreBreakdown.adaptability.roles[role] && item.scoreBreakdown.adaptability.roles[role].score) || 0;
    }
    if (item[rankingState.metric] == null || item[rankingState.metric] === "") return null;
    const value = Number(item[rankingState.metric]);
    return Number.isFinite(value) ? value : null;
  }

  function rankingDirection() {
    if (isRawRanking()) return window.BB_TASK_RANKINGS.METRICS.find(metric => metric.id === rankingState.metric)?.risk ? 1 : -1;
    if (isCalibratedRanking()) return -1;
    return ["ag", "pa", "cost"].includes(rankingState.metric) ? 1 : -1;
  }

  function rankingOrderLabel() {
    const ascending = (rankingDirection() * (rankingState.reverse ? -1 : 1)) > 0;
    return ascending ? "由低到高" : "由高到低";
  }

  function rankingValueText(item) {
    if (isRawRanking()) {
      const value = item.taskRanking;
      const percent = probability => (probability * 100).toFixed(2) + "%";
      return value.exact ? percent(value.lowerBound) : percent(value.lowerBound) + "–" + percent(value.upperBound);
    }
    if (isCalibratedRanking()) {
      const value = rankingValue(item);
      return value == null ? "覆盖不足" : value.toFixed(1) + " / 100";
    }
    if (rankingState.metric === "overall") return (Number(item.overallAssignedScore) || 0).toFixed(1) + (rankingState.kind === "teams" ? " 赋分" : "");
    if (rankingState.metric.startsWith("dimension-")) {
      const dimension = Number(rankingState.metric.slice(10));
      return (Number(item.scores && item.scores[dimension]) || 0).toFixed(1);
    }
    if (rankingState.metric.startsWith("role-")) return "任务值 " + rankingValue(item).toFixed(1) + " / 100";
    if (rankingState.metric === "personal-cost-efficiency") return rankingValue(item).toFixed(1) + " 个人分 / 100K";
    if (rankingState.metric === "cost-efficiency") return signedPrecisePoints(rankingValue(item), 3) + " 队伍分 / 100K";
    if (rankingState.metric === "star-team-impact") return signedPrecisePoints(rankingValue(item), 3) + " 队伍分 / 候选阵容";
    if (rankingState.metric === "cost") return "价格 " + fullCurrency(item.cost);
    const value = rankingValue(item);
    if (value == null) return "无数据";
    if (rankingState.metric === "ma") return "移动力 " + value;
    if (rankingState.metric === "st") return "力量 " + value;
    if (rankingState.metric === "ag") return "敏捷 " + value + "+";
    if (rankingState.metric === "pa") return "传球 " + value + "+";
    if (rankingState.metric === "av") return "护甲 " + value + "+";
    return String(value);
  }

  function rankingGrade(item) {
    if (isCalibratedRanking()) {
      if (rankingState.metric === "calibrated-overall") return item.provisionalCalibration.totalGrade || "";
      return item.provisionalCalibration.grades[Number(rankingState.metric.slice("calibrated-dimension-".length))] || "";
    }
    if (rankingState.metric === "overall") return item.overallGrade;
    if (rankingState.metric.startsWith("dimension-")) return scoreGrade(item.grades, Number(rankingState.metric.slice(10)));
    return "";
  }

  function rankingScoreNote(item) {
    if (isRawRanking()) {
      const metric = window.BB_TASK_RANKINGS.METRICS.find(value => value.id === rankingState.metric);
      const partnerId = rawRankingPartner(item);
      const partner = partnerId && DATA.stars.find(star => star.id === partnerId);
      return (item.taskRanking.exact ? "精确枚举" : "未解析分支保留区间") + " · 打印基准 · " + (metric.incoming ? "来袭结算后" : "行动及激活收尾后") +
        (partnerId ? " · 实际伙伴 " + (partner?.name || partnerId) + "；条件参考，不参与共同名次" : "");
    }
    if (isCalibratedRanking()) {
      const calibration = item.provisionalCalibration;
      if (rankingState.metric === "calibrated-overall") return "六项先各自同任务赋分，再按 25/20/15/15/15/10 加权 · 覆盖 " + Math.round(calibration.totalCoverage * 100) + "%";
      const dimension = Number(rankingState.metric.slice("calibrated-dimension-".length));
      const coverage = calibration.coverage[dimension];
      if (dimension === 0) return 'v3.36 · ' + mobilityCoverageText(calibration);
      if (!coverage || !Number.isFinite(coverage.coverage)) return coverage?.reason || "当前维度覆盖不足";
      return "同条件任务族赋分 · 任务族覆盖 " + Math.round(coverage.coverage * 100) + "%" + (coverage.basis ? " · " + coverage.basis : "");
    }
    if (rankingState.metric === "overall") return rankingState.kind === "teams"
      ? "同赛制六维名次分加权 · 22/18/16/15/15/14 · 原始加权代理 " + (Number(item.overallScore) || 0).toFixed(1) + " · 赛制内第 " + item.teamRank + " 名"
      : "前五维赋分总评 · 旧代理前五维均值 " + (Number(item.overallScore) || 0).toFixed(1);
    if (rankingState.metric.startsWith("dimension-")) {
      const dimension = Number(rankingState.metric.slice(10));
      const points = item.overallAssignedDimensions && item.overallAssignedDimensions[dimension];
      if (rankingState.kind === "teams") return "前五维由球员任务画像按 e^(−0.38×序位) 聚合" + (dimension === 3 || dimension === 4 ? "，并含 V6.1 整队任务" : "") + " · 球员/球队数据均为暂定指数" + (Number.isFinite(Number(points)) ? " · 队伍排名赋分 " + (Number(points) || 0).toFixed(1) : "");
      return "规则情境原始分" + (Number.isFinite(Number(item.scores && item.scores[dimension])) ? " · 排名赋分 " + (Number(points) || 0).toFixed(1) : "");
    }
    if (rankingState.metric.startsWith("role-")) return "单项职责任务代理值；适应力保持向量展示，不合成跨角色总分";
    if (rankingState.metric === "personal-cost-efficiency") {
      const price = fullCurrency(item.cost);
      return "前五维原始加权任务值 ÷ " + price + "；仅看明星个人基准能力";
    }
    if (rankingState.metric === "star-team-impact") {
      const fit = starTeamFit(item);
      return "合法十一人制阵容的六维加权增量总和 ÷ 当前筛选下全部候选阵容数（" + fit.buildCount + "/" + fit.candidateBuildCount + " 套可用）；同时体现适用范围与增益大小";
    }
    if (rankingState.metric === "cost-efficiency") {
      const fit = starTeamFit(item);
      const price = fullCurrency(fit.packageCost);
      const pair = item.pairTotalCost ? " · 配对组合按整组效果和总价计算" : "";
      return "范围调整后队伍增益 ÷ " + price + pair + "；规则允许适用 " + fit.rosterCount + "/" + fit.candidateRosterCount + " 个候选种族";
    }
    return rankingState.metric === "cost" ? "价格越低名次越前" : ["ag", "pa"].includes(rankingState.metric) ? "目标值越低越容易成功" : "规则属性值";
  }

  function rankingSubtitle(item) {
    if (rankingState.kind === "teams") return item.formatName + " · " + item.leagueNames.join("、");
    if (rankingState.kind === "stars") return (item.keywords || []).join(" · ") + " · " + Object.keys(item.eligibleByLeague || {}).length + " 个可用赛区";
    const appearances = item.visibleAppearances || item.appearances || [];
    const rosters = Array.from(new Set(appearances.map(entry => entry.rosterName)));
    const formats = Array.from(new Set(appearances.map(entry => entry.formatName)));
    return (item.keywords || []).join(" · ") + " · " + rosters.slice(0, 3).join("、") + (rosters.length > 3 ? " 等" : "") + (formats.length ? " · " + formats.join("、") : "");
  }

  function leagueNamesFor(item, kind) {
    let names = [];
    if (kind === "teams") names = item.leagueNames || [];
    else if (kind === "stars" || kind === "star") names = Object.keys(item.eligibleByLeague || {});
    else {
      names = (item.visibleAppearances || item.appearances || []).flatMap(entry => entry.leagueNames || []);
    }
    const available = new Set(names);
    return DATA.leagues.filter(name => available.has(name));
  }

  function leagueBackdropAttrs(item, kind, preferredLeague) {
    const leagues = leagueNamesFor(item, kind);
    const league = leagues.includes(preferredLeague) ? preferredLeague : leagues[0];
    const art = LEAGUE_ART[league];
    return art ? ' style="--league-art:url(&quot;' + esc(art) + '&quot;)"' : "";
  }

  function renderRankingRow(item, index, rank) {
    const metricIsScore = rankingState.metric === "overall" || rankingState.metric.startsWith("dimension-") || rankingState.metric === "calibrated-overall" || rankingState.metric.startsWith("calibrated-dimension-");
    const grade = rankingGrade(item);
    const rankLabel = rank == null ? '—' : rank === index + 1 ? String(rank).padStart(2, "0") : "=" + rank;
    const artKind = rankingState.kind === "teams" ? "teams" : rankingState.kind === "stars" ? "stars" : "players";
    const preferredLeague = rankingState.leagues.find(league => leagueNamesFor(item, artKind).includes(league)) || "";
    const artAttrs = leagueBackdropAttrs(item, artKind, preferredLeague);
    // Ranking values may come from recalculated task records that omit the source portrait.
    // Always take the image path from the canonical catalogue record for players and stars.
    const portraitSource = rankingState.kind === "stars"
      ? DATA.stars.find(person => person.id === item.id)
      : rankingState.kind === "players"
        ? PLAYER_CATALOG_PROFILES.find(person => person.id === item.id)
        : null;
    const visualItem = portraitSource?.portrait ? Object.assign({}, item, { portrait: portraitSource.portrait }) : item;
    const cost = rankingState.kind !== "teams" && Number(item.cost) > 0
      ? '<span class="ranking-cost-badge" title="' + esc(item.pairTotalCost ? '明星个人分摊费用；配对总价 ' + fullCurrency(item.pairTotalCost) : '球员费用') + '">' +
        (item.pairTotalCost ? '分摊 ' : '') + esc(fullCurrency(item.cost)) + '</span>'
      : "";
    return '<button class="ranking-row' + (artAttrs ? ' atlas-art-card' : '') + '"' + artAttrs + ' type="button" data-ranking-select="' + esc(item.id) + '" aria-label="' + (rank == null ? '配对条件参考，不参与共同名次，' : '第 ' + rank + ' 名，') + esc(item.name) + '，含对象图片与六维雷达图">' +
      '<span class="ranking-place">' + rankLabel + '</span>' +
      '<span class="ranking-avatar">' + portraitMark(visualItem, "ranking-portrait", "ranking-emblem", true) + '</span>' +
      '<span class="ranking-identity"><span class="ranking-name-line"><b>' + esc(rankingState.kind === "teams" ? fullTeamName(item) : item.name) + '</b>' + cost + '</span><small>' + esc(rankingSubtitle(item)) + '</small></span>' +
      '<span class="ranking-hex">' + compactObjectRadar(item, rankingState.kind, rankingState.format, true) + '</span>' +
      '<span class="ranking-result"><b>' + esc(rankingValueText(item)) + '</b><small>' + esc(rankingScoreNote(item)) + '</small></span>' +
      (metricIsScore && grade ? gradeTag(grade) : '<span class="ranking-grade-placeholder">—</span>') + '</button>';
  }

  function renderCoachEvaluation(item) {
    const evaluation = item && item.coachEvaluation;
    if (!evaluation || !Number.isFinite(evaluation.realizedStrength)) return "";
    const level = COACH_PRESETS.find(preset => preset.coachSkill === evaluation.coachSkill) || COACH_PRESETS[1];
    const axisDrivers = evaluation.explanationDrivers.length
      ? evaluation.explanationDrivers.map(driver => esc(driver.label) + " " + signedPoints(driver.weightedDelta)).join(" · ")
      : "与 Experienced 的强度差异低于当前展示精度";
    const skillDrivers = (evaluation.skillExplanationDrivers || []).filter(driver => Math.abs(driver.delta) >= 0.05).slice(0, 5);
    const skillDriverText = skillDrivers.length
      ? skillDrivers.map(driver => {
        const cues = (driver.dependencyFeatures || []).slice(0, 2);
        const axes = (driver.axes || []).filter(axis => Math.abs(axis.delta) >= 0.01)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
          .map(axis => esc(axis.label) + " " + signedPoints(axis.delta));
        return esc(driver.label) + (cues.length ? "（" + cues.map(esc).join("、") + "）" : "") + " " + signedPoints(driver.delta) + (axes.length ? " · " + axes.join(" / ") : "");
      }).join("；")
      : "可归因的技能表达变化低于 0.05 分；当前强度主要由基础能力和被动价值决定。";
    const formatLabel = evaluation.context.format === "sevens" ? "七人制" : "十一人制";
    const factors = evaluation.contributingFactors || {};
    const factorLabels = [
      ["roleClarity", "职责清晰"],
      ["roleRedundancy", "职责冗余"],
      ["recoveryAbility", "失误恢复"],
      ["decisionBranching", "决策分支"],
      ["positionalDependency", "位置依赖"],
      ["resourceManagementDifficulty", "资源管理"],
      ["turnSequencingSensitivity", "行动顺序"]
    ];
    const factorText = factorLabels.filter(([key]) => Number.isFinite(factors[key]))
      .map(([key, label]) => esc(label) + " " + Number(factors[key]).toFixed(0)).join(" · ");
    return '<section class="coach-evaluation" aria-label="Coach Skill 教练水平情境评估">' +
      '<div class="coach-evaluation-heading"><b>Coach Skill · 教练情境表现</b><span>实验预览</span></div>' +
      '<p>当前：' + esc(level.labelZh) + '（' + esc(level.label) + '，' + evaluation.coachSkill + '）· ' + formatLabel + '。下列数值来自旧任务指数的教练情境代理，不填入规范六维或正式 Strength。</p>' +
      '<div class="coach-evaluation-grid">' +
      '<article><b>Skill Floor</b><strong>' + evaluation.skillFloor.toFixed(1) + '</strong><small>新手情境 Strength</small></article>' +
      '<article><b>Skill Ceiling</b><strong>' + evaluation.skillCeiling.toFixed(1) + '</strong><small>高手情境 Strength</small></article>' +
      '<article><b>Execution Complexity</b><strong>' + evaluation.executionDependency.toFixed(0) + '</strong><small>规则触发执行依赖</small></article>' +
      '<article><b>Mistake Punishment</b><strong>' + evaluation.mistakePunishment.toFixed(0) + '</strong><small>移动、敏捷、生存与补位代理</small></article>' +
      '</div><div class="coach-evaluation-strength"><span>旧代理 Base Strength <b>' + evaluation.baseStrength.toFixed(1) + '</b></span><span>旧代理 Realized Strength <b>' + evaluation.realizedStrength.toFixed(1) + '</b></span><span>相对 Experienced <b>' + signedPoints(evaluation.deltaFromExperienced) + '</b></span></div>' +
      '<details><summary>为什么会变化？</summary><p>技能与规则归因（对比 Experienced）：' + skillDriverText + '</p><p>维度贡献：' + axisDrivers + '</p><small>兑现因子 ' + evaluation.realizationFactor.toFixed(3) + ' · 角色复杂度 ' + evaluation.roleComplexity.toFixed(1) + ' · 协同复杂度 ' + evaluation.synergyComplexity.toFixed(1) + ' · 当前阵容满足的技能协同 ' + evaluation.activeSynergyCount + ' 条</small><small>' + factorText + '</small></details>' +
      '<small class="coach-evaluation-limit">技能增量来自当前规则评分管线的同球员技能消融；执行依赖可追溯到 Bloodboard V5 规则摘要，但这不是 Bloodboard 引擎行动树直接输出的任务概率。角色复杂度、失误惩罚与阵容协同仍是公开情境代理，尚未用实际玩家行为/比赛数据校准，因此不是正式胜率或官方 Tier。</small></section>';
  }

  function rawRankingPartner(item) {
    return isRawRanking() && window.BloodboardEngine?.STAR_BY_ID?.[item.id]?.pair || null;
  }

  function renderRankings(playerData) {
    if (!playerData) return;
    const list = document.getElementById("ranking-list");
    const summary = document.getElementById("ranking-summary");
    let items = rankingItems(playerData);
    const exclusions = new Map();
    if (isRawRanking()) {
      const format = rankingState.format === "sevens" ? "sevens" : "11s";
      const data = window.BB_PLAYER_TASK_RESULTS;
      const current = data.modelVersion === COACH_MODEL.VERSION && data.suiteVersion === window.BB_PLAYER_TASKS.VERSION &&
        data.engine.sha256 === window.BB_BLOODBOARD_ENGINE.META.sha256;
      items = items.map(item => {
        const taskRanking = item.simulated ? { reason: "档案已临时修改，需在详情重新计算；基准表不套用编辑前结果" }
          : current ? window.BB_TASK_RANKINGS.lookup(data, item, format, rankingState.metric, rankingState.taskPolicy)
          : { reason: "参考档案与当前模型或引擎版本不一致，需重新计算" };
        if (taskRanking.reason) {
          exclusions.set(taskRanking.reason, (exclusions.get(taskRanking.reason) || 0) + 1);
          return null;
        }
        return Object.assign({}, item, { taskRanking });
      }).filter(Boolean);
    }
    rankingModes[rankingState.kind] = { source: rankingState.source, metric: rankingState.metric, reverse: rankingState.reverse };
    persistRankingPreferences();
    const direction = rankingDirection() * (rankingState.reverse ? -1 : 1);
    items.sort((a, b) => {
      // Real paired partners change the initial board; retain those probabilities as unranked references.
      const leftPartner = rawRankingPartner(a), rightPartner = rawRankingPartner(b);
      if (!!leftPartner !== !!rightPartner) return leftPartner ? 1 : -1;
      const left = rankingValue(a), right = rankingValue(b);
      if (left == null && right == null) return a.name.localeCompare(b.name);
      if (left == null) return 1;
      if (right == null) return -1;
      const delta = left - right;
      return (isRawRanking() && Math.abs(delta) < 1e-12 ? 0 : direction * delta) || a.name.localeCompare(b.name);
    });
    const limit = rankingState.limit === "all" ? items.length : Number(rankingState.limit);
    const visible = items.slice(0, limit);
    summary.innerHTML = '<b>' + esc(rankingMetrics(rankingState.kind).find(metric => metric.id === rankingState.metric)?.label || "排行榜") + '</b>' +
      '<span>' + items.length + ' 个结果' + (visible.length < items.length ? ' · 显示前 ' + visible.length + ' 名' : '') + '</span>' +
      '<small>' + (rankingState.kind === "teams" ? "球队 · " + (COACH_PRESETS.find(level => level.coachSkill === state.coachSkill)?.labelZh || "老手") + "情境" : rankingState.kind === "players" ? "基础球员本体" : "明星球员") +
      ' · ' + esc(rankingLeagueSummary()) +
      (rankingState.format ? ' · ' + (rankingState.format === "standard" ? "十一人制" : "七人制") : ' · 全部赛制') + ' · ' + rankingOrderLabel() + '</small>';
    if (isCalibratedRanking()) summary.innerHTML += '<p class="task-ranking-conditions">暂定校准：先在同一赛制、同一任务情境中将概率转为排名赋分，再按独立任务族合成六项；总评使用 25/20/15/15/15/10。A–E 仅为当前比较组百分位等级；未测/不适用不填零。球员与明星同列，球队暂不采用此标定总分。</p>';
    if (isRawRanking()) {
      const metric = window.BB_TASK_RANKINGS.METRICS.find(item => item.id === rankingState.metric);
      summary.innerHTML += '<p class="task-ranking-conditions">规则任务参考概率：正常天气、无额外支援；传接球的接应者为 AG3、无 Catch；阻挡目标为 ST3 / AV9、无技能；来袭者均有 Block。' +
        (rankingState.taskPolicy === "withTeamRerolls" ? '允许' + (metric.incoming ? '来袭方' : '行动方') + '一枚团队重掷，无额外 Leader 资源' : '禁止' + (metric.incoming ? '来袭方' : '行动方') + '团队与 Leader 重掷') + '，合法技能/明星反应保留。本表不保证所有对象的初始阵容完全相同：配对明星保留真实伙伴，作为独立条件参考置于末尾，不参与共同名次；可按姓名搜索查看。区间按' + (metric.risk ? '风险上界' : '成功下界') + '排序；重叠区间不证明高低，不生成等级或实力总评。</p>' +
        (exclusions.size ? '<small class="task-ranking-exclusions">未进入概率榜：' + Array.from(exclusions, ([reason, count]) => esc(reason) + '（' + count + '）').join('；') + '。缺项不计零分。</small>' : '') +
        '<small class="task-ranking-exclusions">基准任务不随 Coach Skill 调整；临时编辑请在详情重新计算。<span>完整条件与公式（后台资料）</span> · <span>V6.1 全名单复算输入（后台资料）</span></small>';
    }
    if (!visible.length) {
      list.innerHTML = '<div class="ranking-empty">' + (rankingState.kind === "stars" && rankingState.format === "sevens" ? '七人制不能招募明星，没有可参与此榜的候选。' : '没有符合当前筛选条件的对象。') + '</div>';
      return;
    }
    let previousValue, currentRank = 0;
    list.innerHTML = visible.map((item, index) => {
      if (rawRankingPartner(item)) return renderRankingRow(item, index, null);
      const value = rankingValue(item);
      const tieKey = isRawRanking() ? JSON.stringify([item.taskRanking.lowerBound.toFixed(12), item.taskRanking.upperBound.toFixed(12)]) : value;
      if (index === 0 || tieKey !== previousValue) currentRank = index + 1;
      previousValue = tieKey;
      return renderRankingRow(item, index, currentRank);
    }).join("");
  }

  function selectRankingItem(itemId) {
    const kind = rankingState.kind;
    state.view = kind;
    state.selectedId = itemId;
    state.teamScope = "";
    state.search = "";
    searchInput.value = "";
    state.league = rankingState.leagues[0] || "";
    state.leagues = [...rankingState.leagues];
    state.format = kind === "stars" ? "" : rankingState.format;
    if (isRawRanking()) {
      suitePreferences[itemId] = Object.assign({}, suitePreferences[itemId], {
        // Both benchmark policies start with one reroll; the left column forbids its use.
        format: rankingState.format === "sevens" ? "sevens" : "11s", teamRerolls: 1,
        weather: "perfect", support: "none", benchmarkPolicy: rankingState.taskPolicy
      });
      try { window.localStorage.setItem(suitePreferenceKey, JSON.stringify(suitePreferences)); } catch (_) {}
    }
    const url = new URL(window.location.href);
    if (kind === "teams") url.searchParams.delete("view");
    else url.searchParams.set("view", kind);
    window.history.replaceState(null, "", url);
    render();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    featuredEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderTeamCard(team) {
    if (standardMode()) return renderStandardRail(team, "team");
    const selected = state.selectedId === team.id;
    const artAttrs = leagueBackdropAttrs(team, "teams", state.league);
    const legality = teamLegality(team);
    return '<article class="rail-card team-rail-card team-art-card ' + (selected ? "is-selected" : "") + (artAttrs ? " atlas-art-card" : "") + '"' + artAttrs + ' data-select="' + esc(team.id) + '" role="button" tabindex="0">' +
      '<div class="rail-card-top team-art-top"><span class="card-kicker">' + esc(team.formatName) + ' · ' + team.players.length + ' 名球员</span>' + portraitMark(team, "rail-team-art", "emblem") + '</div>' +
      '<h3>' + esc(fullTeamName(team)) + '</h3><p class="rail-card-subtitle">' + esc(team.leagueNames.join("、")) + '</p>' +
      '<div class="rail-card-bottom team-card-pending"><span>' + esc(legality.status === "valid" ? "V7.0.1 校验通过" : legality.status === "invalid" ? "V7.0.1 构筑需修正" : legality.status === "needs-setup" ? "V7.0.1 待补配置" : legality.status === "simulation-unverified" ? "临时模拟未校验" : "V7.0.1 缺少校验记录") + '</span><b>' + (teamCanRank(team) ? esc(team.overallGrade || "—") + ' · ' + Number(team.overallAssignedScore || 0).toFixed(1) : "暂不评级") + '</b><span class="team-rail-hex">' + compactObjectRadar(team, "teams") + '</span></div></article>';
  }

  function teamRosterSelectionDetails(team) {
    const selection = team.teamRosterSelection;
    if (!selection) return '';
    const axes = selection.byDimension.map(axis => {
      const strengthCounts = axis.players.reduce((counts, player) => {
        counts[player.strength] = (counts[player.strength] || 0) + 1;
        return counts;
      }, {});
      const strengthSummary = Object.entries(strengthCounts).sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([strength, count]) => 'ST' + strength + ' × ' + count).join(' · ');
      return '<li><b>' + esc(axis.dimension) + '</b> · ' + esc(strengthSummary) + '<br><small>' + esc(axis.players.map(player => player.name).join('、')) + '</small></li>';
    }).join('');
    return '<details class="team-axis-lineups"><summary>按任务维度查看入选球员与力量结构</summary><p>' + esc(selection.method) + '</p><ul>' + axes + '</ul></details>';
  }

  function starCanJoinTeam(star, team) {
    const members = starTeamBundle(star);
    return team.format === "standard" && teamCanRank(team) && team.leagueNames.some(league =>
      members.every(member => (member.eligibleByLeague?.[league] || []).includes(team.rosterName)));
  }

  function starImpactForTeam(star, team) {
    if (!starCanJoinTeam(star, team)) return null;
    const bundle = starTeamBundle(star);
    const packageCost = Number(star.pairTotalCost) || Number(star.cost) || 0;
    const limit = 16;
    let basePlayers = team.players.slice();
    if (basePlayers.length + bundle.length > limit) {
      const weakest = basePlayers.map(player => {
        const scores = SCORING.scorePlayer(player).scores;
        const value = teamPlayerReplacementValue(scores);
        return { player, value };
      }).sort((a, b) => a.value - b.value).slice(0, basePlayers.length + bundle.length - limit);
      const remove = new Set(weakest.map(entry => entry.player));
      basePlayers = basePlayers.filter(player => !remove.has(player));
    }
    const after = teamPlayerTaskAggregation(basePlayers.concat(bundle), team, {
      requiredPlayerIds: bundle.map(member => member.id)
    });
    const beforeScores = team.rawScores || team.scores || [];
    const afterScores = after.scores || [];
    const axisDelta = afterScores.map((value, dimension) => value - (Number(beforeScores[dimension]) || 0));
    const weightedDelta = TEAM_OVERALL_WEIGHTS.reduce((sum, weight, dimension) => sum + weight * axisDelta[dimension], 0);
    return { name: star.name, cost: packageCost, weightedDelta, axisDelta };
  }

  function renderTeamStarCandidates(team) {
    if (!teamCanRank(team) || team.format !== "standard") return "";
    const candidates = DATA.stars.filter(star => !star.isStarPair).map(star => ({ star, impact: starImpactForTeam(star, team) }))
      .filter(candidate => candidate.impact)
      .sort((a, b) => b.impact.weightedDelta - a.impact.weightedDelta ||
        (b.impact.weightedDelta / Math.max(1, b.impact.cost)) - (a.impact.weightedDelta / Math.max(1, a.impact.cost)) ||
        a.star.name.localeCompare(b.star.name));
    if (!candidates.length) return '<details class="team-star-fit"><summary>本队明星适配小排行 · 暂无可用候选</summary><p>当前名单没有可用的十一人制明星。</p></details>';
    const rows = candidates.map((candidate, index) => {
      const { star, impact } = candidate;
      const axes = impact.axisDelta.map((delta, axis) => DIMS[axis] + ' ' + signedPrecisePoints(delta, 1)).join(' · ');
      return '<li><button type="button" data-open-star-profile="' + esc(star.id) + '" data-team-id="' + esc(team.id) + '"><span class="team-star-rank">' + String(index + 1).padStart(2, '0') + '</span>' + objectVisualPair(star, "stars", "team-star-visual-pair") + '<span class="team-star-name"><b>' + esc(star.name) + '</b><small>' + esc(fullCurrency(impact.cost)) + '</small></span><strong class="team-star-gain">' + signedPrecisePoints(impact.weightedDelta, 2) + '<small>六维代理变化</small></strong><span class="team-star-axes">' + esc(axes) + '</span></button>' + renderTeamStarRuleEvidence(star) + '</li>';
    }).join('');
    return '<details class="team-star-fit"><summary>本队明星适配小排行 · ' + candidates.length + ' 名可用明星</summary><p>按明星加入当前参考阵容后的六维加权代理变化排序；显示全体可用候选，点击姓名可跳到明星档案。负值表示当前代理下加入后总分下降。</p><ol>' + rows + '</ol></details>';
  }

  function renderTeamStarRuleEvidence(star) {
    const members = starTeamBundle(star);
    const evidence = members.map(member => STAR_RULE_EVIDENCE.rules.find(rule => rule.starId === member.id &&
      (rule.format === "11s" || rule.format == null))).filter(Boolean);
    if (!evidence.length) return '';
    return evidence.map(rule => {
      const outcomes = (rule.probabilityRows || []).map(row => {
        const pct = value => value ? (value.exact ? (value.lower * 100).toFixed(1) + '%' : (value.lower * 100).toFixed(1) + '–' + (value.upper * 100).toFixed(1) + '%') : '—';
        return '<li>' + esc(row.scenario + '：' + row.event + ' ' + pct(row.success) + '；Turnover ' + pct(row.turnover)) + '</li>';
      }).join('');
      const task = rule.taskDescription || rule.context || rule.ruleSummary;
      const status = rule.taskStatus === 'verified-by-v6.1-targeted-task' ? 'Bloodboard V6.1 已验证' : '引擎规则已发现，任务待核';
      return '<details class="team-star-rule-evidence"><summary>规则情境证据：' + esc(rule.ruleName) + '</summary><p><b>使用条件：</b>' + esc(task) + '</p><p><b>规则效果：</b>' + esc(rule.ruleSummary) + '</p>' + (outcomes ? '<ul>' + outcomes + '</ul>' : '<p>该规则当前有触发/执行证据，但没有可直接对照的成功率列。</p>') + '<small>' + status + '。这是单次固定任务的条件证据；尚无比赛触发频率，因此不加进上方六维代理排序或性价比。</small></details>';
    }).join('');
  }

  function renderTeamMatchup(team) {
    const opponents = state.teamData.filter(other => other.id !== team.id && other.format === team.format && teamCanRank(other));
    const storageKey = "bb-atlas-matchup-opponent-" + team.format;
    let savedOpponent = "";
    try { savedOpponent = window.localStorage.getItem(storageKey) || ""; } catch (_) {}
    const opponentId = opponents.some(other => other.id === savedOpponent) ? savedOpponent : (opponents.find(other => other.rosterId !== team.rosterId)?.id || opponents[0]?.id || "");
    const chosen = opponents.find(other => other.id === opponentId) || opponents[0];
    const leagues = [...new Set(opponents.flatMap(other => other.leagueNames.length ? other.leagueNames : [""]))]
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
    const league = chosen && (chosen.leagueNames[0] || "");
    const leagueOptions = leagues.map(value => '<option value="' + esc(value) + '"' + (value === league ? ' selected' : '') + '>' + esc(value || "未标注赛区") + '</option>').join("");
    const eligible = opponents.filter(other => league ? other.leagueNames.includes(league) : !other.leagueNames.length);
    const rosters = [...new Map(eligible.map(other => [other.rosterId, other.rosterName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
    const rosterId = chosen && chosen.rosterId;
    const rosterOptions = rosters.map(([id, name]) => '<option value="' + esc(id) + '"' + (id === rosterId ? ' selected' : '') + '>' + esc(name) + '</option>').join("");
    const builds = eligible.filter(other => other.rosterId === rosterId);
    const teamOptions = builds.map(other => '<option value="' + esc(other.id) + '"' + (other.id === opponentId ? ' selected' : '') + '>' +
      esc(other.rosterName + ' · ' + other.formatName + (other.leagueNames.length ? ' · ' + other.leagueNames.join('、') : '')) + '</option>').join("");
    return '<details class="team-matchup"><summary>' + (standardMode() ? '两队六维对照 · 当前赋分' : '两队六维对照与明星补强建议') + '</summary><p>' + (standardMode() ? '按赛区、球队类型选择同赛制对手，比较当前标准任务赋分与绝对底分。' : '按赛区、球队类型逐步缩小同赛制对手范围，再比较六维名次赋分和双方可雇明星的阵容代理增量。') + '</p><form data-team-matchup-form="' + esc(team.id) + '"><label>赛区<select name="opponentLeague" data-opponent-league' + (opponents.length ? '' : ' disabled') + '>' + leagueOptions + '</select></label><label>球队类型<select name="opponentRoster" data-opponent-roster' + (rosters.length ? '' : ' disabled') + '>' + rosterOptions + '</select></label><label>具体阵容<select name="opponentTeamId" data-opponent-team' + (builds.length ? '' : ' disabled') + '>' + teamOptions + '</select></label><button type="submit"' + (opponents.length ? '' : ' disabled') + '>' + (standardMode() ? '比较当前六维' : '比较并找补强') + '</button></form><div class="team-matchup-result" data-team-matchup-result="' + esc(team.id) + '"><small>选择对手后生成六维差异、优势短板和明星候选。</small></div></details>';
  }

  function updateTeamMatchupChoices(form, changed) {
    const team = state.teamData.find(item => item.id === form.dataset.teamMatchupForm);
    if (!team) return;
    const opponents = state.teamData.filter(other => other.id !== team.id && other.format === team.format && teamCanRank(other));
    const league = form.elements.opponentLeague.value;
    const eligible = opponents.filter(other => league ? other.leagueNames.includes(league) : !other.leagueNames.length);
    const rosterSelect = form.elements.opponentRoster;
    const teamSelect = form.elements.opponentTeamId;
    const previousRoster = changed === "league" ? "" : rosterSelect.value;
    const rosters = [...new Map(eligible.map(other => [other.rosterId, other.rosterName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
    const rosterId = rosters.some(([id]) => id === previousRoster) ? previousRoster : (rosters[0]?.[0] || "");
    rosterSelect.innerHTML = rosters.map(([id, name]) => '<option value="' + esc(id) + '"' + (id === rosterId ? ' selected' : '') + '>' + esc(name) + '</option>').join("");
    const builds = eligible.filter(other => other.rosterId === rosterId);
    const previousTeam = changed === "team" ? teamSelect.value : "";
    const teamId = builds.some(other => other.id === previousTeam) ? previousTeam : (builds[0]?.id || "");
    teamSelect.innerHTML = builds.map(other => '<option value="' + esc(other.id) + '"' + (other.id === teamId ? ' selected' : '') + '>' + esc(other.rosterName + ' · ' + other.formatName + (other.leagueNames.length ? ' · ' + other.leagueNames.join('、') : '')) + '</option>').join("");
    rosterSelect.disabled = !rosters.length;
    teamSelect.disabled = !builds.length;
    if (teamId) {
      try { window.localStorage.setItem("bb-atlas-matchup-opponent-" + team.format, teamId); } catch (_) {}
    }
  }

  function teamSkillUpgradeSuggestions(team, deficitWeights) {
    const requestedAxes = deficitWeights.map((weight, axis) => weight > 0 ? axis : -1).filter(axis => axis >= 0);
    const relevantAxes = requestedAxes.length ? requestedAxes : DIMS.map((_, axis) => axis);
    const relevantLabels = new Set(relevantAxes.map(axis => DIMS[axis]));
    const cacheKey = [teamCacheKey, team.id, relevantAxes.join(",")].join("|");
    let candidates = teamSkillUpgradeCache.get(cacheKey);
    if (!candidates) {
      const baseline = team.rawScores || team.scores || [];
      candidates = [];
      for (const player of team.players || []) {
        const groups = eligibleEditorSkills({ skills: player.skills || [] }, team, player);
        for (const group of groups) for (const skill of group.options) {
          // Only rank skills whose current individual scoring branch has a numeric formula.
          // Conditional-only effects stay out until a matching team task is simulated.
          if (skill.scoringSupport !== "formula") continue;
          const skillDimensions = SKILL_EFFECTS[skill.id]?.dimensions || skill.scoringDimensions || [];
          if (!skillDimensions.some(dimension => relevantLabels.has(dimension))) continue;
          const trialPlayers = team.players.map(row => row.id === player.id
            ? Object.assign({}, row, { skills: (row.skills || []).map(item => Object.assign({}, item)).concat({ id: skill.id }) })
            : row);
          const trial = teamPlayerTaskAggregation(trialPlayers, team);
          const axisDelta = trial.scores.map((score, axis) => Number(score) - (Number(baseline[axis]) || 0));
          if (!axisDelta.some(delta => Math.abs(delta) >= 0.01)) continue;
          const weightedDelta = TEAM_OVERALL_WEIGHTS.reduce((sum, weight, axis) =>
            sum + weight * (Number(axisDelta[axis]) || 0), 0);
          candidates.push({ playerId: player.id, playerName: player.name, skillName: skill.name, category: group.title,
            axisDelta, weightedDelta, source: "legacy-individual-marginal" });
        }
      }
      candidates.sort((a, b) => b.weightedDelta - a.weightedDelta || a.playerName.localeCompare(b.playerName) || a.skillName.localeCompare(b.skillName));
      teamSkillUpgradeCache.set(cacheKey, candidates);
    }
    const deficitTotal = deficitWeights.reduce((sum, value) => sum + value, 0);
    return candidates.map(candidate => Object.assign({}, candidate, {
      matchupRelief: deficitTotal
        ? candidate.axisDelta.reduce((sum, value, axis) => sum + deficitWeights[axis] * value, 0) / deficitTotal
        : candidate.weightedDelta
    })).filter(candidate => candidate.matchupRelief > 0.01)
      .sort((a, b) => b.matchupRelief - a.matchupRelief || b.weightedDelta - a.weightedDelta)
      .slice(0, 3);
  }

  function teamMatchupResult(team, opponent) {
    if (!teamCanRank(team) || !teamCanRank(opponent) || team.format !== opponent.format) return '<p>只比较已通过 V7.0.1 校验的同赛制参考阵容。</p>';
    const deltas = (team.overallAssignedDimensions || []).map((value, axis) => Number(value) - (Number(opponent.overallAssignedDimensions?.[axis]) || 0));
    const rows = deltas.map((delta, axis) => '<li><b>' + esc(DIMS[axis]) + '</b><span>' + Number(team.overallAssignedDimensions[axis]).toFixed(1) + ' : ' + Number(opponent.overallAssignedDimensions[axis]).toFixed(1) + '</span><em class="' + (delta > 0 ? 'advantage' : delta < 0 ? 'disadvantage' : '') + '">' + signedPrecisePoints(delta, 1) + '</em></li>').join('');
    const positive = deltas.map((value, axis) => ({ value, axis })).filter(item => item.value >= 5).sort((a, b) => b.value - a.value);
    const negative = deltas.map((value, axis) => ({ value, axis })).filter(item => item.value <= -5).sort((a, b) => a.value - b.value);
    const summary = '<p><b>' + esc(team.rosterName) + ' 相对强项：</b>' + (positive.length ? positive.map(row => DIMS[row.axis] + '（+' + row.value.toFixed(1) + '）').join('、') : '暂未形成明显优势') + '</p><p><b>' + esc(team.rosterName) + ' 相对短板：</b>' + (negative.length ? negative.map(row => DIMS[row.axis] + '（' + row.value.toFixed(1) + '）').join('、') : '暂未形成明显短板') + '</p>';
    const recommendations = (subject, rival) => {
      const deficitWeights = (subject.overallAssignedDimensions || []).map((value, axis) =>
        Math.max(0, Number(rival.overallAssignedDimensions?.[axis] || 0) - Number(value || 0) - 5));
      const deficitTotal = deficitWeights.reduce((sum, value) => sum + value, 0);
      const stars = DATA.stars.filter(star => !star.isStarPair).map(star => {
        const impact = starImpactForTeam(star, subject);
        if (!impact) return null;
        // Keep the catalogue identity so the recommendation can reuse its canonical portrait and six-axis dossier.
        impact.id = star.id;
        impact.matchupRelief = deficitTotal
          ? impact.axisDelta.reduce((sum, value, axis) => sum + deficitWeights[axis] / deficitTotal * Math.max(0, Number(value) || 0), 0)
          : impact.weightedDelta;
        return impact;
      }).filter(Boolean).sort((a, b) => b.matchupRelief - a.matchupRelief || b.weightedDelta - a.weightedDelta).slice(0, 3);
      const skillCandidates = teamSkillUpgradeSuggestions(subject, deficitWeights);
      const reliefLabel = deficitTotal ? '短板补强指数 ' : '全维增量 ';
      return '<ul>' + (stars.length ? stars.map(star => '<li class="matchup-star-row">' + objectVisualPair(DATA.stars.find(item => item.id === star.id) || star, "stars", "matchup-star-visual-pair") + '<span><b>' + esc(star.name) + '</b> · ' + esc(fullCurrency(star.cost)) + ' · ' + reliefLabel + signedPrecisePoints(star.matchupRelief, 3) + ' · 总代理变化 ' + signedPrecisePoints(star.weightedDelta, 3) + '。' + esc(DIMS.map((axis, index) => axis + ' ' + signedPrecisePoints(star.axisDelta[index], 1)).join(' / ')) + '</span></li>').join('') : '<li>没有可用且能提高当前阵容代理分的明星。</li>') + '</ul>' +
        '<h5>合法技能类别试算（假设单名球员学会一项）</h5><ul>' + (skillCandidates.length ? skillCandidates.map(skill => '<li class="matchup-skill-row">' + objectVisualPair(subject.players.find(player => player.id === skill.playerId) || { id: skill.playerId, name: skill.playerName }, "players", "matchup-skill-visual-pair", subject.format, subject) + '<span><b>' + esc(skill.skillName) + ' → ' + esc(skill.playerName) + '</b> · ' + esc(skill.category) + ' · ' + reliefLabel + signedPrecisePoints(skill.matchupRelief, 3) + ' · 总六维代理变化 ' + signedPrecisePoints(skill.weightedDelta, 3) + '。' + esc(DIMS.map((axis, index) => axis + ' ' + signedPrecisePoints(skill.axisDelta[index], 1)).join(' / ')) + '</span></li>').join('') : '<li>现有可量化的合法技能分支中，没有发现能提高这组短板代理的单技能方案。</li>') + '</ul>' +
        '<small>按球队与位置检查主/副技能类别及现有技能冲突；“合法”指类别资格，不代表球员已有足够 SPP、球队负担得起，也不代表该升级可立即购买。仅列能改变当前个人数值边际公式且对这组短板有正增量的技能。假设学会后，把该球员的个人边际分加到 V7.0.1 候选档案，再按现有阵容聚合公式重算；球队权重与总评顺序保持一致。这是可解释的静态估算，不是修改阵容后的 Bloodboard 引擎重放；不含技能联动、SPP/金币成本、动态控场重算，亦不代表未纳入数值分支的条件技能无用。</small>';
    };
    const overallDelta = (Number(team.overallAssignedScore) || 0) - (Number(opponent.overallAssignedScore) || 0);
    return '<div class="team-matchup-head"><b>' + esc(fullTeamName(team)) + '</b><span>' + signedPrecisePoints(overallDelta, 1) + ' 名次赋分差</span><b>' + esc(fullTeamName(opponent)) + '</b></div><ul class="team-matchup-axes">' + rows + '</ul>' + summary + '<section><h4>' + esc(team.rosterName) + ' 的补强候选</h4>' + recommendations(team, opponent) + '</section><section><h4>' + esc(opponent.rosterName) + ' 的补强候选</h4>' + recommendations(opponent, team) + '</section><small>这是同赛制六维名次赋分对照，不是对局胜率、行动顺序模拟或战术胜负预测。若有至少 5 点相对短板，明星候选优先按该队落后的维度筛选，再用代理总变化作并列参考；否则按全维代理增量排序。尚未计入规则触发频率、预算重建、临场站位和对手针对性。单项代理等级/得分仅用于当前比较组。</small>';
  }

  function teamTaskReference(team, preferences = teamTaskPreferences[team.id] || {}) {
    const options = {
      players: team.players, format: team.format === "sevens" ? "sevens" : "11s",
      teamName: fullTeamName(team), teamRosterId: team.rosterId,
      pressure: preferences.pressure === "marked" ? "marked" : "open",
      teamRerolls: [0, 1, team.rerolls].includes(Number(preferences.teamRerolls)) ? Number(preferences.teamRerolls) : 1,
      includeLeaderReroll: preferences.includeLeaderReroll !== false
    };
    const key = JSON.stringify(options);
    const cached = teamTaskReferenceCache.get(team.id);
    if (cached?.key === key) return cached;
    const reference = window.BB_BLOODBOARD_ENGINE.createTeamGroundBallReference(options);
    const created = { key, reference };
    teamTaskReferenceCache.set(team.id, created);
    return created;
  }

  function resolvedTeamTaskPreferences(team, reference) {
    const saved = teamTaskPreferences[team.id] || {};
    const fielded = reference.state.players.filter(player => player.team === "A" && player.location === "pitch");
    const preferred = fielded.slice().sort((a, b) =>
      Number(b.skills.some(skill => skill.id === "sureHands")) - Number(a.skills.some(skill => skill.id === "sureHands")) || a.ag - b.ag || b.ma - a.ma)[0];
    const reserves = reference.state.players.filter(player => player.team === "A" && player.location === "reserves");
    return {
      focalPlayerId: fielded.some(player => player.id === saved.focalPlayerId) ? saved.focalPlayerId : preferred.id,
      reservePlayerId: Object.hasOwn(saved, "reservePlayerId") ? (reserves.some(player => player.id === saved.reservePlayerId) ? saved.reservePlayerId : "") : (reserves[0]?.id || ""),
      pressure: reference.scenario.pressure,
      teamRerolls: reference.scenario.resources.teamRerolls,
      includeLeaderReroll: reference.scenario.resources.includeLeaderReroll
    };
  }

  function teamTaskBoard(reference, focalPlayerId) {
    const pitch = window.BB_BLOODBOARD_ENGINE.getPitchDimensions(reference.scenario.format);
    const unit = 22, pad = 16, width = pitch.width * unit, height = pitch.height * unit;
    let svg = '<svg class="team-task-board" viewBox="0 0 ' + (width + pad * 2) + ' ' + (height + pad * 2) + '" role="img" aria-label="固定参考棋盘：黄色为选定球员，蓝色为队友，红色为对手，白色为' + (reference.state.ball.kind === 'held' ? '持有的球' : '地上的球') + '"><rect x="' + pad + '" y="' + pad + '" width="' + width + '" height="' + height + '" fill="#152623"/>';
    for (let x = 0; x <= pitch.width; x++) svg += '<path d="M' + (pad + x * unit) + ',' + pad + 'v' + height + '" stroke="#31443c" stroke-width=".6"/>';
    for (let y = 0; y <= pitch.height; y++) svg += '<path d="M' + pad + ',' + (pad + y * unit) + 'h' + width + '" stroke="#31443c" stroke-width=".6"/>';
    for (let x = 0; x < pitch.width; x++) svg += '<text x="' + (pad + (x + .5) * unit) + '" y="11" text-anchor="middle" fill="#83998b" font-size="9">' + x + '</text>';
    for (let y = 0; y < pitch.height; y++) svg += '<text x="9" y="' + (pad + (y + .5) * unit + 3) + '" text-anchor="middle" fill="#83998b" font-size="9">' + y + '</text>';
    reference.state.players.filter(player => player.location === "pitch").forEach(player => {
      const selected = player.id === focalPlayerId;
      const color = selected ? "#efd071" : player.team === "A" ? "#719aaf" : "#c97a69";
      svg += '<g><title>' + esc('#' + player.number + ' ' + player.name + ' · (' + player.pos.x + ',' + player.pos.y + ')') + '</title><circle cx="' + (pad + (player.pos.x + .5) * unit) + '" cy="' + (pad + (player.pos.y + .5) * unit) + '" r="9" fill="' + color + '"/><text x="' + (pad + (player.pos.x + .5) * unit) + '" y="' + (pad + (player.pos.y + .5) * unit + 3) + '" text-anchor="middle" fill="#0d171b" font-size="10" font-weight="bold">' + (player.team === "A" ? esc(player.number) : '敌') + '</text></g>';
    });
    const held = reference.state.ball.kind === "held";
    const ball = held ? reference.state.players.find(player => player.id === reference.state.ball.playerId).pos : reference.state.ball.pos;
    return svg + '<g><title>' + (held ? '持球' : '地上的球') + ' · (' + ball.x + ',' + ball.y + ')</title><ellipse cx="' + (pad + (ball.x + .5) * unit + (held ? 8 : 0)) + '" cy="' + (pad + (ball.y + .5) * unit + (held ? 7 : 0)) + '" rx="7" ry="4" fill="#f0e4c7" stroke="#ccad6c"/></g></svg>';
  }

  function taskProbabilityText(measure, scale = 100, suffix = "%") {
    if (!measure) return "—";
    if (measure.exact) return (Number(measure.value ?? measure.lowerBound) * scale).toFixed(2) + suffix;
    const lower = (measure.lowerBound * scale).toFixed(2), upper = (measure.upperBound * scale).toFixed(2);
    return lower === upper ? '≈' + lower + suffix + '（保留区间）' : lower + "–" + upper + suffix;
  }

  function teamTaskResultHTML(result, reference) {
    const nameFor = id => reference.state.players.find(player => player.id === id)?.name || id;
    const chosenPlan = branch => {
      const policy = branch.candidates.find(candidate => candidate.id === branch.selectedPolicyId);
      const input = policy?.inputs[0];
      return input ? nameFor(input.playerId) + ' · ' + (input.action === "secure" ? "Secure the Ball" : "普通拾球") + ' · ' + input.path.length + ' 格路线' : "声明方案中没有可完成任务的行动";
    };
    const cell = branch => '<td><b>' + taskProbabilityText(branch.bestDeclaredTaskProbability) + '</b><small>' + esc(chosenPlan(branch)) + '</small><small>该方案 Turnover ' + taskProbabilityText(branch.selectedPolicyTurnover) + '</small>' + (branch.selectionCertain ? '' : '<small>候选区间重叠，最优选择尚不确定</small>') + '</td>';
    const lossCell = measure => '<td>' + (measure ? taskProbabilityText(measure, 100, ' 个百分点') : '—') + '</td>';
    const rows = [{ label: "完整阵容", data: result.baseline }].concat(result.comparisons.map(comparison => ({
      label: comparison.reservePlayerId ? "下一进攻段参考名单 · " + nameFor(comparison.reservePlayerId) + " 接任" : "本进攻段缺阵 · 队友重新分工", data: comparison
    })));
    const rowHTML = rows.map(row => '<tr><th>' + esc(row.label) + '</th>' +
      cell(row.data.byRerollPolicy.withoutTeamRerolls) + lossCell(row.data.lossByRerollPolicy?.withoutTeamRerolls) +
      cell(row.data.byRerollPolicy.withTeamRerolls) + lossCell(row.data.lossByRerollPolicy?.withTeamRerolls) + '</tr>').join('');
    const diagnostics = rows.flatMap(row => row.data.byRerollPolicy.withTeamRerolls.candidates.filter(candidate => !candidate.legal).map(candidate =>
      '<li><b>' + esc(row.label) + ' · ' + esc(candidate.inputs[0] ? nameFor(candidate.inputs[0].playerId) : candidate.id) + '</b><br>' + esc(candidate.errors.join('；')) + '</li>'));
    const resources = rows.map(row => {
      const branch = row.data.byRerollPolicy.withTeamRerolls;
      const remainder = Object.entries(branch.selectedPolicyRemainingRerolls).map(([amount, probability]) => amount + ' 次（' + (100 * probability).toFixed(2) + '%）').join('、');
      const chosen = branch.candidates.find(candidate => candidate.id === branch.selectedPolicyId);
      return '<li><b>' + esc(row.label) + '</b> · 剩余团队重掷分布：' + esc(remainder) + '；Leader 终局仍可用概率 ' + (100 * (chosen?.leaderRerollAvailableProbability || 0)).toFixed(2) + '%。</li>';
    }).join('');
    return '<p class="team-task-result-title">失去 <b>' + esc(nameFor(result.scenario.focalPlayerId)) + '</b> 后的安全夺回球权能力</p>' +
      '<div class="team-impact-scroll"><table><thead><tr><th>名单状态</th><th>无团队 / Leader 重掷</th><th>相对完整阵容损失</th><th>允许 ' + reference.scenario.resources.teamRerolls + ' 枚团队重掷' + (reference.scenario.resources.includeLeaderReroll ? '及声明的 Leader 资源' : '') + '</th><th>相对完整阵容损失</th></tr></thead><tbody>' + rowHTML + '</tbody></table></div>' +
      '<details><summary>资源消耗与不合法候选 · ' + diagnostics.length + ' 条排除记录</summary><ul>' + resources + '</ul>' + (diagnostics.length ? '<ul class="team-task-diagnostics">' + diagnostics.join('') + '</ul>' : '<p>所有声明候选均通过此任务的行动合法性检查。</p>') + '</details>' +
      '<button type="button" class="featured-action" data-export-team-task="' + esc(result.teamId) + '">导出计算条件与完整结果</button>' +
      '<details data-team-task-json><summary>可复制的完整 JSON</summary><textarea readonly aria-label="计算条件与完整结果 JSON" rows="10"></textarea></details>';
  }

  function renderTeamTaskExperiment(team) {
    try {
      const cached = teamTaskReference(team);
      const reference = cached.reference;
      const preferences = resolvedTeamTaskPreferences(team, reference);
      const fielded = reference.state.players.filter(player => player.team === "A" && player.location === "pitch");
      const reserves = reference.state.players.filter(player => player.team === "A" && player.location === "reserves");
      const option = (value, label, selected) => '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
      const rrValues = Array.from(new Set([0, 1, Number(team.rerolls) || 0])).sort((a, b) => a - b);
      const resultKey = cached.key + JSON.stringify(preferences);
      const savedResult = teamTaskResultCache.get(team.id);
      const result = savedResult?.key === resultKey ? savedResult.result : null;
      const coordinateRows = reference.scenario.formation.map(player => '<li>#' + esc(player.number) + ' ' + esc(player.name) + ' · ' +
        (player.at ? '(' + player.at.x + ',' + player.at.y + ')' : '现有替补') + (player.veteran ? ' · Veteran ' + esc(player.veteran) : '') + '</li>').join('');
      return '<details class="team-task-experiment"><summary>真实规则任务 · 选择球员查看缺阵影响</summary>' +
        '<p>使用这份实际名单、购入技能和固定参考站位；任务是在一名球员的行动结束后，球队持球且未发生 Turnover。队友分别尝试接任，成功率取合法声明方案中的最高值。</p>' +
        '<form data-team-task-form="' + esc(team.id) + '"><div class="team-task-controls">' +
        '<label>失去哪名球员<select name="focalPlayerId" aria-label="失去哪名球员">' + fielded.map(player => option(player.id, '#' + player.number + ' ' + player.name, preferences.focalPlayerId)).join('') + '</select></label>' +
        '<label>球周围的压力<select name="pressure" aria-label="球周围的压力">' + option('open', '无对手标记', preferences.pressure) + option('marked', '一名 ST3 对手标记球', preferences.pressure) + '</select></label>' +
        '<label>下一进攻段替补对照<select name="reservePlayerId" aria-label="下一进攻段替补对照">' + option('', reserves.length ? '不启用替补，只看队友接任' : '这份名单没有现有替补', preferences.reservePlayerId) + reserves.map(player => option(player.id, '#' + player.number + ' ' + player.name, preferences.reservePlayerId)).join('') + '</select></label>' +
        '<label>模拟团队重掷池<select name="teamRerolls" aria-label="模拟团队重掷池">' + rrValues.map(value => option(String(value), value + ' 枚' + (value === team.rerolls ? '（名单配置）' : '（任务对照）'), String(preferences.teamRerolls))).join('') + '</select></label></div>' +
        '<label class="team-task-leader"><input type="checkbox" name="includeLeaderReroll"' + (preferences.includeLeaderReroll ? ' checked' : '') + '>计入当前场上可用的 Leader 重掷</label>' +
        '<button type="submit" class="featured-action">计算缺阵影响</button></form>' +
        '<div class="team-task-board-scroll">' + teamTaskBoard(reference, preferences.focalPlayerId) + '</div>' +
        '<small>黄：选定球员 · 蓝：队友 · 红：对手 · 白：地上的球。数字为球衣号；坐标从 0 开始。球位于 (' + reference.scenario.ballAt.x + ',' + reference.scenario.ballAt.y + ')。七人制按档案保留 Veteran 与已调整的移动值。</small>' +
        '<details><summary>查看完整参考站位</summary><ul class="team-task-lineup">' + coordinateRows + '</ul></details>' +
        '<div class="team-task-result" data-team-task-result aria-live="polite">' + (result ? teamTaskResultHTML(result, reference) : '<p>选择条件后计算；这里显示规则任务概率，不使用上方旧评分。</p>') + '</div>' +
        '<small>阵型按球衣号部署前 ' + fielded.length + ' 人并校验己方开球站位；这不是最优首发或实际开球过程。每人提供一条引擎候选路线及普通拾球 / Secure the Ball 方案，缺阵后会重新寻找队友路线。它不搜索整回合，也未校准成六维等级；替补不能在本进攻段临时换入。<span>查看公式与边界（后台资料）</span></small></details>';
    } catch (error) {
      return '<details class="team-task-experiment"><summary>真实规则任务 · 当前名单需要复核</summary><p>' + esc(error.message) + '</p></details>';
    }
  }

  function rememberTeamTaskPreferences(form) {
    const preferences = {
      focalPlayerId: form.elements.focalPlayerId.value, reservePlayerId: form.elements.reservePlayerId.value,
      pressure: form.elements.pressure.value, teamRerolls: Number(form.elements.teamRerolls.value),
      includeLeaderReroll: form.elements.includeLeaderReroll.checked
    };
    teamTaskPreferences[form.dataset.teamTaskForm] = preferences;
    try { window.localStorage.setItem(teamTaskPreferenceKey, JSON.stringify(teamTaskPreferences)); } catch (_) {}
    return preferences;
  }

  function carrierThreatReference(team, preferences = carrierThreatPreferences[team.id] || {}) {
    const base = teamTaskReference(team, { pressure: "open", teamRerolls: 0, includeLeaderReroll: false });
    const eligible = base.reference.state.players.filter(player => player.team === "A" && player.location === "pitch" && !player.skills.some(skill => skill.id === "noBall"));
    const preferred = eligible.slice().sort((a, b) =>
      Number(b.skills.some(skill => skill.id === "sureHands")) - Number(a.skills.some(skill => skill.id === "sureHands")) || a.ag - b.ag || b.ma - a.ma)[0];
    if (!preferred) throw new Error("这份场上名单没有可以持球的球员。");
    const chosen = {
      carrierPlayerId: eligible.some(player => player.id === preferences.carrierPlayerId) ? preferences.carrierPlayerId : preferred.id,
      attackerStrength: [3,4,5,6].includes(Number(preferences.attackerStrength)) ? Number(preferences.attackerStrength) : 3,
      threat: ["normal","stripBall","tackle"].includes(preferences.threat) ? preferences.threat : "normal",
      attackerRerolls: preferences.attackerRerolls === 0 ? 0 : 1
    };
    const prepared = window.BB_BLOODBOARD_ENGINE.prepareTeamCarrierThreat({ reference: base.reference, ...chosen });
    return { prepared, preferences: chosen, eligible, key: base.key + JSON.stringify(chosen) };
  }

  function carrierThreatResultHTML(result) {
    const carrier = result.replay.state.players.find(player => player.id === result.replay.carrierPlayerId);
    const attacker = result.replay.state.players.find(player => player.id === result.replay.input.playerId);
    const threatNames = attacker.skills.map(skill => SKILL_CATALOG.find(entry => entry.id === skill.id)?.name || skill.id).join(" + ");
    const rows = [
      ["原持球人本人保球", branch => branch.possession.carrier],
      ["球在另一名队友手中", branch => branch.possession.teammate],
      ["球队仍持球（上述两项之和）", branch => branch.teamRetention],
      ["球在对手手中", branch => branch.possession.opponent],
      ["球留在地上", branch => branch.possession.ground],
      ["其他球状态", branch => branch.possession.other],
      ["原持球人站立且仍持球", branch => branch.standingWithBall],
      ["原持球人站立", branch => branch.carrierCondition.standing],
      ["原持球人倒地但未眩晕", branch => branch.carrierCondition.prone],
      ["原持球人眩晕", branch => branch.carrierCondition.stunned],
      ["原持球人已离场", branch => branch.carrierCondition.removed],
      ["来袭方发生 Turnover", branch => branch.attackingTeamTurnover]
    ];
    return '<p><b>持球保护 · 同一完整结果树的终局分布</b><br><small>#' + carrier.number + ' ' + esc(carrier.name) + ' · ST' + carrier.st + ' · 来袭 ST' + attacker.st + ' / ' + esc(threatNames) + '</small></p><div class="team-impact-scroll"><table><thead><tr><th>行动结束后的结果</th><th>来袭方无团队重掷</th><th>来袭方允许 ' + result.scenario.attackingTeamRerolls + ' 枚团队重掷</th></tr></thead><tbody>' +
      rows.map(([label, value]) => '<tr><th>' + esc(label) + '</th><td><b>' + taskProbabilityText(value(result.policies.withoutTeamRerolls)) + '</b></td><td><b>' + taskProbabilityText(value(result.policies.withTeamRerolls)) + '</b></td></tr>').join('') +
      '</tbody></table></div><p>本人、另一队友、对手、地上、其他球状态是互斥分布；“球队仍持球”是本人和队友两项之和，不再当作第三个独立概率相加。站立/倒地/眩晕/离场另为一个互斥分布。未解析部分保留区间。</p>' +
      '<button type="button" class="featured-action" data-carrier-json="' + esc(result.teamId) + '">查看持球保护的完整 JSON</button><details data-carrier-json-preview><summary>可复制的棋盘、规则输入与结果</summary><textarea readonly rows="10" aria-label="持球保护完整 JSON"></textarea></details>';
  }

  function renderTeamCarrierExperiment(team) {
    try {
      const current = carrierThreatReference(team);
      const preferences = current.preferences;
      const option = (value, label, selected) => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
      const result = carrierThreatResultCache.get(team.id);
      const carrier = current.prepared.state.players.find(player => player.id === preferences.carrierPlayerId);
      return '<details class="team-task-experiment carrier-threat-experiment"><summary>真实规则任务 · 持球保护</summary>' +
        '<p>原持球人从站立持球开始，真实队友保持参考站位。来袭方已在相邻空格，以 Block 攻击；比较本人保球、球队保球和离场结果，不模拟之后的抢球动作。</p>' +
        '<form data-carrier-threat-form="' + esc(team.id) + '"><div class="team-task-controls">' +
        '<label>持球人<select name="carrierPlayerId" aria-label="持球人">' + current.eligible.map(player => option(player.id, '#' + player.number + ' ' + player.name, preferences.carrierPlayerId)).join('') + '</select></label>' +
        '<label>来袭方力量<select name="attackerStrength" aria-label="来袭方力量">' + [3,4,5,6].map(st => option(st, 'ST' + st, preferences.attackerStrength)).join('') + '</select></label>' +
        '<label>威胁技能<select name="threat" aria-label="威胁技能">' + option('normal','普通：Block',preferences.threat) + option('stripBall','剥球：Block + Strip Ball',preferences.threat) + option('tackle','针对闪避：Block + Tackle',preferences.threat) + '</select></label>' +
        '<label>来袭方重掷池<select name="attackerRerolls" aria-label="来袭方重掷池">' + [0,1].map(value => option(value, value + ' 枚', preferences.attackerRerolls)).join('') + '</select></label></div>' +
        '<button type="submit" class="featured-action">计算持球保护</button></form>' +
        '<details class="carrier-reference-board"><summary>查看完整持球参考棋盘与站位</summary><div class="team-task-board-scroll">' + teamTaskBoard({ state: current.prepared.state, scenario: current.prepared.reference }, preferences.carrierPlayerId) + '</div>' +
        '<small>黄：持球人 ' + esc(carrier.name) + '（ST' + carrier.st + '） · 蓝：队友 · 红：来袭者 · 白：持球标记。防守支援由真实站位决定；双方不额外获得虚构助攻。此任务禁用持球队的团队/Leader 资源，来袭方重掷单独声明；球员规则技能仍由引擎处理。</small></details>' +
        '<div class="team-task-result" data-carrier-threat-result aria-live="polite">' + (result?.key === current.key ? carrierThreatResultHTML(result.result) : '<p>选择持球人和威胁后计算；No Ball 球员不出现在持球人列表中。</p>') + '</div>' +
        '<small>固定阵型、单次相邻攻击；来袭方无移动与支援。引擎的选骰、推挤与反应策略不等同全场最优战术，不按这一个局面生成球权或可靠性总分。<span>查看条件与公式（后台资料）</span></small></details>';
    } catch (error) {
      return '<details class="team-task-experiment carrier-threat-experiment"><summary>真实规则任务 · 持球保护需要复核</summary><p>' + esc(error.message) + '</p></details>';
    }
  }

  function rememberCarrierPreferences(form) {
    const preferences = { carrierPlayerId: form.elements.carrierPlayerId.value,
      attackerStrength: Number(form.elements.attackerStrength.value), threat: form.elements.threat.value,
      attackerRerolls: Number(form.elements.attackerRerolls.value) };
    carrierThreatPreferences[form.dataset.carrierThreatForm] = preferences;
    try { window.localStorage.setItem(carrierPreferenceKey, JSON.stringify(carrierThreatPreferences)); } catch (_) {}
    return preferences;
  }

  const ROLE_TASK_LABELS = { block: "锚点／阻挡：安全击倒目标", move: "重新部署：站立抵达目标格", pickup: "持球人：接近地上球并保球", pass: "传球者：指定接应者最终持球", handoff: "交接：指定接应者最终持球", foul: "犯规者：安全移出倒地目标", ballAndChain: "球链：一次随机移动后安全击倒指定目标", chainsaw: "电锯：安全移出相邻站立目标" };

  function roleTaskReference(person, preferences = roleTaskPreferences[person.id] || {}) {
    const star = DATA.stars.some(item => item.id === person.id);
    const skillIds = (person.skills || []).map(skill => typeof skill === "string" ? skill : skill.id);
    const noBall = skillIds.includes("noBall");
    const taskIds = Object.keys(ROLE_TASK_LABELS).filter(task =>
      (task !== "ballAndChain" && task !== "chainsaw" || skillIds.includes(task)) &&
      (!skillIds.includes("ballAndChain") || task === "ballAndChain") &&
      (!noBall || !["pickup", "pass", "handoff"].includes(task)));
    const recommended = window.BB_BLOODBOARD_ENGINE.recommendPlayerRoleTask(person);
    const chosen = {
      taskId: taskIds.includes(preferences.taskId) ? preferences.taskId : recommended,
      format: !star && (preferences.format === "sevens" || !preferences.format && state.format === "sevens") ? "sevens" : "11s",
      teamRerolls: preferences.teamRerolls === 0 ? 0 : 1,
      distance: Number.isInteger(preferences.distance) ? clamp(preferences.distance, 1, 12) : 4,
      support: ["none", "lineman", "thrall"].includes(preferences.support) ? preferences.support : "none"
    };
    const key = JSON.stringify({ player: { id: person.id, name: person.name, ma: person.ma, st: person.st, ag: person.ag, pa: person.pa, av: person.av, skills: person.skills, boughtSkill: person.boughtSkill, veteran: person.veteran, keywords: person.keywords }, ...chosen, star });
    return { preferences: chosen, taskIds, key, prepare: () => window.BB_BLOODBOARD_ENGINE.preparePlayerRoleTask({ player: person, ...chosen, starId: star ? person.id : null }) };
  }

  function roleTaskResultHTML(result) {
    const branchFor = policy => result[policy];
    const probability = (branch, field) => taskProbabilityText(branch[field]);
    const initialRerolls = result.scenario.initialTeamRerolls;
    const freeSuccess = branch => ({ lowerBound: Math.min(1, branch.taskSuccessRemainingTeamRerolls[initialRerolls] || 0),
      upperBound: Math.min(1, (branch.taskSuccessRemainingTeamRerolls[initialRerolls] || 0) + branch.unresolved), exact: branch.unresolved <= 1e-12 });
    const rows = [
      ["声明输入完整执行（含激活及收尾）", branch => probability(branch, "completedDeclaredSequenceProbability")],
      ["达到目标状态（允许同时发生 Turnover）", branch => taskProbabilityText(branch.eventProbabilities.objective)],
      ["完成声明职责目标且无 Turnover", branch => probability(branch, "taskSuccessProbability")],
      ["终点本人仍有盯防区（站立且未失效）", branch => taskProbabilityText(branch.eventProbabilities.focalTackleZones)],
      ["本次职责行动发生 Turnover", branch => probability(branch, "turnoverProbability")],
      ["目标成功且未消耗团队重掷（联合事件）", branch => taskProbabilityText(freeSuccess(branch))]
    ];
    const resources = ["withoutTeamRerolls", "withTeamRerolls"].map(policy => {
      const branch = branchFor(policy);
      const budget = result.observations.find(observation => observation.submetricId === "reliability.rerollBudget" && observation.context.taskParameters.rerollPolicy === policy);
      return '<li><b>' + (policy === "withoutTeamRerolls" ? "不使用团队重掷" : "允许团队重掷") + '</b>：' + Object.entries(budget.distribution).map(([amount, bounds]) => '剩余 ' + amount + ' 枚 ' + taskProbabilityText({ ...bounds, exact: budget.exact })).join('；') +
        (branch.unresolved > 1e-12 ? '。未解析概率质量 ' + (branch.unresolved * 100).toPrecision(3) + '%，各项区间不能当独立分布相加。' : '。') + '</li>';
    }).join('');
    return '<p class="team-task-result-title"><b>' + esc(ROLE_TASK_LABELS[result.reference.taskId]) + '</b> · 职责 ' + esc(result.roleId) + '</p><div class="team-impact-scroll"><table><thead><tr><th>同一结果树的不同观察</th><th>不使用团队 / Leader 重掷</th><th>允许 ' + initialRerolls + ' 枚团队重掷</th></tr></thead><tbody>' + rows.map(([label, value]) => '<tr><th>' + esc(label) + '</th><td><b>' + value(branchFor('withoutTeamRerolls')) + '</b></td><td><b>' + value(branchFor('withTeamRerolls')) + '</b></td></tr>').join('') + '</tbody></table></div><ul>' + resources + '</ul>' +
      '<p>“输入完整执行”不是纯特性检定通过率，也不等于完成职责：例如安全推出对手可完成 Block 输入，却没有击倒目标。传接目标按终局指定接应者持球判断，包含引擎结算的散球与反弹。</p>' +
      '<p>终点按完整激活收尾；此前出现 Turnover 或达阵就停止。站立抵达仍可能同时失去盯防区，例如 Bloodlust 无法咬到 Thrall 后变为 Distracted。目标状态、无 Turnover 和盯防区是分别观察的事件，不能相加当总分。</p>' +
      '<button type="button" class="featured-action" data-role-json>查看职责任务的完整 JSON</button><details data-role-json-preview><summary>可复制的初始棋盘、事件、资源与结果</summary><textarea readonly rows="10" aria-label="职责任务完整 JSON"></textarea></details>';
  }

  function renderPlayerRoleExperiment(person) {
    const current = roleTaskReference(person);
    const preferences = current.preferences;
    const star = DATA.stars.some(item => item.id === person.id);
    const option = (value, label, selected) => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
    let board;
    try {
      const prepared = current.prepare();
      board = '<details><summary>查看职责参考棋盘与任务条件</summary><div class="team-task-board-scroll">' + teamTaskBoard({ state: prepared.state, scenario: prepared.reference }, 'role-actor') + '</div><small>黄：被评价球员；蓝：声明队友；红：ST3 / AV9、无技能的目标；接应者 AG3、无 Catch。帮手固定站在球员身后一格；不会随移动自动跟随。Block 不跟进，普通 Foul 以已经倒地的目标开始。传球距离三格，无拦截者；交接目标相邻。</small></details>';
    } catch (error) { board = '<p class="model-pending">当前职责输入不适用：' + esc(error.message) + '。请换一个职责；不记为零分。</p>'; }
    const cached = roleTaskResultCache.get(person.id);
    return '<details class="team-task-experiment role-task-experiment"><summary>真实规则任务 · 职责相关的可靠性</summary><p>选择这个球员要承担的职责，再看完成目标、Turnover 和有限重掷消耗。原始概率来自完整行动与结束激活；不同职责不平均成一个可靠性分。</p>' +
      '<form data-role-task-form="' + esc(person.id) + '"><div class="team-task-controls"><label>声明职责<select name="taskId" aria-label="声明职责">' + current.taskIds.map(task => option(task, ROLE_TASK_LABELS[task], preferences.taskId)).join('') + '</select></label>' +
      '<label>任务赛制<select name="format" aria-label="任务赛制">' + option('11s', '十一人制', preferences.format) + (star ? '' : option('sevens', '七人制', preferences.format)) + '</select></label>' +
      '<label>起始团队重掷<select name="teamRerolls" aria-label="起始团队重掷">' + [0,1].map(value => option(value, value + ' 枚', preferences.teamRerolls)).join('') + '</select></label>' +
      '<label>声明支援<select name="support" aria-label="声明支援">' + option('none', '无队友', preferences.support) + option('lineman', '相邻普通站立队友', preferences.support) + option('thrall', '相邻 Thrall（可咬）', preferences.support) + '</select></label>' +
      (preferences.taskId === 'move' ? '<label>开阔目标距离<input name="distance" type="number" min="1" max="12" value="' + preferences.distance + '" aria-label="开阔目标距离"></label>' : '<input name="distance" type="hidden" value="' + preferences.distance + '">') + '</div><button type="submit" class="featured-action">计算职责任务</button></form>' + board +
      '<div class="team-task-result" data-role-task-result aria-live="polite">' + (cached?.key === current.key ? roleTaskResultHTML(cached.result) : '<p>按当前属性和技能计算；编辑应用后旧结果自动失效。</p>') + '</div>' +
      '<small>这里没有 Leader 额外资源。规则技能重掷保留；Pro 和 Loner 按引擎的实际决策消耗。' + (star ? '保留明星身份及配对伙伴；本基准没有声明可选择的激活开始特殊规则，不能代表明星的最大收益。' : '七人制使用当前展示档案，不自动假设额外 Veteran 或购入技能。') + ' <span>查看条件、公式和核对案例（后台资料）</span></small></details>';
  }

  function rememberRolePreferences(form) {
    const preferences = { taskId: form.elements.taskId.value, format: form.elements.format.value,
      teamRerolls: Number(form.elements.teamRerolls.value), distance: Number(form.elements.distance.value), support: form.elements.support.value };
    roleTaskPreferences[form.dataset.roleTaskForm] = preferences;
    try { window.localStorage.setItem(rolePreferenceKey, JSON.stringify(roleTaskPreferences)); } catch (_) {}
    return preferences;
  }

  function suiteReference(person) {
    const saved = suitePreferences[person.id] || {};
    const role = roleTaskReference(person, { ...saved, taskId: saved.coreTaskId, distance: 1 });
    const preferences = { format: role.preferences.format, teamRerolls: role.preferences.teamRerolls,
      support: role.preferences.support, coreTaskId: role.preferences.taskId,
      weather: ["perfect", "pouringRain", "verySunny"].includes(saved.weather) ? saved.weather : "perfect" };
    return { preferences, taskIds: role.taskIds, key: JSON.stringify([role.key, preferences]),
      starId: DATA.stars.some(item => item.id === person.id) ? person.id : null };
  }

  function rememberSuitePreferences(form) {
    suitePreferences[form.dataset.playerSuiteForm] = { format: form.elements.format.value,
      teamRerolls: Number(form.elements.teamRerolls.value), support: form.elements.support.value,
      coreTaskId: form.elements.coreTaskId.value, weather: form.elements.weather.value };
    try { window.localStorage.setItem(suitePreferenceKey, JSON.stringify(suitePreferences)); } catch (_) {}
  }

  function playerSuiteResultHTML(result) {
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const probabilityRow = (task, field, label, count = false) => {
      if (!task.measures || !policies.every(policy => task.measures[policy]?.[field])) return '';
      const value = policy => {
        const bounds = task.measures[policy][field];
        return count ? (bounds.exact ? Number(bounds.lowerBound).toFixed(3) : Number(bounds.lowerBound).toFixed(3) + '–' + Number(bounds.upperBound).toFixed(3)) + ' 格' : taskProbabilityText(bounds);
      };
      return '<tr><th>' + esc(task.label) + '<small>' + esc(label) + '</small></th>' + policies.map(policy => '<td><b>' + value(policy) + '</b></td>').join('') + '</tr>';
    };
    const distributionRow = (task, field, label) => task.measures
      ? '<tr><th>' + esc(task.label) + '<small>' + esc(label) + '</small></th>' + policies.map(policy => '<td>' + Object.entries(task.measures[policy][field] || {}).map(([key, mass]) => '剩余 ' + esc(key) + ' 枚：' + taskProbabilityText({ lowerBound: mass, upperBound: Math.min(1, mass + task.measures[policy].unresolved), exact: task.measures[policy].unresolved <= 1e-12 })).join('<br>') + '</td>').join('') + '</tr>' : '';
    const byId = id => result.cases.find(task => task.id === id);
    const tables = COACH_MODEL.AXES.map(axis => {
      let rows = '';
      if (axis.id === 'mobility') result.cases.filter(task => task.axis === 'mobility').forEach(task => {
        const distance = task.reference?.distance;
        rows += probabilityRow(task, 'objective', '站立抵达' + (distance ? ' ' + distance + ' 格' : '') + '；允许同时发生 Turnover');
        rows += probabilityRow(task, 'safeObjective', '抵达声明目标且无 Turnover');
      });
      if (axis.id === 'ball') result.cases.filter(task => task.axis === 'ball').forEach(task => {
        if (task.id.startsWith('carrier-')) {
          rows += probabilityRow(task, 'carrier', '本次来袭结算后，本人仍持球');
          rows += probabilityRow(task, 'teamRetention', '任一己方球员持球；包含本人，不与上行相加');
          rows += probabilityRow(task, 'standingWithBall', '本人站立且持球的联合事件');
        } else {
          rows += probabilityRow(task, 'objective', task.id === 'disruption' ? '对方球队最终不持球' : '指定球员最终持球');
          rows += probabilityRow(task, 'safeObjective', '该目标成立且无 Turnover');
        }
      });
      if (axis.id === 'combat') result.cases.filter(task => task.axis === 'combat').forEach(task => {
        rows += probabilityRow(task, 'objective', task.id === 'foul' || task.reference?.taskId === 'chainsaw' ? '目标被移出' : '目标倒地或移出');
        rows += probabilityRow(task, 'safeObjective', '上述目标成立且无 Turnover');
        rows += probabilityRow(task, 'removed', '目标被移出；包括不安全结果');
        rows += probabilityRow(task, 'safeRemoval', '目标移出且无 Turnover，直接统计联合事件');
        rows += probabilityRow(task, 'selfRemoved', '本人被移出');
        rows += probabilityRow(task, 'sentOff', '本人本次行动被罚下；未模拟进攻段末 Secret Weapon 罚下');
        rows += probabilityRow(task, 'turnover', '本次行动 Turnover');
      });
      if (axis.id === 'survival') result.cases.filter(task => task.axis === 'survival').forEach(task => {
        for (const [field, label] of [['standing','来袭后仍站立'],['prone','来袭后倒地，未眩晕'],['stunned','来袭后眩晕'],['removed','来袭后被移出'],['exactSquare','仍站立在原格']]) rows += probabilityRow(task, field, label);
      });
      if (axis.id === 'control') {
        result.cases.filter(task => task.axis === 'survival').forEach(task => {
          rows += probabilityRow(task, 'localStanding', '原格半径 1 格内仍站立；与下行有盯防区的条件不同');
          rows += probabilityRow(task, 'localTackleZone', '原格半径 1 格内站立，且本人仍有盯防区');
        });
        result.cases.forEach(task => {
          rows += probabilityRow(task, 'netControlFootprint', '移动后的己方覆盖变化 − 对方覆盖变化；单位为格，不能与概率相加', true);
        });
      }
      if (axis.id === 'reliability') {
        const task = byId('core');
        if (task) {
          rows += probabilityRow(task, 'activation', '核心职责 ' + result.settings.coreTaskId + '：声明输入完整执行');
          rows += probabilityRow(task, 'objective', '核心职责目标成立；不等于输入完整执行');
          rows += probabilityRow(task, 'safeObjective', '核心职责目标成立且无 Turnover');
          rows += probabilityRow(task, 'turnover', '核心职责 Turnover 风险');
          rows += distributionRow(task, 'remainingTeamRerolls', '同一完整任务结束时的有限重掷分布');
        }
      }
      const unavailable = result.cases.filter(task => task.axis === axis.id && !task.replay).map(task => '<li><b>' + esc(task.label) + '</b>：' + esc(task.reason) + '</li>').join('');
      const coverage = result.taskProfile.axes.find(item => item.id === axis.id);
      const missing = coverage.submetrics.filter(metric => metric.status === 'not-measured').map(metric => metric.submetricId).join('、');
      return '<details class="player-suite-axis"' + (axis.id === 'mobility' ? ' open' : '') + '><summary>' + esc(axis.labelZh) + ' · ' + coverage.coverage.observedSubmetrics + ' / ' + coverage.coverage.totalSubmetrics + ' 项子指标有任务观察</summary>' +
        (rows ? '<div class="team-impact-scroll"><table><thead><tr><th>任务及成功条件</th><th>禁止来袭/行动方团队与 Leader 重掷</th><th>允许来袭/行动方 ' + result.settings.teamRerolls + ' 枚团队重掷</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p>本套件没有这项任务的数据。</p>') +
        (unavailable ? '<ul class="suite-unavailable">' + unavailable + '</ul>' : '') +
        (missing ? '<small>本套件未覆盖：' + esc(missing) + '。缺项不记为零能力，也不生成正式轴分。</small>' : '<small>这些子指标已有指定任务数据；尚不代表场景覆盖或轴分标定完成。</small>') + '</details>';
    }).join('');
    return '<p class="team-task-result-title"><b>六维任务档案</b> · ' + result.coverage.calculatedTasks + ' / ' + result.coverage.declaredTasks + ' 个参考任务已算出；' + result.coverage.intervalPolicyResults + ' 个策略结果保留区间。</p>' +
      '<p>每个任务从独立的初始棋盘与资源开始，不能把这些概率当成同一回合的可同时使用收益。来袭任务的重掷属于对手；核心可靠性只评价选择的职责。</p>' + tables +
      '<p>受击后的四类状态来自同一树且互斥；位移、站立和球权目标分开观察。当前未模拟完整得分回合、回场时间、Guard 网络与所有主动声明的明星规则，六维刻度和独立 Strength 仍待标定。</p>' +
      '<button type="button" class="featured-action" data-player-suite-json>查看完整棋盘、公式事件与结果 JSON</button><details data-player-suite-json-preview><summary>可复制的复算档案</summary><textarea readonly rows="12" aria-label="六维任务完整 JSON"></textarea></details>';
  }

  function touchdownProbabilityText(measure) {
    if (!measure || !Number.isFinite(measure.lowerBound) || !Number.isFinite(measure.upperBound)) return '未计算';
    return taskProbabilityText(measure);
  }

  function touchdownResourceText(distribution) {
    if (!distribution || !Object.keys(distribution).length) return '未记录';
    return Object.entries(distribution).filter(([, mass]) => Number.isFinite(mass)).sort(([a],[b]) => Number(b)-Number(a))
      .map(([remaining,mass]) => esc(remaining) + ' 枚 ' + (mass * 100).toFixed(2) + '%').join('；') || '未记录';
  }

  function touchdownEvidenceTable(record) {
    const cell = branch => {
      if (!branch || branch.legal === false) return '<td>未计算；当前规则条件需要复核</td>';
      return '<td><b>引擎记录达阵 ' + touchdownProbabilityText(branch.touchdown) + '</b>' +
        '<small>达阵且无 Turnover ' + touchdownProbabilityText(branch.safeObjective) + '</small>' +
        '<small>Turnover 风险 ' + touchdownProbabilityText(branch.turnover) + '</small>' +
        '<small>剩余团队重掷：' + touchdownResourceText(branch.remainingTeamRerolls) + '</small>' +
        (branch.helperRemoved ? '<small>Thrall 被移出 ' + touchdownProbabilityText(branch.helperRemoved) + '；仍站立 ' + touchdownProbabilityText(branch.helperStanding) + '</small>' : '') +
        (Number.isFinite(branch.unresolved) && branch.unresolved > 1e-12 ? '<small>未解析概率质量 ' + (branch.unresolved * 100).toFixed(4) + '%；资源分布只列已解析质量</small>' : '') + '</td>';
    };
    const statusLabel = { 'not-applicable':'不适用', 'out-of-range':'超出合法范围', 'not-calculated':'未计算' };
    const rows = record.cases.map(task => {
      const reference = task.reference;
      const condition = reference ? (reference.pressure === 'marked' ? '起点有一名 ST3 无技能对手盯防' : '开阔直线路线') + '；起点 (' + reference.origin.x + ',' + reference.origin.y + ') → 端区 (' + reference.goal.x + ',' + reference.goal.y + ')' : '';
      const semanticExcluded = record.settings.support === 'none' && window.BB_PROVISIONAL_CALIBRATION_V336?.records?.[record.subjectId + '|' + record.settings.format]?.coverage?.[0]?.families?.some(family => family.tasks.some(item => item.taskId === task.id && item.status === 'endpoint-unverified'));
      const head = '<th scope="row">' + esc(task.label) + (condition ? '<small>' + esc(condition) + '</small>' : '') + (semanticExcluded ? '<small>终点语义待核对，未计入赋分；以下保留引擎原始记录，不作为已核实达阵结论。</small>' : '') + '</th>';
      if (!task.measures || task.status === 'not-calculated') return '<tr>' + head + '<td colspan="2">' + esc(statusLabel[task.status] || '未计算') + '：' + esc(task.reason || '本条件没有可显示的规则结果') + '。不记为 0%。</td></tr>';
      return '<tr>' + head + cell(task.measures.withoutTeamRerolls) + cell(task.measures.withTeamRerolls) + '</tr>';
    }).join('');
    return '<div class="team-impact-scroll touchdown-evidence-scroll" tabindex="0" role="region" aria-label="持球达阵规则证据表，可横向滚动"><table><thead><tr><th>独立参考任务</th><th>禁止团队与 Leader 重掷</th><th>允许共享 1 枚团队重掷</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderTouchdownEvidence(person) {
    const title = '<summary>持球达阵原始证据 · v3.36 采用情况见上方覆盖</summary>';
    const unavailable = message => '<details class="team-task-experiment touchdown-task-evidence">' + title + '<p>' + esc(message) + '</p></details>';
    if (person.simulated) return unavailable('属性或技能已临时修改，原始档案的达阵结果已失效；不能套用为修改后结果。');
    const data = window.BB_TOUCHDOWN_EVIDENCE_V335;
    if (!data || data.artifactVersion !== 'touchdown-browser-evidence-v335/1') return unavailable('尚未载入新增达阵证据；本面板不会用旧评分或零值补齐。');
    if (data.suiteVersion !== window.BB_TOUCHDOWN_TASKS_V335?.VERSION || data.modelVersion !== COACH_MODEL.VERSION || data.engine?.sha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) return unavailable('新增达阵证据与当前任务套件、模型或规则引擎不一致，需要重新生成。');
    const star = DATA.stars.some(item => item.id === person.id);
    const format = !star && state.format === 'sevens' ? 'sevens' : '11s';
    const signature = window.BB_TASK_RANKINGS.signature(person);
    const matching = support => {
      const record = data.records[[person.id,format,support].join('|')];
      return record && record.profileSignature === signature ? record : null;
    };
    const primary = matching('none');
    if (!primary) return unavailable('当前对象或赛制没有匹配的达阵参考档案，或源属性已变化；缺项不记为失败。');
    const supportLabels = {'start-thrall':'起点身后一格 Thrall','end-thrall':'端区前一格、侧方一格 Thrall'};
    const conditional = ['start-thrall','end-thrall'].map(support => {
      const record = matching(support);
      return record ? '<details class="player-suite-axis"><summary>条件队友对照 · ' + supportLabels[support] + '</summary><p>仅此指定 Thrall 站位；队友不行动、不跟随，不代表合法完整阵容或通用球队收益。下列“被移出／仍站立”与达阵结果来自同一终局树，不能相加为总分。</p>' + touchdownEvidenceTable(record) + '<small><a href="' + esc(record.sourceFile) + '">查看这组队友站位的完整复算 JSON</a></small></details>' : '';
    }).join('');
    const paired = primary.cases.some(task => task.reference?.pairId);
    return '<details class="team-task-experiment touchdown-task-evidence" open data-touchdown-evidence="' + esc(person.id) + '">' + title +
      '<p><b>' + (format === 'sevens' ? '七人制' : '十一人制') + ' · 正常天气 · 起始已持球 · 单次 Move 激活</b>。直线路径接显式结束激活；实际达阵或失败 Turnover 会提前终止。每项任务独立重置初始棋盘。</p>' +
      '<p>主表无额外通用队友' + (paired ? '，保留该配对明星的真实伙伴，不能与无伙伴对象直接视为同条件' : '') + '。初始均有 1 枚团队重掷；左列禁止花费，右列整条路线共享，技能重掷保留，无 Leader。区间保持上下界，不取中点。</p>' +
      touchdownEvidenceTable(primary) + conditional +
      '<p><b>这里是原始任务证据，不能把整张表直接合成为等级。</b>v3.36 仅将主条件下通过同条件与终点核对的 4/6/8 格任务替换机动轴原有 40% 距离曲线；采用项和排除原因见上方覆盖。受标记 8 格、额外 Thrall 支援及允许团队重掷的右列不进入主评分。当前任务不包含拾球、传接、队友行动、全进攻段、路线最优搜索或后续恢复，也未声明全部主动明星规则。</p>' +
      '<small>已算出 ' + primary.coverage.calculatedTasks + ' / ' + primary.coverage.declaredTasks + ' 个任务；不适用 ' + primary.coverage.notApplicableTasks + '，超范围 ' + primary.coverage.outOfRangeTasks + '，未计算 ' + primary.coverage.notCalculatedTasks + '。原始概率不可跨任务直接平均成胜率。<a href="' + esc(primary.sourceFile) + '">查看完整输入、条件键与复算 JSON</a></small></details>';
  }

  function renderPlayerTaskSuite(person) {
    const current = suiteReference(person);
    const preferences = current.preferences;
    const option = (value, label, selected) => '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
    const cached = suiteResultCache.get(person.id);
    return '<details class="team-task-experiment player-task-suite"><summary>六维真实任务档案 · 一次计算机动、球权、对抗、生存、控场与职责可靠性</summary><p>统一使用当前球员的属性、技能与特性，明星保留专属身份和配对伙伴。查看任务概率与完整条件；不跨维度求均值当总评。</p>' +
      '<form data-player-suite-form="' + esc(person.id) + '"><div class="team-task-controls">' +
      '<label>参考赛制<select name="format" aria-label="六维任务赛制">' + option('11s','十一人制',preferences.format) + (current.starId ? '' : option('sevens','七人制',preferences.format)) + '</select></label>' +
      '<label>起始团队重掷<select name="teamRerolls" aria-label="六维任务起始团队重掷">' + [0,1].map(value => option(value, value + ' 枚', preferences.teamRerolls)).join('') + '</select></label>' +
      '<label>实际参考队友<select name="support" aria-label="六维任务支援">' + option('none','无队友',preferences.support) + option('lineman','身后一格普通队友',preferences.support) + option('thrall','身后一格 Thrall',preferences.support) + '</select></label>' +
      '<label>核心职责<select name="coreTaskId" aria-label="六维任务核心职责">' + current.taskIds.map(task => option(task, ROLE_TASK_LABELS[task], preferences.coreTaskId)).join('') + '</select></label>' +
      '<label>参考天气<select name="weather" aria-label="六维任务天气">' + option('perfect','正常天气',preferences.weather) + option('pouringRain','暴雨：球技受压',preferences.weather) + option('verySunny','烈日：传球受压',preferences.weather) + '</select></label></div>' +
      '<button type="submit" class="featured-action">计算六维任务档案</button></form>' +
      (suitePreferences[person.id]?.benchmarkPolicy ? '<small>来自规则任务概率表的参考：初始有一枚团队重掷。' + (suitePreferences[person.id].benchmarkPolicy === 'withoutTeamRerolls' ? '榜单禁止使用它，请对照结果左列。' : '榜单允许使用它，请对照结果右列。') + '</small>' : '') +
      '<div class="team-task-result" data-player-suite-result aria-live="polite">' + (cached?.key === current.key ? playerSuiteResultHTML(cached.result) : '<p>按以上条件计算 20 个独立参考任务；每项会说明成功终点、资源和不适用原因。修改属性、技能或参考条件后，旧结果自动失效。</p>') + '</div>' +
      '<small>无额外 Leader 资源；技能重掷保留。初始目标 ST3 / AV9，接应者 AG3，无 Catch；来袭为 ST3/4/6 + Block，持球保护另测 Strip Ball/Tackle。参考队友不会随移动跟随。明星主动开始规则未在这里声明；无收益不代表规则无价值。<span>查看全部公式、条件及覆盖边界（后台资料）</span></small></details>';
  }

  function renderArmBarEvidence(person) {
    const skillIds = (person?.skills || []).map(skill => typeof skill === "string" ? skill : skill.id);
    if (person?.simulated || !skillIds.includes("armBar")) return "";
    const data = window.ARM_BAR_TASK_EVIDENCE_V411;
    if (data?.engine?.sha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) return "";
    const formatLabel = format => format === "sevens" ? "七人制" : "十一人制";
    const percent = value => Number.isFinite(value?.lowerBound) && value.exact
      ? (value.lowerBound * 100).toFixed(2) + "%"
      : Number.isFinite(value?.lowerBound) && Number.isFinite(value?.upperBound)
        ? (value.lowerBound * 100).toFixed(2) + "–" + (value.upperBound * 100).toFixed(2) + "%（区间）" : "未计算";
    const delta = value => Number.isFinite(value?.lowerBound) && value.exact
      ? (value.lowerBound >= 0 ? "+" : "−") + (Math.abs(value.lowerBound) * 100).toFixed(2) + " 个百分点"
      : "区间待核";
    const rows = data.cohorts.flatMap(cohort => [
      ["withoutTeamRerolls", "不允许团队重掷"],
      ["withTeamRerolls", "允许一枚团队重掷"]
    ].map(([policy, policyLabel]) => {
      const base = cohort.profiles.withoutArmBar[policy];
      const armBar = cohort.profiles.withArmBar[policy];
      return '<tr><th scope="row">' + formatLabel(cohort.format) + " · " + policyLabel + "</th>" +
        "<td>" + percent(base.safeStandingArrival) + " → " + percent(armBar.safeStandingArrival) + "</td>" +
        "<td>" + percent(base.armourBroken) + " → " + percent(armBar.armourBroken) + "<small>技能增量 " + delta(cohort.delta.armourBroken[policy]) + "</small></td>" +
        "<td>" + percent(base.removed) + " → " + percent(armBar.removed) + "<small>增量 " + delta(cohort.delta.removed[policy]) + "</small></td>" +
        "<td>" + percent(base.turnover) + " → " + percent(armBar.turnover) + "</td></tr>";
    })).join("");
    return '<details class="team-task-experiment arm-bar-task-evidence"><summary>控场 / 杀伤 · Arm Bar 盯防惩罚证据</summary>' +
      '<p>Bloodboard V6.1 固定任务：AG3、AV9 的对手从 Chaos Chosen 的盯防格移动一步。两种结果只差防守者是否有 Arm Bar；完整计算移动、Dodge、倒地、护甲/伤害与行动结束。Arm Bar 不提高对手失败 Dodge 的机会，而是在对手倒地后提高伤害结果。</p>' +
      '<div class="team-impact-scroll" tabindex="0" role="region" aria-label="Arm Bar 对一步移动任务影响的精确概率，可横向滚动"><table><thead><tr><th>格式与资源</th><th>安全站立抵达 · 无技能 → 有 Arm Bar</th><th>护甲击破 · 无技能 → 有 Arm Bar</th><th>移出场 · 无技能 → 有 Arm Bar</th><th>对手 Turnover · 无技能 → 有 Arm Bar</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<small>十一人制与七人制分别计算；正常天气，固定 MA6/ST3/AG3/AV9 移动者与 MA5/ST4/AG3/PA5/AV10 标记者。移出场包含 KO、伤亡或观众席。结果全为精确条件概率、未解析质量为 0。离开盯防格的行动频率和完整比赛中的站位机会尚未加权；因此只作为杀伤/控场的规则证据，不直接转成六维加分或球队总评。</small></details>';
  }

  function renderTeamImportance(team) {
    const candidateAdaptability = team.candidateTeamAdaptability || {};
    const candidateRoleRows = (candidateAdaptability.roles || []).map(role =>
      '<span><b>' + esc(role.label) + '</b> 全名单 ' + Number(role.baseline || 0).toFixed(1) +
      ' · 缺阵后保持 ' + Number(role.retained || 0).toFixed(1) + '% · V7 任务 ' +
      Number(role.v7TaskCount || 0) + ' · V410 代理 ' + Number(role.legacyFallbackCount || 0) +
      (role.notApplicableCount ? ' · 不适用 ' + Number(role.notApplicableCount) : '') + '</span>'
    ).join("");
    const lowScenarioRows = (candidateAdaptability.lowRosterScenarios || []).map(scenario =>
      '<span><b>' + Number(scenario.availableCount) + ' 人候选阵容</b> 总任务保持 ' +
      Number(scenario.retainedOverall || 0).toFixed(1) + '% · ' + esc((scenario.playerNames || []).join("、")) + '</span>'
    ).join("");
    const rows = (team.playerImportance || []).map(impact => {
      const vector = values => ROLE_LABELS.map((label, index) =>
        '<span><b>' + esc(label) + '</b> ' + (Number(values[index]) >= 0 ? '+' : '−') + Math.abs(Number(values[index]) || 0).toFixed(1) + '</span>'
      ).join("");
      return '<tr><th>' + esc(impact.name) + '</th><td><div class="impact-vector">' + vector(impact.lossByRole) + '</div></td><td><div class="impact-vector">' + vector(impact.valueOverOrdinaryReplacement) + '</div><small>' + esc(impact.replacementSource) + '</small></td></tr>';
    }).join("");
    const retention = team.teamAdaptability && team.teamAdaptability.retainedByRole || [];
    const retainedRows = ROLE_LABELS.map((label, index) => '<span><b>' + esc(label) + '</b> ' + Number(retention[index] || 0).toFixed(1) + '%</span>').join("");
    const killProfile = team.teamKillProfile || {};
    const killNames = (killProfile.lineupNames || []).join("、");
    const strengthSummary = Object.entries(killProfile.strengthCounts || {})
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([strength, count]) => "ST" + strength + " × " + count)
      .join("、");
    return '<details class="team-impact-details"><summary>队内适应力、重要性与替补韧性 · 查看逐人对照</summary>' +
      '<section class="team-retention"><b>新六维适应力 · ' + Number(candidateAdaptability.score || 0).toFixed(1) + ' / 100</b><div class="impact-vector"><span><b>角色覆盖</b> ' + Number(candidateAdaptability.roleCoverageScore || 0).toFixed(1) + ' / 100 · ' + Number(candidateAdaptability.roleCoverageCount || 0) + '/' + Number(candidateAdaptability.roleCoverageTotal || 5) + ' 类职责达到基准</span><span><b>队伍贡献</b> ' + Number(candidateAdaptability.teamContributionScore || 0).toFixed(1) + ' / 100 · 低人数保留任务能力</span></div><div class="impact-vector">' + (candidateRoleRows || '<span>暂无角色任务数据</span>') + '</div><div class="impact-vector low-roster-scenarios">' + (lowScenarioRows || '<span>暂无低人数阵容任务</span>') + '</div><small>' + esc(candidateAdaptability.method || '适应力 = 50% 角色覆盖 + 50% 队伍贡献') + '完整名单基线在每类任务内分别选取最多 7/11 名高分球员；低人数候选从前五维加权优先名单中截取，并按五类角色任务重新计算。该流程没有穷举阵容或最优站位/职责分工，衡量的是参考名单在减员情境下的潜在能力，不模拟随机减员或行动顺序。V7 任务与 V410 代理覆盖逐项列出。此分数是阵容能力保持指数，不是胜率。</small></section>' +
      '<p>下表仍沿用 V410 旧五角色代理，作为历史对照；每个差值单位为角色任务指数点。左列是移除球员后的旧任务变化，右列是以同位置普通初始档案替换后的旧任务变化，不进入当前适应力分数，也不合成单一重要性分。</p>' +
      (killNames ? '<p><b>杀伤阵容：</b>选入最多 ' + (team.format === "sevens" ? 7 : 11) + ' 名杀伤指数最高的球员：' + esc(killNames) + '。力量结构为 ' + esc(strengthSummary || '暂无') + '。单人阻挡会按攻击者与目标的力量差确定骰数及选骰方；高力量球员产生的安全击倒率进入杀伤指数，多名高力量球员会分别占据队内序位。当前仍未模拟整队支援站位、“制造倒地目标→犯规”的完整行动链、重复犯规次数与低价替补承担罚下的经济收益。</p>' : '') +
      '<div class="team-impact-scroll"><table><thead><tr><th>球员</th><th>移除后的角色任务变化 Δ</th><th>普通同位置替补的角色任务变化 Δ</th></tr></thead><tbody>' + (rows || '<tr><td colspan="3">无球员名单数据。</td></tr>') + '</tbody></table></div>' +
      '<section class="team-retention"><b>旧五角色代理对照 · 保留率</b><div class="impact-vector">' + retainedRows + '</div><small>此对照仍来自 V410 固定角色代理，用于追溯旧模型；不进入当前球队适应力分数。</small></section>' +
      '<small>队内重要性只适用于此赛制与这份实编名单；同位置普通替补来自该种族的初始位置档案。当前仍按角色独立重排，未处理一名球员同时承担多项职责的冲突；所有任务排名点和角色代理均为候选比较值，不等同于完整比赛胜率或招募价格价值。</small></details>';
  }

  function renderTeamGroundBallContribution(team) {
    const data = window.BB_TEAM_TASK_IMPORTANCE_V397;
    const unavailable = '<details class="team-impact-details"><summary>适应力 · 队伍情境贡献证据</summary><p>当前名单没有匹配的 Bloodboard V6.1 拾球情境记录；缺项不记为零。</p></details>';
    if (!data || data.schema !== 'bloodbowl-roster-task-importance-browser-v397/1' ||
        data.engineSha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) return unavailable;
    const format = team.format === 'sevens' ? 'sevens' : '11s';
    const records = ['open', 'marked'].map(pressure => data.records[[team.id, format, pressure].join('|')]).filter(Boolean);
    if (!records.length) return unavailable;
    const percent = measure => measure && Number.isFinite(measure.value) ? (measure.value * 100).toFixed(2) + '%' : '未计算';
    const pp = measure => measure && Number.isFinite(measure.value) ? (measure.value * 100).toFixed(2) + ' 个百分点' : '未计算';
    const rows = records.map(record => {
      const label = record.pressure === 'marked' ? '一名 ST3 对手标记球' : '开阔拾球';
      const makeCell = policy => {
        const before = record.complete[policy];
        const after = record.withoutPlayer?.[policy];
        const reserve = record.withReserve?.[policy];
        return '<td><b>' + percent(before?.probability) + '</b><small>焦点球员 #' + esc(record.focal.number) + ' ' + esc(record.focal.name) + ' 缺阵：' + percent(after?.probability) + ' · 下降 ' + pp(after?.loss) + '</small>' +
          (reserve ? '<small>现有替补下一进攻段接任：' + percent(reserve.probability) + ' · 相对完整名单下降 ' + pp(reserve.loss) + '</small>' : '') + '</td>';
      };
      return '<tr><th scope="row">' + label + '</th>' + makeCell('withoutTeamRerolls') + makeCell('withTeamRerolls') + '</tr>';
    }).join('');
    return '<details class="team-impact-details team-context-adaptability"><summary>适应力 · 队伍情境贡献证据（当前名单）</summary>' +
      '<p>固定参考开局里，比较完整阵容与焦点拾球球员缺阵后、允许队友重新选择任务时，球队“持球且无 Turnover”的概率差。焦点为名单中优先级最高的 Sure Hands / AG / MA 拾球者；已有替补另列下一进攻段接任参考。</p>' +
      '<div class="team-impact-scroll" tabindex="0" role="region" aria-label="不同拾球压力下的队内贡献概率对照，可横向滚动"><table><thead><tr><th>独立任务情境</th><th>禁止团队与 Leader 重掷</th><th>允许一枚团队重掷及名单 Leader 资源</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<small>这是“队内贡献/可替代性”的一个实算子项，不是适应力分或球队总评。只覆盖开阔与单一标记者的拾球情境，不代表完整回合、任务出现频率或替补招募收益；无团队重掷和一枚团队重掷分别从相同初始资源计算。引擎 Bloodboard ' + esc(data.version) + '。<span>查看公式与完整边界（后台资料）</span></small></details>';
  }

  function renderTeamCarrierContext(team) {
    const data = window.BB_TEAM_CARRIER_CONTEXT_V398;
    const unavailable = '<details class="team-impact-details"><summary>球队情境 · 持球保护威胁矩阵</summary><p>当前名单没有匹配的 Bloodboard V6.1 持球威胁记录；缺项不记为 0。</p></details>';
    if (!data || data.schema !== 'bloodbowl-team-carrier-context-browser-v398/1' ||
        data.engineSha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) return unavailable;
    const format = team.format === 'sevens' ? 'sevens' : '11s';
    const labels = { normal: '普通 Block', stripBall: 'Block + Strip Ball', tackle: 'Block + Tackle' };
    const records = ['normal', 'stripBall', 'tackle'].map(threat => data.records[[team.id, format, threat].join('|')]).filter(Boolean);
    if (records.length !== 3) return unavailable;
    const percent = measure => {
      if (!measure || !Number.isFinite(measure.lowerBound) || !Number.isFinite(measure.upperBound)) return '未计算';
      const low = (measure.lowerBound * 100).toFixed(2) + '%';
      const high = (measure.upperBound * 100).toFixed(2) + '%';
      return measure.exact || Math.abs(measure.upperBound - measure.lowerBound) < 1e-12 ? low : low + '–' + high + '（区间）';
    };
    const rows = records.map(record => {
      const noReroll = record.policies.withoutTeamRerolls;
      const oneReroll = record.policies.withTeamRerolls;
      const cell = result => '<td><b>球队保球 ' + percent(result.teamRetention) + '</b><small>原持球人本人保球 ' + percent(result.carrierRetention) + '</small></td>';
      return '<tr><th scope="row">' + labels[record.threat] + '</th>' + cell(noReroll) + cell(oneReroll) + '</tr>';
    }).join('');
    const carrier = records[0].carrier;
    return '<details class="team-impact-details team-context-carrier"><summary>球队情境 · 持球保护威胁矩阵（当前名单）</summary>' +
      '<p>固定参考站位中，由 ' + esc(carrier.name) + '（#' + esc(carrier.number) + '，ST' + esc(carrier.st) + '）持球；一名 ST3 + Block 对手已在相邻空格发起一次阻挡。Bloodboard 按真实队友站位计算防守助攻与阻挡结果。</p>' +
      '<div class="team-impact-scroll" tabindex="0" role="region" aria-label="持球保护结果矩阵，可横向滚动"><table><thead><tr><th>来袭威胁</th><th>来袭方无团队重掷</th><th>来袭方允许一枚团队重掷</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<small>三种威胁从相同参考局面分别计算。来袭方无移动与支援；己方也不启用团队/Leader 重掷。此矩阵展示当前名单在特定对手压力下的球权留存，不是球队总评、个人六维分或缺阵贡献差。来袭方重掷分支使用引擎既定决策策略，不代表最优夺球决策。<span>查看任务定义与边界（后台资料）</span></small></details>';
  }

  function renderGoblinTeamFoulContext(team) {
    if (team.rosterId !== "goblin" || team.format === "sevens") return "";
    const data = window.BB_KILL_TEAM_CONTEXT_V394;
    if (!data || data.schema !== "bloodbowl-team-kill-context/1" ||
        data.engine?.sha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) {
      return '<details class="team-impact-details"><summary>Goblin · 阵容犯规连锁情境</summary><p>当前阵容没有匹配的 Bloodboard V6.1 犯规连锁资料；缺项不记为 0。</p></details>';
    }
    const scenarios = data.scenarios || [];
    const formatProbability = measure => {
      if (!measure || !Number.isFinite(measure.lower) || !Number.isFinite(measure.upper)) return "未计算";
      const low = (measure.lower * 100).toFixed(2) + "%";
      const high = (measure.upper * 100).toFixed(2) + "%";
      return measure.exact || Math.abs(measure.upper - measure.lower) < 1e-12 ? low : low + "–" + high;
    };
    const paired = data.pairedDeltas?.blackGobboExtraFoulVsSameOoliganBaseline || {};
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const policyNames = ["无团队重掷", "允许 1 枚团队重掷"];
    const cell = (scenario, outcome) => '<td>' + policies.map((policy, index) =>
      '<b>' + policyNames[index] + ' ' + formatProbability(scenario.policies?.[policy]?.outcomes?.[outcome]) + '</b>'
    ).join("") + '</td>';
    const rows = scenarios.map(scenario => '<tr><th scope="row">' + esc(scenario.title) + '</th>' +
      cell(scenario, "safeRemovalByChain") + cell(scenario, "foulOpportunity") + cell(scenario, "teamTurnover") + '</tr>'
    ).join("");
    const blackGobboDelta = policies.map((policy, index) =>
      policyNames[index] + " " + formatProbability(paired[policy])
    ).join("；");
    return '<details class="team-impact-details team-context-foul-chain"><summary>杀伤 · Goblin 阵容犯规连锁（十一人制情境）</summary>' +
      '<p>同一站位下，Trained Troll 先阻挡站立的 ST3 / AV9 目标；只有目标倒地且球队尚未 Turnover，后续犯规才会执行。对照 Ooligan、Loony 电锯，以及加入 The Black Gobbo 后的整条行动链。</p>' +
      '<div class="team-impact-scroll" tabindex="0" role="region" aria-label="Goblin 阵容犯规连锁概率，可横向滚动"><table><thead><tr><th>行动链</th><th>整链安全移出</th><th>出现合法犯规机会</th><th>球队 Turnover</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p><b>Black Gobbo 的配对增量：</b>相对同条件的 Ooligan 单次犯规链，安全移出增加 ' + esc(blackGobboDelta) + '。</p>' +
      '<small>固定十一人制 Goblin 情境：含 Bribery and Corruption 与 1 次 Bribe；敌方目标无技能。概率由 Bloodboard V6.1 联合枚举，区间保留未解析质量；“整链安全移出”要求目标被移出且己方全链没有 Turnover。它证明该阵容有真实的条件杀伤链，但不等于每回合/整场触发率，也不计替补、反复驱逐、价格或多 Drive 经济；因此作为球队杀伤依据展示，不直接变成球队总评或个人常驻分。<span>查看任务定义与完整边界（后台资料）</span></small></details>';
  }

  function renderVampireRunnerSupportContext(team) {
    if (team.rosterId !== "vampire" || team.format !== "standard") return "";
    const data = window.BB_VAMPIRE_RUNNER_SUPPORT_V704;
    const unavailable = '<details class="team-impact-details"><summary>快攻 · Vampire Runner 与 Thrall 支援情境</summary><p>当前没有匹配的 Bloodboard V7.0.1 支援概率；缺项不记为零。</p></details>';
    if (!data || data.schema !== "bloodbowl-vampire-runner-support-v704/1" ||
        data.engine?.sha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) return unavailable;
    const formatPercent = measure => Number.isFinite(measure?.lowerBound) && Number.isFinite(measure?.upperBound)
      ? (Math.abs(measure.upperBound - measure.lowerBound) < 1e-12
        ? (measure.lowerBound * 100).toFixed(2) + "%"
        : (measure.lowerBound * 100).toFixed(2) + "–" + (measure.upperBound * 100).toFixed(2) + "%")
      : "未计算";
    const taskMap = new Map((data.scenarios || []).map(scenario => [scenario.support,
      new Map((scenario.cases || []).map(task => [task.taskId, task]))]));
    const tasks = (taskMap.get("none") || new Map());
    const getMeasure = (support, taskId, policy) => taskMap.get(support)?.get(taskId)?.policies?.[policy]?.safeTouchdown;
    const supportTypes = ["none", "start-thrall", "end-thrall"];
    if (supportTypes.some(key => !taskMap.has(key)) || tasks.size === 0) return unavailable;
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const rows = [...tasks.values()].map(task => {
      const safe = (support, policy) => formatPercent(getMeasure(support, task.taskId, policy));
      return '<tr><th scope="row">' + esc(task.reference?.label || task.taskId) + '</th>' +
        '<td>' + safe("none", policies[0]) + '</td><td>' + safe("start-thrall", policies[0]) + '</td><td><b>' + safe("end-thrall", policies[0]) + '</b></td>' +
        '<td>' + safe("none", policies[1]) + '</td><td>' + safe("start-thrall", policies[1]) + '</td><td><b>' + safe("end-thrall", policies[1]) + '</b></td></tr>';
    }).join("");
    return '<details class="team-impact-details team-context-vampire-runner"><summary>快攻 · Vampire Runner 与 Thrall 支援情境</summary>' +
      '<p>Bloodboard V7.0.1 固定路线任务：Vampire Runner 已持球，从开阔或受标记位置推进并完成实际达阵。比较无辅助队友、Thrall 固定在起点、Thrall 固定在达阵格旁；两种重掷条件分别计算。</p>' +
      '<div class="team-impact-scroll" tabindex="0" role="region" aria-label="Vampire Runner 在不同 Thrall 站位与团队重掷条件下的达阵概率，可横向滚动"><table><thead><tr><th>独立达阵任务</th><th>无 Thrall<br>无重掷</th><th>起点 Thrall<br>无重掷</th><th>达阵格旁 Thrall<br>无重掷</th><th>无 Thrall<br>一枚重掷</th><th>起点 Thrall<br>一枚重掷</th><th>达阵格旁 Thrall<br>一枚重掷</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<small>当前引擎中，起点 Thrall 没有提高这些固定路线的安全达阵率；达阵格旁 Thrall 提高单次任务结果。该数值是 Thrall 已处于指定格位的条件概率，不包括它到位的概率、移动/攻击机会成本、名单与预算可行性，也不直接加入个人快攻分或球队总评。来源：V7.0.1 固定任务证据（' + esc(data.generatedAt.slice(0, 10)) + '）；无支援结果与 V703 基线逐任务一致。</small></details>';
  }

  function renderTeamStrengthContext(team) {
    if (team.simulated) return '<details class="team-impact-details team-context-strength"><summary>力量贡献 · 整队控区与留场敏感度</summary><p>此处为基准参考阵容的固定情境；当前阵容含临时编辑，尚未用 V6.1 重算，故暂不显示基准数据。</p></details>';
    const data = window.BB_TEAM_STRENGTH_CONTEXT_V416 || window.BB_TEAM_STRENGTH_CONTEXT_V415 || window.BB_TEAM_STRENGTH_CONTEXT_V410;
    if (!data || !["bloodbowl-team-static-strength-context-v416/1", "bloodbowl-team-static-strength-context-v415/1", "bloodbowl-team-static-strength-context-v410/1"].includes(data.schema) ||
        data.engine?.sha256 !== window.BB_BLOODBOARD_ENGINE?.META?.sha256) return "";
    const record = data.results.find(row => row.teamId === team.id);
    if (!record) return "";
    const policies = [
      ["withoutTeamRerolls", "对手无团队重掷"],
      ["withTeamRerolls", "对手可用一枚团队重掷"]
    ];
    const metrics = [
      ["expectedUniqueTackleZoneSquares", "球队保留的不同盯防格", "格"],
      ["targetStandingWithTackleZone", "受击球员仍站立并保有盯防区", ""],
      ["targetRemainsOnPitch", "受击球员仍留在场上", ""]
    ];
    const formatMeasure = (measure, unit) => {
      if (!measure || !Number.isFinite(measure.lowerBound) || !Number.isFinite(measure.upperBound)) return "未计算";
      const value = n => unit ? Number(n).toFixed(2) + " " + unit : (n * 100).toFixed(2) + "%";
      const low = value(measure.lowerBound);
      const high = value(measure.upperBound);
      return measure.exact || Math.abs(measure.upperBound - measure.lowerBound) < 1e-10 ? low : low + "–" + high + "（区间）";
    };
    const formatDelta = (before, after, unit) => {
      if (!Number.isFinite(before?.lowerBound) || !Number.isFinite(after?.lowerBound) ||
          !Number.isFinite(before?.upperBound) || !Number.isFinite(after?.upperBound)) return "未计算";
      const low = before.lowerBound - after.upperBound;
      const high = before.upperBound - after.lowerBound;
      const render = n => (n >= 0 ? "+" : "−") + (unit ? Math.abs(n).toFixed(2) + " 格" : (Math.abs(n) * 100).toFixed(2) + " 个百分点");
      return Math.abs(high - low) < 1e-10 ? render((low + high) / 2) : render(low) + "–" + render(high) + "（区间）";
    };
    const rows = policies.flatMap(([policy, policyLabel]) => metrics.map(([metric, label, unit]) => {
      const before = record.baseline.byRerollPolicy[policy][metric];
      const after = record.allST3Counterfactual.byRerollPolicy[policy][metric];
      return '<tr><th scope="row">' + policyLabel + " · " + label + '</th><td>' + formatMeasure(before, unit) + '</td><td>' +
        formatMeasure(after, unit) + '</td><td><b>' + formatDelta(before, after, unit) + '</b></td></tr>';
    })).join("");
    const changed = record.changedPlayers.length
      ? record.changedPlayers.map(player => esc(player.positionId) + " ST" + player.fromST + "→ST3").join("、")
      : "当前参考上场名单没有 ST3 以上球员";
    return '<details class="team-impact-details team-context-strength"><summary>力量贡献 · 整队控区与留场敏感度</summary>' +
      '<p>当前 ' + (record.format === "sevens" ? "七人制" : "十一人制") + '参考阵容：' + record.lineup.length + ' 人；力量改动对象为 ' + changed + '。对照只把这些球员的 ST 改成 3，其他属性、技能、队友和站位保持不变。</p>' +
      '<div class="team-impact-scroll" tabindex="0" role="region" aria-label="球队力量消融前后的控区与留场结果，可横向滚动"><table><thead><tr><th>固定单次受击情境</th><th>当前参考力量</th><th>同阵容 ST3 对照</th><th>力量带来的变化</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<small>Bloodboard V6.1 逐一计算对手 ST4 对每位上场球员发动的独立相邻 Block，等权汇总；同时比较对手无团队重掷和有一枚团队重掷。当前 60 套合法参考阵容均已覆盖。该固定压力情境先与 V7.0.1 个人任务画像聚合点（个别缺证轴含明确标记的 V410 代理）换算成同赛制百分位点后各占一半；之后另将当前力量名单相对同名单全 ST3 反事实的控制格、站立率、留场率差值分别排名，按高于中位数的贡献每点 +0.5、每轴最多 +25 加到生存/控场，低于中位数不倒扣。参数未校准成比赛频率或胜率。参考阵容按当前名单顺序取前 ' + record.lineup.length + ' 人，并非预算优化或战术最优阵容；逐次 Block 是独立压力样本，不是合法的连续回合。<span>查看 60 支球队完整输入和概率（后台资料）</span></small></details>';
  }

  function renderPlayerCard(person) {
    if (standardMode()) return renderStandardRail(person, "player");
    const selected = state.selectedId === person.id;
    const appearances = person.visibleAppearances || person.appearances;
    const teams = Array.from(new Set(appearances.map(entry => entry.rosterName)));
    const candidate = sixAxisCandidateFor(person, "player");
    const artAttrs = leagueBackdropAttrs(person, "players", state.league);
    return '<article class="rail-card player-rail-card ' + (person.portrait ? "base-art-card" : "") + (selected ? " is-selected" : "") + (artAttrs ? " atlas-art-card" : "") + '"' + artAttrs + ' data-select="' + esc(person.id) + '" role="button" tabindex="0">' +
      '<div class="rail-card-top base-art-top"><span class="card-kicker">本体球员 · ' + teams.length + ' 支球队</span>' + portraitMark(person, "rail-portrait", "emblem") + '</div>' +
      '<h3>' + esc(person.name) + '</h3><p class="rail-card-subtitle">' + esc((person.keywords || []).join(" · ") || "基础球员") + '</p>' +
      '<div class="rail-card-bottom"><span class="model-pending">总评 ' + esc(candidate?.overallGrade || "—") + '</span><span>' + (Number.isFinite(candidate?.overallScore) ? candidate.overallScore.toFixed(1) + ' · 第 ' + candidate.overallRank + ' 名' : '总评未生成') + '</span>' +
      calibratedCompactRadar(person) + '</div>' + playerRoleSummary(person) + '</article>';
  }

  function playerRoleSummary(person) {
    const roles = person.scoreBreakdown && person.scoreBreakdown.adaptability && person.scoreBreakdown.adaptability.roles || [];
    const strongest = roles.slice().sort((a, b) => b.score - a.score).slice(0, 2);
    return strongest.length ? '<small class="role-vector-summary">职责向量 · ' + strongest.map(role => esc(role.label) + ' ' + Number(role.score).toFixed(0)).join(' · ') + '</small>' : '';
  }

  function renderStarCard(person) {
    if (standardMode() || person.isStarPair) return renderStandardRail(person, "star");
    const selected = state.selectedId === person.id;
    const leagues = Object.keys(person.eligibleByLeague || {});
    const rules = person.scoreBreakdown && person.scoreBreakdown.specialRuleEffects || [];
    const ruleNames = rules.map(rule => rule.name).filter(Boolean);
    const ruleName = ruleNames.join(" · ") || "规则资料待补";
    const ruleText = compactStarRuleText(person.specialRules);
    const ruleDimensions = Array.from(new Set(rules.flatMap(rule => rule.dimensions || [])));
    const ruleEffect = rules.map(rule => rule.coverage || rule.status).filter(Boolean).join("；") || "特殊规则效果映射待补";
    const ruleResult = rules.length ? rules.map(specialRuleResultText).join("；") : "计分映射待补";
    const artAttrs = leagueBackdropAttrs(person, "stars", state.league);
    const candidate = sixAxisCandidateFor(person, "star");
    return '<article class="rail-card player-rail-card star-art-card ' + (selected ? "is-selected" : "") + (artAttrs ? " atlas-art-card" : "") + '"' + artAttrs + ' data-select="' + esc(person.id) + '" role="button" tabindex="0">' +
      '<div class="rail-card-top star-art-top"><span class="card-kicker">明星球员 · ' + leagues.length + ' 个可用赛区</span>' + (person.portrait ? '<span class="star-rail-portrait-frame" data-star-id="' + esc(person.id) + '">' + portraitMark(person, "rail-portrait star-rail-portrait", "emblem") + '</span>' : emblem(itemColor(person), "emblem")) + '</div>' +
      '<h3>' + esc(person.name) + '</h3><p class="rail-card-subtitle">' + esc((person.keywords || []).join(" · ") || "明星球员") + '</p>' +
      '<div class="star-rule-rail" title="' + esc(person.specialRules || "") + '"><b>明星特殊规则 · ' + esc(ruleName) + '</b>' +
      '<span class="star-rule-rail-source"><strong>规则内容</strong> · ' + esc(ruleText || "规则原文待补") + '</span>' +
      '<span class="star-rule-rail-effect"><strong>效果与维度</strong> · ' + esc(ruleDimensions.join("、") || "待映射") + '；' + esc(ruleEffect) + '</span>' +
      '<span class="star-rule-rail-result"><strong>旧代理对照</strong> · ' + esc(ruleResult) + '</span></div>' +
      '<div class="rail-card-bottom"><span class="model-pending">总评 ' + esc(candidate?.overallGrade || "—") + '</span><span>' + (Number.isFinite(candidate?.overallScore) ? candidate.overallScore.toFixed(1) + ' · 第 ' + candidate.overallRank + ' 名' : '总评未生成') + '</span>' +
      calibratedCompactRadar(person) + '</div>' + playerRoleSummary(person) + '</article>';
  }

  function compactStarRuleText(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const separators = [text.indexOf("："), text.indexOf(":")].filter(index => index >= 0);
    const separator = separators.length ? Math.min(...separators) : -1;
    return separator >= 0 ? text.slice(separator + 1).trim() : text;
  }

  function specialRuleResultText(effect) {
    const parts = [];
    if (effect.scoreGain != null && effect.includedInScore !== false) {
      parts.push(Number.isFinite(Number(effect.scoreGain)) ? (effect.targetDimension || effect.dimensions && effect.dimensions[0] || "六维") + "已计入 " + signedRuleScore(effect.scoreGain)
        : "旧代理增量待核对，不进入真实任务概率");
    }
    if (effect.conditionalGain != null) parts.push(specialRuleConditionLabel(effect) + " " + signedRuleScore(effect.conditionalGain));
    if (effect.secondaryConditionalGain != null) parts.push(specialRuleConditionLabel(effect, true) + " " + (effect.secondaryValueType === "index" ? legacyNumberText(effect.secondaryConditionalGain, 1, "/100") : signedRuleScore(effect.secondaryConditionalGain)));
    if (effect.secondaryScoreGain != null) parts.push((effect.secondaryTargetDimension || "次要维度") + "已计入 " + signedRuleScore(effect.secondaryScoreGain));
    if (effect.riskProbability != null) parts.push((effect.riskLabel || "风险") + " " + legacyNumberText(effect.riskProbability, 1, "%"));
    if (effect.protectionNote) parts.push("规则豁免已计入");
    if (parts.length) return parts.join(" · ");
    return "需情境触发，未计入个人固定分 · " + (effect.coverage || effect.status || "待补效果说明");
  }

  function specialRuleConditionLabel(effect, secondary = false) {
    const explicit = secondary ? effect.secondaryConditionalLabel : effect.conditionalLabel;
    if (explicit) return explicit;
    const dimension = secondary
      ? effect.secondaryTargetDimension
      : effect.targetDimension || effect.dimensions && effect.dimensions[0];
    return dimension ? "符合触发条件时的" + dimension + "情境值" : "符合触发条件时的情境值";
  }

  function signedRuleScore(value) {
    if (!Number.isFinite(Number(value))) return "数值待核对";
    return (Number(value) >= 0 ? "+" : "−") + Math.abs(Number(value)).toFixed(1) + " 分";
  }

  function appearanceDetails(person) {
    const appearances = person.visibleAppearances || person.appearances || [];
    const grouped = new Map();
    appearances.forEach(entry => {
      const key = entry.teamId;
      if (!grouped.has(key)) grouped.set(key, { teamName: entry.teamName, rosterName: entry.rosterName, formatName: entry.formatName, leagues: entry.leagueNames, count: 0 });
      const row = grouped.get(key);
      row.count += Number(entry.selectedCount) || 0;
    });
    const rows = Array.from(grouped.values()).map(entry => '<li><b>' + esc(entry.teamName) + '</b> · ' + esc(entry.formatName) + ' · ' +
      (entry.count ? '实编名单中有 ' + entry.count + ' 名同型球员' : '基础球员可用，本实编名单未选用') +
      '<br><span>' + esc(entry.leagues.join("、")) + '</span></li>').join("");
    return '<details class="appearance-details"><summary>适用球队与赛制 · ' + grouped.size + ' 套阵容</summary><ul>' + rows + '</ul></details>';
  }

  function playerStats(person) {
    if (person.isStarPair) return pairedStarMemberDetails(person);
    const stats = [["移动力", person.ma], ["力量", person.st], ["敏捷", person.ag == null ? "—" : person.ag + "+"],
      ["传球", person.pa == null ? "—" : person.pa + "+"], ["护甲", person.av == null ? "—" : person.av + "+"]];
    return '<div class="player-detail-stats">' + stats.map(row => '<div class="stat-pill"><b>' + esc(row[1] == null ? "—" : row[1]) + '</b><span>' + esc(row[0]) + '</span></div>').join("") + '</div>';
  }

  function skillName(skill) {
    const ref = typeof skill === "string" ? { id: skill } : skill;
    const def = SKILL_CATALOG.find(item => item.id === ref.id);
    return (def ? def.name : ref.id) + (ref.value != null ? " (" + ref.value + "+)" : ref.keyword ? " (" + ref.keyword + ")" : "");
  }

  function editorSkillText(skills) {
    return skills && skills.length ? skills.map(skillName).join("、") : "无技能";
  }

  function skillsOnSlot(slot) {
    const skills = (slot.skills || []).map(skill => typeof skill === "string" ? { id: skill } : Object.assign({}, skill));
    if (slot.boughtSkill && !skills.some(skill => skill.id === slot.boughtSkill)) skills.push({ id: slot.boughtSkill });
    return skills;
  }

  function editorTeams(person) {
    return DATA.teams.filter(team => templateSlots(person, team).length);
  }

  function beginEditor(person) {
    if (!person || DATA.stars.some(item => item.id === person.id)) return;
    const teams = editorTeams(person);
    const preferred = teams.some(team => team.id === state.teamScope) ? { teamId: state.teamScope } :
      (person.appearances || []).find(entry => entry.selectedCount > 0 && teams.some(team => team.id === entry.teamId));
    const team = teams.find(item => item.id === (preferred && preferred.teamId)) || teams[0];
    const slot = templateSlots(person, team)[0];
    if (!team || !slot) return;
    state.editor = {
      profileId: person.id, mode: "tournament", teamId: team.id, slotId: slot.id, applied: false,
      stats: { ma: slot.ma, st: slot.st, ag: slot.ag, pa: slot.pa, av: slot.av },
      skills: skillsOnSlot(slot)
    };
    render();
  }

  function editorDraft(form) {
    const data = new FormData(form);
    const numberOrNull = name => {
      if (data.get(name) === "") return null;
      const value = Number(data.get(name));
      return Number.isFinite(value) ? value : null;
    };
    state.editor.mode = data.get("mode");
    state.editor.teamId = data.get("teamId") || "";
    state.editor.slotId = data.get("slotId") || "";
    state.editor.stats = {
      ma: numberOrNull("ma"), st: numberOrNull("st"), ag: numberOrNull("ag"),
      pa: numberOrNull("pa"), av: numberOrNull("av")
    };
  }

  function skillRestrictionReason(skills, skillId) {
    const hasSkill = id => skills.some(skill => skill.id === id);
    const specialActions = ["ballAndChain", "bombardier", "breatheFire", "chainsaw", "hypnoticGaze", "kickTeamMate", "projectileVomit", "stab"];
    if (hasSkill(skillId)) return "已拥有";
    if ((skillId === "bullseye" || skillId === "strongArm") && !hasSkill("throwTeamMate")) return "需要 Throw Team-mate";
    if (skillId === "lethalFlight" && !hasSkill("rightStuff")) return "需要 Right Stuff";
    if (skillId === "saboteur" && !hasSkill("secretWeapon")) return "需要 Secret Weapon";
    if (skillId === "violentInnovator" && !specialActions.some(hasSkill)) return "需要特殊行动特性";
    const conflicts = { frenzy: ["grab", "hitAndRun", "multipleBlock"], leap: ["pogo"] };
    if (conflicts[skillId]?.some(hasSkill)) return "与已有技能冲突";
    if (Object.entries(conflicts).some(([id, excluded]) => hasSkill(id) && excluded.includes(skillId))) return "与已有技能冲突";
    const excluded = {
      ballAndChain: ["divingTackle", "eyeGouge", "frenzy", "grab", "hitAndRun", "leap", "multipleBlock", "onTheBall", "shadowing", "steadyFooting"],
      noBall: ["catch", "divingCatch", "safePairOfHands", "sureHands", "bigHand", "extraArms", "accurate", "cannoneer", "cloudBurster", "dumpOff", "giveAndGo", "hailMaryPass", "nervesOfSteel", "pass", "punt", "safePass", "fumblerooski"],
      myBall: ["accurate", "cannoneer", "cloudBurster", "dumpOff", "giveAndGo", "hailMaryPass", "pass", "punt", "safePass", "fumblerooski"]
    };
    for (const [trait, blocked] of Object.entries(excluded)) if (hasSkill(trait) && blocked.includes(skillId)) return "与已有特性冲突";
    return "";
  }

  function eligibleEditorSkills(editor, team, slot) {
    if (!editor || editor.isStar || !team || !slot) return [];
    const access = SKILL_ELIGIBILITY.rosters[team.rosterId]?.[slot.positionId];
    if (!access) return [];
    const primary = new Set(access.primary || []);
    const secondary = new Set(access.secondary || []);
    const existing = editor.skills || [];
    return [
      { title: "主技能类别", categories: primary },
      { title: "副技能类别", categories: new Set([...secondary].filter(category => !primary.has(category))) }
    ].flatMap(group => {
      const options = SKILL_CATALOG.filter(skill => group.categories.has(SKILL_ELIGIBILITY.skillCategories[skill.id]) &&
        !skillRestrictionReason(existing, skill.id)).map(skill => Object.assign({}, skill, { accessLevel: group.title }));
      return options.length ? [Object.assign(group, { options })] : [];
    });
  }

  function skillOptions(groups) {
    const modelHint = skill => {
      const effect = SKILL_EFFECTS[skill.id];
      return effect ? " · 关联：" + effect.dimensions.slice(0, 3).join("/") : " · 等待规则归类";
    };
    return groups.map(group => '<optgroup label="' + esc(group.title) + '">' +
      group.options.map(skill => '<option value="' + esc(skill.id) + '" title="' + esc(skill.category) + '">' + esc(skill.name + modelHint(skill)) + '</option>').join("") + '</optgroup>').join("");
  }

  const scopeLabel = scope => ({ direct: "直接检定", conditional: "条件动作", "direct-or-conditional": "直接/条件动作", "team-context": "团队情境", "league-context": "联赛情境" }[scope] || scope);
  const coverageLabel = coverage => ({ formula: "已有数值分支（有限情境）", "scenario-only": "条件已映射，数值待补", "team-context": "已映射，待队伍情境", "league-context": "已映射，待联赛情境" }[coverage] || "已映射，待核对计分入口");

  function renderSkillMap(filter = "") {
    const container = document.getElementById("skill-map-body");
    if (!container) return;
    const query = String(filter || "").trim().toLocaleLowerCase();
    const items = SKILL_CATALOG.filter(skill => {
      const effect = SKILL_EFFECTS[skill.id] || { dimensions: [], scopes: [], contexts: [] };
      return [skill.name, skill.category, ...effect.dimensions, ...effect.scopes, ...effect.contexts].join(" ").toLocaleLowerCase().includes(query);
    });
    const rows = items.map(skill => {
      const effect = SKILL_EFFECTS[skill.id] || { dimensions: ["待归类"], scopes: ["自定义/规则未知"], contexts: ["需查规则来源"] };
      return '<tr><th scope="row">' + esc(skill.name) + '</th><td>' + esc(skill.category) + '</td><td>' + esc(effect.dimensions.join(" / ")) + '</td><td>' + esc(effect.scopes.map(scopeLabel).join(" / ")) + '</td><td>' + esc(coverageLabel(effect.coverage)) + '<small class="skill-coverage-note">' + esc(effect.coverageNote || "") + '</small></td><td>' + esc(effect.contexts.join("；")) + '</td><td>pp.' + esc(skill.page) + '</td></tr>';
    }).join("");
    const counts = items.reduce((result, skill) => {
      const coverage = (SKILL_EFFECTS[skill.id] || {}).coverage || "scenario-only";
      result[coverage] = (result[coverage] || 0) + 1;
      return result;
    }, {});
    const summary = ["formula", "scenario-only", "team-context", "league-context"].map(key => coverageLabel(key) + " " + (counts[key] || 0)).join(" · ");
    container.innerHTML = '<p class="skill-map-count">显示 ' + items.length + ' / ' + SKILL_CATALOG.length + ' 项；' + summary + '。公式已有分支表示至少一种固定场景会量化该技能，不代表其所有规则互动均已完整模拟。</p><div class="skill-map-scroll"><table><thead><tr><th>技能 / 特性</th><th>类别</th><th>关联维度</th><th>规则触发类型</th><th>数值承接状态</th><th>规则情境</th><th>规则书页码</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">没有匹配的技能</td></tr>') + '</tbody></table></div>';
  }

  function renderPlayerEditor(person) {
    if (person.isStarPair || DATA.stars.some(item => item.id === person.id)) {
      return '<p class="editor-note player-fixed-note">明星球员采用固定卡面，不开放编辑。</p>';
    }
    const editor = state.editor && state.editor.profileId === person.id ? state.editor : null;
    if (!editor) return '<div class="player-editor-launch"><button type="button" class="featured-action" data-open-player-editor="' + esc(person.id) + '">临时编辑属性与技能 <span aria-hidden="true">✎</span></button><small>编辑结果只用于本次模拟，不改写本体档案。</small></div>';
    const teams = editorTeams(person);
    const team = teams.find(item => item.id === editor.teamId) || teams[0];
    const slots = templateSlots(person, team);
    const slotId = slots.some(item => item.id === editor.slotId) ? editor.slotId : slots[0] && slots[0].id;
    const slot = slots.find(item => item.id === slotId);
    const legalSkillGroups = eligibleEditorSkills(editor, team, slot);
    const legalSkillCount = legalSkillGroups.reduce((count, group) => count + group.options.length, 0);
    const contextTeam = state.teamData.find(item => item.id === editor.teamId);
    const categories = editor.skills.map(skill => '<span class="editor-skill-chip">' + esc(skillName(skill)) +
      '<button type="button" aria-label="移除 ' + esc(skillName(skill)) + '" data-remove-editor-skill="' + esc(skill.id) + '">×</button></span>').join("");
    const appliedBadge = editor.applied ? '<span class="simulation-badge">模拟已应用</span>' : '<span class="simulation-badge is-pending">待预览</span>';
    const teamPreview = standardMode() ? (editor.applied ? '<p class="editor-note">编辑已应用到临时名单；属性或技能改变后，原始标准任务缓存失效。球员与球队六维均待重新计算，不沿用旧代理预览。</p>' : '') : editor.applied && contextTeam ? '<div class="simulation-team"><div class="simulation-team-heading"><div><b>' + esc(fullTeamName(contextTeam)) + '</b><small>' +
      (editor.mode === "league" ? "联赛成长临时投影 · 未计成长点数成本" : "锦标赛名单即时重算") + '</small></div><div>' + gradeTag(contextTeam.overallGrade) + '</div></div>' +
      '<div class="simulation-team-chart">' + radarSVG(contextTeam.scores, contextTeam.grades, true, "team") + '<span><b>规则原始加权分 ' + contextTeam.overallScore.toFixed(1) + '</b><small>排名赋分总评 ' + contextTeam.overallAssignedScore.toFixed(1) + ' · ' + esc(contextTeam.overallGrade) + '</small></span></div></div>' : '';
    const scenarioSelectors = '<label>选择球队名单<select name="teamId" data-editor-team>' + teams.map(item => '<option value="' + esc(item.id) + '"' + (item.id === editor.teamId ? " selected" : "") + '>' + esc(fullTeamName(item)) + '</option>').join("") + '</select></label>' +
        '<label>编辑名单中的球员<select name="slotId" data-editor-slot>' + slots.map(item => '<option value="' + esc(item.id) + '"' + (item.id === slotId ? " selected" : "") + '>#' + esc(item.number) + ' · ' + esc(item.name) + (item.boughtSkill ? ' · ' + esc(skillName(item.boughtSkill)) : '') + '</option>').join("") + '</select></label>';
    const modeControl = '<label>模拟情境<select name="mode" data-editor-mode><option value="tournament"' + (editor.mode === "tournament" ? " selected" : "") + '>锦标赛名单调整</option><option value="league"' + (editor.mode === "league" ? " selected" : "") + '>联赛成长模拟</option></select></label>';
    const addSkillControl = '<div class="editor-add-skill"><label>可合法学习的技能<select name="newSkillId"><option value="">选择技能…</option>' + skillOptions(legalSkillGroups) + '</select></label><label>阈值<input name="newSkillValue" type="number" min="2" max="6" value="4" aria-label="技能阈值；例如 Loner 4+"></label><label>特定关键词<input name="newSkillKeyword" type="text" maxlength="28" placeholder="可选"></label><button type="button" class="editor-add-button" data-add-editor-skill' + (legalSkillCount ? "" : " disabled") + '>添加</button></div>';
    const note = '技能选项按该位置的主、副技能类别生成，并排除已拥有、互斥或先决条件不符的技能。每项技能都映射到六维中的适用规则情境；情境依赖队友、对手、赛制或特殊行动时，只有触发机会才产生贡献。联赛模式暂不计算 SPP 或金币成长成本。';
    return '<section class="player-editor"><div class="player-editor-heading"><div><b>临时球员编辑器</b><small>仅影响当前选择的名单槽位与本次预览，不覆盖基础资料</small></div>' + appliedBadge + '</div>' +
      '<form data-player-editor><div class="editor-context-grid">' + modeControl +
      scenarioSelectors + '</div>' +
      '<div class="editor-stats">' + [["移动力","ma",0,10],["力量","st",1,7],["敏捷目标","ag",1,6],["传球目标","pa",1,6],["护甲目标","av",3,11]].map(([label, name, min, max]) => '<label>' + esc(label) + '<input type="number" name="' + name + '" min="' + min + '" max="' + max + '"' + (name === "pa" ? '' : ' required') + ' value="' + esc(editor.stats[name] == null ? "" : editor.stats[name]) + '" placeholder="—"></label>').join("") + '</div>' +
      '<div class="editor-skill-title"><b>技能</b><small>× 移除 · 只列该位置可学且当前没有的技能</small></div><div class="editor-skill-list">' + (categories || '<span class="editor-no-skills">无技能</span>') + '</div>' +
      addSkillControl +
      '<div class="editor-actions"><button class="featured-action" type="submit">' + (standardMode() ? '应用临时名单 · 六维待复算' : '预览并重算六维') + ' <span aria-hidden="true">↻</span></button><button class="editor-reset" type="button" data-reset-player-editor>清除本次模拟</button></div>' +
      '<p class="editor-note">' + note + '</p></form>' + teamPreview + '</section>';
  }

  function playerScoreBreakdown(person) {
    const data = person.scoreBreakdown;
    if (!data) return "";
    const pct = value => legacyNumberText(value, 1, "%");
    const roleNames = { ballProgression: "持球推进", scoringReception: "得分接应", stableBlitz: "稳定突袭", laneProtection: "封路保护", openingSupport: "开路支援" };
    const roles = (data.adaptability.roles || []).map(role => (roleNames[role.id] || role.id) + " 任务 " + pct(role.score) + " / 覆盖 " + Number(role.coverage || 0).toFixed(1) + "%").join("；");
    const fastTasks = (data.fastAttack.taskDistances || []).map((distance, index) => distance + "格 " + pct((data.fastAttack.taskRates || [])[index])).join("；");
    const survivalByStrength = (data.survival.byOpponentST || []).map(row => "ST" + row.attackerST + "：站立 " + pct(row.standing) + " / 出现推挤结果 " + pct(row.pushed) + " / 留场 " + pct(row.onPitch) + " / 下个进攻段可用 " + pct(row.nextDriveAvailable)).join("；");
    const survivalItem = `<li><b>生存</b> · 对手 ST3/4/5/6 各一次无支援阻挡，四种基准等权；${survivalByStrength || "力量对位分项待生成"}。汇总后仍站立 ${pct(data.survival.standingAfterHit)}、当前仍在场 ${pct(data.survival.onPitchNow)}、下一进攻段可用 ${pct(data.survival.nextDriveAvailable)}；主分为三项等权暂定指数 ${pct(data.survival.score)}。这里的“推挤结果”不等于最终被移位；ST改变阻挡骰选择权和倒地风险，但规则不让 ST 抵消已选 Push。Stand Firm/Rooted 等技能由引擎版精确原格任务单独识别，尚未校准进旧版主分；重生只影响后续回场。</li>`;
    const controlItem = `<li><b>控场</b> · 总指数=min(100，静态守区+动态延伸)：动态覆盖只加不减，不因低移动而削掉原地控制。静态守区把压制指数与对手 ST3/4/5/6 阻挡后仍站立率等权；动态延伸按移动可达距离折减。此球员静态守区 ${pct(data.control.stationaryScore)}、动态延伸 ${pct(data.control.dynamicScore)}、合成 ${pct(data.control.score)}；ST3/4/5/6 对手阻挡后仍站立/推挤结果 ${(data.control.staticRetentionByOpponentST || []).map(row => "ST" + row.opponentST + " " + pct(row.standing) + "/" + pct(row.pushed)).join(" / ")}。另列按本人 ST 计算的阻挡威胁 ${pct(data.control.blockThreat)}、特殊控制 ${pct(data.control.specialHold)}、Guard 支援增量 ${pct(data.control.guardSupport)}；半径一格区域允许被推一格后仍留区。精确原格留存由 v3 引擎任务单独记录。ST改变选骰权和倒地概率，但不直接抵消已选 Push；Stand Firm/Rooted 等技能影响实际位移。该合成仍是暂定比较指数，不是整张棋盘求解。</li>`;
    const scopeNames = { direct: "直接检定", conditional: "条件动作", "direct-or-conditional": "直接/条件动作", "team-context": "团队情境", "league-context": "联赛情境" };
    const signedScore = value => Number.isFinite(Number(value)) ? (Number(value) >= 0 ? "+" : "−") + Math.abs(Number(value)).toFixed(1) : "数值待核对";
    const displayedValue = (value, type) => type === "index" ? legacyNumberText(value, 1, "/100") : signedScore(value);
    const mappedSkills = (data.skillEffects || []).map(effect => {
      const skill = SKILL_CATALOG.find(item => item.id === effect.id);
      return '<li>' + esc(skill ? skill.name : effect.id) + ' → ' + esc(effect.dimensions.join("/")) + '（' + esc(effect.scopes.map(scope => scopeNames[scope] || scope).join("、")) + '）<small> ' + esc(coverageLabel(effect.coverage)) + '：' + esc(effect.coverageNote || "") + '</small></li>';
    }).join("");
    const modeledSpecials = (data.specialRuleEffects || []).map(effect => '<li>' + esc(effect.name || effect.id) + ' → ' + esc((effect.dimensions || []).join("/")) +
      (effect.scoreGain == null ? '' : ' · ' + esc(effect.targetDimension || effect.dimensions?.[0] || '六维') + (Number.isFinite(Number(effect.scoreGain)) ? (effect.includedInScore === false ? ' 条件情境 ' : ' 已计入 ') : ' 旧代理增量 ') + signedScore(effect.scoreGain)) +
      (effect.conditionalGain == null ? '' : ' · ' + esc(specialRuleConditionLabel(effect)) + ' ' + signedScore(effect.conditionalGain)) +
      (effect.secondaryConditionalGain == null ? '' : ' · ' + esc(specialRuleConditionLabel(effect, true)) + ' ' + displayedValue(effect.secondaryConditionalGain, effect.secondaryValueType)) +
      (effect.secondaryScoreGain == null ? '' : ' · ' + esc(effect.secondaryTargetDimension || '次要维度') + '计入 ' + signedScore(effect.secondaryScoreGain)) +
      (effect.riskProbability == null ? '' : ' · 风险 ' + esc(effect.riskLabel || '条件风险') + ' ' + legacyNumberText(effect.riskProbability, 1, '%')) +
      (effect.protectionNote ? ' · 规则豁免：' + esc(effect.protectionNote) : '') +
      '<small>' + esc(effect.status || '') + '；' + esc(effect.coverage || '') + '</small></li>').join("");
    return '<details class="player-score-breakdown"><summary>查看这名球员的逐项概率拆解</summary><ul>' +
      '<li><b>快攻</b> · ' + (data.fastAttack.cannotCarryBall ? 'No Ball 无法持球，快攻记为 0；移动能力仍会影响控场。' : '最长移动 ' + data.fastAttack.maxDistance + ' 格；含终点 Rush 在内，沿两处受标记路线站立抵达：' + fastTasks + '。快攻暂定分为三种固定距离成功率的等权均值。') + '</li>' +
      '<li><b>控球</b> · ' + (data.ball.cannotCarryBall ? 'No Ball 无法持球，控球记为 0。' : '取得球权 ' + pct(data.ball.acquisition) + '（空路拾球 ' + pct(data.ball.openPickup) + '、受标记拾球 ' + pct(data.ball.markedPickup) + '）；普通阻挡后本人保球 ' + pct(data.ball.ordinaryHitRetention) + '、Strip Ball 威胁下本人保球 ' + pct(data.ball.stripBallRetention) + '；球权转移 ' + pct(data.ball.transfer) + '（Quick Pass 到普通 AG3+ 接球队友完整接球链 ' + pct(data.ball.quickPassChain) + '）。三组等权形成暂定指数 ' + pct(data.ball.score) + '。</li>') +
      '<li><b>杀伤</b> · ST ' + data.lethality.attackerST + ' 对 ST3/AV9；击倒 ' + pct(data.lethality.knockdown) + '，安全击倒 ' + pct(data.lethality.safeKnockdown) + '，攻击者 turnover ' + pct(data.lethality.turnover) + '；阻挡路线指数 ' + legacyNumberText(data.lethality.blockImpact, 1, ' / 100') + ' = 安全击倒率 × 75% + 安全移出率 × 25%。击倒是主要战斗结果，移出作为严重度加成且属于击倒子集，不重复算成独立事件；全维杀伤指数取阻挡、特殊攻击、条件犯规路线中的最高值。Brawler 仅按宣告普通 Block 时重掷一个 Both Down 计入。安全移出 ' + pct(data.lethality.safeRemoval) + '、预计移出 ' + pct(data.lethality.expectedRemoval) + '；另列特殊攻击 ' + pct(data.lethality.specialAttack) + '、倒地目标上的 Dirty Player 犯规移出 ' + pct(data.lethality.dirtyPlayerFoul) + '。团队支援站位、裁判资源与完整犯规行动链未模拟。</li>' +
      survivalItem + controlItem +
      '<li><b>适应力候选：个人角色覆盖向量</b> · 五种职责分别展示任务值与单角色阈值覆盖度：' + roles + '。这些任务值分别反映持球推进、得分接应、稳定突袭、封路保护、开路支援；当前不跨角色加权成正式总分。阈值是暂定解释参数；具体阵容里的队内贡献须在球队详情中按移除、替补接任/重新分工和普通同位置替换作比较。</li>' +
      (mappedSkills ? '<li><details><summary><b>技能去向</b> · ' + (data.skillEffects || []).length + ' 项，逐条映射到维度与触发情境</summary><ul>' + mappedSkills + '</ul></details></li>' : '') +
      (person.specialRules ? '<li><details><summary><b>明星专属规则效果拆解</b> · ' + (data.specialRuleEffects || []).length + ' 条已逐条映射</summary><ul>' + (modeledSpecials || '<li>该明星规则效果映射待补。</li>') + '</ul><small>配对、团队资源、指定对手或整场时长效果会注明触发条件；没有相应比赛情境时不作为个人固定分。</small></details></li>' : '') +
      '</ul><small>原始概率、任务指数和排名赋分分开显示。当前个人总评仍是旧代理，只计算前五项；页面候选模型的六维为快攻、控球、杀伤、生存、控场、适应力。两者尚未完成统一标定，不应混作正式评级。排行榜可直接查看每一种角色任务。百分比只适用于上方固定情境；角色阈值和各任务情境权重尚未用比赛数据校准。</small></details>';
  }

  function starSpecialRulePanel(person) {
    if (!person.specialRules) return '<div class="featured-skill"><b>明星专属规则与效果</b><p>规则资料待补。</p></div>';
    const signedScore = value => Number.isFinite(Number(value))
      ? (Number(value) >= 0 ? "+" : "−") + Math.abs(Number(value)).toFixed(1)
      : '无法计算（旧版说明未适配）';
    const displayedValue = (value, type) => type === "index" ? legacyNumberText(value, 1, "/100") : signedScore(value);
    const effects = person.scoreBreakdown && person.scoreBreakdown.specialRuleEffects || [];
    const dimensions = effects[0]?.dimensions || person.specialRuleDimensions || [];
    const badges = dimensions.map(name => '<span class="meta-chip">关联：' + esc(name) + '</span>').join("");
    const quantified = effects.filter(effect => effect.scoreGain != null && Number.isFinite(Number(effect.scoreGain)) && effect.includedInScore !== false).length;
    const conditional = effects.filter(effect => effect.conditionalGain != null || effect.secondaryConditionalGain != null || effect.riskProbability != null || effect.protectionNote).length;
    const contextOnly = effects.filter(effect => effect.scoreGain == null && effect.conditionalGain == null && effect.secondaryConditionalGain == null && effect.riskProbability == null && !effect.protectionNote).length;
    const status = '旧代理计入 ' + quantified + ' 条 · 条件/风险效果 ' + conditional + ' 条 · 需阵容或场景 ' + contextOnly + ' 条';
    const effectRows = effects.map(effect => '<li><b>' + esc(effect.name || effect.id) + '</b> → ' + esc((effect.dimensions || []).join('、')) +
      (effect.scoreGain == null ? '' : ' · ' + esc(effect.targetDimension || effect.dimensions?.[0] || '六维') + (Number.isFinite(Number(effect.scoreGain)) ? (effect.includedInScore === false ? ' 情境值 ' : ' 已计入 ') : ' 旧代理增量 ') + signedScore(effect.scoreGain)) +
      (effect.conditionalGain == null ? '' : ' · ' + esc(specialRuleConditionLabel(effect)) + ' ' + signedScore(effect.conditionalGain)) +
      (effect.secondaryConditionalGain == null && !effect.secondaryConditionalLabel ? '' : ' · ' + esc(specialRuleConditionLabel(effect, true)) + (effect.secondaryConditionalGain == null ? '' : ' ' + displayedValue(effect.secondaryConditionalGain, effect.secondaryValueType))) +
      (effect.secondaryScoreGain == null ? '' : ' · ' + esc(effect.secondaryTargetDimension || '次要维度') + '计入 ' + signedScore(effect.secondaryScoreGain)) +
      (effect.riskProbability == null ? '' : ' · 风险 ' + esc(effect.riskLabel || '条件风险') + ' ' + legacyNumberText(effect.riskProbability, 1, '%')) +
      (effect.protectionNote ? ' · 规则豁免：' + esc(effect.protectionNote) : '') +
      '<small class="star-effect-description"><b>规则效果：</b>' + esc(effect.coverage || '效果说明待补') + '</small>' +
      '<small class="star-effect-status"><b>模型状态：</b>' + esc(effect.status || '已建立效果映射') + '</small></li>').join('');
    return '<section class="appearance-details star-special-rules" aria-label="明星专属规则"><h4 class="star-special-heading">明星专属规则</h4>' +
      '<p class="star-special-label">规则译文</p><p class="star-special-text">' + esc(person.specialRules) + '</p>' +
      '<details><summary>旧代理效果对照 · ' + esc(status) + '</summary><div class="featured-meta">' + badges + '</div><ul class="star-effect-list">' + (effectRows || '<li>规则效果映射待补。</li>') + '</ul></details>' +
      '<small>对照中的固定加分来自旧模型，不进入规范六维或下方真实任务概率。任务计算保留明星身份与合法自动反应；尚未声明全部主动特殊规则，也不代表其最大实战收益。</small>' +
      '<small class="star-special-source">规则译文来源：' + esc(person.specialRuleSource || "项目规则资料") + '</small></section>';
  }

  function renderFeatured(kind, item) {
    if (item && (standardMode() || item.isStarPair)) return renderStandardFeatured(kind, item);
    if (!item) return '<div class="featured-empty">没有找到符合条件的对象，请调整赛区、赛制或搜索词。</div>';
    const sixAxisCandidate = kind === "team" ? null : sixAxisCandidateFor(item, kind);
    const featuredRadar = sixAxisCandidate ? sixAxisCandidateRadar(sixAxisCandidate) : kind === "team" ? teamRadar(item) : canonicalRadarSVG(item);
    const featuredScores = sixAxisCandidate ? sixAxisCandidateCells(sixAxisCandidate) : canonicalScoreCells(item);
    let subtitle = "", description = "", meta = "", facts = "", extra = "";
    if (kind === "team") {
      subtitle = item.rosterName + " · " + item.formatName + " · " + item.players.length + " 名球员";
      description = item.intro || "暂无球队介绍。";
      const legality = teamLegality(item);
      meta = '<span class="meta-chip">' + (teamCanRank(item) ? '实验总评 ' + esc(item.overallGrade) + ' · ' + item.overallAssignedScore.toFixed(1) + ' · ' + (Number.isInteger(item.teamRank) ? '第 ' + item.teamRank : '并列第 ' + item.teamRank) : '球队评级暂缓 · 构筑先修正') + '</span><span class="meta-chip">V7.0.1 构筑：' + esc(legality.status === "valid" ? "通过" : legality.status === "invalid" ? "未通过" : legality.status === "needs-setup" ? "待补配置" : legality.status === "simulation-unverified" ? "模拟未校验" : "缺少记录") + '</span><span class="meta-chip">预算 ' + esc(fullCurrency(item.budget)) + '</span><span class="meta-chip">重掷 ' + item.rerolls + ' 次</span><span class="meta-chip">' + (item.apothecary ? "有队医" : "无队医") + '</span>' +
        item.leagueNames.map(league => '<span class="meta-chip">' + esc(league) + '</span>').join("");
      extra = '<div class="team-shortcuts"><button type="button" class="featured-action" data-open-team-players="' + esc(item.id) + '">查看这支球队的球员档案 <span aria-hidden="true">→</span></button><button type="button" class="featured-action" data-open-star-ranking="' + esc(item.id) + '">查看本赛区明星适配排行 <span aria-hidden="true">→</span></button></div>' + renderTeamStarCandidates(item) + renderTeamMatchup(item) + renderTeamRosterAdjustment(item) + teamRosterSelectionDetails(item) + renderCoachEvaluation(item) + renderTeamGroundBallContribution(item) + renderTeamCarrierContext(item) + renderGoblinTeamFoulContext(item) + renderVampireRunnerSupportContext(item) + renderTeamStrengthContext(item) + renderTeamTaskExperiment(item) + renderTeamCarrierExperiment(item) + renderTeamImportance(item);
    } else if (kind === "player") {
      const appearances = item.visibleAppearances || item.appearances;
      const provisional = calibrationFor(item);
      const teams = new Set(appearances.map(entry => entry.rosterName)).size;
      const builds = new Set(appearances.map(entry => entry.teamId)).size;
      subtitle = item.simulated ? "临时模拟 · 改动只作用于当前名单槽位" : "本体球员 · 基础属性与初始技能";
      description = item.simulated ? "属性或技能已临时修改；原档案候选不套用到修改后球员。请在任务档案中重新计算其规则结果。" : (item.description || "六维展示为 V7.0.1 任务排名候选，缺项按卡片标注回退代理；跨任务权重和等级映射仍在校准。");
      facts = playerStats(item);
      meta = (sixAxisCandidate ? '<span class="meta-chip">暂定总评 ' + esc(sixAxisCandidate.overallGrade) + ' · ' + Number(sixAxisCandidate.overallScore).toFixed(1) + ' · 第 ' + sixAxisCandidate.overallRank + ' 名</span>' : '<span class="meta-chip">六维候选暂缺</span>') + '<span class="meta-chip">' + teams + ' 支球队可用</span><span class="meta-chip">' + builds + ' 套实编阵容</span>' +
        Array.from(new Set(appearances.map(entry => entry.formatName))).map(name => '<span class="meta-chip">' + esc(name) + '</span>').join("");
      extra = (item.simulated ? '' : '<button type="button" class="featured-action" data-open-six-axis-profile="player" data-profile-name="' + esc(item.name) + '">在六维评价中查看此球员 <span aria-hidden="true">→</span></button>') +
        '<div class="featured-skill"><b>' + (item.simulated ? "临时模拟技能" : "技能与特征") + '</b><p>' + esc(item.skillText || "无初始技能") + '</p><small>' + esc((item.keywords || []).join(" · ")) + '</small></div>' +
        renderTouchdownEvidence(item) + renderPlayerTaskSuite(item) + renderArmBarEvidence(item) + renderPlayerRoleExperiment(item) + playerRoleVector(item) + renderCoachEvaluation(item) + playerScoreBreakdown(item) + appearanceDetails(item) + renderPlayerEditor(item);
      if (item.descriptionVariants && item.descriptionVariants.length > 1) {
        extra += '<details class="appearance-details"><summary>不同球队的档案说明 · ' + item.descriptionVariants.length + ' 条</summary><ul>' +
          item.descriptionVariants.map(row => '<li><b>' + esc(row.teamName) + '</b><br><span>' + esc(row.text) + '</span></li>').join("") + '</ul></details>';
      }
    } else {
      const provisional = calibrationFor(item, "standard");
      subtitle = (item.simulated ? "临时模拟 · 明星本体六维" : "明星球员") + " · " + (item.cost ? fullCurrency(item.cost) : "费用见图鉴");
      description = item.simulated ? "属性或技能已临时修改；原明星候选不套用到修改后档案，请按新档案重新计算任务。" : (item.description || "明星规则以任务证据为准；六维候选尚未完成正式标定。");
      facts = starSpecialRulePanel(item) + playerStats(item);
      const ruleEffects = item.scoreBreakdown && item.scoreBreakdown.specialRuleEffects || [];
      const directRuleEffects = ruleEffects.filter(effect => effect.scoreGain != null && effect.includedInScore !== false).length;
      const conditionalRuleEffects = ruleEffects.filter(effect => effect.conditionalGain != null || effect.secondaryConditionalGain != null || effect.riskProbability != null || effect.protectionNote).length;
      const contextRuleEffects = ruleEffects.filter(effect => effect.scoreGain == null && effect.conditionalGain == null && effect.secondaryConditionalGain == null && effect.riskProbability == null && !effect.protectionNote).length;
      meta = '<span class="meta-chip">明星球员 · 暂定总评 ' + (sixAxisCandidate ? esc(sixAxisCandidate.overallGrade) + ' · ' + Number(sixAxisCandidate.overallScore).toFixed(1) + ' · 第 ' + sixAxisCandidate.overallRank + ' 名' : '暂缺') + '</span>' +
        '<span class="meta-chip">明星规则映射：' + directRuleEffects + ' 条旧代理结果（未计入新候选） · ' + conditionalRuleEffects + ' 条条件/风险 · ' + contextRuleEffects + ' 条依赖队伍/场景</span>' +
        (item.cost ? '<span class="meta-chip">' + (item.pairTotalCost ? '个人分摊 ' : '费用 ') + esc(fullCurrency(item.cost)) + '</span>' : "") +
        (item.pairTotalCost ? '<span class="meta-chip">配对合计 ' + esc(fullCurrency(item.pairTotalCost)) + '（两人均摊）</span>' : "");
      const groups = Object.entries(item.eligibleByLeague || {});
      extra = renderCoachEvaluation(item) + '<details class="appearance-details"><summary>可用赛区与球队 · ' + groups.length + ' 个赛区</summary><ul>' +
        groups.map(group => '<li><b>' + esc(group[0]) + '</b><br><span>' + esc(group[1].join("、")) + '</span></li>').join("") + '</ul></details>';
      extra += starTeamFitDetails(item);
      extra += '<button type="button" class="featured-action" data-open-six-axis-profile="star" data-profile-name="' + esc(item.name) + '">在六维评价中查看此明星 <span aria-hidden="true">→</span></button>' +
        '<div class="featured-skill"><b>' + (item.simulated ? "临时模拟技能" : "技能与特征") + '</b><p>' + esc(item.skillText || "无初始技能") + '</p><small>' + esc((item.keywords || []).join(" · ")) + '</small></div>' +
        renderTouchdownEvidence(item) + renderPlayerTaskSuite(item) + renderPlayerRoleExperiment(item) + playerRoleVector(item) + playerScoreBreakdown(item) + renderPlayerEditor(item);
    }
    const artKind = kind === "team" ? "teams" : kind === "star" ? "stars" : "players";
    const artAttrs = leagueBackdropAttrs(item, artKind, state.league);
    return '<article class="featured-card' + (artAttrs ? " atlas-art-card" : "") + '"' + artAttrs + '><div class="featured-main ' + (kind === "team" ? "team-featured-main" : "") + '"><div class="featured-copy"><div class="featured-kicker"><span>' +
      (kind === "team" ? '球队六维阵容能力实验标定' : '六维任务排名候选') + '</span><span class="model-pending">' + (kind === "team" ? (teamCanRank(item) ? '合法构筑实验评级 ' + esc(item.overallGrade) + ' · 第 ' + item.teamRank + ' 名' : '构筑需修正 · 暂不评级') : item.simulated ? '模拟后待复算' : sixAxisCandidate ? '暂定总评 ' + esc(sixAxisCandidate.overallGrade) + ' · ' + sixAxisCandidate.overallRank + ' 名' : '当前赛制暂无候选') + '</span></div><div class="featured-title-row ' + (kind === "team" ? "team-art-title-row" : "") + '">' +
      (kind === "team" ? portraitMark(item, "featured-team-art", "featured-mark") : portraitMark(item, kind === "star" ? "featured-portrait featured-star-portrait" : "featured-portrait", "featured-mark")) + '<div><h3>' + esc(kind === "team" ? fullTeamName(item) : item.name) + '</h3><p>' + esc(subtitle) + '</p></div></div>' +
      '<p class="featured-description">' + esc(description) + '</p><div class="featured-meta">' + meta + '</div>' + facts + '</div>' +
      '<div class="featured-chart-wrap">' + featuredRadar + '</div></div>' + featuredScores +
      (kind === "team" ? '' : '<details class="legacy-profile-preview"><summary>查看旧任务指数、赋分与实验总评（未迁移至规范六维）</summary><div class="legacy-preview-chart">' + radarSVG(item.scores, item.grades, false, "player") + '<span>' + gradeTag(item.overallGrade) + ' 旧代理等级</span></div>' + scoreCells(item.scores, item.grades, item.overallAssignedDimensions || null, "player") + '</details>') +
      extra + '<a class="detail-link" href="../全赛区球队与球员六维图鉴_v0.1.md">查看原始名单与历史静态图鉴快照 ↗</a></article>';
  }

  function render() {
    persistBrowseFilters();
    updateControls();
    state.teamData = computedTeams();
    const playerData = playersWithSimulation();
    let items = [], selected = null, kind = state.view;
    if (state.view === "teams") {
      items = filteredTeams();
      if (!items.some(item => item.id === state.selectedId)) state.selectedId = items.length ? items[0].id : "";
      selected = items.find(item => item.id === state.selectedId);
      setHeading(currentLeagueLabel(), (state.format ? (state.format === "standard" ? "十一人制" : "七人制") : "十一人制与七人制") + " · 球队完整名单与整体六维", items.length + " 套球队阵容");
      document.getElementById("rail-title").textContent = "横向浏览球队阵容";
      document.getElementById("rail-hint").textContent = "卡片显示完整队名与赛制；点选查看球队介绍、阵容资料和规则情境证据";
      document.getElementById("rail-footnote").textContent = "当前展示六维阵容能力实验榜；六个已赋分维度直接按公开权重合成球队总评分，再按总评分进行同赛制排名赋分，不重复排名球队维度。60 套参考名单均已按 V7.0.1 校验通过；球队等级仍非正式实力结论或胜率。查看详情可见名单修正记录。";
      railEl.innerHTML = items.length ? items.map(renderTeamCard).join("") : '<div class="empty-state">没有符合条件的球队阵容。</div>';
      featuredEl.innerHTML = renderFeatured("team", selected);
    } else if (state.view === "players") {
      items = filteredProfiles(playerData);
      if (!items.some(item => item.id === state.selectedId)) state.selectedId = items.length ? items[0].id : "";
      selected = items.find(item => item.id === state.selectedId);
      const scopedTeam = state.teamScope && DATA.teams.find(team => team.id === state.teamScope);
      setHeading(scopedTeam ? fullTeamName(scopedTeam) : currentLeagueLabel(), standardMode() ? "基础属性、技能或关键词不同的同名档案分别保留" : "只列基础球员本体；同一球员模板只显示一张卡", items.length + " 种基础球员模板");
      document.getElementById("rail-title").textContent = scopedTeam ? "横向浏览这支球队的基础球员" : "横向浏览不重复的基础球员";
      document.getElementById("rail-hint").textContent = scopedTeam ? "购入技能不产生额外卡片；点选查看本体六维与初始技能" : "同一球员模板只显示一张；点选查看基础能力、初始技能与适用阵容";
      document.getElementById("rail-footnote").textContent = "按本体名称、属性、特征与初始技能合并；忽略球衣编号、重复名额和购入技能。详情只保留其所在球队与赛制。";
      railEl.innerHTML = items.length ? items.map(renderPlayerCard).join("") : '<div class="empty-state">没有找到符合条件的球员档案。</div>';
      featuredEl.innerHTML = renderFeatured("player", selected);
    } else {
      items = filteredStars(playerData);
      if (!items.some(item => item.id === state.selectedId)) state.selectedId = items.length ? items[0].id : "";
      selected = items.find(item => item.id === state.selectedId);
      setHeading(currentLeagueLabel(), "完整浏览明星球员与双人合约；赛区筛选只显示已选赛区可用对象", items.length + " 个明星对象");
      document.getElementById("rail-title").textContent = "横向比较明星球员";
      document.getElementById("rail-hint").textContent = "滑动比较六维；卡片展示专属规则摘要，点选查看原文与效果拆解";
      document.getElementById("rail-footnote").textContent = "明星能力单独评估，不自动计入球队整体六维。";
      railEl.innerHTML = items.length ? items.map(renderStarCard).join("") : '<div class="empty-state">这个赛区没有符合搜索条件的明星球员。</div>';
      featuredEl.innerHTML = renderFeatured("star", selected);
    }
    if (standardMode()) {
      document.getElementById("rail-footnote").textContent = "标准任务底分保留绝对终点表现；六维雷达使用同赛制相对赋分。历史候选榜与旧代理公式在历史版本中独立保留。";
    }
    positionPortraitCrops();
    state.rankPlayerData = playerData;
    renderRankings(playerData);
  }

  function selectView(view) {
    if (!["teams", "players", "stars"].includes(view)) return;
    closeGlobalSearchResults();
    if(state.view!==view){state.search="";searchInput.value="";}
    state.view = view;
    state.selectedId = "";
    state.teamScope = "";
    persistBrowseFilters();
    const url = new URL(window.location.href);
    if (view === "teams") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
    render();
  }

  const scoreModeControl = document.getElementById("score-version-mode");
  function syncScoreVersion() {
    if (scoreModeControl) scoreModeControl.value = scoreVersionMode;
    document.getElementById("stat-players").textContent = currentPlayerCatalog().length;
    document.querySelectorAll("[data-score-history]").forEach(element => { element.hidden = standardMode(); });
    document.getElementById("adaptability-axis-hint").textContent = standardMode() ? "角色广度 · 受压保底" : "角色覆盖 · 阵容贡献";
    const experiment = document.getElementById("standard-task-experiment");
    if (experiment) experiment.hidden = !standardMode();
    const currentRankings = document.getElementById("standard-task-rankings");
    if (currentRankings) currentRankings.hidden = !standardMode();
    const differences = document.getElementById("team-task-selection-comparison"); if (differences) differences.hidden = !standardMode();
    const currentRankNav = document.getElementById("standard-ranking-nav");
    if (currentRankNav) currentRankNav.hidden = !standardMode();
    document.getElementById("six-axis-nav").href = standardMode() ? "#standard-task-experiment" : "#six-axis-candidate-v361";
    document.getElementById("score-method-nav").href = standardMode() ? "#standard-task-experiment" : "#method";
    document.getElementById("score-version-note").textContent = standardMode() ? (scoreVersionMode === "candidate" ? "当前30队高手军表：控球、生存已按当前名单更新；六维已接入；球队杀伤采用已确认联合优化版；个人采用统一动作净收益版。个人第六维采用最佳合法球队出场贡献，按14%计入综合总评；球队内重要性明细保留；七人制保留原分。" : scoreVersionMode === "previous" ? "历史标准任务V7：保留原固定分工、六维赋分与总榜。" : "" + (window.BB_SURVIVAL_V9_ACTIVE ? "V9全队生存：25%抗击倒＋50%抗伤留场／再生保全＋25%后续可用；仅改变十一人制生存，其他五维和综合权重保留；区间未取中点。" : "历史V8任务择优与原总榜保留。") + " 七人制与个人保留V7。") : "历史候选V711：同条件名次点及旧代理，保留原始数值和功能。";
  }
  scoreModeControl?.addEventListener("change", () => {
    scoreVersionMode = scoreModeControl.value;
    try { localStorage.setItem("bb-score-version-mode-v1", scoreVersionMode); } catch (_) {}
    const url = new URL(location.href); url.searchParams.set("score", scoreVersionMode); location.href = url.href;
  });
  window.addEventListener('bb-importance-context-change',()=>{if(standardMode())render();});
  window.addEventListener("bb-standard-task-ready", () => { if (standardMode()) render(); });
  syncScoreVersion();
  window.BB_OPEN_ATLAS_PROFILE = ({ id, name, kind, format, profile }) => {
    if (!["player", "star", "team"].includes(kind)) return false;
    const pool = kind === "team" ? DATA.teams : kind === "star" ? DATA.stars : PLAYER_PROFILES;
    const aliases={"High Elf Thrower":"Phoenix Warrior","High Elf Catcher":"White Lion","High Elf Blitzer":"Dragon Prince"};
    const skillKey=skills=>JSON.stringify((skills||[]).map(s=>[typeof s==="string"?s:s.id,typeof s==="string"?null:s.value??null]).sort());
    const keywordKey=words=>JSON.stringify([...(words||[])].sort());
    const wantedFormat = format === "sevens" ? "sevens" : format === "11s" ? "standard" : "";
    const matchesFormat = item => kind !== "team" || !wantedFormat || item.format === wantedFormat;
    const pair = kind === "star" && typeof name === "string" && DATA.stars.find(item => item.isStarPair &&
      (item.id === name.trim() || item.name === name.trim() || item.id === profile?.id ||
        item.members.some(member => member.id === profile?.id || 'star-' + member.id === profile?.id || member.id === name.trim() || 'star-' + member.id === name.trim() || member.name === name.trim())));
    const exact = typeof id === "string" && pool.find(item => item.id === id && matchesFormat(item));
    const person = exact || pair || (typeof name === "string" && name.trim() ? pool.find(item => [name.trim(),aliases[name.trim()]].includes(item.name) && matchesFormat(item) && (!profile || ["ma","st","ag","pa","av"].every(k=>item[k]===profile[k]) && skillKey(item.skills)===skillKey(profile.skills)&&keywordKey(item.keywords)===keywordKey(profile.keywords) && (!(profile.sourceRosters || []).length || (item.sourceRosters || []).some(rosterId=>profile.sourceRosters.includes(rosterId))))) : null);
    if (!person) return false;
    state.view = kind === "team" ? "teams" : kind === "star" ? "stars" : "players";
    state.selectedId = person.id;
    state.teamScope = "";
    state.league = "";
    state.leagues = [];
    state.format = format === "sevens" ? "sevens" : format === "11s" ? "standard" : "";
    state.search = "";
    searchInput.value = "";
    render();
    const url = new URL(window.location.href);
    if (state.view === "stars") url.searchParams.set("view", "stars");
    else url.searchParams.set("view", state.view);
    url.hash = "catalog";
    window.history.replaceState(null, "", url);
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    featuredEl.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  };

  DATA.leagues.forEach(name => {
    const representative = LEAGUE_REPRESENTATIVES[name];
    const roster = representative && DATA.rosters.find(item => item.id === representative.rosterId);
    const player = representative && DATA.stars.find(item => item.id === representative.starId);
    const image = player && player.portrait && '<span class="league-player-frame" data-player-id="' + esc(player.id) + '" aria-hidden="true">' + portraitMark(player, "league-player-portrait", "emblem") + '</span>';
    const leagueArt = LEAGUE_ART[name];
    const artStyle = leagueArt ? ' style="--league-art:url(&quot;' + esc(leagueArt) + '&quot;)"' : '';
    const label = '<span>' + esc(name) + '</span>';
    const title = (roster ? name + ' · 代表球队：' + roster.name : name) + (player ? ' · 代表球员：' + player.name : '');
    leagueStrip.insertAdjacentHTML("beforeend", '<button type="button" class="filter-chip league-chip" data-league="' + esc(name) + '"' + artStyle + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + (image || '') + label + '</button>');
  });
  document.getElementById("stat-leagues").textContent = DATA.leagues.length;
  document.getElementById("stat-rosters").textContent = DATA.rosters.length;
  document.getElementById("stat-builds").textContent = DATA.teams.length;
  document.getElementById("stat-players").textContent = currentPlayerCatalog().length;
  document.getElementById("stat-player-slots").textContent = DATA.teams.reduce((sum, team) => sum + team.players.length, 0);
  document.getElementById("stat-stars").textContent = DATA.stars.length;

  initializeRankings();
  document.getElementById("ranking-kind").addEventListener("change", event => {
    rankingModes[rankingState.kind] = { source: rankingState.source, metric: rankingState.metric, reverse: rankingState.reverse };
    rankingState.kind = event.target.value;
    const previous = rankingModes[rankingState.kind] || {};
    rankingState.source = rankingState.kind === "teams" ? "legacy" : (["raw", "calibrated", "legacy"].includes(previous.source) ? previous.source : "raw");
    rankingState.metric = previous.metric || (rankingState.kind === "teams" ? "overall" : "task-open8");
    rankingState.reverse = previous.reverse === true;
    updateRankingMetricOptions();
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-source").addEventListener("change", event => {
    rankingState.source = event.target.value;
    rankingState.metric = "";
    rankingState.reverse = false;
    if (isCalibratedRanking() && !rankingState.format) rankingState.format = "standard";
    updateRankingMetricOptions();
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-task-policy").addEventListener("change", event => {
    rankingState.taskPolicy = event.target.value;
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("coach-skill-slider").addEventListener("input", event => {
    const preset = COACH_PRESETS[Number(event.target.value)] || COACH_PRESETS[1];
    state.coachSkill = preset.coachSkill;
    try { window.localStorage.setItem(coachSkillStorageKey, String(preset.coachSkill)); } catch (_) {}
    document.getElementById("coach-level-label").textContent = preset.labelZh + " · " + preset.label;
    document.getElementById("coach-level-description").textContent = preset.description + " 当前底层 Coach Skill = " + preset.coachSkill + "/100。";
    render();
  });
  document.getElementById("ranking-metric").addEventListener("change", event => {
    rankingState.metric = event.target.value;
    rankingState.reverse = false;
    updateRankingMetricOptions();
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-direction-toggle").addEventListener("click", () => {
    rankingState.reverse = !rankingState.reverse;
    updateRankingMetricOptions();
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("star-cost-toggle").addEventListener("click", () => {
    rankingState.metric = rankingState.metric === "cost-efficiency" ? "star-team-impact" : "cost-efficiency";
    rankingState.reverse = false;
    updateRankingMetricOptions();
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-format").addEventListener("change", event => {
    rankingState.format = event.target.value;
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-limit").addEventListener("change", event => {
    rankingState.limit = event.target.value;
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-search").addEventListener("input", event => {
    rankingState.search = event.target.value.trim();
    renderRankings(state.rankPlayerData);
  });
  document.getElementById("ranking-list").addEventListener("click", event => {
    const row = event.target.closest("[data-ranking-select]");
    if (row) selectRankingItem(row.dataset.rankingSelect);
  });

  document.querySelector(".view-tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (button) selectView(button.dataset.view);
  });
  formatSwitch.addEventListener("click", event => {
    const button = event.target.closest("[data-format]");
    if (!button) return;
    state.format = state.format === button.dataset.format ? "" : button.dataset.format;
    persistBrowseFilters();
    state.selectedId = "";
    state.teamScope = "";
    render();
  });
  leagueStrip.addEventListener("click", event => {
    const button = event.target.closest("[data-league]");
    if (!button) return;
    const league = button.dataset.league;
    if (!league) state.leagues = [];
    else if (state.leagues.includes(league)) state.leagues = state.leagues.filter(item => item !== league);
    else state.leagues = [...state.leagues, league];
    state.league = state.leagues[0] || "";
    persistBrowseFilters();
    state.selectedId = "";
    state.teamScope = "";
    render();
    button.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  });
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    state.selectedId = "";
    render();
    renderGlobalSearchResults(state.search);
  });
  searchInput.addEventListener("focus", () => renderGlobalSearchResults(searchInput.value));
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeGlobalSearchResults();
      return;
    }
    if (catalogSearchPanel.hidden) return;
    const options = catalogSearchPanel.querySelectorAll('[role="option"]');
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      setGlobalSearchActive(globalSearchActiveIndex + 1);
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      setGlobalSearchActive(globalSearchActiveIndex < 0 ? options.length - 1 : globalSearchActiveIndex - 1);
    } else if (event.key === "Enter" && globalSearchResults.length) {
      event.preventDefault();
      const index = globalSearchActiveIndex < 0 ? 0 : globalSearchActiveIndex;
      openGlobalSearchResult(globalSearchResults[index]);
    }
  });
  catalogSearchPanel.addEventListener("mousedown", event => {
    if (event.target.closest("[data-search-result-index]")) event.preventDefault();
  });
  catalogSearchPanel.addEventListener("click", event => {
    const option = event.target.closest("[data-search-result-index]");
    const result = option && globalSearchResults[Number(option.dataset.searchResultIndex)];
    if (result) openGlobalSearchResult(result);
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".catalog-search")) closeGlobalSearchResults();
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
  document.getElementById("reset-filters").addEventListener("click", () => {
    closeGlobalSearchResults();
    state.league = ""; state.leagues = []; state.format = ""; state.search = ""; state.selectedId = "";
    state.teamScope = "";
    try { window.localStorage.removeItem(browseFilterStorageKey); } catch (_) {}
    searchInput.value = "";
    render();
    leagueStrip.scrollTo({ left: 0, behavior: "smooth" });
    railEl.scrollTo({ left: 0, behavior: "smooth" });
  });
  railEl.addEventListener("click", event => {
    const card = event.target.closest("[data-select]");
    if (!card) return;
    const railPosition = railEl.scrollLeft;
    state.selectedId = card.dataset.select;
    render();
    railEl.scrollLeft = railPosition;
    featuredEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  railEl.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-select]")) {
      event.preventDefault();
      event.target.click();
    }
  });
  featuredEl.addEventListener("click", event => {
    const starProfileLink = event.target.closest("[data-open-star-profile]");
    if (starProfileLink) {
      const star = currentStar(starProfileLink.dataset.openStarProfile);
      const team = state.teamData.find(item => item.id === starProfileLink.dataset.teamId);
      if (!star || !team) return;
      state.view = "stars";
      state.league = team.leagueNames.find(league => (star.eligibleByLeague?.[league] || []).includes(team.rosterName)) || "";
      state.leagues = state.league ? [state.league] : [];
      state.format = "standard";
      state.search = "";
      state.teamScope = "";
      state.selectedId = star.id;
      render();
      featuredEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const starRankingLink = event.target.closest("[data-open-star-ranking]");
    if (starRankingLink) {
      const team = state.teamData.find(item => item.id === starRankingLink.dataset.openStarRanking);
      if (!team || !teamCanRank(team)) return;
      rankingState.kind = "stars";
      rankingState.source = "legacy";
      rankingState.metric = "star-team-impact";
      rankingState.leagues = [state.league && team.leagueNames.includes(state.league) ? state.league : (team.leagueNames[0] || "")].filter(Boolean);
      rankingState.format = "standard";
      rankingState.limit = "all";
      rankingState.search = "";
      rankingState.reverse = false;
      document.getElementById("ranking-kind").value = rankingState.kind;
      document.getElementById("ranking-source").value = rankingState.source;
      updateRankingLeaguePicker();
      document.getElementById("ranking-format").value = rankingState.format;
      document.getElementById("ranking-limit").value = rankingState.limit;
      document.getElementById("ranking-search").value = "";
      updateRankingMetricOptions();
      renderRankings(state.rankPlayerData);
      document.getElementById("rankings").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const standardLink = event.target.closest("[data-open-standard-task-profile]");
    if (standardLink) {
      const record=[...(window.BB_STANDARD_TASK_EXPERIMENT_V1?.dossiers||[]),...(window.BB_STANDARD_TASK_EXPERIMENT_V1?.teamDossiers||[])].find(d=>d.subjectId===standardLink.dataset.profileSubject&&d.format===standardLink.dataset.profileFormat);
      window.BB_OPEN_STANDARD_TASK_PROFILE?.({ name: standardLink.dataset.profileName, kind: standardLink.dataset.openStandardTaskProfile, format: standardLink.dataset.profileFormat, profile:record?.profile, sourceRosters:record?.profile?.sourceRosters });
      return;
    }
    const sixAxisLink = event.target.closest("[data-open-six-axis-profile]");
    if (sixAxisLink) {
      window.BB_OPEN_SIX_AXIS_PROFILE?.({ name: sixAxisLink.dataset.profileName, kind: sixAxisLink.dataset.openSixAxisProfile });
      return;
    }
    const suiteJson = event.target.closest('[data-player-suite-json], [data-player-suite-json-preview] summary');
    if (suiteJson) {
      const panel = suiteJson.closest('.player-task-suite');
      const person = state.rankPlayerData.find(item => item.id === panel.querySelector('[data-player-suite-form]').dataset.playerSuiteForm);
      const cached = person && suiteResultCache.get(person.id);
      if (cached?.key === suiteReference(person).key) {
        const preview = panel.querySelector('[data-player-suite-json-preview]');
        preview.querySelector('textarea').value = JSON.stringify(cached.result, null, 2);
        if (suiteJson.matches('[data-player-suite-json]')) preview.open = true;
      }
      return;
    }
    const roleJson = event.target.closest('[data-role-json], [data-role-json-preview] summary');
    if (roleJson) {
      const panel = roleJson.closest('.role-task-experiment');
      const cached = roleTaskResultCache.get(panel.querySelector('[data-role-task-form]').dataset.roleTaskForm);
      if (cached) {
        const preview = panel.querySelector('[data-role-json-preview]');
        preview.querySelector('textarea').value = JSON.stringify(cached.result, null, 2);
        if (roleJson.matches('[data-role-json]')) preview.open = true;
      }
      return;
    }
    const carrierJson = event.target.closest('[data-carrier-json], [data-carrier-json-preview] summary');
    if (carrierJson) {
      const panel = carrierJson.closest('.carrier-threat-experiment');
      const teamId = panel.querySelector('[data-carrier-threat-form]').dataset.carrierThreatForm;
      const cached = carrierThreatResultCache.get(teamId);
      if (cached) {
        const preview = panel.querySelector('[data-carrier-json-preview]');
        preview.querySelector('textarea').value = JSON.stringify(cached.result, null, 2);
        if (carrierJson.matches('[data-carrier-json]')) preview.open = true;
      }
      return;
    }
    const exportTask = event.target.closest("[data-export-team-task]");
    if (exportTask) {
      const cached = teamTaskResultCache.get(exportTask.dataset.exportTeamTask);
      if (cached) {
        const json = JSON.stringify(cached.result, null, 2);
        const preview = exportTask.parentElement.querySelector('[data-team-task-json]');
        preview.querySelector('textarea').value = json;
        preview.open = true;
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = exportTask.dataset.exportTeamTask + '-task-importance.json';
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return;
    }
    const jsonPreview = event.target.closest('[data-team-task-json] summary');
    if (jsonPreview) {
      const teamId = jsonPreview.closest('.team-task-result').querySelector('[data-export-team-task]').dataset.exportTeamTask;
      const cached = teamTaskResultCache.get(teamId);
      if (cached) jsonPreview.parentElement.querySelector('textarea').value = JSON.stringify(cached.result, null, 2);
      return;
    }
    const openEditor = event.target.closest("[data-open-player-editor]");
    if (openEditor) {
      const person = currentPlayerCatalog().find(item => item.id === openEditor.dataset.openPlayerEditor);
      if (person) beginEditor(person);
      return;
    }
    if (event.target.closest("[data-reset-player-editor]")) {
      state.editor = null;
      render();
      return;
    }
    const addSkill = event.target.closest("[data-add-editor-skill]");
    if (addSkill) {
      const form = addSkill.closest("[data-player-editor]");
      editorDraft(form);
      const skillId = form.elements.newSkillId.value;
      const definition = SKILL_CATALOG.find(item => item.id === skillId);
      const person = currentPlayerCatalog().find(item => item.id === state.editor.profileId);
      const team = DATA.teams.find(item => item.id === state.editor.teamId);
      const slot = templateSlots(person, team).find(item => item.id === state.editor.slotId);
      const legalSkill = eligibleEditorSkills(state.editor, team, slot).some(group => group.options.some(skill => skill.id === skillId));
      if (!definition || !legalSkill) return;
      const value = {};
      if (definition.valued) value.value = clamp(Number(form.elements.newSkillValue.value) || 4, 2, 6);
      if (definition.keyworded && form.elements.newSkillKeyword.value.trim()) value.keyword = form.elements.newSkillKeyword.value.trim();
      state.editor.skills.push(Object.assign({ id: skillId }, value));
      state.editor.applied = false;
      render();
      return;
    }
    const removeSkill = event.target.closest("[data-remove-editor-skill]");
    if (removeSkill) {
      const form = removeSkill.closest("[data-player-editor]");
      editorDraft(form);
      const skillId = removeSkill.dataset.removeEditorSkill;
      state.editor.skills = state.editor.skills.filter(skill => skill.id !== skillId);
      state.editor.applied = false;
      render();
      return;
    }
    const button = event.target.closest("[data-open-team-players]");
    if (!button) return;
    state.view = "players";
    state.selectedId = "";
    state.teamScope = button.dataset.openTeamPlayers;
    const team = DATA.teams.find(item => item.id === state.teamScope);
    state.league = "";
    state.leagues = [];
    state.format = team ? team.format : "";
    render();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  featuredEl.addEventListener("change", event => {
    const matchupForm = event.target.closest("[data-team-matchup-form]");
    if (matchupForm) {
      if (event.target.matches("[data-opponent-league]")) updateTeamMatchupChoices(matchupForm, "league");
      else if (event.target.matches("[data-opponent-roster]")) updateTeamMatchupChoices(matchupForm, "roster");
      else if (event.target.matches("[data-opponent-team]")) {
        try { window.localStorage.setItem("bb-atlas-matchup-opponent-" + (state.teamData.find(item => item.id === matchupForm.dataset.teamMatchupForm)?.format || "standard"), event.target.value); } catch (_) {}
      }
      return;
    }
    const suiteForm = event.target.closest('[data-player-suite-form]');
    if (suiteForm) {
      rememberSuitePreferences(suiteForm);
      const person = state.rankPlayerData.find(item => item.id === suiteForm.dataset.playerSuiteForm);
      if (person) suiteForm.closest('.player-task-suite').outerHTML = renderPlayerTaskSuite(person).replace('<details class="team-task-experiment player-task-suite">', '<details class="team-task-experiment player-task-suite" open>');
      return;
    }
    const roleForm = event.target.closest('[data-role-task-form]');
    if (roleForm) {
      rememberRolePreferences(roleForm);
      const person = state.rankPlayerData.find(item => item.id === roleForm.dataset.roleTaskForm);
      if (person) roleForm.closest('.role-task-experiment').outerHTML = renderPlayerRoleExperiment(person).replace('<details class="team-task-experiment role-task-experiment">', '<details class="team-task-experiment role-task-experiment" open>');
      return;
    }
    const carrierForm = event.target.closest('[data-carrier-threat-form]');
    if (carrierForm) {
      rememberCarrierPreferences(carrierForm);
      const team = state.teamData.find(item => item.id === carrierForm.dataset.carrierThreatForm);
      if (team) carrierForm.closest('.carrier-threat-experiment').outerHTML = renderTeamCarrierExperiment(team).replace('<details class="team-task-experiment carrier-threat-experiment">', '<details class="team-task-experiment carrier-threat-experiment" open>');
      return;
    }
    const taskForm = event.target.closest("[data-team-task-form]");
    if (taskForm) {
      rememberTeamTaskPreferences(taskForm);
      const team = state.teamData.find(item => item.id === taskForm.dataset.teamTaskForm);
      if (team) taskForm.closest('.team-task-experiment').outerHTML = renderTeamTaskExperiment(team).replace('<details class="team-task-experiment">', '<details class="team-task-experiment" open>');
      return;
    }
    const form = event.target.closest("[data-player-editor]");
    if (!form) return;
    editorDraft(form);
    if (event.target.matches("[data-editor-team]")) {
      const person = currentPlayerCatalog().find(item => item.id === state.editor.profileId);
      const team = DATA.teams.find(item => item.id === state.editor.teamId);
      const slot = templateSlots(person, team)[0];
      if (slot) {
        state.editor.slotId = slot.id;
        state.editor.stats = { ma: slot.ma, st: slot.st, ag: slot.ag, pa: slot.pa, av: slot.av };
        state.editor.skills = skillsOnSlot(slot);
      }
      state.editor.applied = false;
      render();
    } else if (event.target.matches("[data-editor-slot]")) {
      const person = currentPlayerCatalog().find(item => item.id === state.editor.profileId);
      const team = DATA.teams.find(item => item.id === state.editor.teamId);
      const slot = templateSlots(person, team).find(item => item.id === state.editor.slotId);
      if (slot) {
        state.editor.stats = { ma: slot.ma, st: slot.st, ag: slot.ag, pa: slot.pa, av: slot.av };
        state.editor.skills = skillsOnSlot(slot);
      }
      state.editor.applied = false;
      render();
    } else if (event.target.matches("[data-editor-mode]")) {
      render();
    }
  });
  featuredEl.addEventListener("submit", async event => {
    if (event.target.matches("[data-team-matchup-form]")) {
      event.preventDefault();
      const form = event.target;
      const team = state.teamData.find(item => item.id === form.dataset.teamMatchupForm);
      const opponent = state.teamData.find(item => item.id === form.elements.opponentTeamId.value);
      if (!team || !opponent) return;
      try { window.localStorage.setItem("bb-atlas-matchup-opponent-" + team.format, opponent.id); } catch (_) {}
      const output = form.closest(".team-matchup").querySelector("[data-team-matchup-result]");
      output.innerHTML = standardMode() ? window.BB_STANDARD_TEAM_COMPARISON(standardRow(team, "team"), standardRow(opponent, "team")) : teamMatchupResult(team, opponent);
      return;
    }
    if (event.target.matches('[data-player-suite-form]')) {
      event.preventDefault();
      const form = event.target;
      const person = state.rankPlayerData.find(item => item.id === form.dataset.playerSuiteForm);
      if (!person) return;
      rememberSuitePreferences(form);
      const current = suiteReference(person);
      const output = form.closest('.player-task-suite').querySelector('[data-player-suite-result]');
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const result = await window.BB_PLAYER_TASKS.evaluate({ player: person, subjectId: person.id, starId: current.starId,
          ...current.preferences, yieldTask: () => new Promise(resolve => window.setTimeout(resolve, 0)),
          onProgress: (done, total, task) => { if (output.isConnected) output.textContent = '已完成 ' + done + ' / ' + total + '：' + task.label + '…'; } });
        suiteResultCache.set(person.id, { key: current.key, result });
        if (output.isConnected) output.innerHTML = playerSuiteResultHTML(result);
      } catch (error) {
        if (output.isConnected) output.textContent = '这份任务档案未能计算，不记为零分：' + error.message;
      } finally { if (submit.isConnected) submit.disabled = false; }
      return;
    }
    if (event.target.matches('[data-role-task-form]')) {
      event.preventDefault();
      const form = event.target;
      const person = state.rankPlayerData.find(item => item.id === form.dataset.roleTaskForm);
      if (!person) return;
      const preferences = rememberRolePreferences(form);
      const output = form.closest('.role-task-experiment').querySelector('[data-role-task-result]');
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      output.textContent = '正在枚举职责行动、共享资源与激活收尾…';
      await new Promise(resolve => window.setTimeout(resolve, 0));
      try {
        const current = roleTaskReference(person, preferences);
        const prepared = current.prepare();
        const result = COACH_MODEL.evaluateRoleReliabilityTasks({ ...prepared, subjectId: person.id,
          planOptions: { threshold: 1e-12, maxLeaves: 20000, maxExpandedStates: 2000, followUp: false } });
        result.reference = prepared.reference;
        roleTaskResultCache.set(person.id, { key: current.key, result });
        if (output.isConnected) output.innerHTML = roleTaskResultHTML(result);
      } catch (error) {
        if (output.isConnected) output.textContent = '当前职责未能计算，不记为零分：' + error.message;
      } finally { if (submit.isConnected) submit.disabled = false; }
      return;
    }
    if (event.target.matches('[data-carrier-threat-form]')) {
      event.preventDefault();
      const form = event.target;
      const team = state.teamData.find(item => item.id === form.dataset.carrierThreatForm);
      if (!team) return;
      const preferences = rememberCarrierPreferences(form);
      const output = form.closest('.carrier-threat-experiment').querySelector('[data-carrier-threat-result]');
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      output.textContent = '正在枚举持球保护的完整终局…';
      await new Promise(resolve => window.setTimeout(resolve, 0));
      try {
        const current = carrierThreatReference(team, preferences);
        const result = COACH_MODEL.evaluateCarrierThreatTasks({ ...current.prepared, subjectId: team.id + ':' + preferences.carrierPlayerId,
          planOptions: { threshold: 1e-12, maxLeaves: 60000 } });
        result.teamId = team.id;
        result.reference = current.prepared.reference;
        carrierThreatResultCache.set(team.id, { key: current.key, result });
        if (output.isConnected) output.innerHTML = carrierThreatResultHTML(result);
      } catch (error) {
        if (output.isConnected) output.textContent = '未能完成持球保护计算：' + error.message;
      } finally {
        if (submit.isConnected) submit.disabled = false;
      }
      return;
    }
    if (event.target.matches("[data-team-task-form]")) {
      event.preventDefault();
      const form = event.target;
      const team = state.teamData.find(item => item.id === form.dataset.teamTaskForm);
      if (!team) return;
      const preferences = rememberTeamTaskPreferences(form);
      const output = form.closest('.team-task-experiment').querySelector('[data-team-task-result]');
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      output.textContent = "正在枚举合法行动和终局概率…";
      await new Promise(resolve => window.setTimeout(resolve, 0));
      try {
        const cached = teamTaskReference(team, preferences);
        const prepared = window.BB_BLOODBOARD_ENGINE.prepareTeamGroundBallComparison({ reference: cached.reference, focalPlayerId: preferences.focalPlayerId, reservePlayerId: preferences.reservePlayerId || null });
        const result = COACH_MODEL.evaluateTeamTaskImportance({ ...prepared, subjectId: team.id + ':' + preferences.focalPlayerId,
          planOptions: { threshold: 1e-12, maxLeaves: 20000, maxExpandedStates: 2000 } });
        result.teamId = team.id;
        result.reference = cached.reference.scenario;
        result.modelVersion = COACH_MODEL.VERSION;
        teamTaskResultCache.set(team.id, { key: cached.key + JSON.stringify(preferences), result });
        if (output.isConnected) output.innerHTML = teamTaskResultHTML(result, cached.reference);
      } catch (error) {
        if (output.isConnected) output.textContent = "未能完成这组计算：" + error.message;
      } finally {
        if (submit.isConnected) submit.disabled = false;
      }
      return;
    }
    if (!event.target.matches("[data-player-editor]")) return;
    event.preventDefault();
    editorDraft(event.target);
    state.editor.applied = true;
    render();
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
    if (event.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = ""; state.search = ""; state.selectedId = ""; render(); searchInput.blur();
    }
  });

  const skillMapSearch = document.getElementById("skill-map-search");
  if (skillMapSearch) skillMapSearch.addEventListener("input", () => renderSkillMap(skillMapSearch.value));
  renderSkillMap();

  const coachLevel = COACH_PRESETS.findIndex(preset => preset.coachSkill === state.coachSkill);
  const coachSlider = document.getElementById("coach-skill-slider");
  const selectedCoach = COACH_PRESETS[coachLevel] || COACH_PRESETS[1];
  coachSlider.value = String(Math.max(0, coachLevel));
  document.getElementById("coach-level-label").textContent = selectedCoach.labelZh + " · " + selectedCoach.label;
  document.getElementById("coach-level-description").textContent = selectedCoach.description + " 当前底层 Coach Skill = " + selectedCoach.coachSkill + "/100。";

  render();
})();
