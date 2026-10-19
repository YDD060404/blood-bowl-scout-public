/* Shared Player / Star reference tasks. Rules and outcome trees stay in Bloodboard. */
(() => {
  const VERSION = "2.9.0-safe-knockdown-ranked-event";
  const POLICIES = ["withoutTeamRerolls", "withTeamRerolls"];
  const TASKS = Object.freeze([
    { id: "open1", label: "开阔站立抵达 1 格", axis: "mobility", task: "move", distance: 1 },
    { id: "open4", label: "开阔站立抵达 4 格", axis: "mobility", task: "move", distance: 4 },
    { id: "open6", label: "开阔站立抵达 6 格", axis: "mobility", task: "move", distance: 6 },
    { id: "open8", label: "开阔站立抵达 8 格", axis: "mobility", task: "move", distance: 8 },
    { id: "maximum", label: "声明最长直线距离", axis: "mobility", task: "move" },
    { id: "escape", label: "脱离一名盯防者并抵达 2 格", axis: "mobility", task: "move", distance: 2 },
    { id: "pickup", label: "前进 1 格拾球并安全持球", axis: "ball", task: "pickup" },
    { id: "handoff", label: "相邻 AG3 队友接交接球", axis: "ball", task: "handoff" },
    { id: "pass", label: "传给 3 格外的 AG3 队友", axis: "ball", task: "pass" },
    { id: "block", label: "主动阻挡 ST3 / AV9 目标", axis: "combat", task: "block" },
    { id: "guardSupport", label: "Guard 支援：盯防下协助队友阻挡", axis: "control", teamContextTask: true, requiredSkillId: "guard" },
    { id: "blitz1", label: "移动 1 格后 Blitz 阻挡 ST3 / AV9 目标", axis: "combat", task: "blitz", distance: 1 },
    { id: "foul", label: "条件犯规：已有倒地 AV9 目标", axis: "combat", task: "foul" },
    { id: "ballAndChain", label: "Ball & Chain 特殊攻击", axis: "combat", task: "ballAndChain", specialAttack: true },
    { id: "chainsaw", label: "Chainsaw 特殊攻击", axis: "combat", task: "chainsaw", specialAttack: true },
    { id: "bombardier", label: "Bombardier 投弹", axis: "combat", task: "bombardier", specialAttack: true },
    { id: "stab", label: "Stab 特殊攻击", axis: "combat", task: "stab", specialAttack: true },
    { id: "projectileVomit", label: "Projectile Vomit 特殊攻击", axis: "combat", task: "projectileVomit", specialAttack: true },
    { id: "breatheFire", label: "Breathe Fire 特殊攻击", axis: "combat", task: "breatheFire", specialAttack: true },
    { id: "monstrousMouth", label: "Monstrous Mouth：标记并固定相邻目标", axis: "control", task: "monstrousMouth", specialAttack: true },
    { id: "hypnoticGaze", label: "Hypnotic Gaze：使相邻目标失去盯防", axis: "control", task: "hypnoticGaze", controlAction: true },
    { id: "punt", label: "Punt：移动持球后定向踢球", axis: "ball", task: "punt", specialAttack: true },
    { id: "kickTeamMate", label: "Kick Team-mate：携球队友短传落区达阵", axis: "mobility", task: "kickTeamMate", teamScoringTask: true },
    ...[3, 4, 6].map(strength => ({ id: "incoming" + strength, label: "承受 ST" + strength + " / Block 来袭", axis: "survival", incoming: strength })),
    ...["normal", "stripBall", "tackle"].map(threat => ({ id: "carrier-" + threat,
      label: "持球保护：ST3 / Block" + (threat === "normal" ? "" : " / " + (threat === "stripBall" ? "Strip Ball" : "Tackle")), axis: "ball", threat })),
    { id: "disruption", label: "主动阻挡后对方球队失去球权", axis: "ball", task: "block" },
    { id: "core", label: "声明核心职责的可靠性", axis: "reliability" }
  ]);
  const DEFAULT_OPTIONS = Object.freeze({ threshold: 1e-12, maxLeaves: 20000, maxExpandedStates: 2000, followUp: false });
  const clone = value => JSON.parse(JSON.stringify(value));
  const all = (...events) => ({ type: "allOf", events });
  const safe = event => all(event, { type: "noTurnover" });
  const playerEvent = (type, playerId = "role-actor") => ({ type, playerId });
  const referenceOpponent = (st = 3, skills = []) => ({ name: "Declared reference opponent", position: "Reference opponent",
    ma: 6, st, ag: 3, pa: 4, av: 9, skills: skills.map(id => ({ id })), keywords: ["Human", "Lineman"] });

  function prepare(taskId, settings) {
    const bridge = window.BB_BLOODBOARD_ENGINE;
    const engine = window.BloodboardEngine;
    const definition = TASKS.find(task => task.id === taskId);
    if (!definition) throw new Error("Unknown reference task: " + taskId);
    const { player, format = "11s", teamRerolls = 1, support = "none", starId = null, coreTaskId, weather = "perfect" } = settings;
    const skills = (player.skills || []).map(skill => typeof skill === "string" ? skill : skill.id);
    if (taskId === "guardSupport") {
      if (!skills.includes("guard")) return { unavailable: "本档案没有 Guard；普通阻挡、守区与其它支援任务仍独立计算。", kind: "not-applicable" };
      const paired = bridge.calculateGuardSupportContribution({ supporter: player, supporterPressure: "marked", format,
        planOptions: { threshold: 1e-12, maxLeaves: 20000, maxExpandedStates: 20000 } });
      if (paired.status !== "engine-enumerated-same-state-skill-delta") throw new Error("Bloodboard rejected the Guard support comparison.");
      const taskState = pair => {
        const replay = pair.scenario.replay;
        const state = clone(replay.state);
        const attacker = pair.scenario.players.attacker;
        const target = pair.scenario.players.defender;
        const supporter = pair.scenario.players.supporter;
        state.teams.A.rerolls = teamRerolls;
        state.teams.A.leaderReroll = false;
        return { state, input: replay.input, attacker, target, supporter };
      };
      const withoutGuard = taskState(paired.withoutGuard);
      const withGuard = taskState(paired.withGuard);
      const down = { type: "playerDown", playerId: withGuard.target };
      const safeDown = all(down, { type: "noTurnover" });
      const reference = {
        id: taskId, label: definition.label,
        format, supporterPressure: "marked",
        roleId: "team-support", benchmarkId: "marked-guard-block-assist",
        successDefinition: "队友完成一次阻挡，目标被击倒，且攻击方未发生 Turnover。",
        comparison: "同一阻挡者、目标、站位与有限重掷；只切换支援者是否拥有 Guard。",
        positions: paired.withGuard.scenario.positions,
        players: { attacker: paired.withGuard.scenario.players.attacker, target: paired.withGuard.scenario.players.defender,
          supporter: paired.withGuard.scenario.players.supporter, marker: paired.withGuard.scenario.players.marker },
        pairedDeltas: paired.delta,
        rerollPool: teamRerolls,
        timepoint: "队友完成一次 Block 后；不包含后续激活或整回合策略。"
      };
      return { custom: "guardSupport", withoutGuard, withGuard, event: safeDown, reference };
    }
    const specialAttacks = ["ballAndChain", "chainsaw", "bombardier", "stab", "projectileVomit", "breatheFire", "monstrousMouth", "hypnoticGaze", "punt"];
    const holdingTask = ["pickup", "handoff", "pass", "punt"].includes(taskId) || !!definition.threat;
    // Not applicable is a task restriction, never a zero for the player's entire axis.
    if (holdingTask && skills.includes("noBall")) return { unavailable: "No Ball 禁止本任务的持球目标；无球机动、控场和武器任务仍可计算。", kind: "not-applicable" };
    if (specialAttacks.includes(taskId) && !skills.includes(taskId)) return { unavailable: "本档案没有这项特殊攻击；普通阻挡、条件犯规与其它特殊攻击分别评估。", kind: "not-applicable" };
    if (taskId === "kickTeamMate" && !skills.includes("kickTeamMate")) return { unavailable: "本档案没有 Kick Team-mate 特性；不因此降低普通快攻或控球能力。", kind: "not-applicable" };
    if (taskId === "kickTeamMate" && !player.pa) return { unavailable: "Kick Team-mate 需要 PA；该档案没有可执行的传球能力。", kind: "not-applicable" };
    if (taskId === "pass" && !player.pa) return { unavailable: "本档案没有 PA；不把其它球权任务一并记为零。", kind: "not-applicable" };
    if (taskId === "bombardier" && player.pa == null) return { unavailable: "Bombardier 需要 PA 才能投弹；不把其它杀伤任务一并记为零。", kind: "not-applicable" };
    if (["handoff", "pass"].includes(taskId) && skills.includes("myBall")) return { unavailable: "My Ball 禁止 Pass 与 Hand-off；拾球、持球保护仍独立计算。", kind: "not-applicable" };
    if (taskId === "punt" && skills.includes("myBall")) return { unavailable: "My Ball 禁止 Punt；普通拾球和持球保护仍独立计算。", kind: "not-applicable" };
    if (skills.includes("ballAndChain") && ["move", "block", "blitz", "foul"].includes(definition.task)) {
      return { unavailable: "Ball & Chain 不能使用这项普通行动；自身 Special Action 单独枚举。", kind: "not-applicable" };
    }
    const task = taskId === "core" ? (coreTaskId || bridge.recommendPlayerRoleTask(player))
      : definition.incoming || definition.threat ? bridge.recommendPlayerRoleTask(player)
      : definition.task;
    // The initial constructor retains the printed Star identity and actual paired partner.
    const prepared = bridge.preparePlayerRoleTask({ player, format, support, starId, teamRerolls, taskId: task,
      distance: taskId === "blitz1" ? definition.distance : 1 });
    prepared.state.weather = weather;
    const actor = prepared.state.players.find(player => player.id === "role-actor");
    const maximumDistance = actor.ma + engine.maxRushes(actor);
    if (definition.task === "move") {
      const distance = taskId === "maximum" ? maximumDistance : definition.distance;
      if (distance > maximumDistance) return { unavailable: "固定直线路径 " + distance + " 格超出本档案的合法上限 " + maximumDistance + " 格。",
        kind: "out-of-range", distance, maximumDistance };
      if (distance > 12) return { unavailable: "这份参考棋盘只支持最多 12 格直线路径；最长距离为 " + maximumDistance + " 格。",
        kind: "unsupported-reference", distance, maximumDistance };
      prepared.inputs[0].path = Array.from({ length: distance }, (_, index) => ({ to: { x: actor.pos.x + index + 1, y: actor.pos.y }, kind: "step" }));
      const destination = prepared.inputs[0].path.at(-1).to;
      const arrival = { type: "playerAtSquare", playerId: actor.id, square: clone(destination), stance: "standing" };
      prepared.event = safe(arrival);
      prepared.reference.distance = distance;
      prepared.reference.maximumDistance = maximumDistance;
      if (taskId === "escape") {
        const marker = bridge.addScenarioPlayer(prepared.state, "B", referenceOpponent(), { x: actor.pos.x, y: actor.pos.y + 1 });
        marker.id = "reference-marker";
        prepared.state.players.push(marker);
        prepared.reference.markerIds = [marker.id];
      }
    }
    if (taskId === "blitz1") {
      prepared.reference.distance = definition.distance;
      prepared.reference.maximumDistance = actor.ma + engine.maxRushes(actor);
      prepared.reference.blitzApproach = "Declared one-square legal Blitz path, then adjacent Block; the target and endpoint are fixed before evaluating outcomes.";
    }
    if (definition.incoming || definition.threat) {
      const state = prepared.state;
      state.players = state.players.filter(player => player.team === "A" && player.id !== "role-receiver");
      const attacker = bridge.addScenarioPlayer(state, "B", referenceOpponent(definition.incoming || 3,
        ["block", ...(definition.threat && definition.threat !== "normal" ? [definition.threat] : [])]), { x: actor.pos.x + 1, y: actor.pos.y });
      attacker.id = "reference-attacker";
      state.players.push(attacker);
      state.ball = definition.threat ? { kind: "held", playerId: actor.id } : { kind: "ground", pos: { x: 1, y: 1 } };
      state.turn.active = "B";
      state.teams.A.rerolls = 0;
      state.teams.B.rerolls = teamRerolls;
      state.teams.B.leaderReroll = false;
      prepared.inputs = [{ kind: "playerAction", playerId: attacker.id, action: "block", path: [], blockTarget: actor.id }];
      prepared.event = playerEvent("playerStanding");
      prepared.reference.attacker = clone(attacker);
      prepared.reference.resourceOwner = "来袭方 B；不是被评价球员所属的 A 队";
      prepared.reference.timepoint = "input-resolved: complete opposing Block, pushes, damage and ball reactions; no next-turn action";
    }
    if (taskId === "disruption") {
      prepared.state.ball = { kind: "held", playerId: "role-target" };
      prepared.event = safe({ type: "not", event: { type: "teamHasBall", team: "B" } });
    }
    if (taskId === "monstrousMouth") {
      prepared.event = safe({ type: "playerChomped", playerId: "role-target", chompingPlayerId: "role-actor" });
      prepared.reference.successDefinition = "Adjacent Standing target is Chomped, remains locked while the actor Marks it, and the acting team avoids Turnover.";
    }
    if (taskId === "hypnoticGaze") {
      prepared.event = safe(playerEvent("playerDistracted", "role-target"));
      prepared.reference.successDefinition = "The adjacent Standing opponent becomes Distracted (loses its Tackle Zone) and the acting team avoids Turnover; the opponent remains on the pitch, so this is a control task rather than a removal task.";
      prepared.reference.timepoint = "After the Hypnotic Gaze Special Action ends; no teammate follow-up activation is included.";
    }
    if (taskId === "kickTeamMate") {
      prepared.reference.scoringPartner = "固定 AG3、Right Stuff 且持球的参考队友；不代表队伍实际有可用搭档。";
      prepared.reference.successDefinition = "Bloodboard resolves Kick Team-mate, flight, landing and bounce; success is an actual Team A touchdown by the carried-ball teammate. Scoring itself ends the turn and is not treated as a turnover failure.";
      prepared.reference.target = { x: bridge.getPitchDimensions(format).width - 1, y: actor.pos.y };
    }
    prepared.reference.id = taskId;
    prepared.reference.weather = weather;
    prepared.reference.label = definition.label;
    prepared.reference.taskId = task;
    prepared.reference.starResources = starId ? "Fresh independent reference scenario; automatic supported reactions use actual Star identity. No optional activation-start rule is declared." : null;
    prepared.reference.recruitmentLegality = "Custom probability board only; does not certify alliance, budget, Tier package or recruitment legality.";
    const errors = engine.validatePosition(prepared.state).filter(issue => issue.level === "error");
    const inputErrors = engine.validateInput(prepared.state, prepared.inputs[0]);
    if (errors.length || inputErrors.length) throw new Error([...errors.map(issue => issue.text), ...inputErrors].join("; "));
    return prepared;
  }

  function objective(prepared) {
    const event = prepared.event;
    return event.type === "allOf" ? { type: "allOf", events: event.events.filter(child => child.type !== "noTurnover") } : event;
  }

  function observationsFor(subjectId, prepared, raw, metrics, planOptions) {
    const model = window.BB_EVALUATION_V3;
    const state = prepared.state;
    const actorTeam = state.players.find(player => player.id === "role-actor").team;
    return POLICIES.flatMap(policy => metrics.map(metric => model.recordTaskResult({
      submetricId: metric.id, subjectId,
      result: { ...metric.result(raw[policy]), unresolved: raw[policy].unresolved },
      context: { format: state.variant === "sevens" ? "sevens" : "11s", boardState: state,
        opponentProfile: state.players.filter(player => player.team !== actorTeam),
        supportState: state.players.filter(player => player.team === actorTeam && player.id !== "role-actor"),
        rerollPool: policy === "withTeamRerolls" ? state.teams[state.turn.active].rerolls : 0,
        taskParameters: { reference: prepared.reference, inputs: prepared.inputs, rerollPolicy: policy, exploration: planOptions,
          resourceOwner: state.turn.active, sharedExecutionTree: "All observations for this task and policy come from the same outcome tree; never sum them into Strength." },
        event: metric.event },
      provenance: { engineId: raw.engine.id, engineVersion: raw.engine.version, engineSha256: raw.engine.sha256,
        api: "player-task-suite+evaluateActionSequence" }
    })));
  }

  function evaluatePrepared(subjectId, definition, prepared, options, includeDamageOutcomeVectors = false) {
    const bridge = window.BB_BLOODBOARD_ENGINE;
    const model = window.BB_EVALUATION_V3;
    if (definition.id === "guardSupport") {
      const resultFor = scenario => bridge.evaluateActionSequence({
        state: scenario.state,
        inputs: [scenario.input],
        event: prepared.event,
        options: { ...options, maxExpandedStates: 20000 },
        measureEvents: { targetDown: { type: "playerDown", playerId: scenario.target } }
      });
      const baseline = resultFor(prepared.withoutGuard);
      const supported = resultFor(prepared.withGuard);
      const observations = POLICIES.flatMap(policy => {
        const before = baseline[policy];
        const after = supported[policy];
        if (!before.legal || !after.legal) throw new Error("Guard support paired Block task is illegal under " + policy + ".");
        const beforeSuccess = before.taskSuccessProbability;
        const afterSuccess = after.taskSuccessProbability;
        const delta = { lowerBound: afterSuccess.lowerBound - beforeSuccess.upperBound,
          upperBound: afterSuccess.upperBound - beforeSuccess.lowerBound,
          exact: beforeSuccess.exact && afterSuccess.exact,
          unresolved: Math.min(1, before.unresolved + after.unresolved) };
        if (delta.exact) delta.value = delta.lowerBound;
        const policyRerolls = policy === "withTeamRerolls" ? prepared.withGuard.state.teams.A.rerolls : 0;
        const context = {
          format: prepared.reference.format,
          boardState: { withoutGuard: prepared.withoutGuard.state, withGuard: prepared.withGuard.state,
            eventTimepoint: prepared.reference.timepoint },
          opponentProfile: [prepared.withGuard.state.players.find(player => player.id === prepared.withGuard.target),
            prepared.withGuard.state.players.find(player => player.id === prepared.reference.players.marker)],
          supportState: { roleId: prepared.reference.roleId, benchmarkId: prepared.reference.benchmarkId,
            evaluatedSupporterId: prepared.withGuard.supporter, pressure: "marked",
            comparison: prepared.reference.comparison },
          rerollPool: policyRerolls,
          taskParameters: { reference: prepared.reference, taskId: definition.id,
            inputs: [prepared.withGuard.input], rerollPolicy: policy,
            resourceOwner: "Team A; one finite pool is shared across the declared block action",
            unresolvedPolicy: "Preserve paired probability bounds; never substitute a midpoint." },
          event: prepared.event
        };
        const provenance = { engineId: baseline.engine.id, engineVersion: baseline.engine.version,
          engineSha256: baseline.engine.sha256, api: "calculateGuardSupportContribution+evaluateActionSequence" };
        return [
          model.recordTaskResult({ submetricId: "control.supportDelta", subjectId,
            result: delta, context, provenance }),
          model.recordTaskResult({ submetricId: "adaptability.roleCoverage", subjectId,
            result: { ...afterSuccess, unresolved: after.unresolved }, context, provenance })
        ];
      });
      return {
        engine: supported.engine, status: supported.status, reference: prepared.reference, observations,
        measures: Object.fromEntries(POLICIES.map(policy => [policy, {
          withoutGuard: baseline[policy].taskSuccessProbability,
          withGuard: supported[policy].taskSuccessProbability,
          guardSupportDelta: { lowerBound: supported[policy].taskSuccessProbability.lowerBound - baseline[policy].taskSuccessProbability.upperBound,
            upperBound: supported[policy].taskSuccessProbability.upperBound - baseline[policy].taskSuccessProbability.lowerBound,
            exact: baseline[policy].taskSuccessProbability.exact && supported[policy].taskSuccessProbability.exact },
          targetDown: supported[policy].eventProbabilities.targetDown,
          turnover: supported[policy].turnoverProbability,
          unresolved: Math.max(baseline[policy].unresolved, supported[policy].unresolved)
        }])),
        replay: { state: clone(prepared.withGuard.state), inputs: [clone(prepared.withGuard.input)], event: clone(prepared.event),
          measureEvents: { targetDown: { type: "playerDown", playerId: prepared.withGuard.target } },
          planOptions: { ...options, maxExpandedStates: 20000 }, focalPlayerId: prepared.withGuard.supporter }
      };
    }
    if (definition.id === "core") {
      const raw = model.evaluateRoleReliabilityTasks({ ...prepared, subjectId, planOptions: options });
      return { ...raw, reference: prepared.reference, measures: POLICIES.reduce((results, policy) => {
        const branch = raw[policy];
        results[policy] = { activation: branch.completedDeclaredSequenceProbability, safeObjective: branch.taskSuccessProbability,
          objective: branch.eventProbabilities.objective, turnover: branch.turnoverProbability,
          remainingTeamRerolls: branch.remainingTeamRerolls, unresolved: branch.unresolved };
        return results;
      }, {}) };
    }
    if (definition.threat) {
      const carrierOptions = Object.fromEntries(Object.entries(options).filter(([key]) => key !== "maxExpandedStates"));
      const raw = model.evaluateCarrierThreatTasks({ subjectId, state: prepared.state, input: prepared.inputs[0],
        carrierPlayerId: "role-actor", planOptions: carrierOptions });
      return { ...raw, reference: prepared.reference, measures: Object.fromEntries(POLICIES.map(policy => {
        const branch = raw.policies[policy];
        return [policy, { carrier: branch.possession.carrier, teamRetention: branch.teamRetention,
          standingWithBall: branch.standingWithBall, possession: branch.possession,
          turnover: branch.attackingTeamTurnover, unresolved: branch.unresolved }];
      })) };
    }
    const goal = objective(prepared);
    const puntEvents = definition.id === "punt" ? {
      receiverPossession: playerEvent("playerHasBall", "role-punt-receiver"),
      ownPossession: all({ type: "teamHasBall", team: "A" }, { type: "noTurnover" }),
      opponentPossession: { type: "teamHasBall", team: "B" },
      safeLooseBall: all({ type: "ballOnGround" }, { type: "noTurnover" }),
      ownTouchdown: { type: "teamTouchdown", team: "A" },
      opponentTouchdown: { type: "teamTouchdown", team: "B" }
    } : null;
    const measureEvents = definition.id === "punt"
      ? { objective: goal, ...puntEvents }
      : { objective: goal, ...(definition.teamScoringTask ? {} : { safeObjective: safe(goal) }),
        focalTackleZones: playerEvent("playerHasTackleZone") };
    const metrics = [];
    const metric = (id, field, event) => metrics.push({ id, event, result: branch => branch.eventProbabilities[field] });
    if (definition.task === "move") {
      metric(definition.id === "escape" ? "mobility.escapeContact" : "mobility.openRoute",
        definition.id === "escape" ? "safeObjective" : "objective", definition.id === "escape" ? safe(goal) : goal);
    } else if (["pickup", "pass", "handoff"].includes(definition.id)) {
      metric(definition.id === "pickup" ? "ball.acquisition" : "ball.transfer", "safeObjective", safe(goal));
    } else if (definition.id === "punt") {
      metric("ball.puntOwnPossession", "ownPossession", puntEvents.ownPossession);
      metric("ball.puntReceiverSecures", "receiverPossession", puntEvents.receiverPossession);
      metric("ball.puntOpponentPossession", "opponentPossession", puntEvents.opponentPossession);
      metric("ball.puntLiveLooseBall", "safeLooseBall", puntEvents.safeLooseBall);
      metric("mobility.puntTouchdown", "ownTouchdown", puntEvents.ownTouchdown);
      metric("ball.puntOpponentTouchdown", "opponentTouchdown", puntEvents.opponentTouchdown);
      metrics.push({ id: "ball.puntTurnover", event: { type: "turnover" },
        result: branch => branch.turnoverProbability });
    } else if (definition.incoming) {
      const origin = prepared.reference.origin;
      Object.assign(measureEvents, { standing: playerEvent("playerStanding"), prone: playerEvent("playerProne"),
        stunned: playerEvent("playerStunned"), removed: playerEvent("playerRemoved"),
        exactSquare: { type: "playerAtSquare", playerId: "role-actor", square: clone(origin), stance: "standing" },
        localStanding: { type: "playerStandingWithin", playerId: "role-actor", center: clone(origin), radius: 1 } });
      delete measureEvents.safeObjective; // Eight named events share this single incoming-action tree.
      delete measureEvents.objective;
      measureEvents.localTackleZone = all(measureEvents.localStanding, measureEvents.focalTackleZones);
      metric("survival.incomingBlock", "standing", measureEvents.standing);
      metric("survival.positionRetention", "exactSquare", measureEvents.exactSquare);
      metric("control.staticPersistence", "localStanding", measureEvents.localStanding);
      metrics.push({ id: "survival.damageChain", event: { type: "postBlockStateDistribution", playerId: "role-actor" },
        result: branch => ({ distribution: Object.fromEntries(["standing", "prone", "stunned", "removed"].map(key => [key, branch.eventProbabilities[key]])),
          exact: branch.unresolved <= 1e-12, unresolved: branch.unresolved }) });
    } else if (definition.id === "disruption") {
      metric("ball.disruption", "objective", goal);
    }
    if (definition.teamScoringTask) metric("mobility.kickTeamMateTouchdown", "objective", goal);
    if (["block", "blitz1", "foul", "ballAndChain", "chainsaw", "bombardier", "stab", "projectileVomit", "breatheFire", "monstrousMouth", "hypnoticGaze", "punt"].includes(definition.id)) {
      if (definition.id === "hypnoticGaze") {
        const distracted = playerEvent("playerDistracted", "role-target");
        measureEvents.targetDistracted = distracted;
        measureEvents.safeSpecialObjective = safe(goal);
        metric("control.hypnoticGaze", "safeSpecialObjective", measureEvents.safeSpecialObjective);
        metric("control.gazeTargetDistraction", "targetDistracted", distracted);
      } else if (definition.id === "punt") {
        // Punt outputs are a mutually distinguishable ball-state profile, not a single tactical success percentage.
      } else if (definition.specialAttack) {
        if (definition.id === "monstrousMouth") {
          measureEvents.safeSpecialObjective = safe(goal);
          metric("control.specialPin", "safeSpecialObjective", measureEvents.safeSpecialObjective);
        } else {
        const targetEffect = { type: "anyOf", events: [playerEvent("playerDown", "role-target"), playerEvent("playerRemoved", "role-target")] };
        Object.assign(measureEvents, {
          targetEffect,
          actorDown: playerEvent("playerDown"),
          actorRemoved: playerEvent("playerRemoved")
        });
        const selfHarmed = { type: "anyOf", events: [measureEvents.actorDown, measureEvents.actorRemoved] };
        measureEvents.safeSpecialObjective = safe(goal);
        metric("combat.specialAction", "safeSpecialObjective", measureEvents.safeSpecialObjective);
        if (definition.id === "bombardier") {
          const collateralEffect = { type: "anyOf", events: [playerEvent("playerDown", "role-collateral"), playerEvent("playerRemoved", "role-collateral")] };
          measureEvents.safeCollateralEffect = safe(collateralEffect);
          metric("combat.specialCollateral", "safeCollateralEffect", measureEvents.safeCollateralEffect);
        }
        metrics.push({ id: "survival.specialBackfire", event: selfHarmed, result: branch => {
          const down = branch.eventProbabilities.actorDown;
          const removed = branch.eventProbabilities.actorRemoved;
          return { lowerBound: Math.min(1, down.lowerBound + removed.lowerBound),
            upperBound: Math.min(1, down.upperBound + removed.upperBound),
            exact: down.exact && removed.exact, unresolved: branch.unresolved };
        } });
        }
      } else {
      Object.assign(measureEvents, { removed: playerEvent("playerRemoved", "role-target"),
        safeRemoval: safe(playerEvent("playerRemoved", "role-target")),
        selfRemoved: playerEvent("playerRemoved"), sentOff: playerEvent("playerSentOff") });
      if (["block", "blitz1"].includes(definition.id)) {
        metric("combat.knockdown", "objective", goal);
        // Count only a target down/removed with no attacking-team Turnover.
        // This keeps raw knockdown separate from the tactically safe outcome.
        metric("combat.safeKnockdown", "safeObjective", safe(goal));
        metric("combat.removal", "safeRemoval", measureEvents.safeRemoval);
      } else if (definition.id === "foul") metric("combat.foulRemoval", "safeRemoval", measureEvents.safeRemoval);
      // Weapon outcomes stay explicitly labelled; ordinary-Block contracts are not repurposed for Special Actions.
      }
    }
    const damageVectorTask = ["block", "blitz1", "foul", "ballAndChain", "chainsaw", "bombardier", "stab", "projectileVomit", "breatheFire"].includes(definition.id);
    let damageEventIds = [];
    if (includeDamageOutcomeVectors && damageVectorTask) {
      const target = "role-target";
      const targetKO = playerEvent("playerKO", target);
      const targetCasualty = playerEvent("playerCasualty", target);
      const targetIncapacitated = definition.id === "foul" ? playerEvent("playerRemoved", target)
        : { type: "anyOf", events: [playerEvent("playerDown", target), playerEvent("playerRemoved", target)] };
      const targetRemovedOther = all(playerEvent("playerRemoved", target),
        { type: "not", event: targetKO }, { type: "not", event: targetCasualty });
      const damageEvents = {
        ...(definition.id === "foul" ? {} : {
          targetDownOnPitch: all(playerEvent("playerDown", target), playerEvent("playerOnPitch", target)),
          targetProneOnPitch: all(playerEvent("playerProne", target), playerEvent("playerOnPitch", target)),
          targetStunnedOnPitch: all(playerEvent("playerStunned", target), playerEvent("playerOnPitch", target))
        }),
        targetKO,
        targetCasualty,
        targetIncapacitated,
        targetRemoved: playerEvent("playerRemoved", target),
        targetArmourBroken: playerEvent("playerArmourBroken", target),
        targetRemovedOther
      };
      for (const [id, event] of Object.entries(damageEvents)) damageEvents[`safe${id[0].toUpperCase()}${id.slice(1)}`] = safe(event);
      if (definition.id === "foul") {
        // A conditional foul only counts as safe personal output when the target
        // is removed, the action avoids Turnover, and the fouler is not sent off.
        damageEvents.safeTargetRemovedNoSendoff = all(playerEvent("playerRemoved", target),
          { type: "noTurnover" }, { type: "not", event: playerEvent("playerSentOff") });
      }
      if (definition.id === "bombardier") {
        const collateral = "role-collateral";
        const collateralKO = playerEvent("playerKO", collateral);
        const collateralCasualty = playerEvent("playerCasualty", collateral);
        const collateralEvents = {
          collateralDownOnPitch: all(playerEvent("playerDown", collateral), playerEvent("playerOnPitch", collateral)),
          collateralProneOnPitch: all(playerEvent("playerProne", collateral), playerEvent("playerOnPitch", collateral)),
          collateralStunnedOnPitch: all(playerEvent("playerStunned", collateral), playerEvent("playerOnPitch", collateral)),
          collateralKO,
          collateralCasualty,
          collateralIncapacitated: { type: "anyOf", events: [playerEvent("playerDown", collateral), playerEvent("playerRemoved", collateral)] },
          collateralRemoved: playerEvent("playerRemoved", collateral),
          collateralArmourBroken: playerEvent("playerArmourBroken", collateral),
          collateralRemovedOther: all(playerEvent("playerRemoved", collateral),
            { type: "not", event: collateralKO }, { type: "not", event: collateralCasualty })
        };
        for (const [id, event] of Object.entries(collateralEvents)) collateralEvents[`safe${id[0].toUpperCase()}${id.slice(1)}`] = safe(event);
        Object.assign(damageEvents, collateralEvents);
      }
      damageEventIds = Object.keys(damageEvents);
      Object.assign(measureEvents, damageEvents);
    }
    const movement = definition.task === "move";
    // Bomb catches/intercepts can branch into repeated rethrows. Keep its full engine tree,
    // but bound work per profile and preserve the remaining mass as explicit probability intervals.
    const taskOptions = definition.id === "bombardier"
      ? { ...options, threshold: Math.max(options.threshold, 1e-4), maxLeaves: Math.min(options.maxLeaves, 10000),
        maxExpandedStates: Math.min(options.maxExpandedStates, 2000) }
      : definition.id === "kickTeamMate"
        ? { ...options, maxLeaves: Math.max(options.maxLeaves, 50000), maxExpandedStates: Math.max(options.maxExpandedStates, 20000) }
      : options;
    const raw = bridge.evaluateActionSequence({ state: prepared.state, inputs: prepared.inputs, event: prepared.event,
      options: taskOptions, measureEvents, measureTeamTackleZonesFor: movement ? ["A", "B"] : [] });
    if (POLICIES.some(policy => !raw[policy].legal)) throw new Error("Reference task has illegal branches: " +
      [...new Set(POLICIES.flatMap(policy => raw[policy].errors))].join("; "));
    const netFootprint = branch => {
      const own = branch.teamTackleZoneFootprints.A.expectedChangeFromInitial;
      const opposing = branch.teamTackleZoneFootprints.B.expectedChangeFromInitial;
      return { lowerBound: own.lowerBound - opposing.upperBound, upperBound: own.upperBound - opposing.lowerBound,
        exact: own.exact && opposing.exact };
    };
    if (movement) metrics.push({ id: "control.dynamic", event: { type: "netTeamTackleZoneChange", teams: ["A", "B"] }, result: netFootprint });
    const observations = observationsFor(subjectId, prepared, raw, metrics, taskOptions);
    // Bloodboard's generic named-target summary does not attribute Bombardier's square-based blast.
    // Its focal and collateral effects are measured from the complete terminal action tree above.
    const specialOutcomeSummary = definition.specialAttack && !["bombardier", "punt"].includes(definition.id)
      ? bridge.planAction(prepared.state, prepared.inputs[0], Object.fromEntries(Object.entries(options)
        .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)))).summary
      : undefined;
    return { engine: raw.engine, status: raw.status, reference: prepared.reference, observations,
      measures: Object.fromEntries(POLICIES.map(policy => [policy, { ...raw[policy].eventProbabilities,
        turnover: raw[policy].turnoverProbability, inputCompletion: raw[policy].completedDeclaredSequenceProbability,
        remainingTeamRerolls: raw[policy].remainingTeamRerolls, unresolved: raw[policy].unresolved,
        ...(includeDamageOutcomeVectors && damageVectorTask ? { damageOutcomes: Object.fromEntries(
          damageEventIds.map(id => [id, raw[policy].eventProbabilities[id]])) } : {}),
        ...(specialOutcomeSummary ? { specialOutcome: specialOutcomeSummary[policy] } : {}),
        ...(movement ? { netControlFootprint: netFootprint(raw[policy]) } : {}) }])),
      replay: { state: clone(prepared.state), inputs: clone(prepared.inputs), event: clone(prepared.event),
        measureEvents: clone(measureEvents), measureTeamTackleZonesFor: movement ? ["A", "B"] : [], planOptions: clone(taskOptions) } };
  }

  async function evaluate({ player, subjectId = player?.id, format = "11s", starId = null,
    teamRerolls = 1, support = "none", coreTaskId = null, weather = "perfect", taskIds = TASKS.map(task => task.id),
    planOptions = {}, includeDamageOutcomeVectors = false, yieldTask = null, onProgress = null } = {}) {
    if (!player || typeof subjectId !== "string" || !subjectId.trim()) throw new TypeError("A profile and stable subjectId are required.");
    if (!["11s", "sevens"].includes(format) || ![0, 1].includes(teamRerolls) || !["none", "lineman", "thrall"].includes(support)) throw new Error("Declare a supported format, 0/1 shared reroll and actual helper.");
    if (!["perfect", "pouringRain", "verySunny"].includes(weather)) throw new Error("Declare perfect, pouringRain or verySunny reference weather.");
    if (!Array.isArray(taskIds) || !taskIds.length || new Set(taskIds).size !== taskIds.length || taskIds.some(id => !TASKS.some(task => task.id === id))) throw new Error("Declare unique supported reference task IDs.");
    if (typeof includeDamageOutcomeVectors !== "boolean") throw new TypeError("includeDamageOutcomeVectors must be boolean.");
    if (starId && format !== "11s") throw new Error("Star Players are excluded from the Sevens reference tasks.");
    const options = { ...DEFAULT_OPTIONS, ...planOptions };
    // Identity errors fail the entire dossier, not twenty misleading per-task zero values.
    window.BB_BLOODBOARD_ENGINE.preparePlayerRoleTask({ player, format, starId, support, teamRerolls,
      taskId: coreTaskId || window.BB_BLOODBOARD_ENGINE.recommendPlayerRoleTask(player), distance: 1 });
    const cases = [];
    for (const taskId of taskIds) {
      const definition = TASKS.find(task => task.id === taskId);
      if (yieldTask) await yieldTask();
      try {
        const prepared = prepare(taskId, { player, format, starId, support, teamRerolls, coreTaskId, weather });
        if (prepared.unavailable) cases.push({ id: taskId, label: definition.label, axis: definition.axis,
          ...(definition.requiredSkillId ? { requiredSkillId: definition.requiredSkillId } : {}), status: prepared.kind,
          reason: prepared.unavailable, ...(prepared.maximumDistance != null ? { maximumDistance: prepared.maximumDistance } : {}) });
        else cases.push({ id: taskId, label: definition.label, axis: definition.axis,
          ...(definition.requiredSkillId ? { requiredSkillId: definition.requiredSkillId } : {}),
          ...evaluatePrepared(subjectId, definition, prepared, options, includeDamageOutcomeVectors) });
      } catch (error) {
        cases.push({ id: taskId, label: definition.label, axis: definition.axis, status: "not-calculated", reason: error.message });
      }
      if (onProgress) onProgress(cases.length, taskIds.length, cases.at(-1));
    }
    const observations = cases.flatMap(task => task.observations || []);
    const taskProfile = window.BB_EVALUATION_V3.buildTaskProfile(subjectId, observations, player);
    return { suiteVersion: VERSION, modelVersion: window.BB_EVALUATION_V3.VERSION, engine: window.BB_BLOODBOARD_ENGINE.META,
      subjectId, subjectType: starId ? "star" : "player", settings: { format, starId, teamRerolls, support, weather, coreTaskId: coreTaskId || window.BB_BLOODBOARD_ENGINE.recommendPlayerRoleTask(player) },
      profile: clone(player), cases, taskProfile,
      coverage: { declaredTasks: cases.length, calculatedTasks: cases.filter(task => task.replay).length,
        notApplicableTasks: cases.filter(task => task.status === "not-applicable").length,
        outOfRangeTasks: cases.filter(task => task.status === "out-of-range").length,
        notCalculatedTasks: cases.filter(task => ["not-calculated", "unsupported-reference"].includes(task.status)).length,
        intervalPolicyResults: cases.flatMap(task => Object.values(task.measures || {})).filter(branch => branch.unresolved > 1e-12).length },
      limitation: "Independent declared reference tasks, not one playable turn or match. Every case resets its initial finite resources. Star identity and real paired partners are retained; optional activation-start rules are not requested. Probability boards do not certify recruitment legality. Weapon events are not ordinary Block observations. Missing tasks are not zero ability. Axis anchors, task-frequency weights, formal grades, Strength, team aggregation and recruitment value remain uncalibrated." };
  }

  window.BB_PLAYER_TASKS = Object.freeze({ VERSION, TASKS, DEFAULT_OPTIONS, prepare, evaluate });
})();
