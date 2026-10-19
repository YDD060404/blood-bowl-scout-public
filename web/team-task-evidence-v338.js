/* V338 only extends certified reference-roster coverage. Frozen V337 paths and rules are reused unchanged. */
(() => {
  const VERSION = '1.0.0-reference-roster-coverage-v338';
  const clone = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value && typeof value === 'object' ? Array.isArray(value)
    ? value.map(x => JSON.parse(canonical(x))) : Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))])) : value);
  const LINKS = Object.freeze({
    standard: 'https://assets.warhammer-community.com/eng_20-05_blood_bowl_teamtiers-rhnqpyom8r-4rpfatdubw.pdf',
    sevens: 'https://assets.warhammer-community.com/19-08_blood_bowl_sevens_team_tiers-kzhghr77dz-d7tlkgeuuc.pdf'
  });
  function parseTierTables(text) {
    const standard = text.split('### 标准十一人制\n')[1]?.split('### Sevens\n')[0];
    const sevens = text.split('### Sevens\n')[1]?.split('\n## ')[0];
    if (!standard || !sevens || Object.values(LINKS).some(url => !text.includes(url))) throw new Error('Pinned tier-source sections or citations are missing.');
    const result = {};
    for (const [format, section] of Object.entries({ standard, sevens })) {
      const rows = Array.from(section.matchAll(/^\| \d+ \| (.+?) \| ([1-4]) \| /gm));
      if (rows.length !== 30 || new Set(rows.map(m => m[1])).size !== 30) throw new Error('Expected exactly 30 unique tier-source rows per format.');
      result[format] = Object.fromEntries(rows.map(m => [m[1], Number(m[2])]));
    }
    return result;
  }
  function certify(source, tiers) {
    const engine = window.BloodboardEngine, roster = engine.ROSTER_BY_ID[source.rosterId];
    if (!roster) throw new Error('Unknown pinned-engine roster: ' + source.rosterId);
    if (!['standard', 'sevens'].includes(source.format)) throw new Error('Unknown Atlas format.');
    const format = source.format === 'sevens' ? 'sevens' : '11s', tier = tiers[source.format]?.[source.rosterName];
    const team = engine.newTeamDef('tournament', source.rosterId, source.name, source.id, source.format === 'sevens' ? 'sevens' : undefined);
    Object.assign(team, { play: 'tournament', tier, budget: source.budget, rerolls: source.rerolls, apothecary: source.apothecary, dedicatedFans: 0 });
    if (source.league) team.league = source.league;
    else if (roster.leagues.length === 1) team.league = roster.leagues[0];
    if (source.favoured) team.favoured = source.favoured;
    const fields = ['id', 'number', 'name', 'positionId', 'position', 'ma', 'st', 'ag', 'pa', 'av', 'skills', 'keywords', 'boughtSkill', 'captain', 'veteran'];
    team.players = source.players.map(p => Object.fromEntries(fields.filter(k => p[k] !== undefined).map(k => [k, clone(p[k])])));
    const missingFields = [
      ...(!tier ? ['tier'] : []),
      ...(roster.leagues.length > 1 && !source.league ? ['league'] : []),
      ...(roster.favouredOf && !source.favoured ? ['favoured'] : [])
    ];
    const validation = engine.validateTeamDef(team), errors = validation.filter(i => i.level === 'error');
    const metadataErrors = errors.filter(i => /^Choose the team's (League|alignment|Tier)/.test(i.text));
    const hardErrors = errors.filter(i => !metadataErrors.includes(i));
    const profileIssues = [], missingPricePlayers = [];
    for (const p of team.players) {
      const expected = roster.positions.find(x => x.id === p.positionId);
      if (!expected) { missingPricePlayers.push({ playerId: p.id, number: p.number, positionId: p.positionId }); continue; }
      if (canonical(expected.keywords) !== canonical(p.keywords)) profileIssues.push({ playerId: p.id, number: p.number,
        type: 'keyword-profile-mismatch', expected: expected.keywords, actual: p.keywords });
    }
    const status = hardErrors.length || profileIssues.length ? 'invalid' : missingFields.length || metadataErrors.length ? 'missing-evidence' : 'valid';
    const localRoster = window.ATLAS_DATA.rosters.find(r => r.id === source.rosterId);
    const provenanceDifferences = [];
    for (const pos of localRoster.positions) {
      const ep = roster.positions.find(p => p.id === pos.id), usedBy = team.players.filter(p => p.positionId === pos.id).map(p => p.number);
      if (!ep) { provenanceDifferences.push({ type: 'position-absent-in-pinned-engine', positionId: pos.id, usedBy }); continue; }
      if (pos.cost !== ep.cost) provenanceDifferences.push({ type: 'position-cost-version-difference', positionId: pos.id,
        localCost: pos.cost, pinnedEngineCost: ep.cost, usedBy });
      for (const field of ['ma', 'st', 'ag', 'pa', 'av', 'skills', 'keywords']) if (canonical(pos[field]) !== canonical(ep[field])) {
        provenanceDifferences.push({ type: 'position-profile-version-difference', positionId: pos.id, field,
          localValue: clone(pos[field]), pinnedEngineValue: clone(ep[field]), usedBy });
      }
      const access = window.BB_SKILL_ELIGIBILITY?.rosters?.[source.rosterId]?.[pos.id];
      for (const field of ['primary', 'secondary']) if (access && canonical(access[field].slice().sort()) !== canonical(ep[field].slice().sort())) {
        provenanceDifferences.push({ type: 'skill-access-version-difference', positionId: pos.id, field,
          localValue: access[field], pinnedEngineValue: ep[field], usedBy,
          usedPurchases: team.players.filter(p => p.positionId === pos.id && p.boughtSkill).map(p => ({ number: p.number, skill: p.boughtSkill })) });
      }
    }
    const embeddedTier = engine.sourceTier(source.rosterId, source.format) || null;
    if (embeddedTier && embeddedTier.tier !== tier) provenanceDifferences.push({ type: 'tier-source-version-difference', localTier: tier, embeddedTier });
    const engineCost = engine.teamCost(team), cost = missingPricePlayers.length ? null : engineCost, budget = engine.teamBudget(team);
    return { teamId: source.id, name: source.name, format, rosterId: source.rosterId, status, legal: status === 'valid',
      validation, hardErrors, metadataErrors, profileIssues, missingFields, cost, budget, unspentBudget: cost ? budget - cost.total : null,
      costEvidence: { status: cost ? 'complete-pinned-engine-pricing' : 'incomplete-unknown-position', missingPricePlayers,
        partialEngineSubtotalDiagnostic: cost ? null : engineCost,
        localPriceDifferences: provenanceDifferences.filter(x => x.type === 'position-cost-version-difference'),
        limitation: 'Pinned engine prices are used only when every hired position exists. Missing positions do not acquire zero cost. Local newer prices are retained as differences, never substituted silently.' },
      skillPoints: engine.teamSkillPoints(team), team: clone(team), nominalBench: Math.max(0, team.players.length - (format === 'sevens' ? 7 : 11)),
      declaredTier: { value: tier || null, sourceFile: 'TIER_CALIBRATION_AUDIT.md', sourceUrl: LINKS[source.format],
        date: source.format === 'sevens' ? '2026-08-19' : '2026-05-20', embeddedTier,
        interpretation: 'Frozen local source table used solely for skill-budget legality. No live recertification and no performance-derived Tier.' },
      provenanceDifferences,
      assumptions: { play: 'Matched Play tournament', dedicatedFans: 0, assistantCoaches: 0, cheerleaders: 0,
        league: team.league || null, favoured: team.favoured || null,
        staffMetadata: 'Atlas explicitly supplies Apothecary and rerolls; unlisted fans/coaches/cheerleaders are declared zero, as in V337, not recovered purchase history.',
        selectionMetadata: 'Only a unique available League is filled. Missing multi-choice League or Favoured alignment remains blocked.' },
      ruleAuthority: { engine: window.BB_BLOODBOARD_ENGINE.META, rosterPage: roster.page,
        drafting: format === 'sevens' ? engine.SEVENS_DRAFT : engine.DRAFT_TEMPLATE, matched: engine.MATCHED[source.format] },
      scope: 'Certificate for this unchanged Atlas reference build under the declared frozen conditions. Not an official universal team template or current live tournament certification.' };
  }
  function inventory(tierDocument) {
    const tiers = parseTierTables(tierDocument), sources = window.ATLAS_DATA.teams;
    if (sources.length !== 60 || new Set(sources.map(s => s.id)).size !== 60) throw new Error('V338 inventory requires the pinned 60 unique reference templates.');
    for (const source of sources) if (!tiers[source.format]?.[source.rosterName]) throw new Error('Missing exact tier-source match for ' + source.id);
    return sources.map(s => certify(s, tiers));
  }
  function prepareRetrieval(certificate, pressure) {
    if (certificate?.status !== 'valid' || !certificate.legal) throw new Error('Blocked roster has no task probability: ' + certificate?.teamId);
    const pre = window.BB_TEAM_TASK_EVIDENCE_V337.prepareRetrieval(certificate, pressure);
    pre.certificateTeamId = certificate.teamId;
    return pre;
  }
  window.BB_TEAM_TASK_EVIDENCE_V338 = Object.freeze({ VERSION, parseTierTables, inventory, prepareRetrieval,
    OPTIONS: window.BB_TEAM_TASK_EVIDENCE_V337.OPTIONS,
    evaluate: (preparation, options) => window.BB_TEAM_TASK_EVIDENCE_V337.evaluate(preparation, options) });
})();
