/*
 * Thin adapter around the official Bloodboard V6.1 rules engine.
 * This file deliberately does not implement Blood Bowl rules or probabilities.
 */
(() => {
  const META = Object.freeze({
    id: "bloodboard-v7",
    version: "7.0.1",
    builtAt: "2026-10-04",
    rules: "Bloodboard 7.0.1 ruleset (standard + Sevens)",
    source: "Bloodboard 7.0.1 official bundled engine",
    artifact: "vendor/bloodboard-engine-v7.0.1.js",
    sha256: "015f6879ad93c03e810a71d7e541aad5da71f93839eb84951a0979d242ab7754"
  });

  const DYNAMIC_CONTROL_STAR_TARGET_RANGES = Object.freeze({ kiroth: 1, zolcath: 3 });

  function getEngine() {
    const engine = window.BloodboardEngine;
    if (!engine || typeof engine.planAction !== "function") {
      throw new Error("Bloodboard 7.0.1 rules engine did not load before the evaluation adapter.");
    }
    return engine;
  }

  function getPitchDimensions(format = "11s") {
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be '11s' or 'sevens'.");
    const pitch = getEngine().RULESETS?.[variant]?.pitch;
    if (!pitch || !Number.isInteger(pitch.w) || !Number.isInteger(pitch.h)) {
      throw new Error("The selected Bloodboard ruleset does not expose pitch dimensions.");
    }
    return { width: pitch.w, height: pitch.h, variant };
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function teamTackleZoneSquares(snapshot, team, dimensions) {
    const cells = new Set();
    snapshot.players.forEach(player => {
      if (player.team !== team || player.location !== "pitch" || !player.pos || player.stance !== "standing" || player.distracted) return;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = player.pos.x + dx;
        const y = player.pos.y + dy;
        if (x >= 0 && x < dimensions.width && y >= 0 && y < dimensions.height) cells.add(`${x},${y}`);
      }
    });
    return cells;
  }

  function profileForEngine(engine, player) {
    if (!player || typeof player !== "object") throw new TypeError("A player profile is required.");
    // Atlas Sevens rosters already store the Veteran's MA −1; preserve that profile value.
    const skills = (player.skills || []).map(skill => typeof skill === "string" ? { id: skill } : cloneJson(skill));
    const unknownSkills = skills.map(skill => skill.id).filter(id => !engine.SKILL_BY_ID[id]);
    if (unknownSkills.length) throw new Error("Unknown Bloodboard skill ID(s): " + [...new Set(unknownSkills)].join(", "));
    const profile = {
      position: player.position || player.name || "Evaluation player",
      name: player.name || player.position || "Evaluation player",
      ma: player.ma,
      st: player.st,
      ag: player.ag,
      pa: player.pa,
      av: player.av,
      skills,
      keywords: player.keywords || [],
      ...(player.veteran === true || player.veteran === "ready" ? { veteran: "ready" } : {}),
      ...(player.veteran === "used" ? { veteran: "used" } : {})
    };
    const printedStarMatches = starId => {
      const printed = engine.STAR_BY_ID?.[starId];
      const signature = values => JSON.stringify((values || []).map(skill => typeof skill === "string" ? { id: skill } : skill)
        .map(skill => [skill.id, skill.value ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      return !!printed && !["ma", "st", "ag", "pa", "av"].some(stat => player[stat] !== printed[stat]) &&
        signature(profile.skills) === signature(printed.skills) &&
        JSON.stringify([...(profile.keywords || [])].sort()) === JSON.stringify([...printed.keywords].sort()) &&
        !profile.veteran && !player.boughtSkill;
    };
    const inferredStarId = !player.star && engine.STAR_BY_ID?.[player.id] && printedStarMatches(player.id) ? player.id : null;
    const candidateStarId = player.star || inferredStarId;
    if (candidateStarId) {
      const printed = engine.STAR_BY_ID?.[candidateStarId];
      if (!printed || !engine.starSupported?.(candidateStarId)) {
        throw new Error("Star Player identity is unknown or its special rule is unsupported by the loaded Bloodboard engine: " + candidateStarId);
      }
      if (!printedStarMatches(candidateStarId)) {
        throw new Error("A Star Player identity can only be attached to the unedited printed profile; custom skills or stats must not inherit a Star rule.");
      }
      profile.star = candidateStarId;
      profile.starUsed = Array.isArray(player.starUsed) ? player.starUsed.slice() : [];
    }
    return profile;
  }

  function resolveStarId(player) {
    if (!player || typeof player !== "object") return null;
    const engine = getEngine();
    const id = player.star || (engine.STAR_BY_ID?.[player.id] ? player.id : null);
    if (!id) return null;
    profileForEngine(engine, player);
    return id;
  }

  function hasDeclaredStarRule(player) {
    return !!player && ["specialRules", "specialEffectCodes", "specialEffects"].some(key => {
      const value = player[key];
      return Array.isArray(value) ? value.length > 0 : !!value;
    });
  }

  function assertCanonicalStarRuleIdentity(player, scope) {
    if (!hasDeclaredStarRule(player)) return null;
    const starId = resolveStarId(player);
    if (!starId) {
      throw new Error(`${scope} declares Star Player rules/effects without a matching canonical Star Player identity; rule text cannot be applied by itself.`);
    }
    return starId;
  }

  function customScenarioPlayer(engine, state, team, profile, at) {
    const player = engine.customPlayer(state, team, profile, at);
    if (profile.veteran) {
      if (state.variant !== "sevens") {
        throw new Error("Veteran is only available in the Blood Bowl Sevens scenario ruleset.");
      }
      if (state.players.some(existing => existing.team === team && existing.veteran)) {
        throw new Error("A Sevens scenario team can have only one Veteran player.");
      }
      player.veteran = profile.veteran;
    }
    if (profile.star) {
      player.star = profile.star;
      player.starUsed = profile.starUsed || [];
    }
    return player;
  }

  function summarize(plan) {
    const summarizeOutcomes = outcomes => outcomes && ({
      completed: outcomes.pCompleted,
      turnover: outcomes.pTurnover,
      touchdownForActiveTeam: outcomes.pTouchdownActive,
      touchdownForOpponent: outcomes.pTouchdownOpp,
      activeTeamHasBall: outcomes.pActiveHasBall,
      opponentTeamHasBall: outcomes.pOppHasBall,
      ballOnGround: outcomes.pBallGround,
      ballWithActor: outcomes.pBallWithActor,
      ballWithReceiver: outcomes.pBallWithReceiver,
      actorDown: outcomes.pActorDown,
      actorRemoved: outcomes.pActorRemoved,
      actorFell: outcomes.pActorFell,
      targetDown: outcomes.pTargetDown,
      targetRemoved: outcomes.pTargetRemoved,
      targetKO: outcomes.pTargetKO,
      targetCasualty: outcomes.pTargetCas,
      targetArmourBroken: outcomes.pTargetArmourBroken,
      targetPushed: outcomes.pTargetPushed,
      targetCrowd: outcomes.pTargetCrowd,
      secondTargetDown: outcomes.pTarget2Down,
      intercepted: outcomes.pIntercepted,
      blockResult: outcomes.blockResult,
      passResult: outcomes.passResult,
      unresolved: outcomes.unresolved,
      leaves: outcomes.leaves
    });
    return {
      legal: plan.ok,
      errors: plan.errors,
      withoutTeamRerolls: summarizeOutcomes(plan.withoutTeamRerolls),
      withTeamRerolls: summarizeOutcomes(plan.withTeamRerolls),
      steps: (plan.steps || []).map(step => ({
        kind: step.kind,
        label: step.label,
        target: step.target,
        modifiers: step.mods,
        firstRollSuccess: step.pSingle,
        withAllowedReroll: step.pWithReroll,
        consequencesOnFailure: step.onFail,
        source: step.rule
      })),
      block: plan.block || null,
      pass: plan.pass || null,
      assumptions: plan.assumptions || []
    };
  }

  function planAction(state, input, options = {}) {
    if (!state || !input) throw new TypeError("A complete Bloodboard GameState and ActionInput are required.");
    const engine = getEngine();
    const plan = engine.planAction(cloneJson(state), cloneJson(input), options);
    return { engine: META, timepoint: "input-resolved", summary: summarize(plan), plan };
  }

  function eventMatches(state, event, outcome) {
    const player = event.playerId ? state.players.find(item => item.id === event.playerId) : null;
    switch (event.type) {
      case "allOf":
        return event.events.every(child => eventMatches(state, child, outcome));
      case "anyOf":
        return event.events.some(child => eventMatches(state, child, outcome));
      case "not":
        return !eventMatches(state, event.event, outcome);
      case "turnover":
        return outcome?.turnover === true;
      case "noTurnover":
        return outcome?.turnover === false;
      case "playerHasBall":
        return state.ball.kind === "held" && state.ball.playerId === event.playerId;
      case "teamHasBall": {
        if (state.ball.kind !== "held") return false;
        const holder = state.players.find(item => item.id === state.ball.playerId);
        return holder?.team === event.team;
      }
      case "teamTouchdown":
        return outcome?.touchdown === event.team || state.touchdown?.team === event.team;
      case "playerAtSquare":
        return player?.location === "pitch" && player.pos?.x === event.square.x && player.pos?.y === event.square.y &&
          (event.stance === "any" || player.stance === event.stance);
      case "playerStandingWithin":
        return player?.location === "pitch" && player.stance === "standing" && !!player.pos &&
          Math.max(Math.abs(player.pos.x - event.center.x), Math.abs(player.pos.y - event.center.y)) <= event.radius;
      case "playerOnPitch":
        return player?.location === "pitch";
      case "playerDistracted":
        return player?.location === "pitch" && player.distracted === true;
      case "playerChomped": {
        const chomper = state.players.find(item => item.id === event.chompingPlayerId);
        return player?.location === "pitch" && player.chompedBy === event.chompingPlayerId && !!player.pos &&
          chomper?.location === "pitch" && getEngine().hasTackleZone(chomper) && !!chomper.pos &&
          Math.max(Math.abs(chomper.pos.x - player.pos.x), Math.abs(chomper.pos.y - player.pos.y)) === 1;
      }
      case "playerHexedForNextTurn":
        return player?.location === "pitch" && player.stance !== "stunned" && !player.activated &&
          player.hexed?.half === state.turn.half && player.hexed?.turn === state.teams[player.team].turn + 1;
      case "playerHasTemporarySkill":
        return player?.location === "pitch" && player.skills.some(skill => skill.id === event.skillId && skill.until === event.until);
      case "playerStanding":
        return player?.location === "pitch" && player.stance === "standing";
      case "playerHasTackleZone":
        return !!player && getEngine().hasTackleZone(player);
      case "playerProne":
        return player?.location === "pitch" && player.stance === "prone";
      case "playerStunned":
        return player?.location === "pitch" && player.stance === "stunned";
      case "playerDown":
        return player?.location === "pitch" && (player.stance === "prone" || player.stance === "stunned");
      case "playerKO":
        return player?.location === "ko";
      case "playerCasualty":
        return player?.location === "cas";
      case "playerArmourBroken":
        return !!(outcome?.actionEvents || outcome?.run?.events)?.some(logEvent => logEvent.type === "roll" && logEvent.data?.playerId === event.playerId &&
          logEvent.data?.armour === true && logEvent.data?.broken === true);
      case "playerRemoved":
        return !!player && player.location !== "pitch";
      case "playerSentOff":
        return !!player && player.location === "sentOff";
      case "ballOnGround":
        return state.ball.kind === "ground";
      default:
        throw new Error("Unsupported terminal event type: " + event.type);
    }
  }

  function validateTerminalEvent(state, event) {
    if (!state || !Array.isArray(state.players) || !event || typeof event !== "object") {
      throw new TypeError("A complete GameState and terminal event are required.");
    }
    const playerEvents = new Set(["playerHasBall", "playerAtSquare", "playerStandingWithin", "playerOnPitch", "playerDistracted", "playerChomped", "playerHexedForNextTurn", "playerHasTemporarySkill", "playerStanding", "playerHasTackleZone", "playerProne", "playerStunned", "playerDown", "playerKO", "playerCasualty", "playerArmourBroken", "playerRemoved", "playerSentOff"]);
    const teamEvents = new Set(["teamHasBall", "teamTouchdown"]);
    let nodes = 0;
    function validateNode(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 8 || ++nodes > 32) {
        throw new Error("Terminal event expression must be an object with at most 32 nodes and depth 8.");
      }
      if (node.type === "allOf" || node.type === "anyOf") {
        if (!Array.isArray(node.events) || node.events.length < 1 || node.events.length > 8) {
          throw new Error(node.type + " requires 1 to 8 child events.");
        }
        node.events.forEach(child => validateNode(child, depth + 1));
        return;
      }
      if (node.type === "not") {
        validateNode(node.event, depth + 1);
        return;
      }
      if (playerEvents.has(node.type)) {
        if (typeof node.playerId !== "string" || !state.players.some(player => player.id === node.playerId)) {
          throw new Error("Terminal event requires a playerId present in the initial state.");
        }
        if (node.type === "playerHasTemporarySkill" &&
            (!getEngine().SKILL_BY_ID?.[node.skillId] || !["activation", "turn", "drive"].includes(node.until))) {
          throw new Error("playerHasTemporarySkill requires a known skillId and a supported temporary-skill duration.");
        }
        if (node.type === "playerChomped" && (typeof node.chompingPlayerId !== "string" || !state.players.some(player => player.id === node.chompingPlayerId))) {
          throw new Error("playerChomped requires a chompingPlayerId present in the initial state.");
        }
      } else if (teamEvents.has(node.type)) {
        if (node.team !== "A" && node.team !== "B") throw new Error("Terminal team event requires team 'A' or 'B'.");
      } else if (!["ballOnGround", "turnover", "noTurnover"].includes(node.type)) {
        throw new Error("Unsupported terminal event type: " + node.type);
      }
      if (node.type === "playerAtSquare") {
        const variant = state.variant === "sevens" ? "sevens" : "standard";
        const pitch = getEngine().RULESETS?.[variant]?.pitch;
        const { x, y } = node.square || {};
        if (!Number.isInteger(x) || !Number.isInteger(y) || !pitch || x < 0 || y < 0 || x >= pitch.w || y >= pitch.h) {
          throw new RangeError("playerAtSquare requires an on-pitch integer square.");
        }
        if (node.stance !== undefined && !["any", "standing", "prone", "stunned"].includes(node.stance)) {
          throw new Error("playerAtSquare stance must be any, standing, prone, or stunned.");
        }
      }
      if (node.type === "playerStandingWithin") {
        const variant = state.variant === "sevens" ? "sevens" : "standard";
        const pitch = getEngine().RULESETS?.[variant]?.pitch;
        const { x, y } = node.center || {};
        if (!pitch || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= pitch.w || y >= pitch.h) {
          throw new RangeError("playerStandingWithin requires an on-pitch integer center square.");
        }
        if (!Number.isInteger(node.radius) || node.radius < 0 || node.radius > 4) {
          throw new RangeError("playerStandingWithin radius must be an integer from 0 to 4.");
        }
      }
    }
    validateNode(event);
  }

  function terminalEventBranch(state, input, event, exploreOptions, useTeamRerolls) {
    let successMass = 0;
    let turnoverMass = 0;
    const exploration = getEngine().exploreOutcomes(
      cloneJson(state), cloneJson(input), { ...exploreOptions, useTeamRerolls },
      leaf => {
        if (eventMatches(leaf.state, event, leaf)) successMass += leaf.p;
        if (leaf.turnover) turnoverMass += leaf.p;
      }
    );
    const unresolved = exploration.unresolved;
    const unresolvedTurnover = exploration.unresolvedTurnover;
    return {
      legal: exploration.ok,
      errors: exploration.errors,
      explored: exploration.explored,
      leaves: exploration.leaves,
      unresolved,
      unresolvedTurnover,
      successProbability: exploration.ok ? {
        lowerBound: successMass,
        upperBound: Math.min(1, successMass + unresolved),
        exact: unresolved <= 1e-12
      } : null,
      turnoverProbability: exploration.ok ? {
        lowerBound: turnoverMass,
        upperBound: Math.min(1, turnoverMass + unresolvedTurnover),
        exact: unresolvedTurnover <= 1e-12
      } : null
    };
  }

  // Exact rules stay in Bloodboard. This visitor is for conditional task chains
  // that need each successor state after the declared player's activation ends.
  function exploreEndedPlayerAction(state, input, options, visit) {
    const engine = getEngine();
    const limit = options.maxExpandedStates ?? 2000;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20000) throw new RangeError("maxExpandedStates must be within 1..20000.");
    const engineOptions = Object.fromEntries(Object.entries(options).filter(([key]) =>
      ["threshold", "maxLeaves", "followUp", "useTeamRerolls"].includes(key)));
    const totals = { ok: true, errors: [], explored: 0, leaves: 0, unresolved: 0, unresolvedTurnover: 0 };
    let expanded = 0;
    const action = engine.exploreOutcomes(cloneJson(state), cloneJson(input), engineOptions, leaf => {
      if (leaf.turnover || leaf.touchdown) {
        visit(leaf);
        totals.leaves++;
        return;
      }
      if (++expanded > limit) { totals.unresolved += leaf.p; return; }
      const cleanup = engine.exploreOutcomes(cloneJson(leaf.state), { kind: "endActivation" }, engineOptions, final => {
        visit({ ...final, p: leaf.p * final.p, completed: leaf.completed === true && final.completed === true });
        totals.leaves++;
      });
      totals.explored += cleanup.explored;
      totals.unresolved += leaf.p * cleanup.unresolved;
      if (!cleanup.ok) { totals.ok = false; totals.errors.push(...cleanup.errors); }
    });
    totals.explored += action.explored;
    totals.unresolved = Math.min(1, totals.unresolved + action.unresolved);
    totals.unresolvedTurnover = totals.unresolved;
    totals.ok = totals.ok && action.ok;
    totals.errors = [...new Set([...totals.errors, ...action.errors])];
    return totals;
  }

  function evaluateTerminalEvent({ state, input, event, timepoint = "input-resolved", options = {} } = {}) {
    validateTerminalEvent(state, event);
    if (!["input-resolved", "activation-ended"].includes(timepoint)) {
      throw new Error("timepoint must be 'input-resolved' or 'activation-ended'.");
    }
    if (timepoint === "activation-ended") {
      if (input?.kind !== "playerAction") throw new Error("An activation-ended event requires a playerAction input.");
      const inputs = [cloneJson(input), { kind: "endActivation" }];
      const sequence = evaluateActionSequence({ state, inputs, event, options });
      const branch = policy => ({ ...sequence[policy],
        successProbability: sequence[policy].legal ? sequence[policy].taskSuccessProbability : null });
      return { engine: META, timepoint, event: cloneJson(event), inputs,
        withoutTeamRerolls: branch("withoutTeamRerolls"), withTeamRerolls: branch("withTeamRerolls") };
    }
    const allowed = new Set(["threshold", "maxLeaves", "followUp"]);
    const unsupported = Object.keys(options).filter(key => !allowed.has(key));
    if (unsupported.length) throw new Error("Unsupported terminal event exploration option(s): " + unsupported.join(", "));
    const exploreOptions = { ...options };
    return {
      engine: META,
      timepoint,
      event: cloneJson(event),
      withoutTeamRerolls: terminalEventBranch(state, input, event, exploreOptions, false),
      withTeamRerolls: terminalEventBranch(state, input, event, exploreOptions, true)
    };
  }

  function comparePlayerPatch({ state, input, playerId, patch, legalSkillIds, event, timepoint = "input-resolved", options = {} }) {
    const engine = getEngine();
    const beforeState = cloneJson(state);
    const player = beforeState.players.find(item => item.id === playerId);
    if (!player) throw new Error("Unknown player in scenario: " + playerId);
    const allowed = new Set(["ma", "st", "ag", "pa", "av", "skills"]);
    const fields = Object.keys(patch || {});
    const unsupported = fields.filter(field => !allowed.has(field));
    if (unsupported.length) throw new Error("Profile comparison only accepts rules profile fields: " + unsupported.join(", "));

    const afterState = cloneJson(beforeState);
    const changedPlayer = afterState.players.find(item => item.id === playerId);
    Object.assign(changedPlayer, cloneJson(patch));
    if (patch && Array.isArray(patch.skills)) {
      changedPlayer.skills = patch.skills.map(skill => typeof skill === "string" ? { id: skill } : skill);
      const unknown = changedPlayer.skills.map(skill => skill.id).filter(id => !engine.SKILL_BY_ID[id]);
      if (unknown.length) throw new Error("Unknown Bloodboard skill ID(s): " + [...new Set(unknown)].join(", "));
      const originalIds = new Set(player.skills.map(skill => typeof skill === "string" ? skill : skill.id));
      const addedIds = changedPlayer.skills.map(skill => skill.id).filter(id => !originalIds.has(id));
      if (addedIds.length && !Array.isArray(legalSkillIds)) {
        throw new Error("Pass the editor's legalSkillIds before simulating newly added skills.");
      }
      const legalIds = new Set(legalSkillIds || []);
      const illegal = addedIds.filter(id => !legalIds.has(id));
      if (illegal.length) throw new Error("Skill(s) are not legal for this player: " + [...new Set(illegal)].join(", "));
    }

    const before = planAction(beforeState, input, options);
    const after = planAction(afterState, input, options);
    const read = (result, branch, key) => result.plan[branch] && result.plan[branch][key];
    const fieldsToCompare = [
      "pCompleted", "pTurnover", "pTouchdownActive", "pTouchdownOpp",
      "pActorDown", "pActorRemoved", "pActorFell",
      "pTargetDown", "pTargetRemoved", "pTargetKO", "pTargetCas",
      "pTargetArmourBroken", "pTargetPushed", "pTargetCrowd", "pTarget2Down",
      "pActiveHasBall", "pOppHasBall", "pBallGround", "pBallWithActor",
      "pBallWithReceiver", "pIntercepted"
    ];
    const delta = {};
    ["withoutTeamRerolls", "withTeamRerolls"].forEach(branch => {
      delta[branch] = {};
      fieldsToCompare.forEach(key => {
        const a = read(before, branch, key);
        const b = read(after, branch, key);
        delta[branch][key] = Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
      });
    });
    const result = { engine: META, before, after, delta };
    if (event) {
      validateTerminalEvent(beforeState, event);
      const beforeTask = evaluateTerminalEvent({ state: beforeState, input, event, timepoint, options });
      const afterTask = evaluateTerminalEvent({ state: afterState, input, event, timepoint, options });
      const probabilityDelta = branch => {
        const beforeProbability = beforeTask[branch].successProbability;
        const afterProbability = afterTask[branch].successProbability;
        if (!beforeProbability || !afterProbability) return null;
        return {
          lowerBound: afterProbability.lowerBound - beforeProbability.upperBound,
          upperBound: afterProbability.upperBound - beforeProbability.lowerBound,
          exact: beforeProbability.exact && afterProbability.exact
        };
      };
      result.taskComparison = {
        timepoint,
        event: cloneJson(event),
        before: beforeTask,
        after: afterTask,
        delta: {
          withoutTeamRerolls: probabilityDelta("withoutTeamRerolls"),
          withTeamRerolls: probabilityDelta("withTeamRerolls")
        }
      };
    }
    return result;
  }

  function evaluateActionSequence({ state, inputs, event, options = {}, measureTeamTackleZonesFor = [], measureEvents = {} } = {}) {
    if (!state || !Array.isArray(inputs) || inputs.length < 1 || inputs.length > 8) {
      throw new TypeError("A GameState and a sequence of 1 to 8 action inputs or branch selectors are required.");
    }
    if (inputs.some(input => typeof input !== "function" && (!input || typeof input !== "object" || Array.isArray(input)))) {
      throw new TypeError("Each action-sequence step must be an ActionInput or a function selecting one from the current branch state.");
    }
    validateTerminalEvent(state, event);
    if (!measureEvents || typeof measureEvents !== "object" || Array.isArray(measureEvents) || Object.keys(measureEvents).length > 48) {
      throw new TypeError("measureEvents must be an object with at most 48 named terminal events.");
    }
    Object.values(measureEvents).forEach(value => validateTerminalEvent(state, value));
    if (!Array.isArray(measureTeamTackleZonesFor) || measureTeamTackleZonesFor.length > 2 ||
        measureTeamTackleZonesFor.some(team => team !== "A" && team !== "B") ||
        new Set(measureTeamTackleZonesFor).size !== measureTeamTackleZonesFor.length) {
      throw new TypeError("measureTeamTackleZonesFor must be a unique list containing only A and/or B.");
    }
    const measurementDimensions = measureTeamTackleZonesFor.length
      ? getPitchDimensions(state.variant === "sevens" ? "sevens" : "11s")
      : null;
    const initialTeamTackleZones = Object.fromEntries(measureTeamTackleZonesFor.map(team => [
      team,
      teamTackleZoneSquares(state, team, measurementDimensions).size
    ]));
    const allowed = new Set(["threshold", "maxLeaves", "followUp", "maxExpandedStates"]);
    const unsupported = Object.keys(options).filter(key => !allowed.has(key));
    if (unsupported.length) throw new Error("Unsupported action-sequence option(s): " + unsupported.join(", "));
    const maxExpandedStates = options.maxExpandedStates === undefined ? 2000 : options.maxExpandedStates;
    if (!Number.isInteger(maxExpandedStates) || maxExpandedStates < 1 || maxExpandedStates > 20000) {
      throw new RangeError("maxExpandedStates must be an integer in 1..20000.");
    }
    const engine = getEngine();
    const activeTeam = state.turn && state.turn.active;
    if (activeTeam !== "A" && activeTeam !== "B") throw new Error("The starting GameState must identify the active team.");
    const initialRerolls = Number(state.teams && state.teams[activeTeam] && state.teams[activeTeam].rerolls) || 0;
    const engineOptions = Object.fromEntries(Object.entries(options)
      .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));

    function evaluatePolicy(useTeamRerolls) {
      const totals = {
        taskSuccess: 0,
        turnover: 0,
        touchdown: 0,
        reachedFinalAction: 0,
        completedDeclaredSequence: 0,
        unresolved: 0,
        illegalPlan: 0,
        expandedStates: 0,
        errors: [],
        rerollMass: new Map(),
        successfulRerollMass: new Map(),
        leaderRerollMass: 0,
        branchChoices: new Map(),
        noActionMass: 0,
        eventMass: Object.fromEntries(Object.keys(measureEvents).map(key => [key, 0])),
        teamTackleZoneMass: Object.fromEntries(measureTeamTackleZonesFor.map(team => [team, {
          expected: 0,
          expectedChange: 0,
          probabilityCountFalls: 0,
          distribution: new Map()
        }]))
      };
      function finish(mass, leaf, completedDeclaredSequence = false) {
        const succeeded = eventMatches(leaf.state, event, leaf);
        if (succeeded) totals.taskSuccess += mass;
        for (const [key, measuredEvent] of Object.entries(measureEvents)) {
          if (eventMatches(leaf.state, measuredEvent, leaf)) totals.eventMass[key] += mass;
        }
        if (completedDeclaredSequence && !leaf.turnover) totals.completedDeclaredSequence += mass;
        if (leaf.turnover) totals.turnover += mass;
        if (leaf.touchdown) totals.touchdown += mass;
        const teamState = leaf.state.teams && leaf.state.teams[activeTeam];
        const remaining = Math.max(0, Number(teamState && teamState.rerolls) || 0);
        totals.rerollMass.set(remaining, (totals.rerollMass.get(remaining) || 0) + mass);
        if (succeeded) totals.successfulRerollMass.set(remaining, (totals.successfulRerollMass.get(remaining) || 0) + mass);
        if (teamState && teamState.leaderReroll) totals.leaderRerollMass += mass;
        for (const team of measureTeamTackleZonesFor) {
          const count = teamTackleZoneSquares(leaf.state, team, measurementDimensions).size;
          const result = totals.teamTackleZoneMass[team];
          result.expected += mass * count;
          result.expectedChange += mass * (count - initialTeamTackleZones[team]);
          if (count < initialTeamTackleZones[team]) result.probabilityCountFalls += mass;
          result.distribution.set(count, (result.distribution.get(count) || 0) + mass);
        }
      }
      function recordBranchChoice(index, decision, mass) {
        if (decision === undefined || decision === null) return;
        const normalized = cloneJson(decision);
        const key = index + ":" + JSON.stringify(normalized);
        const choice = totals.branchChoices.get(key) || { actionIndex: index + 1, decision: normalized, probabilityMass: 0 };
        choice.probabilityMass += mass;
        totals.branchChoices.set(key, choice);
      }
      function walk(branchState, index, mass, completedSoFar = true, actionEvents = []) {
        if (mass <= 1e-15) return;
        if (totals.expandedStates >= maxExpandedStates) {
          totals.unresolved += mass;
          return;
        }
        totals.expandedStates++;
        const selection = typeof inputs[index] === "function"
          ? inputs[index](cloneJson(branchState), { index, useTeamRerolls, branchProbability: mass })
          : { input: inputs[index] };
        const hasSelectedWrapper = selection !== null && selection !== undefined && Object.hasOwn(selection, "input");
        if (selection === null || selection === undefined || (hasSelectedWrapper && selection.input === null)) {
          recordBranchChoice(index, hasSelectedWrapper ? selection.decision : null, mass);
          totals.noActionMass += mass;
          finish(mass, { state: cloneJson(branchState), turnover: false, touchdown: null, actionEvents });
          return;
        }
        const input = hasSelectedWrapper ? selection.input : selection;
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          throw new TypeError("A branch selector must return an ActionInput, { input, decision }, or null when no action is selected.");
        }
        recordBranchChoice(index, hasSelectedWrapper ? selection.decision : null, mass);
        const leaves = [];
        const exploration = engine.exploreOutcomes(
          cloneJson(branchState), cloneJson(input),
          { ...engineOptions, useTeamRerolls },
          leaf => leaves.push({
            p: leaf.p,
            state: cloneJson(leaf.state),
            completed: leaf.completed,
            turnover: leaf.turnover,
            touchdown: leaf.touchdown,
            actionEvents: leaf.run?.events || []
          })
        );
        if (!exploration.ok) {
          totals.illegalPlan += mass;
          totals.unresolved += mass;
          totals.errors.push(...exploration.errors.map(error => "Action " + (index + 1) + ": " + error));
          return;
        }
        totals.unresolved += mass * exploration.unresolved;
        leaves.forEach(leaf => {
          const pathMass = mass * leaf.p;
          const actionEventHistory = [...actionEvents, ...leaf.actionEvents];
          const lastAction = index === inputs.length - 1;
          const completedHere = completedSoFar && leaf.completed === true;
          const onlyCleanupRemains = inputs.slice(index + 1).every(next => next?.kind === "endActivation");
          if (lastAction) totals.reachedFinalAction += pathMass;
          if (leaf.turnover || leaf.touchdown || lastAction) {
            finish(pathMass, { ...leaf, actionEvents: actionEventHistory }, completedHere && (lastAction || leaf.touchdown === activeTeam && onlyCleanupRemains));
          } else {
            walk(leaf.state, index + 1, pathMass, completedHere, actionEventHistory);
          }
        });
      }
      walk(cloneJson(state), 0, 1);
      const unresolved = Math.min(1, totals.unresolved);
      const branchExact = unresolved <= 1e-12;
      const teamTackleZoneFootprints = Object.fromEntries(measureTeamTackleZonesFor.map(team => {
        const stats = totals.teamTackleZoneMass[team];
        const initial = initialTeamTackleZones[team];
        const boardCells = measurementDimensions.width * measurementDimensions.height;
        const countDistribution = Object.fromEntries([...stats.distribution.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([count, probability]) => [String(count), {
            lowerBound: probability,
            upperBound: Math.min(1, probability + unresolved),
            exact: branchExact
          }]));
        return [team, {
          initialUniqueTackleZoneSquares: initial,
          expectedTerminalUniqueTackleZoneSquares: {
            value: branchExact ? stats.expected : null,
            lowerBound: stats.expected,
            upperBound: stats.expected + unresolved * boardCells,
            exact: branchExact,
            unresolved
          },
          expectedChangeFromInitial: {
            value: branchExact ? stats.expectedChange : null,
            lowerBound: stats.expectedChange - unresolved * initial,
            upperBound: stats.expectedChange + unresolved * (boardCells - initial),
            exact: branchExact,
            unresolved
          },
          probabilityUniqueCoverageFalls: {
            lowerBound: stats.probabilityCountFalls,
            upperBound: Math.min(1, stats.probabilityCountFalls + unresolved),
            exact: branchExact,
            unresolved
          },
          terminalCoverageDistribution: countDistribution
        }];
      }));
      return {
        legal: totals.illegalPlan <= 1e-12,
        eventProbabilities: Object.fromEntries(Object.entries(totals.eventMass).map(([key, mass]) => [key, {
          lowerBound: Math.min(1, mass), upperBound: Math.min(1, mass + unresolved), exact: branchExact
        }])),
        taskSuccessProbability: {
          lowerBound: Math.min(1, totals.taskSuccess),
          upperBound: Math.min(1, totals.taskSuccess + unresolved),
          exact: branchExact
        },
        completedDeclaredSequenceProbability: {
          lowerBound: Math.min(1, totals.completedDeclaredSequence),
          upperBound: Math.min(1, totals.completedDeclaredSequence + unresolved),
          exact: branchExact
        },
        turnoverProbability: {
          lowerBound: Math.min(1, totals.turnover),
          upperBound: Math.min(1, totals.turnover + unresolved),
          exact: branchExact
        },
        touchdownProbability: {
          lowerBound: Math.min(1, totals.touchdown),
          upperBound: Math.min(1, totals.touchdown + unresolved),
          exact: branchExact
        },
        reachedFinalActionProbability: {
          lowerBound: Math.min(1, totals.reachedFinalAction),
          upperBound: Math.min(1, totals.reachedFinalAction + unresolved),
          exact: branchExact
        },
        noActionProbability: totals.noActionMass,
        branchChoices: [...totals.branchChoices.values()],
        remainingTeamRerolls: Object.fromEntries([...totals.rerollMass].sort((a, b) => a[0] - b[0])),
        taskSuccessRemainingTeamRerolls: Object.fromEntries([...totals.successfulRerollMass].sort((a, b) => a[0] - b[0])),
        leaderRerollAvailableProbability: totals.leaderRerollMass,
        teamTackleZoneFootprints,
        unresolved,
        illegalPlanProbability: totals.illegalPlan,
        expandedStates: totals.expandedStates,
        errors: [...new Set(totals.errors)]
      };
    }

    const withoutTeamRerolls = evaluatePolicy(false);
    const withTeamRerolls = evaluatePolicy(true);
    return {
      engine: META,
      status: withoutTeamRerolls.legal && withTeamRerolls.legal
        ? inputs.some(input => typeof input === "function")
          ? "engine-enumerated-branch-adaptive-action-sequence"
          : "engine-enumerated-fixed-action-sequence"
        : inputs.some(input => typeof input === "function")
          ? "branch-adaptive-sequence-has-branch-specific-illegal-actions"
          : "fixed-sequence-has-branch-specific-illegal-actions",
      scenario: {
        actionCount: inputs.length,
        activeTeam,
        initialTeamRerolls: initialRerolls,
        measuredTeams: measureTeamTackleZonesFor,
        event: cloneJson(event),
        policy: "Each listed action is executed in order; a step may select its ActionInput from the exact preceding branch state. A Turnover or touchdown ends the sequence. Bloodboard carries the same reroll resource through every branch.",
        assumptions: [
          "Any caller-provided branch selector defines one declared policy; its choices are not a proof of optimal coaching or a full-turn search.",
          "Each action is revalidated by Bloodboard against that branch's resulting GameState.",
          "Unresolved enumeration mass, branches where a later declared action is illegal, and branches where the selector declines to act are reported separately."
        ]
      },
      withoutTeamRerolls,
      withTeamRerolls
    };
  }

  function calculateTeamTaskRemovalImpact({
    state, event, focalPlayerId, policies, reassignmentPolicies = [],
    reservePlayerIds = [], reservePolicies = {}, comparisonTiming = "during-drive",
    options = {}
  } = {}) {
    const engine = getEngine();
    if (!state || !Array.isArray(state.players) || state.phase !== "play" || state.pending || state.turn?.activation) {
      throw new TypeError("A playing GameState between activations, with no pending decision, is required.");
    }
    validateTerminalEvent(state, event);
    const team = state.turn.active;
    if (team !== "A" && team !== "B") throw new Error("The starting state must identify the active team.");
    const focal = state.players.find(player => player.id === focalPlayerId);
    if (!focal || focal.team !== team || focal.location !== "pitch" || !focal.pos) {
      throw new Error("The focal player must be on the active team's pitch.");
    }
    if (state.ball.kind === "held" && state.ball.playerId === focalPlayerId) {
      throw new Error("Removing the current ball carrier requires a declared ball-loss transition; this comparison does not invent one.");
    }
    if (!["during-drive", "next-drive-reference"].includes(comparisonTiming)) {
      throw new RangeError("comparisonTiming must be during-drive or next-drive-reference.");
    }
    if (!Array.isArray(reservePlayerIds) || reservePlayerIds.length > 4 || new Set(reservePlayerIds).size !== reservePlayerIds.length) {
      throw new RangeError("Declare at most four distinct existing reserve player ids.");
    }
    if (reservePlayerIds.length && comparisonTiming !== "next-drive-reference") {
      throw new Error("A reserve cannot enter during a Drive; reserve comparisons require next-drive-reference.");
    }
    const references = (value, id) => value === id || (value && typeof value === "object" && Object.values(value).some(child => references(child, id)));
    const remap = (value, from, to) => {
      if (value === from) return to;
      if (Array.isArray(value)) return value.map(child => remap(child, from, to));
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, remap(child, from, to)]));
      return value;
    };
    if ([focalPlayerId, ...reservePlayerIds].some(id => references(event, id))) {
      throw new Error("Use an unchanged team objective, not an event tied to a removed or substituted player id.");
    }
    function validatePolicies(items, label) {
      if (!Array.isArray(items) || items.length > 32) throw new RangeError(label + " must contain at most 32 declared policies.");
      const ids = new Set();
      return items.map(policy => {
        if (!policy || typeof policy.id !== "string" || !policy.id.trim() || policy.id === "no-action" || ids.has(policy.id)) {
          throw new Error(label + " needs distinct stable policy ids other than no-action.");
        }
        ids.add(policy.id);
        if (!Array.isArray(policy.inputs) || policy.inputs.length < 1 || policy.inputs.length > 8) {
          throw new RangeError("Every policy needs 1..8 declared ActionInputs.");
        }
        policy.inputs.forEach((input, index) => {
          if (input?.kind === "endActivation" && index > 0 && policy.inputs[index - 1]?.kind === "playerAction" && Object.keys(input).every(key => key === "kind")) return;
          if (!input || Array.isArray(input) || input.kind !== "playerAction" || typeof input.playerId !== "string" || !state.players.some(player => player.id === input.playerId && player.team === team)) {
            throw new Error("Every declared policy action must name an existing active-team player; plain endActivation may immediately follow a player action.");
          }
        });
        return { id: policy.id, inputs: cloneJson(policy.inputs) };
      });
    }
    const baselinePolicies = validatePolicies(policies, "policies");
    const reassigned = validatePolicies(reassignmentPolicies, "reassignmentPolicies");
    if (baselinePolicies.some(policy => reservePlayerIds.some(id => references(policy.inputs, id))) ||
        reassigned.some(policy => [focalPlayerId, ...reservePlayerIds].some(id => references(policy.inputs, id)))) {
      throw new Error("Baseline policies cannot activate reserves; reassignment policies cannot use the unavailable focal player or reserves.");
    }
    if (!reservePolicies || typeof reservePolicies !== "object" || Array.isArray(reservePolicies) || Object.keys(reservePolicies).some(id => !reservePlayerIds.includes(id))) {
      throw new Error("reservePolicies may only be keyed by the declared reserve ids.");
    }
    const pitchLimit = engine.RULESETS[state.variant === "sevens" ? "sevens" : "standard"].playersPerDrive;
    if (state.players.filter(player => player.team === team && player.location === "pitch").length > pitchLimit) {
      throw new Error("This comparison does not yet support lineups above the ruleset's standard pitch limit.");
    }
    if (state.variant === "sevens" && state.players.some(player => player.team === team && player.star)) {
      throw new Error("Sevens team task comparisons do not include Star Players.");
    }
    if (state.variant === "sevens" && state.players.filter(player => player.team === team && player.veteran).length > 1) {
      throw new Error("A Sevens roster may contain at most one Veteran.");
    }
    const readyReserves = new Set(engine.setupCandidates(state, team).filter(player => player.location === "reserves").map(player => player.id));
    reservePlayerIds.forEach(id => {
      const reserve = state.players.find(player => player.id === id);
      if (!reserve || !readyReserves.has(id) || reserve.pos || reserve.activated || reserve.stance !== "standing" || reserve.distracted) {
        throw new Error("Every substitute must already be an available, unactivated, standing reserve in the declared roster.");
      }
    });
    const issues = engine.validatePosition(cloneJson(state)).filter(issue => issue.level === "error");
    if (issues.length) throw new Error("Invalid starting position: " + issues.map(issue => issue.text).join("; "));
    const withoutState = cloneJson(state);
    const unavailable = withoutState.players.find(player => player.id === focalPlayerId);
    unavailable.location = "reserves";
    unavailable.pos = null;
    unavailable.distracted = false;
    function mergePolicies(first, extra) {
      const ids = new Set(first.map(policy => policy.id));
      if (extra.some(policy => ids.has(policy.id))) throw new Error("Additional reassignment policies need ids distinct from inherited policies.");
      return first.concat(extra);
    }
    let sharedPolicies = mergePolicies(baselinePolicies, reassigned);
    reservePlayerIds.forEach(id => {
      const extra = validatePolicies(reservePolicies[id] || [], "reservePolicies[" + id + "]");
      if (extra.some(policy => references(policy.inputs, focalPlayerId) || reservePlayerIds.some(other => other !== id && references(policy.inputs, other)))) {
        throw new Error("Substitute policies may not use the unavailable focal player or another reserve.");
      }
      sharedPolicies = mergePolicies(sharedPolicies, extra.map(policy => ({
        id: "reserve-plan:" + id + ":" + policy.id,
        inputs: remap(policy.inputs, id, focalPlayerId)
      })));
    });
    const remainingPolicies = sharedPolicies.filter(policy => !references(policy.inputs, focalPlayerId));
    const cases = [{ id: "without-player", state: withoutState, policies: remainingPolicies, reservePlayerId: null }];
    reservePlayerIds.forEach(id => {
      const substituted = cloneJson(withoutState);
      const reserve = substituted.players.find(player => player.id === id);
      reserve.location = "pitch";
      reserve.pos = cloneJson(focal.pos);
      const errors = engine.validatePosition(substituted).filter(issue => issue.level === "error");
      if (errors.length) throw new Error("Invalid substitute position: " + errors.map(issue => issue.text).join("; "));
      const inherited = sharedPolicies.map(policy => ({ id: policy.id, inputs: remap(policy.inputs, focalPlayerId, id) }));
      cases.push({ id: "reserve:" + id, state: substituted, policies: inherited, reservePlayerId: id });
    });
    if (sharedPolicies.length + cases.reduce((sum, item) => sum + item.policies.length, 0) > 256) {
      throw new RangeError("The whole comparison may enumerate at most 256 declared policies, excluding no-action fallbacks.");
    }
    function evaluatePortfolio(snapshot, candidates) {
      const runs = [{ id: "no-action", inputs: [], result: evaluateActionSequence({ state: snapshot, inputs: [() => null], event, options }) }]
        .concat(candidates.map(policy => ({ ...policy, result: evaluateActionSequence({ state: snapshot, inputs: policy.inputs, event, options }) })));
      const byRerollPolicy = Object.fromEntries(["withoutTeamRerolls", "withTeamRerolls"].map(branch => {
        const legal = runs.filter(run => run.result[branch].legal).sort((a, b) =>
          b.result[branch].taskSuccessProbability.lowerBound - a.result[branch].taskSuccessProbability.lowerBound ||
          a.result[branch].turnoverProbability.upperBound - b.result[branch].turnoverProbability.upperBound || a.id.localeCompare(b.id));
        const chosen = legal[0];
        const lowerBound = chosen.result[branch].taskSuccessProbability.lowerBound;
        const upperBound = Math.max(...legal.map(run => run.result[branch].taskSuccessProbability.upperBound));
        const exact = upperBound - lowerBound <= 1e-12;
        return [branch, {
          bestDeclaredTaskProbability: { value: exact ? lowerBound : null, lowerBound, upperBound, exact },
          selectedPolicyId: chosen.id,
          selectedPolicyProbability: chosen.result[branch].taskSuccessProbability,
          selectedPolicyTurnover: chosen.result[branch].turnoverProbability,
          selectedPolicyRemainingRerolls: chosen.result[branch].remainingTeamRerolls,
          selectionCertain: legal.every(run => run === chosen || lowerBound >= run.result[branch].taskSuccessProbability.upperBound - 1e-12),
          candidates: runs.map(run => ({ id: run.id, inputs: run.inputs, ...run.result[branch] }))
        }];
      }));
      return { byRerollPolicy };
    }
    const baseline = evaluatePortfolio(state, sharedPolicies);
    const difference = (before, after) => {
      const lowerBound = before.lowerBound - after.upperBound;
      const upperBound = before.upperBound - after.lowerBound;
      const exact = before.exact && after.exact;
      return { value: exact ? before.value - after.value : null, lowerBound, upperBound, exact };
    };
    const comparisons = cases.map(item => {
      const evaluated = evaluatePortfolio(item.state, item.policies);
      return {
        id: item.id, reservePlayerId: item.reservePlayerId,
        ...evaluated,
        lossByRerollPolicy: Object.fromEntries(Object.keys(baseline.byRerollPolicy).map(branch => [branch,
          difference(baseline.byRerollPolicy[branch].bestDeclaredTaskProbability, evaluated.byRerollPolicy[branch].bestDeclaredTaskProbability)]))
      };
    });
    return {
      engine: META, status: "engine-observed-team-task-removal-with-declared-role-reassignment",
      baseline, comparisons,
      scenario: {
        initialState: cloneJson(state), event: cloneJson(event), focalPlayerId, activeTeam: team,
        comparisonTiming, reservePlayerIds: reservePlayerIds.slice(), policies: baselinePolicies,
        reassignmentPolicies: reassigned, reservePolicies: cloneJson(reservePolicies),
        selection: "Each case independently chooses the greatest task-success lower bound among its legal declared sequences; portfolio upper bounds take the maximum across all legal candidates. Alternatives are evaluated separately, never added or granted extra rerolls.",
        policyMatching: "Reassignment and substitute-specific plans are also offered to the baseline (the substitute's slot is mapped back to the focal player). Every lineup validates the same slot-policy portfolio and discards its own illegal candidates. Additional tactics are not privileged to the changed lineup.",
        engineDecisionPolicy: "Bloodboard's configured outcome policy still governs block-face choices, follow-up and reroll spending within each action. Choosing a sequence does not optimize every internal decision for the requested event.",
        reservePolicy: "Existing available reserves may occupy the focal player's original slot only in a next-Drive reference lineup. This does not simulate a substitution during a Drive or a kickoff, and does not certify recruitment budgets or positional roster caps.",
        limitation: "The finite declared sequence portfolio is not an exhaustive turn search. No ball-loss transition, future injury recovery, arbitrary replacement hire, or cross-task rating is invented. The same ball, opponents, teammates, turn state and resources are retained except for the named lineup change."
      }
    };
  }

  function createTeamGroundBallReference({ players, format = "11s", teamName = "Declared task team",
    teamRosterId = null, pressure = "open", teamRerolls = 1, includeLeaderReroll = true } = {}) {
    const engine = getEngine();
    const pitch = getPitchDimensions(format);
    if (!Array.isArray(players) || !players.length || players.length > 16) throw new RangeError("Declare an existing roster of 1..16 players.");
    if (!["open", "marked"].includes(pressure)) throw new Error("pressure must be open or marked.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0 || teamRerolls > 8 || typeof includeLeaderReroll !== "boolean") {
      throw new RangeError("Declare 0..8 team rerolls and an explicit Leader availability flag.");
    }
    const ids = players.map(player => player?.id);
    if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) throw new Error("Roster player ids must be unique stable strings.");
    if (players.some(player => player.star || player.specialRules || player.specialEffectCodes?.length)) {
      throw new Error("This roster-reference builder accepts ordinary players; Star Player rule states need an explicit GameState.");
    }
    const roster = teamRosterId ? engine.ROSTER_BY_ID?.[teamRosterId] : null;
    if (teamRosterId && !roster) throw new Error("Unknown Bloodboard roster id: " + teamRosterId);
    const state = engine.newGame({ a: { name: teamName, roster: teamRosterId || undefined }, b: { name: "Declared single-marker pressure" }, seed: 1 });
    if (format === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    state.teams.A.specialRules = (roster?.specialRules || []).slice();
    players.forEach(source => {
      const skills = (source.skills || []).slice();
      if (source.boughtSkill) {
        const bought = typeof source.boughtSkill === "string" ? { id: source.boughtSkill } : source.boughtSkill;
        if (!skills.some(skill => (typeof skill === "string" ? skill : skill.id) === bought.id)) skills.push(bought);
      }
      const actor = customScenarioPlayer(engine, state, "A", profileForEngine(engine, { ...source, skills }), null);
      actor.id = source.id;
      actor.number = source.number || state.players.length + 1;
      if (source.captain) actor.captain = true;
      state.players.push(actor);
    });
    const formation = engine.defaultFormation(state, "A");
    state.players.forEach(player => {
      player.pos = formation[player.id] || null;
      player.location = player.pos ? "pitch" : "reserves";
    });
    const setupErrors = engine.validateDriveSetup(state, "A").filter(issue => issue.level === "error");
    if (setupErrors.length) throw new Error("Reference formation is not a legal defensive setup: " + setupErrors.map(issue => issue.text).join("; "));
    const ballAt = format === "sevens" ? { x: 3, y: 4 } : { x: 8, y: 7 };
    if (state.players.some(player => player.pos?.x === ballAt.x && player.pos?.y === ballAt.y)) {
      throw new Error("The reference ground-ball square is occupied in this formation.");
    }
    let markerAt = null;
    if (pressure === "marked") {
      const offsets = [[1, 1], [1, 0], [0, 1], [-1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1]];
      markerAt = offsets.map(([dx, dy]) => ({ x: ballAt.x + dx, y: ballAt.y + dy })).find(at =>
        at.x >= 0 && at.x < pitch.width && at.y >= 0 && at.y < pitch.height && !state.players.some(player => player.pos?.x === at.x && player.pos?.y === at.y));
      if (!markerAt) throw new Error("The reference ball has no free adjacent square for the opposing marker.");
      state.players.push(customScenarioPlayer(engine, state, "B", profileForEngine(engine, {
        name: "Reference marker", position: "Reference marker", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: []
      }), markerAt));
    }
    state.ball = { kind: "ground", pos: ballAt };
    state.teams.A.leaderReroll = includeLeaderReroll && state.players.some(player => player.team === "A" && player.location === "pitch" && player.skills.some(skill => skill.id === "leader"));
    const playing = engine.startPlay(state);
    return {
      state: playing,
      scenario: {
        id: "full-declared-roster-ground-ball-reference", format, teamName, teamRosterId, pressure, ballAt, markerAt,
        formation: playing.players.filter(player => player.team === "A").map(player => ({ playerId: player.id, number: player.number, name: player.name, location: player.location, at: player.pos, skills: player.skills, veteran: player.veteran || null })),
        deploymentPolicy: "Bloodboard defaultFormation, stable shirt-number order; validateDriveSetup checks Team A's deployment. This is a fixed reference formation, not a task-optimized selection of starters.",
        resources: { teamRerolls, includeLeaderReroll, leaderRerollInitiallyAvailable: state.teams.A.leaderReroll, veteranState: "preserve declared Sevens Veteran and already-adjusted MA" },
        event: { type: "allOf", events: [{ type: "teamHasBall", team: "A" }, { type: "noTurnover" }] },
        limitation: "The full declared own roster is preserved, but opposing pressure is only the declared marker. The ball state is a hypothetical in-Drive task, not a simulated kickoff. Deployment validation does not certify recruitment budget or positional caps; no touchdown, holding under attack or later action is included."
      }
    };
  }

  function prepareTeamGroundBallComparison({ reference, focalPlayerId, reservePlayerId = null } = {}) {
    const engine = getEngine();
    if (!reference?.state || reference.state.ball.kind !== "ground" || !reference.scenario?.event) {
      throw new TypeError("A declared ground-ball reference state and unchanged success event are required.");
    }
    const state = cloneJson(reference.state);
    const focal = state.players.find(player => player.id === focalPlayerId && player.team === "A" && player.location === "pitch");
    if (!focal) throw new Error("Choose a fielded focal player in the reference formation.");
    const ballAt = state.ball.pos;
    function policiesFor(snapshot, prefix) {
      return snapshot.players.filter(player => player.team === "A" && player.location === "pitch" && !player.skills.some(skill => skill.id === "noBall"))
        .flatMap(player => {
          const route = engine.safestRoute(cloneJson(snapshot), player.id, ballAt);
          if (!route?.path?.length) return [];
          return ["move", "secure"].map(action => ({ id: prefix + player.id + ":" + action,
            inputs: [{ kind: "playerAction", playerId: player.id, action, path: cloneJson(route.path) }, { kind: "endActivation" }] }));
        });
    }
    const policies = policiesFor(state, "original:");
    const knownInputs = new Set(policies.map(policy => JSON.stringify(policy.inputs)));
    const without = cloneJson(state);
    const removed = without.players.find(player => player.id === focalPlayerId);
    removed.location = "reserves";
    removed.pos = null;
    removed.distracted = false;
    const reassignmentPolicies = policiesFor(without, "reassign:").filter(policy => {
      const key = JSON.stringify(policy.inputs);
      if (knownInputs.has(key)) return false;
      knownInputs.add(key);
      return true;
    });
    const reservePolicies = {};
    if (reservePlayerId) {
      const swapped = cloneJson(without);
      const reserve = swapped.players.find(player => player.id === reservePlayerId && player.team === "A" && player.location === "reserves" && player.id !== focalPlayerId);
      if (!reserve) throw new Error("Choose an existing reserve distinct from the focal player.");
      reserve.location = "pitch";
      reserve.pos = cloneJson(focal.pos);
      reservePolicies[reservePlayerId] = policiesFor(swapped, "substitute:").filter(policy => {
        const remapped = policy.inputs.map(input => ({ ...input, playerId: input.playerId === reservePlayerId ? focalPlayerId : input.playerId }));
        const key = JSON.stringify(remapped);
        if (knownInputs.has(key)) return false;
        knownInputs.add(key);
        return true;
      });
    }
    return {
      state, event: cloneJson(reference.scenario.event), focalPlayerId, policies, reassignmentPolicies,
      reservePlayerIds: reservePlayerId ? [reservePlayerId] : [], reservePolicies,
      comparisonTiming: reservePlayerId ? "next-drive-reference" : "during-drive"
    };
  }

  function recommendPlayerRoleTask(player) {
    const ids = (player?.skills || []).map(skill => typeof skill === "string" ? skill : skill.id);
    if (ids.includes("ballAndChain")) return "ballAndChain";
    if (ids.includes("chainsaw")) return "chainsaw";
    if (ids.includes("dirtyPlayer") && player.st <= 3) return "foul";
    if (player.st >= 4 || ids.some(id => ["block", "brawler", "reallyStupid", "takeRoot"].includes(id))) return "block";
    if (ids.includes("noBall")) return "move";
    if (ids.includes("sureHands")) return "pickup";
    if (ids.includes("pass")) return "pass";
    return "move";
  }

  function preparePlayerRoleTask({ player, taskId = "block", format = "11s", teamRerolls = 1,
    distance = 4, support = "none", starId = null } = {}) {
    const engine = getEngine();
    const pitch = getPitchDimensions(format);
    const roles = { block: "anchor", blitz: "blitzer", move: "support", pickup: "carrier", pass: "thrower", handoff: "carrier", foul: "killer",
      ballAndChain: "killer", chainsaw: "killer", bombardier: "killer", stab: "killer", projectileVomit: "killer", breatheFire: "killer", monstrousMouth: "anchor", hypnoticGaze: "anchor", kickTeamMate: "thrower", punt: "thrower" };
    if (!roles[taskId]) throw new Error("Choose a declared movement, ball, block, foul or supported weapon role task.");
    if (!["none", "lineman", "thrall"].includes(support)) throw new Error("support must be none, lineman or thrall.");
    if (![0, 1].includes(teamRerolls)) throw new RangeError("This benchmark declares 0 or 1 shared team reroll.");
    if (!Number.isInteger(distance) || distance < 1 || distance > Math.min(12, pitch.width - 7)) throw new RangeError("Declare a route distance of 1..12 inside the selected pitch.");
    if (starId && (format !== "11s" || !engine.STAR_BY_ID?.[starId])) throw new Error("Declare a known Star Player in the eleven-player ruleset.");
    const state = engine.newGame({ a: { name: "Declared role-task team" }, b: { name: "Declared role-task opponent" }, seed: 1 });
    if (format === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    state.teams.A.leaderReroll = false;
    const origin = taskId === "kickTeamMate" ? { x: pitch.width - 5, y: Math.floor(pitch.height / 2) }
      : { x: 5, y: Math.floor(pitch.height / 2) };
    const skills = (player?.skills || []).slice();
    if (player?.boughtSkill) {
      const bought = typeof player.boughtSkill === "string" ? { id: player.boughtSkill } : player.boughtSkill;
      if (!skills.some(skill => (typeof skill === "string" ? skill : skill.id) === bought.id)) skills.push(bought);
    }
    if (starId) {
      const printed = engine.STAR_BY_ID[starId];
      const skillSignature = values => JSON.stringify(values.map(skill => typeof skill === "string" ? { id: skill } : skill)
        .map(skill => [skill.id, skill.value ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      if (!engine.starSupported(starId) || ["ma", "st", "ag", "pa", "av"].some(stat => player?.[stat] !== printed[stat]) ||
          skillSignature(skills) !== skillSignature(printed.skills) ||
          JSON.stringify([...(player?.keywords || [])].sort()) !== JSON.stringify([...printed.keywords].sort()) ||
          player?.boughtSkill || player?.veteran) {
        throw new Error("A Star task requires the supported, unedited printed Star Player profile; do not attach a Star rule to a custom player.");
      }
    }
    const actor = customScenarioPlayer(engine, state, "A", profileForEngine(engine, { ...player, skills }), origin);
    actor.id = "role-actor";
    actor.number = 1;
    if (starId) actor.star = starId;
    state.players.push(actor);
    const standard = { name: "Reference player", position: "Reference player", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [], keywords: ["Human", "Lineman"] };
    if (support !== "none") {
      const helper = customScenarioPlayer(engine, state, "A", profileForEngine(engine, { ...standard,
        name: support === "thrall" ? "Declared Thrall helper" : "Declared standing helper",
        keywords: support === "thrall" ? ["Human", "Thrall", "Lineman"] : standard.keywords }), { x: 4, y: origin.y });
      helper.id = "role-helper";
      helper.number = 2;
      state.players.push(helper);
    }
    const pairId = starId && engine.STAR_BY_ID[starId].pair;
    if (pairId) {
      const partner = customScenarioPlayer(engine, state, "A", profileForEngine(engine, engine.STAR_BY_ID[pairId]), { x: 3, y: origin.y + 2 });
      partner.id = "role-star-partner";
      partner.star = pairId;
      state.players.push(partner);
    }
    const special = ["ballAndChain", "chainsaw", "bombardier", "stab", "projectileVomit", "breatheFire", "monstrousMouth", "hypnoticGaze", "kickTeamMate", "punt"].includes(taskId);
    if (special && !actor.skills.some(skill => skill.id === taskId)) throw new Error("The declared weapon task requires its corresponding skill.");
    const action = { kind: "playerAction", playerId: actor.id, action: special ? "special" : taskId === "pickup" ? "move" : taskId, path: [] };
    if (special) action.special = taskId;
    let event;
    state.ball = { kind: "ground", pos: { x: 1, y: 1 } };
    if (taskId === "punt") {
      state.ball = { kind: "held", playerId: actor.id };
      action.path = [{ to: { x: origin.x + 1, y: origin.y }, kind: "step" }];
      action.special = "punt";
      action.facing = "x+";
      const receivingLane = { x: origin.x + 5, y: origin.y };
      const receiver = customScenarioPlayer(engine, state, "A", profileForEngine(engine, { ...standard,
        name: "Declared punt-lane receiver", position: "Reference Catcher", ag: 3, skills: [] }), receivingLane);
      receiver.id = "role-punt-receiver";
      receiver.number = 2;
      state.players.push(receiver);
      const defender = customScenarioPlayer(engine, state, "B", profileForEngine(engine, standard),
        { x: receivingLane.x + 1, y: receivingLane.y + 1 });
      defender.id = "role-punt-defender";
      defender.number = 1;
      state.players.push(defender);
      event = { type: "allOf", events: [
        { type: "anyOf", events: [{ type: "teamHasBall", team: "A" }, { type: "teamTouchdown", team: "A" }] },
        { type: "noTurnover" }
      ] };
    } else if (taskId === "kickTeamMate") {
      const receiver = customScenarioPlayer(engine, state, "A", profileForEngine(engine, { ...standard,
        name: "Declared Right Stuff scorer", position: "Right Stuff teammate", ag: 3, pa: 4,
        skills: [{ id: "rightStuff" }] }), { x: origin.x + 1, y: origin.y });
      receiver.id = "role-kicked-teammate";
      receiver.number = 3;
      state.players.push(receiver);
      state.ball = { kind: "held", playerId: receiver.id };
      action.action = "special";
      action.special = "kickTeamMate";
      action.thrownPlayerId = receiver.id;
      action.throwTarget = { x: pitch.width - 1, y: origin.y };
      event = { type: "teamTouchdown", team: "A" };
    } else if (taskId === "block" || taskId === "blitz" || taskId === "foul" || special) {
      if (taskId === "blitz") {
        action.path = Array.from({ length: distance }, (_, index) => ({ to: { x: origin.x + index + 1, y: origin.y }, kind: "step" }));
      }
      const target = customScenarioPlayer(engine, state, "B", profileForEngine(engine, standard), { x: origin.x + (taskId === "blitz" ? distance + 1 : 1), y: origin.y });
      target.id = "role-target";
      if (taskId === "foul") target.stance = "prone";
      state.players.push(target);
      if (taskId === "ballAndChain") action.facing = "x+";
      else if (taskId === "bombardier") {
        action.bombTarget = { x: origin.x + 4, y: origin.y };
        target.pos = cloneJson(action.bombTarget);
        target.name = "Declared bomb landing target";
        target.position = "Target square occupant";
        const collateral = customScenarioPlayer(engine, state, "B", profileForEngine(engine, standard),
          { x: action.bombTarget.x - 1, y: action.bombTarget.y + 1 });
        collateral.id = "role-collateral";
        collateral.name = "Declared blast-radius target";
        collateral.position = "Adjacent blast target";
        state.players.push(collateral);
      } else if (["chainsaw", "stab", "projectileVomit", "breatheFire", "monstrousMouth", "hypnoticGaze"].includes(taskId)) action.specialTarget = target.id;
      else action[["block", "blitz"].includes(taskId) ? "blockTarget" : "foulTarget"] = target.id;
      if (taskId === "blitz") action.blitzTarget = target.id;
      event = taskId === "foul" ? { type: "playerRemoved", playerId: target.id }
        : taskId === "hypnoticGaze" ? { type: "playerDistracted", playerId: target.id }
          : { type: "anyOf", events: [{ type: "playerDown", playerId: target.id }, { type: "playerRemoved", playerId: target.id }] };
    } else if (taskId === "move" || taskId === "pickup") {
      const steps = taskId === "pickup" ? 1 : distance;
      action.path = Array.from({ length: steps }, (_, index) => ({ to: { x: origin.x + index + 1, y: origin.y }, kind: "step" }));
      if (taskId === "pickup") {
        state.ball = { kind: "ground", pos: cloneJson(action.path[0].to) };
        event = { type: "playerHasBall", playerId: actor.id };
      } else {
        event = { type: "playerAtSquare", playerId: actor.id, square: cloneJson(action.path.at(-1).to), stance: "standing" };
      }
    } else {
      if (actor.skills.some(skill => skill.id === "noBall")) throw new Error("No Ball: this player cannot begin a held-ball transfer task.");
      const receiver = customScenarioPlayer(engine, state, "A", profileForEngine(engine, standard), { x: taskId === "handoff" ? 6 : 8, y: origin.y });
      receiver.id = "role-receiver";
      receiver.number = 3;
      state.players.push(receiver);
      state.ball = { kind: "held", playerId: actor.id };
      if (taskId === "handoff") action.handoffTarget = receiver.id;
      else action.passTarget = cloneJson(receiver.pos);
      event = { type: "playerHasBall", playerId: receiver.id };
    }
    const playing = engine.startPlay(state);
    const inputs = [action, { kind: "endActivation" }];
    const safeEvent = { type: "allOf", events: [event, { type: "noTurnover" }] };
    const errors = engine.validateInput(playing, action);
    if (errors.length) throw new Error("Declared role task is illegal: " + errors.join("; "));
    return { state: cloneJson(playing), inputs, event: ["kickTeamMate", "punt"].includes(taskId) ? event : safeEvent, roleId: roles[taskId], focalPlayerIds: [actor.id],
      reference: { taskId, format, origin, distance: taskId === "move" ? distance : null, support,
        starId, pairId: pairId || null, teamRerolls, includeLeaderReroll: false,
        timepoint: taskId === "punt" ? "After the Punt action and explicit activation cleanup, or an earlier Touchdown/Turnover; landing, Catch, bounce and throw-in are resolved." : "After the declared action and explicit endActivation, or an earlier Turnover/touchdown.",
        policy: "Bloodboard chooses internal dice and rerolls; Block follow-up is disabled. No start-of-activation Star Rule is requested. A stationary helper is at (4, center row), not a granted probability bonus.",
        limitation: "One declared reference role task, not a lineup, recruitment value, optimal-turn search, or a Reliability grade. The helper is not guaranteed reachable for Bloodlust after movement. Paired stars retain their declared partner but no invented adjacency.",
        ...(taskId === "punt" ? { facing: "x+", receivingLane: { teammate: { x: origin.x + 5, y: origin.y }, opponentMarker: { x: origin.x + 6, y: origin.y + 1 } },
          successDefinition: "After a one-square Move with the ball and a forward Punt, Team A has possession (or scores) and avoids Turnover. Teammate reception, opposing possession, safe loose ball, both teams' Touchdowns, and Turnover are separately observed; distance alone is not success." } : {}) }
    };
  }

  function prepareTeamCarrierThreat({ reference, carrierPlayerId, attackerStrength = 3,
    threat = "normal", attackerRerolls = 1 } = {}) {
    const engine = getEngine();
    if (!reference?.state || !reference.scenario) throw new TypeError("A declared roster reference is required.");
    if (![3, 4, 5, 6].includes(attackerStrength)) throw new RangeError("Declare an attacker ST of 3, 4, 5 or 6.");
    if (!["normal", "stripBall", "tackle"].includes(threat)) throw new Error("Unknown carrier threat.");
    if (!Number.isInteger(attackerRerolls) || attackerRerolls < 0 || attackerRerolls > 8) throw new RangeError("Declare 0..8 attacking team rerolls.");
    const state = cloneJson(reference.state);
    state.players = state.players.filter(player => player.team === "A");
    const carrier = state.players.find(player => player.id === carrierPlayerId && player.location === "pitch");
    if (!carrier?.pos || carrier.stance !== "standing" || carrier.skills.some(skill => skill.id === "noBall")) {
      throw new Error("The carrier must be a standing on-pitch player allowed to hold the ball.");
    }
    const pitch = getPitchDimensions(reference.scenario.format);
    const offsets = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const attackerAt = offsets.map(([dx, dy]) => ({ x: carrier.pos.x + dx, y: carrier.pos.y + dy })).find(at =>
      at.x >= 0 && at.x < pitch.width && at.y >= 0 && at.y < pitch.height && !state.players.some(player => player.pos?.x === at.x && player.pos?.y === at.y));
    if (!attackerAt) throw new Error("The reference carrier has no empty adjacent attacker square; declare another board.");
    const attacker = customScenarioPlayer(engine, state, "B", profileForEngine(engine, {
      name: "Reference carrier attacker", position: "Reference blocker", ma: 6, st: attackerStrength, ag: 3, pa: 4, av: 9,
      skills: ["block"].concat(threat === "normal" ? [] : [threat])
    }), attackerAt);
    state.players.push(attacker);
    state.ball = { kind: "held", playerId: carrier.id };
    state.turn.active = "B";
    state.teams.B.rerolls = attackerRerolls;
    state.teams.B.leaderReroll = false;
    const input = { kind: "playerAction", playerId: attacker.id, action: "block", path: [], blockTarget: carrier.id };
    const errors = engine.validatePosition(state).filter(issue => issue.level === "error");
    if (errors.length) throw new Error("Invalid carrier threat board: " + errors.map(issue => issue.text).join("; "));
    return { state, input, carrierPlayerId, reference: {
      ...cloneJson(reference.scenario), id: "full-roster-carrier-block-threat", ballAt: cloneJson(carrier.pos), pressure: threat,
      event: { carrierRetention: { type: "playerHasBall", playerId: carrier.id },
        teamRetention: { type: "teamHasBall", team: carrier.team } },
      carrierPlayerId, attackerAt, attackerStrength, attackerRerolls, threatSkills: attacker.skills,
      successTimepoint: "After one declared opposing Block and all push, armour/injury, scatter/bounce/catch and carrier reactions. No later recovery action is included.",
      limitation: "The attacker starts in the first free adjacent reference square, with no approach movement or opposing support. All real teammates remain and Bloodboard decides legal defensive assists. This is one declared threat under the engine's dice/reaction policy, not an optimized cage, whole opponent turn, match frequency or ball-axis rating."
    } };
  }

  function calculateCarrierThreat({ state, input, carrierPlayerId, options = {} } = {}) {
    const engine = getEngine();
    if (!state || state.phase !== "play" || state.pending || state.turn?.activation || state.ball?.kind !== "held" || state.ball.playerId !== carrierPlayerId) {
      throw new TypeError("A playing state between activations, initially held by the named carrier, is required.");
    }
    const carrier = state.players.find(player => player.id === carrierPlayerId);
    const attacker = state.players.find(player => player.id === input?.playerId);
    if (!carrier?.pos || carrier.location !== "pitch" || carrier.stance !== "standing" || carrier.skills.some(skill => skill.id === "noBall") ||
        !attacker || attacker.team === carrier.team || attacker.team !== state.turn.active || input?.kind !== "playerAction" ||
        !["block", "blitz"].includes(input.action) || (input.blockTarget || input.blitzTarget) !== carrierPlayerId) {
      throw new Error("Declare a legal opposing Block/Blitz against the standing ball carrier.");
    }
    const unsupported = Object.keys(options).filter(key => !["threshold", "maxLeaves", "followUp"].includes(key));
    if (unsupported.length) throw new Error("Unsupported carrier exploration option(s): " + unsupported.join(", "));
    const positionErrors = engine.validatePosition(state).filter(issue => issue.level === "error");
    if (positionErrors.length) throw new Error("Invalid carrier board: " + positionErrors.map(issue => issue.text).join("; "));
    const policies = {};
    for (const [key, useTeamRerolls] of [["withoutTeamRerolls", false], ["withTeamRerolls", true]]) {
      const possession = { carrier: 0, teammate: 0, opponent: 0, ground: 0, other: 0 };
      const condition = { standing: 0, prone: 0, stunned: 0, removed: 0 };
      let turnover = 0, standingWithBall = 0;
      const exploration = engine.exploreOutcomes(cloneJson(state), cloneJson(input), { followUp: false, ...options, useTeamRerolls }, leaf => {
        const target = leaf.state.players.find(player => player.id === carrierPlayerId);
        const ball = leaf.state.ball;
        const holder = ball.kind === "held" ? leaf.state.players.find(player => player.id === ball.playerId) : null;
        const category = holder?.id === carrierPlayerId ? "carrier" : holder?.team === carrier.team ? "teammate" : holder ? "opponent" : ball.kind === "ground" ? "ground" : "other";
        possession[category] += leaf.p;
        const stateCategory = target?.location !== "pitch" ? "removed" : target.stance === "standing" ? "standing" : target.stance === "prone" ? "prone" : "stunned";
        condition[stateCategory] += leaf.p;
        if (category === "carrier" && stateCategory === "standing") standingWithBall += leaf.p;
        if (leaf.turnover) turnover += leaf.p;
      });
      if (!exploration.ok) throw new Error("Bloodboard rejected the carrier threat: " + exploration.errors.join("; "));
      const bounded = mass => ({ lowerBound: Math.min(1, mass), upperBound: Math.min(1, mass + exploration.unresolved), exact: exploration.unresolved <= 1e-12 });
      policies[key] = {
        possession: Object.fromEntries(Object.entries(possession).map(([id, mass]) => [id, bounded(mass)])),
        teamRetention: bounded(possession.carrier + possession.teammate), standingWithBall: bounded(standingWithBall),
        carrierCondition: Object.fromEntries(Object.entries(condition).map(([id, mass]) => [id, bounded(mass)])),
        attackingTeamTurnover: { lowerBound: turnover, upperBound: Math.min(1, turnover + exploration.unresolvedTurnover), exact: exploration.unresolvedTurnover <= 1e-12 },
        explored: exploration.explored, leaves: exploration.leaves, unresolved: exploration.unresolved,
        possessionResolvedMass: Object.values(possession).reduce((sum, mass) => sum + mass, 0),
        carrierStateResolvedMass: Object.values(condition).reduce((sum, mass) => sum + mass, 0)
      };
    }
    return {
      engine: META, status: "engine-enumerated-one-carrier-threat-with-full-declared-board", policies,
      replay: { state: cloneJson(state), input: cloneJson(input), carrierPlayerId, options: cloneJson(options) },
      scenario: {
        format: state.variant === "sevens" ? "sevens" : "11s", carrierPlayerId, carrierTeam: carrier.team, attackingTeam: attacker.team,
        attackingTeamRerolls: state.teams[attacker.team].rerolls, defendingTeamRerolls: state.teams[carrier.team].rerolls,
        timepoint: "After the declared opposing action and complete push, damage, ball and supported reaction resolution.",
        policy: "Bloodboard chooses Block results and supported reactions; probabilities are not optimized separately for each terminal event. No later recovery is simulated."
      }
    };
  }

  function calculateStraightRoute(options = {}, markerProfile = null) {
    const {
      player,
      format = "11s",
      distance,
      scoreRun = false,
      startX,
      row,
      screen = null,
      supportPlayers = [],
      routePolicy = "fixed",
      teamRerolls = 1,
      seed = 1,
      planOptions = {},
      starId: declaredStarId = null,
      starTargetIndex = null,
      useStartRule = false,
      measureTeamTackleZoneCoverage = false
    } = options;
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be '11s' or 'sevens'.");
    const starId = declaredStarId || engine.resolveStarId?.(player) || null;
    if (typeof scoreRun !== "boolean") throw new TypeError("scoreRun must be a boolean.");
    if (typeof useStartRule !== "boolean" || typeof measureTeamTackleZoneCoverage !== "boolean") {
      throw new TypeError("useStartRule and measureTeamTackleZoneCoverage must be booleans.");
    }
    if (starId !== null && (!engine.STAR_BY_ID?.[starId] || !engine.starSupported?.(starId))) {
      throw new Error("The requested Star Player rule is unknown or unsupported by the loaded Bloodboard engine: " + starId);
    }
    if (starId && format === "sevens") throw new Error("Star Players cannot be placed in the Sevens reference task.");
    if (useStartRule && !starId) throw new Error("An explicitly requested Star Player rule requires a canonical Star Player identity.");
    const starTargetRange = DYNAMIC_CONTROL_STAR_TARGET_RANGES[starId];
    if (useStartRule && starTargetRange !== undefined && !Number.isInteger(starTargetIndex)) {
      throw new TypeError("This targeted Star Player rule requires an explicit starTargetIndex into the declared screen.");
    }
    if (starTargetIndex !== null && (!Number.isInteger(starTargetIndex) || starTargetIndex < 0)) {
      throw new TypeError("starTargetIndex must be null or a non-negative integer selecting a declared screen player.");
    }
    if (measureTeamTackleZoneCoverage && scoreRun) {
      throw new Error("Control-footprint observations require a non-scoring movement task.");
    }
    if (routePolicy !== "fixed" && routePolicy !== "bloodboard-candidate") {
      throw new RangeError("routePolicy must be 'fixed' or 'bloodboard-candidate'.");
    }
    if (routePolicy === "bloodboard-candidate" && screen === null) {
      throw new Error("The Bloodboard candidate-route policy is currently limited to declared screen-crossing scenarios.");
    }
    const rulesProfile = profileForEngine(engine, player);
    if (!Number.isInteger(distance) || distance < 1) throw new RangeError("distance must be a positive integer.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");

    const ruleset = engine.RULESETS?.[variant];
    if (!ruleset?.pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + variant + ".");
    const goalX = ruleset.pitch.w - 1;
    const y = row === undefined ? Math.floor(ruleset.pitch.h / 2) : row;
    if (!Number.isInteger(y) || y < 0 || y >= ruleset.pitch.h) throw new RangeError("row is outside the selected pitch.");
    const fromX = scoreRun ? goalX - distance : (startX === undefined ? 2 : startX);
    const toX = fromX + distance;
    if (!Number.isInteger(fromX) || fromX < 0 || toX >= ruleset.pitch.w) {
      throw new RangeError("The straight route must start and finish inside the selected pitch.");
    }
    if (scoreRun && toX !== goalX) throw new Error("A scoreRun must end in Team A's scoring end zone.");
    if (!Array.isArray(supportPlayers) || supportPlayers.length > (format === "sevens" ? 6 : 10)) {
      throw new RangeError("supportPlayers must be an array containing no more than the selected format's remaining roster slots.");
    }

    const state = engine.newGame({
      a: { name: "Evaluation team" },
      b: { name: screen ? "Screen-crossing reference" : markerProfile ? "Marked-route reference" : "Open-route reference" },
      seed
    });
    if (variant === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    const actor = customScenarioPlayer(engine, state, "A", rulesProfile, { x: fromX, y });
    if (starId) actor.star = starId;
    state.players.push(actor);
    const occupied = new Set([fromX + ":" + y]);
    const supportDefinitions = supportPlayers.map((entry, index) => {
      if (!entry || typeof entry !== "object" || !entry.at || !entry.profile) {
        throw new TypeError("Each supportPlayers entry must contain an at square and a player profile.");
      }
      const { x, y: teammateY } = entry.at;
      if (!Number.isInteger(x) || !Number.isInteger(teammateY) || x < 0 || x >= ruleset.pitch.w || teammateY < 0 || teammateY >= ruleset.pitch.h) {
        throw new RangeError("Support player " + (index + 1) + " must be placed on an in-pitch integer square.");
      }
      const key = x + ":" + teammateY;
      if (occupied.has(key)) throw new Error("Support players and the mover must occupy distinct squares.");
      occupied.add(key);
      return { profile: profileForEngine(engine, entry.profile), at: { x, y: teammateY } };
    });
    const supportActors = supportDefinitions.map(definition => {
      const teammate = customScenarioPlayer(engine, state, "A", definition.profile, definition.at);
      state.players.push(teammate);
      return { id: teammate.id, profile: definition.profile, at: definition.at };
    });
    let markerDefinitions = [];
    if (screen !== null) {
      const maxMarkers = format === "sevens" ? 6 : 10;
      if (!Array.isArray(screen) || !screen.length || screen.length > maxMarkers) {
        throw new RangeError("screen must contain 1.." + maxMarkers + " opposing players for the selected format.");
      }
      markerDefinitions = screen.map((entry, index) => {
        if (!entry || typeof entry !== "object" || !entry.at || !entry.profile) {
          throw new TypeError("Each screen entry must contain an at square and a player profile.");
        }
        const { x, y: markerY } = entry.at;
        if (!Number.isInteger(x) || !Number.isInteger(markerY) || x < 0 || x >= ruleset.pitch.w || markerY < 0 || markerY >= ruleset.pitch.h) {
          throw new RangeError("Screen player " + (index + 1) + " must be placed on an in-pitch integer square.");
        }
        if (markerY === y && x >= fromX && x <= toX) {
          throw new Error("Screen players may not occupy a square on the declared straight route.");
        }
        const marksDeclaredPath = Array.from({ length: distance + 1 }, (_, step) => fromX + step)
          .some(routeX => Math.abs(x - routeX) <= 1 && Math.abs(markerY - y) <= 1);
        if (!marksDeclaredPath) {
          throw new Error("Screen player " + (index + 1) + " must be adjacent to at least one square on the declared route.");
        }
        const key = x + ":" + markerY;
        if (occupied.has(key)) throw new Error("Screen players and the mover must occupy distinct squares.");
        occupied.add(key);
        return { profile: profileForEngine(engine, entry.profile), at: { x, y: markerY } };
      });
    } else if (markerProfile) {
      if (y + 1 >= ruleset.pitch.h) throw new RangeError("Marked route requires one square south of the mover for the reference marker.");
      markerDefinitions = [{ profile: profileForEngine(engine, markerProfile), at: { x: fromX, y: y + 1 } }];
    }
    const markers = markerDefinitions.map((definition, index) => {
      const player = customScenarioPlayer(engine, state, "B", definition.profile, definition.at);
      state.players.push(player);
      return { id: player.id, profile: definition.profile, at: definition.at, index: index + 1 };
    });
    const starRuleTarget = starTargetIndex === null ? null : markers[starTargetIndex];
    if (starTargetIndex !== null && !starRuleTarget) {
      throw new RangeError("starTargetIndex must identify a declared screen player.");
    }
    if (starRuleTarget && starTargetRange !== undefined && Math.max(Math.abs(starRuleTarget.at.x - fromX), Math.abs(starRuleTarget.at.y - y)) > starTargetRange) {
      throw new Error(`${engine.STAR_BY_ID[starId].name}'s selected Star Rule target must be within ${starTargetRange} square${starTargetRange === 1 ? "" : "s"} at activation start.`);
    }
    if (scoreRun) state.ball = { kind: "held", playerId: actor.id };
    const playing = engine.startPlay(state);
    const fixedPath = Array.from({ length: distance }, (_, index) => ({
      to: { x: fromX + index + 1, y },
      kind: "step"
    }));
    const selectedRoute = routePolicy === "bloodboard-candidate"
      ? engine.safestRoute(playing, actor.id, { x: toX, y })
      : null;
    if (routePolicy === "bloodboard-candidate" && (!selectedRoute || !Array.isArray(selectedRoute.path) || !selectedRoute.path.length)) {
      throw new Error("Bloodboard could not find a path to the declared screen-crossing target within the player's movement budget.");
    }
    const path = selectedRoute ? cloneJson(selectedRoute.path) : fixedPath;
    const input = {
      kind: "playerAction", playerId: actor.id, action: "move", path,
      ...(useStartRule ? {
        starRule: true,
        ...(starRuleTarget ? { starTarget: starRuleTarget.id } : {})
      } : {})
    };
    const result = planAction(playing, input, planOptions);
    const taskEvent = scoreRun
      ? { type: "teamTouchdown", team: "A" }
      : { type: "playerAtSquare", playerId: actor.id, square: { x: toX, y }, stance: "standing" };
    const taskOutcomes = evaluateTerminalEvent({ state: playing, input, timepoint: "activation-ended", event: taskEvent, options: planOptions });
    const safeTaskOutcomes = evaluateTerminalEvent({ state: playing, input, timepoint: "activation-ended",
      event: { type: "allOf", events: [taskEvent, { type: "noTurnover" }] }, options: planOptions });
    const controlFootprint = measureTeamTackleZoneCoverage
      ? evaluateActionSequence({
        state: playing,
        inputs: [input, { kind: "endActivation" }],
        event: taskEvent,
        options: { ...planOptions, maxExpandedStates: planOptions.maxExpandedStates ?? 2000 },
        measureTeamTackleZonesFor: ["A", "B"]
      })
      : null;
    return {
      engine: META,
      scenario: {
        taskTimepoint: "activation-ended",
        id: screen ? (scoreRun ? "screened-straight-touchdown" : "screen-crossing-route") : markerProfile ? "marked-straight-route" : scoreRun ? "open-straight-touchdown" : "open-straight-reach",
        format,
        assumption: screen
          ? routePolicy === "bloodboard-candidate"
            ? scoreRun
              ? "The held-ball carrier starts at the declared distance from the scoring end zone. Bloodboard safestRoute selects one candidate path using its movement-risk heuristic; the selected path is then evaluated by planAction and evaluateTerminalEvent for an actual touchdown. The selector estimate is not an exact action probability and does not model shared team-reroll opportunity cost. Declared teammates remain stationary; teammate actions and assists are not modeled."
              : "The declared standing screen players use their listed profiles and squares. Bloodboard safestRoute selects one candidate path using its movement-risk heuristic; the exact selected path is then evaluated by planAction and evaluateTerminalEvent. The selector estimate is not an exact action probability and does not model shared team-reroll opportunity cost. Declared teammates remain stationary; teammate actions and assists are not modeled."
            : scoreRun
              ? "The ball carrier starts at the declared distance from the scoring end zone and follows one fixed straight horizontal path through the declared standing screen; Bloodboard must resolve a legal standing touchdown. Declared teammates remain stationary; teammate actions/assists and alternate routes are not modeled."
              : "The declared standing screen players use their listed profiles and squares; the mover follows the fixed straight horizontal path; declared teammates remain stationary and take no actions or assists; no weather penalty or alternate route is considered; Team A attacks toward increasing x."
          : markerProfile
            ? "One standing opposing player is placed adjacent to the mover's starting square and marks it; declared teammates remain stationary and take no actions or assists; no other opponent or weather penalty; straight horizontal path; Team A attacks toward increasing x."
          : "No opposing tackle zones or screens; declared teammates remain stationary and take no actions or assists; no weather penalty; straight horizontal path; Team A attacks toward increasing x.",
        actor: { id: actor.id, profile: rulesProfile },
        supportPlayers: supportActors,
        marker: !screen && markers.length ? markers[0] : null,
        screen: screen ? markers : null,
        start: { x: fromX, y },
        target: { x: toX, y },
        distance,
        scoreRun,
        routePolicy,
        starRuleUse: useStartRule ? {
          starId,
          frequency: "once per game",
          timing: "start of this activation",
          target: starRuleTarget ? { id: starRuleTarget.id, at: starRuleTarget.at } : null
        } : null,
        selectedPath: cloneJson(path),
        declaredStraightPath: cloneJson(fixedPath),
        routeSelectorEstimate: selectedRoute ? {
          method: "Bloodboard safestRoute heuristic; minimizes accumulated -log(step safety)",
          approximatePathSafety: selectedRoute.pSafe,
          stepCount: selectedRoute.path.length,
          dodgeCount: selectedRoute.dodges,
          rushCount: selectedRoute.rushes,
          detour: selectedRoute.detour,
          isExactActionProbability: false,
          limitation: "This path-ranking heuristic does not account for activation checks or repeated-use limits for Dodge/Sure Feet, and does not model the shared team-reroll budget or exact correlated action branches. Exact success and turnover probabilities below come from planAction and evaluateTerminalEvent for the selected path."
        } : null,
        successEvent: scoreRun
          ? screen ? "The ball carrier crosses the declared screen and Team A scores a touchdown." : "Team A scored a touchdown."
          : "After the activation ends (or an earlier Turnover stops it), the mover is standing on the target square; this event alone does not require no Turnover or an active tackle zone.",
        teamRerolls
      },
      replay: { state: cloneJson(playing), input: cloneJson(input), inputs: [cloneJson(input), { kind: "endActivation" }], timepoint: "activation-ended" },
      event: taskEvent,
      taskOutcomes,
      safeTaskOutcomes,
      controlFootprint,
      ...result
    };
  }

  function calculateOpenStraightRoute(options = {}) {
    return calculateStraightRoute(options);
  }

  function calculateMarkedStraightRoute(options = {}) {
    const { marker, ...routeOptions } = options;
    return calculateStraightRoute(routeOptions, marker || {
      position: "Reference marker", name: "Reference marker", ma: 6, st: 3,
      ag: 3, pa: 4, av: 9, skills: []
    });
  }

  function calculateScreenCrossingRoute(options = {}) {
    const { screen, ...routeOptions } = options;
    if (!Array.isArray(screen) || !screen.length) throw new TypeError("A screen-crossing route requires a non-empty screen layout.");
    return calculateStraightRoute({ ...routeOptions, screen });
  }

  function calculateMarkedRouteControl(options = {}) {
    if (!Array.isArray(options.screen) || !options.screen.length) {
      throw new TypeError("A marked-route control task requires an explicit opposing screen.");
    }
    return calculateStraightRoute({ ...options, measureTeamTackleZoneCoverage: true });
  }

  function prepareScoringReceptionTask({ receiver, format = "11s", teamRerolls = 1,
    passDistance = 2, weather = "perfect" } = {}) {
    const engine = getEngine();
    if (!receiver || typeof receiver !== "object") throw new TypeError("A receiver profile is required.");
    if (!["11s", "sevens"].includes(format)) throw new Error("format must be '11s' or 'sevens'.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0 || teamRerolls > 8) throw new RangeError("teamRerolls must be an integer in 0..8.");
    if (!Number.isInteger(passDistance) || passDistance < 1 || passDistance > 3) throw new RangeError("The fixed quick-pass benchmark uses a ruler distance of 1..3 squares.");
    if (!["perfect", "pouringRain", "verySunny", "blizzard", "swelteringHeat"].includes(weather)) throw new Error("weather is not a Bloodboard weather ID.");
    const receiverSkills = (receiver.skills || []).map(skill => typeof skill === "string" ? skill : skill.id);
    if (receiverSkills.includes("noBall")) return { unavailable: "No Ball automatically fails Catch; the candidate cannot perform the reception task.", kind: "not-applicable" };
    if (receiverSkills.includes("ballAndChain")) return { unavailable: "Ball & Chain does not permit the ordinary Move Action required after the reception.", kind: "not-applicable" };

    const rules = engine.RULESETS?.[format === "sevens" ? "sevens" : "standard"];
    if (!rules?.pitch) throw new Error("Bloodboard pitch dimensions are required.");
    const goalX = rules.pitch.w - 1;
    const receiverX = goalX - 3;
    const passerX = receiverX - passDistance;
    const y = Math.floor(rules.pitch.h / 2);
    if (passerX < 0 || receiverX >= rules.pitch.w) throw new RangeError("The scoring-reception reference positions are outside the pitch.");

    const state = engine.newGame({ a: { name: "Scoring reception reference" }, b: { name: "Reference opponent" }, seed: 1, weather });
    if (format === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    state.teams.A.leaderReroll = false;
    const passerProfile = profileForEngine(engine, {
      id: "reference-scorer-passer", name: "Reference Passer", position: "Thrower",
      ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: [{ id: "pass" }], keywords: ["Human", "Thrower"]
    });
    const receiverProfile = profileForEngine(engine, receiver);
    const passer = customScenarioPlayer(engine, state, "A", passerProfile, { x: passerX, y });
    passer.id = "reference-passer";
    const target = customScenarioPlayer(engine, state, "A", receiverProfile, { x: receiverX, y });
    target.id = "scoring-receiver";
    state.players.push(passer, target);

    // A fixed adjacent Thrall makes Bloodlust's legal bite fallback available;
    // it is stationary and does not assist, catch, or block the scoring route.
    let bloodlustThrall = null;
    if (receiverSkills.includes("bloodlust")) {
      const thrallProfile = profileForEngine(engine, {
        id: "reference-bloodlust-thrall", name: "Reference Thrall", position: "Thrall",
        ma: 6, st: 3, ag: 3, pa: null, av: 8, skills: [], keywords: ["Vampire", "Thrall"]
      });
      bloodlustThrall = customScenarioPlayer(engine, state, "A", thrallProfile, { x: receiverX - 1, y: y + 1 });
      bloodlustThrall.id = "reference-bloodlust-thrall";
      state.players.push(bloodlustThrall);
    }

    const starId = resolveStarId(receiver);
    let pair = null;
    if (starId && engine.STAR_BY_ID[starId].pair) {
      const pairId = engine.STAR_BY_ID[starId].pair;
      const pairProfile = profileForEngine(engine, engine.STAR_BY_ID[pairId]);
      pair = customScenarioPlayer(engine, state, "A", pairProfile, { x: Math.max(0, receiverX - 1), y: y + 2 });
      pair.id = "paired-star-partner";
      pair.star = pairId;
      state.players.push(pair);
    }

    state.ball = { kind: "held", playerId: passer.id };
    const playing = engine.startPlay(state);
    const passInput = { kind: "playerAction", playerId: passer.id, action: "pass", path: [],
      passTarget: { x: receiverX, y } };
    const movePath = Array.from({ length: goalX - receiverX }, (_, index) => ({
      kind: "step", to: { x: receiverX + index + 1, y }
    }));
    const receiveAndScoreInput = { kind: "playerAction", playerId: target.id, action: "move", path: movePath };
    const inputs = [passInput, { kind: "endActivation" }, receiveAndScoreInput, { kind: "endActivation" }];
    const event = { type: "teamTouchdown", team: "A" };
    const positionErrors = engine.validatePosition(playing).filter(issue => issue.level === "error");
    const passErrors = engine.validateInput(playing, passInput);
    if (positionErrors.length || passErrors.length) throw new Error("Scoring-reception reference is illegal: " +
      [...positionErrors.map(issue => issue.text), ...passErrors].join("; "));
    return {
      state: cloneJson(playing), inputs, event,
      reference: {
        id: "quick-pass-receive-and-score",
        format,
        weather,
        passer: { id: passer.id, profile: passerProfile, at: { x: passerX, y }, startsWithBall: true },
        receiver: { id: target.id, profile: receiverProfile, at: { x: receiverX, y }, starId, pairedStarId: pair?.star || null },
        bloodlustThrall: bloodlustThrall ? { id: bloodlustThrall.id, at: bloodlustThrall.pos, role: "bite fallback only" } : null,
        opponentProfile: [],
        pressure: "open; no opposing markers, interceptors, or modifiers",
        passDistance,
        route: movePath.map(step => step.to),
        goal: { x: goalX, y },
        successEvent: "Team A scores a touchdown after the fixed Pass activation ends and the named receiver begins a new Move activation.",
        actionOrder: ["reference PA3 Passer completes a quick Pass to the named receiver", "Passer activation ends", "named receiver catches/holds the ball and attempts the fixed end-zone Move", "receiver activation ends unless an earlier Turnover or touchdown stops the chain"],
        resourcePolicy: "One shared team reroll pool persists across both activations; player skills, Bloodlust, star identity, paired partner, Rush and touchdown are resolved by Bloodboard.",
        limitation: "Open fixed quick-pass line, fixed scorer route and one reference passer; no marked receiver, interceptor, opponent response, alternative route, optimal passer selection or match-frequency weighting. Optional activation-start Star Rules are not declared."
      },
      actorIds: { passer: passer.id, receiver: target.id, bloodlustThrall: bloodlustThrall?.id || null, pairedStar: pair?.id || null }
    };
  }

  function calculateGazeAssistedTouchdown({
    carrier,
    opener,
    opponent,
    thrall,
    format = "11s",
    distance = 8,
    row,
    teamRerolls = 0,
    openerStarRule = false,
    openerStarTarget,
    carrierStarRule = false,
    carrierStarTarget,
    seed = 1,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    if (!carrier || !opener || !opponent || !thrall) {
      throw new TypeError("Carrier, Hypnotic Gaze opener, screen opponent, and Thrall profiles are required.");
    }
    if (!Number.isInteger(distance) || distance < 4) throw new RangeError("The fixed assisted-touchdown benchmark requires a route distance of at least 4 squares.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (typeof openerStarRule !== "boolean" || typeof carrierStarRule !== "boolean") {
      throw new TypeError("openerStarRule and carrierStarRule must be booleans; optional Star Rules must be explicitly requested.");
    }
    if (openerStarTarget !== undefined && typeof openerStarTarget !== "string") throw new TypeError("openerStarTarget must be a player ID string.");
    if (carrierStarTarget !== undefined && typeof carrierStarTarget !== "string") throw new TypeError("carrierStarTarget must be a player ID string.");
    const pitch = getPitchDimensions(format);
    const goalX = pitch.width - 1;
    const startX = goalX - distance;
    const y = row === undefined ? Math.floor(pitch.height / 2) : row;
    if (startX < 1 || !Number.isInteger(y) || y < 1 || y > pitch.height - 3) {
      throw new RangeError("The fixed screen/gaze setup needs an in-bounds central lane and support squares.");
    }
    const screenAt = { x: startX + 1, y: y + 1 };
    const openerAt = { x: screenAt.x, y: y + 2 };
    const openerThrallAt = { x: screenAt.x + 1, y: y + 2 };
    const carrierThrallAt = { x: goalX - 1, y: y + 1 };
    const placements = [
      { role: "carrier", at: { x: startX, y } },
      { role: "screen opponent", at: screenAt },
      { role: "gaze opener", at: openerAt },
      { role: "opener Thrall", at: openerThrallAt },
      { role: "carrier Thrall", at: carrierThrallAt }
    ];
    const occupied = new Set();
    placements.forEach(({ role, at }) => {
      if (at.x < 0 || at.x >= pitch.width || at.y < 0 || at.y >= pitch.height) {
        throw new RangeError(role + " position is outside the selected pitch.");
      }
      const key = at.x + ":" + at.y;
      if (occupied.has(key)) throw new Error("The fixed Gaze-assisted touchdown setup overlaps at " + key + ".");
      occupied.add(key);
    });

    const carrierProfile = profileForEngine(engine, carrier);
    const openerProfile = profileForEngine(engine, opener);
    const opponentProfile = profileForEngine(engine, opponent);
    const thrallProfile = profileForEngine(engine, thrall);
    if (format === "sevens" && [carrierProfile, openerProfile, opponentProfile, thrallProfile].some(profile => profile.star)) {
      throw new Error("Star Players are not legal in the Sevens Gaze-assisted team-scoring benchmark.");
    }
    if (!openerProfile.skills.some(skill => skill.id === "hypnoticGaze")) {
      throw new Error("The declared opener must have Hypnotic Gaze.");
    }
    if (openerStarRule && !openerProfile.star) throw new Error("openerStarRule requires a canonical Star Player identity.");
    if (carrierStarRule && !carrierProfile.star) throw new Error("carrierStarRule requires a canonical Star Player identity.");
    if (carrierProfile.skills.some(skill => skill.id === "noBall")) {
      throw new Error("A No Ball player cannot be the declared held-ball scorer.");
    }
    const state = engine.newGame({
      a: { name: "Gaze-assisted scoring team" },
      b: { name: "Fixed screen defense" },
      seed
    });
    if (format === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    const carrierActor = customScenarioPlayer(engine, state, "A", carrierProfile, { x: startX, y });
    state.players.push(carrierActor);
    const openerActor = customScenarioPlayer(engine, state, "A", openerProfile, openerAt);
    state.players.push(openerActor);
    const openerThrall = customScenarioPlayer(engine, state, "A", thrallProfile, openerThrallAt);
    state.players.push(openerThrall);
    const carrierThrall = customScenarioPlayer(engine, state, "A", thrallProfile, carrierThrallAt);
    state.players.push(carrierThrall);
    const screenActor = customScenarioPlayer(engine, state, "B", opponentProfile, screenAt);
    state.players.push(screenActor);
    state.ball = { kind: "held", playerId: carrierActor.id };
    const playing = engine.startPlay(state);
    const moveInput = {
      kind: "playerAction",
      playerId: carrierActor.id,
      action: "move",
      path: Array.from({ length: distance }, (_, index) => ({ to: { x: startX + index + 1, y }, kind: "step" })),
      ...(carrierStarRule ? { starRule: true, ...(carrierStarTarget ? { starTarget: carrierStarTarget } : {}) } : {})
    };
    const gazeInput = {
      kind: "playerAction",
      playerId: openerActor.id,
      action: "special",
      special: "hypnoticGaze",
      specialTarget: screenActor.id,
      path: [],
      ...(openerStarRule ? { starRule: true, ...(openerStarTarget ? { starTarget: openerStarTarget } : {}) } : {})
    };
    const goal = { x: goalX, y };
    function candidateMoveForState(branchState, selectionContext) {
      const branchScreen = branchState.players.find(player => player.id === screenActor.id);
      const useTeamRerolls = selectionContext.useTeamRerolls;
      const routeSpecs = [
        { id: "engine-heuristic-route", label: "Bloodboard safestRoute 候选", waypoint: null },
        { id: "upper-lane-route", label: "屏障上侧绕行候选", waypoint: { x: screenAt.x, y: y - 1 } },
        { id: "lower-lane-route", label: "屏障下侧绕行候选", waypoint: { x: screenAt.x, y: y + 3 } }
      ];
      const candidates = [];
      const seenPaths = new Set();
      routeSpecs.forEach(spec => {
        let route;
        if (spec.waypoint) {
          const first = engine.safestRoute(branchState, carrierActor.id, spec.waypoint);
          if (!first || !Array.isArray(first.path) || !first.path.length) return;
          const second = engine.safestRoute(branchState, carrierActor.id, goal, first.path);
          if (!second || !Array.isArray(second.path) || !second.path.length) return;
          route = { path: [...first.path, ...second.path], segments: [first, second] };
        } else {
          route = engine.safestRoute(branchState, carrierActor.id, goal);
        }
        if (!route || !Array.isArray(route.path) || !route.path.length) return;
        const pathKey = route.path.map(step => step.to.x + ":" + step.to.y).join("/");
        if (seenPaths.has(pathKey)) return;
        seenPaths.add(pathKey);
        const input = {
          kind: "playerAction", playerId: carrierActor.id, action: "move", path: cloneJson(route.path),
          ...(carrierStarRule ? { starRule: true, ...(carrierStarTarget ? { starTarget: carrierStarTarget } : {}) } : {})
        };
        let touchdownMass = 0;
        let turnoverMass = 0;
        const exploration = engine.exploreOutcomes(cloneJson(branchState), cloneJson(input), {
          followUp: planOptions.followUp !== false,
          useTeamRerolls,
          threshold: planOptions.threshold === undefined ? 1e-12 : planOptions.threshold,
          maxLeaves: planOptions.maxLeaves === undefined ? 60000 : planOptions.maxLeaves
        }, leaf => {
          if (leaf.touchdown === "A" || leaf.state.touchdown?.team === "A") touchdownMass += leaf.p;
          if (leaf.turnover) turnoverMass += leaf.p;
        });
        if (!exploration.ok) return;
        const unresolved = exploration.unresolved;
        candidates.push({
          id: spec.id,
          label: spec.label,
          input,
          path: cloneJson(route.path),
          success: { lowerBound: touchdownMass, upperBound: Math.min(1, touchdownMass + unresolved), exact: unresolved <= 1e-12 },
          turnover: { lowerBound: turnoverMass, upperBound: Math.min(1, turnoverMass + unresolved), exact: unresolved <= 1e-12 },
          unresolved,
          stepCount: route.path.length,
          approximatePathSafety: spec.waypoint ? null : route.pSafe
        });
      });
      candidates.sort((a, b) =>
        b.success.lowerBound - a.success.lowerBound ||
        a.turnover.upperBound - b.turnover.upperBound ||
        a.stepCount - b.stepCount ||
        a.id.localeCompare(b.id)
      );
      const selected = candidates[0];
      if (!selected) {
        return {
          input: null,
          decision: {
            routePolicy: "best exact outcome among declared lane candidates",
            selectionContext,
            screenDistracted: !!(branchScreen && branchScreen.distracted),
            status: "no-legal-route-candidate-within-movement-budget",
            candidateCount: 0
          }
        };
      }
      return {
        input: selected.input,
        decision: {
          routePolicy: "best exact outcome among declared lane candidates",
          selectionContext,
          screenDistracted: !!(branchScreen && branchScreen.distracted),
          status: "candidate-selected",
          selectedCandidateId: selected.id,
          selectedPath: selected.path,
          selectedTouchdownProbability: selected.success,
          selectedTurnoverProbability: selected.turnover,
          candidateSelectionCertain: candidates.every(candidate => candidate === selected || selected.success.lowerBound >= candidate.success.upperBound - 1e-12),
          candidateResults: candidates.map(candidate => ({
            id: candidate.id,
            label: candidate.label,
            touchdownProbability: candidate.success,
            turnoverProbability: candidate.turnover,
            unresolved: candidate.unresolved,
            stepCount: candidate.stepCount,
            approximatePathSafety: candidate.approximatePathSafety
          })),
          stepCount: selected.stepCount,
          isRouteOutcomeEngineEnumerated: true,
          candidateSetIsExhaustive: false
        }
      };
    }
    const baseline = evaluateActionSequence({
      state: playing,
      inputs: [moveInput, { kind: "endActivation" }],
      event: { type: "teamTouchdown", team: "A" },
      options: planOptions
    });
    const baselineCandidate = evaluateActionSequence({
      state: playing,
      inputs: [branchState => candidateMoveForState(branchState, "before-any-gaze"), { kind: "endActivation" }],
      event: { type: "teamTouchdown", team: "A" },
      options: planOptions
    });
    const gaze = evaluateActionSequence({
      state: playing,
      inputs: [gazeInput, { kind: "endActivation" }, moveInput, { kind: "endActivation" }],
      event: { type: "teamTouchdown", team: "A" },
      options: planOptions
    });
    const gazeAdaptiveCandidate = evaluateActionSequence({
      state: playing,
      inputs: [
        gazeInput,
        { kind: "endActivation" },
        branchState => candidateMoveForState(branchState, "after-opener-activation"),
        { kind: "endActivation" }
      ],
      event: { type: "teamTouchdown", team: "A" },
      options: planOptions
    });
    return {
      engine: META,
      status: [baseline, baselineCandidate, gaze, gazeAdaptiveCandidate].every(result =>
        result.status === "engine-enumerated-fixed-action-sequence" || result.status === "engine-enumerated-branch-adaptive-action-sequence")
        ? "engine-enumerated-gaze-assisted-team-touchdown"
        : "gaze-assisted-policy-has-branch-specific-illegal-actions",
      scenario: {
        taskTimepoint: "activation-ended; explicit opener cleanup before route selection; stop at Turnover or touchdown",
        id: "gaze-opened-fixed-screen-touchdown",
        format,
        start: { x: startX, y },
        goal: { x: goalX, y },
        distance,
        screen: { position: screenAt, profile: opponentProfile },
        opener: { position: openerAt, profile: openerProfile, adjacentThrall: openerThrallAt },
        carrier: { position: { x: startX, y }, profile: carrierProfile, adjacentGoalThrall: carrierThrallAt },
        teamRerolls,
        starRulePolicy: {
          opener: { requested: openerStarRule, target: openerStarTarget || null },
          carrier: { requested: carrierStarRule, target: carrierStarTarget || null },
          passiveAndAutomaticEffects: "Bloodboard resolves supported rules for all canonical Star identities in each branch state."
        },
        actionOrder: ["a separate teammate declares Hypnotic Gaze against the adjacent Standing screen; that activation ends", "the held-ball carrier then follows the declared fixed route or selects a route from the resulting branch state"],
        routePolicies: {
          fixed: "The runner always attempts the declared straight path, regardless of Gaze outcome.",
          candidateBeforeGaze: "The scorer compares Bloodboard's heuristic route with legal upper/lower waypoint candidates by exact touchdown and turnover enumeration from the same initial state and reroll pool, then chooses the best lower-bound success result. This is exact only within the declared finite route set.",
          candidateAfterGaze: "After the opener's activation resolves, the scorer re-enumerates the same route portfolio from each exact successor state, including whether the screen is Distracted and branches where Bloodlust changed the declared Gaze action to Move. Shared rerolls are evaluated from that branch's remaining resource state. This is not a full-turn or globally exhaustive coaching policy."
        },
        assumptions: [
          "One reference Standing opponent marks the fixed lane; successful Hypnotic Gaze Distracts that screen before the carrier acts.",
          "A legal ST3 Thrall is placed beside each vampire activation endpoint so Bloodlust can use its bite fallback when available.",
          "The first declared action is still subject to the opener's Bloodlust roll; if Bloodlust changes it to Move, the selector sees the screen still active rather than treating that branch as a failed Gaze roll.",
          "Bloodboard's safestRoute is retained as one candidate; upper/lower waypoint routes are also generated when legal. Each route is independently evaluated by Bloodboard with the same branch-local shared team-reroll resource, and the policy selects by exact task probability within this finite candidate set.",
          "This is a two-activation declared policy, not a full-turn search, roster positioning optimizer, complete route search, or proof of optimal coaching."
        ],
        actorIds: { carrier: carrierActor.id, opener: openerActor.id, screen: screenActor.id, thralls: [openerThrall.id, carrierThrall.id] },
        event: { type: "teamTouchdown", team: "A" }
      },
      replay: { state: cloneJson(playing), openerInput: cloneJson(gazeInput), carrierInput: cloneJson(moveInput) },
      withoutGazeOpening: baseline,
      withoutGazeOpeningCandidate: baselineCandidate,
      withGazeOpening: gaze,
      withGazeOpeningAdaptiveCandidate: gazeAdaptiveCandidate
    };
  }

  function calculateBallAcquisition({
    player,
    format = "11s",
    pickupMethod = "agility",
    pressure = "open",
    weather = "perfect",
    teamRerolls = 0,
    starRule = false,
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be '11s' or 'sevens'.");
    if (pickupMethod !== "agility" && pickupMethod !== "secure") throw new Error("pickupMethod must be 'agility' or 'secure'.");
    if (pressure !== "open" && pressure !== "marked") throw new Error("pressure must be 'open' or 'marked'.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (typeof starRule !== "boolean") throw new TypeError("starRule must be a boolean; optional Star Player rules must be explicitly requested.");
    const rulesProfile = profileForEngine(engine, player);
    if (starRule && !rulesProfile.star) throw new Error("An explicitly requested Star Player rule requires a canonical Star Player identity.");
    const ruleset = engine.RULESETS?.[variant];
    if (!ruleset?.pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + variant + ".");
    const width = ruleset.pitch.w;
    const height = ruleset.pitch.h;
    if (!["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    const y = row === undefined ? Math.floor(height / 2) : row;
    if (!Number.isInteger(y) || y < 0 || y >= height) throw new RangeError("row is outside the selected pitch.");
    const ballAt = { x: Math.floor(width / 2), y };
    const actorAt = { x: ballAt.x - 1, y };
    const opponentAt = { x: ballAt.x + 1, y };
    const state = engine.newGame({
      a: { name: "Pickup evaluation team" },
      b: { name: "Pickup pressure reference" },
      seed: 1,
      weather
    });
    if (variant === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    const actor = customScenarioPlayer(engine, state, "A", rulesProfile, actorAt);
    state.players.push(actor);
    if (pressure === "marked") {
      const marker = customScenarioPlayer(engine, state, "B", {
        position: "Reference marker", name: "Reference marker", ma: 6, st: 3,
        ag: 3, pa: 4, av: 9, skills: [], keywords: []
      }, opponentAt);
      state.players.push(marker);
    }
    state.ball = { kind: "ground", pos: ballAt };
    const playing = engine.startPlay(state);
    const input = {
      kind: "playerAction",
      playerId: actor.id,
      action: pickupMethod === "secure" ? "secure" : "move",
      path: [{ to: ballAt, kind: "step" }],
      ...(starRule ? { starRule: true } : {})
    };
    const result = planAction(playing, input, planOptions);
    const taskOutcomes = evaluateTerminalEvent({
      state: playing,
      input,
      timepoint: "activation-ended",
      event: { type: "playerHasBall", playerId: actor.id },
      options: planOptions
    });
    const safeTaskOutcomes = evaluateTerminalEvent({ state: playing, input, timepoint: "activation-ended",
      event: { type: "allOf", events: [taskOutcomes.event, { type: "noTurnover" }] }, options: planOptions });
    return {
      engine: META,
      scenario: {
        taskTimepoint: "activation-ended",
        id: "single-action-ball-acquisition",
        format,
        pickupMethod,
        pressure,
        weather,
        actor: { id: actor.id, profile: rulesProfile },
        ballAt,
        actorAt,
        opponentAt: pressure === "marked" ? opponentAt : null,
        teamRerolls,
        starRuleUse: starRule ? { requested: true, target: null } : { requested: false },
        successEvent: "At the end of this action, the ball is held by the acting player.",
        assumptions: [
          "One player moves one square toward a stationary ground ball.",
          pressure === "marked" ? "One reference opponent stands one square east of and marks the ball square; the actor starts two squares away from that marker." : "No opposing tackle zones are within two squares of the ball.",
          "No teammate assists or later actions are included."
        ]
      },
      replay: { state: cloneJson(playing), input: cloneJson(input), inputs: [cloneJson(input), { kind: "endActivation" }], timepoint: "activation-ended" },
      taskOutcomes,
      safeTaskOutcomes,
      ...result
    };
  }

  function calculateOpponentActivationDenial({
    attacker,
    defender,
    format = "11s",
    weather = "perfect",
    teamRerolls = 0,
    starRule = false,
    starTarget = "B1",
    row,
    planOptions = {}
  } = {}) {
    if (resolveStarId(attacker) !== "estelle") {
      throw new Error("The opponent-activation-denial benchmark currently requires Estelle la Veneaux's canonical printed profile.");
    }
    if (starTarget !== "B1") throw new Error("This fixed benchmark selects the opposing block target B1 for Baleful Hex.");
    const block = calculateOneOnOneBlock({
      attacker,
      defender: defender || { name: "Reference target", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
      action: "block",
      format,
      weather,
      teamRerolls,
      starRule,
      starTarget,
      row,
      planOptions
    });
    if (!block.summary?.legal) throw new Error("Bloodboard rejected the Baleful Hex benchmark: " + JSON.stringify(block.summary?.errors || []));
    const event = { type: "playerHexedForNextTurn", playerId: block.scenario.defender.id };
    const deniedActivation = evaluateTerminalEvent({
      state: block.replay.state,
      input: block.replay.input,
      timepoint: "activation-ended",
      event,
      options: planOptions
    });
    return {
      engine: META,
      scenario: {
        id: "estelle-single-target-next-turn-activation-denial",
        format,
        weather,
        teamRerolls,
        starRuleUse: block.scenario.starRuleUse,
        actor: block.scenario.attacker,
        target: block.scenario.defender,
        taskTimepoint: "activation-ended",
        successEvent: "Target remains on pitch, is otherwise eligible, and has a Hex marker for the target team's next Turn.",
        assumptions: [
          "Estelle begins adjacent to one standing opposing reference player and declares a Block Action.",
          "The benchmark counts at most one otherwise-available target activation denied; it does not estimate whether the opponent would choose to activate that player.",
          "Baleful Hex is fresh and once-per-game opportunity frequency is not modeled."
        ]
      },
      replay: block.replay,
      taskEvent: event,
      deniedActivation,
      blockSummary: block.summary,
      plan: block.plan
    };
  }

  function calculateGrombrindalSkillGrant({
    format = "11s",
    weather = "perfect",
    teamRerolls = 1,
    teammate = { name: "ST4 Chaos Warrior", position: "Chaos Warrior", ma: 5, st: 4, ag: 3, pa: 5, av: 9, skills: ["block"], keywords: ["Chaos"] },
    marker = { name: "Tackle marker", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ["tackle"], keywords: ["Human"] },
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    if (format !== "11s") throw new Error("The Grombrindal teammate-skill benchmark is currently declared for eleven-player rules only.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!teammate || !marker || typeof teammate !== "object" || typeof marker !== "object") throw new TypeError("A teammate and opposing marker profile are required.");
    const normalizedTeammate = profileForEngine(engine, teammate);
    if (["breakTackle", "dauntless", "mightyBlow", "sureFeet"].some(id => normalizedTeammate.skills.some(skill => skill.id === id))) {
      throw new Error("The declared teammate must be missing Grombrindal's first available skill, Break Tackle, for this fixed benchmark.");
    }
    profileForEngine(engine, marker);
    const grombrindal = engine.STAR_BY_ID?.grombrindal;
    if (!grombrindal || !engine.starSupported?.("grombrindal")) throw new Error("The loaded Bloodboard engine does not support Grombrindal.");
    const row = Math.floor(getPitchDimensions(format).height / 2);
    const gromAt = { x: 5, y: row - 1 };
    const teammateAt = { x: 6, y: row };
    const markerAt = { x: 7, y: row - 1 };
    const destination = { x: 5, y: row };
    const sequenceEvent = {
      type: "allOf",
      events: [
        { type: "playerAtSquare", playerId: "A2", square: destination, stance: "standing" },
        { type: "noTurnover" }
      ]
    };
    const grantEvent = { type: "playerHasTemporarySkill", playerId: "A2", skillId: "breakTackle", until: "turn" };
    const actionInputs = useStarRule => [
      { kind: "playerAction", playerId: "A1", action: "move", path: [{ to: { x: 4, y: row - 1 }, kind: "step" }], ...(useStarRule ? { starRule: true, starTarget: "A2" } : {}) },
      { kind: "endActivation" },
      { kind: "playerAction", playerId: "A2", action: "move", path: [{ to: destination, kind: "step" }] },
      { kind: "endActivation" }
    ];
    const makeState = () => {
      const state = engine.newGame({ a: { name: "Grombrindal support benchmark" }, b: { name: "Tackle reference team" }, seed: 1, weather });
      state.teams.A.rerolls = teamRerolls;
      const star = engine.customPlayer(state, "A", grombrindal, gromAt);
      star.star = "grombrindal";
      star.starUsed = [];
      state.players.push(star);
      state.players.push(engine.customPlayer(state, "A", normalizedTeammate, teammateAt));
      state.players.push(engine.customPlayer(state, "B", profileForEngine(engine, marker), markerAt));
      return engine.startPlay(state);
    };
    const planState = makeState();
    const plan = planAction(planState, actionInputs(true)[0], planOptions);
    if (!plan.summary?.legal) throw new Error("Bloodboard rejected Grombrindal's activation: " + JSON.stringify(plan.summary?.errors || []));
    // Observe the grant immediately after Grombrindal's own activation. The
    // paired task below then measures whether the gifted skill improves the
    // teammate's next action; measuring the skill only at the end of that
    // action would conflate grant frequency with later state changes.
    const grantOnly = evaluateActionSequence({ state: makeState(), inputs: actionInputs(true).slice(0, 2), event: grantEvent, options: planOptions });
    const withoutRule = evaluateActionSequence({ state: makeState(), inputs: actionInputs(false), event: sequenceEvent, options: planOptions });
    const withRule = evaluateActionSequence({ state: makeState(), inputs: actionInputs(true), event: sequenceEvent, options: planOptions });
    if (!withoutRule.withoutTeamRerolls.legal || !withRule.withoutTeamRerolls.legal) {
      throw new Error("Bloodboard rejected a Grombrindal paired movement task: " + JSON.stringify({ withoutRule: withoutRule.withoutTeamRerolls.errors, withRule: withRule.withoutTeamRerolls.errors }));
    }
    return {
      engine: META,
      scenario: {
        id: "grombrindal-break-tackle-assisted-escape",
        format,
        weather,
        teamRerolls,
        actor: { id: "A1", starId: "grombrindal", at: gromAt },
        teammate: { id: "A2", profile: normalizedTeammate, at: teammateAt },
        marker: { id: "B1", profile: profileForEngine(engine, marker), at: markerAt },
        destination,
        giftedSkill: "breakTackle",
        giftDuration: "until end of Turn",
        assumptions: [
          "Grombrindal starts adjacent to his teammate, declares one Move Action with Wisdom of the White Dwarf, and chooses that teammate.",
          "The teammate lacks all four grantable skills; Bloodboard's current preview choice selects the first legal listed option, Break Tackle.",
          "The teammate then attempts a one-square Dodge out of one Tackle Zone; success requires standing at the declared destination without a Turnover.",
          "This isolates one teammate role and one skill choice; no global choice among Break Tackle, Dauntless, Mighty Blow and Sure Feet is claimed."
        ]
      },
      event: sequenceEvent,
      inputs: { withoutRule: actionInputs(false), withRule: actionInputs(true) },
      withoutRule,
      withRule,
      grantOnly,
      plan: plan.plan
    };
  }

  function calculateBallRecovery({
    player = { name: "Reference ball retriever", position: "Human Thrower", ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: [] },
    format = "11s",
    pressure = "open",
    weather = "perfect",
    teamRerolls = 0,
    row,
    planOptions = {}
  } = {}) {
    const pickup = calculateBallAcquisition({
      player,
      format,
      pickupMethod: "agility",
      pressure,
      weather,
      teamRerolls,
      row,
      planOptions
    });
    const teamPossessionEvent = { type: "teamHasBall", team: "A" };
    const recoveryEvent = {
      type: "allOf",
      events: [teamPossessionEvent, { type: "noTurnover" }]
    };
    const possessionAfterTurnoverEvent = {
      type: "allOf",
      events: [teamPossessionEvent, { type: "turnover" }]
    };
    const teamPossessionOutcomes = evaluateTerminalEvent({
      state: pickup.replay.state,
      input: pickup.replay.input,
      timepoint: "activation-ended",
      event: teamPossessionEvent,
      options: planOptions
    });
    const recoveryOutcomes = evaluateTerminalEvent({
      state: pickup.replay.state,
      input: pickup.replay.input,
      timepoint: "activation-ended",
      event: recoveryEvent,
      options: planOptions
    });
    const possessionAfterTurnoverOutcomes = evaluateTerminalEvent({
      state: pickup.replay.state,
      input: pickup.replay.input,
      timepoint: "activation-ended",
      event: possessionAfterTurnoverEvent,
      options: planOptions
    });
    return {
      ...pickup,
      scenario: {
        taskTimepoint: "activation-ended",
        ...pickup.scenario,
        id: "single-action-ball-recovery",
        successEvent: "At the end of the recovery action, Team A holds the ball and has not Turned Over.",
        assumptions: pickup.scenario.assumptions.concat(
          "The ball is already loose at the start of this task, representing a prior Strip Ball, Block, scatter or bounce; that earlier event is not simulated.",
          "Team possession and safe recovery (team possession plus no Turnover) are separate reported events."
        )
      },
      taskOutcomes: recoveryOutcomes,
      teamPossessionOutcomes,
      possessionAfterTurnoverOutcomes,
      individualPickupOutcomes: pickup.taskOutcomes
    };
  }

  function calculateBallDisruption({
    attacker = { name: "Reference Strip Ball Blitzer", position: "Blitzer", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    carrier = { name: "Reference Human Thrower", position: "Human Thrower", ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: [] },
    format = "11s",
    weather = "perfect",
    teamRerolls = 0,
    row,
    planOptions = {}
  } = {}) {
    const block = calculateOneOnOneBlock({
      attacker,
      defender: carrier,
      ballCarrier: "defender",
      format,
      weather,
      teamRerolls,
      row,
      planOptions
    });
    const carrierPossessionEvent = { type: "teamHasBall", team: "B" };
    const disruptionEvent = { type: "not", event: carrierPossessionEvent };
    const safeDisruptionEvent = {
      type: "allOf",
      events: [disruptionEvent, { type: "noTurnover" }]
    };
    const carrierPossessionOutcomes = evaluateTerminalEvent({
      state: block.replay.state,
      input: block.replay.input,
      timepoint: "activation-ended",
      event: carrierPossessionEvent,
      options: planOptions
    });
    const disruptionOutcomes = evaluateTerminalEvent({
      state: block.replay.state,
      input: block.replay.input,
      timepoint: "activation-ended",
      event: disruptionEvent,
      options: planOptions
    });
    const safeDisruptionOutcomes = evaluateTerminalEvent({
      state: block.replay.state,
      input: block.replay.input,
      timepoint: "activation-ended",
      event: safeDisruptionEvent,
      options: planOptions
    });
    return {
      ...block,
      replay: { ...block.replay, inputs: [block.replay.input, { kind: "endActivation" }], timepoint: "activation-ended" },
      scenario: {
        taskTimepoint: "activation-ended",
        ...block.scenario,
        id: "single-action-ball-disruption",
        successEvents: [
          "Carrier's team no longer holds the ball at the end of the Block Action.",
          "Carrier's team loses possession without the blocking team suffering a Turnover."
        ],
        assumptions: block.scenario.assumptions.concat(
          "The ball carrier begins holding the ball; the blocking team has one adjacent attacker and no additional assists or follow-up action.",
          "Possession loss and safe disruption are separate terminal events; ball recovery after the Block Action is not simulated."
        )
      },
      taskOutcomes: disruptionOutcomes,
      carrierPossessionOutcomes,
      safeDisruptionOutcomes
    };
  }

  function calculateBallTransfer({
    passer,
    receiver,
    method = "pass",
    format = "11s",
    distance,
    pressure = "open",
    weather = "perfect",
    teamRerolls = 0,
    startX = 4,
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be '11s' or 'sevens'.");
    if (method !== "pass" && method !== "handoff") throw new Error("method must be 'pass' or 'handoff'.");
    if (pressure !== "open" && pressure !== "receiverMarked") throw new Error("pressure must be 'open' or 'receiverMarked'.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    const transferDistance = distance === undefined ? (method === "handoff" ? 1 : 2) : distance;
    if (!Number.isInteger(transferDistance) || transferDistance < 1) throw new RangeError("distance must be a positive integer.");
    if (method === "handoff" && transferDistance !== 1) throw new RangeError("A hand-off reference scenario requires adjacent players (distance 1).");
    const passerProfile = profileForEngine(engine, passer);
    const receiverProfile = profileForEngine(engine, receiver);
    const ruleset = engine.RULESETS?.[variant];
    if (!ruleset?.pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + variant + ".");
    const width = ruleset.pitch.w;
    const height = ruleset.pitch.h;
    if (!["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    if (!Number.isInteger(startX) || startX < 0 || startX + transferDistance >= width) {
      throw new RangeError("passer and receiver must both start inside the selected pitch.");
    }
    const y = row === undefined ? Math.floor(height / 2) : row;
    if (!Number.isInteger(y) || y < (pressure === "receiverMarked" ? 1 : 0) || y >= height) {
      throw new RangeError("row is outside the selected pitch or leaves no square to mark the receiver.");
    }
    const passerAt = { x: startX, y };
    const receiverAt = { x: startX + transferDistance, y };
    if (pressure === "receiverMarked" && receiverAt.x + 1 >= width) {
      throw new RangeError("receiverMarked requires one square beyond and diagonally above the receiver.");
    }
    const markerAt = { x: receiverAt.x + 1, y: y - 1 };
    const state = engine.newGame({
      a: { name: "Ball-transfer evaluation team" },
      b: { name: "Ball-transfer pressure reference" },
      seed: 1,
      weather
    });
    if (variant === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    const actor = customScenarioPlayer(engine, state, "A", passerProfile, passerAt);
    state.players.push(actor);
    const target = customScenarioPlayer(engine, state, "A", receiverProfile, receiverAt);
    state.players.push(target);
    let marker = null;
    if (pressure === "receiverMarked") {
      marker = customScenarioPlayer(engine, state, "B", {
        position: "Reference marker", name: "Reference marker", ma: 6, st: 3,
        ag: 3, pa: 4, av: 9, skills: []
      }, markerAt);
      state.players.push(marker);
    }
    state.ball = { kind: "held", playerId: actor.id };
    const playing = engine.startPlay(state);
    const input = method === "pass"
      ? { kind: "playerAction", playerId: actor.id, action: "pass", path: [], passTarget: receiverAt }
      : { kind: "playerAction", playerId: actor.id, action: "handoff", path: [], handoffTarget: target.id };
    const result = planAction(playing, input, planOptions);
    const taskOutcomes = evaluateTerminalEvent({
      state: playing,
      input,
      timepoint: "activation-ended",
      event: { type: "playerHasBall", playerId: target.id },
      options: planOptions
    });
    const safeTaskOutcomes = evaluateTerminalEvent({ state: playing, input, timepoint: "activation-ended",
      event: { type: "allOf", events: [taskOutcomes.event, { type: "noTurnover" }] }, options: planOptions });
    return {
      engine: META,
      scenario: {
        taskTimepoint: "activation-ended",
        id: method === "pass" ? "pass-and-catch-transfer" : "handoff-and-catch-transfer",
        format,
        method,
        distance: transferDistance,
        pressure,
        weather,
        passer: { id: actor.id, profile: passerProfile },
        receiver: { id: target.id, profile: receiverProfile },
        passerAt,
        receiverAt,
        marker: marker ? { id: marker.id, at: markerAt } : null,
        teamRerolls,
        successEvent: "At the end of the declared Pass or Hand-off Action, the intended receiver holds the ball.",
        assumptions: [
          "Passer and receiver begin standing, stationary, on the same team; passer starts with the ball.",
          pressure === "receiverMarked" ? "One standing opposing reference player marks the receiver but not the passer; any actual pass interception and catch modifiers are resolved by Bloodboard." : "No opposing tackle zones or interceptors are placed in the transfer lane.",
          "The scenario ends after this single transfer action; later activation, movement, and scoring are not included."
        ]
      },
      replay: { state: cloneJson(playing), input: cloneJson(input), inputs: [cloneJson(input), { kind: "endActivation" }], timepoint: "activation-ended" },
      taskOutcomes,
      safeTaskOutcomes,
      ...result
    };
  }

  function calculateOneOnOneBlock({
    attacker,
    defender = { name: "Reference opponent", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    action = "block",
    ballCarrier = "none",
    format = "11s",
    weather = "perfect",
    teamRerolls = 0,
    defenderTeamRerolls = 0,
    starRule = false,
    starTarget,
    attackerAssists = 0,
    defenderAssists = 0,
    defenderSupporters = [],
    attackerSide = "left",
    row,
    planOptions = {},
    includeDefenderStateOutcomes = false,
    includeDefenderPositionRetentionOutcome = false,
    includeDefenderControlZoneOutcome = false,
    controlZoneRadius = 1
  } = {}) {
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be '11s' or 'sevens'.");
    if (action !== "block" && action !== "blitz") throw new Error("action must be 'block' or 'blitz'.");
    if (typeof starRule !== "boolean") throw new TypeError("starRule must be a boolean; optional Star Player rules must be explicitly requested.");
    if (attackerSide !== "left" && attackerSide !== "right") throw new RangeError("attackerSide must be 'left' or 'right'.");
    if (!["none", "attacker", "defender"].includes(ballCarrier)) throw new Error("ballCarrier must be 'none', 'attacker', or 'defender'.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!Number.isInteger(defenderTeamRerolls) || defenderTeamRerolls < 0) throw new RangeError("defenderTeamRerolls must be a non-negative integer.");
    if (!Number.isInteger(attackerAssists) || attackerAssists < 0 || attackerAssists > 2) throw new RangeError("attackerAssists must be an integer from 0 to 2.");
    if (!Number.isInteger(defenderAssists) || defenderAssists < 0 || defenderAssists > 2) throw new RangeError("defenderAssists must be an integer from 0 to 2.");
    if (!Array.isArray(defenderSupporters)) throw new TypeError("defenderSupporters must be an array of declared player profiles and positions.");
    if (defenderSupporters.length + defenderAssists + 1 > (format === "sevens" ? 7 : 11)) throw new RangeError("The declared defender lineup exceeds the selected format's on-pitch limit.");
    if (!Number.isInteger(controlZoneRadius) || controlZoneRadius < 0 || controlZoneRadius > 4) throw new RangeError("controlZoneRadius must be an integer from 0 to 4.");
    const attackerProfile = profileForEngine(engine, attacker);
    const defenderProfile = profileForEngine(engine, defender);
    if (starRule && !attackerProfile.star) {
      throw new Error("An explicitly requested Star Player rule requires a canonical Star Player identity.");
    }
    const ruleset = engine.RULESETS?.[variant];
    if (!ruleset?.pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + variant + ".");
    const width = ruleset.pitch.w;
    const height = ruleset.pitch.h;
    if (!["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    const y = row === undefined ? Math.floor(height / 2) : row;
    if (!Number.isInteger(y) || y < 0 || y >= height) throw new RangeError("row is outside the selected pitch.");
    const targetAt = { x: Math.floor(width / 2), y };
    const attackerAt = { x: targetAt.x + (attackerSide === "left" ? -1 : 1), y };
    const state = engine.newGame({
      a: { name: "Block evaluation team" },
      b: { name: "Block target reference" },
      seed: 1,
      weather
    });
    if (variant === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    state.teams.B.rerolls = defenderTeamRerolls;
    const actor = customScenarioPlayer(engine, state, "A", attackerProfile, attackerAt);
    state.players.push(actor);
    const target = customScenarioPlayer(engine, state, "B", defenderProfile, targetAt);
    state.players.push(target);
    const attackers = Array.from({ length: attackerAssists }, (_, index) => {
      const rowOffset = index === 0 ? -1 : 1;
      const player = customScenarioPlayer(engine, state, "A", profileForEngine(engine, {
        name: `Reference attacker assist ${index + 1}`, position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: []
      }), { x: targetAt.x, y: y + rowOffset });
      state.players.push(player);
      return player;
    });
    const defenders = Array.from({ length: defenderAssists }, (_, index) => {
      const rowOffset = index === 0 ? -1 : 1;
      const player = customScenarioPlayer(engine, state, "B", profileForEngine(engine, {
        name: `Reference defender assist ${index + 1}`, position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: []
      }), { x: attackerAt.x, y: y + rowOffset });
      state.players.push(player);
      return player;
    });
    const usedSquares = new Set([
      `${attackerAt.x},${attackerAt.y}`,
      `${targetAt.x},${targetAt.y}`,
      ...Array.from({ length: attackerAssists }, (_, index) => `${targetAt.x},${y + (index === 0 ? -1 : 1)}`),
      ...Array.from({ length: defenderAssists }, (_, index) => `${attackerAt.x},${y + (index === 0 ? -1 : 1)}`)
    ]);
    const supportProfiles = defenderSupporters.map((entry, index) => {
      const profile = entry && (entry.profile || entry.player || entry);
      const at = entry && entry.at;
      if (!profile || !at || !Number.isInteger(at.x) || !Number.isInteger(at.y) || at.x < 0 || at.x >= width || at.y < 0 || at.y >= height) {
        throw new RangeError(`defenderSupporters[${index}] needs a player profile and an on-pitch integer at square.`);
      }
      const key = `${at.x},${at.y}`;
      if (usedSquares.has(key)) throw new Error("Declared blocker, defender, assists, and supporters cannot share a square.");
      usedSquares.add(key);
      return { profile: profileForEngine(engine, profile), at: { x: at.x, y: at.y } };
    });
    supportProfiles.forEach(({ profile, at }) => {
      const supporter = customScenarioPlayer(engine, state, "B", profile, at);
      state.players.push(supporter);
    });
    if (ballCarrier === "attacker") state.ball = { kind: "held", playerId: actor.id };
    if (ballCarrier === "defender") state.ball = { kind: "held", playerId: target.id };
    const playing = engine.startPlay(state);
    const input = {
      kind: "playerAction",
      playerId: actor.id,
      action,
      path: [],
      blockTarget: target.id,
      ...(action === "blitz" ? { blitzTarget: target.id } : {}),
      ...(starRule ? { starRule: true, ...(starTarget ? { starTarget } : {}) } : {})
    };
    const result = planAction(playing, input, planOptions);
    const output = {
      engine: META,
      scenario: {
        id: "one-on-one-block",
        action,
        format,
        weather,
        attacker: { id: actor.id, profile: attackerProfile },
        defender: { id: target.id, profile: defenderProfile },
        attackerAt,
        defenderAt: targetAt,
        attackerSide,
        ballCarrier,
        attackerAssists,
        defenderAssists,
        defenderSupporters: supportProfiles,
        teamRerolls,
        starRuleUse: starRule ? { requested: true, target: starTarget || null } : { requested: false },
        successEvents: ["defender is knocked down", "defender is removed", "defender is KO'd", "defender suffers a casualty", "attacker is knocked down or removed", "attacker causes a Turnover"],
        assumptions: [`Standing adjacent attacker and defender; one declared ${action === "blitz" ? "Blitz" : "Block"}; declared reference assists, no crowd-push route, and no follow-up action.`, "Assist players are standard ST3 Linemen in fixed nearby squares; the engine determines whether each assist is legal and cancels opposing assists.", "If ballCarrier is set, the held-ball state and any supported ball-carrier reaction are resolved by Bloodboard.", "Bloodboard's block-result chooser and complete armour/injury resolution are used."]
      },
      replay: { state: cloneJson(playing), input: cloneJson(input) },
      ...result
    };
    if (includeDefenderStateOutcomes && result.summary.legal) {
      const eventDefinitions = [
        ["standing", { type: "playerStanding", playerId: target.id }],
        ["prone", { type: "playerProne", playerId: target.id }],
        ["stunned", { type: "playerStunned", playerId: target.id }],
        ["removed", { type: "playerRemoved", playerId: target.id }]
      ];
      const terminalOptions = Object.fromEntries(Object.entries(planOptions)
        .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));
      const evaluations = eventDefinitions.map(([key, event]) => [key,
        evaluateTerminalEvent({ state: playing, input, event, options: terminalOptions })
      ]);
      output.defenderStateOutcomes = {
        status: "engine-enumerated-end-of-block-state-partition",
        timepoint: "after the declared Block and its complete armour/injury resolution",
        events: Object.fromEntries(eventDefinitions),
        withoutTeamRerolls: Object.fromEntries(evaluations.map(([key, evaluation]) => [key, evaluation.withoutTeamRerolls.successProbability])),
        withTeamRerolls: Object.fromEntries(evaluations.map(([key, evaluation]) => [key, evaluation.withTeamRerolls.successProbability]))
      };
    }
    if (includeDefenderPositionRetentionOutcome && result.summary.legal) {
      const eventDefinitions = [
        ["atStartingSquare", { type: "playerAtSquare", playerId: target.id, square: targetAt, stance: "any" }],
        ["standingAtStartingSquare", { type: "playerAtSquare", playerId: target.id, square: targetAt, stance: "standing" }]
      ];
      const terminalOptions = Object.fromEntries(Object.entries(planOptions)
        .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));
      const evaluations = eventDefinitions.map(([key, event]) => [key,
        evaluateTerminalEvent({ state: playing, input, event, options: terminalOptions })
      ]);
      output.positionRetentionOutcomes = {
        status: "engine-enumerated-start-square-retention",
        timepoint: "after the declared Block, push resolution, and complete armour/injury resolution",
        events: Object.fromEntries(eventDefinitions),
        withoutTeamRerolls: Object.fromEntries(evaluations.map(([key, evaluation]) => [key, evaluation.withoutTeamRerolls.successProbability])),
        withTeamRerolls: Object.fromEntries(evaluations.map(([key, evaluation]) => [key, evaluation.withTeamRerolls.successProbability]))
      };
    }
    if (includeDefenderControlZoneOutcome && result.summary.legal) {
      const event = { type: "playerStandingWithin", playerId: target.id, center: targetAt, radius: controlZoneRadius };
      const evaluation = evaluateTerminalEvent({ state: playing, input, event, options: planOptions });
      output.controlZoneOutcomes = {
        status: "engine-enumerated-control-zone-retention",
        timepoint: "after the declared Block, push, and complete armour/injury resolution",
        event,
        withoutTeamRerolls: evaluation.withoutTeamRerolls.successProbability,
        withTeamRerolls: evaluation.withTeamRerolls.successProbability
      };
    }
    return output;
  }

  function calculateCurrentFunctionAfterBlock({
    attacker,
    defender,
    defenderSupporters = [],
    attackerSide = "left",
    format = "11s",
    weather = "perfect",
    attackerTeamRerolls = 0,
    defenderTeamRerolls = 0,
    starRule = false,
    starTarget,
    row,
    destination,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    if (!attacker || !defender) throw new TypeError("Attacker and evaluated defender profiles are required.");
    if (!Number.isInteger(attackerTeamRerolls) || attackerTeamRerolls < 0 || !Number.isInteger(defenderTeamRerolls) || defenderTeamRerolls < 0) {
      throw new RangeError("Both teams' declared reroll pools must be non-negative integers.");
    }
    if (!planOptions || typeof planOptions !== "object" || Array.isArray(planOptions)) throw new TypeError("planOptions must be an object.");
    const unsupportedOptions = Object.keys(planOptions).filter(key => !["threshold", "maxLeaves", "followUp"].includes(key));
    if (unsupportedOptions.length) throw new Error("Unsupported current-function option(s): " + unsupportedOptions.join(", "));
    const dimensions = getPitchDimensions(format);
    const y = row === undefined ? Math.floor(dimensions.height / 2) : row;
    if (!Number.isInteger(y) || y < 0 || y >= dimensions.height) throw new RangeError("row is outside the selected pitch.");
    if (attackerSide !== "left" && attackerSide !== "right") throw new RangeError("attackerSide must be 'left' or 'right'.");
    const defenderAt = { x: Math.floor(dimensions.width / 2), y };
    const attackerAt = { x: defenderAt.x + (attackerSide === "left" ? -1 : 1), y };
    const goal = destination === undefined
      ? { x: defenderAt.x + (attackerSide === "left" ? -5 : 5), y }
      : destination;
    if (!goal || !Number.isInteger(goal.x) || !Number.isInteger(goal.y) || goal.x < 0 || goal.x >= dimensions.width || goal.y < 0 || goal.y >= dimensions.height) {
      throw new RangeError("destination must be an on-pitch integer square.");
    }
    if (goal.x === defenderAt.x && goal.y === defenderAt.y) throw new Error("The declared role-task destination must differ from the player's starting square.");
    if (typeof starRule !== "boolean") throw new TypeError("starRule must be a boolean; optional Star Player rules must be explicitly requested.");
    const withCanonicalStar = (profile, scope) => {
      if (!profile) return profile;
      const starId = assertCanonicalStarRuleIdentity(profile, scope);
      return starId && !profile.star ? { ...profile, star: starId } : profile;
    };
    const modeledAttacker = withCanonicalStar(attacker, "The incoming blocker");
    const modeledDefender = withCanonicalStar(defender, "The evaluated player");
    const modeledSupporters = defenderSupporters.map((entry, index) => {
      if (entry && entry.profile) return { ...entry, profile: withCanonicalStar(entry.profile, `Defender supporter ${index + 1}`) };
      if (entry && entry.player) return { ...entry, player: withCanonicalStar(entry.player, `Defender supporter ${index + 1}`) };
      return withCanonicalStar(entry, `Defender supporter ${index + 1}`);
    });
    const block = calculateOneOnOneBlock({
      attacker: modeledAttacker,
      defender: modeledDefender,
      defenderSupporters: modeledSupporters,
      attackerSide,
      format,
      weather,
      teamRerolls: attackerTeamRerolls,
      defenderTeamRerolls,
      starRule,
      starTarget,
      row,
      planOptions
    });
    if (!block.summary.legal) throw new Error("Bloodboard rejected the incoming Block: " + block.summary.errors.join("; "));
    const initial = cloneJson(block.replay.state);
    const attackerId = block.scenario.attacker.id;
    const defenderId = block.scenario.defender.id;
    const hitInput = cloneJson(block.replay.input);
    const engineOptions = {
      followUp: planOptions.followUp === true,
      threshold: planOptions.threshold === undefined ? 1e-12 : planOptions.threshold,
      maxLeaves: planOptions.maxLeaves === undefined ? 60000 : planOptions.maxLeaves
    };
    if (!Number.isFinite(engineOptions.threshold) || engineOptions.threshold < 0 || engineOptions.threshold > 1e-3) {
      throw new RangeError("planOptions.threshold must be within 0..0.001.");
    }
    if (!Number.isInteger(engineOptions.maxLeaves) || engineOptions.maxLeaves < 1 || engineOptions.maxLeaves > 200000) {
      throw new RangeError("planOptions.maxLeaves must be an integer in 1..200000.");
    }
    const taskEvent = {
      type: "allOf",
      events: [
        { type: "playerAtSquare", playerId: defenderId, square: goal, stance: "standing" },
        { type: "noTurnover" }
      ]
    };
    const newTotals = () => ({
      taskSuccess: 0,
      taskTurnover: 0,
      unresolved: 0,
      actionAvailable: 0,
      routeFound: 0,
      nextTurnStates: { standing: 0, prone: 0, stunned: 0, removed: 0, other: 0 },
      routeSelections: new Map(),
      errors: []
    });
    function probability(mass, unresolved) {
      return { lowerBound: mass, upperBound: Math.min(1, mass + unresolved), exact: unresolved <= 1e-12 };
    }
    function countNextTurnState(state, mass, totals) {
      const player = state.players.find(item => item.id === defenderId);
      if (!player || player.location !== "pitch") return "removed";
      if (player.stance === "stunned" || (state.turn.stunnedAtStart || []).includes(defenderId)) return "stunned";
      if (player.stance === "prone") return "prone";
      if (player.stance === "standing") return "standing";
      return "other";
    }
    function recordNextActivation(state, mass, useTeamRerolls, totals) {
      const stateName = countNextTurnState(state, mass, totals);
      totals.nextTurnStates[stateName] += mass;
      const player = state.players.find(item => item.id === defenderId);
      const cannotActivate = !player || player.location !== "pitch" || player.stance === "stunned" ||
        (state.turn.stunnedAtStart || []).includes(defenderId) || state.turn.active !== "B" || state.phase !== "play";
      if (cannotActivate || !player.pos) return;
      totals.actionAvailable += mass;
      const route = engine.safestRoute(state, defenderId, goal);
      if (!route || !Array.isArray(route.path) || !route.path.length) return;
      totals.routeFound += mass;
      const key = route.path.map(step => `${step.to.x},${step.to.y}`).join("/");
      const selection = totals.routeSelections.get(key) || {
        path: cloneJson(route.path),
        probabilityMass: 0,
        approximatePathSafety: route.pSafe,
        stepCount: route.path.length
      };
      selection.probabilityMass += mass;
      totals.routeSelections.set(key, selection);
      const move = { kind: "playerAction", playerId: defenderId, action: "move", path: cloneJson(route.path) };
      const movement = exploreEndedPlayerAction(state, move, { ...engineOptions, useTeamRerolls }, leaf => {
        if (eventMatches(leaf.state, taskEvent, leaf)) totals.taskSuccess += mass * leaf.p;
        if (leaf.turnover) totals.taskTurnover += mass * leaf.p;
      });
      if (!movement.ok) {
        totals.unresolved += mass;
        totals.errors.push(...movement.errors);
        return;
      }
      totals.unresolved += mass * movement.unresolved;
    }
    function finishAttackerTurn(leaf, mass, useTeamRerolls, totals) {
      const state = leaf.state;
      if (mass <= 1e-15) return;
      if (state.phase !== "play") return;
      if (state.turn.active === "B") {
        recordNextActivation(state, mass, useTeamRerolls, totals);
        return;
      }
      if (state.turn.active !== "A") return;
      if (leaf.turnover && state.turn.activation?.bloodlust === "hungry") {
        // The public preview has not applied the turnover turn transition.
        // Voluntary endTurn would incorrectly bite a Thrall in this branch.
        totals.unresolved += mass;
        totals.errors.push("Incoming Turnover with hungry Bloodlust: exact turnover turn-transition API unavailable; this mass remains unresolved.");
        return;
      }
      const endTurn = engine.exploreOutcomes(cloneJson(state), { kind: "endTurn" }, { ...engineOptions, useTeamRerolls }, leaf => {
        recordNextActivation(leaf.state, mass * leaf.p, useTeamRerolls, totals);
      });
      if (!endTurn.ok) {
        totals.unresolved += mass;
        totals.errors.push(...endTurn.errors);
        return;
      }
      totals.unresolved += mass * endTurn.unresolved;
    }
    function evaluatePolicy(useTeamRerolls) {
      const beforeHit = newTotals();
      const baselineEndTurn = engine.exploreOutcomes(cloneJson(initial), { kind: "endTurn" }, { ...engineOptions, useTeamRerolls }, leaf => {
        recordNextActivation(leaf.state, leaf.p, useTeamRerolls, beforeHit);
      });
      if (!baselineEndTurn.ok) throw new Error("Bloodboard rejected the no-hit baseline turn transition: " + baselineEndTurn.errors.join("; "));
      beforeHit.unresolved += baselineEndTurn.unresolved;

      const afterHit = newTotals();
      const blockEnumeration = engine.exploreOutcomes(cloneJson(initial), hitInput, { ...engineOptions, useTeamRerolls }, leaf => {
        finishAttackerTurn(leaf, leaf.p, useTeamRerolls, afterHit);
      });
      if (!blockEnumeration.ok) throw new Error("Bloodboard rejected an incoming Block branch: " + blockEnumeration.errors.join("; "));
      afterHit.unresolved += blockEnumeration.unresolved;
      const baselineProbability = probability(beforeHit.taskSuccess, beforeHit.unresolved);
      const afterHitProbability = probability(afterHit.taskSuccess, afterHit.unresolved);
      return {
        noHitBaseline: baselineProbability,
        afterIncomingBlock: afterHitProbability,
        deltaFromNoHitBaseline: {
          lowerBound: afterHitProbability.lowerBound - baselineProbability.upperBound,
          upperBound: afterHitProbability.upperBound - baselineProbability.lowerBound,
          exact: baselineProbability.exact && afterHitProbability.exact
        },
        actionAvailableProbability: probability(afterHit.actionAvailable, afterHit.unresolved),
        routeFoundProbability: probability(afterHit.routeFound, afterHit.unresolved),
        taskTurnoverProbability: probability(afterHit.taskTurnover, afterHit.unresolved),
        nextTurnStateDistribution: Object.fromEntries(Object.entries(afterHit.nextTurnStates).map(([key, mass]) => [key, probability(mass, afterHit.unresolved)])),
        routeSelections: [...afterHit.routeSelections.values()].sort((a, b) => a.stepCount - b.stepCount),
        unresolved: afterHit.unresolved,
        errors: [...new Set([...beforeHit.errors, ...afterHit.errors])]
      };
    }
    const policies = {
      withoutTeamRerolls: evaluatePolicy(false),
      withDeclaredTeamRerolls: evaluatePolicy(true)
    };
    return {
      engine: META,
      status: "engine-enumerated-block-to-next-team-turn-role-task",
      scenario: {
        format,
        weather,
        attacker: block.scenario.attacker,
        defender: block.scenario.defender,
        starRuleUse: block.scenario.starRuleUse,
        starRuleAppliedEvents: (block.plan?.traceEvents || []).filter(event =>
          block.scenario.attacker.profile.star && event.data?.star === block.scenario.attacker.profile.star),
        defenderSupporters: block.scenario.defenderSupporters,
        attackerAt: block.scenario.attackerAt,
        defenderAt: block.scenario.defenderAt,
        attackerSide,
        task: { type: "move-to-square", destination: cloneJson(goal), successEvent: taskEvent, timepoint: "after the defender's complete activation, including endActivation; stop at Turnover or touchdown" },
        attackerTeamRerolls,
        defenderTeamRerolls,
        starRuleUse: block.scenario.starRuleUse,
        turnPolicy: "The attacking team ends its turn immediately after the declared Block unless Bloodboard ends it on a Turnover; any Pick-me-up/Stunned-at-start processing then resolves before the defender's next activation.",
        movementRoutePolicy: "Bloodboard safestRoute selects one legal route from that exact next-turn state; actual stand-up, activation, movement, Rush, skill and turnover outcomes are then enumerated by Bloodboard.",
        assumptions: ["No other opposing actions occur after the declared Block.", "The evaluated player attempts the same fixed objective square before and after the hit; by default it lies opposite the push direction so displacement does not artificially improve the task.", "Canonical Star Player identities are passed through; automatic rules resolve in engine state, and any optional activation-start rule is used only when explicitly requested.", "A declared special-rule text without a matching canonical Star identity is rejected rather than silently omitted.", "Incoming hungry Bloodlust plus Turnover cannot be transitioned exactly with the current public preview API; that branch remains unresolved rather than resolving an incorrect voluntary bite."]
      },
      policies
    };
  }

  function calculateTeamStaticCoverageAfterBlock({
    defenders,
    targetPlayerId,
    attacker,
    attackerAt,
    action = "block",
    format = "11s",
    attackerTeamRerolls = 0,
    weather = "perfect",
    exploreOptions = {}
  } = {}) {
    const engine = getEngine();
    const dimensions = getPitchDimensions(format);
    if (!Array.isArray(defenders) || defenders.length < 1) throw new TypeError("A non-empty declared defending lineup is required.");
    if (defenders.length > (format === "sevens" ? 7 : 11)) throw new RangeError("The defending lineup exceeds the selected format's on-pitch limit.");
    if (typeof targetPlayerId !== "string" || !targetPlayerId.trim()) throw new TypeError("A declared targetPlayerId is required.");
    if (action !== "block" && action !== "blitz") throw new RangeError("action must be 'block' or 'blitz'.");
    if (!Number.isInteger(attackerTeamRerolls) || attackerTeamRerolls < 0) throw new RangeError("attackerTeamRerolls must be a non-negative integer.");
    if (!exploreOptions || typeof exploreOptions !== "object" || Array.isArray(exploreOptions)) {
      throw new TypeError("exploreOptions must be an object.");
    }
    const unsupportedOptions = Object.keys(exploreOptions).filter(key => !["threshold", "maxLeaves"].includes(key));
    if (unsupportedOptions.length) throw new Error("Unsupported team static-coverage exploration option(s): " + unsupportedOptions.join(", "));
    if (!Number.isFinite(attackerAt?.x) || !Number.isInteger(attackerAt.x) || !Number.isFinite(attackerAt?.y) || !Number.isInteger(attackerAt.y) ||
        attackerAt.x < 0 || attackerAt.x >= dimensions.width || attackerAt.y < 0 || attackerAt.y >= dimensions.height) {
      throw new RangeError("attackerAt must be an on-pitch integer square.");
    }
    if (!Number.isInteger(exploreOptions.maxLeaves ?? 60000) || (exploreOptions.maxLeaves ?? 60000) < 1 || (exploreOptions.maxLeaves ?? 60000) > 200000) {
      throw new RangeError("exploreOptions.maxLeaves must be an integer in 1..200000.");
    }
    if (!Number.isFinite(exploreOptions.threshold ?? 1e-9) || (exploreOptions.threshold ?? 1e-9) < 0 || (exploreOptions.threshold ?? 1e-9) > 1e-3) {
      throw new RangeError("exploreOptions.threshold must be within 0..0.001.");
    }
    if (![
      "perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"
    ].includes(weather)) throw new Error("weather is not a Bloodboard weather ID.");

    const ids = defenders.map(player => player && player.id);
    if (ids.some(id => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
      throw new TypeError("Every declared defender needs a unique stable string id.");
    }
    const ruleIdentityForEntry = entry => {
      const profile = entry && (entry.profile || entry.player || entry);
      assertCanonicalStarRuleIdentity(profile, "A static-coverage player");
      return profile ? resolveStarId(profile) : null;
    };
    const defenderStarIdByPlayerId = new Map(defenders.map(entry => [entry.id, ruleIdentityForEntry(entry)]));
    const attackerStarId = ruleIdentityForEntry(attacker);
    const skillDefinitions = defenders.flatMap(entry => entry.profile || entry.player || entry).concat([attacker]);
    const unsupportedSkills = [...new Set(skillDefinitions.flatMap(profile => (profile.skills || [])
      .map(skill => typeof skill === "string" ? skill : skill.id)
      .filter(id => id && engine.SKILL_BY_ID[id]?.support === "unsupported")))];
    if (unsupportedSkills.length) {
      throw new Error("Bloodboard does not implement skill(s) required by this static-coverage task: " + unsupportedSkills.join(", "));
    }
    if (!ids.includes(targetPlayerId)) throw new Error("targetPlayerId must identify a player in the declared lineup.");
    const positions = defenders.map(player => player && player.at);
    if (positions.some(at => !at || !Number.isInteger(at.x) || !Number.isInteger(at.y) || at.x < 0 || at.x >= dimensions.width || at.y < 0 || at.y >= dimensions.height)) {
      throw new RangeError("Every defender needs an on-pitch integer at coordinate.");
    }
    const positionKeys = positions.map(at => `${at.x},${at.y}`);
    if (new Set(positionKeys).size !== positionKeys.length) throw new Error("Two defending players cannot share a square.");
    const targetIndex = ids.indexOf(targetPlayerId);
    const targetAt = positions[targetIndex];
    if (Math.max(Math.abs(attackerAt.x - targetAt.x), Math.abs(attackerAt.y - targetAt.y)) !== 1) {
      throw new Error("The attacker must be in a declared adjacent square to the target.");
    }
    const attackerProfile = profileForEngine(engine, attacker);
    if (positionKeys.includes(`${attackerAt.x},${attackerAt.y}`)) throw new Error("The attacker cannot share a square with a defending player.");

    const state = engine.newGame({ a: { name: "Declared defending lineup" }, b: { name: "Declared incoming threat" }, seed: 1, weather });
    if (format === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = 0;
    state.teams.B.rerolls = attackerTeamRerolls;
    const engineIds = new Map();
    defenders.forEach((entry, index) => {
      const definition = entry.profile || entry.player || entry;
      const profile = profileForEngine(engine, definition);
      const player = customScenarioPlayer(engine, state, "A", profile, positions[index]);
      state.players.push(player);
      engineIds.set(entry.id, player.id);
    });
    const targetEngineId = engineIds.get(targetPlayerId);
    const attackerPlayer = customScenarioPlayer(engine, state, "B", attackerProfile, attackerAt);
    state.players.push(attackerPlayer);

    const setupErrors = engine.validateDriveSetup(state, "A").filter(issue => issue.level === "error");
    if (setupErrors.length) {
      return { legal: false, errors: setupErrors.map(issue => issue.text), setupIssues: setupErrors, engine: META };
    }
    state.turn.active = "B";
    const playing = engine.startPlay(state);
    const input = {
      kind: "playerAction",
      playerId: attackerPlayer.id,
      action,
      path: [],
      blockTarget: targetEngineId,
      ...(action === "blitz" ? { blitzTarget: targetEngineId } : {})
    };
    const boardCells = dimensions.width * dimensions.height;
    const beforeZones = teamTackleZoneSquares(playing, "A", dimensions);
    const policies = {};
    for (const [policy, useTeamRerolls] of [["withoutTeamRerolls", false], ["withTeamRerolls", true]]) {
      let expectedCoverageMass = 0;
      let expectedRetainedMass = 0;
      let expectedLostMass = 0;
      let expectedGainedMass = 0;
      let standingTargetMass = 0;
      let targetOnPitchMass = 0;
      let reducedCoverageMass = 0;
      const distribution = new Map();
      const exploration = engine.exploreOutcomes(playing, input, {
        followUp: false,
        useTeamRerolls,
        threshold: exploreOptions.threshold ?? 1e-9,
        maxLeaves: exploreOptions.maxLeaves ?? 60000
      }, leaf => {
        const zones = teamTackleZoneSquares(leaf.state, "A", dimensions);
        const retained = [...beforeZones].filter(square => zones.has(square)).length;
        const lost = beforeZones.size - retained;
        const gained = zones.size - retained;
        const target = leaf.state.players.find(player => player.id === targetEngineId);
        const mass = leaf.p;
        expectedCoverageMass += mass * zones.size;
        expectedRetainedMass += mass * retained;
        expectedLostMass += mass * lost;
        expectedGainedMass += mass * gained;
        if (zones.size < beforeZones.size) reducedCoverageMass += mass;
        if (target && target.location === "pitch") targetOnPitchMass += mass;
        if (target && target.location === "pitch" && target.stance === "standing" && !target.distracted) standingTargetMass += mass;
        const count = distribution.get(zones.size) || 0;
        distribution.set(zones.size, count + mass);
      });
      if (!exploration.ok) {
        return { legal: false, errors: exploration.errors, setupIssues: [], engine: META, scenario: { action, format, targetPlayerId, attackerAt } };
      }
      const unresolved = Math.max(0, exploration.unresolved);
      const bounds = (mass, maxValue) => {
        const lowerBound = mass;
        const upperBound = mass + unresolved * maxValue;
        const exact = unresolved <= 1e-12;
        return { value: exact ? mass : null, lowerBound, upperBound, exact, unresolved };
      };
      policies[policy] = {
        expectedUniqueTackleZoneSquares: bounds(expectedCoverageMass, boardCells),
        expectedInitiallyCoveredSquaresRetained: bounds(expectedRetainedMass, beforeZones.size),
        expectedInitiallyCoveredSquaresLost: bounds(expectedLostMass, beforeZones.size),
        expectedNewlyCoveredSquares: bounds(expectedGainedMass, boardCells),
        probabilityCoverageCountFalls: bounds(reducedCoverageMass, 1),
        targetStandingWithTackleZone: bounds(standingTargetMass, 1),
        targetRemainsOnPitch: bounds(targetOnPitchMass, 1),
        coverageCountDistribution: Object.fromEntries([...distribution.entries()].sort((a, b) => a[0] - b[0]).map(([count, probability]) => [String(count), {
          lowerBound: probability,
          upperBound: probability + unresolved,
          exact: unresolved <= 1e-12
        }])),
        explored: exploration.explored,
        leaves: exploration.leaves,
        unresolved
      };
    }
    return {
      legal: true,
      errors: [],
      setupIssues: [],
      engine: META,
      scenario: {
        id: "declared-legal-formation-single-incoming-block",
        format,
        weather,
        action,
        targetPlayerId,
        targetSquare: targetAt,
        attacker: { profile: attackerProfile, at: attackerAt },
        attackerStarId,
        attackerTeamRerolls,
        defendingLineup: defenders.map((player, index) => ({ playerId: player.id, enginePlayerId: engineIds.get(player.id), starId: defenderStarIdByPlayerId.get(player.id) || null, at: positions[index], skills: (player.profile || player.player || player).skills || [] })),
        setupValidatedBy: "Bloodboard validateDriveSetup",
        followUp: false,
        coverageDefinition: "unique on-pitch squares adjacent to at least one standing, non-distracted defending player; occupied player squares are excluded; pitch edges are clipped",
        exactTerminalCalculation: "For each Bloodboard terminal state, recompute the union of all defending players' tackle-zone squares and aggregate by terminal probability.",
        assumptions: [
          "The defending lineup is a legal starting setup; the single opposing attacker represents a post-movement adjacent threat, not a complete opposing starting formation.",
          "All declared defenders stay in their setup squares; Bloodboard resolves actual defensive assists, selected Block dice, skills, armour/injury, and any legal reroll use for the one declared action.",
          "Canonical Star Player identities are passed to Bloodboard, which resolves automatic effects for this action. Optional activation-start Star rules are not requested by this single incoming-threat task.",
          "No crowd-push route, follow-up, further action, or team-wide action-selection policy is modeled."
        ]
      },
      initialUniqueTackleZoneSquares: beforeZones.size,
      initialTackleZoneSquares: [...beforeZones].sort((a, b) => {
        const [ax, ay] = a.split(",").map(Number);
        const [bx, by] = b.split(",").map(Number);
        return ay - by || ax - bx;
      }).map(square => {
        const [x, y] = square.split(",").map(Number);
        return { x, y };
      }),
      byRerollPolicy: policies,
      replay: { state: cloneJson(playing), input: cloneJson(input) }
    };
  }

  function calculateOneOnOneFoul({
    fouler,
    target = { name: "Reference prone target", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    targetStance = "prone",
    format = "11s",
    weather = "perfect",
    teamRerolls = 0,
    foulerAssists = 0,
    targetAssists = 0,
    useChainsaw = false,
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be 'sevens' or '11s'.");
    if (targetStance !== "prone" && targetStance !== "stunned") throw new Error("targetStance must be 'prone' or 'stunned'.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!Number.isInteger(foulerAssists) || foulerAssists < 0 || foulerAssists > 2) throw new RangeError("foulerAssists must be an integer from 0 to 2.");
    if (!Number.isInteger(targetAssists) || targetAssists < 0 || targetAssists > 2) throw new RangeError("targetAssists must be an integer from 0 to 2.");
    const foulerProfile = profileForEngine(engine, fouler);
    const targetProfile = profileForEngine(engine, target);
    if (useChainsaw && !foulerProfile.skills.some(skill => skill.id === "chainsaw")) {
      throw new Error("Only a player with Chainsaw can use a chainsaw for the Foul.");
    }
    const ruleset = engine.RULESETS?.[variant];
    if (!ruleset?.pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + variant + ".");
    const width = ruleset.pitch.w;
    const height = ruleset.pitch.h;
    if (!["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    const y = row === undefined ? Math.floor(height / 2) : row;
    if (!Number.isInteger(y) || y < 1 || y >= height - 1) throw new RangeError("row must leave room for the declared foul assists.");
    const targetAt = { x: Math.floor(width / 2), y };
    const foulerAt = { x: targetAt.x - 1, y };
    const state = engine.newGame({
      a: { name: "Foul evaluation team" },
      b: { name: "Foul target reference" },
      seed: 1,
      weather
    });
    if (variant === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    const actor = customScenarioPlayer(engine, state, "A", foulerProfile, foulerAt);
    state.players.push(actor);
    const victim = customScenarioPlayer(engine, state, "B", targetProfile, targetAt);
    state.players.push(victim);
    victim.stance = targetStance;
    const offensiveHelpers = Array.from({ length: foulerAssists }, (_, index) => {
      const rowOffset = index === 0 ? -1 : 1;
      const player = customScenarioPlayer(engine, state, "A", profileForEngine(engine, {
        name: `Reference foul assist ${index + 1}`, position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: []
      }), { x: targetAt.x, y: y + rowOffset });
      state.players.push(player);
      return player;
    });
    const defensiveHelpers = Array.from({ length: targetAssists }, (_, index) => {
      const rowOffset = index === 0 ? -1 : 1;
      const player = customScenarioPlayer(engine, state, "B", profileForEngine(engine, {
        name: `Reference target assist ${index + 1}`, position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: []
      }), { x: foulerAt.x, y: y + rowOffset });
      state.players.push(player);
      return player;
    });
    const playing = engine.startPlay(state);
    const input = { kind: "playerAction", playerId: actor.id, action: "foul", path: [], foulTarget: victim.id, ...(useChainsaw ? { useChainsaw: true } : {}) };
    const result = planAction(playing, input, planOptions);
    const output = {
      engine: META,
      scenario: {
        taskTimepoint: "activation-ended",
        id: "one-on-one-foul",
        format,
        weather,
        fouler: { id: actor.id, profile: foulerProfile },
        target: { id: victim.id, profile: targetProfile, stance: targetStance },
        foulerAt,
        targetAt,
        foulerAssists,
        targetAssists,
        useChainsaw,
        teamRerolls,
        assumptions: [
          "The fouler starts Standing and adjacent to a target that is already Prone or Stunned; creating the target state is outside this conditional task.",
          "Assist players are standard ST3 Linemen in fixed adjacent squares; Bloodboard determines which assists are legal.",
          "No inducements, Bribes, Prayer effects, paired-Star rules, prior Foul Action, or whole-turn sequence is present.",
          "Rule-triggered choices use Bloodboard's default plan policy; the engine resolves armour/injury rolls, Dirty Player, Lone Fouler, Sneaky Git, send-off/Turnover consequences, and Chainsaw kick-back/+3 Armour when declared."
        ]
      },
      replay: { state: cloneJson(playing), input: cloneJson(input), inputs: [cloneJson(input), { kind: "endActivation" }], timepoint: "activation-ended" },
      ...result
    };
    if (result.summary.legal) {
      const events = {
        targetRemoved: { type: "playerRemoved", playerId: victim.id },
        safeTargetRemoval: { type: "allOf", events: [{ type: "playerRemoved", playerId: victim.id }, { type: "noTurnover" }] },
        unsafeTargetRemoval: { type: "allOf", events: [{ type: "playerRemoved", playerId: victim.id }, { type: "turnover" }] },
        foulerSentOff: { type: "playerSentOff", playerId: actor.id },
        targetRemovedAndFoulerSentOff: { type: "allOf", events: [{ type: "playerRemoved", playerId: victim.id }, { type: "playerSentOff", playerId: actor.id }] }
      };
      const terminalOptions = Object.fromEntries(Object.entries(planOptions)
        .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));
      const terminalResults = Object.fromEntries(Object.entries(events).map(([id, event]) => [id,
        evaluateTerminalEvent({ state: playing, input, event, timepoint: "activation-ended", options: terminalOptions })
      ]));
      const branches = teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"];
      output.events = events;
      output.outcomes = Object.fromEntries(branches.map(branch => [branch, Object.fromEntries(
        Object.entries(terminalResults).map(([id, evaluation]) => [id, evaluation[branch].successProbability])
      )]));
      output.turnoverProbability = Object.fromEntries(branches.map(branch => [branch, terminalResults.targetRemoved[branch].turnoverProbability]));
    }
    return output;
  }

  function evaluateSecretWeaponEndDrive(engine, terminalStates, playerId) {
    const cache = new Map();
    const totals = {
      secretWeaponSentOffAtDriveEnd: 0,
      availableNextDrive: 0,
      stillKnockedOutNextDrive: 0,
      bribesSpentAtDriveEnd: new Map()
    };
    for (const { state: sourceState, mass } of terminalStates) {
      const actor = sourceState.players.find(player => player.id === playerId);
      if (!actor || !actor.inDrive || !actor.skills.some(skill => skill.id === "secretWeapon")) continue;
      const initiallySentOff = actor.location === "sentOff";
      const cacheKey = JSON.stringify({
        location: actor.location,
        star: actor.star || null,
        starUsed: actor.starUsed || [],
        bribes: sourceState.match?.bribes?.A || 0,
        coachEjected: !!sourceState.match?.coachEjected?.A,
        briberyUsed: !!sourceState.teams?.A?.briberyUsed,
        teamRules: sourceState.teams?.A?.specialRules || []
      });
      let result = cache.get(cacheKey);
      if (!result) {
        if (initiallySentOff) {
          result = { sentOffAtDriveEnd: 0, availableNextDrive: 0, stillKnockedOutNextDrive: 0, bribesSpent: new Map([[0, 1]]), branches: 0 };
        } else {
          // Only the focal player's availability is measured. Clearing unrelated KO players avoids
          // spending enumeration budget on independent recovery rolls that cannot change this event.
          const base = cloneJson(sourceState);
          for (const player of base.players) {
            if (player.id === playerId || player.location !== "ko") continue;
            player.location = "reserves";
            player.pos = null;
          }
          base.phase = "halfOver";
          base.weather = "perfect";
          base.match.driveMods = [];
          const maxD6 = 4; // Argue, optional Bribery & Corruption reroll, Bribe, and focal KO recovery.
          const combinations = 6 ** maxD6;
          let sentOffAtDriveEnd = 0;
          let availableNextDrive = 0;
          let stillKnockedOutNextDrive = 0;
          const bribesSpent = new Map();
          for (let code = 0; code < combinations; code++) {
            let value = code;
            const faces = Array.from({ length: maxD6 }, () => {
              const face = (value % 6) + 1;
              value = Math.floor(value / 6);
              return face;
            });
            const dice = () => new engine.ScriptedDice(faces);
            let execution = engine.execute(base, { kind: "nextDrive" }, undefined, dice);
            let decisionCount = 0;
            while (execution.status === "awaitingDecision") {
              if (++decisionCount > 8) throw new Error("Too many engine decisions while resolving a Secret Weapon at Drive end.");
              const optionId = engine.previewDecision(execution.state, execution.decision);
              execution = engine.decide(execution.state, { requestId: execution.decision.id, optionId }, dice);
            }
            if (execution.status === "illegal") throw new Error("Bloodboard rejected the Drive-end Secret Weapon scenario: " + execution.error);
            const finalActor = execution.state.players.find(player => player.id === playerId);
            if (!finalActor) throw new Error("Bloodboard lost the Secret Weapon player while resolving the Drive end.");
            const p = 1 / combinations;
            if (finalActor.location === "sentOff") sentOffAtDriveEnd += p;
            if (finalActor.location === "reserves") availableNextDrive += p;
            if (finalActor.location === "ko") stillKnockedOutNextDrive += p;
            const spent = Math.max(0, (base.match.bribes.A || 0) - (execution.state.match?.bribes?.A || 0));
            bribesSpent.set(spent, (bribesSpent.get(spent) || 0) + p);
          }
          result = { sentOffAtDriveEnd, availableNextDrive, stillKnockedOutNextDrive, bribesSpent, branches: combinations };
        }
        cache.set(cacheKey, result);
      }
      totals.secretWeaponSentOffAtDriveEnd += mass * result.sentOffAtDriveEnd;
      totals.availableNextDrive += mass * result.availableNextDrive;
      totals.stillKnockedOutNextDrive += mass * result.stillKnockedOutNextDrive;
      for (const [spent, probability] of result.bribesSpent) {
        totals.bribesSpentAtDriveEnd.set(spent, (totals.bribesSpentAtDriveEnd.get(spent) || 0) + mass * probability);
      }
    }
    const totalMass = terminalStates.reduce((sum, entry) => sum + entry.mass, 0);
    if (!totalMass) return { exact: true, conditionalExact: true, applicableMass: 0, reason: "No terminal action-chain states were available." };
    const applicableMass = terminalStates.reduce((sum, entry) => {
      const player = entry.state.players.find(item => item.id === playerId);
      return sum + (player?.inDrive && player.skills.some(skill => skill.id === "secretWeapon") ? entry.mass : 0);
    }, 0);
    const unresolved = Math.max(0, 1 - applicableMass);
    const enumeratedDiceBranches = [...cache.values()].reduce((sum, result) => sum + result.branches, 0);
    return {
      exact: unresolved <= 1e-12,
      conditionalExact: true,
      subjectPlayerId: playerId,
      applicableMass,
      sentOffAtDriveEnd: totals.secretWeaponSentOffAtDriveEnd,
      sentOffAtDriveEndBounds: { lowerBound: totals.secretWeaponSentOffAtDriveEnd, upperBound: Math.min(1, totals.secretWeaponSentOffAtDriveEnd + unresolved) },
      availableNextDrive: totals.availableNextDrive,
      availableNextDriveBounds: { lowerBound: totals.availableNextDrive, upperBound: Math.min(1, totals.availableNextDrive + unresolved) },
      stillKnockedOutNextDrive: totals.stillKnockedOutNextDrive,
      bribesSpentAtDriveEnd: Object.fromEntries([...totals.bribesSpentAtDriveEnd].sort((a, b) => a[0] - b[0])),
      unresolvedFromActionChain: unresolved,
      enumeratedDiceBranches,
      policy: "Bloodboard preview decision policy; irrelevant non-focal Knocked-out-player recovery rolls are omitted after setting those players to Reserves.",
      totalActionChainMass: totalMass
    };
  }

  function calculateBlockThenFoul({
    blocker = { name: "Reference blocker", position: "Blitzer", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    fouler = { name: "Reference fouler", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
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
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be 'sevens' or '11s'.");
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!Number.isInteger(bribes) || bribes < 0 || bribes > 6) throw new RangeError("bribes must be an integer from 0 to 6.");
    if (format === "sevens" && bribes > 0) throw new Error("Bribes are not available in the current Bloodboard Sevens inducement model.");
    if (!Array.isArray(teamSpecialRules) || teamSpecialRules.some(rule => typeof rule !== "string" || !rule.trim())) {
      throw new TypeError("teamSpecialRules must be an array of Bloodboard team-rule names.");
    }
    if (!["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    const blockerProfile = profileForEngine(engine, blocker);
    const foulerProfile = profileForEngine(engine, fouler);
    const extraFoulerProfile = extraFouler ? profileForEngine(engine, extraFouler) : null;
    const targetProfile = profileForEngine(engine, target);
    if (useChainsaw && !foulerProfile.skills.some(skill => skill.id === "chainsaw")) {
      throw new Error("Only a player with Chainsaw can use a chainsaw for the Foul.");
    }
    if (extraFoulerProfile && foulerProfile.star !== "blackGobbo" && extraFoulerProfile.star !== "blackGobbo") {
      throw new Error("A second Foul Action is only implemented when either the first or second fouler is the Black Gobbo.");
    }
    if (foulerProfile.star === "blackGobbo" && extraFoulerProfile?.star === "blackGobbo") {
      throw new Error("One Black Gobbo cannot declare both Foul Actions in this one-turn prototype.");
    }
    const roster = teamRosterId ? engine.ROSTER_BY_ID?.[teamRosterId] : null;
    if (teamRosterId && !roster) throw new Error("Unknown Bloodboard team roster ID: " + teamRosterId);
    const resolvedTeamSpecialRules = [...new Set(teamSpecialRules.length ? teamSpecialRules : roster?.specialRules || [])];
    const supportedTeamRules = new Set(["Bribery and Corruption"]);
    const unsupportedTeamRules = resolvedTeamSpecialRules.filter(rule => !supportedTeamRules.has(rule));
    if (unsupportedTeamRules.length) {
      throw new Error("This team action-chain prototype only resolves the team rule 'Bribery and Corruption'; unsupported rule(s): " + unsupportedTeamRules.join(", "));
    }
    const hasBriberyAndCorruption = resolvedTeamSpecialRules.includes("Bribery and Corruption");
    const bribeRule = engine.INDUCEMENT_BY_ID?.bribe;
    const maxBribes = bribeRule ? bribeRule.max(resolvedTeamSpecialRules, roster) : (hasBriberyAndCorruption ? 6 : 3);
    const bribeUnitCost = bribeRule ? bribeRule.cost(resolvedTeamSpecialRules, roster) : (hasBriberyAndCorruption ? 50000 : 100000);
    if (bribes > maxBribes) throw new RangeError("This team may take at most " + maxBribes + " Bribe(s) under its declared team-rule context.");
    const secretWeaponParticipants = [blockerProfile, foulerProfile, extraFoulerProfile]
      .filter(Boolean)
      .filter(profile => profile.skills.some(skill => skill.id === "secretWeapon"));
    if (targetProfile.skills.some(skill => skill.id === "secretWeapon")) {
      throw new Error("Drive-end Secret Weapon resolution in this prototype only supports the attacking team's single participant; an opposing Secret Weapon would require a two-team match context.");
    }
    if (secretWeaponParticipants.length > 1) {
      throw new Error("Exact Drive-end Secret Weapon resolution currently supports one Secret Weapon participant in this fixed action-chain scenario.");
    }
    const pitch = engine.RULESETS?.[variant]?.pitch;
    if (!pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + format + ".");
    const y = row === undefined ? Math.floor(pitch.h / 2) : row;
    if (!Number.isInteger(y) || y < 2 || y >= pitch.h - 1) {
      throw new RangeError("row must leave room for the fixed blocker/fouler setup.");
    }
    const targetAt = { x: Math.floor(pitch.w / 2), y };
    const blockerAt = { x: targetAt.x - 1, y };
    // The fouler begins diagonally adjacent to the standing target. If the
    // Block knocks the target down in place, the Foul Action is available.
    const foulerAt = { x: targetAt.x, y: y - 1 };
    const extraFoulerAt = extraFoulerProfile ? { x: targetAt.x + 1, y: y - 1 } : null;
    if (extraFoulerAt && extraFoulerAt.x >= pitch.w) throw new RangeError("The selected row leaves no legal square for the Black Gobbo.");
    const state = engine.newGame({
      a: { name: "Block-then-foul evaluation team" },
      b: { name: "Block-then-foul target" },
      seed: 1,
      weather
    });
    if (variant === "sevens") state.variant = "sevens";
    state.teams.A.rerolls = teamRerolls;
    state.teams.A.specialRules = resolvedTeamSpecialRules;
    state.teams.A.briberyUsed = false;
    state.match = {
      kind: "tournament",
      options: { rules: "full", play: "exhibition" },
      teamIds: { A: "evaluation-team", B: "evaluation-opponent" },
      rosterRerolls: { A: teamRerolls, B: 0 },
      dedicatedFans: { A: 0, B: 0 },
      assistantCoaches: { A: 0, B: 0 },
      cheerleaders: { A: 0, B: 0 },
      half: 1,
      receivedFirst: "A",
      kicking: "A",
      drive: 1,
      setupDone: { A: true, B: true },
      bribes: { A: bribes, B: 0 },
      coachEjected: { A: false, B: false },
      driveMods: []
    };
    const blockerActor = customScenarioPlayer(engine, state, "A", blockerProfile, blockerAt);
    blockerActor.inDrive = true;
    state.players.push(blockerActor);
    const foulerActor = customScenarioPlayer(engine, state, "A", foulerProfile, foulerAt);
    foulerActor.inDrive = true;
    if (foulerProfile.star) foulerActor.star = foulerProfile.star;
    state.players.push(foulerActor);
    let extraFoulerActor = null;
    if (extraFoulerProfile) {
      extraFoulerActor = customScenarioPlayer(engine, state, "A", extraFoulerProfile, extraFoulerAt);
      extraFoulerActor.inDrive = true;
      extraFoulerActor.star = extraFoulerProfile.star;
      state.players.push(extraFoulerActor);
    }
    const victim = customScenarioPlayer(engine, state, "B", targetProfile, targetAt);
    victim.inDrive = true;
    state.players.push(victim);
    const playing = engine.startPlay(state);
    const blockInput = { kind: "playerAction", playerId: blockerActor.id, action: "block", path: [], blockTarget: victim.id };
    const foulInput = { kind: "playerAction", playerId: foulerActor.id, action: "foul", path: [], foulTarget: victim.id, ...(useChainsaw ? { useChainsaw: true } : {}) };
    const extraFoulInput = extraFoulerActor
      ? { kind: "playerAction", playerId: extraFoulerActor.id, action: "foul", path: [], foulTarget: victim.id }
      : null;
    const secretWeaponActor = [
      [blockerProfile, blockerActor],
      [foulerProfile, foulerActor],
      [extraFoulerProfile, extraFoulerActor]
    ].find(([profile]) => profile?.skills.some(skill => skill.id === "secretWeapon"))?.[1];
    const explorationOptions = Object.fromEntries(Object.entries(planOptions || {})
      .filter(([key]) => ["threshold", "maxLeaves", "followUp"].includes(key)));
    const branches = {};
    const evaluate = useTeamRerolls => {
      const initial = [];
      const blockEnumeration = exploreEndedPlayerAction(playing, blockInput, {
        ...explorationOptions,
        useTeamRerolls
      }, leaf => initial.push(leaf));
      if (!blockEnumeration.ok) throw new Error("Bloodboard rejected the first Block in the team kill chain: " + blockEnumeration.errors.join("; "));

      const totals = {
        blockTargetRemoved: 0,
        blockSafeRemoval: 0,
        blockTurnover: 0,
        targetDownAfterBlock: 0,
        foulOpportunity: 0,
        foulTargetRemoved: 0,
        foulSafeRemoval: 0,
        foulerSentOff: 0,
        foulerDownAfterFoul: 0,
        targetAndFoulerBothRemoved: 0,
      foulTurnover: 0,
      extraFoulOpportunity: 0,
      extraFoulTargetRemoved: 0,
      extraFoulSafeRemoval: 0,
      extraFoulerSentOff: 0,
      extraFoulTurnover: 0,
      targetRemovedByChain: 0,
      safeRemovalByChain: 0,
        teamTurnover: 0,
        unresolved: blockEnumeration.unresolved,
        expandedStates: blockEnumeration.explored,
        foulEnumerations: 0,
        illegalFoulBranches: 0,
        rerollMass: new Map()
      };
      const terminalStates = [];
      const bribeMass = new Map();
      const addRerollMass = (leaf, mass) => {
        const remaining = Math.max(0, Number(leaf.state.teams?.A?.rerolls) || 0);
        totals.rerollMass.set(remaining, (totals.rerollMass.get(remaining) || 0) + mass);
      };
      const keepTerminal = (leaf, mass) => {
        if (secretWeaponActor) terminalStates.push({ state: leaf.state, mass, turnover: !!leaf.turnover });
        const remaining = Math.max(0, Number(leaf.state.match?.bribes?.A) || 0);
        bribeMass.set(remaining, (bribeMass.get(remaining) || 0) + mass);
      };

      initial.forEach(blockLeaf => {
        const blockMass = blockLeaf.p;
        const blockedTarget = blockLeaf.state.players.find(player => player.id === victim.id);
        if (!blockedTarget) throw new Error("Bloodboard lost the declared target in a Block branch.");
        const removedByBlock = blockedTarget.location !== "pitch";
        if (removedByBlock) {
          totals.blockTargetRemoved += blockMass;
          totals.targetRemovedByChain += blockMass;
          if (!blockLeaf.turnover) {
            totals.blockSafeRemoval += blockMass;
            totals.safeRemovalByChain += blockMass;
          }
        }
        if (blockLeaf.turnover) {
          totals.blockTurnover += blockMass;
          totals.teamTurnover += blockMass;
          addRerollMass(blockLeaf, blockMass);
          keepTerminal(blockLeaf, blockMass);
          return;
        }
        if (removedByBlock) {
          addRerollMass(blockLeaf, blockMass);
          keepTerminal(blockLeaf, blockMass);
          return;
        }
        if (blockedTarget.stance !== "prone" && blockedTarget.stance !== "stunned") {
          addRerollMass(blockLeaf, blockMass);
          keepTerminal(blockLeaf, blockMass);
          return;
        }
        totals.targetDownAfterBlock += blockMass;
        const legalTargets = engine.foulTargets(blockLeaf.state, blockLeaf.state.players.find(player => player.id === foulerActor.id));
        if (!legalTargets.some(player => player.id === victim.id)) {
          addRerollMass(blockLeaf, blockMass);
          keepTerminal(blockLeaf, blockMass);
          return;
        }
        const foulErrors = engine.validateInput(blockLeaf.state, foulInput);
        if (foulErrors.length) {
          totals.illegalFoulBranches += blockMass;
          throw new Error("A generated legal foul opportunity failed Bloodboard validation: " + foulErrors.join("; "));
        }
        totals.foulOpportunity += blockMass;
        totals.foulEnumerations++;
        const foulLeaves = [];
        const foulEnumeration = exploreEndedPlayerAction(blockLeaf.state, foulInput, {
          ...explorationOptions,
          useTeamRerolls
        }, leaf => foulLeaves.push(leaf));
        if (!foulEnumeration.ok) throw new Error("Bloodboard rejected the conditional Foul Action: " + foulEnumeration.errors.join("; "));
        totals.unresolved += blockMass * foulEnumeration.unresolved;
        totals.expandedStates += blockMass * foulEnumeration.explored;
        foulLeaves.forEach(foulLeaf => {
          const mass = blockMass * foulLeaf.p;
          const finalTarget = foulLeaf.state.players.find(player => player.id === victim.id);
          const finalFouler = foulLeaf.state.players.find(player => player.id === foulerActor.id);
          if (!finalTarget || !finalFouler) throw new Error("Bloodboard lost a player in the Foul Action branch.");
          const removed = finalTarget.location !== "pitch";
          if (removed) {
            totals.foulTargetRemoved += mass;
            totals.targetRemovedByChain += mass;
          }
          if (removed && !foulLeaf.turnover) {
            totals.foulSafeRemoval += mass;
            totals.safeRemovalByChain += mass;
          }
          if (finalFouler.location === "sentOff") totals.foulerSentOff += mass;
          if (finalFouler.location === "pitch" && finalFouler.stance !== "standing") totals.foulerDownAfterFoul += mass;
          if (removed && finalFouler.location !== "pitch") totals.targetAndFoulerBothRemoved += mass;
          if (foulLeaf.turnover) {
            totals.foulTurnover += mass;
            totals.teamTurnover += mass;
            addRerollMass(foulLeaf, mass);
            keepTerminal(foulLeaf, mass);
            return;
          }
          if (!extraFoulerActor || finalTarget.location !== "pitch" || (finalTarget.stance !== "prone" && finalTarget.stance !== "stunned")) {
            addRerollMass(foulLeaf, mass);
            keepTerminal(foulLeaf, mass);
            return;
          }
          const blackGobboAvailable = foulLeaf.state.players.some(player => player.team === "A" && player.star === "blackGobbo" && player.location === "pitch");
          if (!blackGobboAvailable) {
            addRerollMass(foulLeaf, mass);
            keepTerminal(foulLeaf, mass);
            return;
          }
          const extraActor = foulLeaf.state.players.find(player => player.id === extraFoulerActor.id);
          const extraLegalTargets = engine.foulTargets(foulLeaf.state, extraActor);
          if (!extraLegalTargets.some(player => player.id === victim.id)) {
            addRerollMass(foulLeaf, mass);
            keepTerminal(foulLeaf, mass);
            return;
          }
          const extraFoulErrors = engine.validateInput(foulLeaf.state, extraFoulInput);
          if (extraFoulErrors.length) {
            totals.illegalFoulBranches += mass;
            throw new Error("A generated legal Black Gobbo second Foul Action failed Bloodboard validation: " + extraFoulErrors.join("; "));
          }
          totals.extraFoulOpportunity += mass;
          totals.foulEnumerations++;
          const extraFoulLeaves = [];
          const extraFoulEnumeration = exploreEndedPlayerAction(foulLeaf.state, extraFoulInput, {
            ...explorationOptions,
            useTeamRerolls
          }, leaf => extraFoulLeaves.push(leaf));
          if (!extraFoulEnumeration.ok) throw new Error("Bloodboard rejected the Black Gobbo second Foul Action: " + extraFoulEnumeration.errors.join("; "));
          totals.unresolved += mass * extraFoulEnumeration.unresolved;
          totals.expandedStates += mass * extraFoulEnumeration.explored;
          extraFoulLeaves.forEach(extraLeaf => {
            const extraMass = mass * extraLeaf.p;
            const targetAfterExtra = extraLeaf.state.players.find(player => player.id === victim.id);
            const gobboAfterExtra = extraLeaf.state.players.find(player => player.id === extraFoulerActor.id);
            if (!targetAfterExtra || !gobboAfterExtra) throw new Error("Bloodboard lost a player in the Black Gobbo second Foul Action branch.");
            const removedAfterExtra = targetAfterExtra.location !== "pitch";
            if (removedAfterExtra) {
              totals.extraFoulTargetRemoved += extraMass;
              totals.targetRemovedByChain += extraMass;
            }
            if (removedAfterExtra && !extraLeaf.turnover) {
              totals.extraFoulSafeRemoval += extraMass;
              totals.safeRemovalByChain += extraMass;
            }
            if (gobboAfterExtra.location === "sentOff") totals.extraFoulerSentOff += extraMass;
            if (extraLeaf.turnover) {
              totals.extraFoulTurnover += extraMass;
              totals.teamTurnover += extraMass;
            }
            addRerollMass(extraLeaf, extraMass);
            keepTerminal(extraLeaf, extraMass);
          });
        });
      });

      const driveEnd = secretWeaponActor
        ? evaluateSecretWeaponEndDrive(engine, terminalStates, secretWeaponActor.id)
        : null;

      const bounded = value => ({
        lowerBound: value,
        upperBound: Math.min(1, value + totals.unresolved),
        exact: totals.unresolved <= 1e-12
      });
      return {
        legal: totals.illegalFoulBranches <= 1e-12,
        outcomes: {
          blockTargetRemoved: bounded(totals.blockTargetRemoved),
          blockSafeRemoval: bounded(totals.blockSafeRemoval),
          targetDownAfterBlock: bounded(totals.targetDownAfterBlock),
          foulOpportunity: bounded(totals.foulOpportunity),
          foulTargetRemoved: bounded(totals.foulTargetRemoved),
          foulSafeRemoval: bounded(totals.foulSafeRemoval),
          foulerSentOff: bounded(totals.foulerSentOff),
          foulerDownAfterFoul: bounded(totals.foulerDownAfterFoul),
          targetAndFoulerBothRemoved: bounded(totals.targetAndFoulerBothRemoved),
          foulTurnover: bounded(totals.foulTurnover),
          extraFoulOpportunity: bounded(totals.extraFoulOpportunity),
          extraFoulTargetRemoved: bounded(totals.extraFoulTargetRemoved),
          extraFoulSafeRemoval: bounded(totals.extraFoulSafeRemoval),
          extraFoulerSentOff: bounded(totals.extraFoulerSentOff),
          extraFoulTurnover: bounded(totals.extraFoulTurnover),
          targetRemovedByChain: bounded(totals.targetRemovedByChain),
          safeRemovalByChain: bounded(totals.safeRemovalByChain),
          teamTurnover: bounded(totals.teamTurnover)
        },
        remainingTeamRerolls: Object.fromEntries([...totals.rerollMass].sort((a, b) => a[0] - b[0])),
        remainingBribes: Object.fromEntries([...bribeMass].sort((a, b) => a[0] - b[0])),
        driveEnd,
        unresolved: totals.unresolved,
        expandedStates: totals.expandedStates,
        foulEnumerations: totals.foulEnumerations,
        illegalFoulBranches: totals.illegalFoulBranches
      };
    };

    branches.withoutTeamRerolls = evaluate(false);
    if (teamRerolls > 0) branches.withTeamRerolls = evaluate(true);
    return {
      engine: META,
      status: Object.values(branches).every(branch => branch.legal)
        ? "engine-enumerated-conditional-block-then-foul-chain"
        : "team-block-foul-chain-has-invalid-branches",
      scenario: {
        taskTimepoint: "after each player activation ends; stop at Turnover or touchdown before attempting another action",
        id: extraFoulerProfile ? "standing-target-block-then-conditional-double-foul" : "standing-target-block-then-conditional-foul",
        format,
        weather,
        blocker: { id: blockerActor.id, profile: blockerProfile, at: blockerAt, cost: Number.isFinite(blocker.cost) ? blocker.cost : null },
        fouler: { id: foulerActor.id, profile: foulerProfile, at: foulerAt, cost: Number.isFinite(fouler.cost) ? fouler.cost : null },
        extraFouler: extraFoulerActor ? { id: extraFoulerActor.id, profile: extraFoulerProfile, at: extraFoulerAt, cost: Number.isFinite(extraFouler.cost) ? extraFouler.cost : null } : null,
        target: { id: victim.id, profile: targetProfile, at: targetAt, startsStanding: true },
        teamRerolls,
        foulUsesChainsaw: useChainsaw,
        actions: [blockInput, { kind: "endActivation" }, foulInput, { kind: "endActivation" }, ...(extraFoulInput ? [extraFoulInput, { kind: "endActivation" }] : [])],
        teamRosterId,
        teamSpecialRules: resolvedTeamSpecialRules,
        initialBribes: bribes,
        bribeUnitCost,
        assumptions: [
          extraFoulerActor
            ? (foulerProfile.star === "blackGobbo"
              ? "The blocker Acts first; Black Gobbo declares the first Foul Action only if legal; if the target remains down and no Turnover has occurred, a separate teammate declares the second Foul Action, as Bloodboard's Sneakiest of the Lot rule requires."
              : "The blocker Acts first; a separate teammate Fouls only if the target is Prone/Stunned; if the target remains down and no Turnover has occurred, Black Gobbo declares the team's second Foul Action, as Bloodboard's Sneakiest of the Lot rule requires.")
            : "Two separate team players act in order: the blocker first, then the fouler only on branches where the target is Prone/Stunned and a Foul Action is legal.",
          "The target starts Standing; a safe removal from the first Block is counted separately and is included in the full-chain outcome.",
          "No movement to create adjacency or crowd-push strategy is modeled. Bloodboard resolves declared squares, automatic legal assists, Bribery and Corruption, configured Bribes, Dirty Player and Chainsaw effects. Other team or Star Player special rules are not inferred.",
          "Bribery and Corruption and Bribes use Bloodboard's default preview policy: Argue the Call, accept the once-per-game reroll on a natural 1, and spend an available Bribe when prompted. Bribe spending is therefore a stated scenario policy, not an optimized multi-Drive budget decision.",
          "Bloodboard enumerates each action separately, retaining the same team reroll pool, team rule use, and Bribe inventory, and stopping any action chain at Turnover or touchdown."
        ]
      },
      rerollPolicies: branches
    };
  }

  function calculateGuardSupportContribution({
    attacker = { name: "Reference blocker", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    defender = { name: "Reference target", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    supporter = { name: "Guard teammate", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ["guard"] },
    supporterPressure = "marked",
    format = "11s",
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    const variant = format === "sevens" ? "sevens" : format === "11s" ? "standard" : null;
    if (!variant) throw new Error("format must be '11s' or 'sevens'.");
    if (!["open", "marked"].includes(supporterPressure)) throw new Error("supporterPressure must be 'open' or 'marked'.");
    const attackerProfile = profileForEngine(engine, attacker);
    const defenderProfile = profileForEngine(engine, defender);
    const supporterProfile = profileForEngine(engine, supporter);
    const ruleset = engine.RULESETS?.[variant];
    if (!ruleset?.pitch) throw new Error("This Bloodboard bundle does not expose pitch dimensions for " + variant + ".");
    const width = ruleset.pitch.w;
    const height = ruleset.pitch.h;
    const y = row === undefined ? Math.floor(height / 2) : row;
    if (!Number.isInteger(y) || y < 2 || y >= height) throw new RangeError("row must leave room above the supported target.");
    const targetAt = { x: Math.floor(width / 2), y };
    const attackerAt = { x: targetAt.x - 1, y };
    const supporterAt = { x: targetAt.x, y: y - 1 };
    const markerAt = { x: targetAt.x, y: y - 2 };

    function run(withGuard) {
      const state = engine.newGame({
        a: { name: "Support evaluation team" },
        b: { name: "Support pressure reference" },
        seed: 1
      });
      if (variant === "sevens") state.variant = "sevens";
      const actor = customScenarioPlayer(engine, state, "A", attackerProfile, attackerAt);
      const target = customScenarioPlayer(engine, state, "B", defenderProfile, targetAt);
      state.players.push(actor, target);
      const skills = supporterProfile.skills.filter(skill => skill.id !== "guard");
      if (withGuard) skills.push({ id: "guard" });
      const helper = customScenarioPlayer(engine, state, "A", { ...supporterProfile, skills }, supporterAt);
      state.players.push(helper);
      let marker = null;
      if (supporterPressure === "marked") {
        marker = customScenarioPlayer(engine, state, "B", {
          position: "Reference marker", name: "Reference marker", ma: 6, st: 3,
          ag: 3, pa: 4, av: 9, skills: []
        }, markerAt);
        state.players.push(marker);
      }
      const playing = engine.startPlay(state);
      const input = { kind: "playerAction", playerId: actor.id, action: "block", path: [], blockTarget: target.id };
      const result = planAction(playing, input, planOptions);
      return {
        result,
        replay: { state: cloneJson(playing), input: cloneJson(input) },
        players: { attacker: actor.id, defender: target.id, supporter: helper.id, marker: marker && marker.id },
        positions: { attacker: attackerAt, defender: targetAt, supporter: supporterAt, marker: marker ? markerAt : null }
      };
    }

    const withoutGuard = run(false);
    const withGuard = run(true);
    const branch = result => result.plan.withoutTeamRerolls;
    const before = branch(withoutGuard.result);
    const after = branch(withGuard.result);
    const keys = ["pTargetDown", "pTargetPushed", "pTargetRemoved", "pTargetArmourBroken", "pTurnover", "pActorDown"];
    const delta = Object.fromEntries(keys.map(key => [key,
      Number.isFinite(before?.[key]) && Number.isFinite(after?.[key]) ? after[key] - before[key] : null
    ]));
    return {
      engine: META,
      scenario: {
        id: "marked-guard-assist-contribution",
        format,
        supporterPressure,
        successEvents: ["supporter legally assists the Block", "target is pushed or knocked down", "attacking team avoids a Turnover"],
        assumptions: [
          "One standing attacker Blocks one standing target; a teammate is adjacent to the target and may assist.",
          supporterPressure === "marked" ? "A single opposing player marks the supporter but not the target or attacker; only Guard permits the supporter to assist while marked." : "No opponent marks the supporter; ordinary assist rules apply.",
          "No ball carrier, rerolls, crowd-push route, or follow-up action. The exact same state is evaluated with Guard removed and added."
        ]
      },
      withoutGuard: { scenario: withoutGuard, summary: withoutGuard.result.summary, block: withoutGuard.result.plan.block },
      withGuard: { scenario: withGuard, summary: withGuard.result.summary, block: withGuard.result.plan.block },
      delta,
      status: withoutGuard.result.summary.legal && withGuard.result.summary.legal ? "engine-enumerated-same-state-skill-delta" : "scenario-invalid-check-engine-errors"
    };
  }

  function calculateGuardStrengthSynergy({
    lowerAttackerStrength = 3,
    higherAttackerStrength = 5,
    targetStrength = 5,
    supporter = { name: "Guard teammate", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ["guard"] },
    supporterPressure = "marked",
    format = "11s",
    row,
    planOptions = {}
  } = {}) {
    for (const [name, value] of Object.entries({ lowerAttackerStrength, higherAttackerStrength, targetStrength })) {
      if (!Number.isInteger(value) || value < 1 || value > 10) throw new RangeError(`${name} must be an integer from 1 to 10.`);
    }
    if (lowerAttackerStrength >= higherAttackerStrength) throw new RangeError("higherAttackerStrength must exceed lowerAttackerStrength.");
    const run = strength => calculateGuardSupportContribution({
      attacker: { name: `ST${strength} blocker`, position: "Blocker", ma: 6, st: strength, ag: 3, pa: 4, av: 9, skills: [] },
      defender: { name: `ST${targetStrength} target`, position: "Target", ma: 6, st: targetStrength, ag: 3, pa: 4, av: 9, skills: [] },
      supporter,
      supporterPressure,
      format,
      row,
      planOptions
    });
    const lowerStrengthCase = run(lowerAttackerStrength);
    const higherStrengthCase = run(higherAttackerStrength);
    const deltaOfGuardDeltas = Object.fromEntries(Object.keys(lowerStrengthCase.delta).map(key => [key,
      Number.isFinite(lowerStrengthCase.delta[key]) && Number.isFinite(higherStrengthCase.delta[key])
        ? higherStrengthCase.delta[key] - lowerStrengthCase.delta[key]
        : null
    ]));
    return {
      engine: META,
      status: lowerStrengthCase.status === "engine-enumerated-same-state-skill-delta" && higherStrengthCase.status === "engine-enumerated-same-state-skill-delta"
        ? "engine-enumerated-guard-strength-difference-in-differences"
        : "scenario-invalid-check-engine-errors",
      scenario: {
        id: "marked-guard-high-strength-block-threshold",
        format,
        supporterPressure,
        lowerAttackerStrength,
        higherAttackerStrength,
        targetStrength,
        comparison: "Guard delta at higher blocker ST minus Guard delta at lower blocker ST; same target, support placement, pressure, skills other than the Guard toggle, and reroll policy.",
        interpretation: "Interaction evidence only. Do not add this difference-in-differences to both a standalone Guard bonus and a standalone Strength bonus; calibrate one joint task contribution."
      },
      lowerStrengthCase,
      higherStrengthCase,
      deltaOfGuardDeltas
    };
  }

  function calculateDefensiveScreenContribution({
    attacker = { name: "ST3 opposing blocker", position: "Blitzer", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    protectedPlayer = { name: "ST3 protected teammate", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    supporter = { name: "ST3 screen teammate", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    pressure = "open",
    format = "11s",
    weather = "perfect",
    attackerTeamRerolls = 0,
    defenderTeamRerolls = 0,
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    if (!attacker || !protectedPlayer || !supporter) throw new TypeError("Attacker, protected player, and screen-supporter profiles are required.");
    if (!Number.isInteger(attackerTeamRerolls) || attackerTeamRerolls < 0 || !Number.isInteger(defenderTeamRerolls) || defenderTeamRerolls < 0) {
      throw new RangeError("Both teams' declared reroll pools must be non-negative integers.");
    }
    if (pressure !== "open" && pressure !== "marked") throw new RangeError("pressure must be 'open' or 'marked'.");
    const dimensions = getPitchDimensions(format);
    const y = row === undefined ? Math.floor(dimensions.height / 2) : row;
    if (!Number.isInteger(y) || y < 1 || y >= dimensions.height - 1) throw new RangeError("row must leave an on-pitch square around the declared screen and marker.");
    const targetX = Math.floor(dimensions.width / 2);
    const attackerX = targetX + 1;
    const attackerProfile = profileForEngine(engine, attacker);
    const protectedProfile = profileForEngine(engine, protectedPlayer);
    const supporterProfile = profileForEngine(engine, supporter);
    const run = withSupport => {
      const result = calculateOneOnOneBlock({
        attacker: attackerProfile,
        defender: protectedProfile,
        action: "block",
        format,
        weather,
        teamRerolls: attackerTeamRerolls,
        defenderTeamRerolls,
        attackerAssists: pressure === "marked" ? 1 : 0,
        attackerSide: "right",
        row: y,
        defenderSupporters: withSupport ? [{ profile: supporterProfile, at: { x: attackerX, y: y - 1 } }] : [],
        includeDefenderStateOutcomes: true,
        includeDefenderPositionRetentionOutcome: true,
        includeDefenderControlZoneOutcome: true,
        controlZoneRadius: 1,
        planOptions
      });
      if (!result.summary.legal) throw new Error("Bloodboard rejected the defensive-screen Block scenario: " + (result.summary.errors || []).join("; "));
      return result;
    };
    const withoutSupport = run(false);
    const withSupport = run(true);
    const difference = (before, after) => {
      if (!Number.isFinite(before?.lowerBound) || !Number.isFinite(before?.upperBound) || !Number.isFinite(after?.lowerBound) || !Number.isFinite(after?.upperBound)) return null;
      const lowerBound = after.lowerBound - before.upperBound;
      const upperBound = after.upperBound - before.lowerBound;
      const exact = before.exact && after.exact;
      return { value: exact ? lowerBound : null, lowerBound, upperBound, exact };
    };
    const metrics = [
      ["standing", (result, policy) => result.defenderStateOutcomes[policy].standing],
      ["standingAtStartingSquare", (result, policy) => result.positionRetentionOutcomes[policy].standingAtStartingSquare],
      ["standingWithinLocalControlZone", (result, policy) => result.controlZoneOutcomes[policy]]
    ];
    const policies = {};
    for (const policy of attackerTeamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"]) {
      policies[policy] = Object.fromEntries(metrics.map(([id, getter]) => [id, {
        withoutSupport: getter(withoutSupport, policy),
        withSupport: getter(withSupport, policy),
        contribution: difference(getter(withoutSupport, policy), getter(withSupport, policy))
      }]));
    }
    return {
      engine: META,
      status: "engine-enumerated-defensive-screen-paired-task",
      scenario: {
        id: "protected-teammate-under-incoming-block",
        format,
        weather,
        pressure,
        attacker: { id: withoutSupport.scenario.attacker.id, profile: attackerProfile },
        protectedPlayer: { id: withoutSupport.scenario.defender.id, profile: protectedProfile },
        supporter: { profile: supporterProfile, at: { x: attackerX, y: y - 1 } },
        attackerAssistCount: pressure === "marked" ? 1 : 0,
        attackerTeamRerolls,
        defenderTeamRerolls,
        comparison: "Same opposing Block, protected player, board, weather, and finite resources; compare no screen teammate with the declared teammate occupying the defensive support square.",
        successEvents: ["protected player ends standing", "protected player remains standing on its starting square", "protected player remains standing in its radius-1 local control zone"],
        interpretation: "Contribution is the paired increase in the protected teammate's probability for each named event; it does not include the screen player's own survival or imply a calibrated adaptability score.",
        assumptions: [
          "One stationary Block attacks the same protected teammate; the screen supporter does not take an action.",
          pressure === "open" ? "No opposing assistant is declared." : "One standard opposing ST3 assistant is declared adjacent to the target and may mark/cancel the screen's defensive assist; Bloodboard resolves the actual marking and Guard exception.",
          "Bloodboard resolves legal defensive assists, block-dice choice, target skills, armour/injury, and the declared active-team reroll pool."
        ]
      },
      policies,
      withoutSupport: { scenario: withoutSupport.scenario, replay: withoutSupport.replay, summary: withoutSupport.summary, block: withoutSupport.plan.block, defenderStateOutcomes: withoutSupport.defenderStateOutcomes, positionRetentionOutcomes: withoutSupport.positionRetentionOutcomes, controlZoneOutcomes: withoutSupport.controlZoneOutcomes },
      withSupport: { scenario: withSupport.scenario, replay: withSupport.replay, summary: withSupport.summary, block: withSupport.plan.block, defenderStateOutcomes: withSupport.defenderStateOutcomes, positionRetentionOutcomes: withSupport.positionRetentionOutcomes, controlZoneOutcomes: withSupport.controlZoneOutcomes }
    };
  }

  function calculateBlockTackleInteraction({
    attacker = { name: "Reference blocker", position: "Blitzer", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [] },
    defender = { name: "Dodge target", position: "Blitzer", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ["dodge"] },
    teamRerolls = 1,
    format = "11s",
    weather = "perfect",
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!weather || !["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    const attackerProfile = profileForEngine(engine, attacker);
    const defenderProfile = profileForEngine(engine, defender);
    if (!defenderProfile.skills.some(skill => skill.id === "dodge")) {
      throw new Error("The Block/Tackle interaction benchmark requires a Dodge target.");
    }
    const commonAttackerSkills = attackerProfile.skills.filter(skill => !["block", "tackle"].includes(skill.id));
    const variants = [
      ["neither", false, false],
      ["blockOnly", true, false],
      ["tackleOnly", false, true],
      ["blockAndTackle", true, true]
    ];
    const cases = {};
    for (const [id, hasBlock, hasTackle] of variants) {
      const skills = commonAttackerSkills.slice();
      if (hasBlock) skills.push({ id: "block" });
      if (hasTackle) skills.push({ id: "tackle" });
      const result = calculateOneOnOneBlock({
        attacker: { ...attackerProfile, skills },
        defender: defenderProfile,
        format,
        weather,
        teamRerolls,
        row,
        planOptions
      });
      if (!result.summary.legal) throw new Error("Bloodboard rejected Block/Tackle interaction case " + id + ": " + (result.summary.errors || []).join("; "));
      const targetDownEvent = { type: "playerDown", playerId: result.scenario.defender.id };
      const safeKnockdownEvent = { type: "allOf", events: [targetDownEvent, { type: "noTurnover" }] };
      const targetDown = evaluateTerminalEvent({ state: result.replay.state, input: result.replay.input, timepoint: "activation-ended", event: targetDownEvent, options: planOptions });
      const safeKnockdown = evaluateTerminalEvent({ state: result.replay.state, input: result.replay.input, timepoint: "activation-ended", event: safeKnockdownEvent, options: planOptions });
      const policies = {};
      for (const branch of teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"]) {
        const asMeasure = result => ({
          value: result.exact ? (result.lowerBound + result.upperBound) / 2 : null,
          lowerBound: result.lowerBound,
          upperBound: result.upperBound,
          exact: result.exact
        });
        policies[branch] = {
          targetDown: asMeasure(targetDown[branch].successProbability),
          safeKnockdown: asMeasure(safeKnockdown[branch].successProbability),
          turnover: asMeasure({ value: result.summary[branch].turnover, lowerBound: result.summary[branch].turnover, upperBound: result.summary[branch].turnover, exact: Number.isFinite(result.summary[branch].turnover) }),
          blockDice: result.plan.block,
          completedAction: result.summary[branch].completed
        };
      }
      cases[id] = {
        skills: { block: hasBlock, tackle: hasTackle, otherAttackerSkillsHeldConstant: commonAttackerSkills.map(skill => skill.id) },
        scenario: result.scenario,
        replay: result.replay,
        event: safeKnockdownEvent,
        policies
      };
    }
    const interactions = {};
    for (const branch of teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"]) {
      const differenceInDifferences = metric => {
        const base = cases.neither.policies[branch][metric];
        const blockOnly = cases.blockOnly.policies[branch][metric];
        const tackleOnly = cases.tackleOnly.policies[branch][metric];
        const both = cases.blockAndTackle.policies[branch][metric];
        if (![base, blockOnly, tackleOnly, both].every(item => Number.isFinite(item?.lowerBound) && Number.isFinite(item?.upperBound))) return null;
        const lowerBound = both.lowerBound - blockOnly.upperBound - tackleOnly.upperBound + base.lowerBound;
        const upperBound = both.upperBound - blockOnly.lowerBound - tackleOnly.lowerBound + base.upperBound;
        const exact = [base, blockOnly, tackleOnly, both].every(item => item.exact);
        return { value: exact ? (lowerBound + upperBound) / 2 : null, lowerBound, upperBound, exact };
      };
      interactions[branch] = {
        targetDown: differenceInDifferences("targetDown"),
        safeKnockdown: differenceInDifferences("safeKnockdown"),
        turnover: differenceInDifferences("turnover")
      };
    }
    return {
      engine: META,
      status: "engine-enumerated-four-cell-skill-interaction",
      scenario: {
        id: "block+tackle-vs-dodge",
        format,
        weather,
        teamRerolls,
        attacker: attackerProfile,
        defender: defenderProfile,
        variants: variants.map(([id, block, tackle]) => ({ id, block, tackle })),
        successEvent: "The defender is knocked down and the attacking team avoids a Turnover.",
        interactionFormula: "P(Block+Tackle) − P(Block only) − P(Tackle only) + P(neither)",
        rerollPolicy: "Each cell uses Bloodboard's own one-Block plan under the same finite initial team pool; withTeamRerolls is a separate one-action policy, not a fresh reroll for each component."
      },
      cases,
      interactions
    };
  }

  function calculateMightyBlowClawsInteraction({
    attacker = { name: "Reference blocker", position: "Blitzer", ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ["block"] },
    defender = { name: "High-armour target", position: "Lineman", ma: 6, st: 3, ag: 3, pa: 4, av: 10, skills: [] },
    teamRerolls = 1,
    format = "11s",
    weather = "perfect",
    row,
    planOptions = {}
  } = {}) {
    const engine = getEngine();
    if (!Number.isInteger(teamRerolls) || teamRerolls < 0) throw new RangeError("teamRerolls must be a non-negative integer.");
    if (!weather || !["perfect", "verySunny", "pouringRain", "blizzard", "swelteringHeat"].includes(weather)) {
      throw new Error("weather is not a Bloodboard weather ID.");
    }
    const attackerProfile = profileForEngine(engine, attacker);
    const defenderProfile = profileForEngine(engine, defender);
    const commonSkills = attackerProfile.skills.filter(skill => !["mightyBlow", "claws"].includes(skill.id));
    const variants = [
      ["neither", false, false],
      ["mightyBlowOnly", true, false],
      ["clawsOnly", false, true],
      ["mightyBlowAndClaws", true, true]
    ];
    const cases = {};
    for (const [id, hasMightyBlow, hasClaws] of variants) {
      const skills = commonSkills.slice();
      if (hasMightyBlow) skills.push({ id: "mightyBlow" });
      if (hasClaws) skills.push({ id: "claws" });
      const result = calculateOneOnOneBlock({
        attacker: { ...attackerProfile, skills },
        defender: defenderProfile,
        format,
        weather,
        teamRerolls,
        row,
        planOptions
      });
      if (!result.summary.legal) throw new Error("Bloodboard rejected Mighty Blow/Claws interaction case " + id + ": " + (result.summary.errors || []).join("; "));
      const targetDownEvent = { type: "playerDown", playerId: result.scenario.defender.id };
      const safeKnockdownEvent = { type: "allOf", events: [targetDownEvent, { type: "noTurnover" }] };
      const safeRemovalEvent = { type: "allOf", events: [{ type: "playerRemoved", playerId: result.scenario.defender.id }, { type: "noTurnover" }] };
      const safeKnockdown = evaluateTerminalEvent({ state: result.replay.state, input: result.replay.input, timepoint: "activation-ended", event: safeKnockdownEvent, options: planOptions });
      const safeRemoval = evaluateTerminalEvent({ state: result.replay.state, input: result.replay.input, timepoint: "activation-ended", event: safeRemovalEvent, options: planOptions });
      const policies = {};
      for (const branch of teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"]) {
        const exactMeasure = value => ({ value, lowerBound: value, upperBound: value, exact: Number.isFinite(value) });
        policies[branch] = {
          targetArmourBroken: exactMeasure(result.summary[branch].targetArmourBroken),
          targetRemoved: exactMeasure(result.summary[branch].targetRemoved),
          safeKnockdown: safeKnockdown[branch].successProbability,
          safeRemoval: safeRemoval[branch].successProbability,
          turnover: exactMeasure(result.summary[branch].turnover),
          blockDice: result.plan.block,
          engineDecisionTrace: result.plan.trace || result.plan.traceEvents || []
        };
      }
      cases[id] = { skills: { mightyBlow: hasMightyBlow, claws: hasClaws, otherAttackerSkillsHeldConstant: commonSkills.map(skill => skill.id) }, scenario: result.scenario, replay: result.replay, events: { safeKnockdown: safeKnockdownEvent, safeRemoval: safeRemovalEvent }, policies };
    }
    const interactions = {};
    for (const branch of teamRerolls > 0 ? ["withoutTeamRerolls", "withTeamRerolls"] : ["withoutTeamRerolls"]) {
      const differenceInDifferences = metric => {
        const base = cases.neither.policies[branch][metric];
        const mightyBlowOnly = cases.mightyBlowOnly.policies[branch][metric];
        const clawsOnly = cases.clawsOnly.policies[branch][metric];
        const both = cases.mightyBlowAndClaws.policies[branch][metric];
        if (![base, mightyBlowOnly, clawsOnly, both].every(item => Number.isFinite(item?.lowerBound) && Number.isFinite(item?.upperBound))) return null;
        const lowerBound = both.lowerBound - mightyBlowOnly.upperBound - clawsOnly.upperBound + base.lowerBound;
        const upperBound = both.upperBound - mightyBlowOnly.lowerBound - clawsOnly.lowerBound + base.upperBound;
        const exact = [base, mightyBlowOnly, clawsOnly, both].every(item => item.exact);
        return { value: exact ? (lowerBound + upperBound) / 2 : null, lowerBound, upperBound, exact };
      };
      interactions[branch] = Object.fromEntries(["targetArmourBroken", "targetRemoved", "safeKnockdown", "safeRemoval", "turnover"].map(metric => [metric, differenceInDifferences(metric)]));
    }
    return {
      engine: META,
      status: "engine-enumerated-four-cell-skill-interaction",
      scenario: {
        id: "mighty-blow+claws-damage-chain",
        format,
        weather,
        teamRerolls,
        attacker: attackerProfile,
        defender: defenderProfile,
        variants: variants.map(([id, mightyBlow, claws]) => ({ id, mightyBlow, claws })),
        successEvents: ["target Armour broken", "target removed", "safe knockdown", "safe removal", "Turnover"],
        interactionFormula: "P(Mighty Blow+Claws) − P(Mighty Blow only) − P(Claws only) + P(neither)",
        rerollPolicy: "Each cell uses Bloodboard's own one-Block plan under the same finite initial team pool; its default preview decision policy handles any Mighty Blow choice. No coach-optimal branch selection is claimed."
      },
      cases,
      interactions
    };
  }

  window.BB_BLOODBOARD_ENGINE = Object.freeze({
    META,
    getPitchDimensions,
    planAction,
    comparePlayerPatch,
    evaluateActionSequence,
    calculateTeamTaskRemovalImpact,
    createTeamGroundBallReference,
    prepareTeamGroundBallComparison,
    preparePlayerRoleTask,
    recommendPlayerRoleTask,
    prepareTeamCarrierThreat,
    calculateCarrierThreat,
    calculateOpenStraightRoute,
    calculateMarkedStraightRoute,
    calculateScreenCrossingRoute,
    calculateMarkedRouteControl,
    prepareScoringReceptionTask,
    calculateGazeAssistedTouchdown,
    calculateBallAcquisition,
    calculateOpponentActivationDenial,
    calculateGrombrindalSkillGrant,
    calculateBallRecovery,
    calculateBallDisruption,
    calculateBallTransfer,
    evaluateTerminalEvent,
    calculateOneOnOneBlock,
    calculateCurrentFunctionAfterBlock,
    calculateOneOnOneFoul,
    calculateBlockThenFoul,
    calculateGuardStrengthSynergy,
    calculateBlockTackleInteraction,
    calculateMightyBlowClawsInteraction,
    calculateGuardSupportContribution,
    calculateDefensiveScreenContribution,
    calculateTeamStaticCoverageAfterBlock,
    createScenarioState: (...args) => getEngine().newGame(...args),
    addScenarioPlayer: (...args) => getEngine().customPlayer(...args),
    startScenario: state => getEngine().startPlay(state),
    exploreOutcomes: (...args) => getEngine().exploreOutcomes(...args),
    validateInput: (...args) => getEngine().validateInput(...args),
    resolveStarId
  });
})();
