(() => {
  const data = window.BB_SIX_AXIS_CANDIDATE_V413 || window.BB_SIX_AXIS_CANDIDATE_V412 || window.BB_SIX_AXIS_CANDIDATE_V411;
  const starRuleById = new Map((window.BB_STAR_RULE_EVIDENCE_V393?.rules || []).map(row => [row.starId, row]));
  const scoringReceptionById = new Map((window.BB_SCORING_RECEPTION_ROLE_EVIDENCE_V702?.dossiers || []).map(row => [row.subjectId + "|" + row.format, row]));
  const teamKillContext = window.BB_KILL_TEAM_CONTEXT_V394;
  const guardSupportById = new Map((window.BB_GUARD_SUPPORT_EVIDENCE_V400?.records || []).map(row => [row.subjectId + "|" + row.format, row]));
  const root = document.getElementById("six-axis-candidate-v361");
  if (!data || !root) return;

  // A few source rosters provide the same base position more than once, sometimes
  // with a roster-only trait. Keep one canonical player card per name and format.
  // Format-specific task scores remain separate because the task cohorts differ.
  function canonicalPlayerDossiers(dossiers) {
    const selected = new Map();
    const canonicalKey = item => [item.subjectType, item.format,
      String(item.name || "").normalize("NFKC").trim().toLocaleLowerCase()].join("|");
    const preference = item => {
      const profile = item.profile || {};
      const rosterCount = Array.isArray(profile.sourceRosters) ? profile.sourceRosters.length : 0;
      const skillCount = Array.isArray(profile.skills) ? profile.skills.length : 0;
      return [-skillCount, rosterCount, String(item.subjectId || "")];
    };
    const isPreferred = (candidate, current) => {
      const a = preference(candidate), b = preference(current);
      return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2].localeCompare(b[2]) < 0)));
    };
    for (const item of dossiers) {
      if (item.subjectType !== "player") {
        selected.set(canonicalKey(item) + "|" + item.subjectId, item);
        continue;
      }
      const key = canonicalKey(item);
      const current = selected.get(key);
      if (!current || isPreferred(item, current)) selected.set(key, item);
    }
    return Array.from(selected.values());
  }
  const displayDossiers = canonicalPlayerDossiers(data.dossiers || []);
  const uniquePlayerTemplates = new Set((data.dossiers || [])
    .filter(item => item.subjectType === "player")
    .map(item => String(item.name || "").normalize("NFKC").trim().toLocaleLowerCase())).size;

  const axes = [
    ["fastAttack", "快攻"], ["ballControl", "控球"], ["lethality", "杀伤"],
    ["survival", "生存"], ["control", "控场"], ["adaptability", "适应力"]
  ];
  const scoreFor = (item, axisId) => axisId === "overallScore" ? item.overallScore : item.axisScores && item.axisScores[axisId];
  const controls = {
    kind: root.querySelector("#v361-kind"), format: root.querySelector("#v361-format"),
    axis: root.querySelector("#v361-axis"), limit: root.querySelector("#v361-limit"),
    search: root.querySelector("#v361-search"), reverse: root.querySelector("#v361-reverse"),
    summary: root.querySelector("#v361-summary"), list: root.querySelector("#v361-list")
  };
  const storageKey = "bb-six-axis-candidate-filters-v390";
  let reverse = false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (["all", "player", "star"].includes(saved.kind)) controls.kind.value = saved.kind;
    if (["all", "11s", "sevens"].includes(saved.format)) controls.format.value = saved.format;
    if (saved.axis === "overallScore" || axes.some(([id]) => id === saved.axis)) controls.axis.value = saved.axis;
    if (["25", "50", "100", "all"].includes(saved.limit)) controls.limit.value = saved.limit;
    if (typeof saved.search === "string") controls.search.value = saved.search;
    reverse = saved.reverse === true;
  } catch (_) {}
  controls.reverse.setAttribute("aria-pressed", String(reverse));

  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const formatName = value => value === "11s" ? "十一人制" : value === "sevens" ? "七人制" : value;
  const money = value => Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") + " 金币" : "价格未载入";
  const pct = value => Number.isFinite(value) ? Math.round(value * 100) + "%" : "—";
  const nice = value => Number.isFinite(value) ? value.toFixed(1) : "—";
  const playerProfileAliases = {
    "High Elf Thrower": { positionId: "phoenixWarrior", profileName: "Phoenix Warrior" },
    "High Elf Catcher": { positionId: "whiteLion", profileName: "White Lion" },
    "High Elf Blitzer": { positionId: "dragonPrince", profileName: "Dragon Prince" }
  };
  function portraitPath(item) {
    const profile = item.profile || {};
    if (profile.portrait) return profile.portrait;
    const atlas = window.ATLAS_DATA || {};
    if (item.subjectType === "star") {
      const star = (atlas.stars || []).find(person => person.id === (item.starId || profile.id || item.subjectId));
      return star?.portrait || "";
    }
    const portraits = window.BB_BASE_PORTRAITS || {};
    const rosters = new Map((atlas.rosters || []).map(roster => [roster.id, roster]));
    for (const rosterId of profile.sourceRosters || []) {
      const roster = rosters.get(rosterId);
      const position = (roster?.positions || []).find(row => row.name === item.name) ||
        (playerProfileAliases[item.name] ? (roster?.positions || []).find(row => row.id === playerProfileAliases[item.name].positionId) : null);
      if (!position) continue;
      const path = portraits[rosterId + ":" + position.id] || position.portrait;
      if (path) return path;
    }
    return "";
  }
  function openProfileAttributes(item) {
    const profileName = playerProfileAliases[item.name]?.profileName || item.name;
    return ' data-open-atlas-profile="' + (item.subjectType === "star" ? "star" : "player") + '" data-profile-name="' + esc(profileName) + '" data-profile-format="' + esc(item.format) + '"';
  }
  const probability = value => Number.isFinite(value) ? (value * 100).toFixed(2) + "%" : "—";
  const probabilityRange = value => {
    const lower = value?.lowerBound ?? value?.lower, upper = value?.upperBound ?? value?.upper;
    return Number.isFinite(lower) && Number.isFinite(upper)
      ? (value.exact || lower === upper ? probability(lower) : probability(lower) + "–" + probability(upper))
      : "—";
  };
  const taskNames = { maximum: "合法最大移动距离", open1: "开阔移动 1 格", open4: "开阔移动 4 格", open6: "开阔移动 6 格", open8: "开阔移动 8 格", escape: "脱离盯防", guardSupport: "Guard 支援安全击倒增量", touchdown4: "持球 4 格实际达阵", touchdown6: "持球 6 格实际达阵", touchdown8: "持球 8 格实际达阵", "touchdown-marked8": "受标记持球 8 格达阵", pickup: "拾取地面球", "carrier-normal": "普通阻挡后持球", "carrier-stripBall": "Strip Ball 威胁下持球", handoff: "队友交接", disruption: "夺取对方球权", block: "普通阻挡", blitz1: "1 格接近后突袭", foul: "条件犯规", ballAndChain: "Ball & Chain 特殊攻击", chainsaw: "Chainsaw 链锯攻击", bombardier: "Bombardier 投弹", "bombardier-collateral": "Bombardier 爆炸范围附带伤害", stab: "Stab 刺击", projectileVomit: "Projectile Vomit 喷吐", breatheFire: "Breathe Fire 喷火", incoming3: "承受 ST3 阻挡", incoming4: "承受 ST4 阻挡", incoming5: "承受 ST5 阻挡", screenProtector: "固定任务保护队友", scoringReception: "接球并完成短传得分链", "laneOpener.hypnoticGaze": "Hypnotic Gaze：固定屏障受扰", "punt-ownPossession": "Punt：己方保有球权", "punt-receiverSecures": "Punt：指定接球队员控球", "punt-opponentPossession": "Punt：对手取得球权", "punt-liveLooseBall": "Punt：形成地滚球", "punt-puntTouchdown": "Punt：己方达阵", "punt-opponentTouchdown": "Punt：对手达阵", "punt-turnover": "Punt：己方 Turnover", monstrousMouth: "Monstrous Mouth 咬合压制" };
  const persisted = () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ kind: controls.kind.value, format: controls.format.value, axis: controls.axis.value, limit: controls.limit.value, search: controls.search.value, reverse })); } catch (_) {}
  };

  function radar(item) {
    const cx = 110, cy = 106, radius = 61;
    const point = (index, score, scale) => {
      const angle = (-90 + index * 60) * Math.PI / 180;
      const r = radius * (Number.isFinite(score) ? Math.max(0, Math.min(100, score)) / 100 : 0) * scale;
      return (cx + Math.cos(angle) * r).toFixed(2) + "," + (cy + Math.sin(angle) * r).toFixed(2);
    };
    const ring = scale => axes.map((_, i) => point(i, 100, scale)).join(" ");
    const values = axes.map(([id]) => item.axisScores && item.axisScores[id]);
    const shape = values.map((value, i) => point(i, value, 1)).join(" ");
    const complete = values.every(Number.isFinite);
    const partialSegments = complete ? "" : values.map((value, i) => {
      const next = (i + 1) % values.length;
      return Number.isFinite(value) && Number.isFinite(values[next])
        ? '<polyline class="shape partial" points="' + point(i, value, 1) + ' ' + point(next, values[next], 1) + '"/>' : "";
    }).join("");
    const labels = axes.map(([, label], i) => {
      const angle = (-90 + i * 60) * Math.PI / 180;
      const x = cx + Math.cos(angle) * 82, y = cy + Math.sin(angle) * 82;
      return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">' + esc(label) + '</text>';
    }).join("");
    const dots = values.map((value, i) => Number.isFinite(value) ? '<circle class="dot" cx="' + point(i, value, 1).replace(",", '" cy="') + '" r="2.7"/>' : "").join("");
    const shapeMarkup = complete ? '<polygon class="shape" points="' + shape + '"/>' : partialSegments;
    return '<svg class="v361-radar" viewBox="0 0 220 212" role="img" aria-label="' + esc(item.name) + ' 六维候选雷达图；缺失维度不连至零分"><polygon class="grid" points="' + ring(.25) + '"/><polygon class="grid" points="' + ring(.5) + '"/><polygon class="grid" points="' + ring(.75) + '"/><polygon class="grid" points="' + ring(1) + '"/>' + axes.map((_, i) => '<line class="spoke" x1="110" y1="106" x2="' + point(i, 100, 1).replace(",", '" y2="') + '"/>').join("") + shapeMarkup + dots + labels + '</svg>';
  }

  function card(item, rank) {
    const profile = item.profile || {};
    const portrait = portraitPath(item);
    const portraitSrc = portrait ? portrait + (portrait.startsWith("assets/base-players/") ? "?v=base-portraits-official-refresh-20260930" : "?v=portrait-assets-20261005") : "";
    const type = item.subjectType === "star" ? "明星球员" : "基础球员";
    const roles = item.subjectType === "star" ? "可用赛区 " + Object.keys(profile.eligibleByLeague || {}).length : "来源球队 " + (profile.sourceRosters || []).length;
    const stats = ["MA " + (profile.ma ?? "—"), "ST " + (profile.st ?? "—"), "AG " + (profile.ag ?? "—"), "PA " + (profile.pa ?? "—"), "AV " + (profile.av ?? "—")].join(" · ");
    const metrics = axes.map(([id, label]) => {
      const score = item.axisScores && item.axisScores[id];
      const coverage = item.coverage && item.coverage[id];
      const dimension = (item.dimensions || []).find(row => row.id === id);
      const displayScore = Number.isFinite(score) ? nice(score) : dimension?.scoreStatus === "insufficient-independent-families" ? "证据不足" : "—";
      return '<div class="v361-metric"><span>' + label + '</span><b>' + displayScore + '<small>覆盖 ' + pct(coverage) + '</small></b></div>';
    }).join("");
    const evidence = (item.dimensions || []).map(dimension => {
      const families = (dimension.families || []).map(family => {
        const summary = '<div class="v361-evidence-row"><span>' + esc(family.label) + (family.notApplicable ? ' · 不适用' : '') + '</span><b class="' + (Number.isFinite(family.score) ? '' : 'missing') + '">' + nice(family.score) + ' · ' + (family.observations || 0) + '/' + (family.expectedObservations || 0) + '</b></div>';
        const observations = family.rawEvidence || family.rankedEvidence || [];
        const detail = observations.map(row => {
          const isControlFootprint = row.submetricId === "control.dynamic";
          const deltaText = value => Number.isFinite(value) ? (value >= 0 ? "+" : "−") + Math.abs(value * 100).toFixed(2) + " 个百分点" : "—";
          const metricValue = value => Number.isFinite(value) ? (isControlFootprint ? value.toFixed(3) + " 格" : row.isProbabilityDelta ? deltaText(value) : probability(value)) : "—";
          const p = Number.isFinite(row.lowerBound) && Number.isFinite(row.upperBound) && row.lowerBound !== row.upperBound ? metricValue(row.lowerBound) + "–" + metricValue(row.upperBound) : Number.isFinite(row.probability) ? metricValue(row.probability) : Number.isFinite(row.rawValue) ? metricValue(row.rawValue) : Number.isFinite(row.rawRisk) ? metricValue(row.rawRisk) : "—";
          const points = row.displayOnly ? "仅展示，不计分" : row.rankedSeparately === false ? "仅进入情境合成" : Number.isFinite(row.rankPoints) ? nice(row.rankPoints) : Number.isFinite(row.score) ? nice(row.score) : "—";
          const cohort = Number.isFinite(row.cohortSize) ? ' · 同条件样本 ' + row.cohortSize : '';
          const opponent = row.opponentStrength ? ' · 对手力量 ' + row.opponentStrength : '';
          const sourceNote = row.source === "damage-outcome-rank fallback" ? "V7.0.1 安全击倒联合事件排名" : "";
          const eventNote = row.event === "target incapacitated AND no attacking-team turnover" ? "目标失能且攻击方未发生 Turnover" : row.event || "";
          const resultLabel = row.isProbabilityDelta ? "Guard 安全击倒边际增量 " : isControlFootprint ? "净控区变化 " : row.source === "damage-outcome-rank fallback" ? "安全失能率 " : row.event === "target down or removed AND no attacking-team turnover" ? "安全击倒/失能率 " : "成功率 ";
          const removal = Number.isFinite(row.removalProbability)
            ? ' · 安全移出率 ' + probability(row.removalProbability) + ' · 赋分 ' + (Number.isFinite(row.removalRankPoints) ? nice(row.removalRankPoints) : "—")
            : "";
          const metricRange = value => isControlFootprint && Number.isFinite(value?.lowerBound) && Number.isFinite(value?.upperBound)
            ? (value.lowerBound === value.upperBound ? metricValue(value.lowerBound) : metricValue(value.lowerBound) + "–" + metricValue(value.upperBound))
            : row.isProbabilityDelta && Number.isFinite(value?.lowerBound) && Number.isFinite(value?.upperBound)
              ? (Math.abs(value.lowerBound - value.upperBound) < 1e-12 ? deltaText(value.lowerBound) : deltaText(value.lowerBound) + "–" + deltaText(value.upperBound))
              : probabilityRange(value);
          const rerolls = row.rerollVariants ? '<small class="v361-evidence-note">重掷敏感度：无团队重掷 ' + metricRange(row.rerollVariants.withoutTeamRerolls) + ' · 一枚共享团队重掷 ' + metricRange(row.rerollVariants.withTeamRerolls) + '；' + esc(row.rerollVariants.resourceOwner || "任务执行方") + '</small>' : '';
          return '<div class="v361-raw-row"><span>' + esc(taskNames[row.taskId] || row.taskId || row.id || "任务") + opponent + ((sourceNote || eventNote) ? '<small>' + esc([sourceNote, eventNote].filter(Boolean).join(" · ")) + '</small>' : '') + '</span><b>' + resultLabel + p + ' · 赋分 ' + points + removal + cohort + '</b>' + rerolls + '</div>';
        }).join("");
        const source = [family.source ? '来源：' + family.source : '', family.formula || '', Number.isFinite(family.score) && family.formula ? '合成排名点：' + nice(family.score) : '']
          .filter(Boolean).map(text => '<small class="v361-evidence-note">' + esc(text) + '</small>').join("");
        return summary + source + detail;
      }).join("");
      const notes = (dimension.notes || []).map(note => '<small class="v361-evidence-note">' + esc(note) + '</small>').join("");
      const gate = dimension.scoreStatus === "insufficient-independent-families"
        ? '<div class="v361-evidence-row"><span>综合显示</span><b>仅有 ' + (dimension.independentEvidenceGroups || 0) + ' 类独立证据，暂不赋维度分或参与排行；单类参考 ' + nice(dimension.partialScore) + '</b></div>'
        : '<div class="v361-evidence-row"><span>维度候选分</span><b>' + nice(dimension.score) + (dimension.scoreStatus === "multi-family-partial" ? ' · 多类证据但覆盖不全' : '') + '</b></div>';
      const floor = dimension.ruleFloorApplied
        ? '<div class="v361-evidence-row"><span>规则下限</span><b>此球员不能持球；按定义固定为最低值 0，不是引擎模拟的 0% 概率</b></div>' : '';
      return '<div class="v361-evidence-row"><span><b>' + esc(dimension.label) + '</b> 维候选任务族</span></div>' + notes + gate + floor + families;
    }).join("");
    const kick = item.specializedScoringEvidence?.kickTeamMate;
    const outcome = value => Number.isFinite(value?.lowerBound) && Number.isFinite(value?.upperBound) && value.lowerBound !== value.upperBound
      ? probability(value.lowerBound) + "–" + probability(value.upperBound) : Number.isFinite(value?.lowerBound) ? probability(value.lowerBound) : "—";
    const specializedEvidence = kick ? '<div class="v361-special-evidence"><b>特定规则任务 · 投掷队友后实际达阵</b><p>' + esc(kick.successEvent) + '</p><div class="v361-evidence-row"><span>无团队重掷</span><b>' + outcome(kick.probabilityWithoutTeamReroll) + '</b></div><div class="v361-evidence-row"><span>一枚团队重掷</span><b>' + outcome(kick.probabilityWithTeamReroll) + '</b></div><div class="v361-evidence-row"><span>排名赋分 / 六维计入</span><b>' + (kick.rankPoints?.length ? '有可比样本' : '样本不足 · 暂未赋分 · 未计入') + '</b></div><small>这是该档案的单项规则任务证据，不代表其他明星特殊规则已完整计入。</small></div>' : "";
    const reception = scoringReceptionById.get(item.subjectId + "|" + item.format);
    const receptionRange = value => value && Number.isFinite(value.lowerBound) && Number.isFinite(value.upperBound)
      ? (value.lowerBound === value.upperBound ? probability(value.lowerBound) : probability(value.lowerBound) + "–" + probability(value.upperBound) + "（区间）") : "—";
    const receptionPoints = reception?.ranking ? (reception.ranking.rankPointsLower === reception.ranking.rankPointsUpper
      ? nice(reception.ranking.rankPointsLower) : nice(reception.ranking.rankPointsLower) + "–" + nice(reception.ranking.rankPointsUpper)) : "未赋分";
    const roleLabels = { carrierProgression: "持球推进", scoringReception: "得分接应", stableBlitzer: "稳定突袭", screenProtector: "封路保护" };
    const roleStatusLabels = { "v7-exact-ranked": "V7 精确同条件赋分", "v7-current-engine-ranked": "V7 持球达阵曲线赋分", "legacy-special-action-fallback": "普通 Blitz 不适用 · 保留特殊行动代理", "legacy-fallback-rank-withheld": "V7 样本不足 · 保留旧代理", "not-applicable-no-ball": "规则不适用", ranked: "旧版角色任务代理", "legacy-fallback": "旧版代理" };
    const roleRows = item.adaptabilityDetail?.roleScores || [];
    const roleEvidence = roleRows.length ? '<div class="v361-special-evidence"><b>适应力角色构成 · 质量与覆盖各占 50%</b>' +
      roleRows.map(role => {
        const taskEvidence = (role.taskEvidence || []).map(task => (taskNames[task.taskId] || task.taskId) + ' ' + probability(task.probability) + ' → ' + nice(task.rankPoints)).join('；');
        return '<div class="v361-evidence-row"><span>' + esc(roleLabels[role.id] || role.label || role.id) + '<small>' + esc(roleStatusLabels[role.status || item.adaptabilityDetail?.roleStatus?.[role.id]] || role.source || "角色任务证据待明示") + (taskEvidence ? '<br>达阵任务：' + esc(taskEvidence) : '') + '</small></span><b>' + (Number.isFinite(role.score) ? nice(role.score) + ' 分' : '—') +
        (Number.isFinite(role.taskProbability) ? ' · 概率 ' + probability(role.taskProbability) : '') +
        (Number.isFinite(role.rank) && Number.isFinite(role.cohortSize) ? ' · 名次 ' + nice(role.rank) + '/' + role.cohortSize : '') + '</b></div>';
      }).join("") +
      '<small>每项职责先按同条件任务名次赋分；职责质量取适用角色均值，覆盖率统计达到 50 分的适用角色比例。V7 样本未能排名或规则不适用时不会改填零分，保留有标签的旧代理。</small></div>' : "";
    const receptionEvidence = reception ? '<div class="v361-special-evidence"><b>适应力角色任务 · 接球并完成达阵</b>' +
      (reception.status === "not-applicable" ? '<p>此任务不适用：' + esc(reception.reason || "规则不允许执行此接应任务") + '。不把不适用任务当作全维度零分。</p>' :
        '<p>固定 PA3 投手、开阔快速传球线、接球后固定冲刺至达阵；统计两段连续行动的实际达阵。</p>' +
          '<div class="v361-evidence-row"><span>无球队重掷 · 达阵概率</span><b>' + receptionRange(reception.withoutTeamRerolls) + '</b></div>' +
          '<div class="v361-evidence-row"><span>一枚共享球队重掷 · 达阵概率</span><b>' + receptionRange(reception.withTeamRerolls) + '</b></div>' +
          '<div class="v361-evidence-row"><span>同赛制接应任务名次赋分</span><b>' + receptionPoints + ' · 名次区间 ' + reception.ranking.bestRank + '–' + reception.ranking.worstRank + ' / ' + reception.ranking.cohortSize + '</b></div>') +
      '<div class="v361-evidence-row"><span>六维计分状态</span><b>' + (reception.status === "not-applicable" ? "不适用 · 已从适应力职责分母排除" : reception.ranking?.rankPointsLower === reception.ranking?.rankPointsUpper ? "已计入适应力接应角色质量与职责覆盖" : "保留区间 · 不强行并入点分") + '</b></div>' +
      '<small>精确排名只比较相同固定任务、相同赛制；此任务不含盯防、拦截、对手行动、球队名单和机会频率。各适应力角色来源见上方构成表。</small>' +
      '<span>查看 326 份档案的完整任务条件与规则来源（后台资料）</span></div>' : "";
    const guardSupport = guardSupportById.get(item.subjectId + "|" + item.format);
    const signedPp = value => {
      if (!value || !Number.isFinite(value.lowerBound) || !Number.isFinite(value.upperBound)) return "—";
      const format = number => (number >= 0 ? "+" : "") + (number * 100).toFixed(2) + " 个百分点";
      return value.lowerBound === value.upperBound ? format(value.lowerBound) : format(value.lowerBound) + " 至 " + format(value.upperBound);
    };
    const guardSupportEvidence = guardSupport ? '<div class="v361-special-evidence"><b>控场历史配对证据 · Guard 在盯防下支援队友</b>' +
      '<p>' + esc(guardSupport.comparison) + ' 成功事件：' + esc(guardSupport.successDefinition) + '</p>' +
      ['withoutTeamRerolls', 'withTeamRerolls'].map(policy => {
        const row = guardSupport.policies[policy];
        const policyName = policy === 'withoutTeamRerolls' ? '无球队重掷' : '允许一枚球队重掷';
        return '<div class="v361-evidence-row"><span>' + policyName + ' · 无 Guard 安全击倒</span><b>' + outcome(row.withoutGuard) + '</b></div>' +
          '<div class="v361-evidence-row"><span>' + policyName + ' · 有 Guard 安全击倒</span><b>' + outcome(row.withGuard) + '</b></div>' +
          '<div class="v361-evidence-row"><span>' + policyName + ' · Guard 配对增量</span><b>' + signedPp(row.guardSupportDelta) + '</b></div>' +
          '<div class="v361-evidence-row"><span>' + policyName + ' · Turnover</span><b>' + outcome(row.turnover) + '</b></div>';
      }).join('') +
      '<div class="v361-evidence-row"><span>六维计分状态</span><b>V7.0.1 Guard 边际任务已纳入动态控场赋分；未估算到位与全场机会频率</b></div>' +
      '<small>固定 ST3 阻挡者、ST3/AV9 目标、Guard 支援者受盯防；一次 Block 结束时统计。上方这组配对数据是 V6.1 历史对照；当前六维赋分采用 V7.0.1 独立任务档案中的安全击倒率边际增量，并按同赛制排名。不估算 Guard 支援者到位机会，因此不代表整场支援收益。</small>' +
      '<span>查看精简原始对照数据（后台资料）</span></div>' : '';
    const starRule = item.starId ? starRuleById.get(item.starId) : null;
    const starRuleEvidence = starRule ? '<div class="v361-special-evidence"><b>明星独有规则 · ' + esc(starRule.ruleName) + '</b>' +
      '<p>Bloodboard ' + esc(starRule.sourceEngine) + ' · ' + (starRule.engineStatus.includes("interval") ? '区间任务证据' : '精确任务证据') +
      (starRule.format ? ' · ' + formatName(starRule.format) : '') + '</p>' +
      (starRule.context ? '<p>' + esc(starRule.context) + '</p>' : '') +
      '<div class="v361-evidence-row"><span>成功事件</span><b>' + esc(starRule.successEvent) + '</b></div>' +
      starRule.probabilityRows.map(row => '<div class="v361-evidence-row"><span>' + esc(row.scenario) + '<small>' + esc(row.event) + (row.turnover ? ' · Turnover ' + probabilityRange(row.turnover) : '') + (Number.isFinite(row.controlSquareDelta) ? ' · 对手控区变化 ' + (row.controlSquareDelta > 0 ? '+' : '') + row.controlSquareDelta.toFixed(2) + ' 格' : '') + '</small></span><b>' + probabilityRange(row.success) + '</b></div>').join("") +
      '<div class="v361-evidence-row"><span>计分状态</span><b>尚未计入六维赋分；规则触发机会率未估计</b></div>' +
      '<small>这是该明星的固定规则情境证据，不是跨明星排名，也不代表整场比赛的触发频率。当前清单只覆盖 V6.1 声明的激活开始规则。</small>' +
      '<a href="' + esc(starRule.source) + '">打开此规则的完整任务档案</a></div>' : "";
    const contextRows = (teamKillContext?.byParticipant?.[item.name] || [])
      .map(id => teamKillContext.scenarios.find(row => row.id === id)).filter(Boolean);
    const contextRange = value => {
      if (!value || !Number.isFinite(value.lower) || !Number.isFinite(value.upper)) return "—";
      if (value.exact || value.lower === value.upper) return probability(value.lower);
      return (value.lower * 100).toFixed(3) + "–" + (value.upper * 100).toFixed(3) + "%（区间）";
    };
    const contextLine = (label, outcome) => '<div class="v361-evidence-row"><span>' + esc(label) + '</span><b>' + contextRange(outcome) + '</b></div>';
    const killTeamContextEvidence = contextRows.length ? '<div class="v361-special-evidence"><b>球队杀伤链 · 固定 Goblin 阵容情境（不计个人六维）</b>' +
      contextRows.map(row => {
        const policies = ["withoutTeamRerolls", "withTeamRerolls"].map(policy => {
          const outcomes = row.policies[policy].outcomes;
          const policyName = policy === "withoutTeamRerolls" ? "无球队重掷" : "允许一枚球队重掷";
          const lines = [contextLine(policyName + " · 整条链安全移出", outcomes.safeRemovalByChain),
            contextLine(policyName + " · 链中出现犯规机会", outcomes.foulOpportunity),
            contextLine(policyName + " · 犯规安全移出", outcomes.foulSafeRemoval),
            contextLine(policyName + " · 球队 Turnover", outcomes.teamTurnover)];
          if (row.id === "black-gobbo-extra-foul") lines.push(contextLine(policyName + " · Black Gobbo 额外犯规安全移出", outcomes.extraFoulSafeRemoval));
          return lines.join("");
        }).join("");
        const delta = row.id === "black-gobbo-extra-foul" ? teamKillContext.pairedDeltas?.blackGobboExtraFoulVsSameOoliganBaseline : null;
        const deltaRows = delta ? ["withoutTeamRerolls", "withTeamRerolls"].map(policy => contextLine(
          (policy === "withoutTeamRerolls" ? "无球队重掷" : "允许一枚球队重掷") + " · 相对同一 Ooligan 基线的整链安全移出增量",
          delta[policy])).join("") : "";
        return '<p><b>' + esc(row.title) + '</b></p><p>计划：' + esc(row.sequence.join(" → ")) + '。十一人制，对手固定为站立 ST3 / AV9；含 Bribery and Corruption 与 1 枚 Bribe。以下概率以整条声明链为分母。</p>' + policies + deltaRows;
      }).join("") + '<small>这是指定阵容、固定对手与行动顺序下的球队情境概率，不是整场机会率、个人能力分或跨队排名。价格、替补频率和多回合资源消耗尚未折算。</small><span>查看 Bloodboard V6.1 原始链式枚举结果（后台资料）</span></div>' : "";
    const skills = profile.skillText || (profile.skills || []).map(skill => skill.id).join("、") || "无已列初始技能";
    const basis = Object.values(item.scoreBasis || {}).some(value => value.includes("proxy") || value === "partial-evidence" || value === "single-family-evidence" || value === "engine-evidence-partial") ? "含估算/部分证据" : "引擎证据";
    const overall = '<div class="v361-overall"><b>总评 ' + esc(item.overallGrade || "—") + '</b><span>' + nice(item.overallScore) + ' · 第 ' + esc(item.overallRank || "—") + ' 名 · ' + basis + '</span></div>';
    const portraitMarkup = portraitSrc
      ? '<img class="v361-profile-portrait" src="' + esc(portraitSrc) + '" alt="' + esc(item.name) + ' 模型图" loading="lazy" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add(\'portrait-missing\')">'
      : '<span class="v361-portrait-fallback">暂无模型图</span>';
    return '<article class="v361-card"><div class="v361-visuals"><button class="v361-portrait-link" type="button"' + openProfileAttributes(item) + ' aria-label="打开 ' + esc(item.name) + ' 的球员主页">' + portraitMarkup + '</button>' + radar(item) + '</div><div><div class="v361-card-head"><div><span class="v361-card-type">' + (Number.isFinite(rank) ? '第 ' + rank + ' 名 · ' : '') + type + ' · ' + formatName(item.format) + '</span><button class="v361-profile-link" type="button"' + openProfileAttributes(item) + '>' + esc(item.name) + '</button><div class="v361-card-sub">' + esc(roles) + (profile.cost ? ' · ' + esc(money(profile.cost)) : '') + '</div>' + overall + '</div></div><div class="v361-profile">' + esc(stats) + '<br>' + esc(skills) + '</div><div class="v361-metrics">' + metrics + '</div></div><details class="v361-evidence"><summary>查看六维构成、原始概率与赋分依据</summary><div class="v361-evidence-list">' + evidence + roleEvidence + receptionEvidence + specializedEvidence + guardSupportEvidence + starRuleEvidence + killTeamContextEvidence + '<div class="v361-evidence-row"><span>总评公式</span><b>六维加权顺序：快攻22%、控球18%、杀伤16%、生存15%、控场15%、适应力14%；再按同赛制基础球员与明星合并排名，反向赋分并映射等级。</b></div><div class="v361-evidence-row"><span>各维证据类型</span><b>' + esc(axes.map(([id,label]) => label + '：' + (item.scoreBasis?.[id] || '—')).join('；')) + '</b></div></div><div class="v361-card-sub">V7.0.1 任务排名点、沿用的 V410 代理和覆盖率分别标注；代理不是引擎概率。总评用于当前版本横向比较，逐队明星收益仍看球队情境榜。</div></details></article>';
  }

  function matches(item, search) {
    if (controls.kind.value !== "all" && item.subjectType !== controls.kind.value) return false;
    if (controls.format.value !== "all" && item.format !== controls.format.value) return false;
    if (!search) return true;
    const p = item.profile || {};
    const haystack = [item.name, p.name, p.skillText, ...(p.keywords || []), ...(p.sourceRosters || []), ...Object.keys(p.eligibleByLeague || {})].join(" ").toLocaleLowerCase();
    return haystack.includes(search);
  }

  function render() {
    persisted();
    const search = controls.search.value.trim().toLocaleLowerCase();
    const axisId = controls.axis.value;
    const filtered = displayDossiers.filter(item => matches(item, search));
    const filteredByFormat = ["11s", "sevens"].map(format => ({ format, items: filtered.filter(item => item.format === format) }));
    filteredByFormat.forEach(group => group.items.sort((a, b) => {
      const av = scoreFor(a, axisId), bv = scoreFor(b, axisId);
      if (!Number.isFinite(av) || !Number.isFinite(bv)) return Number.isFinite(bv) - Number.isFinite(av);
      return (reverse ? av - bv : bv - av) || a.name.localeCompare(b.name);
    }));
    const limit = controls.limit.value === "all" ? filtered.length : Number(controls.limit.value);
    const visibleGroups = controls.format.value === "all" ? filteredByFormat : filteredByFormat.filter(group => group.format === controls.format.value);
    const shown = visibleGroups.flatMap(group => group.items.slice(0, limit));
    const axisName = axisId === "overallScore" ? "总评" : axes.find(([id]) => id === axisId)[1];
    const exact = data.summary || {};
    const groupSummary = visibleGroups.map(group => formatName(group.format) + ' ' + group.items.length + ' 份 / ' + (controls.limit.value === "all" ? group.items.length : Math.min(group.items.length, limit)) + ' 份显示').join(" · ");
    const rankableCount = filtered.filter(item => Number.isFinite(scoreFor(item, axisId))).length;
    controls.summary.innerHTML = '<b>' + filtered.length.toLocaleString() + ' 份符合条件</b><span>“' + axisName + '”有 ' + rankableCount + ' 份可排序，按' + (reverse ? '升序' : '降序') + '分赛制排列</span><small>' + groupSummary + ' · 每赛制同名基础球员只显示一个规范档案；V7任务分位与个人总评分均按规范档案重算。非规范技能变体仍保留给球队构筑汇总。估算值均可在卡片详情追溯；全量资料：' + uniquePlayerTemplates + ' 种基础球员模板（来自 ' + (exact.playerDossiers || 0) + ' 份源档案）、' + (exact.starDossiers || 0) + ' 名明星 · 生成 ' + esc(data.generatedAt || "") + '</small>';
    controls.reverse.setAttribute("aria-pressed", String(reverse));
    controls.reverse.textContent = reverse ? "恢复降序" : "反向排序";
    controls.list.innerHTML = shown.length ? visibleGroups.map(group => {
      const rows = group.items.slice(0, limit);
      let previous = null, rank = 0;
      const cards = rows.map((item, index) => {
        const score = scoreFor(item, axisId);
        if (!Number.isFinite(score)) return card(item, null);
        if (index === 0 || score !== previous) rank = index + 1;
        previous = score;
        return card(item, rank);
      }).join("");
      return rows.length ? '<div class="v361-format-group"><h3>' + formatName(group.format) + ' · ' + esc(axisName) + (reverse ? '升序' : '降序') + '</h3><div class="v361-cards">' + cards + '</div></div>' : "";
    }).join("") : '<div class="v361-empty">没有找到符合筛选条件的候选档案。</div>';
  }

  window.BB_OPEN_SIX_AXIS_PROFILE = ({ name, kind }) => {
    if (typeof name !== "string" || !name.trim() || !["player", "star"].includes(kind)) return false;
    controls.kind.value = kind;
    controls.format.value = "all";
    controls.search.value = name.trim();
    render();
    const url = new URL(window.location.href);
    url.hash = root.id;
    window.history.replaceState(null, "", url);
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  };

  controls.list.addEventListener("click", event => {
    const button = event.target.closest("[data-open-atlas-profile]");
    if (!button) return;
    window.BB_OPEN_ATLAS_PROFILE?.({
      name: button.dataset.profileName,
      kind: button.dataset.openAtlasProfile,
      format: button.dataset.profileFormat
    });
  });

  [controls.kind, controls.format, controls.axis, controls.limit].forEach(control => control.addEventListener("change", render));
  controls.search.addEventListener("input", render);
  controls.reverse.addEventListener("click", () => { reverse = !reverse; render(); });
  render();
})();
