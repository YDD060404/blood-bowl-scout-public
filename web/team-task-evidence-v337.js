/* Evidence-only legal-roster role portfolios. Frozen Bloodboard 5.0.6 rules are called, not reimplemented. */
(() => {
  const VERSION = '1.0.0-legal-team-task-evidence-v337';
  const TEAM_IDS = Object.freeze(['standard-human', 'standard-vampire', 'standard-dwarf', 'sevens-vampire']);
  const OPTIONS = Object.freeze({ threshold: 1e-12, maxLeaves: 20000, maxExpandedStates: 2000, followUp: false });
  const clone = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value)
    ? value.map(x => JSON.parse(canonical(x))) : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))])) : value);
  const all = (...events) => ({ type: 'allOf', events });
  const skill = (p, id) => (p.skills || []).some(s => (typeof s === 'string' ? s : s.id) === id);
  function certify(teamId) {
    if (!TEAM_IDS.includes(teamId)) throw new Error('This bounded phase only certifies the four declared reference rosters.');
    const engine = window.BloodboardEngine;
    const source = window.ATLAS_DATA.teams.find(t => t.id === teamId);
    if (!source) throw new Error('Missing pinned Atlas team: ' + teamId);
    const roster = engine.ROSTER_BY_ID[source.rosterId];
    if (!roster) throw new Error('Roster is absent from the pinned rules engine.');
    const format = source.format === 'sevens' ? 'sevens' : '11s';
    const team = engine.newTeamDef('tournament', source.rosterId, source.name, source.id, format === 'sevens' ? 'sevens' : undefined);
    team.play = 'tournament'; team.tier = 2; team.budget = source.budget;
    team.rerolls = source.rerolls; team.apothecary = source.apothecary; team.dedicatedFans = 0;
    team.league = roster.leagues[0];
    team.players = source.players.map(p => Object.fromEntries(['id', 'number', 'name', 'positionId', 'position', 'ma', 'st', 'ag', 'pa', 'av', 'skills', 'keywords', 'boughtSkill', 'captain', 'veteran']
      .filter(key => p[key] !== undefined).map(key => [key, clone(p[key])])));
    const validation = engine.validateTeamDef(team), cost = engine.teamCost(team), budget = engine.teamBudget(team);
    const errors = validation.filter(issue => issue.level === 'error');
    return { teamId, name: source.name, format, rosterId: source.rosterId, legal: errors.length === 0, validation, cost, budget,
      unspentBudget: budget - cost.total, skillPoints: engine.teamSkillPoints(team), team: clone(team),
      declaredTier: { value: 2, sourceFile: 'TIER_CALIBRATION_AUDIT.md',
        sourceDescription: format === 'sevens' ? 'Existing local audit: Vampire Sevens Tier2; frozen published reference, not newly inferred from rank.'
          : 'Existing local audit standard table: Human, Vampire and Dwarf Tier2; frozen published reference, not inferred from task results.',
        sourceUrl: format === 'sevens' ? null : 'https://assets.warhammer-community.com/eng_20-05_blood_bowl_teamtiers-rhnqpyom8r-4rpfatdubw.pdf' },
      assumptions: { play: 'Matched Play tournament', dedicatedFans: 0, assistantCoaches: 0, cheerleaders: 0,
        league: team.league, staffMetadata: 'Atlas explicitly supplies Apothecary and rerolls; unlisted fans/coaches/cheerleaders set to declared zero, not claimed recovered purchase history.' },
      ruleAuthority: { engine: window.BB_BLOODBOARD_ENGINE.META, rosterPage: roster.page,
        drafting: format === 'sevens' ? engine.SEVENS_DRAFT : engine.DRAFT_TEMPLATE, matched: engine.MATCHED[format === 'sevens' ? 'sevens' : 'standard'] },
      scope: 'Recruitment/profile/budget/skill legality of this declared roster. Separate position validation is required for every task board. Not a claim about all Atlas rosters or current live tournament rules.' };
  }
  function requireLegal(certificate) {
    if (!certificate?.legal) throw new Error('Roster certificate is not legal: ' + (certificate?.validation || []).filter(i => i.level === 'error').map(i => i.text).join('; '));
  }
  function initialReference(certificate, pressure = 'open') {
    requireLegal(certificate);
    return window.BB_BLOODBOARD_ENGINE.createTeamGroundBallReference({ players: certificate.team.players, format: certificate.format,
      teamName: certificate.name, teamRosterId: certificate.rosterId, pressure, teamRerolls: certificate.team.rerolls, includeLeaderReroll: true });
  }
  function positionIssues(state) { return window.BloodboardEngine.validatePosition(clone(state)); }
  function requirePosition(state) {
    const issues = positionIssues(state);
    if (issues.some(i => i.level === 'error')) throw new Error('Invalid in-drive reference position: ' + issues.filter(i => i.level === 'error').map(i => i.text).join('; '));
    return issues;
  }
  function prepareRetrieval(certificate, pressure = 'open') {
    const reference = initialReference(certificate, pressure);
    const fielded = reference.state.players.filter(p => p.team === 'A' && p.location === 'pitch' && !skill(p, 'noBall'));
    const focal = fielded.slice().sort((a, b) => Number(skill(b, 'sureHands')) - Number(skill(a, 'sureHands')) || a.ag - b.ag || b.ma - a.ma || a.number - b.number)[0];
    if (!focal) throw new Error('No eligible fielded retrieval focal.');
    const reserve = reference.state.players.find(p => p.team === 'A' && p.location === 'reserves' && !skill(p, 'noBall'));
    const prepared = window.BB_BLOODBOARD_ENGINE.prepareTeamGroundBallComparison({ reference, focalPlayerId: focal.id, reservePlayerId: reserve?.id || null });
    return { id: certificate.teamId + ':retrieval:' + pressure, type: 'ground-ball-retrieval', certificateTeamId: certificate.teamId,
      reference: reference.scenario, positionValidation: requirePosition(prepared.state), prepared,
      roles: { focal: { id: focal.id, name: focal.name, number: focal.number }, reserve: reserve ? { id: reserve.id, name: reserve.name, number: reserve.number } : null,
        focalSelection: 'Sure Hands, then lower AG target, then higher MA, then shirt number; no single-player rating is used.',
        candidatePolicy: 'Existing adapter offers real fielded players Move/Secure candidate routes, then reassigns after removing the focal. Alternatives are finite, not full-turn optimization.' },
      scope: 'Full certified own roster in a declared in-drive ground-ball board, one fixed optional opposing marker. Default formation is verified separately; the ball situation is not a simulated kickoff. Reserve only next-drive-reference.' };
  }
  function prepareVampireSupport(certificate) {
    requireLegal(certificate);
    if (certificate.rosterId !== 'vampire') throw new Error('The support probe requires actual Vampire roster Thralls; other teams receive no synthetic Thrall.');
    const bridge = window.BB_BLOODBOARD_ENGINE, engine = window.BloodboardEngine;
    const state = clone(initialReference(certificate, 'open').state);
    const onPitch = state.players.filter(p => p.team === 'A' && p.location === 'pitch').sort((a, b) => a.number - b.number);
    const runner = onPitch.find(p => p.keywords.includes('Runner') && p.keywords.includes('Vampire'));
    const thralls = onPitch.filter(p => p.keywords.includes('Thrall') && !p.veteran);
    const [focal, backup] = thralls;
    const reserve = state.players.find(p => p.team === 'A' && p.location === 'reserves' && p.keywords.includes('Thrall'));
    if (!runner || !focal || !backup) throw new Error('The certified lineup lacks the declared Runner and two non-Veteran fielded Thralls.');
    const pitch = bridge.getPitchDimensions(certificate.format), y = Math.floor(pitch.height / 2), goalX = pitch.width - 1;
    const origin = { x: goalX - 8, y }, goal = { x: goalX, y }, supportAt = { x: goalX - 1, y: y + 1 }, backupAt = { x: goalX - 4, y: y + 1 };
    let parked = 0;
    for (const p of onPitch) {
      if (p.id === runner.id) p.pos = clone(origin);
      else if (p.id === focal.id) p.pos = clone(supportAt);
      else if (p.id === backup.id) p.pos = clone(backupAt);
      else { p.pos = { x: 2 + parked % 4, y: 1 + Math.floor(parked / 4) }; parked++; }
    }
    state.ball = { kind: 'held', playerId: runner.id };
    const runnerInput = { kind: 'playerAction', playerId: runner.id, action: 'move',
      path: Array.from({ length: 8 }, (_, i) => ({ kind: 'step', to: { x: origin.x + i + 1, y } })) };
    const supportInput = { kind: 'playerAction', playerId: backup.id, action: 'move',
      path: Array.from({ length: 3 }, (_, i) => ({ kind: 'step', to: { x: backupAt.x + i + 1, y: backupAt.y } })) };
    const event = all({ type: 'teamTouchdown', team: 'A' }, { type: 'noTurnover' });
    const prepared = { state, event, focalPlayerId: focal.id,
      policies: [{ id: 'runner-with-current-support', inputs: [runnerInput, { kind: 'endActivation' }] }],
      reassignmentPolicies: [{ id: 'backup-thrall-then-runner', inputs: [supportInput, { kind: 'endActivation' }, runnerInput, { kind: 'endActivation' }] }],
      reservePlayerIds: reserve ? [reserve.id] : [], reservePolicies: {}, comparisonTiming: reserve ? 'next-drive-reference' : 'during-drive' };
    return { id: certificate.teamId + ':support-touchdown', type: 'vampire-support-touchdown', certificateTeamId: certificate.teamId,
      prepared, positionValidation: requirePosition(state),
      roles: { carrier: { id: runner.id, name: runner.name, number: runner.number }, focal: { id: focal.id, name: focal.name, number: focal.number },
        reassignedSupport: { id: backup.id, name: backup.name, number: backup.number }, reserve: reserve ? { id: reserve.id, name: reserve.name, number: reserve.number } : null },
      reference: { format: certificate.format, origin, goal, supportAt, backupAt, distance: 8,
        otherPlayers: 'All other real roster players remain present, parked at declared non-overlapping squares away from the scoring lane. Original reserves remain reserves.',
        ballPolicy: 'The Runner remains the same held-ball carrier in every comparison. The removed focal is a non-carrier Thrall; no invented handoff or lost-ball transition.',
        rerolls: certificate.team.rerolls, startTimepoint: 'between activations during a reference drive',
        reserveTiming: 'Only next-drive reference uses an existing eligible bench Thrall in the missing support slot; no mid-drive substitution.' },
      scope: 'Hypothetical legal in-drive position, not a legal kickoff deployment or a claim of reachability from a simulated kickoff. Only a fixed Runner path and one explicit support reassignment path are compared.' };
  }
  function snapshotForComparison(prepared, comparison) {
    const state = clone(prepared.state);
    if (comparison?.id && comparison.id !== 'baseline') {
      const focal = state.players.find(p => p.id === prepared.focalPlayerId), at = clone(focal.pos);
      focal.location = 'reserves'; focal.pos = null; focal.distracted = false;
      if (comparison.reservePlayerId) {
        const reserve = state.players.find(p => p.id === comparison.reservePlayerId); reserve.location = 'pitch'; reserve.pos = at;
      }
    }
    return state;
  }
  function supportCostDiagnostics(raw, preparation, options) {
    const bridge = window.BB_BLOODBOARD_ENGINE;
    const rows = [{ id: 'baseline', ...raw.baseline }, ...raw.comparisons];
    return rows.flatMap(comparison => Object.entries(comparison.byRerollPolicy).map(([policy, branch]) => {
      const selected = branch.candidates.find(c => c.id === branch.selectedPolicyId);
      if (!selected?.inputs?.length) return { comparisonId: comparison.id, policy, status: 'no-action', measures: null };
      const state = snapshotForComparison(preparation.prepared, comparison);
      const helperIds = [preparation.roles.focal.id, preparation.roles.reassignedSupport.id, ...(preparation.roles.reserve ? [preparation.roles.reserve.id] : [])];
      // Count only helpers on the pitch at this comparison's start; removal itself is not a bite injury.
      const available = helperIds.filter(id => state.players.find(p => p.id === id)?.location === 'pitch');
      const events = Object.fromEntries(available.map((id, i) => ['helperRemoved' + i, { type: 'playerRemoved', playerId: id }]));
      events.actualTouchdown = { type: 'teamTouchdown', team: 'A' };
      const diagnostic = bridge.evaluateActionSequence({ state, inputs: selected.inputs, event: preparation.prepared.event,
        options, measureEvents: events });
      return { comparisonId: comparison.id, policy, selectedPolicyId: selected.id, helperEventPlayerIds: available,
        measures: diagnostic[policy].eventProbabilities, remainingTeamRerolls: diagnostic[policy].remainingTeamRerolls,
        unresolved: diagnostic[policy].unresolved, sameSelectedProbability: diagnostic[policy].taskSuccessProbability };
    }));
  }
  function evaluate(preparation, { planOptions = {} } = {}) {
    const options = { ...OPTIONS, ...planOptions }, bridge = window.BB_BLOODBOARD_ENGINE;
    const started = Date.now();
    const result = bridge.calculateTeamTaskRemovalImpact({ ...preparation.prepared, options });
    const lockedRoles = preparation.type === 'vampire-support-touchdown'
      ? bridge.calculateTeamTaskRemovalImpact({ ...preparation.prepared, reassignmentPolicies: [], options }) : null;
    const diagnostics = preparation.type === 'vampire-support-touchdown' ? supportCostDiagnostics(result, preparation, options) : null;
    const contexts = { rosterTeamId: preparation.certificateTeamId, initialState: preparation.prepared.state,
      event: preparation.prepared.event, policies: preparation.prepared.policies, reassignmentPolicies: preparation.prepared.reassignmentPolicies,
      reservePlayerIds: preparation.prepared.reservePlayerIds, reservePolicies: preparation.prepared.reservePolicies,
      comparisonTiming: preparation.prepared.comparisonTiming, engine: bridge.META, exploration: options };
    return { id: preparation.id, type: preparation.type, certificateTeamId: preparation.certificateTeamId,
      status: result.status, roles: preparation.roles, reference: preparation.reference, positionValidation: preparation.positionValidation,
      scope: preparation.scope, contextKey: canonical(contexts), elapsedMs: Date.now() - started,
      baseline: result.baseline, comparisons: result.comparisons,
      lockedRoleComparison: lockedRoles ? { baseline: lockedRoles.baseline, comparisons: lockedRoles.comparisons } : null,
      supportCostDiagnostics: diagnostics, replay: clone(preparation.prepared), sourcePolicy: result.scenario,
      semantics: { comparison: 'Best lower-bound success among the same finite declared slot-policy portfolio; upper bound is max of candidate upper bounds. Not full-turn optimal strategy.',
        independentCases: 'Each portfolio starts from a separate reference state. Do not add retrieval and touchdown probabilities or infer a six-axis/global team score.',
        uncertainty: 'Illegal candidates remain excluded diagnostics, unresolved mass stays an interval, reserves never enter the current drive.' } };
  }
  window.BB_TEAM_TASK_EVIDENCE_V337 = Object.freeze({ VERSION, TEAM_IDS, OPTIONS, certify, prepareRetrieval, prepareVampireSupport, evaluate });
})();
