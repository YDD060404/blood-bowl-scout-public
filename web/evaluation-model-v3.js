/*
 * Versioned foundation for the long-term Blood Bowl evaluation refactor.
 * This registry is an audit and probability-contract layer; it deliberately
 * keeps legacy scores separate until its tasks are calibrated.
 */
(() => {
  const VERSION = "3.64.0-safe-knockdown-contract";
  const AXES = [
    {
      id: "mobility", label: "Fast Attack", labelZh: "快攻",
      question: "我能否推进、突破并完成持球得分？",
      definition: "以完整路线、突破和得分任务衡量快攻；无球移动仍保留为原始证据，但 No Ball 将快攻汇总维度硬性限制为最低档。",
      submetrics: ["mobility.openRoute", "mobility.markedRoute", "mobility.escapeContact", "mobility.crossScreen", "mobility.screenedTouchdown", "mobility.teamScoringChain", "mobility.kickTeamMateTouchdown", "mobility.puntTouchdown", "mobility.redeploy", "mobility.touchdown"]
    },
    {
      id: "ball", label: "Ball Control", labelZh: "控球",
      question: "我能取得、保住、转移或破坏球权吗？",
      definition: "获取散球、持球稳定、球权交接与传递、失球恢复和夺球干扰。",
      submetrics: ["ball.acquisition", "ball.retention", "ball.teamRetention", "ball.transfer", "ball.recovery", "ball.disruption", "ball.puntOwnPossession", "ball.puntReceiverSecures", "ball.puntOpponentPossession", "ball.puntLiveLooseBall", "ball.puntOpponentTouchdown", "ball.puntTurnover"]
    },
    {
      id: "combat", label: "Injury", labelZh: "杀伤",
      question: "我主动对抗时能取得什么结果？",
      definition: "阻挡骰优势、击倒效率、条件犯规与击倒后破甲/移出；区分直接对抗、已有倒地目标和整队造伤行动链。",
      submetrics: ["combat.blockAdvantage", "combat.knockdown", "combat.safeKnockdown", "combat.removal", "combat.foulRemoval", "combat.teamFoulChain", "combat.specialAction", "combat.specialCollateral"]
    },
    {
      id: "survival", label: "Survival", labelZh: "生存",
      question: "受到攻击后，我还能留场并发挥作用吗？",
      definition: "完整受击、击倒、护甲、伤害、回场与位置保持链。",
      submetrics: ["survival.incomingBlock", "survival.damageChain", "survival.currentFunction", "survival.returnToDrive", "survival.positionRetention", "survival.specialBackfire"]
    },
    {
      id: "control", label: "Control", labelZh: "控场",
      question: "我在这里时，对手还有多少安全选择？",
      definition: "限制路线、守住位置、制造支援/开路机会；静态封锁与动态覆盖分开存储。",
      submetrics: ["control.static", "control.staticPersistence", "control.teamStaticCoverage", "control.dynamic", "control.supportDelta", "control.actionEconomy", "control.specialPin", "control.hypnoticGaze", "control.gazeTargetDistraction"]
    },
    {
      id: "adaptability", label: "Adaptability", labelZh: "适应力",
      question: "球员能否可靠承担不同的比赛职责，并在具体阵容中补足任务缺口？",
      definition: "个人层保留持球推进、得分接应、稳定突袭、封路保护、开路支援的逐职责任务证据；阵容层另算移除/替换后同一球队任务能力的变化。两者先分别展示，不把异质角色概率或球队贡献硬合成一个分数。",
      submetrics: ["adaptability.roleCoverage"]
    }
  ];

  // Retain the previous export shape for readers of historical records.
  const CONTEXT_METRICS = [
    {
      id: "teamImportance", label: "Team Importance", labelZh: "队内重要性",
      submetrics: ["adaptability.teamImportance"]
    }
  ];

  const CROSS_CUTTING_FACTORS = [
    {
      id: "reliability", label: "Reliability", labelZh: "任务可靠性",
      submetrics: ["reliability.activation", "reliability.coreTask", "reliability.turnoverRisk", "reliability.rerollBudget"]
    }
  ];

  const ROLE_IDS = ["carrier", "scorer", "blitzer", "anchor", "support", "safety", "thrower", "killer"];
  const COACH_LEVELS = Object.freeze([
    { id: "beginner", label: "Beginner", labelZh: "新手", coachSkill: 25, description: "懂基本规则，常见站位、资源和复杂行动链还不稳定。" },
    { id: "experienced", label: "Experienced", labelZh: "老手", coachSkill: 60, description: "能稳定执行常见阵型、技能运用、推进和防守恢复。" },
    { id: "expert", label: "Expert", labelZh: "高手", coachSkill: 90, description: "熟练处理高难站位、行动顺序、链式配合和对位决策；不是完美 AI。" }
  ]);
  const COACH_PROFILE_FIELDS = Object.freeze([
    { id: "skillFloor", label: "Skill Floor", labelZh: "操作下限" },
    { id: "skillCeiling", label: "Skill Ceiling", labelZh: "操作上限" },
    { id: "executionComplexity", label: "Execution Complexity", labelZh: "执行复杂度" },
    { id: "mistakePunishment", label: "Mistake Punishment", labelZh: "失误惩罚" }
  ]);
  const COACH_DEPENDENCY_FEATURES = Object.freeze([
    { id: "positioning", label: "站位与位置选择", weight: 25, patterns: [/(?:adjacent|\bsquares?\b|Tackle Zone|Marking|Marked|Pushed Back|Push Back|Follow-up|within\s+\d+\s+squares)/i] },
    { id: "pathPlanning", label: "路径与移动规划", weight: 25, patterns: [/(?:Move Action|move up to|movement|\bDodge\b|\bJump\b|\bLeap\b|\bRush\b|\bIntercept\b)/i] },
    { id: "sequencing", label: "行动顺序与多步链", weight: 20, patterns: [/(?:\bbefore\b|\bafter\b|\bthen\b|\bagain\b|Follow-up|until the end|starting .*? activation|ends? the activation|one per (?:Turn|activation))/i] },
    { id: "teamCoordination", label: "队友协同", weight: 15, patterns: [/(?:team-mate|teammate|assist|team re-roll)/i] },
    { id: "opponentReading", label: "对手状态与对位判断", weight: 10, patterns: [/(?:opponent|opposition|target|Marked opponent)/i] },
    { id: "resourceManagement", label: "有限资源与触发时机", weight: 10, patterns: [/(?:re-?roll|once per (?:Turn|activation|game|half|Drive)|one per (?:Turn|activation))/i] },
    { id: "decisionBranching", label: "教练决策分支", weight: 25, patterns: [/(?:coach chooses|coach's choice|may choose|choose any|choose one|Armour or Injury|either .* or)/i] }
  ]);
  const CONTEXT_SCHEMA = {
    format: { allowed: ["11s", "sevens"], required: true },
    rosterState: { allowed: ["starting", "league", "tournament", "custom"], required: true },
    teamValue: { type: "number|null" },
    budget: { type: "number|null" },
    skillPackage: { type: "skill-id[]", default: [] },
    inducements: { type: "inducement[]", default: [] },
    opponent: { type: "opponent-profile|null", fields: ["ST", "AG", "PA", "AV", "skills", "roster", "strategy"] },
    supportState: { type: "explicit board / teammate state|null" },
    rerollPool: { type: "integer|null" },
    apothecary: { type: "boolean|null" },
    driveState: { type: "drive / half / match state|null" },
    leagueDevelopment: { type: "SPP / advancement / injuries|null" },
    coachSkill: { type: "number, 0..100", default: 60, presets: COACH_LEVELS.map(level => ({ id: level.id, value: level.coachSkill })) },
    rulesVersion: { type: "string" }
  };

  const BASELINE_CONTEXT = Object.freeze({
    format: "11s",
    rosterState: "starting",
    teamValue: null,
    budget: null,
    skillPackage: Object.freeze([]),
    inducements: Object.freeze([]),
    opponent: null,
    supportState: null,
    rerollPool: null,
    apothecary: null,
    driveState: null,
    leagueDevelopment: null,
    coachSkill: 60,
    rulesVersion: "Third Season; confirm against the selected competition packet"
  });

  function coachRealizationFactor(context) {
    const values = ["coachSkill", "executionDependency", "roleComplexity", "synergyComplexity", "mistakePunishment"];
    const missing = values.filter(key => !context || typeof context[key] !== "number" || !Number.isFinite(context[key]));
    if (missing.length) return { value: null, missing, status: "awaiting-measured-coach-inputs" };
    const normalized = {};
    values.forEach(key => {
      const value = context[key];
      if (value < 0 || value > 100) throw new RangeError(key + " must be within 0..100.");
      normalized[key] = value;
    });
    const executionLoad = (normalized.executionDependency + normalized.roleComplexity + normalized.synergyComplexity + normalized.mistakePunishment) / 4;
    const skill = normalized.coachSkill / 100;
    const load = executionLoad / 100;
    return {
      value: 1 - (1 - skill) * load,
      executionLoad,
      inputs: normalized,
      formula: "1 - (1 - coachSkill/100) × mean(executionDependency, roleComplexity, synergyComplexity, mistakePunishment)/100",
      status: "defined; entity inputs still require engine-backed measurement"
    };
  }

  function realizedValue(passiveValue, expressiveValue, context) {
    if (typeof passiveValue !== "number" || !Number.isFinite(passiveValue) || typeof expressiveValue !== "number" || !Number.isFinite(expressiveValue)) {
      return { value: null, status: "awaiting-passive-and-expressive-scenario-values" };
    }
    const realization = coachRealizationFactor(context);
    if (!Number.isFinite(realization.value)) return { value: null, realization, status: realization.status };
    return {
      value: passiveValue + expressiveValue * realization.value,
      passiveValue,
      expressiveValue,
      realizationFactor: realization.value,
      status: "formula-defined; scenario values remain uncalibrated"
    };
  }

  const COACH_ANALYSIS_CACHE = new Map();
  const coachClamp = (value, low, high) => Math.max(low, Math.min(high, value));
  let COACH_SKILL_DEPENDENCIES = null;
  let COACH_SKILL_RECORDS = null;
  function coachSkillRecords() {
    if (!COACH_SKILL_RECORDS) COACH_SKILL_RECORDS = new Map(createRuleLedger().skills.map(skill => [skill.id, skill]));
    return COACH_SKILL_RECORDS;
  }
  function coachSkillDependencies() {
    if (!COACH_SKILL_DEPENDENCIES) {
      COACH_SKILL_DEPENDENCIES = new Map([...coachSkillRecords()].map(([id, skill]) => [id, skill.executionDependency]));
    }
    return COACH_SKILL_DEPENDENCIES;
  }

  function executionDependencyForText(text, source = "rule-text") {
    const summary = String(text || "");
    if (!summary) return { score: 0, band: "very-low", features: [], source, status: "no-execution-text" };
    const localizedFeatures = [
      { id: "positioning", label: "站位与位置选择", weight: 25, pattern: /站位|相邻|距离|格内|范围|位置|边线|推人|跟进|盯防|标记区/ },
      { id: "pathPlanning", label: "路径与移动规划", weight: 25, pattern: /移动|移动力|跳跃|飞跃|冲刺|闪避|路径|传球|投掷|穿越/ },
      { id: "sequencing", label: "行动顺序与多步链", weight: 20, pattern: /之后|之前|然后|接着|每回合|每半场|一次|再次|继续|结束时/ },
      { id: "teamCoordination", label: "队友协同", weight: 15, pattern: /队友|同伴|支援|配对|协助|相互/ },
      { id: "opponentReading", label: "对手状态与对位判断", weight: 10, pattern: /对手|目标|盯防|被阻挡|受击|对方|敌方/ },
      { id: "resourceManagement", label: "有限资源与触发时机", weight: 10, pattern: /一次|每场|每半场|重掷|额外|次数|资源/ },
      { id: "decisionBranching", label: "教练决策分支", weight: 25, pattern: /可以选择|可选择|选择其中|任选|改为|决定|是否|可以改/ }
    ];
    const cues = COACH_DEPENDENCY_FEATURES.flatMap(feature => {
      const matches = feature.patterns.flatMap(pattern => [...summary.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))].map(match => match[0]));
      return matches.length ? [{ id: feature.id, label: feature.label, points: feature.weight, cues: [...new Set(matches)] }] : [];
    });
    localizedFeatures.forEach(feature => {
      const matches = summary.match(feature.pattern);
      if (matches && !cues.some(item => item.id === feature.id)) cues.push({ id: feature.id, label: feature.label, points: feature.weight, cues: [matches[0]] });
    });
    const score = Math.min(100, cues.reduce((sum, item) => sum + item.points, 0));
    return {
      score,
      band: score >= 50 ? "high" : score >= 35 ? "medium" : score >= 16 ? "low" : "very-low",
      features: cues,
      source,
      status: "rule-text-cue-proxy; gameplay calibration pending"
    };
  }

  function coachPersonSignature(person) {
    return JSON.stringify([
      person && person.id, person && person.ma, person && person.st, person && person.ag,
      person && person.pa, person && person.av,
      (person && person.skills || []).map(skill => typeof skill === "string" ? [skill, null] : [skill.id, skill.value == null ? null : skill.value]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      person && person.boughtSkill || "", person && person.specialRules || "",
      person && person.specialEffectCodes || []
    ]);
  }

  function cloneWithoutSkill(person, skillId) {
    return Object.assign({}, person, {
      skills: (person.skills || []).filter(skill => (typeof skill === "string" ? skill : skill.id) !== skillId),
      boughtSkill: person.boughtSkill === skillId ? "" : person.boughtSkill
    });
  }

  function coachScore(person) {
    const scoring = window.BB_SCORING;
    return scoring && scoring.scorePlayer
      ? scoring.scorePlayer(person).scores.map(value => Number(value) || 0)
      : Array(5).fill(0);
  }

  function normalizedEntropy(values) {
    const positive = values.map(value => Math.max(0, Number(value) || 0));
    const total = positive.reduce((sum, value) => sum + value, 0);
    if (!total || positive.length < 2) return 0;
    const entropy = positive.reduce((sum, value) => {
      const share = value / total;
      return share > 0 ? sum - share * Math.log(share) : sum;
    }, 0);
    return Math.min(1, entropy / Math.log(positive.length));
  }

  function analyzeCoachPlayer(person) {
    const signature = coachPersonSignature(person);
    if (COACH_ANALYSIS_CACHE.has(signature)) return COACH_ANALYSIS_CACHE.get(signature);
    const scoring = window.BB_SCORING;
    if (!scoring || !scoring.scorePlayer) return null;
    const full = scoring.scorePlayer(person);
    const fullScores = full.scores.map(value => Number(value) || 0);
    const noSkills = Object.assign({}, person, { skills: [], boughtSkill: "" });
    const noSkillScores = coachScore(noSkills);
    const noEffects = Object.assign({}, person, { skills: [], boughtSkill: "", specialRules: "", specialEffectCodes: [] });
    const noEffectScores = coachScore(noEffects);
    const skills = [...new Set((person.skills || []).map(skill => typeof skill === "string" ? skill : skill.id).concat(person.boughtSkill || []).filter(Boolean))];
    const skillDependencies = coachSkillDependencies();
    const skillEffectsByAxis = Array(5).fill(0);
    const skillDependencyByAxis = Array(5).fill(0);
    const allSkillDependencyWeights = [];
    const skillAblations = new Map();
    skills.forEach(skillId => {
      const withoutScores = coachScore(cloneWithoutSkill(person, skillId));
      const dependency = skillDependencies.get(skillId);
      const score = dependency && Number.isFinite(dependency.score) ? dependency.score : 0;
      let impact = 0;
      const axisDeltas = Array(5).fill(0);
      for (let axis = 0; axis < 5; axis++) {
        const delta = Math.max(0, fullScores[axis] - withoutScores[axis]);
        axisDeltas[axis] = delta;
        skillEffectsByAxis[axis] += delta;
        skillDependencyByAxis[axis] += delta * score;
        impact += delta;
      }
      skillAblations.set(skillId, { axisDeltas, dependency: score });
      if (impact > 0) allSkillDependencyWeights.push({ impact, score });
    });

    const specialDependency = executionDependencyForText(
      [person.specialRules || "", scoring.starRuleModels && scoring.starRuleModels[person.id] && scoring.starRuleModels[person.id].note || ""].join(" "),
      "star-rule-text-and-model-note"
    );
    const specialPotentialTotal = noSkillScores.reduce((sum, value, axis) => sum + Math.max(0, value - noEffectScores[axis]), 0);
    const expressiveValues = [];
    const passiveValues = [];
    const skillExpressiveById = new Map(skills.map(id => [id, Array(5).fill(0)]));
    const specialExpressiveValues = Array(5).fill(0);
    for (let axis = 0; axis < 5; axis++) {
      const skillNet = Math.max(0, fullScores[axis] - noSkillScores[axis]);
      const skillShare = skillEffectsByAxis[axis] > 0
        ? Math.min(1, skillNet / skillEffectsByAxis[axis])
        : 0;
      const skillPotential = skillEffectsByAxis[axis] * skillShare;
      const skillDependency = skillEffectsByAxis[axis] > 0 ? skillDependencyByAxis[axis] / skillEffectsByAxis[axis] : 0;
      const starPotential = Math.max(0, noSkillScores[axis] - noEffectScores[axis]);
      const expressive = Math.min(fullScores[axis], skillPotential * skillDependency / 100 + starPotential * specialDependency.score / 100);
      const allocated = skillPotential * skillDependency / 100 + starPotential * specialDependency.score / 100;
      const allocationScale = allocated > 0 ? expressive / allocated : 0;
      skillAblations.forEach((ablation, skillId) => {
        skillExpressiveById.get(skillId)[axis] = ablation.axisDeltas[axis] * skillShare * ablation.dependency / 100 * allocationScale;
      });
      specialExpressiveValues[axis] = starPotential * specialDependency.score / 100 * allocationScale;
      expressiveValues.push(Math.max(0, expressive));
      passiveValues.push(fullScores[axis] - Math.max(0, expressive));
    }
    const skillRecords = coachSkillRecords();
    const skillExpressiveBreakdown = [...skillExpressiveById].map(([id, expressiveByAxis]) => {
      const skill = skillRecords.get(id);
      return {
        id,
        name: skill ? skill.name : id,
        dependencyFeatures: skill ? skill.executionDependency.features.map(feature => feature.label) : [],
        expressiveByAxis
      };
    }).filter(entry => entry.expressiveByAxis.some(value => value > 1e-9));
    if (specialExpressiveValues.some(value => value > 1e-9)) {
      skillExpressiveBreakdown.push({
        id: "__starRules",
        name: "明星特殊规则",
        dependencyFeatures: specialDependency.features.map(feature => feature.label),
        expressiveByAxis: specialExpressiveValues
      });
    }
    const roleScores = full.breakdown && full.breakdown.adaptability && full.breakdown.adaptability.roles || [];
    const roleValues = roleScores.map(role => Math.max(0, Number(role.score) || 0));
    const skillImpactTotal = allSkillDependencyWeights.reduce((sum, item) => sum + item.impact, 0);
    const skillDependencyTotal = allSkillDependencyWeights.reduce((sum, item) => sum + item.impact * item.score, 0);
    const executionDependency = skillImpactTotal + specialPotentialTotal > 0
      ? (skillDependencyTotal + specialPotentialTotal * specialDependency.score) / (skillImpactTotal + specialPotentialTotal)
      : skills.length
        ? skills.reduce((sum, id) => sum + ((skillDependencies.get(id) || {}).score || 0), 0) / skills.length
        : specialDependency.score;
    const maRecovery = coachClamp(((Number(person.ma) || 4) - 4) / 5, 0, 1);
    const agRecovery = coachClamp((7 - (Number(person.ag) || 7)) / 5, 0, 1);
    const survivalRecovery = coachClamp(fullScores[3] / 100, 0, 1);
    const negativeSkills = skills.map(id => skillRecords.get(id)).filter(skill => skill && (skill.polarity === "negative" || skill.polarity === "mixed"));
    const negativeRisk = negativeSkills.length
      ? negativeSkills.reduce((sum, skill) => sum + skill.executionDependency.score, 0) / negativeSkills.length
      : 0;
    const mistakePunishment = 100 * coachClamp(1 - (0.32 * maRecovery + 0.18 * agRecovery + 0.38 * survivalRecovery + 0.12 * (1 - negativeRisk / 100)), 0, 1);
    const executionRecords = skills.map(id => skillDependencies.get(id)).filter(Boolean);
    const cueShare = featureId => {
      if (!executionRecords.length) return specialDependency.features.some(feature => feature.id === featureId) ? 100 : 0;
      return 100 * executionRecords.filter(record => record.features.some(feature => feature.id === featureId)).length / executionRecords.length;
    };
    const synergyCount = SYNERGIES.filter(synergy => {
      const requiredSkills = synergy.requires.filter(id => id !== "ST" && id !== "MA");
      return requiredSkills.every(id => skills.includes(id)) &&
        (!synergy.requires.includes("ST") || Number(person.st) >= 4) &&
        (!synergy.requires.includes("MA") || Number(person.ma) >= 7);
    }).length;
    const synergyComplexity = 100 * synergyCount / Math.max(1, SYNERGIES.length);
    const profile = {
      id: person.id,
      skills,
      scores: fullScores,
      roleValues,
      roleComplexity: 100 * normalizedEntropy(roleValues),
      executionDependency,
      synergyComplexity,
      coachFactors: {
        roleClarity: 100 - 100 * normalizedEntropy(roleValues),
        roleRedundancy: null,
        recoveryAbility: 100 - mistakePunishment,
        decisionBranching: cueShare("decisionBranching"),
        positionalDependency: synergyComplexity,
        resourceManagementDifficulty: cueShare("resourceManagement"),
        turnSequencingSensitivity: cueShare("sequencing")
      },
      mistakePunishment,
      expressiveValues,
      passiveValues,
      skillExpressiveBreakdown,
      expressiveValue: expressiveValues.reduce((sum, value, axis) => sum + value * ((window.BB_SCORING.METHOD.weights[axis] || 0) / 0.85), 0),
      passiveValue: null,
      specialExecutionDependency: specialDependency,
      negativeSkillIds: negativeSkills.map(skill => skill.id),
      source: "Bloodboard V5 skill-rule summary cue + current rule-scoring pipeline ablation with/without each skill; scenario proxy, not engine task probability or calibrated gameplay data"
    };
    profile.passiveValue = Math.max(0, profile.scores.slice(0, 5).reduce((sum, value, axis) => sum + value * (window.BB_SCORING.METHOD.weights[axis] / 0.85), 0) - profile.expressiveValue);
    COACH_ANALYSIS_CACHE.set(signature, profile);
    if (COACH_ANALYSIS_CACHE.size > 2000) COACH_ANALYSIS_CACHE.delete(COACH_ANALYSIS_CACHE.keys().next().value);
    return profile;
  }

  function evaluateCoachSkill(entity, options = {}) {
    const coachSkill = options.coachSkill == null ? BASELINE_CONTEXT.coachSkill : Number(options.coachSkill);
    if (!Number.isFinite(coachSkill) || coachSkill < 0 || coachSkill > 100) throw new RangeError("coachSkill must be within 0..100.");
    const team = Array.isArray(entity && entity.players);
    const players = team ? entity.players : [entity];
    const playerProfiles = players.map(analyzeCoachPlayer).filter(Boolean);
    if (!playerProfiles.length) return { status: "missing-player-scoring-data" };
    const format = options.format || entity.format || "standard";
    const limit = format === "sevens" ? 7 : 11;
    const weights = window.BB_SCORING.METHOD.weights;
    const lineupValue = profile => profile.scores.slice(0, 5).reduce((sum, value, axis) => sum + value * weights[axis], 0) / weights.slice(0, 5).reduce((sum, value) => sum + value, 0);
    const ordered = playerProfiles.slice().sort((a, b) => lineupValue(b) - lineupValue(a));
    const active = ordered.slice(0, limit);
    const rankWeights = Array.from({ length: limit }, (_, rank) => Math.exp(-0.38 * rank));
    const weightedTop = getValue => active.reduce((sum, profile, index) => sum + (Number(getValue(profile)) || 0) * rankWeights[index], 0) / rankWeights.reduce((sum, value) => sum + value, 0);
    const entityBaseScores = options.baseScores || (team ? entity.scores : entity.scores || playerProfiles[0].scores) || [];
    const baseScores = team
      ? Array.from({ length: 5 }, (_, axis) => Number(entityBaseScores[axis]) || weightedTop(profile => profile.scores[axis])).concat(Number(entityBaseScores[5]) || 0)
      : playerProfiles[0].scores.slice(0, 5);
    const expressiveValues = team
      ? Array.from({ length: 5 }, (_, axis) => weightedTop(profile => profile.expressiveValues[axis])).concat(0)
      : playerProfiles[0].expressiveValues.slice(0, 5);
    const executionDependency = team
      ? weightedTop(profile => profile.executionDependency)
      : playerProfiles[0].executionDependency;
    const roleBreadth = team
      ? active.reduce((sum, profile) => sum + profile.roleComplexity, 0) / Math.max(1, active.length)
      : playerProfiles[0].roleComplexity;
    const rolePressure = team ? Math.min(1, 5 / Math.max(1, limit)) : 1;
    const roleComplexity = team ? roleBreadth * rolePressure : roleBreadth;
    const squadSkills = new Set(playerProfiles.flatMap(profile => profile.skills));
    let activeSynergies = 0;
    SYNERGIES.forEach(synergy => {
      const skillRequirements = synergy.requires.filter(id => id !== "ST" && id !== "MA");
      const hasStatRequirement = synergy.requires.includes("ST") || synergy.requires.includes("MA");
      const hasSkills = skillRequirements.every(id => squadSkills.has(id));
      const hasStats = !hasStatRequirement || playerProfiles.some(profile => {
        const original = players.find(player => player.id === profile.id) || {};
        return (!synergy.requires.includes("ST") || Number(original.st) >= 4) && (!synergy.requires.includes("MA") || Number(original.ma) >= 7);
      });
      if (hasSkills && hasStats) activeSynergies++;
    });
    const synergyComplexity = team
      ? 100 * activeSynergies / Math.max(1, SYNERGIES.length)
      : playerProfiles[0].synergyComplexity;
    let mistakePunishment = team
      ? active.reduce((sum, profile) => sum + profile.mistakePunishment, 0) / Math.max(1, active.length)
      : playerProfiles[0].mistakePunishment;
    let roleScarcity = 0;
    if (team) {
      const roleCount = playerProfiles[0].roleValues.length;
      const gaps = Array.from({ length: roleCount }, (_, role) => {
        const values = playerProfiles.map(profile => Number(profile.roleValues[role]) || 0).sort((a, b) => b - a);
        const best = values[0] || 0;
        const second = values[1] || 0;
        return best > 0 ? coachClamp((best - second) / best, 0, 1) : 0;
      });
      roleScarcity = gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length * 100 : 0;
      const benchCoverage = coachClamp((players.length - limit) / limit, 0, 1);
      mistakePunishment = coachClamp(0.72 * mistakePunishment + 0.20 * roleScarcity + 0.08 * (100 * (1 - benchCoverage)), 0, 100);
    }
    const averageCoachFactor = key => team
      ? active.reduce((sum, profile) => sum + (Number(profile.coachFactors[key]) || 0), 0) / Math.max(1, active.length)
      : Number(playerProfiles[0].coachFactors[key]) || 0;
    const detailFactors = {
      roleClarity: Math.round((100 - roleComplexity) * 10) / 10,
      roleRedundancy: team ? Math.round((100 - roleScarcity) * 10) / 10 : null,
      recoveryAbility: Math.round((100 - mistakePunishment) * 10) / 10,
      decisionBranching: Math.round(averageCoachFactor("decisionBranching") * 10) / 10,
      positionalDependency: Math.round(synergyComplexity * 10) / 10,
      resourceManagementDifficulty: Math.round(averageCoachFactor("resourceManagementDifficulty") * 10) / 10,
      turnSequencingSensitivity: Math.round(averageCoachFactor("turnSequencingSensitivity") * 10) / 10
    };
    const contextBase = { executionDependency, roleComplexity, synergyComplexity, mistakePunishment };
    const scoreAt = value => {
      const realizationFactor = coachRealizationFactor(Object.assign({ coachSkill: value }, contextBase)).value;
      const scores = baseScores.map((score, axis) => coachClamp(score - (Number(expressiveValues[axis]) || 0) * (1 - realizationFactor), 0, 100));
      const realizedStrength = team
        ? scores.reduce((sum, score, axis) => sum + score * weights[axis], 0)
        : scores.slice(0, 5).reduce((sum, score, axis) => sum + score * (weights[axis] / 0.85), 0);
      return { realizationFactor, scores, strength: realizedStrength };
    };
    const current = scoreAt(coachSkill);
    const atBeginner = scoreAt(25);
    const atExperienced = scoreAt(60);
    const atExpert = scoreAt(90);
    const factor = current.realizationFactor;
    const experiencedFactor = atExperienced.realizationFactor;
    const realizedScores = current.scores;
    const strength = current.strength;
    const baseStrength = team
      ? baseScores.reduce((sum, value, axis) => sum + value * weights[axis], 0)
      : baseScores.slice(0, 5).reduce((sum, value, axis) => sum + value * (weights[axis] / 0.85), 0);
    const at = value => evaluateCoachSkill(entity, { ...options, coachSkill: value });
    const floor = atBeginner.strength;
    const ceiling = atExpert.strength;
    const experienced = atExperienced.strength;
    const dimensionNames = ["快攻", "控球", "杀伤", "生存", "控场", "适应力"];
    const explanationProfiles = team ? active : [playerProfiles[0]];
    const explanationSkillIds = [...new Set(explanationProfiles.flatMap(profile => profile.skillExpressiveBreakdown.map(entry => entry.id)))];
    const skillExplanationDrivers = explanationSkillIds.map(id => {
      const sample = explanationProfiles.flatMap(profile => profile.skillExpressiveBreakdown).find(entry => entry.id === id);
      const axes = Array.from({ length: 5 }, (_, axis) => {
        const expressive = team
          ? weightedTop(profile => {
            const entry = profile.skillExpressiveBreakdown.find(candidate => candidate.id === id);
            return entry ? entry.expressiveByAxis[axis] : 0;
          })
          : (sample ? sample.expressiveByAxis[axis] : 0);
        const weight = team ? weights[axis] : weights[axis] / 0.85;
        return { label: dimensionNames[axis], delta: expressive * (factor - experiencedFactor) * weight };
      });
      return {
        id,
        label: sample ? sample.name : id,
        dependencyFeatures: sample ? sample.dependencyFeatures.slice(0, 2) : [],
        delta: axes.reduce((sum, axis) => sum + axis.delta, 0),
        axes: axes.filter(axis => Math.abs(axis.delta) > 1e-9)
      };
    }).filter(driver => Math.abs(driver.delta) > 1e-9)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const deltaByAxisVsExperienced = realizedScores.map((value, axis) => Math.round((value - atExperienced.scores[axis]) * 100) / 100);
    const delta = Math.round((strength - experienced) * 100) / 100;
    const drivers = deltaByAxisVsExperienced.map((value, axis) => ({ label: dimensionNames[axis], delta: value, weightedDelta: value * (team ? weights[axis] : weights[axis] / 0.85) })).sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta)).filter(item => Math.abs(item.weightedDelta) >= 0.01).slice(0, 3);
    const profile = team ? null : playerProfiles[0];
    const passiveValue = team
      ? Math.max(0, baseStrength - expressiveValues.slice(0, 5).reduce((sum, value, axis) => sum + value * weights[axis], 0))
      : profile.passiveValue;
    const expressiveValue = team
      ? expressiveValues.slice(0, 5).reduce((sum, value, axis) => sum + value * weights[axis], 0)
      : profile.expressiveValue;
    return {
      status: "coach-scenario-preview; rules-backed skill deltas, rule-text dependency proxy; tactical-behavior calibration pending",
      scoreLayer: "legacy-scoring-proxy-coach-preview",
      taskProfile: buildTaskProfile(String(entity.id || entity.name || "unidentified-subject")),
      legacyScoreSource: "BB_SCORING.scorePlayer / existing team roster aggregation; not a calibrated V3 task profile",
      coachSkill,
      coachLevel: COACH_LEVELS.slice().sort((a, b) => Math.abs(a.coachSkill - coachSkill) - Math.abs(b.coachSkill - coachSkill))[0].id,
      skillFloor: Math.round(floor * 10) / 10,
      skillCeiling: Math.round(ceiling * 10) / 10,
      experiencedStrength: Math.round(experienced * 10) / 10,
      baseStrength: Math.round(baseStrength * 10) / 10,
      realizedStrength: Math.round(strength * 10) / 10,
      deltaFromExperienced: delta,
      realizedScores: realizedScores.map(value => Math.round(value * 10) / 10),
      baseScores: baseScores.map(value => Math.round(value * 10) / 10),
      expressiveValues: expressiveValues.map(value => Math.round((Number(value) || 0) * 10) / 10),
      passiveValue: Math.round(passiveValue * 10) / 10,
      expressiveValue: Math.round(expressiveValue * 10) / 10,
      realizationFactor: Math.round(factor * 1000) / 1000,
      experiencedRealizationFactor: Math.round(experiencedFactor * 1000) / 1000,
      executionDependency: Math.round(executionDependency * 10) / 10,
      roleComplexity: Math.round(roleComplexity * 10) / 10,
      synergyComplexity: Math.round(synergyComplexity * 10) / 10,
      mistakePunishment: Math.round(mistakePunishment * 10) / 10,
      roleScarcity: Math.round(roleScarcity * 10) / 10,
      contributingFactors: detailFactors,
      activeSynergyCount: activeSynergies,
      activeLineup: active.map(profile => profile.id),
      deltaByAxisVsExperienced,
      explanationDrivers: drivers,
      formula: "Realized axis = Base axis − Skill-Expressive Value × (1 − Coach Realization Factor); Realized Strength = weighted realized axes. Coach Realization Factor = 1 − (1 − CoachSkill/100) × mean(Execution Dependency, Role Complexity, Synergy Complexity, Mistake Punishment)/100.",
      source: team ? "Existing team roster aggregation + Bloodboard V5 individual scoring ablation; role/roster dimensions are explicit provisional proxies" : profile.source,
      context: { format, activePlayerCount: active.length, rosterSize: playerProfiles.length, roleScarcity: Math.round(roleScarcity * 10) / 10 },
      skillExplanationDrivers
    };
  }

  const SUBMETRICS = Object.freeze({
    "mobility.openRoute": { unit: "probability", status: "engine-enumerated-open-route-distance-curve; axis-calibration-pending" },
    "mobility.markedRoute": { unit: "task-success probability", status: "one-mark-dodge-and-Tackle-interaction-prototype; route-coverage-pending" },
    "mobility.escapeContact": { unit: "probability", status: "engine-enumerated-one-marker-two-step-escape-with-explicit-activation-end; broader-contact-and-route-calibration-pending" },
    "mobility.crossScreen": { unit: "probability of standing beyond a fixed opponent screen", status: "fixed-and-engine-selected-candidate-routes-enumerated; selector-is-heuristic; global-route-optimality-and-roster-calibration-pending" },
    "mobility.screenedTouchdown": { unit: "probability of a standing touchdown through a fixed screen", status: "fixed-and-engine-selected-candidate-touchdown-paths-enumerated; selector-is-heuristic; global-route-optimality-and-roster-calibration-pending" },
    "mobility.teamScoringChain": { unit: "team touchdown probability and support delta", status: "engine-enumerated-hypnotic-gaze-opener-plus-held-ball-carrier-sequence; exact-rules-probability-choice-among-declared-upper-and-lower-lane-routes; broader-action-search-and-roster-calibration-pending" },
    "mobility.kickTeamMateTouchdown": { unit: "team touchdown probability", status: "engine-enumerated-Kick-Team-mate-with-Right-Stuff-ball-carrier-at-fixed-short-range-scoring-lane; pressure-and-position-frequency-calibration-pending" },
    "mobility.puntTouchdown": { unit: "probability (0–1)", status: "V6.1 Punt action distribution includes actual teammate/opponent catch, bounce and Touchdown resolution; receiving-lane and field-position calibration pending" },
    "mobility.redeploy": { unit: "probability / board reach", status: "planned" },
    "mobility.touchdown": { unit: "standing ball-carrier touchdown probability", status: "engine-enumerated-one-move-touchdown-distance-curve; full-drive-chain-pending" },
    "ball.acquisition": { unit: "probability", status: "single-action-pickup-prototype; axis-calibration-pending" },
    "ball.retention": { unit: "probability", status: "one-on-one-carrier-block-prototype; broader-threat-calibration-pending" },
    "ball.teamRetention": { unit: "probability", status: "full-declared-state-carrier-threat-terminal-possession-prototype; follow-up-recovery-and-threat-frequency-pending" },
    "ball.transfer": { unit: "probability", status: "pass-and-handoff-catch-chain-prototype; broader-route-calibration-pending" },
    "ball.recovery": { unit: "probability", status: "open-and-marked-ground-ball-single-action-prototype; team-possession-and-safe-recovery-events; broader-bounce-and-roster-chain-coverage-pending" },
    "ball.disruption": { unit: "probability", status: "one-on-one-carrier-block-and-Strip-Ball-vs-Sure-Hands-interaction-prototype; team-possession-loss-and-safe-disruption-events; broader-theft-and-recovery-chain-pending" },
    "ball.puntOwnPossession": { unit: "probability (0–1)", status: "V6.1 Punt after one-square carrier Move; own possession or score without Turnover; fixed receiving-lane scenario" },
    "ball.puntReceiverSecures": { unit: "probability (0–1)", status: "V6.1 Punt action tree; named AG3 receiver Catch and bounce resolution; receiver/marker layout fixed" },
    "ball.puntOpponentPossession": { unit: "probability (0–1)", status: "V6.1 Punt action tree; opposing possession after Catch/bounce; fixed receiver-lane marker" },
    "ball.puntLiveLooseBall": { unit: "probability (0–1)", status: "V6.1 Punt action tree; in-play ground ball without Turnover after full bounce/throw-in resolution" },
    "ball.puntOpponentTouchdown": { unit: "probability (0–1)", status: "V6.1 Punt action tree; opponent Touchdown outcome retained separately" },
    "ball.puntTurnover": { unit: "probability (0–1)", status: "V6.1 Punt action tree; opponent possession/crowd Turnover separated from live ground-ball outcome" },
    "combat.blockAdvantage": { unit: "outcome distribution", status: "engine-task-observation-live; one-on-one-block benchmark; matchup-calibration-pending" },
    "combat.knockdown": { unit: "probability", status: "engine-task-observation-live; one-on-one-block benchmark; scenario-coverage-pending" },
    "combat.safeKnockdown": { unit: "joint probability by result chain", status: "engine-task-observation-live; target-down-or-removed AND no active-team Turnover; one-on-one-block benchmark" },
    "combat.removal": { unit: "joint probability by result chain", status: "engine-task-observation-live; safe-removal joint event; opponent-calibration-pending" },
    "combat.foulRemoval": { unit: "conditional probability by foul event chain", status: "engine-enumerated-prone-target-foul; safe-removal-and-fouler-send-off-separated; team-target-generation-and-cost-pending" },
    "combat.teamFoulChain": { unit: "joint probability by conditional team action chain", status: "engine-enumerated-conditional-block-foul-chain; optional Black Gobbo second foul, Bribery and Corruption, configured Bribes, and focal Secret Weapon Drive-end resolution are explicit" },
    "combat.specialAction": { unit: "safe target-effect probability plus engine outcome distribution", status: "engine-enumerated-separate-Ball-and-Chain-Chainsaw-Stab-Projectile-Vomit-and-Breathe-Fire-actions; target-effect-without-Turnover-and-armour/injury-outcome-summary; board-and-opportunity calibration pending" },
    "combat.specialCollateral": { unit: "safe collateral-target effect probability", status: "engine-enumerated-bomb-impact-and-adjacent-blast-effect-from-same-full-Bombardier-action-tree; broader-collateral-layout-and-opportunity calibration pending" },
    "survival.incomingBlock": { unit: "standing / knockdown outcome probability delta", status: "Dodge-vs-Tackle-one-on-one-prototype; team-context-pending" },
    "survival.damageChain": { unit: "state-transition probabilities", status: "exact-exclusive-standing-prone-stunned-removed-partition-after-one-Block; time-horizon-pending" },
    "survival.currentFunction": { unit: "next-activation task-success probability", status: "engine-enumerated-block-to-next-activation-move-task; role-objective-coverage-and-team-calibration-pending" },
    "survival.returnToDrive": { unit: "probability by time horizon", status: "planned" },
    "survival.positionRetention": { unit: "probability of retaining the assigned square while standing", status: "engine-enumerated-start-square-retention-matrix; role-specific follow-up-pending" },
    "survival.specialBackfire": { unit: "probability of attacker knocked down or removed by its own special attack", status: "engine-enumerated-attacker-down-or-removed-on-special-attack-tree; trigger-frequency-and-duration-cost calibration pending" },
    "control.static": { unit: "board-choice delta", status: "planned" },
    "control.staticPersistence": { unit: "probability of retaining a standing local control zone", status: "engine-enumerated-static-control-zone-matrix-with-bilateral-assists-declared-opposing-skills-and-block-or-blitz; roster-and-full-pitch-calibration-pending" },
    "control.teamStaticCoverage": { unit: "expected unique tackle-zone square count", status: "engine-enumerated-legal-defensive-formation-and-declared-single-threat-portfolio-with-whole-team-zone-union; same-slot replacement with caller-declared teammate redeployment candidates; full-pitch-and-match-frequency-calibration-pending" },
    "control.dynamic": { unit: "expected net control-footprint square delta", status: "engine-enumerated-fixed-marked-route-own-zone-gain-minus-opponent-zone-gain; Gretchen-Incorporeal-Kiroth-Black-Ink-and-Zolcath-distraction-rule-use-and-reroll-state-explicit; scenario-frequency-and-axis-calibration-pending" },
    "control.supportDelta": { unit: "task probability delta", status: "engine-enumerated-offensive-Guard-and-defensive-screen-paired-task-prototypes; broader-team-task-and-position-portfolio-calibration-pending" },
    "control.actionEconomy": { unit: "expected denied opposing activations", status: "single-target-estelle-hex-task-enumerated; other control objectives and resource/action search pending" },
    "control.specialPin": { unit: "probability a marked opponent is Chomped and cannot leave its square", status: "engine-enumerated-Monstrous-Mouth-Chomp-event-with-live-mark-check; opportunity-frequency-and-follow-up-team-value-pending" },
    "control.hypnoticGaze": { unit: "probability adjacent standing opponent is Distracted with no Turnover", status: "engine-enumerated-Hypnotic-Gaze-task-with-explicit-adjacent-standing-target-and-Turnover-separation; lane-opening-and-team-follow-up-separate" },
    "control.gazeTargetDistraction": { unit: "probability opponent loses its Tackle Zone", status: "engine-enumerated-playerDistracted-terminal-event; action-opportunity-and-duration-value-pending" },
    "adaptability.roleCoverage": { unit: "probability (0–1), labeled by role and benchmark", status: "engine-enumerated carrier/scorer/blitz tasks plus direct protected-teammate-screen and Hypnotic-Gaze opening-support task prototypes; cross-role opportunity calibration pending; never average raw probabilities" },
    "adaptability.teamImportance": { unit: "team task success probability delta", status: "engine-enumerated-declared-team-action-portfolios-before-and-after-player-removal; teammate-role-reassignment-and-existing-ready-reserve-reference-lineups; exhaustive-turn-search-and-multi-task-calibration-pending" },
    "reliability.activation": { unit: "declared-input completion probability", status: "engine-enumerated-declared-role-task-with-explicit-activation-cleanup; not-an-isolated-trait-check" },
    "reliability.coreTask": { unit: "joint task probability", status: "engine-enumerated-fixed-role-task-after-explicit-activation-cleanup; shared-finite-rerolls; role-calibration-pending" },
    "reliability.turnoverRisk": { unit: "probability", status: "engine-enumerated-declared-role-task-including-activation-end-effects" },
    "reliability.rerollBudget": { unit: "remaining resource state", status: "engine-enumerated-terminal-reroll-distribution-and-joint-task-success; policy-optimization-pending" }
  });

  const TASK_CONTEXT_KEYS = Object.freeze([
    "format", "boardState", "opponentProfile", "supportState", "rerollPool", "taskParameters", "event"
  ]);
  const defineTaskContract = (id, axisId, family, benchmarkId, difficultyTier, event, unit, resultKind, direction, layer = "axis") => Object.freeze({
    submetricId: id,
    axisId,
    layer,
    taskFamily: family,
    benchmarkId,
    difficultyTier,
    event,
    unit,
    resultKind,
    direction,
    requiredContext: TASK_CONTEXT_KEYS,
    implementationStatus: SUBMETRICS[id].status.startsWith("planned") ? "planned" : "prototype",
    calibrationGroup: null,
    calibrationStatus: "uncalibrated; never aggregate with other task families"
  });
  const TASK_CONTRACTS = Object.freeze({
    "mobility.openRoute": defineTaskContract("mobility.openRoute", "mobility", "movement-arrival", "open-route-distance", "unmarked-fixed-distance", "After one Move Action, the player is standing on the declared destination square; every Rush needed to stand there is resolved.", "probability (0–1)", "probability", "higher"),
    "mobility.touchdown": defineTaskContract("mobility.touchdown", "mobility", "one-move-touchdown", "open-held-ball-distance-to-goal", "unmarked-fixed-distance-from-declared-start-to-end-zone", "The ball-carrying player completes a legal Move Action and Team A actually scores a touchdown; movement completion, reaching the end zone while prone, or an unresolved turnover is not success.", "probability (0–1)", "probability", "higher"),
    "mobility.markedRoute": defineTaskContract("mobility.markedRoute", "mobility", "movement-arrival", "single-marker-route", "one-marker-fixed-route", "After one Move Action, the player is standing on the declared destination square after resolving the listed opposing tackle zones, Dodge/Leap checks and Rushes.", "probability (0–1)", "probability", "higher"),
    "mobility.escapeContact": defineTaskContract("mobility.escapeContact", "mobility", "contact-escape", "leave-contact-zone", "declared-contact-count", "The player ends standing outside the declared opponents' tackle zones without a Turnover.", "probability (0–1)", "probability", "higher"),
    "mobility.crossScreen": defineTaskContract("mobility.crossScreen", "mobility", "screen-crossing", "cross-fixed-screen", "declared-screen-layout-distance-and-path-policy", "After one legal Move Action along either the declared straight path or one candidate path selected by Bloodboard's safestRoute heuristic, the player is standing on the same target square beyond all declared screen players. Bloodboard resolves every Dodge, Rush, activation and destination effect for the selected action path. The heuristic route estimate is not the task probability; global route optimality is not claimed.", "probability (0–1)", "probability", "higher"),
    "mobility.screenedTouchdown": defineTaskContract("mobility.screenedTouchdown", "mobility", "one-move-touchdown", "fixed-screen-held-ball-to-goal", "declared-screen-layout-distance-and-path-policy", "The player begins holding the ball and completes one legal Move Action to Team A's scoring end zone by either the declared straight path or one candidate path selected by Bloodboard's safestRoute heuristic. Success is an actual standing touchdown. Movement completion, a prone arrival, a failed route or a Turnover is not success; the heuristic estimate is not the touchdown probability and global route optimality is not claimed.", "probability (0–1)", "probability", "higher"),
    "mobility.teamScoringChain": defineTaskContract("mobility.teamScoringChain", "mobility", "team-assisted-touchdown", "hypnotic-gaze-opener-plus-carrier-touchdown", "fixed-central-lane-one-screen-two-activations-with-three-declared-route-policies", "A separate teammate first attempts Hypnotic Gaze against the adjacent Standing screen and its activation ends; the held-ball carrier then either follows the declared straight route or chooses the highest exact touchdown probability among Bloodboard's heuristic route and legal upper/lower waypoint routes in that exact successor state. Success is Team A scoring an actual standing touchdown. Bloodlust, Thrall bite fallback, screen distraction, Rush/Dodge, shared rerolls, Turnovers and action order are resolved by Bloodboard. Route candidates are evaluated separately using the same remaining reroll state; the finite lane set is not a full-turn or globally exhaustive route search. The comparison baseline uses the identical starting state and reroll pool but only the carrier action.", "probability (0–1); supported-minus-baseline delta (−1–1)", "probability", "higher"),
    "mobility.kickTeamMateTouchdown": defineTaskContract("mobility.kickTeamMateTouchdown", "mobility", "team-assisted-touchdown", "kick-team-mate-carried-ball-touchdown", "one canonical Kick Team-mate action; adjacent Right Stuff teammate holding the ball; fixed short-range scoring target; no opposing pressure", "A player with Kick Team-mate performs the legal Special Action using the declared adjacent Right Stuff teammate who begins holding the ball; Bloodboard resolves the Passing Ability Test, fumble injury, flight, landing, landing test, bounce and any resulting Turnover. Success is an actual Team A touchdown by that teammate. A touchdown ends the team turn and therefore is not rejected by a no-Turnover condition. This is a fixed scoring-lane probability, not the chance to create the required initial position or a full-drive opportunity rate.", "probability (0–1)", "probability", "higher"),
    "mobility.redeploy": defineTaskContract("mobility.redeploy", "mobility", "board-reach", "reachable-squares", "declared-start-and-threat-map", "Number of legal destination squares the player can reach while ending standing in one Move Action under the declared threat map.", "reachable-square count", "count", "higher"),
    "ball.acquisition": defineTaskContract("ball.acquisition", "ball", "ball-acquisition", "ground-ball-pickup", "declared-ball-pressure", "At the end of the declared pickup action, the acting player possesses the ball and the active team has not suffered a Turnover.", "probability (0–1)", "probability", "higher"),
    "ball.retention": defineTaskContract("ball.retention", "ball", "carrier-retention", "carrier-under-threat", "declared-incoming-threat", "After the declared opponent action and all scatter/bounce/catch resolution, the named carrier still possesses the ball.", "probability (0–1)", "probability", "higher"),
    "ball.teamRetention": defineTaskContract("ball.teamRetention", "ball", "team-possession-retention", "carrier-under-threat-team-possession", "declared-incoming-threat-and-teammates", "After the declared opposing action and all scatter/bounce/catch resolution, any player on the carrier team possesses the ball. Report the original carrier, another teammate, the opponent, and ground-ball outcomes separately; no later recovery action is included.", "probability (0–1)", "probability", "higher"),
    "ball.transfer": defineTaskContract("ball.transfer", "ball", "ball-transfer", "designated-receiver-transfer", "declared-pass-or-handoff", "At the end of the declared Pass or Hand-off chain, the designated receiver possesses the ball and the acting team has not suffered a Turnover.", "probability (0–1)", "probability", "higher"),
    "ball.recovery": defineTaskContract("ball.recovery", "ball", "loose-ball-recovery", "ground-ball-recovery", "declared-recovery-pressure", "At the end of the recovery sequence, a player on the acting team possesses the ball and the acting team has not suffered a Turnover.", "probability (0–1)", "probability", "higher"),
    "ball.disruption": defineTaskContract("ball.disruption", "ball", "opponent-possession-disruption", "carrier-possession-disruption", "declared-carrier-and-block", "At the end of the declared defensive action and ball scatter/bounce resolution, the opposing carrier no longer possesses the ball; team recovery is reported separately.", "probability (0–1)", "probability", "higher"),
    "ball.puntOwnPossession": defineTaskContract("ball.puntOwnPossession", "ball", "punt-possession-distribution", "own-team-possession-without-turnover", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "After the declared one-square Move with the ball, forward Punt, complete landing/Catch/bounce/throw-in resolution and activation cleanup, Team A possesses the ball without a Turnover. Team A Touchdown is reported separately. This conditional benchmark does not assert that retaining possession is always the optimal tactical intent of a Punt.", "probability (0–1)", "probability", "higher"),
    "ball.puntReceiverSecures": defineTaskContract("ball.puntReceiverSecures", "ball", "punt-possession-distribution", "named-teammate-secures-punted-ball", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "After the complete declared Punt action and ball resolution, the named AG3 teammate holds the ball. Catch failure, subsequent bounce and Turnover are resolved by Bloodboard; no separate reroll is invented.", "probability (0–1)", "probability", "higher"),
    "ball.puntOpponentPossession": defineTaskContract("ball.puntOpponentPossession", "ball", "punt-possession-distribution", "opponent-secures-punted-ball", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "After the complete declared Punt action and ball resolution, any Team B player holds the ball. This includes the rule-defined opposing Catch outcome and is reported separately from crowd Turnover.", "probability (0–1)", "probability", "higher"),
    "ball.puntLiveLooseBall": defineTaskContract("ball.puntLiveLooseBall", "ball", "punt-possession-distribution", "in-play-loose-ball-without-turnover", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "After the complete declared Punt action and bounce/throw-in resolution, the ball is on the pitch on the ground and the acting team has not suffered a Turnover. This is a live loose-ball outcome, not retained possession.", "probability (0–1)", "probability", "higher"),
    "ball.puntOpponentTouchdown": defineTaskContract("ball.puntOpponentTouchdown", "ball", "punt-possession-distribution", "opponent-touchdown-from-punt-resolution", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "Bloodboard reports whether the declared Punt sequence ends in a Team B Touchdown. Keep the event separate from possession and Turnover probabilities because scoring can terminate the action sequence.", "probability (0–1)", "probability", "lower"),
    "ball.puntTurnover": defineTaskContract("ball.puntTurnover", "ball", "punt-possession-distribution", "turnover-during-Punt-resolution", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "Probability that the Punt action causes a Turnover under the declared board and internal Bloodboard decision policy, including an opposing Catch or Punt into the crowd. A safe ground ball is not a Turnover.", "probability (0–1)", "probability", "lower"),
    "mobility.puntTouchdown": defineTaskContract("mobility.puntTouchdown", "mobility", "punt-scoring-outcome", "own-touchdown-from-Punt-resolution", "one-square-carrier-move-forward-Punt-fixed-AG3-receiver-and-adjacent-opponent-marker", "Bloodboard reports whether the declared Punt sequence ends in a Team A Touchdown after full catch/bounce resolution. This rare scoring branch is distinct from receiver possession and is not a general scoring rate.", "probability (0–1)", "probability", "higher"),
    "combat.blockAdvantage": defineTaskContract("combat.blockAdvantage", "combat", "block-outcome", "selected-block-result", "declared-strength-and-skills", "Probability distribution over the legal selected Block result and its resulting state under the declared dice-choice policy.", "outcome probability distribution", "distribution", "distribution"),
    "combat.knockdown": defineTaskContract("combat.knockdown", "combat", "block-knockdown", "target-knocked-down", "declared-strength-and-skills", "After the declared Block and damage chain, the target is prone, stunned or removed; a push that leaves the target standing is not success.", "probability (0–1)", "probability", "higher"),
    "combat.safeKnockdown": defineTaskContract("combat.safeKnockdown", "combat", "block-knockdown", "safe-target-knockdown", "declared-strength-and-skills", "After the declared Block and damage chain, the target is prone, stunned or removed AND the active team has not suffered a Turnover; retain raw knockdown and turnover probabilities separately.", "joint probability (0–1)", "probability", "higher"),
    "combat.removal": defineTaskContract("combat.removal", "combat", "damage-chain-removal", "safe-target-removal", "declared-target-armour-and-action", "The target is removed from the pitch by the declared action and the active team has not suffered a Turnover; report unsafe removals separately.", "joint probability (0–1)", "probability", "higher"),
    "combat.foulRemoval": defineTaskContract("combat.foulRemoval", "combat", "foul-damage-chain", "prone-target-safe-foul-removal", "declared-target-armour-and-foul-support", "After the Foul Action and explicit activation cleanup (or an earlier Turnover/touchdown) against the declared adjacent Prone or Stunned target, the target has been removed and the fouling team has not suffered a Turnover; separately report any target removal, fouler Sent-off state, and removal with Turnover. The target must already be down, so this is a conditional foul task, not the probability of generating a foul opportunity.", "joint probability (0–1)", "probability", "higher"),
    "combat.teamFoulChain": defineTaskContract("combat.teamFoulChain", "combat", "team-kill-action-chain", "standing-target-block-then-conditional-foul", "one-fixed-blocker-one-fouler-vs-ST3-AV9-target; optional Black Gobbo, team rule, Bribe and Secret Weapon contexts", "The standing target begins adjacent to a declared blocker and a separate fouler. Resolve one legal Block and its activation cleanup; only if the target is Prone/Stunned and the Foul Action remains legal does the second player foul. An optional third action is the Black Gobbo's legal second Foul Action, only if the first Foul caused no Turnover and the target remains down. Bloodboard resolves legal assists from the fixed squares, Bribery and Corruption, configured Bribes, Dirty Player and optional Chainsaw kick-back. A single in-Drive Secret Weapon participant may be followed through actual Bloodboard Drive-end resolution as a separate availability outcome. Success is target removed by any action and the acting team has not suffered a Turnover in the chain. Report each action's safe-removal chance, legal opportunity, fouler risk, resource consumption and Drive-end availability separately. Prices remain economic context, not modifiers to raw probability. This is a fixed matchup/action chain, not an optimized turn or multi-Drive roster-economy result.", "joint probability (0–1)", "probability", "higher"),
    "combat.specialAction": defineTaskContract("combat.specialAction", "combat", "special-attack-outcome", "special-attack-safe-target-effect", "action-specific legal target and printed skills: adjacent ST3/AV9 for melee attacks; four-square target tile with a standing occupant for Bombardier", "Resolve the named Bloodboard Special Action against its declared objective. Success means the focal opposing target is knocked down, placed prone, or removed from the pitch and the acting team has not suffered a Turnover. Bombardier uses a fixed short-range target square; the engine resolves PA, inaccurate scatter, interception/catching, mandatory rethrows and explosion, with one additional opponent in the blast radius. The focal and collateral Bombardier results are measured from the terminal action tree because the engine's generic named-target summary does not attribute square-based explosions; for the other actions retain the engine's armor-break/removal summary. Ball & Chain is the declared one-step facing action. These are local reference scenarios, not full-turn opportunity rates.", "joint probability (0–1); engine target outcome distribution", "probability", "higher"),
    "combat.specialCollateral": defineTaskContract("combat.specialCollateral", "combat", "special-attack-collateral", "bombardier-safe-adjacent-blast-effect", "same short-range Bombardier tree with one declared opponent adjacent to the target square", "On the same Throw Bomb tree as combat.specialAction, a separate declared opponent adjacent to the bomb target square is knocked down, placed prone or removed, and the acting team has not suffered a Turnover. Bloodboard resolves the throw, scatter, intercept/catch/rethrow and explosion; this measures one collateral square only and is not expected multi-target damage over a whole drive.", "joint probability (0–1)", "probability", "higher"),
    "survival.incomingBlock": defineTaskContract("survival.incomingBlock", "survival", "incoming-threat", "survive-one-block", "declared-attacker-and-block", "After the declared opponent Block attempt resolves, the evaluated player remains standing on the pitch; a cancelled Block still counts as standing and is separately identified.", "probability (0–1)", "probability", "higher"),
    "survival.damageChain": defineTaskContract("survival.damageChain", "survival", "incoming-damage-chain", "post-block-state", "declared-attacker-and-block", "Mutually exclusive post-action state distribution: standing, prone, stunned on pitch, or removed from pitch.", "state probability distribution", "distribution", "distribution"),
    "survival.currentFunction": defineTaskContract("survival.currentFunction", "survival", "next-activation-current-function", "block-then-reposition-at-next-activation", "one declared Block, fixed next-activation destination, exact post-hit state and team reroll policy", "After the declared opposing Block and all damage/turn-start effects resolve, the player can activate on its next team turn and move to the same declared objective square, finishing Standing without a Turnover. Standing up, Jump Up, activation availability, the complete movement/Rush chain, declared teammate Pick-me-up, and both teams' finite reroll pools are resolved by Bloodboard. This prototype measures only a reposition-to-square task; it does not represent every role objective such as scoring, passing, holding a control zone, or supporting another player.", "probability (0–1)", "probability", "higher"),
    "survival.returnToDrive": defineTaskContract("survival.returnToDrive", "survival", "time-horizon-availability", "available-by-drive-start", "declared-injury-and-horizon", "The player is eligible to take the field at the declared next-drive time horizon after the stated injury and recovery rules.", "probability by horizon (0–1)", "probability", "higher"),
    "survival.positionRetention": defineTaskContract("survival.positionRetention", "survival", "position-retention", "standing-at-assigned-square-after-block", "one-declared-adjacent-block; fixed opponent strength and support", "After the declared opposing Block, push resolution, and complete armour/injury chain, the evaluated player is still standing on its exact starting square. This is a fixed-position survival proxy; it does not claim that Strength cancels a selected Push or replace a role-specific follow-up task.", "probability (0–1)", "probability", "higher"),
    "survival.specialBackfire": defineTaskContract("survival.specialBackfire", "survival", "special-attack-self-harm", "special-attacker-down-or-removed", "same special attack, target, board and reroll policy as paired combat.specialAction", "On the same special-attack action tree, the attacker is knocked down, placed prone/stunned, or removed from the pitch by its own attack's adverse resolution (for example Chainsaw kick-back or Breathe Fire backfire). This is an immediate event probability, not the duration of lost availability or the frequency of choosing the action.", "probability (0–1)", "probability", "lower"),
    "control.static": defineTaskContract("control.static", "control", "static-lane-control", "safe-opponent-options", "declared-board-and-target", "Reduction in the opponent's legal safe routes to the declared target when the evaluated player occupies the stated square, compared with the same board with that player absent.", "safe-route count delta", "count-delta", "higher"),
    "control.staticPersistence": defineTaskContract("control.staticPersistence", "control", "static-anchor-persistence", "standing-player-in-local-control-zone-after-block-or-blitz", "stationary-anchor-vs-declared-strength-skills-and-bilateral-support", "After the declared opposing Block or Blitz, push, and complete armour/injury resolution, the evaluated player remains standing on the pitch within the declared radius-1 local control zone centered on its starting square; the opposing attacker's legal skills and each side's declared 0–2 standard ST3 assists are resolved by Bloodboard. Pushing the anchor one square within that zone still counts as retaining local area control.", "probability (0–1)", "probability", "higher"),
    "control.teamStaticCoverage": defineTaskContract("control.teamStaticCoverage", "control", "legal-formation-static-coverage", "unique-team-tackle-zone-squares-under-declared-threat-mixture", "validated-defensive-setup-and-weighted-adjacent-post-movement-threats", "For each declared adjacent opposing Block or Blitz scenario against its named defender in the same Bloodboard-validated legal opening formation, resolve every terminal state and report the probability-weighted number of distinct pitch squares adjacent to at least one standing, non-distracted defender. Aggregate scenario outcomes using the caller-declared normalized threat weights (uniform only when omitted). Tackle-zone overlap is counted once; occupied player squares and off-pitch squares are excluded. Bloodboard resolves the selected Block dice, the formation's actual defensive assists, skills, damage, and declared attacker reroll policy. A threat portfolio is a set of separate one-action scenarios, not a legal chained opponent turn or whole-match control score.", "expected unique tackle-zone square count", "count", "higher"),
    "control.dynamic": defineTaskContract("control.dynamic", "control", "dynamic-board-control", "marked-route-net-control-footprint", "declared-fixed-route-screen-and-start-rule-use", "After one Move Action and explicit activation cleanup (or an earlier Turnover/touchdown), report expected own-team unique Tackle Zone squares added minus expected opposing-team unique Tackle Zone squares added, each relative to the same initial board. Positive values mean a net spatial-control gain for the evaluated team. Bloodboard resolves the exact movement, Dodge, Rush, Turnover, start-rule target and terminal player states; a paired Star Rule comparison must use the identical board, route, player profiles, selected target and reroll pool, changing only whether the rule is used at activation start.", "expected net control-footprint square delta", "count-delta", "higher"),
    "control.supportDelta": defineTaskContract("control.supportDelta", "control", "team-support-contribution", "supported-task-delta", "declared-ally-opponent-and-task", "Difference in the ally's declared task-success probability with the evaluated player providing legal support versus the identical board without that support.", "probability delta (−1–1)", "probability-delta", "higher"),
    "control.actionEconomy": defineTaskContract("control.actionEconomy", "control", "opponent-action-economy", "actions-to-counter-control", "single-target-opponent-next-turn-activation", "Expected number of otherwise-available target activations denied in the target team's next Turn by a declared control effect; state checks exclude targets removed or stunned by the matched action.", "expected denied opposing activations", "count", "higher"),
    "control.specialPin": defineTaskContract("control.specialPin", "control", "special-action-position-lock", "monstrous-mouth-chomp-on-adjacent-standing-opponent", "declared-adjacent-standing-target-and-live-tackle-zone", "Resolve a legal Monstrous Mouth Special Action against an adjacent Standing opponent. Success requires the target to retain the engine's Chomp state while the evaluated player still Marks it, and the acting team has not suffered a Turnover. This measures the immediate positional lock, not target removal, denied activation count, duration, or team follow-up value.", "joint probability (0–1)", "probability", "higher"),
    "control.hypnoticGaze": defineTaskContract("control.hypnoticGaze", "control", "special-action-mark-disruption", "adjacent-standing-opponent-distracted-without-turnover", "declared-adjacent-standing-target-and-current-Gaze-holder", "Resolve a legal Hypnotic Gaze Special Action against one adjacent Standing opponent. The opponent must become Distracted and the acting team must avoid a Turnover. Report the target effect separately from downstream lane opening, denied activation duration and teammate follow-up; this is one declared opportunity, not a frequency-weighted control score.", "joint probability (0–1)", "probability", "higher"),
    "control.gazeTargetDistraction": defineTaskContract("control.gazeTargetDistraction", "control", "special-action-mark-disruption", "adjacent-standing-opponent-distracted", "declared-adjacent-standing-target-and-current-Gaze-holder", "Resolve the declared Hypnotic Gaze action and record whether the adjacent Standing opponent becomes Distracted, regardless of whether the acting team later suffers a Turnover. This is the immediate Tackle Zone denial event; it does not measure its duration or downstream tactical value.", "probability (0–1)", "probability", "higher"),
    "adaptability.roleCoverage": defineTaskContract("adaptability.roleCoverage", "adaptability", "role-task-evidence", "declared-role-objective-and-complete-action-sequence", "fixed-role-benchmark-with-explicit-opportunity-and-reroll-policy", "Each observation records the actual success event and complete task sequence for one named role benchmark. Preserve roleId, benchmarkId, board, player identities, support, opponent, rules and finite resources in its context; keep different role/task probabilities as separate observations and never average unlike tasks.", "probability (0–1) by declared role task", "probability", "higher"),
    "adaptability.teamImportance": defineTaskContract("adaptability.teamImportance", "teamImportance", "roster-removal-impact", "team-task-loss-after-reassignment", "fixed-roster-objective-and-substitute-policy", "Difference in the declared team task-success probability before and after removing this player, allowing remaining players to reassign roles and legal reserves or replacements to enter.", "team task success probability delta (−1–1)", "probability-delta", "higher", "context"),
    "reliability.activation": defineTaskContract("reliability.activation", "reliability", "activation-reliability", "declared-action-activation", "declared-trait-and-action", "Every declared input completes according to Bloodboard leaf.completed, including activation checks, action resolution and an explicit endActivation; an earlier own touchdown may terminate a cleanup-only tail. This is input-completion probability, not isolated trait-check success and not the probability of achieving a role objective.", "probability (0–1)", "probability", "higher", "cross-cutting"),
    "reliability.coreTask": defineTaskContract("reliability.coreTask", "reliability", "role-task-chain", "fixed-role-action-sequence", "declared-role-and-reroll-pool", "The declared fixed action sequence completes the role objective without a Turnover, carrying shared reroll resources across all branches.", "joint probability (0–1)", "probability", "higher", "cross-cutting"),
    "reliability.turnoverRisk": defineTaskContract("reliability.turnoverRisk", "reliability", "turnover-risk", "declared-core-task-turnover", "declared-role-and-reroll-pool", "Probability that the declared core task sequence ends in a Turnover.", "probability (0–1)", "probability", "lower", "cross-cutting"),
    "reliability.rerollBudget": defineTaskContract("reliability.rerollBudget", "reliability", "reroll-resource-use", "remaining-shared-rerolls", "declared-sequence-and-reroll-pool", "Probability distribution of the team's rerolls remaining after the declared action sequence terminates.", "remaining-reroll probability distribution", "distribution", "distribution", "cross-cutting"),
  });

  function canonicalJson(value, ancestors = new Set()) {
    if (Array.isArray(value)) {
      if (ancestors.has(value)) throw new TypeError("Task context cannot be circular.");
      const next = new Set(ancestors).add(value);
      return "[" + value.map(item => canonicalJson(item, next)).join(",") + "]";
    }
    if (value && typeof value === "object") {
      if (ancestors.has(value)) throw new TypeError("Task context cannot be circular.");
      const next = new Set(ancestors).add(value);
      return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(value[key], next)).join(",") + "}";
    }
    if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Task context numbers must be finite.");
    if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") throw new TypeError("Task context must contain JSON-safe values only.");
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError("Task context must contain JSON-safe values only.");
    return encoded;
  }

  function taskResultBounds(result, contract) {
    if (!result || typeof result !== "object") throw new TypeError("An engine result with explicit bounds is required.");
    if (contract.resultKind === "distribution") {
      const distribution = result.distribution;
      if (!distribution || typeof distribution !== "object" || Array.isArray(distribution) || !Object.keys(distribution).length) {
        throw new TypeError("This task requires a named outcome probability distribution.");
      }
      const entries = Object.entries(distribution).map(([id, value]) => {
        const lowerBound = typeof value === "number" ? value : Number(value && value.lowerBound);
        const upperBound = typeof value === "number" ? value : Number(value && value.upperBound);
        if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound) || lowerBound < 0 || upperBound > 1 || lowerBound > upperBound) {
          throw new RangeError("Distribution outcomes must have valid probability bounds in 0..1.");
        }
        return [id, { lowerBound, upperBound }];
      });
      const lowerMass = entries.reduce((sum, [, value]) => sum + value.lowerBound, 0);
      const unresolved = result.unresolved === undefined ? 0 : Number(result.unresolved);
      if (!Number.isFinite(unresolved) || unresolved < 0 || unresolved > 1) throw new RangeError("Distribution unresolved mass must be within 0..1.");
      const upperMass = entries.reduce((sum, [, value]) => sum + value.upperBound, 0) + unresolved;
      if (lowerMass > 1 + 1e-9 || upperMass < 1 - 1e-9) throw new RangeError("Outcome bounds must be capable of covering total probability mass 1.");
      if (result.exact && (Math.abs(lowerMass - 1) > 1e-9 || entries.some(([, value]) => Math.abs(value.upperBound - value.lowerBound) > 1e-12))) {
        throw new RangeError("An exact outcome distribution must have exact component probabilities that sum to 1.");
      }
      return { value: null, lowerBound: null, upperBound: null, exact: !!result.exact, unresolved, distribution: Object.fromEntries(entries) };
    }
    const min = contract.resultKind === "probability" || contract.resultKind === "index" || contract.resultKind === "count" ? 0 : contract.resultKind === "probability-delta" ? -1 : contract.resultKind === "count-delta" ? -Infinity : 0;
    const max = contract.resultKind === "probability" || contract.resultKind === "probability-delta" ? 1 : contract.resultKind === "index" ? 100 : Infinity;
    const exact = result.exact === true;
    const unresolved = result.unresolved === undefined ? 0 : Number(result.unresolved);
    if (!Number.isFinite(unresolved) || unresolved < 0 || unresolved > 1 || exact && unresolved > 1e-12) {
      throw new RangeError("Task unresolved probability mass must be within 0..1, and exact results must have none.");
    }
    let lowerBound = result.lowerBound;
    let upperBound = result.upperBound;
    const value = result.value;
    if (exact && lowerBound === undefined && upperBound === undefined && Number.isFinite(value)) {
      lowerBound = value;
      upperBound = value;
    }
    if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound) || lowerBound > upperBound || lowerBound < min || upperBound > max) {
      throw new RangeError("Task results need finite, ordered bounds within the contract's domain.");
    }
    if (exact && Math.abs(lowerBound - upperBound) > 1e-12) throw new RangeError("Exact task results must have identical lower and upper bounds.");
    if (!exact && value !== undefined && value !== null) throw new Error("Partial task results must keep their interval and must not report a collapsed point value.");
    if (value !== undefined && value !== null && (!Number.isFinite(value) || value < lowerBound || value > upperBound)) {
      throw new RangeError("A reported point value must lie inside its probability bounds.");
    }
    return { value: value === undefined ? (exact ? lowerBound : null) : value, lowerBound, upperBound, exact, unresolved };
  }

  function recordTaskResult({ submetricId, subjectId, result, context, provenance } = {}) {
    const contract = TASK_CONTRACTS[submetricId];
    if (!contract) throw new Error("Unknown V3 task submetric: " + submetricId);
    if (contract.implementationStatus === "planned") throw new Error("The task has a defined outcome but no implemented engine scenario yet: " + submetricId);
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A subjectId is required; subject identity is not part of the benchmark context.");
    if (!context || typeof context !== "object" || Array.isArray(context)) throw new TypeError("The full benchmark context is required.");
    const missing = contract.requiredContext.filter(key => !Object.prototype.hasOwnProperty.call(context, key));
    if (missing.length) throw new Error("Missing required task context: " + missing.join(", "));
    if (context.format !== "11s" && context.format !== "sevens") throw new RangeError("Task format must be '11s' or 'sevens'.");
    if (context.boardState === null) throw new TypeError("boardState must identify the initial board; use explicit empty/no-opponent values inside it.");
    if (!Number.isInteger(context.rerollPool) || context.rerollPool < 0) throw new RangeError("rerollPool must be a non-negative integer.");
    if (!context.taskParameters || typeof context.taskParameters !== "object" || Array.isArray(context.taskParameters)) throw new TypeError("taskParameters must be an object.");
    if (!context.event || typeof context.event !== "object") throw new TypeError("The exact engine terminal event must be stored with the result.");
    const expectedEngine = window.BB_BLOODBOARD_ENGINE && window.BB_BLOODBOARD_ENGINE.META;
    if (!expectedEngine) throw new Error("Bloodboard engine metadata is required to record a V3 task result.");
    if (!provenance || provenance.engineId !== expectedEngine.id || provenance.engineVersion !== expectedEngine.version || provenance.engineSha256 !== expectedEngine.sha256 || typeof provenance.api !== "string" || !provenance.api.trim()) {
      throw new Error("Task provenance must match the loaded Bloodboard engine id, version, SHA-256 and adapter API.");
    }
    const measures = taskResultBounds(result, contract);
    const taskContext = JSON.parse(canonicalJson(context));
    const benchmark = {
      submetricId,
      taskFamily: contract.taskFamily,
      benchmarkId: contract.benchmarkId,
      difficultyTier: contract.difficultyTier,
      event: contract.event,
      unit: contract.unit,
      resultKind: contract.resultKind,
      direction: contract.direction,
      format: context.format,
      context: taskContext,
      rules: { id: expectedEngine.id, version: expectedEngine.version, sha256: expectedEngine.sha256 }
    };
    return Object.assign({
      subjectId,
      axisId: contract.axisId,
      taskKey: canonicalJson(benchmark),
      status: "observed",
      provenance: { engineId: expectedEngine.id, engineVersion: expectedEngine.version, engineSha256: expectedEngine.sha256, api: provenance.api }
    }, benchmark, measures);
  }

  function compareTaskResults(before, after) {
    if (!before || !after || before.submetricId !== after.submetricId || before.taskKey !== after.taskKey) {
      throw new Error("Task results are comparable only when they share the exact submetric, benchmark difficulty, context, event and rules version.");
    }
    if (before.resultKind === "distribution" || before.lowerBound === null || after.lowerBound === null) {
      throw new Error("Distribution-valued or unbounded task results must remain separate; no scalar delta is defined.");
    }
    const raw = {
      lowerBound: after.lowerBound - before.upperBound,
      upperBound: after.upperBound - before.lowerBound,
      exact: before.exact && after.exact
    };
    const sign = before.direction === "lower" ? -1 : 1;
    return {
      submetricId: before.submetricId,
      taskFamily: before.taskFamily,
      unit: before.unit,
      comparison: "after minus before under the same benchmark",
      rawDelta: raw,
      favorableDelta: {
        lowerBound: sign === 1 ? raw.lowerBound : -raw.upperBound,
        upperBound: sign === 1 ? raw.upperBound : -raw.lowerBound,
        exact: raw.exact
      },
      percentagePointDelta: before.resultKind === "probability" || before.resultKind === "probability-delta"
        ? { lowerBound: raw.lowerBound * 100, upperBound: raw.upperBound * 100, exact: raw.exact }
        : null
    };
  }

  function buildTaskProfile(subjectId, observations = [], subjectProfile = null) {
    if (!Array.isArray(observations)) throw new TypeError("Task observations must be an array.");
    if (subjectProfile !== null && (!subjectProfile || typeof subjectProfile !== "object" || Array.isArray(subjectProfile))) {
      throw new TypeError("Subject profile must be an object when supplied.");
    }
    const accepted = observations.map(observation => {
      const contract = observation && TASK_CONTRACTS[observation.submetricId];
      if (!contract || observation.subjectId !== subjectId || observation.axisId !== contract.axisId || observation.taskFamily !== contract.taskFamily || observation.unit !== contract.unit || observation.resultKind !== contract.resultKind) {
        throw new Error("A V3 task profile accepts only lineage-complete observations for the requested subject.");
      }
      return observation;
    });
    const buildGroup = group => {
      const metrics = group.submetrics.map(submetricId => {
        const contract = TASK_CONTRACTS[submetricId];
        const measurements = accepted.filter(observation => observation.submetricId === submetricId);
        return {
          submetricId,
          event: contract.event,
          unit: contract.unit,
          status: !measurements.length ? "not-measured" : measurements.every(item => item.exact) ? "observed-exactly" : "observed-with-bounds",
          value: measurements.length === 1 ? measurements[0].value : null,
          measurements
        };
      });
      const observedCount = metrics.filter(metric => metric.measurements.length > 0).length;
      return {
        id: group.id,
        label: group.label,
        labelZh: group.labelZh,
        score: null,
        grade: null,
        status: observedCount === 0 ? "no-task-data" : "task-data-only; axis-calibration-pending",
        coverage: { observedSubmetrics: observedCount, totalSubmetrics: metrics.length },
        submetrics: metrics
      };
    };
    const skillIds = new Set((subjectProfile && Array.isArray(subjectProfile.skills) ? subjectProfile.skills : [])
      .map(skill => typeof skill === "string" ? skill : skill && skill.id).filter(Boolean));
    const axisConstraints = skillIds.has("noBall") ? [
      { axisId: "mobility", scoreCeiling: 0, gradeCeiling: "E", ruleId: "noBall", reason: "不能持球，因此快攻汇总维度固定为最低档；无球移动结果仍单独保留。" },
      { axisId: "ball", scoreCeiling: 0, gradeCeiling: "E", ruleId: "noBall", reason: "不能取得或持有球，因此控球汇总维度固定为最低档。" }
    ] : [];
    const constraintsByAxis = new Map(axisConstraints.map(constraint => [constraint.axisId, constraint]));
    const axes = AXES.map(group => {
      const result = buildGroup(group);
      const hardCeiling = constraintsByAxis.get(group.id);
      return hardCeiling ? { ...result, hardCeiling } : result;
    });
    const crossCutting = CROSS_CUTTING_FACTORS.map(buildGroup);
    const contextMetrics = CONTEXT_METRICS.map(buildGroup);
    return {
      subjectId,
      source: "Bloodboard V5 task observations only; legacy scorePlayer values are excluded",
      status: "incomplete-un-calibrated",
      calibratedScore: null,
      axes,
      axisConstraints,
      crossCutting,
      contextMetrics
    };
  }

  function evaluatePlayerCombatTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    opponent = { name: "Reference opponent", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    weather = "perfect",
    ballCarrier = "none",
    teamRerolls = 1,
    starRule = false,
    starTarget,
    row,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateOneOnOneBlock || !engine.evaluateTerminalEvent) {
      throw new Error("Bloodboard block and terminal-event APIs are required for combat task observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    const canonicalStarId = engine.resolveStarId?.(player) || null;
    const hasSpecialRules = Array.isArray(player.specialRules)
      ? player.specialRules.length > 0
      : player.specialRules && typeof player.specialRules === "object"
        ? Object.keys(player.specialRules).length > 0
        : String(player.specialRules || "").trim().length > 0;
    const hasSpecialEffects = Array.isArray(player.specialEffectCodes)
      ? player.specialEffectCodes.length > 0
      : !!player.specialEffectCodes;
    if ((hasSpecialRules || hasSpecialEffects) && !canonicalStarId) {
      throw new Error("This combat task has Star Player effects but no canonical star identity; Bloodboard cannot resolve translated rule text or effect labels by themselves.");
    }
    const skills = (player.skills || []).slice();
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === boughtSkillId)) skills.push(boughtSkillId);
    }
    const evaluatedPlayer = Object.assign({}, player, { skills, ...(canonicalStarId ? { star: canonicalStarId } : {}) });
    const block = engine.calculateOneOnOneBlock({
      attacker: evaluatedPlayer,
      defender: opponent,
      ballCarrier,
      format,
      weather,
      teamRerolls,
      starRule,
      starTarget,
      row,
      planOptions
    });
    if (!block.summary || !block.summary.legal) {
      throw new Error("Bloodboard rejected the combat benchmark: " + JSON.stringify(block.summary && block.summary.errors || []));
    }

    const attackerId = block.scenario.attacker.id;
    const defenderId = block.scenario.defender.id;
    const events = {
      knockdown: {
        type: "anyOf",
        events: [
          { type: "playerProne", playerId: defenderId },
          { type: "playerStunned", playerId: defenderId },
          { type: "playerRemoved", playerId: defenderId }
        ]
      },
      safeRemoval: {
        type: "allOf",
        events: [
          { type: "playerRemoved", playerId: defenderId },
          { type: "noTurnover" }
        ]
      },
      unsafeRemoval: {
        type: "allOf",
        events: [
          { type: "playerRemoved", playerId: defenderId },
          { type: "turnover" }
        ]
      }
    };
    const terminalOptions = Object.fromEntries(Object.entries(planOptions || {})
      .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));
    const terminalResults = Object.fromEntries(Object.entries(events).map(([id, event]) => [id,
      engine.evaluateTerminalEvent({ state: block.replay.state, input: block.replay.input, timepoint: "activation-ended", event, options: terminalOptions })
    ]));
    const branches = teamRerolls > 0
      ? ["withoutTeamRerolls", "withTeamRerolls"]
      : ["withoutTeamRerolls"];
    const observations = [];
    const diagnostics = {};
    const eventForBlockDistribution = {
      type: "selectedBlockResultDistribution",
      attackerId,
      defenderId,
      resultSource: "Bloodboard summary.blockResult"
    };
    const commonBoardState = {
      scenario: "one-on-one-block",
      weather,
      attackerAt: block.scenario.attackerAt,
      defenderAt: block.scenario.defenderAt,
      ballCarrier,
      crowdPushRoute: false,
      followUp: false
    };
    const commonTaskParameters = {
      action: "Block",
      blockChoicePolicy: "Bloodboard default legal-result chooser",
      planOptions: JSON.parse(JSON.stringify(planOptions || {})),
      scenarioRerollPool: teamRerolls,
      starRuleUse: block.scenario.starRuleUse,
      attackerSlot: attackerId,
      defenderSlot: defenderId
    };

    branches.forEach(branch => {
      const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
      const rerollPolicy = allowedRerolls > 0 ? "Bloodboard may spend the declared team pool" : "team rerolls unavailable";
      const contextFor = (event, timepoint = "input-resolved") => ({
        format,
        boardState: commonBoardState,
        opponentProfile: block.scenario.defender.profile,
        supportState: { attackerAssists: 0, defenderAssists: 0, crowdPushRoute: false },
        rerollPool: allowedRerolls,
        taskParameters: Object.assign({}, commonTaskParameters, { rerollPolicy, timepoint }),
        event
      });
      const blockSummary = block.summary[branch];
      const blockDistribution = blockSummary.blockResult;
      const distributionObservation = recordTaskResult({
        submetricId: "combat.blockAdvantage",
        subjectId,
        result: {
          distribution: blockDistribution,
          unresolved: blockSummary.unresolved,
          exact: blockSummary.unresolved <= 1e-12
        },
        context: contextFor(eventForBlockDistribution),
        provenance: {
          engineId: block.engine.id,
          engineVersion: block.engine.version,
          engineSha256: block.engine.sha256,
          api: "calculateOneOnOneBlock"
        }
      });
      observations.push(distributionObservation);

      for (const [submetricId, eventId] of [["combat.knockdown", "knockdown"], ["combat.removal", "safeRemoval"]]) {
        const terminal = terminalResults[eventId][branch];
        const observation = recordTaskResult({
          submetricId,
          subjectId,
          result: {
            lowerBound: terminal.successProbability.lowerBound,
            upperBound: terminal.successProbability.upperBound,
            exact: terminal.successProbability.exact,
            unresolved: terminal.unresolved
          },
          context: contextFor(events[eventId], "activation-ended"),
          provenance: {
            engineId: block.engine.id,
            engineVersion: block.engine.version,
            engineSha256: block.engine.sha256,
            api: "calculateOneOnOneBlock+evaluateTerminalEvent"
          }
        });
        observations.push(observation);
      }
      diagnostics[branch] = Object.fromEntries(Object.entries(terminalResults).map(([eventId, evaluation]) => [eventId, evaluation[branch].successProbability]));
    });

    return {
      subjectId,
      engine: block.engine,
      scenario: block.scenario,
      status: "engine-observed; one-on-one benchmark only; axis calibration pending",
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      diagnostics: {
        ...diagnostics,
        starRuleUse: {
          requested: !!starRule,
          target: starTarget || null,
          appliedEvents: (block.plan?.traceEvents || []).filter(event => canonicalStarId && event.data?.star === canonicalStarId)
            .map(event => ({ type: event.type, text: event.text, rule: event.rule || null, data: event.data || null })),
          verification: starRule
            ? "Inspect engine PlanResult trace; requested is not equivalent to applied."
            : "Optional activation-start rule not requested; automatic/passive effects may still resolve by canonical identity."
        },
        unsafeRemovalEvent: events.unsafeRemoval,
        limitation: "The benchmark has no assists, crowd-push lane, follow-up action, or team tactics. Star identity enables engine-resolved automatic effects; optional activation-start rules require an explicit request and a legal trigger/target."
      }
    };
  }

  function evaluatePlayerBallAcquisitionTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    pickupMethod = "agility",
    pressure = "open",
    weather = "perfect",
    teamRerolls = 0,
    starRule = false,
    row,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateBallAcquisition) throw new Error("Bloodboard's ball-acquisition task API is required.");
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (typeof starRule !== "boolean") throw new TypeError("starRule must be a boolean.");
    const canonicalStarId = engine.resolveStarId?.(player) || null;
    const result = engine.calculateBallAcquisition({
      player: Object.assign({}, player, canonicalStarId ? { star: canonicalStarId } : {}),
      format,
      pickupMethod,
      pressure,
      weather,
      teamRerolls,
      starRule,
      row,
      planOptions
    });
    if (!result.summary?.legal) throw new Error("Bloodboard rejected the declared ball-acquisition task: " + JSON.stringify(result.summary?.errors || []));
    const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const observations = branches.map(branch => {
      const outcome = result.safeTaskOutcomes[branch];
      const probability = outcome.successProbability;
      return recordTaskResult({
        submetricId: "ball.acquisition",
        subjectId,
        result: {
          lowerBound: probability.lowerBound,
          upperBound: probability.upperBound,
          exact: probability.exact,
          unresolved: outcome.unresolved
        },
        context: {
          format,
          boardState: {
            scenario: "single-ground-ball-acquisition",
            weather,
            ball: result.scenario.ballAt,
            actor: result.scenario.actorAt,
            marker: result.scenario.opponentAt,
            starRuleUse: result.scenario.starRuleUse
          },
          opponentProfile: pressure === "marked" ? { pressure, profile: result.scenario.markerProfile || null } : { pressure },
          supportState: { teammates: [] },
          rerollPool: branch === "withTeamRerolls" ? teamRerolls : 0,
          taskParameters: {
            pickupMethod,
            action: result.replay.input.action,
            path: result.replay.input.path,
            weather,
            canonicalStarId,
            starRuleRequested: starRule,
            timepoint: "activation-ended",
            rerollPolicy: branch === "withTeamRerolls" ? "Bloodboard may spend the declared team reroll pool" : "team rerolls unavailable",
            event: "acting player holds the ball and the active team has not suffered a Turnover"
          },
          event: result.safeTaskOutcomes.event
        },
        provenance: {
          engineId: result.engine.id,
          engineVersion: result.engine.version,
          engineSha256: result.engine.sha256,
          api: "calculateBallAcquisition+evaluateTerminalEvent"
        }
      });
    });
    const appliedEvents = (result.plan?.traceEvents || []).filter(event => canonicalStarId && event.data?.star === canonicalStarId)
      .map(event => ({ type: event.type, text: event.text, rule: event.rule || null, data: event.data || null }));
    return {
      subjectId,
      engine: result.engine,
      status: "engine-observed; single ground-ball task; axis calibration pending",
      scenario: result.scenario,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      diagnostics: {
        starRuleUse: { requested: starRule, appliedEvents },
        ordinaryPickupOutcomes: result.taskOutcomes,
        safeAcquisitionOutcomes: result.safeTaskOutcomes,
        limitation: "One adjacent ground-ball action only; does not estimate the frequency of this ball state, later carrier protection, or team roster value."
      }
    };
  }

  function evaluatePlayerOpponentActivationDenialTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    weather = "perfect",
    teamRerolls = 0,
    row,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine?.calculateOpponentActivationDenial) throw new Error("Bloodboard's opponent-activation-denial task API is required.");
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (engine.resolveStarId?.(player) !== "estelle") throw new Error("This task currently models canonical Estelle la Veneaux only.");
    if ((player.starUsed || []).length) throw new Error("Baleful Hex task comparison requires a fresh, unused once-per-game rule.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    const ordinary = engine.calculateOpponentActivationDenial({ attacker: player, format, weather, teamRerolls, starRule: false, row, planOptions });
    const withHex = engine.calculateOpponentActivationDenial({ attacker: player, format, weather, teamRerolls, starRule: true, row, planOptions });
    const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const observations = [];
    const comparisons = {};
    for (const branch of branches) {
      const ordinaryProbability = ordinary.deniedActivation[branch].successProbability;
      const hexProbability = withHex.deniedActivation[branch].successProbability;
      const commonContext = {
        format,
        boardState: {
          scenario: ordinary.scenario.id,
          weather,
          layout: "Estelle starts adjacent to the standing target at the center lane",
          targetStartsStanding: true,
          targetTeamTurn: "next"
        },
        opponentProfile: ordinary.scenario.target.profile,
        supportState: { teammates: [] },
        rerollPool: branch === "withTeamRerolls" ? teamRerolls : 0,
        taskParameters: {
          action: "block",
          comparison: "same Estelle, target, board and Block Action; toggle only fresh Baleful Hex request",
          probabilityUnit: "expected otherwise-available target activations denied (maximum one)",
          timepoint: "activation-ended",
          rerollPolicy: branch === "withTeamRerolls" ? "Bloodboard may spend the declared team reroll pool" : "team rerolls unavailable"
        },
        event: withHex.taskEvent
      };
      const baseObservation = recordTaskResult({
        submetricId: "control.actionEconomy",
        subjectId,
        result: { lowerBound: ordinaryProbability.lowerBound, upperBound: ordinaryProbability.upperBound, exact: ordinaryProbability.exact, unresolved: ordinary.deniedActivation[branch].unresolved },
        context: commonContext,
        provenance: { engineId: ordinary.engine.id, engineVersion: ordinary.engine.version, engineSha256: ordinary.engine.sha256, api: "calculateOpponentActivationDenial+evaluateTerminalEvent" }
      });
      const hexObservation = recordTaskResult({
        submetricId: "control.actionEconomy",
        subjectId,
        result: { lowerBound: hexProbability.lowerBound, upperBound: hexProbability.upperBound, exact: hexProbability.exact, unresolved: withHex.deniedActivation[branch].unresolved },
        context: commonContext,
        provenance: { engineId: withHex.engine.id, engineVersion: withHex.engine.version, engineSha256: withHex.engine.sha256, api: "calculateOpponentActivationDenial+evaluateTerminalEvent" }
      });
      observations.push({ branch, ruleUsed: false, ...baseObservation }, { branch, ruleUsed: true, ...hexObservation });
      comparisons[branch] = compareTaskResults(baseObservation, hexObservation);
    }
    const appliedEvents = (withHex.plan?.traceEvents || []).filter(event => event.data?.star === "estelle")
      .map(event => ({ type: event.type, text: event.text, rule: event.rule || null, data: event.data || null }));
    return {
      subjectId,
      engine: withHex.engine,
      status: "engine-observed; single-target conditional activation-denial task; calibration pending",
      scenario: withHex.scenario,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations.filter(observation => observation.ruleUsed)),
      pairedDeltas: comparisons,
      diagnostics: {
        starRuleUse: { requested: true, appliedEvents },
        ordinary: { denial: ordinary.deniedActivation, turnover: ordinary.blockSummary.withoutTeamRerolls.turnover },
        withRule: { denial: withHex.deniedActivation, turnover: withHex.blockSummary.withoutTeamRerolls.turnover },
        limitation: "One adjacent target and one declared Block Action; counts whether this target would otherwise be eligible for its next activation, not whether the opponent would choose it or the rule's game-wide opportunity frequency."
      }
    };
  }

  function evaluatePlayerCurrentFunctionTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    opponent = { name: "Reference blocker", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    attackerSide = "left",
    defenderSupporters = [],
    attackerTeamRerolls = 0,
    defenderTeamRerolls = 0,
    starRule = false,
    starTarget,
    weather = "perfect",
    row,
    destination,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateCurrentFunctionAfterBlock) {
      throw new Error("Bloodboard's block-to-next-activation task API is required for current-function observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!opponent || typeof opponent !== "object") throw new TypeError("A declared opposing blocker profile is required.");
    if (!Array.isArray(defenderSupporters)) throw new TypeError("defenderSupporters must be a declared array of teammate profiles and squares.");
    if (!Number.isInteger(attackerTeamRerolls) || attackerTeamRerolls < 0 || !Number.isInteger(defenderTeamRerolls) || defenderTeamRerolls < 0) {
      throw new RangeError("Both teams' declared reroll pools must be non-negative integers.");
    }
    const playerStarId = engine.resolveStarId?.(player) || null;
    const skills = (player.skills || []).slice();
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === boughtSkillId)) skills.push(boughtSkillId);
    }
    const evaluatedPlayer = Object.assign({}, player, { skills }, playerStarId ? { star: playerStarId } : {});
    const result = engine.calculateCurrentFunctionAfterBlock({
      attacker: opponent,
      defender: evaluatedPlayer,
      defenderSupporters,
      attackerSide,
      format,
      weather,
      attackerTeamRerolls,
      defenderTeamRerolls,
      starRule,
      starTarget,
      row,
      destination,
      planOptions
    });
    const policies = result.policies;
    const branches = attackerTeamRerolls + defenderTeamRerolls > 0
      ? ["withoutTeamRerolls", "withDeclaredTeamRerolls"]
      : ["withoutTeamRerolls"];
    const observations = branches.map(branch => {
      const policy = policies[branch];
      const probability = policy.afterIncomingBlock;
      return recordTaskResult({
        submetricId: "survival.currentFunction",
        subjectId,
        result: {
          lowerBound: probability.lowerBound,
          upperBound: probability.upperBound,
          exact: probability.exact,
          unresolved: policy.unresolved
        },
        context: {
          format,
          boardState: {
            scenario: "one-block-then-reposition-next-activation",
            weather,
            attackerAt: result.scenario.attackerAt,
            defenderAt: result.scenario.defenderAt,
            attackerSide: result.scenario.attackerSide,
            destination: result.scenario.task.destination,
            startingStance: "standing",
            ballState: "not-in-play"
          },
          opponentProfile: result.scenario.attacker.profile,
          supportState: {
            attackerAssists: 0,
            defenderAssists: 0,
            defenderSupporters: result.scenario.defenderSupporters
          },
          rerollPool: branch === "withDeclaredTeamRerolls" ? attackerTeamRerolls + defenderTeamRerolls : 0,
          taskParameters: {
            task: "next activation moves to the same declared objective square and finishes standing without a Turnover",
            starRuleUse: result.scenario.starRuleUse,
            objective: result.scenario.task.destination,
            opponentAction: "one declared Block",
            attackerTeamRerolls: branch === "withDeclaredTeamRerolls" ? attackerTeamRerolls : 0,
            defenderTeamRerolls: branch === "withDeclaredTeamRerolls" ? defenderTeamRerolls : 0,
            rerollPolicy: branch === "withDeclaredTeamRerolls"
              ? "Bloodboard may spend each team's declared shared reroll pool on its own actions"
              : "neither team has access to team rerolls",
            taskPolicy: "Bloodboard safestRoute chooses from this exact next-turn state; stand-up, Jump Up, movement, Rush, team rerolls and Turnover are resolved by Bloodboard",
            timepoint: result.scenario.task.timepoint,
            turnPolicy: result.scenario.turnPolicy
          },
          event: result.scenario.task.successEvent
        },
        provenance: {
          engineId: engine.META.id,
          engineVersion: engine.META.version,
          engineSha256: engine.META.sha256,
          api: "calculateCurrentFunctionAfterBlock"
        }
      });
    });
    return {
      subjectId,
      engine: engine.META,
      status: "engine-observed; reposition-to-square task only; broader role tasks and calibration pending",
      scenario: result.scenario,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      diagnostics: Object.fromEntries(branches.map(branch => [branch, {
        noHitBaseline: policies[branch].noHitBaseline,
        afterIncomingBlock: policies[branch].afterIncomingBlock,
        deltaFromNoHitBaseline: policies[branch].deltaFromNoHitBaseline,
        actionAvailableProbability: policies[branch].actionAvailableProbability,
        taskTurnoverProbability: policies[branch].taskTurnoverProbability,
        nextTurnStateDistribution: policies[branch].nextTurnStateDistribution,
        unresolved: policies[branch].unresolved,
        errors: policies[branch].errors
      }]))
    };
  }

  function evaluatePlayerFoulTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    target = { name: "Reference prone target", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    targetStance = "prone",
    weather = "perfect",
    teamRerolls = 0,
    foulerAssists = 0,
    targetAssists = 0,
    useChainsaw = false,
    row,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateOneOnOneFoul || !engine.evaluateTerminalEvent) {
      throw new Error("Bloodboard foul and terminal-event APIs are required for foul task observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    const canonicalStarId = engine.resolveStarId?.(player) || null;
    const hasSpecialRules = Array.isArray(player.specialRules)
      ? player.specialRules.length > 0
      : player.specialRules && typeof player.specialRules === "object"
        ? Object.keys(player.specialRules).length > 0
        : String(player.specialRules || "").trim().length > 0;
    const hasSpecialEffects = Array.isArray(player.specialEffectCodes)
      ? player.specialEffectCodes.length > 0
      : !!player.specialEffectCodes;
    if ((hasSpecialRules || hasSpecialEffects) && !canonicalStarId) {
      throw new Error("This foul task has specialRules/specialEffectCodes but no canonical Star Player identity; Bloodboard cannot resolve the rule text by itself.");
    }
    const skills = (player.skills || []).slice();
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === boughtSkillId)) skills.push(boughtSkillId);
    }
    const evaluatedPlayer = Object.assign({}, player, { skills, ...(canonicalStarId ? { star: canonicalStarId } : {}) });
    const foul = engine.calculateOneOnOneFoul({
      fouler: evaluatedPlayer,
      target,
      targetStance,
      format,
      weather,
      teamRerolls,
      foulerAssists,
      targetAssists,
      useChainsaw,
      row,
      planOptions
    });
    if (!foul.summary || !foul.summary.legal) {
      throw new Error("Bloodboard rejected the foul benchmark: " + JSON.stringify(foul.summary && foul.summary.errors || []));
    }
    const events = foul.events;
    const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const terminalOptions = Object.fromEntries(Object.entries(planOptions || {})
      .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));
    const observations = [];
    const diagnostics = {};
    branches.forEach(branch => {
      const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
      const safeRemoval = foul.outcomes[branch].safeTargetRemoval;
      const observation = recordTaskResult({
        submetricId: "combat.foulRemoval",
        subjectId,
        result: {
          lowerBound: safeRemoval.lowerBound,
          upperBound: safeRemoval.upperBound,
          exact: safeRemoval.exact,
          unresolved: safeRemoval.exact ? 0 : Math.max(0, safeRemoval.upperBound - safeRemoval.lowerBound)
        },
        context: {
          format,
          boardState: {
            scenario: "one-fouler-adjacent-to-prone-target",
            foulerAt: foul.scenario.foulerAt,
            targetAt: foul.scenario.targetAt,
            targetStance,
            targetMustAlreadyBeDown: true
          },
          opponentProfile: foul.scenario.target.profile,
          supportState: { foulerAssists, targetAssists },
          rerollPool: allowedRerolls,
          taskParameters: {
              timepoint: "activation-ended; stop at earlier Turnover or touchdown",
            action: "Foul Action",
            canonicalStarId,
            useChainsaw,
            targetCondition: targetStance,
            rerollPolicy: allowedRerolls ? "Bloodboard may spend the declared team pool if a legal reroll is available" : "team rerolls unavailable",
            ruleChoicePolicy: "Bloodboard default plan policy; any triggered coach decisions follow that policy",
            noInducements: true,
            noPriorTeamFoul: true
          },
          event: events.safeTargetRemoval
        },
        provenance: {
          engineId: foul.engine.id,
          engineVersion: foul.engine.version,
          engineSha256: foul.engine.sha256,
          api: "calculateOneOnOneFoul+evaluateTerminalEvent"
        }
      });
      observations.push(observation);
      diagnostics[branch] = Object.fromEntries(Object.entries(foul.outcomes[branch]).map(([id, probability]) => [id, probability]));
    });
    return {
      subjectId,
      engine: foul.engine,
      scenario: foul.scenario,
      status: "engine-observed; conditional prone-target foul only; opportunity-generation-and-team-economy-pending",
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      diagnostics: {
        ...diagnostics,
        eventDefinitions: events,
        limitation: "This measures one Foul Action after a target is already Prone or Stunned. Canonical Star identity enables Bloodboard-resolved automatic effects; this task does not request optional activation-start Star rules. It does not include the action sequence that creates a foul target, repeated team foul opportunities, player cost, replacement value, team-specific extra fouls, inducements, or matchup frequency."
      }
    };
  }

  function evaluateTeamBlockFoulTasks({
    subjectId,
    blocker,
    fouler,
    extraFouler = null,
    target = { name: "Reference target", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    format = "11s",
    weather = "perfect",
    teamRerolls = 0,
    teamSpecialRules = [],
    teamRosterId = null,
    bribes = 0,
    useChainsaw = false,
    row,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateBlockThenFoul !== "function") {
      throw new Error("Bloodboard's conditional team Block-then-Foul API is required for team kill-chain observations.");
    }
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!blocker || typeof blocker !== "object" || !fouler || typeof fouler !== "object") {
      throw new TypeError("Both a blocker and a separate fouler profile are required.");
    }
    const withCanonicalStar = (player, role) => {
      if (!player) return null;
      const hasRules = ["specialRules", "specialEffectCodes", "specialEffects"].some(key => {
        const value = player[key];
        return Array.isArray(value) ? value.length > 0 : !!value;
      });
      const starId = engine.resolveStarId?.(player) || null;
      if (hasRules && !starId) {
        throw new Error(`${role} declares Star Player rules without a matching canonical Star Player identity; translated rule text cannot be applied by itself.`);
      }
      return starId && !player.star ? { ...player, star: starId } : player;
    };
    blocker = withCanonicalStar(blocker, "The team-chain blocker");
    fouler = withCanonicalStar(fouler, "The team-chain fouler");
    extraFouler = withCanonicalStar(extraFouler, "The extra team-chain fouler");
    const includeBoughtSkill = player => {
      const skills = (player.skills || []).slice();
      if (player.boughtSkill) {
        const skillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
        if (skillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === skillId)) skills.push(skillId);
      }
      return Object.assign({}, player, { skills });
    };
    const result = engine.calculateBlockThenFoul({
      blocker: includeBoughtSkill(blocker),
      fouler: includeBoughtSkill(fouler),
      extraFouler: extraFouler ? includeBoughtSkill(extraFouler) : null,
      target,
      format,
      weather,
      teamRerolls,
      teamSpecialRules,
      teamRosterId,
      bribes,
      useChainsaw,
      row,
      planOptions
    });
    if (!result.status.startsWith("engine-enumerated-") || !result.rerollPolicies.withoutTeamRerolls?.legal) {
      throw new Error("Bloodboard rejected the team kill-chain benchmark: " + JSON.stringify(result.rerollPolicies));
    }
    const observations = [];
    const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const event = {
      type: "allOf",
      events: [
        { type: "playerRemoved", playerId: result.scenario.target.id },
        { type: "noTurnover" }
      ]
    };
    branches.forEach(branch => {
      const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
      const outcome = result.rerollPolicies[branch].outcomes.safeRemovalByChain;
      const observation = recordTaskResult({
        submetricId: "combat.teamFoulChain",
        subjectId,
        result: {
          lowerBound: outcome.lowerBound,
          upperBound: outcome.upperBound,
          exact: outcome.exact,
          unresolved: outcome.upperBound - outcome.lowerBound
        },
        context: {
          format,
          boardState: {
            scenario: result.scenario.id,
            blockerAt: result.scenario.blocker.at,
            foulerAt: result.scenario.fouler.at,
            extraFoulerAt: result.scenario.extraFouler?.at || null,
            targetAt: result.scenario.target.at,
            targetStartsStanding: true,
            actionOrder: result.scenario.actions.map(input => input.action === "block" ? "Block" : input.playerId === result.scenario.extraFouler?.id ? "if legal, second Foul Action (Black Gobbo team rule)" : "if legal, Foul Action")
          },
          opponentProfile: result.scenario.target.profile,
          supportState: { declaredBlockAssists: 0, declaredFoulAssists: 0, targetAssists: 0 },
          rerollPool: allowedRerolls,
          taskParameters: {
              timepoint: "activation-ended; stop at earlier Turnover or touchdown",
            blockerProfile: result.scenario.blocker.profile,
            foulerProfile: result.scenario.fouler.profile,
            extraFoulerProfile: result.scenario.extraFouler?.profile || null,
            initialTeamRerolls: teamRerolls,
            rerollPolicy: allowedRerolls > 0
              ? "Bloodboard may spend from the same team pool across Block and the conditional Foul Action"
              : "team rerolls are unavailable to both actions",
            inducements: bribes > 0 ? [{ id: "bribe", count: bribes }] : [],
            bribes,
            teamRosterId: result.scenario.teamRosterId,
            teamSpecialRules: result.scenario.teamSpecialRules,
            repeatedFouls: !!extraFouler,
            useChainsawForFoul: useChainsaw,
            playerCostAppliedToKillProbability: false,
            planOptions: JSON.parse(JSON.stringify(planOptions || {}))
          },
          event
        },
        provenance: {
          engineId: result.engine.id,
          engineVersion: result.engine.version,
          engineSha256: result.engine.sha256,
          api: "calculateBlockThenFoul"
        }
      });
      observations.push(observation);
    });
    return {
      subjectId,
      engine: result.engine,
      scenario: result.scenario,
      status: extraFouler || result.scenario.teamSpecialRules.length || bribes || result.rerollPolicies.withoutTeamRerolls?.driveEnd
        ? "engine-observed-conditional-team-foul-chain-with-team-and-star-rules"
        : "engine-observed-fixed-two-player-team-kill-chain; roster-economy-and-repeat-opportunity-pending",
      economics: {
        blockerCost: Number.isFinite(blocker.cost) ? blocker.cost : null,
        foulerCost: Number.isFinite(fouler.cost) ? fouler.cost : null,
        extraFoulerCost: extraFouler && Number.isFinite(extraFouler.cost) ? extraFouler.cost : null,
        combinedCost: [blocker, fouler, extraFouler].filter(Boolean).every(player => Number.isFinite(player.cost))
          ? [blocker, fouler, extraFouler].filter(Boolean).reduce((sum, player) => sum + player.cost, 0)
          : null,
        bribeCount: bribes,
        bribeUnitCost: bribes ? result.scenario.bribeUnitCost : 0,
        bribeCost: bribes ? bribes * result.scenario.bribeUnitCost : 0,
        killProbabilityIncludesPrice: false,
        replacementAndSentOffCostModel: "pending"
      },
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      diagnostics: result.rerollPolicies
    };
  }

  function evaluatePlayerStaticControlTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    teamRerolls = 1,
    opponentStrengths = [3, 4, 5, 6],
    attackerAssists = [0, 1, 2],
    defenderAssists = [0, 1, 2],
    opponentSkills = [],
    opponentAction = "block",
    row,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateOneOnOneBlock || !engine.getPitchDimensions) {
      throw new Error("Bloodboard block and pitch-dimension APIs are required for static-control observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!Array.isArray(opponentStrengths) || !opponentStrengths.length || opponentStrengths.some(value => !Number.isInteger(value) || value < 1 || value > 10)) {
      throw new RangeError("opponentStrengths must be a non-empty list of integer ST values from 1 to 10.");
    }
    if (!Array.isArray(attackerAssists) || !attackerAssists.length || attackerAssists.some(value => !Number.isInteger(value) || value < 0 || value > 2)) {
      throw new RangeError("attackerAssists must be a non-empty list of support counts from 0 to 2.");
    }
    if (!Array.isArray(defenderAssists) || !defenderAssists.length || defenderAssists.some(value => !Number.isInteger(value) || value < 0 || value > 2)) {
      throw new RangeError("defenderAssists must be a non-empty list of support counts from 0 to 2.");
    }
    if (!Array.isArray(opponentSkills) || opponentSkills.some(skill =>
      !(typeof skill === "string" && skill.trim()) && !(skill && typeof skill.id === "string" && skill.id.trim())
    )) {
      throw new TypeError("opponentSkills must be an array of skill IDs or skill objects with an ID.");
    }
    if (opponentAction !== "block" && opponentAction !== "blitz") throw new Error("opponentAction must be 'block' or 'blitz'.");
    const normalizedOpponentSkills = opponentSkills.map(skill => typeof skill === "string" ? skill : skill.id);
    const canonicalStarId = engine.resolveStarId?.(player) || null;
    const hasSpecialRules = Array.isArray(player.specialRules)
      ? player.specialRules.length > 0
      : player.specialRules && typeof player.specialRules === "object"
        ? Object.keys(player.specialRules).length > 0
        : String(player.specialRules || "").trim().length > 0;
    const hasSpecialEffects = Array.isArray(player.specialEffectCodes)
      ? player.specialEffectCodes.length > 0
      : !!player.specialEffectCodes;
    if ((hasSpecialRules || hasSpecialEffects) && !canonicalStarId) {
      throw new Error("This static-control task has Star Player effects but no canonical star identity; Bloodboard cannot resolve translated rule text or effect labels alone.");
    }
    const skills = (player.skills || []).slice();
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === boughtSkillId)) skills.push(boughtSkillId);
    }
    const evaluatedPlayer = Object.assign({}, player, { skills, ...(canonicalStarId ? { star: canonicalStarId } : {}) });
    const pitch = engine.getPitchDimensions(format);
    const resolvedRow = row === undefined ? Math.floor(pitch.height / 2) : row;
    if (!Number.isInteger(resolvedRow) || resolvedRow < 0 || resolvedRow >= pitch.height) throw new RangeError("row is outside the selected pitch.");
    const observations = [];
    const challengeMatrix = [];

    opponentStrengths.forEach(opponentST => attackerAssists.forEach(assistCount => defenderAssists.forEach(defenderAssistCount => {
      const block = engine.calculateOneOnOneBlock({
        attacker: { name: `Reference ST${opponentST} blocker`, position: "Lineman", ma: 6, st: opponentST, ag: 3, pa: 4, av: 9, skills: normalizedOpponentSkills.slice() },
        defender: evaluatedPlayer,
        action: opponentAction,
        format,
        teamRerolls,
        attackerAssists: assistCount,
        defenderAssists: defenderAssistCount,
        row: resolvedRow,
        planOptions,
        includeDefenderPositionRetentionOutcome: true,
        includeDefenderControlZoneOutcome: true,
        controlZoneRadius: 1
      });
      if (!block.summary.legal) {
        throw new Error("Static-control challenge is illegal: " + (block.summary.errors || []).join("; "));
      }
      const event = block.controlZoneOutcomes.event;
      const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
      const resultRow = { opponentST, opponentAction, opponentSkills: normalizedOpponentSkills.slice(), canonicalStarId, starRuleUse: "not-requested; Bloodboard resolves automatic effects for this Block/Blitz", attackerAssists: assistCount, defenderAssists: defenderAssistCount, legal: block.summary.legal, byRerollPolicy: {}, positionRetentionByRerollPolicy: {} };
      branches.forEach(branch => {
        const result = block.controlZoneOutcomes[branch];
        if (!result) throw new Error("Bloodboard did not return the control-zone event for " + branch + ".");
        const positionRetention = block.positionRetentionOutcomes && block.positionRetentionOutcomes[branch];
        if (!positionRetention || !positionRetention.standingAtStartingSquare) {
          throw new Error("Bloodboard did not return exact starting-square survival events for " + branch + ".");
        }
        const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
        const observation = recordTaskResult({
          submetricId: "control.staticPersistence",
          subjectId,
          result: {
            lowerBound: result.lowerBound,
            upperBound: result.upperBound,
            exact: result.exact,
            unresolved: result.exact ? 0 : Math.max(0, result.upperBound - result.lowerBound)
          },
          context: {
            format,
            boardState: {
              scenario: "stationary-anchor-local-zone-block-challenge",
              anchorAt: block.scenario.defenderAt,
              localZoneRadius: 1,
              crowdPushRoute: false,
              followUp: false,
              declaredBlockSkills: normalizedOpponentSkills
            },
            opponentProfile: block.scenario.attacker,
            supportState: { attackerAssists: assistCount, defenderAssists: defenderAssistCount, anchorMoved: false },
            rerollPool: allowedRerolls,
            taskParameters: {
              action: "opposing " + (opponentAction === "blitz" ? "Blitz" : "Block"),
              opponentBaseStrength: opponentST,
              opponentSkills: normalizedOpponentSkills,
              canonicalStarId,
              starRuleUse: "not requested; automatic effects are resolved by Bloodboard",
              referenceAssistPlayers: "standard ST3 Linemen; their actual eligibility and assist cancellation are resolved by Bloodboard",
              rerollPolicy: branch === "withTeamRerolls" ? "Bloodboard may spend the declared team pool" : "team rerolls unavailable",
              zoneDefinition: "Chebyshev radius 1 (the starting square plus its eight adjacent squares)"
            },
            event
          },
          provenance: {
            engineId: block.engine.id,
            engineVersion: block.engine.version,
            engineSha256: block.engine.sha256,
            api: "calculateOneOnOneBlock+evaluateTerminalEvent"
          }
        });
        observations.push(observation);
        const exactPosition = positionRetention.standingAtStartingSquare;
        const positionObservation = recordTaskResult({
          submetricId: "survival.positionRetention",
          subjectId,
          result: {
            lowerBound: exactPosition.lowerBound,
            upperBound: exactPosition.upperBound,
            exact: exactPosition.exact,
            unresolved: exactPosition.exact ? 0 : Math.max(0, exactPosition.upperBound - exactPosition.lowerBound)
          },
          context: {
            format,
            boardState: {
              scenario: "stationary-anchor-exact-square-block-challenge",
              assignedSquare: block.scenario.defenderAt,
              crowdPushRoute: false,
              followUp: false,
              declaredBlockSkills: normalizedOpponentSkills
            },
            opponentProfile: block.scenario.attacker,
            supportState: { attackerAssists: assistCount, defenderAssists: defenderAssistCount, anchorMoved: false },
            rerollPool: allowedRerolls,
            taskParameters: {
              action: "opposing " + (opponentAction === "blitz" ? "Blitz" : "Block"),
              opponentBaseStrength: opponentST,
              opponentSkills: normalizedOpponentSkills,
              canonicalStarId,
              starRuleUse: "not requested; automatic effects are resolved by Bloodboard",
              referenceAssistPlayers: "standard ST3 Linemen; their actual eligibility and assist cancellation are resolved by Bloodboard",
              rerollPolicy: branch === "withTeamRerolls" ? "Bloodboard may spend the declared team pool" : "team rerolls unavailable",
              positionCriterion: "still standing on the exact assigned starting square after the complete Block and damage chain",
              diagnosticOnSquareAnyStance: positionRetention.atStartingSquare
            },
            event: positionRetentionOutcomesEvent(block)
          },
          provenance: {
            engineId: block.engine.id,
            engineVersion: block.engine.version,
            engineSha256: block.engine.sha256,
            api: "calculateOneOnOneBlock+evaluateTerminalEvent"
          }
        });
        observations.push(positionObservation);
        resultRow.byRerollPolicy[branch] = result;
        resultRow.positionRetentionByRerollPolicy[branch] = {
          atStartingSquare: positionRetention.atStartingSquare,
          standingAtStartingSquare: exactPosition
        };
      });
      challengeMatrix.push(resultRow);
    })));

    return {
      subjectId,
      engine: engine.META,
      status: "engine-observed; exact-square survival and radius-1 static-control benchmarks with bilateral support, declared opposing skills, and Block/Blitz challenge modes; role, full-board, and roster calibration pending",
      challengeMatrix,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      limitation: "The benchmark isolates one stationary anchor against one adjacent declared Block or Blitz, declared opposing skills, and up to two standard ST3 assists for each side; Bloodboard resolves legal assists, cancellation, and automatic effects for a canonical Star identity. Optional activation-start Star rules are not requested. Exact-square standing and radius-1 area retention are separate events; Strength changes the Block resolution but does not cancel an already selected Push. It does not yet model the attacker's approach movement, a full-pitch threat map, repeated pushes, role-specific follow-up, or whole-team area control."
    };
  }

  function evaluateDefensiveScreenTask({
    subjectId = "defensive-screen-role",
    attacker,
    protectedPlayer,
    supporter,
    pressure = "open",
    format = "11s",
    weather = "perfect",
    attackerTeamRerolls = 0,
    defenderTeamRerolls = 0,
    row,
    planOptions = {}
  } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required for the defensive-screen role task.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateDefensiveScreenContribution !== "function") {
      throw new Error("Bloodboard's paired defensive-screen contribution API is required.");
    }
    const raw = engine.calculateDefensiveScreenContribution({ attacker, protectedPlayer, supporter, pressure, format, weather, attackerTeamRerolls, defenderTeamRerolls, row, planOptions });
    if (raw.status !== "engine-enumerated-defensive-screen-paired-task") throw new Error("Bloodboard rejected the defensive-screen role task.");
    const scenarioState = raw.withSupport.replay.state;
    const activePolicies = attackerTeamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const observations = activePolicies.flatMap(policy => {
      const result = raw.policies[policy].standingAtStartingSquare;
      const taskContext = {
        format,
        boardState: {
          withoutSupport: raw.withoutSupport.replay.state,
          withSupport: scenarioState,
          eventTimepoint: "after Block, Push, Armour/Injury and all rule reactions"
        },
        opponentProfile: raw.scenario.attacker.profile,
        supportState: {
          roleId: "anchor",
          benchmarkId: "protected-teammate-screen-v346",
          protectedPlayerId: raw.scenario.protectedPlayer.id,
          supporter: raw.scenario.supporter,
          attackerAssistCount: raw.scenario.attackerAssistCount,
          pressure
        },
        rerollPool: policy === "withTeamRerolls" ? attackerTeamRerolls : 0,
        taskParameters: {
          roleId: "anchor",
          benchmarkId: "protected-teammate-screen-v346",
          comparisonPolicy: policy,
          probabilityPolicy: "Bloodboard preview policy; the active opposing coach's declared Team rerolls are enabled only in withTeamRerolls; no optimal decision search",
          defenderTeamRerolls,
          weather,
          successDefinition: "The named protected player is standing on its exact starting square at the end of the declared Block chain.",
          pairedSupportDelta: raw.policies[policy].standingAtStartingSquare.contribution,
          otherObservedEvents: {
            protectedPlayerStanding: raw.policies[policy].standing,
            protectedPlayerStandingInLocalZone: raw.policies[policy].standingWithinLocalControlZone
          }
        },
        event: raw.withSupport.positionRetentionOutcomes.events.standingAtStartingSquare
      };
      const roleObservation = recordTaskResult({
        submetricId: "adaptability.roleCoverage",
        subjectId,
        result: { lowerBound: result.withSupport.lowerBound, upperBound: result.withSupport.upperBound, exact: result.withSupport.exact, unresolved: result.withSupport.upperBound - result.withSupport.lowerBound },
        context: taskContext,
        provenance: { engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256, api: "calculateDefensiveScreenContribution" }
      });
      const effectObservation = recordTaskResult({
        submetricId: "control.supportDelta",
        subjectId,
        result: { ...result.contribution, unresolved: result.contribution.upperBound - result.contribution.lowerBound },
        context: taskContext,
        provenance: { engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256, api: "calculateDefensiveScreenContribution" }
      });
      return [{ roleObservation, effectObservation }];
    });
    return {
      ...raw,
      subjectId,
      roleId: "anchor",
      roleBenchmarkId: "protected-teammate-screen-v346",
      observations,
      limitation: "This is one fixed incoming Block and screen square. It measures the protected ally's exact-square survival and paired support effect, not a full defensive drive, all screen positions, a screen player's survival risk, or a calibrated Adaptability grade."
    };
  }

  function evaluateGuardStrengthSynergyTask({
    subjectId = "guard-high-strength-joint-task",
    lowerAttackerStrength = 3,
    higherAttackerStrength = 5,
    targetStrength = 5,
    supporter,
    supporterPressure = "marked",
    format = "11s",
    row,
    planOptions = {}
  } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required for the Guard/Strength interaction record.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateGuardStrengthSynergy !== "function") {
      throw new Error("Bloodboard Guard/Strength difference-in-differences API is required.");
    }
    const result = engine.calculateGuardStrengthSynergy({
      lowerAttackerStrength,
      higherAttackerStrength,
      targetStrength,
      supporter,
      supporterPressure,
      format,
      row,
      planOptions
    });
    if (result.status !== "engine-enumerated-guard-strength-difference-in-differences") {
      throw new Error("Bloodboard rejected the declared Guard/Strength synergy scenario.");
    }
    const measureDefinitions = [
      ["targetDown", "pTargetDown", "target knocked down"],
      ["targetPushed", "pTargetPushed", "target pushed"],
      ["targetRemoved", "pTargetRemoved", "target removed"],
      ["targetArmourBroken", "pTargetArmourBroken", "target Armour broken"],
      ["turnover", "pTurnover", "attacking team commits a Turnover"],
      ["attackerDown", "pActorDown", "attacker knocked down"]
    ];
    const measures = measureDefinitions.map(([id, key, event]) => {
      const value = result.deltaOfGuardDeltas[key];
      return {
        id,
        event,
        unit: "probability difference-in-differences",
        value,
        percentagePointValue: Number.isFinite(value) ? value * 100 : null,
        exact: Number.isFinite(value)
      };
    });
    const evidence = {
      schema: "bloodbowl-rule-interaction/1",
      subjectId,
      synergyId: "guard+high-strength",
      axes: ["combat", "control"],
      components: ["guard", "ST"],
      status: "engine-enumerated-un-calibrated-interaction-evidence",
      formula: "(P(event | high-ST, Guard) − P(event | high-ST, no Guard)) − (P(event | low-ST, Guard) − P(event | low-ST, no Guard))",
      scenario: result.scenario,
      context: {
        format,
        opponentProfile: [{ name: `ST${targetStrength} target`, st: targetStrength }],
        supportState: { pressure: supporterPressure, skillToggled: "Guard" },
        rerollPool: 0,
        taskParameters: {
          lowerAttackerStrength,
          higherAttackerStrength,
          targetStrength,
          selectionPolicy: "attacker- or defender-chosen Block dice are resolved by Bloodboard",
          planOptions: JSON.parse(JSON.stringify(planOptions || {}))
        }
      },
      measures,
      accounting: {
        standaloneAxisScoreAssigned: false,
        addSeparatelyToGuardAndStrengthValues: false,
        rule: "Use the joint task response for calibration; do not add this interaction delta on top of both component skill/stat effects."
      },
      provenance: {
        engineId: result.engine.id,
        engineVersion: result.engine.version,
        engineSha256: result.engine.sha256,
        api: "calculateGuardStrengthSynergy"
      }
    };
    return { ...result, evidence };
  }

  function evaluateGrombrindalSupportTask({
    subjectId = "grombrindal-support-task",
    format = "11s",
    weather = "perfect",
    teamRerolls = 1,
    teammate,
    marker,
    planOptions = {}
  } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required for Grombrindal's support record.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateGrombrindalSkillGrant !== "function") {
      throw new Error("Bloodboard's Grombrindal skill-grant task API is required.");
    }
    const raw = engine.calculateGrombrindalSkillGrant({ format, weather, teamRerolls, teammate, marker, planOptions });
    const grant = raw.grantOnly.withoutTeamRerolls;
    if (!grant.legal || !grant.taskSuccessProbability.exact || grant.taskSuccessProbability.lowerBound !== 1) {
      throw new Error("Bloodboard did not verify the declared Grombrindal skill grant with certainty.");
    }
    const rerollPolicies = ["withoutTeamRerolls", ...(teamRerolls > 0 ? ["withTeamRerolls"] : [])];
    const observations = rerollPolicies.map(policy => {
      const before = raw.withoutRule[policy].taskSuccessProbability;
      const after = raw.withRule[policy].taskSuccessProbability;
      if (!raw.withoutRule[policy].legal || !raw.withRule[policy].legal || !before.exact || !after.exact) {
        throw new Error("Bloodboard did not resolve both Grombrindal paired teammate tasks exactly under " + policy + ".");
      }
      const delta = {
        lowerBound: after.lowerBound - before.upperBound,
        upperBound: after.upperBound - before.lowerBound,
        exact: true,
        value: after.lowerBound - before.lowerBound
      };
      return recordTaskResult({
        submetricId: "control.supportDelta",
        subjectId,
        result: delta,
        context: {
          format,
          boardState: raw.scenario,
          opponentProfile: [{ id: raw.scenario.marker.id, ...raw.scenario.marker.profile }],
          supportState: {
            roleId: "support",
            supporter: raw.scenario.actor,
            protectedPlayer: raw.scenario.teammate,
            grant: "Break Tackle until end of Turn",
            grantProbability: grant.taskSuccessProbability.lowerBound
          },
          rerollPool: policy === "withTeamRerolls" ? teamRerolls : 0,
          taskParameters: {
            benchmarkId: raw.scenario.id,
            comparison: "same board, profiles, route, opposing marker, weather and reroll pool; only Grombrindal's declared start rule changes",
            comparisonPolicy: policy,
            roleId: "support",
            skillChoicePolicy: "Bloodboard default preview selects the first legal unowned grant, Break Tackle; no optimal choice among all four grants is claimed",
            grantProbability: grant.taskSuccessProbability,
            baselineTeammateTaskProbability: before,
            supportedTeammateTaskProbability: after,
            turnoverProbabilityWithoutRule: raw.withoutRule[policy].turnoverProbability,
            turnoverProbabilityWithRule: raw.withRule[policy].turnoverProbability,
            planOptions: JSON.parse(JSON.stringify(planOptions || {}))
          },
          event: raw.event
        },
        provenance: {
          engineId: raw.engine.id,
          engineVersion: raw.engine.version,
          engineSha256: raw.engine.sha256,
          api: "calculateGrombrindalSkillGrant+evaluateActionSequence"
        }
      });
    });
    const appliedRuleTrace = (raw.plan?.traceEvents || []).filter(event => event.rule?.title === "Grombrindal: Wisdom of the White Dwarf");
    if (!appliedRuleTrace.some(event => event.data?.star === "grombrindal")) {
      throw new Error("Bloodboard omitted the applied Grombrindal Wisdom of the White Dwarf trace event.");
    }
    return {
      ...raw,
      subjectId,
      grantProbability: grant.taskSuccessProbability,
      controlSupportObservations: observations,
      appliedRuleTrace,
      limitation: "One fixed ST4 teammate, one Tackle marker and a one-square escape isolate Break Tackle's immediate support value. The other three grant choices, varied role portfolios, game-use frequency and calibrated Adaptability/team-strength aggregation remain unmeasured."
    };
  }

  function evaluateBlockTackleInteractionTask({
    subjectId = "block-tackle-vs-dodge-interaction",
    attacker,
    defender,
    teamRerolls = 1,
    format = "11s",
    weather = "perfect",
    row,
    planOptions = {}
  } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required for the Block/Tackle interaction record.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateBlockTackleInteraction !== "function") {
      throw new Error("Bloodboard's four-cell Block/Tackle interaction API is required.");
    }
    const synergy = SYNERGIES.find(item => item.id === "block+tackle");
    if (!synergy) throw new Error("The Block/Tackle interaction must be declared in the V3 synergy registry.");
    const result = engine.calculateBlockTackleInteraction({ attacker, defender, teamRerolls, format, weather, row, planOptions });
    if (result.status !== "engine-enumerated-four-cell-skill-interaction") throw new Error("Bloodboard rejected the declared Block/Tackle interaction task.");
    const measures = Object.entries(result.interactions).flatMap(([rerollPolicy, interaction]) => Object.entries(interaction).map(([eventId, value]) => ({
      eventId,
      rerollPolicy,
      unit: "probability difference-in-differences",
      value: value?.value ?? null,
      lowerBound: value?.lowerBound ?? null,
      upperBound: value?.upperBound ?? null,
      percentagePointValue: Number.isFinite(value?.value) ? value.value * 100 : null,
      exact: !!value?.exact
    })));
    const evidence = {
      schema: "bloodbowl-rule-interaction/1",
      subjectId,
      synergyId: synergy.id,
      axes: synergy.axes.slice(),
      components: synergy.requires.slice(),
      registeredEventId: synergy.eventId,
      status: "engine-enumerated-un-calibrated-interaction-evidence",
      formula: result.scenario.interactionFormula,
      scenario: result.scenario,
      cases: result.cases,
      measures,
      accounting: {
        standaloneAxisScoreAssigned: false,
        addSeparatelyToBlockAndTackleValues: false,
        rule: "Treat each declared reroll policy and event as conditional interaction evidence; do not add the interaction on top of both component values."
      },
      provenance: {
        engineId: result.engine.id,
        engineVersion: result.engine.version,
        engineSha256: result.engine.sha256,
        api: "calculateBlockTackleInteraction"
      }
    };
    return { ...result, evidence, modelVersion: VERSION };
  }

  function evaluateMightyBlowClawsInteractionTask({
    subjectId = "mighty-blow-claws-damage-chain",
    attacker,
    defender,
    teamRerolls = 1,
    format = "11s",
    weather = "perfect",
    row,
    planOptions = {}
  } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required for the Mighty Blow/Claws interaction record.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateMightyBlowClawsInteraction !== "function") {
      throw new Error("Bloodboard's four-cell Mighty Blow/Claws interaction API is required.");
    }
    const synergy = SYNERGIES.find(item => item.id === "mightyBlow+claws");
    if (!synergy) throw new Error("The Mighty Blow/Claws interaction must be declared in the V3 synergy registry.");
    const result = engine.calculateMightyBlowClawsInteraction({ attacker, defender, teamRerolls, format, weather, row, planOptions });
    if (result.status !== "engine-enumerated-four-cell-skill-interaction") throw new Error("Bloodboard rejected the declared Mighty Blow/Claws interaction task.");
    const measures = Object.entries(result.interactions).flatMap(([rerollPolicy, interaction]) => Object.entries(interaction).map(([eventId, value]) => ({
      eventId,
      rerollPolicy,
      unit: "probability difference-in-differences",
      value: value?.value ?? null,
      lowerBound: value?.lowerBound ?? null,
      upperBound: value?.upperBound ?? null,
      percentagePointValue: Number.isFinite(value?.value) ? value.value * 100 : null,
      exact: !!value?.exact
    })));
    const evidence = {
      schema: "bloodbowl-rule-interaction/1",
      subjectId,
      synergyId: synergy.id,
      axes: synergy.axes.slice(),
      components: synergy.requires.slice(),
      registeredEventId: synergy.eventId,
      status: "engine-enumerated-un-calibrated-interaction-evidence",
      formula: result.scenario.interactionFormula,
      scenario: result.scenario,
      cases: result.cases,
      measures,
      accounting: {
        standaloneAxisScoreAssigned: false,
        addSeparatelyToMightyBlowAndClawsValues: false,
        rule: "Treat each declared reroll policy and event as conditional interaction evidence; do not add the interaction on top of both component values."
      },
      provenance: {
        engineId: result.engine.id,
        engineVersion: result.engine.version,
        engineSha256: result.engine.sha256,
        api: "calculateMightyBlowClawsInteraction"
      }
    };
    return { ...result, evidence, modelVersion: VERSION };
  }

  function evaluateTeamStaticAnchorTasks(players, {
    teamId = "unidentified-team",
    format = "11s",
    opponentStrength = 4,
    opponentStrengths = null,
    opponentStrengthWeights = null,
    opponentSkills = [],
    opponentAction = "block",
    row
  } = {}) {
    if (!Array.isArray(players) || players.length === 0) throw new TypeError("A non-empty declared lineup is required.");
    const engineFormat = format === "standard" ? "11s" : format;
    if (engineFormat !== "11s" && engineFormat !== "sevens") throw new RangeError("format must be '11s', 'standard', or 'sevens'.");
    const lineupLimit = engineFormat === "sevens" ? 7 : 11;
    if (players.length > lineupLimit) throw new RangeError("The declared lineup exceeds the selected format's on-pitch player limit.");
    if (typeof teamId !== "string" || !teamId.trim()) throw new TypeError("A stable teamId is required.");
    const threatStrengths = opponentStrengths === null ? [opponentStrength] : opponentStrengths;
    if (!Array.isArray(threatStrengths) || !threatStrengths.length || threatStrengths.some(value => !Number.isInteger(value) || value < 1 || value > 10)) {
      throw new RangeError("opponentStrengths must be a non-empty list of integer ST values from 1 to 10.");
    }
    if (new Set(threatStrengths).size !== threatStrengths.length) throw new RangeError("opponentStrengths must not contain duplicate ST values.");
    const rawStrengthWeights = opponentStrengthWeights === null ? threatStrengths.map(() => 1) : opponentStrengthWeights;
    if (!Array.isArray(rawStrengthWeights) || rawStrengthWeights.length !== threatStrengths.length || rawStrengthWeights.some(weight => !Number.isFinite(weight) || weight < 0)) {
      throw new RangeError("opponentStrengthWeights must provide one non-negative finite weight per declared ST value.");
    }
    const strengthWeightTotal = rawStrengthWeights.reduce((sum, weight) => sum + weight, 0);
    if (!(strengthWeightTotal > 0)) throw new RangeError("opponentStrengthWeights must have positive total weight.");
    const strengthDistribution = threatStrengths.map((strength, index) => ({
      strength,
      weight: rawStrengthWeights[index] / strengthWeightTotal
    }));
    if (typeof opponentAction !== "string" || !["block", "blitz"].includes(opponentAction)) throw new RangeError("opponentAction must be 'block' or 'blitz'.");
    const playerIds = players.map(player => player && player.id);
    if (playerIds.some(id => typeof id !== "string" || !id.trim()) || new Set(playerIds).size !== playerIds.length) {
      throw new TypeError("Every declared lineup player needs a unique stable string id.");
    }
    const members = players.map(player => {
      const subjectId = teamId + ":" + player.id;
      const result = evaluatePlayerStaticControlTasks(player, {
        subjectId,
        format: engineFormat,
        teamRerolls: 0,
        opponentStrengths: threatStrengths,
        attackerAssists: [0],
        defenderAssists: [0],
        opponentSkills,
        opponentAction,
        row
      });
      const challengeByStrength = new Map(result.challengeMatrix.map(challenge => [challenge.opponentST, challenge]));
      const localByStrength = Object.fromEntries(strengthDistribution.map(({ strength, weight }) => {
        const local = challengeByStrength.get(strength)?.byRerollPolicy.withoutTeamRerolls;
        if (!local) throw new Error(`Bloodboard omitted the static-anchor result against ST${strength}.`);
        return [strength, { weight, lowerBound: local.lowerBound, upperBound: local.upperBound, exact: local.exact }];
      }));
      const exactByStrength = Object.fromEntries(strengthDistribution.map(({ strength, weight }) => {
        const exactSquare = challengeByStrength.get(strength)?.positionRetentionByRerollPolicy.withoutTeamRerolls.standingAtStartingSquare;
        if (!exactSquare) throw new Error(`Bloodboard omitted exact-square retention against ST${strength}.`);
        return [strength, { weight, lowerBound: exactSquare.lowerBound, upperBound: exactSquare.upperBound, exact: exactSquare.exact }];
      }));
      const mix = byStrength => {
        const lowerBound = strengthDistribution.reduce((sum, { strength, weight }) => sum + weight * byStrength[strength].lowerBound, 0);
        const upperBound = strengthDistribution.reduce((sum, { strength, weight }) => sum + weight * byStrength[strength].upperBound, 0);
        const exact = strengthDistribution.every(({ strength }) => byStrength[strength].exact);
        return { value: exact ? (lowerBound + upperBound) / 2 : null, lowerBound, upperBound, exact };
      };
      const local = mix(localByStrength);
      const exactSquare = mix(exactByStrength);
      return {
        playerId: player.id,
        name: player.name || player.position || player.id,
        strength: Number(player.st) || 1,
        localZoneStanding: local,
        exactSquareStanding: exactSquare,
        localZoneStandingByOpponentStrength: localByStrength,
        exactSquareStandingByOpponentStrength: exactByStrength,
        observations: result.observations
      };
    });
    const sumBounds = key => {
      const outcomes = members.map(member => member[key]);
      const lowerBound = outcomes.reduce((sum, result) => sum + result.lowerBound, 0);
      const upperBound = outcomes.reduce((sum, result) => sum + result.upperBound, 0);
      const exact = outcomes.every(result => result.exact);
      return { value: exact ? lowerBound : null, lowerBound, upperBound, exact };
    };
    const expectedLocalZones = sumBounds("localZoneStanding");
    const expectedExactSquares = sumBounds("exactSquareStanding");
    return {
      teamId,
      format: engineFormat,
      engine: window.BB_BLOODBOARD_ENGINE.META,
      status: "engine-observed-team-static-anchor-benchmark; raw expected anchors retaining their local zone and standing on their assigned square; not a six-axis score",
      lineupCount: players.length,
      challenge: {
        geometry: "Each declared player is assigned a distinct anchor square; evaluate one separate incoming threat per anchor. Radius-1 local zones may overlap.",
        opponentStrength: strengthDistribution.length === 1 ? threatStrengths[0] : null,
        opponentStrengthDistribution: strengthDistribution,
        opponentSkills: opponentSkills.map(skill => typeof skill === "string" ? skill : skill.id),
        opponentAction,
        attackerAssists: 0,
        defenderAssists: 0,
        teamRerolls: 0,
        format: engineFormat
      },
      expectedAnchorsRetainingLocalZone: expectedLocalZones,
      expectedAnchorsStandingAtAssignedSquare: expectedExactSquares,
      meanAnchorLocalZoneRetention: {
        value: expectedLocalZones.value === null ? null : expectedLocalZones.value / members.length,
        lowerBound: expectedLocalZones.lowerBound / members.length,
        upperBound: expectedLocalZones.upperBound / members.length,
        exact: expectedLocalZones.exact
      },
      members,
      limitation: "Expected counts are sums of marginal Bloodboard probabilities for distinct anchor squares under separate one-threat benchmarks; linearity of expectation does not require independent outcomes. Radius-1 zones can overlap, so the count is not the number of unique controlled squares. This is not one legal turn in which an opponent blocks every player, does not optimize a full-pitch formation or shared rerolls, and does not yet define or grade the team's Control axis."
    };
  }

  function evaluateTeamStaticCoverageTasks(players, {
    teamId = "unidentified-team",
    format = "11s",
    formation,
    targetPlayerId,
    attacker,
    attackerAt,
    action = "block",
    threats,
    attackerTeamRerolls = 0,
    weather = "perfect",
    exploreOptions = {}
  } = {}) {
    if (!Array.isArray(players) || players.length === 0) throw new TypeError("A non-empty declared lineup is required.");
    const engineFormat = format === "standard" ? "11s" : format;
    if (engineFormat !== "11s" && engineFormat !== "sevens") throw new RangeError("format must be '11s', 'standard', or 'sevens'.");
    if (typeof teamId !== "string" || !teamId.trim()) throw new TypeError("A stable teamId is required.");
    const playerIds = players.map(player => player && player.id);
    if (playerIds.some(id => typeof id !== "string" || !id.trim()) || new Set(playerIds).size !== playerIds.length) {
      throw new TypeError("Every declared lineup player needs a unique stable string id.");
    }
    let formationById = new Map();
    if (formation !== undefined) {
      if (!Array.isArray(formation)) throw new TypeError("formation must be an array of { playerId, x, y } entries.");
      formation.forEach(entry => {
        if (!entry || typeof entry.playerId !== "string" || !Number.isInteger(entry.x) || !Number.isInteger(entry.y)) {
          throw new TypeError("Each formation entry must provide playerId, integer x, and integer y.");
        }
        if (formationById.has(entry.playerId)) throw new Error("A player may appear only once in the declared formation.");
        formationById.set(entry.playerId, { x: entry.x, y: entry.y });
      });
      if (formationById.size !== players.length || playerIds.some(id => !formationById.has(id)) || [...formationById.keys()].some(id => !playerIds.includes(id))) {
        throw new Error("The declared formation must contain every lineup player exactly once.");
      }
    }
    const defenders = players.map(player => ({
      id: player.id,
      profile: player,
      at: formationById.get(player.id) || player.at
    }));
    if (defenders.some(player => !player.at)) throw new Error("Provide a complete legal formation or an at coordinate for every lineup player.");
    const declaredThreats = threats === undefined
      ? [{ id: "declared-incoming-threat", targetPlayerId, attacker, attackerAt, action }]
      : threats;
    if (!Array.isArray(declaredThreats) || declaredThreats.length < 1 || declaredThreats.length > 64) {
      throw new RangeError("threats must contain 1..64 declared single-threat scenarios.");
    }
    const threatIds = declaredThreats.map(threat => threat && threat.id);
    if (threatIds.some(id => typeof id !== "string" || !id.trim()) || new Set(threatIds).size !== threatIds.length) {
      throw new TypeError("Every threat scenario needs a unique stable string id.");
    }
    const explicitWeights = declaredThreats.some(threat => Object.prototype.hasOwnProperty.call(threat, "weight"));
    if (explicitWeights && declaredThreats.some(threat => !Number.isFinite(threat.weight) || threat.weight < 0)) {
      throw new RangeError("If any threat weight is specified, every threat needs a non-negative finite weight.");
    }
    const weightTotal = explicitWeights ? declaredThreats.reduce((sum, threat) => sum + threat.weight, 0) : declaredThreats.length;
    if (!(weightTotal > 0)) throw new RangeError("The declared threat portfolio must have positive total weight.");
    const normalizedThreats = declaredThreats.map((threat, index) => {
      const targetId = threat.targetPlayerId || targetPlayerId;
      const opponent = threat.attacker || attacker;
      const position = threat.attackerAt || attackerAt;
      const attackAction = threat.action || action;
      if (typeof targetId !== "string" || !targetId.trim()) throw new TypeError("Every threat scenario needs a targetPlayerId from the declared lineup.");
      if (!opponent || typeof opponent !== "object") throw new TypeError("Every threat scenario needs an attacker profile.");
      if (!position || !Number.isInteger(position.x) || !Number.isInteger(position.y)) throw new TypeError("Every threat scenario needs an integer attackerAt coordinate.");
      if (attackAction !== "block" && attackAction !== "blitz") throw new RangeError("Threat actions must be 'block' or 'blitz'.");
      return {
        id: threat.id,
        targetPlayerId: targetId,
        attacker: opponent,
        attackerAt: position,
        action: attackAction,
        weight: explicitWeights ? threat.weight / weightTotal : 1 / declaredThreats.length,
        index
      };
    });
    const scenarioResults = normalizedThreats.map(threat => {
      const result = window.BB_BLOODBOARD_ENGINE.calculateTeamStaticCoverageAfterBlock({
        defenders,
        targetPlayerId: threat.targetPlayerId,
        attacker: threat.attacker,
        attackerAt: threat.attackerAt,
        action: threat.action,
        format: engineFormat,
        attackerTeamRerolls,
        weather,
        exploreOptions
      });
      if (!result.legal) throw new Error("Bloodboard rejected static-coverage threat '" + threat.id + "': " + (result.errors || []).join("; "));
      return { threat, result };
    });
    const raw = scenarioResults[0].result;
    if (scenarioResults.some(item => item.result.initialUniqueTackleZoneSquares !== raw.initialUniqueTackleZoneSquares)) {
      throw new Error("Every threat scenario in a portfolio must use the same initial formation and coverage footprint.");
    }
    const aggregateMeasure = (items, select) => {
      let lowerBound = 0;
      let upperBound = 0;
      let unresolved = 0;
      let exact = true;
      items.forEach(({ threat, result }) => {
        const measure = select(result);
        lowerBound += threat.weight * measure.lowerBound;
        upperBound += threat.weight * measure.upperBound;
        unresolved += threat.weight * (measure.unresolved || 0);
        exact = exact && measure.exact;
      });
      return { value: exact ? lowerBound : null, lowerBound, upperBound, exact, unresolved };
    };
    const rangeMeasure = (items, select, direction) => {
      const values = items.map(({ threat, result }) => ({
        id: threat.id,
        weight: threat.weight,
        measure: select(result)
      }));
      const lowerBound = direction === "min"
        ? Math.min(...values.map(item => item.measure.lowerBound))
        : Math.max(...values.map(item => item.measure.lowerBound));
      const upperBound = direction === "min"
        ? Math.min(...values.map(item => item.measure.upperBound))
        : Math.max(...values.map(item => item.measure.upperBound));
      const chosen = direction === "min"
        ? values.reduce((best, item) => item.measure.lowerBound < best.measure.lowerBound ? item : best)
        : values.reduce((best, item) => item.measure.lowerBound > best.measure.lowerBound ? item : best);
      const exact = values.every(item => item.measure.exact);
      return { value: exact ? lowerBound : null, lowerBound, upperBound, exact, scenarioIdByLowerBound: chosen.id };
    };
    const byRerollPolicy = {};
    ["withoutTeamRerolls", "withTeamRerolls"].forEach(branch => {
      const metricNames = [
        "expectedUniqueTackleZoneSquares",
        "expectedInitiallyCoveredSquaresRetained",
        "expectedInitiallyCoveredSquaresLost",
        "expectedNewlyCoveredSquares",
        "probabilityCoverageCountFalls",
        "targetStandingWithTackleZone",
        "targetRemainsOnPitch"
      ];
      const aggregate = Object.fromEntries(metricNames.map(metricName => [metricName,
        aggregateMeasure(scenarioResults, result => result.byRerollPolicy[branch][metricName])
      ]));
      byRerollPolicy[branch] = {
        ...aggregate,
        worstDeclaredThreatExpectedUniqueTackleZoneSquares: rangeMeasure(scenarioResults, result => result.byRerollPolicy[branch].expectedUniqueTackleZoneSquares, "min"),
        bestDeclaredThreatExpectedUniqueTackleZoneSquares: rangeMeasure(scenarioResults, result => result.byRerollPolicy[branch].expectedUniqueTackleZoneSquares, "max"),
        declaredScenarios: scenarioResults.map(({ threat, result }) => ({
          id: threat.id,
          targetPlayerId: threat.targetPlayerId,
          attackerAt: threat.attackerAt,
          action: threat.action,
          weight: threat.weight,
          expectedUniqueTackleZoneSquares: result.byRerollPolicy[branch].expectedUniqueTackleZoneSquares,
          probabilityCoverageCountFalls: result.byRerollPolicy[branch].probabilityCoverageCountFalls,
          targetStandingWithTackleZone: result.byRerollPolicy[branch].targetStandingWithTackleZone,
          targetRemainsOnPitch: result.byRerollPolicy[branch].targetRemainsOnPitch
        }))
      };
    });
    const subjectId = "team-control-coverage:" + teamId;
    const observations = [];
    ["withoutTeamRerolls", "withTeamRerolls"].forEach(branch => {
      const branchResult = byRerollPolicy[branch].expectedUniqueTackleZoneSquares;
      observations.push(recordTaskResult({
        submetricId: "control.teamStaticCoverage",
        subjectId,
        result: {
          lowerBound: branchResult.lowerBound,
          upperBound: branchResult.upperBound,
          exact: branchResult.exact,
          unresolved: branchResult.unresolved
        },
        context: {
          format: engineFormat,
          boardState: {
            scenario: "declared-legal-formation-threat-portfolio",
            defenders: raw.scenario.defendingLineup.map(player => ({ playerId: player.playerId, at: player.at })),
            initialUniqueTackleZoneSquares: raw.initialUniqueTackleZoneSquares,
            threats: normalizedThreats.map(threat => ({ id: threat.id, targetPlayerId: threat.targetPlayerId, attackerAt: threat.attackerAt, action: threat.action, weight: threat.weight })),
            weather
          },
          opponentProfile: { threats: normalizedThreats.map(threat => ({ id: threat.id, profile: threat.attacker })) },
          supportState: {
            declaredFormation: true,
            assists: "Bloodboard derives legal defensive assists from every standing teammate in the stated setup.",
            allDefendingPlayers: raw.scenario.defendingLineup.map(player => player.playerId),
            threatMixture: explicitWeights ? "normalized caller-declared weights" : "uniform over the caller-declared scenarios"
          },
          rerollPool: branch === "withTeamRerolls" ? attackerTeamRerolls : 0,
          taskParameters: {
            threatPortfolio: normalizedThreats.map(threat => ({ id: threat.id, targetPlayerId: threat.targetPlayerId, attackerAt: threat.attackerAt, action: threat.action, weight: threat.weight })),
            attackerRerollPolicy: branch,
            followUp: false,
            coverageDefinition: raw.scenario.coverageDefinition,
            exploration: exploreOptions
          },
          event: {
            type: "weightedProbabilityTerminalStateStatistic",
            statistic: "uniqueTeamTackleZoneSquares",
            team: "A",
            threatMixture: normalizedThreats.map(threat => ({ id: threat.id, weight: threat.weight })),
            terminalEvaluator: "For every declared threat, Bloodboard terminal states; exact union of standing non-distracted defenders' in-bounds adjacent squares"
          }
        },
        provenance: {
          engineId: raw.engine.id,
          engineVersion: raw.engine.version,
          engineSha256: raw.engine.sha256,
          api: "calculateTeamStaticCoverageAfterBlock+exploreOutcomes"
        }
      }));
    });
    return {
      teamId,
      subjectId,
      format: engineFormat,
      engine: raw.engine,
      status: "engine-observed-legal-formation-team-static-coverage-portfolio; raw expected unique tackle-zone squares under a declared threat mixture; not a six-axis score",
      ...raw,
      scenario: {
        id: "declared-legal-formation-threat-portfolio",
        format: engineFormat,
        weather,
        defendingLineup: raw.scenario.defendingLineup,
        setupValidatedBy: raw.scenario.setupValidatedBy,
        initialUniqueTackleZoneSquares: raw.initialUniqueTackleZoneSquares,
        coverageDefinition: raw.scenario.coverageDefinition,
        threatMixture: explicitWeights ? "normalized caller-declared weights" : "uniform over declared scenarios",
        threats: normalizedThreats.map(threat => ({ id: threat.id, targetPlayerId: threat.targetPlayerId, attacker: threat.attacker, attackerAt: threat.attackerAt, action: threat.action, weight: threat.weight }))
      },
      byRerollPolicy,
      scenarioResults: scenarioResults.map(({ threat, result }) => ({ id: threat.id, weight: threat.weight, ...result })),
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      limitation: "This metric uses one Bloodboard-validated defensive setup and a caller-declared mixture of single post-movement adjacent Block/Blitz scenarios. It incorporates the full lineup's overlapping tackle zones, actual defensive assists, and exact post-action outcomes. Threat weights are explicit assumptions (uniform only when the caller omits them); they are not estimated match frequencies. It does not model chained attacks, the opponent's full turn, formation optimization, multi-drive usage, or a calibrated team Control grade."
    };
  }

  function evaluateTeamStaticCoverageReplacementTasks(players, {
    teamId = "unidentified-team",
    format = "11s",
    formation,
    formationAlternatives = [],
    threats,
    comparisons,
    attackerTeamRerolls = 0,
    weather = "perfect",
    exploreOptions = {}
  } = {}) {
    if (!Array.isArray(players) || players.length === 0) throw new TypeError("A non-empty declared lineup is required.");
    if (!Array.isArray(formation) || formation.length !== players.length) throw new TypeError("A complete declared formation is required for matched replacement comparisons.");
    if (!Array.isArray(threats) || threats.length < 1) throw new TypeError("At least one named threat scenario is required for matched replacement comparisons.");
    if (!Array.isArray(comparisons) || comparisons.length < 1 || comparisons.length > 32) throw new RangeError("comparisons must contain 1..32 declared replacements.");
    if (!Array.isArray(formationAlternatives) || formationAlternatives.length > 7) throw new RangeError("formationAlternatives may contain at most 7 additional declared formations.");
    const ids = players.map(player => player && player.id);
    if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) throw new TypeError("Every lineup player needs a unique stable string id.");
    const caseIds = comparisons.map(item => item && item.id);
    if (caseIds.some(id => typeof id !== "string" || !id.trim()) || new Set(caseIds).size !== caseIds.length) throw new TypeError("Every replacement comparison needs a unique stable id.");
    const casePlayers = comparisons.map(item => item && item.playerId);
    if (casePlayers.some(id => typeof id !== "string" || !ids.includes(id))) throw new TypeError("Every replacement comparison must name a player in the declared lineup.");
    if (casePlayers.some((id, index) => casePlayers.indexOf(id) !== index)) throw new Error("A replacement batch may compare each focal lineup player only once.");
    if (threats.some(threat => !threat || typeof threat.targetPlayerId !== "string" || !ids.includes(threat.targetPlayerId))) {
      throw new TypeError("Every threat must target a named player in the baseline lineup.");
    }
    const formationById = new Map();
    formation.forEach(slot => {
      if (!slot || typeof slot.playerId !== "string" || !ids.includes(slot.playerId) || !Number.isInteger(slot.x) || !Number.isInteger(slot.y)) {
        throw new TypeError("Each formation slot must map one lineup player to integer x/y coordinates.");
      }
      if (formationById.has(slot.playerId)) throw new Error("A formation may assign each lineup player only once.");
      formationById.set(slot.playerId, { playerId: slot.playerId, x: slot.x, y: slot.y });
    });
    if (formationById.size !== players.length) throw new Error("The formation must include every baseline lineup player exactly once.");
    const invariantPlayerIds = new Set([...casePlayers, ...threats.map(threat => threat.targetPlayerId)]);
    const formationCandidates = [{ id: "declared", formation }];
    const alternativeIds = formationAlternatives.map(candidate => candidate && candidate.id);
    if (alternativeIds.some(id => typeof id !== "string" || !id.trim()) || new Set(alternativeIds).size !== alternativeIds.length || alternativeIds.includes("declared")) {
      throw new TypeError("Every alternative formation needs a unique stable id distinct from 'declared'.");
    }
    formationAlternatives.forEach(candidate => {
      if (!Array.isArray(candidate.formation) || candidate.formation.length !== players.length) throw new TypeError("Every alternative must provide a complete formation for the same lineup.");
      const slots = new Map();
      candidate.formation.forEach(slot => {
        if (!slot || typeof slot.playerId !== "string" || !ids.includes(slot.playerId) || !Number.isInteger(slot.x) || !Number.isInteger(slot.y)) {
          throw new TypeError("Each alternative slot must map one lineup player to integer x/y coordinates.");
        }
        if (slots.has(slot.playerId)) throw new Error("An alternative formation may assign each lineup player only once.");
        slots.set(slot.playerId, { playerId: slot.playerId, x: slot.x, y: slot.y });
      });
      if (slots.size !== players.length) throw new Error("Every alternative formation must include each baseline lineup player exactly once.");
      invariantPlayerIds.forEach(playerId => {
        const base = formationById.get(playerId);
        const alternative = slots.get(playerId);
        if (!base || !alternative || base.x !== alternative.x || base.y !== alternative.y) {
          throw new Error("Alternative formations must keep every focal and threatened player's coordinate fixed so the compared threat task remains identical.");
        }
      });
      formationCandidates.push({ id: candidate.id, formation: candidate.formation });
    });
    if (comparisons.length * formationCandidates.length * threats.length > 64) {
      throw new RangeError("Replacement, formation, and threat combinations may not exceed 64 per comparison batch.");
    }
    comparisons.forEach(comparison => {
      const focal = players.find(player => player.id === comparison.playerId);
      const replacement = comparison.replacement;
      if (!replacement || typeof replacement !== "object" || typeof replacement.id !== "string" || !replacement.id.trim()) {
        throw new TypeError("Every comparison needs a replacement profile with a stable string id.");
      }
      if (ids.includes(replacement.id)) throw new Error("Replacement ids must not collide with baseline lineup ids.");
      if (!["ordinary-same-position", "reserve", "attribute-ablation", "other"].includes(comparison.type)) {
        throw new RangeError("Replacement type must be ordinary-same-position, reserve, attribute-ablation, or other.");
      }
      if (comparison.type === "ordinary-same-position" && (!focal.positionId || replacement.positionId !== focal.positionId)) {
        throw new Error("A same-position ordinary replacement must preserve the focal player's positionId.");
      }
    });
    const baselineRuns = formationCandidates.map(candidate => ({
      id: candidate.id,
      result: evaluateTeamStaticCoverageTasks(players, {
        teamId: teamId + ":replacement-baseline:" + candidate.id,
        format,
        formation: candidate.formation,
        threats,
        attackerTeamRerolls,
        weather,
        exploreOptions
      })
    }));
    const difference = (baselineMeasure, replacementMeasure) => {
      const exact = baselineMeasure.exact && replacementMeasure.exact;
      const lowerBound = baselineMeasure.lowerBound - replacementMeasure.upperBound;
      const upperBound = baselineMeasure.upperBound - replacementMeasure.lowerBound;
      return { value: exact ? baselineMeasure.value - replacementMeasure.value : null, lowerBound, upperBound, exact };
    };
    const policies = ["withoutTeamRerolls", "withTeamRerolls"];
    const selectBestFormation = (runs, policy) => {
      const ranked = runs.map((run, index) => ({
        run,
        index,
        measure: run.result.byRerollPolicy[policy].expectedUniqueTackleZoneSquares
      })).sort((a, b) => b.measure.lowerBound - a.measure.lowerBound || a.index - b.index);
      const chosen = ranked[0];
      return {
        run: chosen.run,
        measure: chosen.measure,
        certain: ranked.slice(1).every(candidate => chosen.measure.lowerBound >= candidate.measure.upperBound)
      };
    };
    const baselineByRerollPolicy = Object.fromEntries(policies.map(policy => {
      const selected = selectBestFormation(baselineRuns, policy);
      return [policy, Object.assign({}, selected.run.result.byRerollPolicy[policy], {
        selectedFormationId: selected.run.id,
        formationSelectionCertain: selected.certain,
        candidateFormations: baselineRuns.map(run => ({
          id: run.id,
          measure: run.result.byRerollPolicy[policy].expectedUniqueTackleZoneSquares
        }))
      })];
    }));
    const baseline = {
      teamId,
      format: baselineRuns[0].result.format,
      engine: baselineRuns[0].result.engine,
      byRerollPolicy: baselineByRerollPolicy,
      formations: baselineRuns.map(run => ({
        id: run.id,
        initialUniqueTackleZoneSquares: run.result.initialUniqueTackleZoneSquares,
        taskProfile: run.result.taskProfile
      })),
      taskProfile: selectBestFormation(baselineRuns, "withoutTeamRerolls").run.result.taskProfile
    };
    const scenarios = comparisons.map(comparison => {
      const focal = players.find(player => player.id === comparison.playerId);
      const replacement = comparison.replacement;
      const comparisonType = comparison.type;
      const replacementLineup = players.map(player => player.id === focal.id ? Object.assign({}, replacement) : player);
      const replacementThreats = threats.map(threat => Object.assign({}, threat, {
        targetPlayerId: threat.targetPlayerId === focal.id ? replacement.id : threat.targetPlayerId
      }));
      const counterfactualRuns = formationCandidates.map(candidate => ({
        id: candidate.id,
        result: evaluateTeamStaticCoverageTasks(replacementLineup, {
          teamId: teamId + ":replacement:" + comparison.id + ":" + candidate.id,
          format,
          formation: candidate.formation.map(slot => slot.playerId === focal.id
            ? Object.assign({}, slot, { playerId: replacement.id })
            : slot),
          threats: replacementThreats,
          attackerTeamRerolls,
          weather,
          exploreOptions
        })
      }));
      const byRerollPolicy = {};
      policies.forEach(policy => {
        const selectedBaseline = selectBestFormation(baselineRuns, policy);
        const selectedReplacement = selectBestFormation(counterfactualRuns, policy);
        const baselineMeasure = selectedBaseline.measure;
        const replacementMeasure = selectedReplacement.measure;
        const baselineResult = selectedBaseline.run.result;
        const replacementResult = selectedReplacement.run.result;
        const replacementScenarios = new Map(replacementResult.scenarioResults.map(item => [item.id, item]));
        const perThreat = baselineResult.scenarioResults.map(baseScenario => {
          const replacementScenario = replacementScenarios.get(baseScenario.id);
          if (!replacementScenario || replacementScenario.weight !== baseScenario.weight) throw new Error("Baseline and replacement must preserve identical threat ids and normalized weights.");
          const baseMeasure = baseScenario.byRerollPolicy[policy].expectedUniqueTackleZoneSquares;
          const replacedMeasure = replacementScenario.byRerollPolicy[policy].expectedUniqueTackleZoneSquares;
          return {
            id: baseScenario.id,
            weight: baseScenario.weight,
            baseline: baseMeasure,
            replacement: replacedMeasure,
            focalPlayerContribution: difference(baseMeasure, replacedMeasure)
          };
        });
        byRerollPolicy[policy] = {
          baseline: baselineMeasure,
          replacement: replacementMeasure,
          baselineFormationId: selectedBaseline.run.id,
          replacementFormationId: selectedReplacement.run.id,
          baselineFormationSelectionCertain: selectedBaseline.certain,
          replacementFormationSelectionCertain: selectedReplacement.certain,
          candidateFormations: counterfactualRuns.map(run => ({
            id: run.id,
            measure: run.result.byRerollPolicy[policy].expectedUniqueTackleZoneSquares
          })),
          focalPlayerContribution: difference(baselineMeasure, replacementMeasure),
          perThreat
        };
      });
      return {
        id: comparison.id,
        type: comparisonType,
        source: comparison.source || "caller-declared replacement profile",
        focalPlayer: { id: focal.id, name: focal.name || focal.position || focal.id, positionId: focal.positionId || "" },
        replacementPlayer: { id: replacement.id, name: replacement.name || replacement.position || replacement.id, positionId: replacement.positionId || "" },
        slotTreatment: "replacement occupies the focal player's exact validated formation square; all declared alternative formations keep focal and threatened players fixed while allowing other defenders to redeploy; threats targeting the focal player are remapped to the replacement",
        byRerollPolicy,
        counterfactualTeamIds: counterfactualRuns.map(run => run.result.teamId),
        counterfactualTaskProfiles: counterfactualRuns.map(run => ({ formationId: run.id, taskProfile: run.result.taskProfile }))
      };
    });
    return {
      teamId,
      format: baseline.format,
      engine: baseline.engine,
      status: "engine-enumerated-team-control-impact-by-matched-same-slot-replacement; raw declared-task delta only",
      task: "expected unique team tackle-zone squares under the declared legal formation and threat portfolio",
      formationSelection: "best result among the caller-declared legal formation set for each reroll policy; selection certainty is reported from exact values or non-overlapping bounds",
      baseline: {
        formations: baseline.formations,
        byRerollPolicy: baseline.byRerollPolicy,
        taskProfile: baseline.taskProfile
      },
      comparisons: scenarios,
      interpretation: "focalPlayerContribution = baseline task result − replacement task result; positive values mean the focal player contributes more than this declared replacement for this task. It is not a six-axis grade or a complete team-importance score.",
      limitation: "The counterfactual preserves lineup size and each focal/threatened player's exact legal formation slot, remaps threats to the replacement, and recomputes the whole team's overlapping control zones and Bloodboard-resolved assists. It only selects among caller-declared legal formation alternatives; it does not search all legal formations, select from the full reserve roster, estimate match-frequency weights, or combine this local control task with the team's other objectives."
    };
  }

  function positionRetentionOutcomesEvent(block) {
    const events = block.positionRetentionOutcomes && block.positionRetentionOutcomes.events;
    if (!events || !events.standingAtStartingSquare) throw new Error("Missing exact-position task event provenance.");
    return events.standingAtStartingSquare;
  }

  function evaluatePlayerMobilityTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    teamRerolls = 0,
    startX = 2,
    row,
    maxCandidateDistance,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateOpenStraightRoute || !engine.getPitchDimensions) {
      throw new Error("Bloodboard route and pitch-dimension APIs are required for mobility task observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    const hasSpecialRules = Array.isArray(player.specialRules)
      ? player.specialRules.length > 0
      : player.specialRules && typeof player.specialRules === "object"
        ? Object.keys(player.specialRules).length > 0
        : String(player.specialRules || "").trim().length > 0;
    const hasSpecialEffects = Array.isArray(player.specialEffectCodes)
      ? player.specialEffectCodes.length > 0
      : !!player.specialEffectCodes;
    const canonicalStarId = engine.resolveStarId?.(player) || null;
    if ((hasSpecialRules || hasSpecialEffects) && !canonicalStarId) {
      throw new Error("This mobility task has Star Player effects but no canonical star identity; translated rule text or effect labels alone cannot be resolved by Bloodboard.");
    }
    if (canonicalStarId && format === "sevens") {
      throw new Error("Star Players are not legal in the Sevens mobility benchmark.");
    }
    const skills = (player.skills || []).slice();
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === boughtSkillId)) skills.push(boughtSkillId);
    }
    const evaluatedPlayer = Object.assign({}, player, { skills }, canonicalStarId ? { star: canonicalStarId } : {});
    const noBall = skills.some(skill => (typeof skill === "string" ? skill : skill && skill.id) === "noBall");
    const pitch = engine.getPitchDimensions(format);
    const resolvedRow = row === undefined ? Math.floor(pitch.height / 2) : row;
    const boardDistanceLimit = pitch.width - 1 - startX;
    if (!Number.isInteger(startX) || startX < 0 || startX >= pitch.width - 1) throw new RangeError("startX must leave at least one square before the pitch edge.");
    if (!Number.isInteger(resolvedRow) || resolvedRow < 0 || resolvedRow >= pitch.height) throw new RangeError("row is outside the selected pitch.");
    if (maxCandidateDistance !== undefined && (!Number.isInteger(maxCandidateDistance) || maxCandidateDistance < 1)) {
      throw new RangeError("maxCandidateDistance must be a positive integer.");
    }
    const scanLimit = Math.min(boardDistanceLimit, maxCandidateDistance === undefined ? boardDistanceLimit : maxCandidateDistance);
    const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const observations = [];
    const openRouteCurve = [];
    const touchdownCurve = [];
    let firstIllegalDistance = null;
    const provenanceFor = api => ({
      engineId: engine.META.id,
      engineVersion: engine.META.version,
      engineSha256: engine.META.sha256,
      api
    });
    const recordCurve = (route, submetricId, distance, objective, branch) => {
      const outcome = route.taskOutcomes[branch];
      const probability = outcome && outcome.successProbability;
      if (!probability) throw new Error("Bloodboard did not return the declared task event for " + branch + ".");
      const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
      const observation = recordTaskResult({
        submetricId,
        subjectId,
        result: {
          lowerBound: probability.lowerBound,
          upperBound: probability.upperBound,
          exact: probability.exact,
          unresolved: outcome.unresolved
        },
        context: {
          format,
          boardState: {
            scenario: route.scenario.id,
            assumption: route.scenario.assumption,
            start: route.scenario.start,
            target: route.scenario.target,
            heldBall: objective === "touchdown"
          },
          opponentProfile: null,
          supportState: { teammates: [], opponentTackleZones: [] },
          rerollPool: allowedRerolls,
          taskParameters: {
            objective,
            distance,
            start: route.scenario.start,
            target: route.scenario.target,
            initialTeamRerolls: teamRerolls,
            rerollPolicy: allowedRerolls ? "engine may spend declared team pool" : "team rerolls unavailable"
          },
          timepoint: route.taskOutcomes.timepoint,
          event: route.taskOutcomes.event
        },
        provenance: provenanceFor("calculateOpenStraightRoute+evaluateTerminalEvent")
      });
      observations.push(observation);
      return {
        distance,
        rerollPolicy: allowedRerolls ? "team-rerolls-allowed" : "no-team-rerolls",
        legal: outcome.legal,
        successProbability: probability,
        unresolved: outcome.unresolved,
        taskKey: observation.taskKey
      };
    };

    for (let distance = 1; distance <= scanLimit; distance++) {
      const route = engine.calculateOpenStraightRoute({
        player: evaluatedPlayer,
        format,
        distance,
        startX,
        row: resolvedRow,
        teamRerolls,
        planOptions
      });
      if (!route.summary || !route.summary.legal) {
        firstIllegalDistance = { distance, errors: route.summary && route.summary.errors || [] };
        break;
      }
      const branchesForDistance = branches.map(branch => recordCurve(route, "mobility.openRoute", distance, "standing-arrival", branch));
      openRouteCurve.push({
        distance,
        standingArrival: branchesForDistance,
        summary: {
          maximumMovement: route.summary.maximumMovement,
          rushes: route.scenario.distance > route.scenario.actor.profile.ma
            ? route.scenario.distance - route.scenario.actor.profile.ma
            : 0
        }
      });
      if (noBall) continue;
      const scoreRun = engine.calculateOpenStraightRoute({
        player: evaluatedPlayer,
        format,
        distance,
        scoreRun: true,
        row: resolvedRow,
        teamRerolls,
        planOptions
      });
      if (!scoreRun.summary || !scoreRun.summary.legal) {
        touchdownCurve.push({ distance, status: "illegal-engine-action", errors: scoreRun.summary && scoreRun.summary.errors || [] });
        continue;
      }
      const touchdownBranches = branches.map(branch => recordCurve(scoreRun, "mobility.touchdown", distance, "standing-ball-carrier-touchdown", branch));
      touchdownCurve.push({ distance, status: "engine-observed", outcomes: touchdownBranches });
    }

    return {
      subjectId,
      engine: engine.META,
      status: "engine-observed-distance-curves; full-drive-and-pressure-chain-pending",
      scenario: {
        format,
        row: resolvedRow,
        startX,
        startAssumption: "Open straight lane; no opponent tackle zones, screen, teammate support or weather modifier.",
        scanLimit,
        firstIllegalDistance,
        maximumLegalMovementDistance: openRouteCurve.length ? openRouteCurve[openRouteCurve.length - 1].distance : 0,
        maximumLegalMovementStatus: firstIllegalDistance
          ? "engine-rejected-next-distance"
          : scanLimit < boardDistanceLimit
            ? "scan-limit-reached"
            : "pitch-limited",
        teamRerolls
      },
      constraints: {
        cannotCarryBall: noBall,
        fastAttackScoringEligibility: noBall ? "cannot carry or score; aggregate Fast Attack and Ball Control are hard-capped at the minimum grade while raw unballasted movement remains available" : "eligible"
      },
      openRouteCurve,
      touchdownCurve: noBall
        ? { status: "unavailable-player-cannot-carry-ball", observations: [] }
        : { status: "engine-observed", outcomes: touchdownCurve },
      observations,
      taskProfile: buildTaskProfile(subjectId, observations, evaluatedPlayer)
    };
  }

  function evaluatePlayerDynamicControlTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    teamRerolls = 0,
    startX = 2,
    row,
    distance = 6,
    screen,
    startRuleTargetIndex = null,
    supportPlayers = [],
    seed = 1,
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateMarkedRouteControl || !engine.getPitchDimensions) {
      throw new Error("Bloodboard marked-route control-footprint API is required for dynamic-control observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!Array.isArray(screen) || !screen.length) throw new TypeError("An explicit opposing screen is required; control tasks are not inferred from a generic opponent.");
    if (!Array.isArray(supportPlayers)) throw new TypeError("supportPlayers must be an array of fixed teammate placements.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");

    const specialRuleText = typeof player.specialRules === "string"
      ? player.specialRules
      : JSON.stringify(player.specialRules || "");
    const hasSpecialRules = Array.isArray(player.specialRules)
      ? player.specialRules.length > 0
      : player.specialRules && typeof player.specialRules === "object"
        ? Object.keys(player.specialRules).length > 0
        : String(player.specialRules || "").trim().length > 0;
    const hasSpecialEffects = Array.isArray(player.specialEffectCodes)
      ? player.specialEffectCodes.length > 0
      : !!player.specialEffectCodes;
    const canonicalStarId = engine.resolveStarId?.(player) || null;
    if ((hasSpecialRules || hasSpecialEffects) && !canonicalStarId) {
      throw new Error("This dynamic-control task needs a canonical Star Player identity to resolve declared Star Player rules; translated rule text cannot be applied by itself.");
    }
    const hasIncorporeal = player.id === "gretchen" && /incorporeal|虚影/i.test(specialRuleText);
    const hasBlackInk = player.id === "kiroth" && /black ink|黑墨汁/i.test(specialRuleText);
    const hasZoatQuestion = player.id === "zolcath" && /excuse me|zoat|龙蜥/i.test(specialRuleText);
    const dynamicStarId = hasIncorporeal ? "gretchen" : hasBlackInk ? "kiroth" : hasZoatQuestion ? "zolcath" : null;
    const dynamicRuleScenarioId = hasIncorporeal ? "incorporeal-used" : hasBlackInk ? "black-ink-used" : "zoat-question-used";
    const dynamicRuleLabel = hasIncorporeal
      ? "Gretchen Wächter: Incorporeal, once per game at activation start"
      : hasBlackInk ? "Kiroth Krakeneye: Black Ink, once per game at activation start"
        : hasZoatQuestion ? "Zolcath the Zoat: Excuse Me, Are You a Zoat?, once per game at activation start" : null;
    const dynamicRuleTargetRange = hasBlackInk ? 1 : hasZoatQuestion ? 3 : null;
    if (canonicalStarId && format === "sevens") {
      throw new Error("Star Player dynamic-control tasks are excluded from Sevens under the current evaluation scope.");
    }
    if (dynamicRuleTargetRange !== null) {
      if (!Number.isInteger(startRuleTargetIndex) || startRuleTargetIndex < 0 || startRuleTargetIndex >= screen.length) {
        throw new TypeError("This targeted Star Player control task requires an explicit startRuleTargetIndex into the declared screen.");
      }
      const ruleTarget = screen[startRuleTargetIndex];
      const startRow = row === undefined ? Math.floor(engine.getPitchDimensions(format).height / 2) : row;
      if (Math.max(Math.abs(ruleTarget.at.x - startX), Math.abs(ruleTarget.at.y - startRow)) > dynamicRuleTargetRange) {
        throw new Error(`${player.name}'s selected Star Player control target must be within ${dynamicRuleTargetRange} square${dynamicRuleTargetRange === 1 ? "" : "s"} at activation start.`);
      }
    } else if (startRuleTargetIndex !== null) {
      throw new TypeError("startRuleTargetIndex is only used for rules that select a control target.");
    }

    const skills = (player.skills || []).map(skill => typeof skill === "string" ? skill : skill && skill.id).filter(Boolean);
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.includes(boughtSkillId)) skills.push(boughtSkillId);
    }
    const pitch = engine.getPitchDimensions(format);
    const resolvedRow = row === undefined ? Math.floor(pitch.height / 2) : row;
    const target = { x: startX + distance, y: resolvedRow };
    const actorProfile = {
      name: player.name || player.position || "Evaluation player",
      ma: Number(player.ma) || 6,
      st: Number(player.st) || 3,
      ag: Number(player.ag) || 3,
      pa: player.pa === undefined ? null : player.pa,
      av: Number(player.av) || 9,
      skills
    };
    const profileContext = profile => ({
      name: profile.name || profile.position || "Reference player",
      ma: Number(profile.ma) || 6,
      st: Number(profile.st) || 3,
      ag: Number(profile.ag) || 3,
      pa: profile.pa === undefined ? null : profile.pa,
      av: Number(profile.av) || 9,
      skills: (profile.skills || []).map(skill => typeof skill === "string" ? skill : skill && skill.id).filter(Boolean).sort()
    });
    const normalizedScreen = screen.map(entry => ({
      at: { x: entry.at.x, y: entry.at.y },
      profile: profileContext(entry.profile)
    }));
    const normalizedSupport = supportPlayers.map(entry => ({
      at: { x: entry.at.x, y: entry.at.y },
      profile: profileContext(entry.profile)
    }));
    const ruleScenarios = [
      { id: "rule-not-used", useStartRule: false },
      ...(dynamicStarId ? [{ id: dynamicRuleScenarioId, useStartRule: true }] : [])
    ];
    const observations = [];
    const results = {};

    for (const ruleScenario of ruleScenarios) {
      const route = engine.calculateMarkedRouteControl({
        player: { ...player, skills: (player.skills || []).slice() },
        format,
        distance,
        startX,
        row: resolvedRow,
        screen,
        supportPlayers,
        teamRerolls,
        seed,
        planOptions,
        starId: canonicalStarId,
        starTargetIndex: dynamicRuleTargetRange === null ? null : startRuleTargetIndex,
        useStartRule: ruleScenario.useStartRule
      });
      if (!route.summary.legal || !route.controlFootprint || route.controlFootprint.status !== "engine-enumerated-fixed-action-sequence") {
        throw new Error("Bloodboard could not exactly enumerate the declared dynamic-control route: " + (route.summary.errors || []).join("; "));
      }
      if (route.event.playerId !== "A1") throw new Error("The adapter's actor identifier changed; update the task event before recording observations.");
      const byRerollPolicy = {};
      for (const branch of ["withoutTeamRerolls", "withTeamRerolls"]) {
        const branchResult = route.controlFootprint[branch];
        const footprints = branchResult.teamTackleZoneFootprints;
        const ownFootprint = footprints && footprints.A;
        const opponentFootprint = footprints && footprints.B;
        const ownDelta = ownFootprint && ownFootprint.expectedChangeFromInitial;
        const opponentDelta = opponentFootprint && opponentFootprint.expectedChangeFromInitial;
        if (!branchResult.legal || !ownDelta || !opponentDelta) throw new Error("Bloodboard omitted a side's dynamic-control footprint for " + branch + ".");
        const netControlDelta = {
          lowerBound: ownDelta.lowerBound - opponentDelta.upperBound,
          upperBound: ownDelta.upperBound - opponentDelta.lowerBound,
          exact: ownDelta.exact && opponentDelta.exact,
          unresolved: (Number(ownDelta.unresolved) || 0) + (Number(opponentDelta.unresolved) || 0)
        };
        if (netControlDelta.exact) netControlDelta.value = (netControlDelta.lowerBound + netControlDelta.upperBound) / 2;
        const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
        const observation = recordTaskResult({
          submetricId: "control.dynamic",
          subjectId,
          result: {
            lowerBound: netControlDelta.lowerBound,
            upperBound: netControlDelta.upperBound,
            exact: netControlDelta.exact,
            unresolved: netControlDelta.unresolved
          },
          context: {
            format,
            boardState: {
              scenario: "fixed-screen-control-reposition",
              start: { x: startX, y: resolvedRow },
              target,
              initialUniqueTeamTackleZoneSquares: ownFootprint.initialUniqueTackleZoneSquares,
              initialUniqueOpponentTackleZoneSquares: opponentFootprint.initialUniqueTackleZoneSquares,
              selectedStarRuleTarget: route.scenario.starRuleUse && route.scenario.starRuleUse.target,
              starRuleUse: ruleScenario.id
            },
            opponentProfile: { screen: normalizedScreen },
            supportState: { teammates: normalizedSupport },
            rerollPool: allowedRerolls,
            taskParameters: {
              timepoint: "activation-ended; stop at earlier Turnover or touchdown",
              action: "Move",
              path: route.scenario.selectedPath,
              evaluatedPlayer: actorProfile,
              canonicalStarId,
              automaticStarRules: "Canonical identity is passed to Bloodboard; applicable automatic effects are resolved by the engine. Only the three explicitly modeled activation-start control rules receive an additional use/not-used comparison.",
              starRuleUse: ruleScenario.useStartRule ? dynamicRuleLabel : "not used",
              rerollPolicy: allowedRerolls ? "Bloodboard may spend the declared team pool" : "team rerolls unavailable",
              measuredState: "expected net control footprint: own unique Tackle Zone squares gained minus opponent unique Tackle Zone squares gained after action resolution"
            },
            event: route.event
          },
          provenance: {
            engineId: route.engine.id,
            engineVersion: route.engine.version,
            engineSha256: route.engine.sha256,
            api: "calculateMarkedRouteControl+evaluateActionSequence"
          }
        });
        observations.push(observation);
        byRerollPolicy[branch] = {
          expectedTeamControlSquareDelta: ownDelta,
          expectedOpponentControlSquareDelta: opponentDelta,
          expectedNetControlFootprintDelta: netControlDelta,
          standingAtTarget: branchResult.taskSuccessProbability,
          turnover: branchResult.turnoverProbability,
          terminalCoverage: {
            own: ownFootprint.expectedTerminalUniqueTackleZoneSquares,
            opponent: opponentFootprint.expectedTerminalUniqueTackleZoneSquares
          },
          observation
        };
      }
      results[ruleScenario.id] = { route, byRerollPolicy };
    }

    const ruleEffectDeltaByRerollPolicy = dynamicStarId ? Object.fromEntries(["withoutTeamRerolls", "withTeamRerolls"].map(branch => {
      const before = results["rule-not-used"].byRerollPolicy[branch].expectedNetControlFootprintDelta;
      const after = results[dynamicRuleScenarioId].byRerollPolicy[branch].expectedNetControlFootprintDelta;
      const exact = before.exact && after.exact;
      const lowerBound = after.lowerBound - before.upperBound;
      const upperBound = after.upperBound - before.lowerBound;
      return [branch, { value: exact ? (lowerBound + upperBound) / 2 : null, lowerBound, upperBound, exact }];
    })) : null;

    return {
      subjectId,
      engine: engine.META,
      status: "engine-enumerated-fixed-route-net-control-footprint; match-frequency-and-axis-calibration-pending",
      scenario: {
        format,
        start: { x: startX, y: resolvedRow },
        target,
        distance,
        screen: normalizedScreen,
        startRuleTargetIndex: dynamicRuleTargetRange === null ? null : startRuleTargetIndex,
        startRuleTarget: dynamicRuleTargetRange === null ? null : normalizedScreen[startRuleTargetIndex],
        supportPlayers: normalizedSupport,
        teamRerolls,
        noBall: skills.includes("noBall"),
        noBallDimensionRule: "No Ball caps the aggregate Fast Attack and Ball Control axes at the minimum grade; unballasted movement remains raw evidence and spatial Control is unaffected."
      },
      results,
      ruleEffectDeltaByRerollPolicy,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations, player)
    };
  }

  function evaluatePlayerScreenCrossingTasks(player, {
    subjectId = player && player.id,
    format = "11s",
    teamRerolls = 1,
    startX = 2,
    row,
    distance = 6,
    screen,
    supportPlayers = [],
    useStartRule = false,
    startRuleTargetIndex = null,
    scoreRun = false,
    routePolicy = "compare",
    planOptions = {}
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || !engine.calculateScreenCrossingRoute || !engine.getPitchDimensions) {
      throw new Error("Bloodboard screen-route and pitch-dimension APIs are required for crossing observations.");
    }
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable string subjectId is required.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!Number.isInteger(distance) || distance < 1) throw new RangeError("distance must be a positive integer.");
    if (!Array.isArray(supportPlayers)) throw new TypeError("supportPlayers must be an array of fixed teammate placements.");
    if (screen !== undefined && screen !== null && !Array.isArray(screen)) throw new TypeError("screen must be an array of fixed opponent placements.");
    if (typeof useStartRule !== "boolean") throw new TypeError("useStartRule must be a boolean.");
    if (startRuleTargetIndex !== null && (!Number.isInteger(startRuleTargetIndex) || startRuleTargetIndex < 0)) {
      throw new TypeError("startRuleTargetIndex must be null or a non-negative integer selecting a declared screen player.");
    }
    if (typeof scoreRun !== "boolean") throw new TypeError("scoreRun must be a boolean.");
    if (!["compare", "fixed", "bloodboard-candidate"].includes(routePolicy)) {
      throw new RangeError("routePolicy must be 'compare', 'fixed', or 'bloodboard-candidate'.");
    }
    const declaresStarRule = profile => {
      if (!profile) return false;
      const rules = profile.specialRules;
      const hasRules = Array.isArray(rules) ? rules.length > 0 : rules && typeof rules === "object"
        ? Object.keys(rules).length > 0 : String(rules || "").trim().length > 0;
      const effects = profile.specialEffectCodes;
      return hasRules || (Array.isArray(effects) ? effects.length > 0 : !!effects) ||
        (Array.isArray(profile.specialEffects) ? profile.specialEffects.length > 0 : !!profile.specialEffects);
    };
    const withCanonicalStar = (profile, scope) => {
      const starId = engine.resolveStarId?.(profile) || null;
      if (declaresStarRule(profile) && !starId) {
        throw new Error(`${scope} declares Star Player rules without a matching canonical Star Player identity; translated rule text cannot be applied by itself.`);
      }
      return starId && !profile.star ? { ...profile, star: starId } : profile;
    };
    const canonicalStarId = withCanonicalStar(player, "The evaluated mover").star || engine.resolveStarId?.(player) || null;
    const skills = (player.skills || []).slice();
    if (player.boughtSkill) {
      const boughtSkillId = typeof player.boughtSkill === "string" ? player.boughtSkill : player.boughtSkill.id;
      if (boughtSkillId && !skills.some(skill => (typeof skill === "string" ? skill : skill.id) === boughtSkillId)) skills.push(boughtSkillId);
    }
    const evaluatedPlayer = Object.assign({}, player, { skills }, canonicalStarId ? { star: canonicalStarId } : {});
    const evaluatedScreen = screen && screen.map((entry, index) => {
      if (!entry || typeof entry !== "object" || !entry.profile) throw new TypeError(`screen[${index}] must contain a player profile.`);
      return { ...entry, profile: withCanonicalStar(entry.profile, `Screen player ${index + 1}`) };
    });
    const evaluatedSupportPlayers = supportPlayers.map((entry, index) => {
      if (!entry || typeof entry !== "object" || !entry.profile) throw new TypeError(`supportPlayers[${index}] must contain a player profile.`);
      return { ...entry, profile: withCanonicalStar(entry.profile, `Support player ${index + 1}`) };
    });
    const pitch = engine.getPitchDimensions(format);
    const cannotCarry = skills.some(skill => (typeof skill === "string" ? skill : skill && skill.id) === "noBall");
    if (scoreRun && cannotCarry) {
      return {
        subjectId,
        engine: engine.META,
        status: "unavailable-player-cannot-carry-ball",
        scenario: { format, objective: "standing touchdown through a declared screen", reason: "Bloodboard No Ball rule forbids the player from carrying the ball." },
        routes: [],
        routeComparisons: [],
        outcomes: [],
        observations: [],
        taskProfile: buildTaskProfile(subjectId, [], evaluatedPlayer)
      };
    }
    const resolvedRow = row === undefined ? Math.floor(pitch.height / 2) : row;
    const routeStartX = scoreRun ? pitch.width - 1 - distance : startX;
    const targetX = scoreRun ? pitch.width - 1 : routeStartX + distance;
    if (!Number.isInteger(routeStartX) || routeStartX < 0 || targetX >= pitch.width) {
      throw new RangeError("The declared screen-crossing route must start and finish inside the selected pitch.");
    }
    if (!Number.isInteger(resolvedRow) || resolvedRow < 0 || resolvedRow >= pitch.height) {
      throw new RangeError("row is outside the selected pitch.");
    }
    const defaultScreenRow = resolvedRow + 1 < pitch.height ? resolvedRow + 1 : resolvedRow - 1;
    const defaultOffsets = distance > 1 ? [1, distance] : [1];
    const screenLayout = screen || defaultOffsets.map((offset, index) => ({
      at: { x: routeStartX + offset, y: defaultScreenRow },
      profile: { name: "Reference screen " + (index + 1), position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] }
    }));
    const routePolicies = routePolicy === "compare" ? ["fixed", "bloodboard-candidate"] : [routePolicy];
    const routeReports = [];
    const observations = [];
    const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    for (const selectedPolicy of routePolicies) {
      let route;
      try {
        route = engine.calculateScreenCrossingRoute({
          player: evaluatedPlayer,
          format,
          distance,
          startX: routeStartX,
          row: resolvedRow,
          screen: evaluatedScreen || screenLayout,
          supportPlayers: evaluatedSupportPlayers,
          scoreRun,
          routePolicy: selectedPolicy,
          teamRerolls,
          starId: canonicalStarId,
          useStartRule,
          starTargetIndex: startRuleTargetIndex,
          planOptions
        });
      } catch (error) {
        if (selectedPolicy === "bloodboard-candidate" && String(error && error.message || error).includes("could not find a path")) {
          routeReports.push({ routePolicy: selectedPolicy, status: "no-route-within-movement-budget", error: String(error.message || error) });
          continue;
        }
        throw error;
      }
      if (!route.summary || !route.summary.legal) {
        routeReports.push({
          routePolicy: selectedPolicy,
          status: "illegal-screen-crossing-scenario",
          scenario: route.scenario,
          errors: route.summary && route.summary.errors || []
        });
        continue;
      }
      const outcomes = branches.map(branch => {
        const terminal = route.taskOutcomes && route.taskOutcomes[branch];
        const probability = terminal && terminal.successProbability;
        if (!probability) throw new Error("Bloodboard did not return the screen-crossing event for " + branch + ".");
        const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
        const pathContext = route.scenario.selectedPath.map(step => step.to);
        const observation = recordTaskResult({
          submetricId: scoreRun ? "mobility.screenedTouchdown" : "mobility.crossScreen",
          subjectId,
          result: {
            lowerBound: probability.lowerBound,
            upperBound: probability.upperBound,
            exact: probability.exact,
            unresolved: terminal.unresolved
          },
          context: {
            format,
            boardState: {
              scenario: route.scenario.id,
              start: route.scenario.start,
              target: route.scenario.target,
              fixedScreen: (route.scenario.screen || []).map(marker => ({ at: marker.at, profile: marker.profile }))
            },
            opponentProfile: (route.scenario.screen || []).map(marker => marker.profile),
            supportState: {
              teammates: (route.scenario.supportPlayers || []).map(teammate => ({ id: teammate.id, profile: teammate.profile, at: teammate.at })),
              opponentTackleZones: (route.scenario.screen || []).map(marker => marker.at)
            },
            rerollPool: allowedRerolls,
            taskParameters: {
              objective: scoreRun
                ? "held-ball carrier completes a standing touchdown beyond the declared screen"
                : "stand beyond the declared screen at the same target square",
              routePolicy: selectedPolicy === "fixed" ? "declared-straight-path" : "Bloodboard safestRoute heuristic candidate path",
              selectedPath: pathContext,
              selectorEstimate: route.scenario.routeSelectorEstimate,
              start: route.scenario.start,
              target: route.scenario.target,
              distance,
              initialTeamRerolls: teamRerolls,
              starRuleUse: route.scenario.starRuleUse,
              rerollPolicy: allowedRerolls ? "Bloodboard may spend the declared shared team reroll pool" : "team rerolls unavailable"
            },
            timepoint: route.taskOutcomes.timepoint,
          event: route.taskOutcomes.event
          },
          provenance: {
            engineId: engine.META.id,
            engineVersion: engine.META.version,
            engineSha256: engine.META.sha256,
            api: "safestRoute?+calculateScreenCrossingRoute+evaluateTerminalEvent"
          }
        });
        observations.push(observation);
        return {
          rerollPolicy: allowedRerolls ? "team-rerolls-allowed" : "no-team-rerolls",
          successProbability: probability,
          turnoverProbability: terminal.turnoverProbability,
          unresolved: terminal.unresolved,
          taskKey: observation.taskKey
        };
      });
      routeReports.push({
        routePolicy: selectedPolicy,
        status: "engine-observed-selected-path",
        scenario: route.scenario,
        selectedPath: route.scenario.selectedPath,
        starRuleAppliedEvents: (route.plan?.traceEvents || []).filter(event =>
          canonicalStarId && event.data?.star === canonicalStarId),
        routeSelectorEstimate: route.scenario.routeSelectorEstimate,
        outcomes
      });
    }
    const intervalDelta = (after, before) => after && before ? {
      lowerBound: after.lowerBound - before.upperBound,
      upperBound: after.upperBound - before.lowerBound,
      exact: after.exact && before.exact
    } : null;
    const fixedRoute = routeReports.find(report => report.routePolicy === "fixed" && report.status === "engine-observed-selected-path");
    const candidateRoute = routeReports.find(report => report.routePolicy === "bloodboard-candidate" && report.status === "engine-observed-selected-path");
    const outcomes = routeReports.flatMap(report => (report.outcomes || []).map(outcome => ({
      routePolicy: report.routePolicy,
      ...outcome
    })));
    const routeComparisons = fixedRoute && candidateRoute
      ? branches.map(branch => {
        const fixed = fixedRoute.outcomes.find(outcome => outcome.rerollPolicy === (branch === "withTeamRerolls" ? "team-rerolls-allowed" : "no-team-rerolls"));
        const candidate = candidateRoute.outcomes.find(outcome => outcome.rerollPolicy === (branch === "withTeamRerolls" ? "team-rerolls-allowed" : "no-team-rerolls"));
        return {
          rerollPolicy: fixed && fixed.rerollPolicy,
          candidateMinusStraightSuccess: intervalDelta(candidate && candidate.successProbability, fixed && fixed.successProbability),
          candidateMinusStraightTurnover: intervalDelta(candidate && candidate.turnoverProbability, fixed && fixed.turnoverProbability),
          samePath: JSON.stringify(fixedRoute.selectedPath) === JSON.stringify(candidateRoute.selectedPath)
        };
      })
      : [];
    const referenceScenario = routeReports.find(report => report.scenario)?.scenario;
    return {
      subjectId,
      engine: engine.META,
      status: observations.length
        ? scoreRun
          ? "engine-observed-fixed-and-candidate-screened-touchdown-paths; exact-probability-per-selected-path; global-route-optimality-pending"
          : "engine-observed-fixed-and-candidate-screen-crossing-paths; exact-probability-per-selected-path; global-route-optimality-pending"
        : scoreRun ? "no-legal-screened-touchdown-route-observed" : "no-legal-screen-crossing-route-observed",
      scenario: {
        format,
        start: referenceScenario && referenceScenario.start,
        target: referenceScenario && referenceScenario.target,
        distance,
        scoreRun,
        screen: referenceScenario && referenceScenario.screen,
        supportPlayers: referenceScenario && referenceScenario.supportPlayers,
        teamRerolls,
        routePolicy,
        limitation: "The Bloodboard safestRoute result is one heuristic-selected candidate, not a proof of the globally safest path. Its approximate path score is separate from exact rule-engine success/Turnover intervals. Declared teammate profiles remain fixed and the engine can resolve their passive/activation interactions, but teammate actions, assists and full-drive sequence are not included."
      },
      routes: routeReports,
      routeComparisons,
      outcomes,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations)
    };
  }

  function evaluatePlayerScreenedTouchdownTasks(player, options = {}) {
    return evaluatePlayerScreenCrossingTasks(player, { ...options, scoreRun: true });
  }

  function evaluateTeamGazeAssistedTouchdownTasks({
    subjectId,
    format = "11s",
    teamRerolls = 0,
    distance = 8,
    row,
    openerStarRule = false,
    openerStarTarget,
    carrierStarRule = false,
    carrierStarTarget,
    carrier = { name: "Vampire Runner", position: "Vampire Runner", ma: 8, st: 3, ag: 2, pa: 3, av: 8, skills: [{ id: "bloodlust", value: 2 }, { id: "hypnoticGaze" }, { id: "regeneration" }], keywords: ["Vampire", "Runner"] },
    opener = { name: "Vampire Blitzer", position: "Vampire Blitzer", ma: 6, st: 4, ag: 2, pa: 4, av: 9, skills: [{ id: "bloodlust", value: 3 }, { id: "hypnoticGaze" }, { id: "juggernaut" }, { id: "regeneration" }], keywords: ["Vampire", "Blitzer"] },
    opponent = { name: "Reference screen defender", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    thrall = { name: "Reference Thrall", position: "Thrall Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [], keywords: ["Thrall"] },
    planOptions = { threshold: 1e-12, maxExpandedStates: 20000 }
  } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateGazeAssistedTouchdown !== "function") {
      throw new Error("Bloodboard's fixed Gaze-assisted team-touchdown API is required.");
    }
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable team subjectId is required.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    const declaresStarRule = player => {
      const rules = player.specialRules;
      const hasRules = Array.isArray(rules) ? rules.length > 0 : rules && typeof rules === "object"
        ? Object.keys(rules).length > 0 : String(rules || "").trim().length > 0;
      const effects = player.specialEffectCodes;
      const hasEffects = Array.isArray(effects) ? effects.length > 0 : !!effects;
      const alternateEffects = player.specialEffects;
      return hasRules || hasEffects || (Array.isArray(alternateEffects) ? alternateEffects.length > 0 : !!alternateEffects);
    };
    const withCanonicalStar = (player, scope) => {
      const starId = engine.resolveStarId?.(player) || null;
      if (declaresStarRule(player) && !starId) {
        throw new Error(`${scope} declares Star Player rules without a matching canonical Star Player identity; translated rule text cannot be applied by itself.`);
      }
      return starId && !player.star ? { ...player, star: starId } : player;
    };
    const evaluatedCarrierBase = withCanonicalStar(carrier, "The touchdown carrier");
    const evaluatedOpenerBase = withCanonicalStar(opener, "The Hypnotic Gaze opener");
    const evaluatedOpponent = withCanonicalStar(opponent, "The screen defender");
    const evaluatedThrall = withCanonicalStar(thrall, "The support Thrall");
    const carrierSkills = (evaluatedCarrierBase.skills || []).slice();
    if (evaluatedCarrierBase.boughtSkill) {
      const id = typeof evaluatedCarrierBase.boughtSkill === "string" ? evaluatedCarrierBase.boughtSkill : evaluatedCarrierBase.boughtSkill.id;
      if (id && !carrierSkills.some(skill => (typeof skill === "string" ? skill : skill.id) === id)) carrierSkills.push(id);
    }
    const openerSkills = (evaluatedOpenerBase.skills || []).slice();
    if (evaluatedOpenerBase.boughtSkill) {
      const id = typeof evaluatedOpenerBase.boughtSkill === "string" ? evaluatedOpenerBase.boughtSkill : evaluatedOpenerBase.boughtSkill.id;
      if (id && !openerSkills.some(skill => (typeof skill === "string" ? skill : skill.id) === id)) openerSkills.push(id);
    }
    const evaluatedCarrier = Object.assign({}, evaluatedCarrierBase, { skills: carrierSkills });
    const evaluatedOpener = Object.assign({}, evaluatedOpenerBase, { skills: openerSkills });
    const route = engine.calculateGazeAssistedTouchdown({
      carrier: evaluatedCarrier,
      opener: evaluatedOpener,
      opponent: evaluatedOpponent,
      thrall: evaluatedThrall,
      format,
      distance,
      row,
      teamRerolls,
      openerStarRule,
      openerStarTarget,
      carrierStarRule,
      carrierStarTarget,
      planOptions
    });
    const openerRoleSubjectId = typeof opener.id === "string" && opener.id.trim() ? opener.id : subjectId + ":opener";
    const screenDistractedEvent = { type: "playerDistracted", playerId: route.scenario.actorIds.screen };
    const openerAction = engine.evaluateActionSequence({
      state: route.replay.state,
      inputs: [route.replay.openerInput, { kind: "endActivation" }],
      event: screenDistractedEvent,
      options: planOptions
    });
    const openerRoleObservations = (teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"]).map(policy => {
      const branch = openerAction[policy];
      if (!branch?.legal) throw new Error("Bloodboard rejected the declared Hypnotic Gaze opener task: " + (branch?.errors || []).join("; "));
      return recordTaskResult({
        submetricId: "adaptability.roleCoverage",
        subjectId: openerRoleSubjectId,
        result: { ...branch.taskSuccessProbability, unresolved: branch.unresolved },
        context: {
          format,
          boardState: route.replay.state,
          opponentProfile: [evaluatedOpponent],
          supportState: {
            roleId: "support",
            opener: evaluatedOpener,
            carrier: evaluatedCarrier,
            screenPlayerId: route.scenario.actorIds.screen,
            adjacentThrall: route.scenario.opener.adjacentThrall
          },
          rerollPool: policy === "withTeamRerolls" ? teamRerolls : 0,
          taskParameters: {
            roleId: "support",
            benchmarkId: "hypnotic-gaze-distract-screen-v347",
            timepoint: "after declared Hypnotic Gaze activation ends",
            sequence: [route.replay.openerInput, { kind: "endActivation" }],
            successDefinition: "The named standing screen opponent is Distracted after the opener activation and Bloodlust fallback resolve.",
            opportunity: "One declared adjacent screen; a Gaze check changed to Move by Bloodlust is not counted as a successful opening.",
            rerollPolicy: policy === "withTeamRerolls" ? "one shared team reroll available to opener action" : "team rerolls unavailable",
            accountingNote: "Role task success is a distinct event from the downstream touchdown outcome; it is not itself an extra team scoring probability."
          },
          event: screenDistractedEvent
        },
        provenance: {
          engineId: engine.META.id, engineVersion: engine.META.version, engineSha256: engine.META.sha256,
          api: "calculateGazeAssistedTouchdown+evaluateActionSequence+playerDistracted terminal event"
        }
      });
    });
    const sequences = [
      { id: "withoutGazeOpening", label: "无催眠开路、固定直线路径", routePolicy: "fixed-straight", usesGaze: false, sequence: route.withoutGazeOpening },
      { id: "withoutGazeOpeningCandidate", label: "无催眠开路、按精确结果选择声明路线", routePolicy: "exact-best-among-declared-lanes-before-gaze", usesGaze: false, sequence: route.withoutGazeOpeningCandidate },
      { id: "withGazeOpening", label: "催眠开路、仍走固定直线路径", routePolicy: "fixed-straight-after-gaze", usesGaze: true, sequence: route.withGazeOpening },
      { id: "withGazeOpeningAdaptiveCandidate", label: "开路行动后按状态精确选择声明路线", routePolicy: "exact-best-among-declared-lanes-after-opener-activation", usesGaze: true, sequence: route.withGazeOpeningAdaptiveCandidate }
    ];
    const branchIds = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
    const observations = [];
    const evaluatedCases = sequences.map(item => {
      const outcomes = branchIds.map(branch => {
        const result = item.sequence[branch];
        const probability = result && result.taskSuccessProbability;
        if (!probability) throw new Error("Bloodboard did not return the team touchdown event for " + item.id + "/" + branch + ".");
        if (!result.legal) throw new Error("Bloodboard rejected the fixed vampire team scoring sequence: " + result.errors.join("; "));
        const allowedRerolls = branch === "withTeamRerolls" ? teamRerolls : 0;
        const observation = recordTaskResult({
          submetricId: "mobility.teamScoringChain",
          subjectId,
          result: {
            lowerBound: probability.lowerBound,
            upperBound: probability.upperBound,
            exact: probability.exact,
            unresolved: result.unresolved
          },
          context: {
            format,
            boardState: route.scenario,
            opponentProfile: [evaluatedOpponent],
            supportState: {
              gazeOpener: { profile: evaluatedOpener, actsBeforeCarrier: item.usesGaze },
              thralls: [route.scenario.opener.adjacentThrall, route.scenario.carrier.adjacentGoalThrall]
            },
            rerollPool: allowedRerolls,
            taskParameters: {
              timepoint: "activation-ended; stop at earlier Turnover or touchdown",
              objective: "held-ball touchdown across one fixed screen",
              caseId: item.id,
              routePolicy: item.routePolicy,
              actionOrder: item.sequence.scenario.policy,
              distance,
              initialTeamRerolls: teamRerolls,
              starRulePolicy: route.scenario.starRulePolicy,
              rerollPolicy: allowedRerolls ? "Bloodboard spends from the shared declared team reroll pool" : "team rerolls unavailable"
            },
            event: route.scenario.event
          },
          provenance: {
            engineId: engine.META.id,
            engineVersion: engine.META.version,
            engineSha256: engine.META.sha256,
            api: item.routePolicy === "exact-best-among-declared-lanes-after-opener-activation"
              ? "calculateGazeAssistedTouchdown+evaluateActionSequence+exact-declared-route-enumeration(branch-adaptive)"
              : "calculateGazeAssistedTouchdown+evaluateActionSequence"
          }
        });
        observations.push(observation);
        return {
          rerollPolicy: allowedRerolls ? "team-rerolls-allowed" : "no-team-rerolls",
          touchdownProbability: probability,
          turnoverProbability: result.turnoverProbability,
          reachedFinalActionProbability: result.reachedFinalActionProbability,
          routeSelections: result.branchChoices,
          noRouteProbability: result.noActionProbability,
          remainingTeamRerolls: result.remainingTeamRerolls,
          unresolved: result.unresolved,
          taskKey: observation.taskKey
        };
      });
      return { id: item.id, label: item.label, outcomes };
    });
    function comparePolicyOutcomes(branch, comparisonId, baseId, supportedId) {
      const base = route[baseId][branch].taskSuccessProbability;
      const supported = route[supportedId][branch].taskSuccessProbability;
      return {
        comparisonId,
        baseCase: baseId,
        supportedCase: supportedId,
        rerollPolicy: branch === "withTeamRerolls" ? "team-rerolls-allowed" : "no-team-rerolls",
        lowerBound: supported.lowerBound - base.upperBound,
        upperBound: supported.upperBound - base.lowerBound,
        exact: base.exact && supported.exact
      };
    }
    const gazeOpeningDelta = branchIds.flatMap(branch => [
      comparePolicyOutcomes(branch, "gaze-opening-fixed-straight-route", "withoutGazeOpening", "withGazeOpening"),
      comparePolicyOutcomes(branch, "gaze-opening-with-branch-adaptive-route", "withoutGazeOpeningCandidate", "withGazeOpeningAdaptiveCandidate")
    ]);
    const routeChoiceDelta = branchIds.map(branch => comparePolicyOutcomes(
      branch,
      "adaptive-candidate-vs-fixed-route-after-gaze",
      "withGazeOpening",
      "withGazeOpeningAdaptiveCandidate"
    ));
    const openingSupportEffectObservations = branchIds.map(policy => {
      const comparison = gazeOpeningDelta.find(item => item.comparisonId === "gaze-opening-fixed-straight-route" &&
        item.rerollPolicy === (policy === "withTeamRerolls" ? "team-rerolls-allowed" : "no-team-rerolls"));
      if (!comparison) throw new Error("Bloodboard omitted the paired fixed-route Gaze opening delta for " + policy + ".");
      const rerollPool = policy === "withTeamRerolls" ? teamRerolls : 0;
      return recordTaskResult({
        submetricId: "control.supportDelta",
        subjectId: openerRoleSubjectId,
        result: {
          lowerBound: comparison.lowerBound,
          upperBound: comparison.upperBound,
          exact: comparison.exact,
          unresolved: Math.max(0, comparison.upperBound - comparison.lowerBound),
          ...(comparison.exact ? { value: comparison.lowerBound } : {})
        },
        context: {
          format,
          boardState: route.replay.state,
          opponentProfile: [evaluatedOpponent],
          supportState: { roleId: "support", opener: evaluatedOpener, carrier: evaluatedCarrier, thralls: [route.scenario.opener.adjacentThrall, route.scenario.carrier.adjacentGoalThrall] },
          rerollPool,
          taskParameters: {
            roleId: "support",
            benchmarkId: "hypnotic-gaze-opening-touchdown-delta-v347",
            comparisonId: comparison.comparisonId,
            basePolicy: "carrier fixed straight route without opener action",
            supportedPolicy: "same carrier fixed straight route after opener Gaze activation",
            opportunity: "The exact same carrier, starting board, route and shared reroll budget; only the opener activation is added.",
            timepoint: "after carrier activation ends or earlier turnover/touchdown",
            rerollPolicy: rerollPool ? "same shared team reroll pool available to both action sequences" : "team rerolls unavailable",
            accountingNote: "The endpoint is the same teamTouchdown event already observed in mobility.teamScoringChain; preserve lineage and deduplicate across axes during any future composite scoring."
          },
          event: route.scenario.event
        },
        provenance: {
          engineId: engine.META.id, engineVersion: engine.META.version, engineSha256: engine.META.sha256,
          api: "calculateGazeAssistedTouchdown+paired-teamTouchdown-policy-comparison"
        }
      });
    });
    return {
      subjectId,
      engine: engine.META,
      status: route.status,
      scenario: route.scenario,
      replay: route.replay,
      outcomes: evaluatedCases,
      gazeOpeningDelta,
      routeChoiceDelta,
      openerRoleSubjectId,
      openerRoleObservations,
      openingSupportEffectObservations,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations)
    };
  }

  function evaluateScoringReceptionTask({ subjectId, receiver, format = "11s", teamRerolls = 1,
    passDistance = 2, weather = "perfect", planOptions = {} } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required.");
    const bridge = window.BB_BLOODBOARD_ENGINE;
    if (!bridge?.prepareScoringReceptionTask || !bridge?.evaluateActionSequence) {
      throw new Error("Bloodboard scoring-reception preparation and multi-activation enumeration are required.");
    }
    const prepared = bridge.prepareScoringReceptionTask({ receiver, format, teamRerolls, passDistance, weather });
    if (prepared.unavailable) return {
      subjectId, roleId: "scoringReception", status: prepared.kind,
      reason: prepared.unavailable, observations: [], modelVersion: VERSION,
      limitation: "A prohibited Catch or Move Action is not a zero-probability benchmark and is not counted as role coverage."
    };
    const raw = bridge.evaluateActionSequence({ state: prepared.state, inputs: prepared.inputs,
      event: prepared.event, options: planOptions });
    if (!raw.withoutTeamRerolls.legal || !raw.withTeamRerolls.legal) {
      throw new Error("The declared scoring-reception chain has illegal branches: " +
        [...new Set([...raw.withoutTeamRerolls.errors, ...raw.withTeamRerolls.errors])].join("; "));
    }
    const observations = ["withoutTeamRerolls", "withTeamRerolls"].map(policy => {
      const branch = raw[policy];
      return recordTaskResult({
        submetricId: "adaptability.roleCoverage", subjectId,
        result: { ...branch.taskSuccessProbability, unresolved: branch.unresolved },
        context: {
          format,
          boardState: prepared.state,
          opponentProfile: [],
          supportState: prepared.state.players.filter(player => player.team === "A" &&
            player.id !== prepared.actorIds.passer && player.id !== prepared.actorIds.receiver),
          rerollPool: policy === "withTeamRerolls" ? teamRerolls : 0,
          taskParameters: {
            roleId: "scoringReception",
            benchmarkId: "quick-pass-receive-and-score",
            receiverId: prepared.actorIds.receiver,
            passerId: prepared.actorIds.passer,
            pairedStarPartnerId: prepared.actorIds.pairedStar,
            timepoint: "after both declared activations; stop at Turnover or actual touchdown",
            sequence: prepared.inputs,
            sharedExecutionTree: "Pass, Catch, activation end, receiver movement/Rush, and scoring share the actual finite reroll state across two activations.",
            taskPolicy: "One fixed PA3 Passer, quick-pass range, open receiving lane, fixed end-zone route; no action/route optimization.",
            rerollPolicy: policy === "withTeamRerolls" ? "one shared team reroll available to both activations" : "team rerolls unavailable"
          },
          event: prepared.event
        },
        provenance: {
          engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256,
          api: "prepareScoringReceptionTask+evaluateActionSequence+Bloodboard multi-activation Pass/Catch/Move"
        }
      });
    });
    return {
      ...raw,
      subjectId,
      roleId: "scoringReception",
      reference: prepared.reference,
      actorIds: prepared.actorIds,
      observations,
      taskProfile: buildTaskProfile(subjectId, observations),
      replay: { state: JSON.parse(canonicalJson(prepared.state)), inputs: JSON.parse(canonicalJson(prepared.inputs)),
        event: JSON.parse(canonicalJson(prepared.event)), planOptions: { ...planOptions } },
      modelVersion: VERSION,
      limitation: prepared.reference.limitation + " No team-level legal roster choice, recruitment budget, match frequency or role threshold is inferred."
    };
  }

  function evaluateRoleReliabilityTasks({ subjectId, state, inputs, event, roleId, focalPlayerIds, planOptions = {} } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required.");
    if (!ROLE_IDS.includes(roleId)) throw new Error("Declare one supported roleId, not an average of unrelated roles.");
    if (!state || state.phase !== "play" || state.pending || state.turn?.activation) throw new Error("The role benchmark starts between activations in a playing state.");
    if (!Array.isArray(inputs) || !inputs.length || inputs.at(-1)?.kind !== "endActivation") throw new Error("Declare fixed JSON inputs ending with an explicit endActivation.");
    canonicalJson(inputs);
    if (!Array.isArray(focalPlayerIds) || !focalPlayerIds.length || new Set(focalPlayerIds).size !== focalPlayerIds.length ||
        focalPlayerIds.some(id => !state.players.some(player => player.id === id && player.team === state.turn.active))) throw new Error("Declare existing active-team focal players for this role task.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine?.evaluateActionSequence) throw new Error("Bloodboard action-sequence enumeration is required.");
    const safeGoal = { type: "allOf", events: [event, { type: "noTurnover" }] };
    const objectiveEvent = event.type === "allOf" && event.events.some(child => child.type === "noTurnover")
      ? { type: "allOf", events: event.events.filter(child => child.type !== "noTurnover") }
      : event;
    if (objectiveEvent.type === "allOf" && !objectiveEvent.events.length) throw new Error("Declare a physical role objective in addition to noTurnover.");
    const measureEvents = { objective: objectiveEvent,
      focalTackleZones: { type: "allOf", events: focalPlayerIds.map(playerId => ({ type: "playerHasTackleZone", playerId })) } };
    const raw = engine.evaluateActionSequence({ state, inputs, event: safeGoal, options: planOptions, measureEvents });
    if (!raw.withoutTeamRerolls.legal || !raw.withTeamRerolls.legal) {
      throw new Error("The declared role sequence has illegal branches: " + [...new Set([
        ...raw.withoutTeamRerolls.errors, ...raw.withTeamRerolls.errors])].join("; "));
    }
    const activeTeam = state.turn.active;
    const rerolls = Number(state.teams[activeTeam].rerolls) || 0;
    const clampProbability = value => Math.max(0, Math.min(1, value));
    const observations = ["withoutTeamRerolls", "withTeamRerolls"].flatMap(rerollPolicy => {
      const branch = raw[rerollPolicy];
      const distribution = Object.fromEntries(Array.from({ length: rerolls + 1 }, (_, count) => [String(count), {
        lowerBound: clampProbability(branch.remainingTeamRerolls[count] || 0),
        upperBound: clampProbability((branch.remainingTeamRerolls[count] || 0) + branch.unresolved)
      }]));
      const metrics = [
        ["reliability.activation", branch.completedDeclaredSequenceProbability, { type: "completedDeclaredInputs", earlyOwnTouchdownEndsCleanup: true }],
        ["reliability.coreTask", branch.taskSuccessProbability, safeGoal],
        ["reliability.turnoverRisk", branch.turnoverProbability, { type: "turnover" }],
        ["reliability.rerollBudget", { distribution, exact: branch.unresolved <= 1e-12, unresolved: branch.unresolved }, { type: "remainingTeamRerolls", team: activeTeam }]
      ];
      return metrics.map(([submetricId, result, measuredEvent]) => recordTaskResult({
        submetricId, subjectId, result: { ...result, unresolved: branch.unresolved },
        context: {
          format: state.variant === "sevens" ? "sevens" : "11s", boardState: state,
          opponentProfile: state.players.filter(player => player.team !== activeTeam),
          supportState: state.players.filter(player => player.team === activeTeam && !focalPlayerIds.includes(player.id)),
          rerollPool: rerollPolicy === "withTeamRerolls" ? rerolls : 0,
          taskParameters: { roleId, focalPlayerIds, inputs, safeGoal, rerollPolicy, exploration: planOptions,
            timepoint: "After the explicit activation-end input, or an earlier Turnover/touchdown.",
            sharedExecutionTree: "The four observations are views of one outcome tree, not independent bonuses to sum.",
            resourcePolicy: "Bloodboard carries actual Team/Leader/Veteran/skill resource state across steps; withoutTeamRerolls disables Team and Leader use while preserving rule skill rerolls. Pro/Loner follow the declared engine policy." },
          event: measuredEvent
        },
        provenance: { engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256,
          api: "evaluateActionSequence+explicit-endActivation+declared-role-objective" }
      }));
    });
    return { ...raw, subjectId, roleId, focalPlayerIds, observations, diagnostics: { measureEvents },
      replay: { state: JSON.parse(canonicalJson(state)), inputs: JSON.parse(canonicalJson(inputs)), event: JSON.parse(canonicalJson(event)), roleId, focalPlayerIds: focalPlayerIds.slice(), planOptions: { ...planOptions } },
      taskProfile: buildTaskProfile(subjectId, observations), modelVersion: VERSION,
      limitation: "These are raw probabilities for one declared role task. Input completion, role success and Turnover are distinct events. No average across roles, formal Reliability grade, optimal-coach assumption, or six-axis Strength is generated." };
  }

  function evaluateCarrierThreatTasks({ subjectId, state, input, carrierPlayerId, planOptions = {} } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required.");
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine?.calculateCarrierThreat) throw new Error("Bloodboard carrier threat enumeration is required.");
    const raw = engine.calculateCarrierThreat({ state, input, carrierPlayerId, options: planOptions });
    const carrierTeam = raw.scenario.carrierTeam;
    const observations = Object.entries(raw.policies).flatMap(([rerollPolicy, result]) => [
      ["ball.retention", result.possession.carrier, { type: "playerHasBall", playerId: carrierPlayerId }],
      ["ball.teamRetention", result.teamRetention, { type: "teamHasBall", team: carrierTeam }]
    ].map(([submetricId, probability, event]) => recordTaskResult({
      submetricId, subjectId, result: probability,
      context: {
        format: raw.scenario.format, boardState: raw.replay.state,
        opponentProfile: state.players.filter(player => player.team !== carrierTeam),
        supportState: state.players.filter(player => player.team === carrierTeam),
        rerollPool: rerollPolicy === "withTeamRerolls" ? raw.scenario.attackingTeamRerolls : 0,
        taskParameters: {
          carrierPlayerId, input, rerollPolicy, exploration: planOptions,
          resourceOwner: "The declared reroll pool belongs to the incoming attacking team; carrier reactions follow the engine policy.",
          timepoint: raw.scenario.timepoint, decisionPolicy: raw.scenario.policy
        }, event
      },
      provenance: { engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256,
        api: "calculateCarrierThreat+exploreOutcomes" }
    })));
    return { ...raw, subjectId, observations, taskProfile: buildTaskProfile(subjectId, observations), modelVersion: VERSION,
      limitation: "Original-carrier and any-teammate possession are separate terminal events, not a shared score. The declared board includes actual assists and ball bounces, but no subsequent pickup, attacker approach, optimal cage or match-frequency weighting is inferred." };
  }

  function evaluateTeamTaskImportance({ subjectId, state, event, focalPlayerId, policies,
    reassignmentPolicies = [], reservePlayerIds = [], reservePolicies = {},
    comparisonTiming = "during-drive", planOptions = {} } = {}) {
    const engine = window.BB_BLOODBOARD_ENGINE;
    if (!engine || typeof engine.calculateTeamTaskRemovalImpact !== "function") {
      throw new Error("Bloodboard's matched team task removal API is required.");
    }
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required.");
    const raw = engine.calculateTeamTaskRemovalImpact({ state, event, focalPlayerId, policies,
      reassignmentPolicies, reservePlayerIds, reservePolicies, comparisonTiming, options: planOptions });
    const format = state.variant === "sevens" ? "sevens" : "11s";
    const observations = raw.comparisons.flatMap(comparison => Object.entries(comparison.lossByRerollPolicy).map(([branch, result]) =>
      recordTaskResult({
        submetricId: "adaptability.teamImportance", subjectId, result,
        context: {
          format, boardState: raw.scenario.initialState,
          opponentProfile: state.players.filter(player => player.team !== raw.scenario.activeTeam),
          supportState: state.players.filter(player => player.team === raw.scenario.activeTeam),
          rerollPool: branch === "withTeamRerolls" ? state.teams[raw.scenario.activeTeam].rerolls : 0,
          taskParameters: {
            focalPlayerId, comparisonId: comparison.id, comparisonTiming,
            reservePlayerId: comparison.reservePlayerId,
            policies: raw.scenario.policies,
            reassignmentPolicies: raw.scenario.reassignmentPolicies,
            reservePolicies: raw.scenario.reservePolicies,
            selection: raw.scenario.selection,
            engineDecisionPolicy: raw.scenario.engineDecisionPolicy,
            policyMatching: raw.scenario.policyMatching,
            exploration: planOptions,
            formula: "max(P(team objective | baseline policy)) − max(P(same objective | changed lineup policy))",
            direction: "positive means a task-success loss after removing/replacing the focal player; not a bonus to team adaptability"
          },
          event: raw.scenario.event
        },
        provenance: {
          engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256,
          api: "calculateTeamTaskRemovalImpact+evaluateActionSequence+matched-declared-policy-portfolios"
        }
      })
    ));
    return { ...raw, subjectId, format, observations, taskProfile: buildTaskProfile(subjectId, observations),
      limitation: raw.scenario.limitation + " Different objectives remain separate probability deltas; no cross-task importance score or formal Adaptability grade is generated." };
  }

  const LEGACY_AXIS_ROUTES = {
    "快攻": ["mobility.openRoute", "mobility.markedRoute", "mobility.crossScreen", "mobility.screenedTouchdown", "mobility.teamScoringChain", "mobility.touchdown", "mobility.redeploy"],
    "控球": ["ball.acquisition", "ball.retention", "ball.teamRetention", "ball.transfer", "ball.recovery", "ball.disruption"],
    "杀伤": ["combat.blockAdvantage", "combat.knockdown", "combat.removal", "combat.foulRemoval"],
    "生存": ["survival.incomingBlock", "survival.damageChain", "survival.currentFunction", "survival.returnToDrive", "survival.positionRetention"],
    "控场": ["control.static", "control.staticPersistence", "control.teamStaticCoverage", "control.dynamic", "control.supportDelta", "control.actionEconomy", "control.specialPin"],
    "适应力": []
  };

  const RELIABILITY_SKILLS = new Set(("block takeRoot jumpUp leader accurate animosity alwaysHungry animalSavagery ballAndChain bloodlust boneHead brawler catch dauntless dodge drunkard frenzy hailMaryPass loner pass pro reallyStupid safePass sureFeet sureHands unchannelledFury unsteady wrestle").split(/\s+/));
  const MIXED_EFFECTS = new Set(("ballAndChain decay drunkard frenzy loner noBall secretWeapon stunty takeRoot titchy unchannelledFury unsteady veryLongLegs").split(/\s+/));
  const NEGATIVE_EFFECTS = new Set(("alwaysHungry animosity animalSavagery bloodlust boneHead decay drunkard loner reallyStupid secretWeapon unchannelledFury unsteady").split(/\s+/));
  const ROLE_BY_SKILL = {
    carrier: new Set(("bigHand catch dodge extraArms nervesOfSteel noBall sureHands stripBall").split(/\s+/)),
    scorer: new Set(("catch divingCatch dodge leap pogo sprint sureFeet stunty titchy twoHeads veryLongLegs").split(/\s+/)),
    blitzer: new Set(("block claws dauntless frenzy horns juggernaut mightyBlow tackle wrestle").split(/\s+/)),
    killer: new Set(("block claws dirtyPlayer loneFouler mightyBlow pileDriver sneakyGit chainsaw stab").split(/\s+/)),
    anchor: new Set(("block foulAppearance guard standFirm tentacles thickSkull").split(/\s+/)),
    support: new Set(("defensive guard leader onTheBall pro").split(/\s+/)),
    safety: new Set(("divingTackle shadowing sidestep stripBall tackle tentacles").split(/\s+/)),
    thrower: new Set(("accurate catch hailMaryPass nervesOfSteel pass safePass sureHands").split(/\s+/))
  };
  const OPPONENT_TAGS = {
    tackle: ["opponent-has-dodge"], stripBall: ["opponent-carrier", "opponent-lacks-sure-hands"], claws: ["opponent-high-armour"], disturbingPresence: ["opponent-passing-or-catching"], tentacles: ["opponent-movement-and-strength"], foulAppearance: ["opponent-targets-this-player"], dauntless: ["opponent-strength-higher"], hatred: ["opponent-keyword-match"], shadowing: ["opponent-movement-check"], prehensileTail: ["opponent-dodge-check"], dirtyPlayer: ["opponent-prone-target", "referee-risk"], chainsaw: ["opponent-target", "chainsaw-backfire"], stab: ["opponent-armour-and-special-attack-restrictions"]
  };
  const MECHANISM_BY_SKILL = {
    block: ["dice-outcome", "turnover-risk", "damage-chain"],
    brawler: ["dice-outcome", "turnover-risk"],
    dodge: ["action-probability", "block-outcome"],
    tackle: ["block-outcome", "opponent-dependent"],
    guard: ["team-synergy", "action-economy"],
    mightyBlow: ["damage-chain"],
    claws: ["damage-chain", "opponent-dependent"],
    sureHands: ["action-probability", "ball-retention", "strip-ball-matchup"],
    sureFeet: ["action-probability", "finite-reroll"],
    pass: ["action-probability", "finite-reroll"],
    catch: ["action-probability", "finite-reroll"],
    tentacles: ["spatial-control", "opponent-dependent"],
    standFirm: ["spatial-control", "position-retention"],
    sidestep: ["spatial-control", "position-choice"],
    frenzy: ["action-economy", "multi-action", "position-risk"],
    pro: ["action-probability", "finite-reroll"],
    loner: ["action-probability", "team-reroll-budget"],
    boneHead: ["activation-probability", "action-economy"],
    reallyStupid: ["activation-probability", "teammate-dependency"],
    bloodlust: ["activation-probability", "teammate-dependency", "action-economy"],
    animalSavagery: ["activation-probability", "teammate-dependency", "turnover-risk"]
  };
  const MODEL_SKILL_REFERENCES = new Set([
    ...RELIABILITY_SKILLS,
    ...MIXED_EFFECTS,
    ...NEGATIVE_EFFECTS,
    ...Object.values(ROLE_BY_SKILL).flatMap(skills => [...skills]),
    ...Object.keys(OPPONENT_TAGS),
    ...Object.keys(MECHANISM_BY_SKILL)
  ]);

  const SYNERGIES = [
    { id: "block+dodge", requires: ["block", "dodge"], axes: ["survival", "reliability"], eventId: "incoming-block.result", mechanism: "Block and Dodge jointly change Both Down / Defender Stumbles resolution; enumerate the shared result tree.", dedupeKey: "incoming-block-result" },
    { id: "block+tackle", requires: ["block", "tackle"], axes: ["combat"], eventId: "attacking-block.result", mechanism: "Tackle changes whether Defender Stumbles knocks down a Dodge target; compare the same dice tree with and without Tackle.", dedupeKey: "attacking-block-result" },
    { id: "block+guard", requires: ["block", "guard"], axes: ["combat", "control"], eventId: "supported-block.result", mechanism: "Guard may make an otherwise unavailable assist legal; recompute the block dice and support task with the same board state.", dedupeKey: "supported-block-result" },
    { id: "guard+high-strength", requires: ["guard", "ST"], axes: ["combat", "control"], eventId: "supported-block.dice-count", mechanism: "Guard and ST jointly change legal support and the block-dice chooser/count; requires a fixed teammate/opponent state.", dedupeKey: "supported-block-result" },
    { id: "stand-firm+guard", requires: ["standFirm", "guard"], axes: ["survival", "control"], eventId: "support.position-retention", mechanism: "Position retention can preserve future support; compare the same threatened support square before and after displacement.", dedupeKey: "support-square-retention" },
    { id: "sidestep+dodge", requires: ["sidestep", "dodge"], axes: ["survival", "control"], eventId: "incoming-block.position-choice", mechanism: "Dodge changes block outcomes and Sidestep changes legal push destinations; evaluate both in one state tree.", dedupeKey: "incoming-block-result" },
    { id: "mightyBlow+claws", requires: ["mightyBlow", "claws"], axes: ["combat"], eventId: "block.armour-injury", mechanism: "Mighty Blow allocation and Claws armour threshold interact; enumerate armour then injury rather than adding separate bonuses.", dedupeKey: "block-damage-chain" },
    { id: "sureHands+high-agility", requires: ["sureHands", "AG"], axes: ["ball", "reliability"], eventId: "pickup.check", mechanism: "Sure Hands rerolls a failed pickup; compute the joint pickup chain at the player's AG and modifiers.", dedupeKey: "pickup-check" },
    { id: "catch+pass", requires: ["catch", "pass"], axes: ["ball", "reliability"], eventId: "pass-catch.chain", mechanism: "Pass and Catch operate on consecutive checks with finite reroll resources; compute the chain, not the sum of rates.", dedupeKey: "pass-catch-chain" },
    { id: "high-ma+dodge", requires: ["MA", "dodge"], axes: ["mobility", "reliability"], eventId: "marked-route.check-chain", mechanism: "More route squares can add checks; evaluate reach-at-distance with the actual Dodge/Rush chain.", dedupeKey: "movement-route" },
    { id: "high-av+block+thick-skull", requires: ["AV", "block", "thickSkull"], axes: ["survival"], eventId: "incoming-block.damage-chain", mechanism: "Block changes knockdown outcomes; AV and Thick Skull change later injury/KO transitions.", dedupeKey: "incoming-block-damage-chain" }
  ];

  function routeForLegacyDimension(dimension) {
    const ids = LEGACY_AXIS_ROUTES[dimension] || [];
    return ids.map(id => ({ id, status: "candidate-route" }));
  }

  const knownSynergiesBySkill = new Map();
  SYNERGIES.forEach(synergy => synergy.requires.forEach(skillId => {
    if (!knownSynergiesBySkill.has(skillId)) knownSynergiesBySkill.set(skillId, []);
    knownSynergiesBySkill.get(skillId).push(synergy.id);
  }));

  function skillPolarity(id) {
    if (MIXED_EFFECTS.has(id)) return "mixed";
    if (NEGATIVE_EFFECTS.has(id)) return "negative";
    return "positive-or-contextual";
  }

  function skillMechanisms(id, skill, effect) {
    const mechanisms = (MECHANISM_BY_SKILL[id] || []).slice();
    const dimensions = effect && effect.dimensions || [];
    if (dimensions.some(value => value === "快攻" || value === "控球") && !mechanisms.includes("action-probability")) mechanisms.push("action-probability");
    if (dimensions.includes("控场") && !mechanisms.includes("spatial-control")) mechanisms.push("spatial-control");
    if (dimensions.includes("杀伤") && !mechanisms.includes("damage-chain")) mechanisms.push("damage-chain");
    if (dimensions.includes("生存") && !mechanisms.includes("damage-chain")) mechanisms.push("damage-chain");
    if ((effect && effect.scopes || []).some(scope => scope.includes("team"))) mechanisms.push("team-context");
    if (!mechanisms.length) mechanisms.push(skill.category === "Trait" ? "trait-trigger" : "rule-check-or-action");
    return [...new Set(mechanisms)];
  }

  function executionDependencyForRule(rule) {
    if (!rule || typeof rule.summary !== "string") {
      return {
        score: null,
        features: [],
        source: null,
        status: "missing-engine-rule-definition",
        warning: "缺少 Bloodboard 技能规则定义，不能推定操作依赖度。"
      };
    }
    const features = COACH_DEPENDENCY_FEATURES.flatMap(feature => {
      const cues = feature.patterns.flatMap(pattern => {
        const match = pattern.exec(rule.summary);
        if (!match) return [];
        const prefix = rule.summary.slice(Math.max(0, match.index - 32), match.index);
        if (feature.id === "pathPlanning" && /(?:cannot|may not|does not|automatically fails to)\s+(?:\w+\s+){0,2}$/i.test(prefix)) return [];
        return [match[0]];
      });
      return cues.length ? [{ id: feature.id, label: feature.label, points: feature.weight, cues: [...new Set(cues)] }] : [];
    });
    const score = Math.min(100, features.reduce((total, feature) => total + feature.points, 0));
    const band = score >= 50 ? "high" : score >= 35 ? "medium" : score >= 16 ? "low" : "very-low";
    return {
      score,
      band,
      features,
      ruleMetadata: { active: rule.active, mandatory: rule.mandatory, support: rule.support },
      source: "Bloodboard V5 SKILL_BY_ID.summary",
      status: "rule-text-cue-proxy; human audit and gameplay calibration pending",
      warning: "分值仅按引擎规则摘要中可复核的操作线索计分；未计入出现频率、玩家行为或完整任务收益，不能作为最终兑现率。"
    };
  }

  function skillRecord(skill, effects, engineRule) {
    const legacy = effects[skill.id] || { dimensions: [], scopes: [], contexts: [], sources: [] };
    const candidateEffects = [];
    (legacy.dimensions || []).forEach(dimension => routeForLegacyDimension(dimension).forEach(route => {
      candidateEffects.push({
        effectId: "skill." + skill.id + "." + route.id,
        axisId: route.id.split(".")[0],
        submetricId: route.id,
        routeStatus: route.status,
        sourceRoute: dimension
      });
    }));
    if (RELIABILITY_SKILLS.has(skill.id)) {
      const relevant = skill.id === "boneHead" || skill.id === "reallyStupid" || skill.id === "bloodlust" || skill.id === "animalSavagery" || skill.id === "loner" || skill.id === "unchannelledFury"
        ? ["reliability.activation", "reliability.coreTask", "reliability.turnoverRisk"]
        : ["reliability.coreTask", "reliability.turnoverRisk"];
      relevant.forEach(id => candidateEffects.push({ effectId: "skill." + skill.id + "." + id, axisId: "reliability", submetricId: id, routeStatus: "candidate-route", sourceRoute: "role-related action probability; same underlying event must be deduplicated in Strength" }));
    }
    const uniqueEffects = [...new Map(candidateEffects.map(item => [item.effectId, item])).values()];
    const roleTags = ROLE_IDS.filter(roleId => ROLE_BY_SKILL[roleId].has(skill.id));
    const contexts = [...new Set((legacy.contexts || []).concat(legacy.scopes || []))];
    const opponentTags = OPPONENT_TAGS[skill.id] || [];
    const conditional = (legacy.scopes || []).some(scope => scope.includes("conditional") || scope.includes("team") || scope.includes("league"));
    const directlyRouted = (legacy.scopes || []).some(scope => scope.includes("direct"));
    const mechanisms = skillMechanisms(skill.id, skill, legacy);
    const executionDependency = executionDependencyForRule(engineRule);
    return {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      page: skill.page,
      source: "Third Season Rulebook p." + skill.page + "; skill catalogue / rule routing in this project",
      directImpact: directlyRouted ? uniqueEffects.map(item => item.effectId) : [],
      conditionalImpact: conditional ? uniqueEffects.map(item => item.effectId) : [],
      effects: uniqueEffects,
      synergyImpact: knownSynergiesBySkill.get(skill.id) || [],
      opponentDependentImpact: opponentTags,
      formatDependentImpact: ["11s", "sevens"],
      formatNote: "规则文本不随赛制改变；棋盘大小、阵容人数与任务频率需要在各赛制情境中重算，当前没有频率校准。",
      roleDependentImpact: roleTags.length ? roleTags : ["core-task-context-required"],
      polarity: skillPolarity(skill.id),
      mechanisms,
      ruleEvidence: engineRule ? {
        source: "Bloodboard V5 SKILL_BY_ID",
        page: engineRule.page,
        summary: engineRule.summary,
        active: engineRule.active,
        mandatory: engineRule.mandatory,
        support: engineRule.support
      } : null,
      executionDependency,
      valueChannels: {
        passiveValue: { value: null, unit: "task-score delta", status: "requires engine-backed automatic/neutral scenario set" },
        skillExpressiveValue: { value: null, unit: "task-score delta", status: "requires engine-backed choice/synergy scenario set" }
      },
      prerequisites: contexts,
      legacyCoverageStatus: legacy.coverage || "unmapped",
      legacyCoverageNote: legacy.coverageNote || "尚无旧版覆盖说明。",
      v3Status: uniqueEffects.length ? "inventory-mapped; probability formula pending" : "context-route-pending",
      mappingBasis: "旧版维度路由已迁移为候选子指标；此记录不是已验证的 v3 概率效果，不产生固定加分。",
      potentialDoubleCountingRisks: uniqueEffects.map(item => item.axisId).filter((id, index, all) => all.indexOf(id) === index).length > 1
        ? ["同一底层事件可能投影至多个轴；强度层必须以 eventId 去重，当前只登记不累加。"]
        : []
    };
  }

  function starRuleRecord(star, ruleModels) {
    const model = ruleModels[star.id] || null;
    const dimensions = model && model.dimensions || star.specialRuleDimensions || [];
    const routes = dimensions.flatMap(routeForLegacyDimension);
    if (star.pair || model && /pair|team|Context|context|Reroll|SkillGrant/.test(model.kind)) {
      routes.push({ id: "context.teamContribution", status: "context-required" });
    }
    return {
      id: star.id,
      name: star.name,
      source: star.specialRuleSource || "明星球员规则译文；来源待核对",
      ruleText: star.specialRules || "",
      effectId: "starRule." + star.id + "." + (model && model.kind || "unmodeled"),
      modelKind: model && model.kind || null,
      directImpact: model && model.kind === "integrated" ? routes.map(route => "starRule." + star.id + "." + route.id) : [],
      conditionalImpact: model && model.kind !== "integrated" ? routes.map(route => "starRule." + star.id + "." + route.id) : [],
      effects: routes.map(route => ({ axisId: route.id.split(".")[0], submetricId: route.id, status: route.status || "candidate-route" })),
      synergyImpact: star.pair ? ["paired-star:" + star.pair] : [],
      opponentDependentImpact: ["opponent-profile-and-board-state-required"],
      formatDependentImpact: ["11s", "sevens"],
      formatNote: "单次规则效果需绑定合法动作机会、赛制与比赛时长；不得等同整场触发频率。",
      roleDependentImpact: ["star-player-role", "eligible-roster-context"],
      polarity: "positive-or-risk-mixed; inspect full event outcomes",
      mechanisms: ["special-action-or-resource", "conditional-outcome-chain"],
      prerequisites: [model && model.note || "规则触发与可用条件待结构化"],
      legacyCoverageStatus: "star-rule-model:" + (model && model.kind || "missing"),
      v3Status: model ? "legacy-star-branch; probability audit pending" : "missing-legacy-rule-model",
      mappingBasis: "旧明星规则分支仅作为迁移来源；模型必须逐项绑定事件及排除重复计分。",
      potentialDoubleCountingRisks: ["若该规则已被球员技能或基础事件树涵盖，不得再把同一概率增量加一次。"]
    };
  }

  function createRuleLedger() {
    const skills = window.BB_SKILL_CATALOG || [];
    const engineSkills = window.BloodboardEngine && window.BloodboardEngine.SKILL_BY_ID || {};
    const effects = window.BB_SKILL_EFFECTS || {};
    const stars = window.ATLAS_DATA && window.ATLAS_DATA.stars || [];
    const scoring = window.BB_SCORING || {};
    return {
      skills: skills.map(skill => skillRecord(skill, effects, engineSkills[skill.id])),
      starRules: stars.filter(star => star.specialRules).map(star => starRuleRecord(star, scoring.starRuleModels || {}))
    };
  }

  function audit() {
    const ledger = createRuleLedger();
    const data = window.ATLAS_DATA || { rosters: [], teams: [], stars: [] };
    const skillIds = ledger.skills.map(item => item.id);
    const starIds = ledger.starRules.map(item => item.id);
    const known = new Set(skillIds);
    const unknownModelSkillIds = [...MODEL_SKILL_REFERENCES].filter(id => !known.has(id)).sort();
    const observed = new Set();
    const unknown = new Set();
    const addSkills = person => (person && person.skills || []).forEach(skill => {
      const id = typeof skill === "string" ? skill : skill.id;
      if (!id) return;
      observed.add(id);
      if (!known.has(id)) unknown.add(id);
    });
    (data.rosters || []).forEach(roster => (roster.positions || []).forEach(addSkills));
    (data.teams || []).forEach(team => (team.players || []).forEach(addSkills));
    (data.stars || []).forEach(addSkills);
    const duplicate = list => list.filter((id, index) => list.indexOf(id) !== index);
    const starModels = window.BB_SCORING && window.BB_SCORING.starRuleModels || {};
    const legacyEffectIds = Object.keys(window.BB_SKILL_EFFECTS || {});
    const expectedAxisTaskIds = AXES.flatMap(axis => axis.submetrics);
    const expectedCrossCuttingTaskIds = CROSS_CUTTING_FACTORS.flatMap(factor => factor.submetrics);
    const expectedContextTaskIds = CONTEXT_METRICS.flatMap(metric => metric.submetrics);
    const expectedTaskIds = expectedAxisTaskIds.concat(expectedCrossCuttingTaskIds, expectedContextTaskIds);
    const taskContractIds = Object.keys(TASK_CONTRACTS);
    const taskContractIssues = expectedTaskIds.filter(id => {
      const contract = TASK_CONTRACTS[id];
      const expectedLayer = expectedAxisTaskIds.includes(id) ? "axis" : expectedContextTaskIds.includes(id) ? "context" : "cross-cutting";
      return !contract || !contract.event || !contract.taskFamily || !contract.benchmarkId ||
        !contract.difficultyTier || !contract.unit || !contract.resultKind || !contract.direction ||
        contract.layer !== expectedLayer ||
        contract.requiredContext.join(",") !== TASK_CONTEXT_KEYS.join(",");
    });
    const extraTaskContracts = taskContractIds.filter(id => !expectedTaskIds.includes(id));
    const skillRuleEvidenceCount = ledger.skills.filter(item => !!item.ruleEvidence).length;
    const legacyCovered = ledger.skills.reduce((count, item) => count + (item.legacyCoverageStatus !== "unmapped" ? 1 : 0), 0);
    const skillStatusCounts = ledger.skills.reduce((counts, item) => {
      const key = item.legacyCoverageStatus;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    return {
      version: VERSION,
      skills: {
        catalogCount: skillIds.length,
        legacyEffectCount: legacyEffectIds.length,
        legacyMappedCount: skillIds.filter(id => !!(window.BB_SKILL_EFFECTS || {})[id]).length,
        v3LedgerCount: ledger.skills.length,
        observedUniqueInEntities: observed.size,
        unknownInEntities: [...unknown].sort(),
        unknownModelSkillIds,
        modelSkillReferenceCount: MODEL_SKILL_REFERENCES.size,
        duplicateCatalogIds: duplicate(skillIds),
        duplicateLegacyEffectIds: duplicate(legacyEffectIds),
        legacyCoverageCounts: skillStatusCounts,
        legacyCoverageTotal: legacyCovered
      },
      starRules: {
        specialRuleCount: (data.stars || []).filter(star => !!star.specialRules).length,
        ledgerCount: starIds.length,
        legacyRuleModelCount: Object.keys(starModels).length,
        missingModelIds: starIds.filter(id => !starModels[id]),
        modelWithoutStarIds: Object.keys(starModels).filter(id => !(data.stars || []).some(star => star.id === id))
      },
      axes: AXES.map(axis => ({ id: axis.id, submetricCount: axis.submetrics.length, submetrics: axis.submetrics.slice() })),
      crossCuttingFactors: CROSS_CUTTING_FACTORS.map(factor => ({ id: factor.id, labelZh: factor.labelZh, submetricCount: factor.submetrics.length, submetrics: factor.submetrics.slice() })),
      taskContracts: {
        expectedSubmetricCount: expectedTaskIds.length,
        sixAxisSubmetricCount: expectedAxisTaskIds.length,
        crossCuttingSubmetricCount: expectedCrossCuttingTaskIds.length,
        contextSubmetricCount: expectedContextTaskIds.length,
        registeredContractCount: taskContractIds.length,
        missingOrInvalid: taskContractIssues,
        unexpectedContracts: extraTaskContracts,
        prototypeCount: taskContractIds.filter(id => TASK_CONTRACTS[id].implementationStatus === "prototype").length,
        plannedCount: taskContractIds.filter(id => TASK_CONTRACTS[id].implementationStatus === "planned").length,
        calibratedAggregationGroups: taskContractIds.filter(id => !!TASK_CONTRACTS[id].calibrationGroup).length,
        formalAxisScoreReady: false,
        status: "six axes use Adaptability as axis six; reliability is a cross-cutting task observation and roster-specific team importance remains contextual; role-coverage contracts and calibration remain incomplete"
      },
      coachModel: {
        presets: COACH_LEVELS.map(level => ({ ...level })),
        profileFields: COACH_PROFILE_FIELDS.map(field => ({ ...field })),
        skillsWithExecutionDependency: ledger.skills.filter(skill => Number.isFinite(skill.executionDependency.score)).length,
        skillsWithEngineRuleEvidence: skillRuleEvidenceCount,
        skillsMissingEngineRuleEvidence: ledger.skills.filter(skill => !skill.ruleEvidence).map(skill => skill.id),
        executionDependencySource: "Bloodboard V5 SKILL_BY_ID.summary cue rubric; score remains provisional",
        dependencyFeatures: COACH_DEPENDENCY_FEATURES.map(feature => feature.id),
        passiveExpressiveValuesReady: ledger.skills.filter(skill => skill.valueChannels.passiveValue.value !== null && skill.valueChannels.skillExpressiveValue.value !== null).length,
        entityEvaluationStatus: "live scenario decomposition from same-player score ablation; rule cue, role entropy, synergy links and mistake recovery remain provisional proxies",
        status: "coach scenario preview live; tactical-behavior calibration pending"
      },
      duplicateEffectIds: duplicate(ledger.skills.flatMap(skill => skill.effects.map(effect => effect.effectId))),
      complete: skillIds.length === ledger.skills.length && skillIds.length === legacyEffectIds.length &&
        ledger.starRules.length === ((data.stars || []).filter(star => !!star.specialRules).length) &&
        unknown.size === 0 && unknownModelSkillIds.length === 0 && duplicate(skillIds).length === 0 && duplicate(legacyEffectIds).length === 0 && skillRuleEvidenceCount === skillIds.length &&
        taskContractIds.length === expectedTaskIds.length && taskContractIssues.length === 0 && extraTaskContracts.length === 0
    };
  }

  const MODEL_LAYERS = Object.freeze({
    sixAxisProfile: { purpose: "能力画像 / DNA", directOverallAggregation: false, status: "typed-task-contracts-live; measured coverage and cross-task score calibration incomplete" },
    intrinsicStrength: { purpose: "默认规则环境下的基础竞争力", status: "not-yet-calibrated" },
    contextAdjustedStrength: { purpose: "指定赛制、TV、技能包、诱导品与名单下的竞争力", status: "context-contract-defined; solver-pending" },
    matchupStrength: { purpose: "指定对手与战术下的相对表现", status: "opponent-contract-defined; solver-pending" },
    coachRealizedStrength: { purpose: "给定玩家水平下的能力兑现", status: "legacy-score-proxy-preview; task-based tactical-behavior calibration pending", overlaysSixAxis: false },
    efficiency: { purpose: "成本 / TV / 技能投资效率", outsideSixAxes: true },
    adaptability: { purpose: "个人角色覆盖的六维画像轴；角色证据向量尚未校准为分数", outsideSixAxes: false },
    teamImportance: { purpose: "指定阵容的任务缺阵损失；六维之外的情境指标", outsideSixAxes: true },
    reliability: { purpose: "各项角色任务中的激活、Turnover 与资源可靠性；跨轴观察项", outsideSixAxes: true },
    variance: { purpose: "表现波动和灾难结果风险", outsideSixAxes: true },
    matchupDependency: { purpose: "表现对对手构成的依赖", outsideSixAxes: true },
    formatFit: { purpose: "11s / Sevens / 锦标赛环境适配", outsideSixAxes: true }
  });

  window.BB_EVALUATION_V3 = {
    VERSION,
    AXES,
    CROSS_CUTTING_FACTORS,
    CONTEXT_METRICS,
    ROLE_IDS,
    COACH_LEVELS,
    COACH_PROFILE_FIELDS,
    EXECUTION_FEATURES: COACH_DEPENDENCY_FEATURES,
    SUBMETRICS,
    TASK_CONTRACTS,
    recordTaskResult,
    compareTaskResults,
    buildTaskProfile,
    evaluatePlayerCombatTasks,
    evaluatePlayerCurrentFunctionTasks,
    evaluatePlayerBallAcquisitionTasks,
    evaluatePlayerOpponentActivationDenialTasks,
    evaluatePlayerFoulTasks,
    evaluateTeamBlockFoulTasks,
    evaluatePlayerStaticControlTasks,
    evaluateDefensiveScreenTask,
    evaluateGuardStrengthSynergyTask,
    evaluateGrombrindalSupportTask,
    evaluateBlockTackleInteractionTask,
    evaluateMightyBlowClawsInteractionTask,
    evaluateTeamStaticAnchorTasks,
    evaluateTeamStaticCoverageTasks,
    evaluateTeamStaticCoverageReplacementTasks,
    evaluatePlayerMobilityTasks,
    evaluatePlayerDynamicControlTasks,
    evaluatePlayerScreenCrossingTasks,
    evaluatePlayerScreenedTouchdownTasks,
    evaluateTeamGazeAssistedTouchdownTasks,
    evaluateTeamTaskImportance,
    evaluateCarrierThreatTasks,
    evaluateRoleReliabilityTasks,
    evaluateScoringReceptionTask,
    CONTEXT_SCHEMA,
    BASELINE_CONTEXT,
    SYNERGIES,
    MODEL_LAYERS,
    ruleEngine: window.BB_BLOODBOARD_ENGINE || null,
    coachRealizationFactor,
    executionDependencyForRule,
    executionDependencyForText,
    realizedValue,
    analyzeCoachPlayer,
    evaluateCoachSkill,
    createRuleLedger,
    audit
  };
})();
