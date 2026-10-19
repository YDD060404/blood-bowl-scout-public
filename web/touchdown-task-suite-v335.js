/* Additive v3.35 tasks. Does not alter the v3.34 suite, calibration, or Bloodboard rules. */
(() => {
  const VERSION = "1.0.0-held-ball-touchdown-v335";
  const POLICIES = ["withoutTeamRerolls", "withTeamRerolls"];
  const TASKS = Object.freeze([
    { id: "touchdown4", label: "持球开阔推进 4 格并实际达阵", distance: 4, pressure: "open" },
    { id: "touchdown6", label: "持球开阔推进 6 格并实际达阵", distance: 6, pressure: "open" },
    { id: "touchdown8", label: "持球开阔推进 8 格并实际达阵", distance: 8, pressure: "open" },
    { id: "touchdown-marked8", label: "持球脱离起点盯防、推进 8 格并实际达阵", distance: 8, pressure: "marked" }
  ].map(Object.freeze));
  const DEFAULT_OPTIONS = Object.freeze({ threshold: 1e-12, maxLeaves: 20000, maxExpandedStates: 2000, followUp: false });
  const clone = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value && typeof value === "object"
    ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
      : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
  const all = (...events) => ({ type: "allOf", events });
  const profileSnapshot = p => ({ ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av,
    skills: clone(p.skills), keywords: clone(p.keywords || []), star: p.star || null,
    veteran: p.veteran || null, stance: p.stance, distracted: !!p.distracted, position: clone(p.pos) });
  const helperProfile = () => {
    const thrall = window.ATLAS_DATA?.rosters?.find(r => r.id === "vampire")?.positions?.find(p => p.keywords?.includes("Thrall"));
    if (!thrall) throw new Error("The pinned Atlas Thrall Lineman profile is required for a declared support scenario.");
    return clone(thrall);
  };
  function prepare(taskId, { player, format = "11s", starId = null, support = "none", weather = "perfect", teamRerolls = 1 } = {}) {
    const definition = TASKS.find(task => task.id === taskId);
    if (!definition) throw new Error("Unknown v3.35 touchdown task: " + taskId);
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    if (!["11s", "sevens"].includes(format)) throw new Error("Choose 11s or sevens.");
    if (!["none", "start-thrall", "end-thrall"].includes(support)) throw new Error("Choose none, start-thrall or end-thrall support.");
    if (!["perfect", "pouringRain", "verySunny"].includes(weather)) throw new Error("Unsupported reference weather.");
    if (![0, 1].includes(teamRerolls)) throw new Error("Declare 0 or 1 initial Team Re-roll.");
    if (starId && format !== "11s") throw new Error("Star Players are excluded from Sevens reference tasks.");
    const bridge = window.BB_BLOODBOARD_ENGINE, engine = window.BloodboardEngine;
    // Existing constructor performs authoritative printed-Star identity validation before any N/A result.
    const identity = bridge.preparePlayerRoleTask({ player, format, starId, support: "none", teamRerolls,
      taskId: bridge.recommendPlayerRoleTask(player), distance: 1 });
    const actor0 = identity.state.players.find(p => p.id === "role-actor");
    const ids = new Set(actor0.skills.map(s => s.id));
    if (ids.has("noBall")) return { unavailable: "No Ball 禁止开始本项持球达阵任务；N/A 不是失败概率。", status: "not-applicable" };
    if (ids.has("ballAndChain")) return { unavailable: "Ball & Chain 不能声明普通 Move Action；不套用普通带球路线。", status: "not-applicable" };
    const maximumDistance = actor0.ma + engine.maxRushes(actor0);
    if (definition.distance > maximumDistance) return { unavailable: "声明距离超出 MA + 合法 Rush 上限。", status: "out-of-range", maximumDistance };
    const prepared = bridge.preparePlayerRoleTask({ player, format, starId, support: "none", teamRerolls, taskId: "move", distance: 1 });
    const { state } = prepared;
    const pitch = bridge.getPitchDimensions(format), y = Math.floor(pitch.height / 2), goalX = pitch.width - 1;
    const origin = { x: goalX - definition.distance, y }, goal = { x: goalX, y };
    const shift = origin.x - 5;
    // Preserve each real paired Star's relative deployment; do not invent useful adjacency.
    for (const p of state.players) if (p.pos) p.pos.x += shift;
    const actor = state.players.find(p => p.id === "role-actor");
    state.weather = weather;
    state.ball = { kind: "held", playerId: actor.id };
    state.teams.A.leaderReroll = false;
    let helper = null;
    if (support !== "none") {
      const at = support === "start-thrall" ? { x: origin.x - 1, y } : { x: goalX - 1, y: y + 1 };
      helper = bridge.addScenarioPlayer(state, "A", helperProfile(), at);
      helper.id = "touchdown-thrall";
      state.players.push(helper);
    }
    if (definition.pressure === "marked") {
      const marker = bridge.addScenarioPlayer(state, "B", { name: "Declared ST3 marker", ma: 6, st: 3, ag: 3, pa: 4, av: 9,
        skills: [], keywords: ["Human", "Lineman"] }, { x: origin.x, y: y + 1 });
      marker.id = "touchdown-marker";
      state.players.push(marker);
    }
    const path = Array.from({ length: definition.distance }, (_, i) => ({ kind: "step", to: { x: origin.x + i + 1, y } }));
    const inputs = [{ kind: "playerAction", playerId: actor.id, action: "move", path }, { kind: "endActivation" }];
    const touchdown = { type: "teamTouchdown", team: "A" };
    const safeTouchdown = all(touchdown, { type: "noTurnover" });
    const measureEvents = { touchdown, safeTouchdown,
      standingAtGoal: { type: "playerAtSquare", playerId: actor.id, square: goal, stance: "standing" },
      standingWithBallAtGoal: all({ type: "playerAtSquare", playerId: actor.id, square: goal, stance: "standing" }, { type: "playerHasBall", playerId: actor.id }),
      focalTackleZone: { type: "playerHasTackleZone", playerId: actor.id },
      ...(helper ? { helperRemoved: { type: "playerRemoved", playerId: helper.id }, helperStanding: { type: "playerStanding", playerId: helper.id } } : {}) };
    const reference = { id: taskId, label: definition.label, format, distance: definition.distance, maximumDistance,
      pressure: definition.pressure, support, weather, origin, goal, initialBall: clone(state.ball),
      routePolicy: "fixed-horizontal-step-path", teamRerolls, includeLeaderReroll: false, starId, pairId: prepared.reference.pairId,
      timepoint: "after complete held-ball Move and explicit endActivation, or earlier actual touchdown / failure Turnover",
      resourcePolicy: "One initial finite pool shared across all rolls in this activation; never a fresh reroll per step.",
      supportPolicy: support === "none" ? "No generic helper; a real paired Star partner is retained if present."
        : "A real pinned Thrall profile stands at the declared fixed square and takes no action. Conditional capability board, not roster or recruitment legality.",
      limitation: "Starts holding the ball. No pickup, pass, handoff, teammate action, full drive, route optimization, or later recovery. Optional activation-start Star rules are not declared. No grade, axis weight or ranking change." };
    // Focal attributes/identity are the variable being tested. All other players belong to conditions.
    const cohortContext = { schema: "touchdown-cohort/1", taskId, format, distance: definition.distance,
      pressure: definition.pressure, support, weather, origin, goal, path, initialBall: "held-by-focal-standing-player",
      initialTeamRerolls: teamRerolls, initialLeaderReroll: false,
      supportPlayers: state.players.filter(p => p.team === "A" && p.id !== actor.id).map(profileSnapshot),
      opponents: state.players.filter(p => p.team === "B").map(profileSnapshot),
      ruleEngineSha256: bridge.META.sha256, timepoint: "activation-ended-or-earlier-touchdown-turnover", routePolicy: "fixed-horizontal-step-path" };
    const errors = engine.validatePosition(state).filter(issue => issue.level === "error").map(issue => issue.text);
    errors.push(...engine.validateInput(state, inputs[0]));
    if (errors.length) throw new Error("Invalid touchdown reference: " + errors.join("; "));
    return { state: clone(state), inputs, event: safeTouchdown, measureEvents, reference, cohortContext, cohortKey: canonical(cohortContext) };
  }
  function evaluatePrepared(subjectId, prepared, options = {}) {
    const bridge = window.BB_BLOODBOARD_ENGINE;
    const planOptions = { ...DEFAULT_OPTIONS, ...options };
    const raw = bridge.evaluateActionSequence({ state: prepared.state, inputs: prepared.inputs, event: prepared.event,
      measureEvents: prepared.measureEvents, options: planOptions });
    const observations = POLICIES.map(policy => window.BB_EVALUATION_V3.recordTaskResult({
      submetricId: prepared.reference.pressure === "open" ? "mobility.touchdown" : "mobility.screenedTouchdown", subjectId,
      result: { ...raw[policy].taskSuccessProbability, unresolved: raw[policy].unresolved },
      context: { format: prepared.reference.format, boardState: prepared.state,
        opponentProfile: prepared.cohortContext.opponents, supportState: prepared.cohortContext.supportPlayers,
        rerollPool: policy === "withTeamRerolls" ? prepared.reference.teamRerolls : 0,
        taskParameters: { reference: prepared.reference, inputs: prepared.inputs, rerollPolicy: policy, exploration: planOptions,
          cohortContext: prepared.cohortContext, independentReference: true }, event: prepared.event },
      provenance: { engineId: bridge.META.id, engineVersion: bridge.META.version, engineSha256: bridge.META.sha256,
        api: "touchdown-task-suite-v335+evaluateActionSequence" }
    }));
    return { status: POLICIES.every(policy => raw[policy].legal) ? raw.status : "not-calculated",
      reference: prepared.reference, cohortContext: prepared.cohortContext, cohortKey: prepared.cohortKey,
      cohortKeys: Object.fromEntries(POLICIES.map(policy => [policy, canonical({ ...prepared.cohortContext, rerollPolicy: policy })])),
      observations, measures: Object.fromEntries(POLICIES.map(policy => [policy, {
        ...raw[policy].eventProbabilities, safeObjective: raw[policy].taskSuccessProbability,
        turnover: raw[policy].turnoverProbability, inputCompletion: raw[policy].completedDeclaredSequenceProbability,
        remainingTeamRerolls: raw[policy].remainingTeamRerolls,
        touchdownRemainingTeamRerolls: raw[policy].taskSuccessRemainingTeamRerolls,
        unresolved: raw[policy].unresolved, legal: raw[policy].legal, errors: raw[policy].errors,
        expandedStates: raw[policy].expandedStates }])),
      replay: { state: clone(prepared.state), inputs: clone(prepared.inputs), event: clone(prepared.event),
        measureEvents: clone(prepared.measureEvents), planOptions },
      engine: bridge.META };
  }
  function evaluate({ player, subjectId = player?.id, format = "11s", starId = null, support = "none", weather = "perfect",
    teamRerolls = 1, taskIds = TASKS.map(task => task.id), planOptions = {}, onProgress = null } = {}) {
    if (typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A stable subjectId is required.");
    if (!Array.isArray(taskIds) || !taskIds.length || new Set(taskIds).size !== taskIds.length || taskIds.some(id => !TASKS.some(t => t.id === id))) throw new Error("Choose unique supported touchdown task IDs.");
    const cases = taskIds.map((id, index) => {
      const prepared = prepare(id, { player, format, starId, support, weather, teamRerolls });
      const definition = TASKS.find(t => t.id === id);
      const result = { id, label: definition.label, axis: "mobility", ...(prepared.unavailable
        ? { status: prepared.status, reason: prepared.unavailable, maximumDistance: prepared.maximumDistance }
        : evaluatePrepared(subjectId, prepared, planOptions)) };
      if (onProgress) onProgress(index + 1, taskIds.length, result);
      return result;
    });
    return { suiteVersion: VERSION, modelVersion: window.BB_EVALUATION_V3.VERSION, engine: window.BB_BLOODBOARD_ENGINE.META,
      subjectId, subjectType: starId ? "star" : "player", settings: { format, starId, support, weather, teamRerolls }, profile: clone(player), cases,
      coverage: { declaredTasks: cases.length, calculatedTasks: cases.filter(c => c.replay && c.status !== "not-calculated").length,
        notApplicableTasks: cases.filter(c => c.status === "not-applicable").length, outOfRangeTasks: cases.filter(c => c.status === "out-of-range").length,
        notCalculatedTasks: cases.filter(c => c.status === "not-calculated").length,
        intervalPolicyResults: cases.flatMap(c => Object.values(c.measures || {})).filter(b => !b.safeObjective.exact).length },
      calibration: { assigned: false, reason: "Additive task evidence only; v3.34 and corrected-baseline calibration remain separate and unchanged." } };
  }
  window.BB_TOUCHDOWN_TASKS_V335 = Object.freeze({ VERSION, TASKS, POLICIES, DEFAULT_OPTIONS, prepare, evaluatePrepared, evaluate });
})();
