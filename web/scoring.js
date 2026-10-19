/*
 * Reproducible six-dimension rule model for the Atlas.
 *
 * Blood Bowl supplies action rules and dice odds, not an official player/team
 * rating. Every score below is therefore an outcome probability or an openly
 * defined model index under the fixed scenarios in METHOD. It is not a win
 * probability and does not include opponent/team context unless stated.
 */
(() => {
  const METHOD = {
    version: "2.14",
    weights: [0.25, 0.20, 0.15, 0.15, 0.10, 0.15],
    playerOverallUsesDimensions: [0, 1, 2, 3, 4],
    teamAggregation: "对快攻、控球、杀伤、生存、控场分别从可用名单中选择该轴得分最高的不超过赛制人数球员，并按 e^(−0.38×序位) 汇总；各轴是可用阵容能力画像，不能解释成一套同时满足所有任务的首发。阵型协同、团队行动经济、站位机会和对手频率仅在独立 Bloodboard 整队任务中计入。适应力继续由全名单的角色覆盖与缺阵后重分工保留率计算。",
    roles: [
      { id: "ballProgression", label: "持球推进", minimum: 35, reliable: 75 },
      { id: "scoringReception", label: "得分接应", minimum: 35, reliable: 75 },
      { id: "stableBlitz", label: "稳定突袭", minimum: 35, reliable: 75 },
      { id: "laneProtection", label: "封路保护", minimum: 35, reliable: 75 },
      { id: "openingSupport", label: "开路支援", minimum: 2, reliable: 14 }
    ],
    rerollFormula: "p' = p + (1 - p) × q × p",
    scenarios: [
      "Fast attack: the main index is 70% of mean expected reachable distance / 12 plus 30% of mean available legal maximum distance / 12. Open route and a route leaving one marked square have equal weight. The exact standing-arrival probabilities at 6, 8 and 10 squares remain separate observations; unreachable distances are zero in those columns, not a zero for the whole axis. Every required Rush, Dodge and action-reliability check is included.",
      "Ball control: equal-weight provisional mean of (a) open and marked ball acquisition, (b) retention against a normal hit and a Strip Ball hit, and (c) a marked handoff catch and Quick Pass-to-standard-receiver chain. All component probabilities stay on a 0–1 scale until the final 0–100 conversion.",
      "Lethality: the block route index is 75% safe knock-down probability + 25% safe removal probability. A safe knock-down is the repeatable combat result; removal adds severity but is a subset, not an independent event. The dimension takes the best of this block index, a special-attack removal path, and a conditional foul-removal path. Block dice are enumerated exactly; Brawler may strategically re-roll one Both Down on a declared Block, and Attacker Down outcomes are excluded from safe knock-down/removal. Stab, Chainsaw, Projectile Vomit and fouls remain separate conditional paths; opponent position, full team assists, and foul action chains are not yet modeled.",
      "Survival: equal-weight provisional mean of standing after the hit, remaining on the pitch now, and being available next drive, evaluated against equal-weight unassisted ST3/4/5/6 incoming Block benchmarks. Strength changes the block-dice chooser and resulting knockdown risk; the separately displayed Push rate exposes displacement risk. Strength itself does not cancel a selected Push. Regeneration affects only the later-drive component, never current pitch presence. Stunty, Thick Skull, Decay, Wrestle, Foul Appearance, Steady Footing, Chainsaw and Saboteur remain in their stated branches.",
      "Control: provisional index = min(100, stationary control + dynamic extension). Stationary control is the mean of the fixed pressure index and the player's probability of remaining standing after an unassisted ST3/4/5/6 Block; dynamic extension is that pressure index scaled by reachable distance. Reaching farther adds coverage; low Movement never subtracts control already supplied at the occupied square. The static survival event permits a one-square push within its radius-1 zone; exact starting-square retention is measured separately by the Bloodboard V3 task and is not yet calibrated into this legacy score. Strength changes block selection and knockdown risk, while Stand Firm/Rooted and legal push-square choice govern whether a selected Push moves the player. This capped sum is a comparison index, not a probability or full-board route solver; the reference opponent and task design remain provisional.",
      "Adaptability (player): five distinct role task values and their per-role provisional readiness bands are shown as a vector. No arbitrary cross-role weighting is used to invent one personal adaptability scalar. Team importance stays as a roster-specific five-task vector; team resilience is the task-retention vector after prioritized starters are removed, optionally summarized with an explicitly provisional equal-weight mean.",
      "All 66 star special rules are mapped to an effect class and relevant dimensions. A fixed-action effect uses the relevant probability difference (Δ score = 100 × (p after − p before)); one-use rules represent that action when available, not a match-frequency estimate. Paired/team effects, opponent-tag bonuses and match-duration resources show conditional values and are excluded from the solo baseline until the required context exists."
    ],
    sources: "Third Season Rulebook pp.32–33 (D6 and re-rolls), 37–40 (Armour and Knock-down), 54–58 (Movement, Dodge, Rush, Pick-up), 60–68 (Blocks and Injury), 70–74 (Pass and Catch), 121–138 (Skills); star-rule translations from 血碗橄榄球研究/分析/明星球员原始数据.json; implementation references for special-rule hooks in Bloodboard V5/src/engine/{stars,starActions,block,pass,specials,traits}.ts; May 2026 FAQ overrides the local engine's older modified-D6 lower-bound clamp."
  };

  // Every star has one special-rule record. `kind` selects a reproducible
  // fixed-action proxy below; context-only rules stay visible without being
  // converted into invented solo-player points.
  const STAR_RULE_MODELS = {
    akhorne: { dimensions: ["杀伤"], kind: "integrated", note: "无畏失败重掷已进入 Dauntless 阻挡路径" },
    anqiPanqi: { dimensions: ["杀伤"], kind: "blockRerollAll", note: "一次阻挡可重掷任意数量阻挡骰；按攻击者选骰时的整池重掷概率计入" },
    barik: { dimensions: ["控球", "适应力"], kind: "hailMaryContext", note: "万福玛利亚传球可重掷散球骰；接球队友接球 +1，依赖传球落点与队友" },
    bilerot: { dimensions: ["杀伤"], kind: "blockThenVomit", note: "每半场一次可在已阻挡后再使用喷射呕吐物；额外攻击需有第二个可攻击目标" },
    blackGobbo: { dimensions: ["杀伤", "适应力"], kind: "extraFoul", note: "每回合增加一次团队犯规行动；需队伍行动经济与倒地目标情境" },
    boa: { dimensions: ["控球"], kind: "integrated", note: "2+ 夺球并立即持球已进入控球模型" },
    bomber: { dimensions: ["控场", "杀伤"], kind: "bombCatch", note: "对手接住炸弹时可立即引爆；接球者自动倒地，邻格爆炸命中另需 4+" },
    karina: { dimensions: ["控球", "适应力"], kind: "bloodlustFallback", note: "Bloodlust 失败时可咬合格对手；修正依赖相邻且力量不高于 3 的目标" },
    cindy: { dimensions: ["杀伤", "生存"], kind: "doubleBomb", note: "两次炸弹行动提高爆炸机会，同时计入使用后的罚下风险" },
    luthor: { dimensions: ["适应力"], kind: "teamReroll", note: "达阵后团队重掷一次；团队资源效果，不虚加个人单项概率" },
    crumbleberry: { dimensions: ["快攻", "控球", "适应力"], kind: "pairOnly", note: "需与 Grak 配对；被抱起时获得技能的是 Grak（Break Tackle 与 Dodge），不是 Crumbleberry" },
    deeproot: { dimensions: ["控球", "适应力"], kind: "pairOnly", note: "队友被投掷脱手后的安全着陆；需队友与投掷队友行动情境" },
    dribl: { dimensions: ["杀伤"], kind: "pairAttack", note: "Dribl/Drull 同时盯防目标时 Stab 或犯规伤害 +1" },
    drull: { dimensions: ["杀伤"], kind: "pairAttack", note: "Dribl/Drull 同时盯防目标时 Stab 或犯规伤害 +1" },
    eldril: { dimensions: ["控场"], kind: "integrated", note: "催眠凝视失败重掷已进入控场路径" },
    estelle: { dimensions: ["控场", "适应力"], kind: "integrated", note: "2+ 封锁对手下一回合激活已进入控场路径" },
    fungus: { dimensions: ["快攻", "杀伤"], kind: "ballChainReroll", note: "Ball and Chain 方向失败重掷；其路线与攻击目标依赖场上布局" },
    glart: { dimensions: ["杀伤"], kind: "frenziedBlitz", note: "每半场一次的 Blitz 获得 Frenzy；按一次 Blitz 路径计入，不套用到普通 Block" },
    gloriel: { dimensions: ["控球"], kind: "hailMaryContext", note: "传球行动临时获得 Hail Mary Pass；改变可达范围但需队友、传球路线和落点" },
    glotl: { dimensions: ["生存", "适应力"], kind: "animalSavageryRedirect", note: "Animal Savagery 失败可改打相邻对手，避免误伤队友；需邻接情境" },
    grak: { dimensions: ["快攻", "控球", "适应力"], kind: "pairOnly", note: "与 Crumbleberry 配对后可携带并重新部署队友；需配对与空格情境" },
    grashnak: { dimensions: ["杀伤"], kind: "goredBlitz", note: "每场一次的 Blitz 额外阻挡骰；最多三骰，固定 ST3 对手下计入一次突袭" },
    gretchen: { dimensions: ["控场"], kind: "markedRouteControl", note: "每场一次激活时可免除整次激活的离区闪避；需要固定受标记路线情境，由 Bloodboard 控场任务计量；不改变 No Ball 的快攻/控球底线" },
    griff: { dimensions: ["快攻", "控球", "控场", "适应力"], kind: "agilityPlus", note: "一次敏捷检定 +1；按标准受标记移动路线的单次敏捷检定增量计入" },
    grim: { dimensions: ["杀伤"], kind: "conditionalDamage", note: "对 Big Guy 可选护甲或伤害 +1；显示符合目标标签时的条件分差，不混入普通对手基准" },
    grombrindal: { dimensions: ["适应力"], kind: "teamSkillGrant", note: "邻接队友临时获得四选一技能；必须有队友且技能机会依角色而变" },
    guffle: { dimensions: ["杀伤", "控球"], kind: "ballBite", note: "被盯防者接球时掷无修正护甲；破甲后立即夺球，控球增益按破甲率而非移出率计算" },
    hakflem: { dimensions: ["控球", "适应力"], kind: "teammateSteal", note: "从相邻持球队友处夺球；无回合交换但需队友当前持球" },
    helmut: { dimensions: ["杀伤"], kind: "armourReroll", note: "Pro 成功后重掷一枚失败护甲骰；按链锯攻击的护甲骰池逐面枚举" },
    hthark: { dimensions: ["杀伤"], kind: "blitzBlockReroll", note: "每次 Blitz 可重掷一枚阻挡骰；按一枚未击倒骰重掷后的增量计入" },
    ivan: { dimensions: ["杀伤"], kind: "conditionalDamage", note: "击倒后可选护甲或伤害 +1；若同一次阻挡行动中任何矮人被击倒，可改为 +2（不要求目标是矮人）" },
    ivar: { dimensions: ["快攻", "控场", "适应力"], kind: "teamMove", note: "每轮令一名队友无视擒抱区移动一格；需可用队友和落点" },
    jeremiahKool: { dimensions: ["杀伤", "快攻"], kind: "stabThenMove", note: "每场一次先对盯防目标 Stab、再执行移动；分别显示 Stab 移出率和随后移动情境" },
    jordell: { dimensions: ["快攻"], kind: "integrated", note: "一次移动检定设为 2+ 已进入快攻路线" },
    josefBugmanStar: { dimensions: ["生存"], kind: "survivalArmourReroll", note: "自身护甲失败时重掷一次；按被击倒后的破甲链降低移出风险" },
    karla: { dimensions: ["杀伤"], kind: "matchupStrength", note: "对 ST4+ 目标成功 Dauntless 后力量翻倍；固定 ST3 基准不触发，另列对抗加成" },
    kiroth: { dimensions: ["控场"], kind: "markedRouteControl", note: "每场一次使一名被其盯防的对手分心至下次激活；V3 对同一固定路线的自身净控场增加与对手控场削减进行配对引擎测量" },
    kreek: { dimensions: ["生存"], kind: "extraDrive", note: "免除首次 Secret Weapon 罚下；整场留场时长需赛程/裁判情境，单次 Block 分不包含" },
    lordBorak: { dimensions: ["杀伤"], kind: "blockReroll", note: "一次阻挡重掷一个阻挡骰；按单骰重掷的击倒概率增量计入" },
    maple: { dimensions: ["杀伤", "控场"], kind: "remoteBlock", note: "每半场一次可阻挡两格外目标；按指定两格目标情境列出完整攻击率，不冒充近身基准增益" },
    maxSpleenripper: { dimensions: ["杀伤"], kind: "integrated", note: "额外链锯攻击已进入杀伤路径" },
    mightyZug: { dimensions: ["杀伤"], kind: "armourPlus", note: "一次击倒后的护甲骰 +1；按阻挡破甲与伤害链计入" },
    morgNThorg: { dimensions: ["控球", "适应力"], kind: "passReroll", note: "传球或投掷队友的传球检定失败重掷；固定 Quick Pass 情境计入传球增量" },
    nobbla: { dimensions: ["杀伤", "生存"], kind: "chainsawFoul", note: "每场一次对倒地目标链锯攻击；展示该情境的破甲/移出率和免除犯规罚下的留场效果" },
    puggy: { dimensions: ["快攻", "控球", "杀伤", "控场", "适应力"], kind: "anyDieReroll", note: "一次重掷行动骰；按快攻路线中最有价值的未重掷检定计入" },
    rashnak: { dimensions: ["杀伤"], kind: "stabInjuryPlus", note: "一次 Stab 破甲后伤害 +1；按特殊攻击的伤害链计入" },
    ripper: { dimensions: ["快攻", "控球", "杀伤", "控场", "适应力"], kind: "anyDieReroll", note: "每半场重掷一个行动骰；按快攻路线中最有价值的未重掷检定计入" },
    rodney: { dimensions: ["控球"], kind: "integrated", note: "3+ 直接拾球路径已进入控球模型" },
    rowana: { dimensions: ["快攻"], kind: "leapReroll", note: "一次 Leap 忽略负面修正并重掷；按飞跃路线差值计入" },
    roxanna: { dimensions: ["杀伤"], kind: "clawsBlitz", note: "一次突袭获得 Claws；按突袭破甲路线计入" },
    rumbelow: { dimensions: ["杀伤"], kind: "ramOnce", note: "每场一次击倒后护甲或伤害 +1；只计一次阻挡的增量，不套用到每次 Block" },
    scrappa: { dimensions: ["控球", "控场"], kind: "interception", note: "干扰传球时 2+ 直接截球；按接近传球路线的夺球概率计入" },
    scyla: { dimensions: ["杀伤"], kind: "unchannelledFuryBlock", note: "Unchannelled Fury 失败时可执行两次阻挡；按失败分支的第二次阻挡路径计入" },
    skitter: { dimensions: ["杀伤"], kind: "integrated", note: "一次 Stab 失败破甲重掷已进入杀伤路径" },
    skrorg: { dimensions: ["杀伤", "适应力"], kind: "teamRerollOnCasualty", note: "移出目标后产生一次限时团队重掷；团队资源依赖整队回合" },
    skrull: { dimensions: ["控球"], kind: "passStrengthModifier", note: "传球检定后可加 ST，最高修正到 6；按个人 Quick Pass 检定计入" },
    lucien: { dimensions: ["杀伤"], kind: "pairBlockReroll", note: "目标被 Valen 盯防时重掷阻挡骰；仅对配对目标触发" },
    valen: { dimensions: ["控球"], kind: "pairPassRange", note: "传给 Lucien 不受距离修正；按 Long Bomb 距离情境展示效果" },
    swiftvine: { dimensions: ["快攻", "杀伤"], kind: "teleportStab", note: "三格布置后立即 Stab 并可再部署；按特殊攻击命中机会计入，布点依赖站位" },
    thorsson: { dimensions: ["控场", "杀伤", "生存"], kind: "barrelBash", note: "三格内 3+ 击倒目标；掷出 1 自身倒地。按 2/3 目标倒地计入控场，风险仅在特殊行动情境出现" },
    varag: { dimensions: ["杀伤"], kind: "armourRollRerollOnce", note: "每场一次击倒后重掷整颗护甲骰池；按一次 Block 的事件树计入" },
    wilhelm: { dimensions: ["杀伤"], kind: "injuryReroll", note: "一次伤害骰重掷；按击倒后的移出概率增量计入" },
    willow: { dimensions: ["生存"], kind: "survivalBlockReroll", note: "被阻挡时若将被击倒可重掷阻挡骰；按一次来袭阻挡的击倒率降低计入" },
    withergrasp: { dimensions: ["生存", "控场"], kind: "firstBlockDodge", note: "每半场首次被阻挡时获得 Dodge；按首次来袭的站立留区和生存变化计入，后续阻挡不重复触发" },
    zolcath: { dimensions: ["控场"], kind: "markedRouteControl", note: "每场一次使三格内一名对手分心至下次激活；V3 对同一固定路线的自身净控场增加与对手控场削减进行配对引擎测量" },
    zzharg: { dimensions: ["杀伤", "生存"], kind: "firearm", note: "火枪爆射命中、误伤与自伤均纳入事件链；站位会决定实际目标" }
  };

  const ids = player => new Set((player.skills || []).map(skill => typeof skill === "string" ? skill : skill.id).concat(player.boughtSkill || []));
  const has = (set, id) => set.has(id);
  const hasRule = (person, id) => (person.specialEffectCodes || []).includes(id);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const skillValue = (person, id, fallback) => {
    const ref = (person.skills || []).find(skill => typeof skill !== "string" && skill.id === id);
    return ref && Number.isFinite(Number(ref.value)) ? Number(ref.value) : fallback;
  };

  // May 2026 FAQ: modifiers can take a D6 total below 1; natural 1 still fails and natural 6 succeeds.
  function d6(target, modifier = 0) {
    let success = 0;
    for (let face = 1; face <= 6; face++) {
      if (face === 6 || (face !== 1 && face + modifier >= target)) success++;
    }
    return success / 6;
  }

  function withReroll(probability, q = 1) {
    return probability + (1 - probability) * q * probability;
  }

  function check(target, modifier, reroll = 0) {
    const p = d6(target, modifier);
    return reroll ? withReroll(p, reroll) : p;
  }

  const proReroll = set => has(set, "pro") ? 4 / 6 : 0;
  const BALL_REACH_DISTANCE = 6;
  const CONTROL_REACH_DISTANCE = 8;

  function actionReliability(person, set, action) {
    const blockish = action === "block" || action === "blitz";
    let probability = 1;
    if (has(set, "boneHead")) probability *= d6(2);
    // Half of Really Stupid activations have the fixed scenario's helpful adjacent team-mate.
    if (has(set, "reallyStupid")) probability *= average([d6(4), d6(4, 2)]);
    if (has(set, "unchannelledFury")) probability *= d6(4, blockish ? 2 : 0);
    if (has(set, "animalSavagery")) probability *= d6(4, blockish ? 2 : 0);
    if (has(set, "bloodlust")) {
      const roll = d6(skillValue(person, "bloodlust", 2), blockish ? 1 : 0);
      // A failed check can still complete the action if a Thrall can be bitten;
      // assume one is available in half of these situations.
      probability *= roll + (1 - roll) * 0.5;
    }
    return probability;
  }

  function rushProbability(person, set) {
    return d6(2, has(set, "drunkard") ? -1 : 0);
  }

  function movementChainProbability(tests, set, forced2PlusIndex = -1) {
    const resources = [
      { id: "dodge", bit: 1, q: 1, applies: test => test.kind === "dodge" && has(set, "dodge") },
      { id: "sureFeet", bit: 2, q: 1, applies: test => test.kind === "rush" && has(set, "sureFeet") },
      { id: "pro", bit: 4, q: 4 / 6, applies: () => has(set, "pro") }
    ];
    const memo = new Map();
    function complete(index, used) {
      if (index >= tests.length) return 1;
      const key = index + ":" + used;
      if (memo.has(key)) return memo.get(key);
      const test = tests[index];
      const p = index === forced2PlusIndex ? 5 / 6 : test.p;
      let probability = p * complete(index + 1, used);
      if (p < 1) {
        resources.forEach(resource => {
          if ((used & resource.bit) || !resource.applies(test)) return;
          probability = Math.max(probability,
            p * complete(index + 1, used) + (1 - p) * resource.q * p * complete(index + 1, used | resource.bit));
        });
      }
      memo.set(key, probability);
      return probability;
    }
    return complete(0, 0);
  }

  function movementRoute(person, set, targetDistance, markedSquares = [], useStarRule = false) {
    const ma = Math.max(0, Number(person.ma) || 0);
    const maxRushes = has(set, "sprint") ? 3 : 2;
    const maxDistance = ma + maxRushes;
    let dodgeModifier = has(set, "stunty") ? 0 : -1;
    if (has(set, "twoHeads")) dodgeModifier++;
    if (has(set, "titchy")) dodgeModifier++;
    const breakTackleModifier = has(set, "breakTackle") ? (person.st <= 3 ? 1 : person.st === 4 ? 2 : 3) : 0;
    const ag = person.ag == null ? 6 : person.ag;
    const tests = [];
    // A player ending on a marked square has not left that square yet, so the
    // Dodge check belongs only to marked squares strictly before the endpoint.
    for (const square of markedSquares.filter(square => square < Math.min(targetDistance, maxDistance))) {
      const canJump = has(set, "leap") || has(set, "pogo");
      let modifier = dodgeModifier;
      let kind = "dodge";
      if (canJump && !tests.some(test => test.kind === "jump")) {
        kind = "jump";
        modifier = has(set, "pogo") ? 0 : Math.max(-1, -1 + 1);
        if (has(set, "veryLongLegs")) modifier++;
      } else {
        modifier += breakTackleModifier && !tests.some(test => test.kind === "dodge") ? breakTackleModifier : 0;
      }
      tests.push({ p: d6(ag, modifier), rerolled: false, kind, square });
    }
    // A Rush roll happens after moving onto its square, so it gates progress
    // beyond that square rather than erasing the distance already gained.
    const rushesToTarget = Math.max(0, Math.min(targetDistance, maxDistance) - ma);
    for (let i = 0; i < rushesToTarget; i++) {
      tests.push({ p: rushProbability(person, set), rerolled: false, kind: "rush", square: ma + i + 1 });
    }
    const rushes = tests.filter(test => test.kind === "rush").length;
    const mustPass = tests.filter(test => test.kind === "dodge" || test.kind === "jump" || test.kind === "rush");
    const baseProbability = movementChainProbability(mustPass, set);
    let probability = baseProbability;
    let specialRuleGain = 0;
    if (useStarRule && hasRule(person, "swiftAsBreeze")) {
      // Swift as the Breeze can make one Dodge, Leap or Rush test a 2+ test,
      // ignoring modifiers. For this one-action route, choose the eligible
      // check that maximizes the route's success probability.
      mustPass.forEach((_, index) => {
        const candidate = movementChainProbability(mustPass, set, index);
        if (candidate > probability) probability = candidate;
      });
      specialRuleGain = probability - baseProbability;
    }
    return {
      probability: targetDistance > maxDistance ? 0 : probability,
      baseProbability: targetDistance > maxDistance ? 0 : baseProbability,
      specialRuleGain: targetDistance > maxDistance ? 0 : specialRuleGain,
      rushes,
      maxDistance,
      dodgeRates: tests.filter(test => test.kind === "dodge" || test.kind === "jump").map(test => test.p),
      rushRate: rushProbability(person, set),
      checks: tests
    };
  }

  function movementProfile(person, set, markedSquares = [], useStarRule = false) {
    const maxDistance = Math.max(0, Number(person.ma) || 0) + (has(set, "sprint") ? 3 : 2);
    let expectedDistance = 0;
    let baseExpectedDistance = 0;
    const reachBySquare = [];
    for (let distance = 1; distance <= maxDistance; distance++) {
      const route = movementRoute(person, set, distance, markedSquares, useStarRule);
      reachBySquare.push(route.probability);
      expectedDistance += route.probability;
      baseExpectedDistance += route.baseProbability;
    }
    const availability = actionReliability(person, set, "move") * (has(set, "takeRoot") ? d6(2) : 1);
    const fastDistances = [6, 8, 10];
    const fastRoutes = fastDistances.map(distance => movementRoute(person, set, distance, markedSquares, useStarRule));
    const baseFastRoutes = fastDistances.map(distance => movementRoute(person, set, distance, markedSquares, false));
    const fastAttackScore = average(fastRoutes.map(route => route.probability * availability));
    const baseFastAttackScore = average(baseFastRoutes.map(route => route.probability * availability));
    return {
      maxDistance,
      actionAvailability: availability,
      expectedDistance,
      baseExpectedDistance,
      availableDistance: expectedDistance * availability,
      baseAvailableDistance: baseExpectedDistance * availability,
      availableMaxDistance: maxDistance * availability,
      reachBySquare,
      completion8: movementRoute(person, set, 8, markedSquares, useStarRule).probability * availability,
      baseCompletion8: movementRoute(person, set, 8, markedSquares, false).probability * availability,
      fastDistances,
      fastRoutes: fastRoutes.map(route => route.probability * availability),
      fastAttackScore,
      baseFastAttackScore,
      starRuleFastAttackGain: Math.max(0, fastAttackScore - baseFastAttackScore),
      rushesFor13: movementRoute(person, set, 13, markedSquares).rushes,
      rushRate: rushProbability(person, set),
      dodgeRates: movementRoute(person, set, Math.min(maxDistance, 13), markedSquares).dodgeRates
    };
  }

  function pickupProbability(person, set, extraModifier = 0) {
    let modifier = -1; // one opposing Marking player
    if (has(set, "bigHand")) modifier = Math.max(0, modifier);
    if (has(set, "extraArms")) modifier++;
    modifier += extraModifier;
    const p = d6(person.ag == null ? 6 : person.ag, modifier);
    if (has(set, "sureHands")) return withReroll(p);
    return proReroll(set) ? withReroll(p, proReroll(set)) : p;
  }

  function catchProbability(person, set, extraModifier = 0) {
    let modifier = has(set, "nervesOfSteel") ? 0 : -1; // one opposing Marking player
    if (has(set, "extraArms")) modifier++;
    if (has(set, "divingCatch")) modifier++; // the fixed arrival is a Pass into the target square
    modifier += extraModifier;
    const p = d6(person.ag == null ? 6 : person.ag, modifier);
    if (has(set, "catch")) return withReroll(p);
    return proReroll(set) ? withReroll(p, proReroll(set)) : p;
  }

  function ballRetentionProbability(person, set, stripBallThreat = false) {
    const attackerSkills = stripBallThreat ? new Set(["stripBall"]) : new Set();
    const profile = blockOutcomeProfile({ st: 3 }, attackerSkills, Number(person.st) || 1, set);
    const knockdownLoss = profile.knockdown + profile.placedProne;
    const stripLoss = stripBallThreat && !has(set, "sureHands") ? profile.push : 0;
    const cancelled = has(set, "foulAppearance") ? 1 / 6 : 0;
    return clamp(1 - (knockdownLoss + stripLoss) * (1 - cancelled), 0, 1);
  }

  function passProbability(person, set, extraModifier = 0) {
    if (person.pa == null || has(set, "myBall")) return 0;
    let modifier = has(set, "nervesOfSteel") ? 0 : -1; // passer is Marked
    if (has(set, "accurate")) modifier++;
    modifier += extraModifier;
    const p = d6(person.pa, modifier); // Quick Pass has no range penalty
    if (has(set, "pass")) return withReroll(p);
    return proReroll(set) ? withReroll(p, proReroll(set)) : p;
  }

  function sum2d6(probability) {
    let result = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (probability(a + b, a + b >= 8)) result++;
    return result / 36;
  }

  function armourBreak(av, set, modifier = 0, useClaws = false) {
    return sum2d6(total => total + modifier >= av || (useClaws && total >= 8));
  }

  function removedOnInjury(person, set, modifier = 0) {
    const stunty = has(set, "stunty");
    const thickSkull = has(set, "thickSkull");
    // Standard and Sevens tables both remove the player at these lower bounds;
    // Thick Skull converts only the first KO result to Stunned.
    const threshold = stunty ? (thickSkull ? 8 : 7) : (thickSkull ? 9 : 8);
    return sum2d6(total => total + modifier >= threshold);
  }

  function removalAfterInjury(person, set, modifier = 0) {
    const removed = removedOnInjury(person, set, modifier);
    const baseCasualtyThreshold = has(set, "stunty") ? 9 : 10;
    const baseCasualty = sum2d6(total => total + modifier >= baseCasualtyThreshold);
    const casualty = sum2d6(total => total + modifier >= baseCasualtyThreshold - (has(set, "decay") ? 1 : 0));
    return removed - baseCasualty + casualty;
  }

  function injuryRemovalProfile(person, set, modifier = 0) {
    const koThreshold = has(set, "stunty") ? (has(set, "thickSkull") ? 8 : 7) : (has(set, "thickSkull") ? 9 : 8);
    const casualtyThreshold = (has(set, "stunty") ? 9 : 10) - (has(set, "decay") ? 1 : 0);
    let ko = 0;
    let casualty = 0;
    for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
      const total = first + second + modifier;
      if (total >= casualtyThreshold) casualty += 1 / 36;
      else if (total >= koThreshold) ko += 1 / 36;
    }
    return { ko, casualty, removed: ko + casualty };
  }

  function blockDice(attackerST, defenderST) {
    if (attackerST > defenderST) return { count: attackerST > 2 * defenderST ? 3 : 2, chooser: "attacker" };
    if (attackerST < defenderST) return { count: defenderST > 2 * attackerST ? 3 : 2, chooser: "defender" };
    return { count: 1, chooser: "attacker" };
  }

  function blockOutcomeProfile(attacker, attackerSet, defenderST = 3, defenderSet = new Set(), attackerDiceBonus = 0, declaredBlock = true) {
    const attackerST = Number(attacker.st) || 1;
    const dice = blockDice(attackerST, defenderST);
    const count = Math.min(3, dice.count + (dice.chooser === "attacker" ? attackerDiceBonus : 0));
    const { chooser } = dice;
    const result = face => {
      if (face === 1) return { knockdown: false, placedProne: false, armourable: false, push: false, attackerDown: true };
      if (face === 2) {
        if (has(defenderSet, "wrestle")) return { knockdown: false, placedProne: true, armourable: false, push: false, attackerDown: true };
        const attackerBlock = has(attackerSet, "block");
        const defenderBlock = has(defenderSet, "block");
        if (attackerBlock && defenderBlock) return { knockdown: false, placedProne: false, armourable: false, push: false, attackerDown: false };
        if (attackerBlock) return { knockdown: true, placedProne: false, armourable: true, push: false, attackerDown: false };
        if (defenderBlock) return { knockdown: false, placedProne: false, armourable: false, push: false, attackerDown: true };
        return { knockdown: true, placedProne: false, armourable: true, push: false, attackerDown: true };
      }
      if (face === 3 || face === 4) return { knockdown: false, placedProne: false, armourable: false, push: true };
      if (face === 5) {
        const down = has(attackerSet, "tackle") || !has(defenderSet, "dodge");
        return { knockdown: down, placedProne: false, armourable: down, push: !down, attackerDown: false };
      }
      if (face === 6) return { knockdown: true, placedProne: false, armourable: true, push: false, attackerDown: false };
      return { knockdown: false, placedProne: false, armourable: false, push: false, attackerDown: false };
    };
    let knockdown = 0;
    let placedProne = 0;
    let armourable = 0;
    let push = 0;
    let attackerTurnover = 0;
    let safeKnockdown = 0;
    let safeArmourable = 0;
    let samples = 0;
    const faces = [];
    const selectedOutcome = outcomes => {
      const rank = outcome => {
        const harm = outcome.armourable ? 4 : outcome.knockdown ? 3 : outcome.placedProne ? 2 : outcome.push ? 1 : 0;
        return harm + (outcome.attackerDown ? -10 : 0);
      };
      return outcomes.slice(1).reduce((best, outcome) => chooser === "attacker"
        ? (rank(outcome) > rank(best) ? outcome : best)
        : (rank(outcome) < rank(best) ? outcome : best), outcomes[0]);
    };
    const record = (outcome, probability = 1) => {
      if (outcome.knockdown) knockdown += probability;
      if (outcome.placedProne) placedProne += probability;
      if (outcome.armourable) armourable += probability;
      if (outcome.push) push += probability;
      if (outcome.attackerDown) attackerTurnover += probability;
      if (!outcome.attackerDown && (outcome.knockdown || outcome.placedProne)) safeKnockdown += probability;
      if (!outcome.attackerDown && outcome.armourable) safeArmourable += probability;
    };
    function enumerate(depth) {
      if (depth === count) {
        const outcomes = faces.map(result);
        const selected = selectedOutcome(outcomes);
        // Bloodboard V5, skills.ts / block.ts: Brawler is available only on
        // a declared Block and re-rolls one Both Down die. Compare expected
        // block-result utility before spending it, then enumerate that die's
        // six legal faces. The current fixed damage scenario is a declared Block.
        const bothDownIndex = declaredBlock && has(attackerSet, "brawler") ? faces.indexOf(2) : -1;
        if (bothDownIndex >= 0) {
          const originalRank = selectedOutcome(outcomes);
          const outcomeUtility = outcome => {
            const harm = outcome.armourable ? 4 : outcome.knockdown ? 3 : outcome.placedProne ? 2 : outcome.push ? 1 : 0;
            return harm + (outcome.attackerDown ? -10 : 0);
          };
          const rerolled = [];
          let rerollUtility = 0;
          for (let face = 1; face <= 6; face++) {
            const rerolledFaces = faces.slice();
            rerolledFaces[bothDownIndex] = face;
            const outcome = selectedOutcome(rerolledFaces.map(result));
            rerolled.push(outcome);
            rerollUtility += outcomeUtility(outcome) / 6;
          }
          if (rerollUtility > outcomeUtility(originalRank)) rerolled.forEach(outcome => record(outcome, 1 / 6));
          else record(selected);
        } else record(selected);
        samples++;
        return;
      }
      for (let face = 1; face <= 6; face++) { faces.push(face); enumerate(depth + 1); faces.pop(); }
    }
    enumerate(0);
    const divisor = samples || 1;
    return {
      knockdown: knockdown / divisor,
      placedProne: placedProne / divisor,
      armourable: armourable / divisor,
      push: push / divisor,
      attackerTurnover: attackerTurnover / divisor,
      safeKnockdown: safeKnockdown / divisor,
      safeArmourable: safeArmourable / divisor
    };
  }

  function blockKnockdownProbability(attacker, attackerSet, defenderST = 3, defenderSet = new Set()) {
    const profile = blockOutcomeProfile(attacker, attackerSet, defenderST, defenderSet);
    return profile.knockdown + profile.placedProne;
  }

  function blockOutcomes(attacker, attackerSet, defenderST = 3, defenderSet = new Set(), attackerDiceBonus = 0, declaredBlock = true) {
    const profile = blockOutcomeProfile(attacker, attackerSet, defenderST, defenderSet, attackerDiceBonus, declaredBlock);
    const knockdown = profile.knockdown + profile.placedProne;
    const armourableKnockdown = profile.armourable;
    let armour = armourBreak(9, attackerSet, 0, has(attackerSet, "claws"));
    let injury = removedOnInjury({ av: 9 }, new Set());
    let expectedRemoval = armourableKnockdown * armour * injury;
    let safeRemoval = profile.safeArmourable * armour * injury;
    if (has(attackerSet, "mightyBlow")) {
      const armourWithMightyBlow = armourBreak(9, attackerSet, 1, has(attackerSet, "claws"));
      const injuryWithMightyBlow = removedOnInjury({ av: 9 }, new Set(), 1);
      const damagePerKnockdown = armour * injuryWithMightyBlow + Math.max(0, armourWithMightyBlow - armour) * injury;
      expectedRemoval = armourableKnockdown * damagePerKnockdown;
      safeRemoval = profile.safeArmourable * damagePerKnockdown;
      armour = armourWithMightyBlow;
      injury = armour ? damagePerKnockdown / armour : 0;
    }
    return {
      knockdown,
      safeKnockdown: profile.safeKnockdown,
      armourableKnockdown,
      safeArmourableKnockdown: profile.safeArmourable,
      armour,
      injury,
      removal: safeRemoval,
      safeRemoval,
      expectedRemoval,
      turnover: profile.attackerTurnover,
      push: profile.push
    };
  }

  function blockRemovalWithArmorReroll(set) {
    const armour = armourBreak(9, set, 0, has(set, "claws"));
    const armourWithMightyBlow = armourBreak(9, set, 1, has(set, "claws"));
    const injury = removedOnInjury({ av: 9 }, new Set());
    const injuryWithMightyBlow = removedOnInjury({ av: 9 }, new Set(), 1);
    const afterFreshArmour = armour * injuryWithMightyBlow + Math.max(0, armourWithMightyBlow - armour) * injury;
    let probability = 0;
    for (let total = 2; total <= 12; total++) {
      let outcomes = 0;
      for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) if (first + second === total) outcomes++;
      const result = total >= 9 ? injuryWithMightyBlow : total === 8 ? Math.max(injury, afterFreshArmour) : afterFreshArmour;
      probability += outcomes / 36 * result;
    }
    return probability;
  }

  function foulRemovalChance(person, set, armourModifier = 0, injuryModifier = 0) {
    const dirty = has(set, "dirtyPlayer");
    const lone = has(set, "loneFouler");
    const sneaky = has(set, "sneakyGit");
    const targetAV = 9;
    const safeInjury = bonus => {
      let probability = 0;
      for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
        const total = first + second + injuryModifier + bonus;
        const removed = total >= 8; // unskilled AV9 target: KO or Casualty
        if (removed && first !== second) probability += 1 / 36;
      }
      return probability;
    };
    const afterArmourRoll = (first, second) => {
      const naturalDouble = first === second;
      const total = first + second + armourModifier;
      let broken = total >= targetAV;
      let injuryBonus = 0;
      if (!broken && dirty && total + 1 >= targetAV) broken = true;
      else if (broken && dirty) injuryBonus = 1;
      if (!broken) return naturalDouble && !sneaky ? 0 : 0;
      // A double on a broken Armour Roll sends the fouler off. Sneaky Git only
      // forgives an Armour double when the armour remains intact.
      if (naturalDouble) return 0;
      return safeInjury(injuryBonus);
    };
    let probability = 0;
    for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
      const total = first + second + armourModifier;
      const initial = afterArmourRoll(first, second);
      let best = initial;
      if (lone && total < targetAV) {
        let rerollExpected = 0;
        for (let rerollFirst = 1; rerollFirst <= 6; rerollFirst++) for (let rerollSecond = 1; rerollSecond <= 6; rerollSecond++) {
          rerollExpected += afterArmourRoll(rerollFirst, rerollSecond) / 36;
        }
        best = Math.max(best, rerollExpected);
      }
      probability += best / 36;
    }
    return probability;
  }

  function lethality(person, set) {
    let dauntlessPass = has(set, "dauntless") && person.st < 3 ? d6(4 - Number(person.st)) : 0;
    if (dauntlessPass && hasRule(person, "blindRage")) dauntlessPass = withReroll(dauntlessPass);
    const standard = blockOutcomes(person, set);
    const blockAvailability = actionReliability(person, set, "block");
    const specialAvailability = actionReliability(person, set, "special");
    const foulAvailability = actionReliability(person, set, "foul");
    let baseBlock = standard;
    if (dauntlessPass) {
      const equal = blockOutcomes(Object.assign({}, person, { st: 3 }), set);
      baseBlock = {
        removal: dauntlessPass * equal.removal + (1 - dauntlessPass) * standard.removal,
        knockdown: dauntlessPass * equal.knockdown + (1 - dauntlessPass) * standard.knockdown,
        push: dauntlessPass * equal.push + (1 - dauntlessPass) * standard.push
      };
    }
    let blockRemoval = baseBlock.removal;
    let blockKnockdown = baseBlock.knockdown;
    if (has(set, "frenzy")) {
      const followUp = baseBlock;
      blockRemoval += baseBlock.push * followUp.removal;
      blockKnockdown += baseBlock.push * followUp.knockdown;
    }
    if (has(set, "horns")) {
      const blitz = blockOutcomes(Object.assign({}, person, { st: (Number(person.st) || 1) + 1 }), set, 3, new Set(), 0, false);
      blockRemoval = (2 / 3) * blockRemoval + (1 / 3) * blitz.removal;
      blockKnockdown = (2 / 3) * blockKnockdown + (1 / 3) * blitz.knockdown;
    }
    if (has(set, "multipleBlock")) {
      const reduced = blockOutcomes(Object.assign({}, person, { st: Math.max(1, (Number(person.st) || 1) - 2) }), set);
      const twoTargetRemoval = 1 - (1 - reduced.removal) ** 2;
      blockRemoval = Math.max(blockRemoval, 0.25 * twoTargetRemoval);
    }
    if (has(set, "ballAndChain")) blockRemoval *= 0.35;
    blockRemoval *= blockAvailability;
    blockKnockdown *= blockAvailability;

    // Special attacks share the same opponent and injury assumptions. Their
    // exact rule check is multiplied through the armour/injury chain.
    let specialRemoval = 0;
    const targetInjury = removedOnInjury({ av: 9 }, new Set());
    if (has(set, "stab")) {
      let stabArmour = armourBreak(9, set);
      if (hasRule(person, "masterAssassin")) stabArmour = withReroll(stabArmour);
      specialRemoval = Math.max(specialRemoval, stabArmour * targetInjury);
    }
    if (has(set, "chainsaw")) specialRemoval = Math.max(specialRemoval, (5 / 6) * armourBreak(9, set, 3) * targetInjury);
    if (has(set, "projectileVomit") || hasRule(person, "putridRegurgitation")) specialRemoval = Math.max(specialRemoval, (5 / 6) * armourBreak(9, set) * targetInjury);
    specialRemoval *= specialAvailability;
    if (hasRule(person, "maximumCarnage")) {
      // One match-use of Maximum Carnage permits a second Chainsaw Attack
      // against another player; score the chance of at least one removal
      // across the two independent target rolls.
      specialRemoval = 1 - (1 - specialRemoval) ** 2;
    }
    // Dirty Player's value is modelled as an unaided Foul against an opponent
    // who is already Prone: +1 to the Armour roll, then the normal Injury roll.
    // This is explicitly a conditional action path, not a Block modifier.
    const foulArmourModifier = has(set, "chainsaw") ? 3 : 0;
    const foulAction = foulRemovalChance(person, set, foulArmourModifier) * (has(set, "chainsaw") ? 5 / 6 : 1) * foulAvailability;
    const pileDriverFoul = has(set, "pileDriver") ? blockKnockdown * 0.5 * foulRemovalChance(person, set) : 0;
    const dirtyPlayerFoul = has(set, "dirtyPlayer") || has(set, "loneFouler") || has(set, "chainsaw")
      ? Math.max(foulAction, pileDriverFoul)
      : pileDriverFoul;
    const removal = Math.max(blockRemoval, specialRemoval, dirtyPlayerFoul);
    const expectedRemoval = Math.max(baseBlock.expectedRemoval, specialRemoval, dirtyPlayerFoul);
    const safeKnockdown = Math.max(0, (baseBlock.safeKnockdown + (has(set, "frenzy") ? standard.push * baseBlock.safeKnockdown : 0)) * blockAvailability);
    // Damage index distinguishes a reliable safe knock-down from the rarer,
    // more severe removal. Other attack routes are conditional alternatives,
    // so use their removal chance as an alternative index rather than adding
    // mutually exclusive action probabilities together.
    const blockImpact = 0.75 * safeKnockdown + 0.25 * blockRemoval;
    const impact = Math.max(blockImpact, specialRemoval, dirtyPlayerFoul);
    const turnover = standard.turnover * blockAvailability;
    return Object.assign({}, standard, {
      knockdown: blockKnockdown,
      safeKnockdown,
      blockImpact,
      impact,
      removal,
      safeRemoval: removal,
      expectedRemoval,
      turnover,
      specialRemoval,
      dirtyPlayerFoul,
      blockAvailability,
      specialAvailability,
      foulAvailability
    });
  }

  function survival(person, set) {
    const defenderST = Number(person.st) || 1;
    const blockCancelled = has(set, "foulAppearance") ? 1 / 6 : 0;
    const chainsawModifier = has(set, "chainsaw") && !has(set, "ironHardSkin") ? 3 : 0;
    const armour = armourBreak(Number(person.av) || 9, set, chainsawModifier);
    const injury = injuryRemovalProfile(person, set);
    const recoveryOnNextDrive = injury.ko * 0.5 + injury.casualty * (has(set, "regeneration") ? 0.5 : 1);
    const byOpponentST = [3, 4, 5, 6].map(attackerST => {
      const incomingProfile = blockOutcomeProfile({ st: attackerST }, new Set(), defenderST, set);
      const knockdown = incomingProfile.knockdown * (has(set, "steadyFooting") ? 5 / 6 : 1) * (1 - blockCancelled);
      const placedProne = incomingProfile.placedProne * (1 - blockCancelled);
      const push = incomingProfile.push * (1 - blockCancelled);
      const ordinaryRemoval = knockdown * armour * injury.removed;
      // Saboteur: when an opposing Block knocks this player down, 4+ removes
      // this player as a KO before the ordinary Armour/Injury chain.
      const saboteurRemoval = has(set, "saboteur") ? knockdown * (0.5 + 0.5 * armour * injury.removed) : ordinaryRemoval;
      const removal = clamp(saboteurRemoval, 0, 1);
      const standing = clamp(1 - knockdown - placedProne, 0, 1);
      const onPitch = 1 - removal;
      // Saboteur's forced KO branch also has to pass the later-drive recovery check.
      const laterRemoval = knockdown * (has(set, "saboteur")
        ? 0.5 * 0.5 + 0.5 * armour * recoveryOnNextDrive
        : armour * recoveryOnNextDrive);
      return {
        attackerST,
        standing,
        onPitch,
        nextDriveAvailable: clamp(1 - laterRemoval, 0, 1),
        knockdown,
        placedProne,
        push,
        currentRemoval: removal,
        laterRemoval
      };
    });
    const standing = average(byOpponentST.map(row => row.standing));
    const onPitch = average(byOpponentST.map(row => row.onPitch));
    const nextDriveAvailable = average(byOpponentST.map(row => row.nextDriveAvailable));
    const knockdown = average(byOpponentST.map(row => row.knockdown));
    const placedProne = average(byOpponentST.map(row => row.placedProne));
    const push = average(byOpponentST.map(row => row.push));
    const removal = average(byOpponentST.map(row => row.currentRemoval));
    const laterRemoval = average(byOpponentST.map(row => row.laterRemoval));
    const score = 100 * average([standing, onPitch, nextDriveAvailable]);
    return {
      score,
      standing,
      onPitch,
      nextDriveAvailable,
      knockdown,
      placedProne,
      push,
      byOpponentST,
      attackerStrengths: [3, 4, 5, 6],
      armour,
      injury: injury.removed,
      ko: injury.ko,
      casualty: injury.casualty,
      currentRemoval: removal,
      laterRemoval,
      blockCancelled,
      chainsawModifier,
      regeneration: has(set, "regeneration"),
      decay: has(set, "decay"),
      wrestle: has(set, "wrestle"),
      saboteurRemoval: has(set, "saboteur") ? 100 * removal : null
    };
  }

  function control(person, set) {
    const opponentAG = 3;
    let modifier = -1; // one marking opponent
    if (has(set, "prehensileTail")) modifier--;
    const baseTest = d6(opponentAG, modifier);
    const escape = d6(opponentAG, modifier - (has(set, "divingTackle") ? 2 : 0));
    // Dodge is re-rolled before Diving Tackle applies its late -2 modifier.
    const dodge = has(set, "tackle") ? escape : has(set, "divingTackle")
      ? escape + (1 - baseTest) * escape
      : withReroll(escape); // the standard opponent has Dodge
    const opponentST = 3;
    const tentacle = has(set, "tentacles") ? d6(6, Number(person.st) - opponentST) : 0;
    const shadowing = has(set, "shadowing") ? d6(4) : 0;
    const held = tentacle + (1 - tentacle) * (1 - dodge * (1 - shadowing));
    const blockThreat = blockKnockdownProbability(person, set, opponentST, new Set(["dodge"])) * actionReliability(person, set, "block");
    const neutralBlocker = { st: 3 };
    const neutralAttackerSet = new Set(["block"]);
    const noSupport = blockOutcomeProfile(neutralBlocker, neutralAttackerSet, 3, new Set());
    // One ST3 ally is marked and cannot normally assist. Guard lets that same
    // ally assist, changing the ST3 blocker from one die to two dice vs ST3.
    const guardedSupport = blockOutcomeProfile({ st: 4 }, neutralAttackerSet, 3, new Set());
    const guardSupport = has(set, "guard")
      ? Math.max(0, guardedSupport.safeKnockdown - noSupport.safeKnockdown)
      : 0;
    const specialAvailability = actionReliability(person, set, "special");
    let gazeTest = has(set, "hypnoticGaze") ? d6(Number(person.ag) || 3) : 0;
    if (gazeTest && hasRule(person, "mesmerizingDance")) gazeTest = withReroll(gazeTest);
    const hypnoticGaze = has(set, "hypnoticGaze") ? gazeTest * (1 / 3) * specialAvailability : 0;
    const monstrousMouth = has(set, "monstrousMouth") ? d6(Number(person.ag) || 3) * (1 / 3) * specialAvailability : 0;
    const balefulHex = hasRule(person, "balefulHex") ? d6(2) : 0;
    const breatheFire = has(set, "breatheFire") ? d6(4) * (1 / 3) * specialAvailability : 0;
    const specialHold = Math.max(hypnoticGaze, monstrousMouth, breatheFire, balefulHex);
    const foulAppearance = has(set, "foulAppearance") ? 1 / 6 : 0;
    const physicalControl = 0.45 * held + 0.35 * blockThreat + 0.20 * specialHold + 0.10 * guardSupport + foulAppearance;
    return { held: clamp(physicalControl, 0, 1), escape: dodge, tentacle, blockThreat, shadowing, specialHold, foulAppearance, guardSupport };
  }

  function staticControlRetention(person, set) {
    const targetST = Number(person.st) || 1;
    const blockCancelled = has(set, "foulAppearance") ? 1 / 6 : 0;
    // Watch Out! starts unused in this isolated first-Block benchmark and
    // grants Dodge to Withergrasp for that one defensive task.
    const defensiveSet = new Set(set);
    if (person.specialRules && STAR_RULE_MODELS[person.id]?.kind === "firstBlockDodge") defensiveSet.add("dodge");
    const byOpponentST = [3, 4, 5, 6].map(opponentST => {
      const result = blockOutcomeProfile({ st: opponentST }, new Set(), targetST, defensiveSet);
      const knockdown = result.knockdown * (has(set, "steadyFooting") ? 5 / 6 : 1) * (1 - blockCancelled);
      const placedProne = result.placedProne * (1 - blockCancelled);
      const push = result.push * (1 - blockCancelled);
      return { opponentST, standing: clamp(1 - knockdown - placedProne, 0, 1), push };
    });
    return { probability: average(byOpponentST.map(row => row.standing)), byOpponentST };
  }

  function composeControlScore(pressure, staticRetention, reach) {
    const stationary = 100 * average([clamp(pressure, 0, 1), clamp(staticRetention, 0, 1)]);
    const dynamic = 100 * clamp(pressure, 0, 1) * clamp(reach, 0, 1);
    return { score: clamp(stationary + dynamic, 0, 100), stationary, dynamic };
  }

  function ruleName(ruleText) {
    return String(ruleText || "明星专属规则").split(/[：:]/, 1)[0].trim();
  }

  function marginalDamage(person, set, kill, { armourModifier = 0, injuryModifier = 0, rerollArmour = false, rerollInjury = false, matchupRate = 1 } = {}) {
    const armour = armourBreak(9, set, 0, has(set, "claws"));
    const injury = removedOnInjury({ av: 9 }, new Set());
    let revisedArmour = armourBreak(9, set, armourModifier, has(set, "claws"));
    let revisedInjury = removedOnInjury({ av: 9 }, new Set(), injuryModifier);
    if (rerollArmour) revisedArmour = withReroll(revisedArmour);
    if (rerollInjury) revisedInjury = withReroll(revisedInjury);
    const base = armour * injury;
    const revised = revisedArmour * revisedInjury;
    return Math.min(Math.max(0, 100 - 100 * kill.removal), Math.max(0, 100 * kill.knockdown * (revised - base) * matchupRate));
  }

  function armourBreakWithOneDieReroll(av, set, modifier = 0, proRate = 4 / 6) {
    let probability = 0;
    for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
      if (first + second + modifier >= av) {
        probability += 1 / 36;
        continue;
      }
      const rerollFirst = Array.from({ length: 6 }, (_, index) => index + 1).filter(face => face + second + modifier >= av).length / 6;
      const rerollSecond = Array.from({ length: 6 }, (_, index) => index + 1).filter(face => first + face + modifier >= av).length / 6;
      probability += Math.max(rerollFirst, rerollSecond) * proRate / 36;
    }
    return probability;
  }

  function blockActionRemoval(person, set, targetST = 3, diceBonus = 0, addFrenzy = false) {
    const actionSet = new Set(set);
    if (addFrenzy) actionSet.add("frenzy");
    const first = blockOutcomes(person, actionSet, targetST, new Set(), diceBonus, false);
    const sequence = first.removal + (has(actionSet, "frenzy") ? first.push * first.removal : 0);
    return sequence * actionReliability(person, actionSet, "blitz");
  }

  function movementRuleGain(kind, person, set, movement, moveActionReliability) {
    const ag = Number(person.ag) || 6;
    const markedCheck = d6(ag, has(set, "stunty") ? 0 : -1);
    let improved = markedCheck;
    if (kind === "agilityPlus") improved = d6(ag, (has(set, "stunty") ? 0 : -1) + 1);
    if (kind === "moveNoDodge") improved = 1;
    if (kind === "leapReroll" || kind === "anyDieReroll") improved = withReroll(markedCheck);
    const downstreamSquares = Math.max(1, Math.min(Number(person.ma) || 0, movement.maxDistance));
    const fastBase = 100 * movement.fastAttackScore;
    return Math.min(Math.max(0, 100 - fastBase), Math.max(0, (improved - markedCheck) * downstreamSquares * 100 / 8 * moveActionReliability));
  }

  function evaluateUncodedRule(model, person, set, metrics) {
    const { kill, survive, ball, baseBall, pickup, catchBall, quickPass, movement, movementReach, controlResult, controlReach, moveActionReliability } = metrics;
    const out = { scoreGain: null, targetDimension: model.dimensions[0], includedInScore: false, status: "情境规则已识别" };
    const ballPath = (chance, divisor = 4) => Math.max(0, Math.min(100 - ball, 100 * (chance - ((pickup + catchBall + quickPass) / 3) / 100) * movementReach / divisor));
    const normalInjury = removedOnInjury({ av: 9 }, new Set());
    const normalArmour = armourBreak(9, set, 0, has(set, "claws"));
    switch (model.kind) {
      case "blockReroll":
      case "blockRerollAll": {
        const targetDice = blockDice(Number(person.st) || 1, 3);
        const rerollableDice = targetDice.chooser === "attacker" ? targetDice.count : 0;
        const baseDown = blockOutcomeProfile(person, set, 3, new Set()).knockdown;
        const singleDieDown = blockOutcomeProfile(Object.assign({}, person, { st: 3 }), set, 3, new Set()).knockdown;
        const rerollCount = model.kind === "blockRerollAll" ? rerollableDice : Math.min(1, rerollableDice);
        const rerolledDown = rerollCount ? 1 - Math.pow(1 - singleDieDown, targetDice.count + rerollCount) : baseDown;
        const blockPathGain = Math.max(0, (rerolledDown - baseDown) * normalArmour * normalInjury * actionReliability(person, set, "block") * 100);
        out.scoreGain = Math.min(100 - 100 * kill.removal, blockPathGain);
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "固定阻挡情境已计入"; break;
      }
      case "conditionalDamage": {
        const armourChoice = marginalDamage(person, set, kill, { armourModifier: 1 });
        const injuryChoice = marginalDamage(person, set, kill, { injuryModifier: 1 });
        if (person.id === "ivan") {
          const one = Math.max(armourChoice, injuryChoice);
          const two = Math.max(marginalDamage(person, set, kill, { armourModifier: 2 }), marginalDamage(person, set, kill, { injuryModifier: 2 }));
          out.scoreGain = one;
          out.includedInScore = true;
          out.conditionalGain = Math.max(0, two - one);
          out.conditionalLabel = "同次阻挡中任一矮人被击倒时，可将 +1 提升至 +2；此处仅列额外增量";
          out.status = "一次性 +1 已计入标准目标；若同次阻挡中任一矮人被击倒（目标不必是矮人），另显示提升至 +2 的差值";
        } else {
          out.conditionalGain = Math.max(armourChoice, injuryChoice);
          out.status = "仅在特殊规则的目标标签满足时触发；此对位增益未计入普通 ST3 基准总分";
        }
        out.targetDimension = "杀伤"; break;
      }
      case "ramOnce": {
        out.scoreGain = Math.max(marginalDamage(person, set, kill, { armourModifier: 1 }), marginalDamage(person, set, kill, { injuryModifier: 1 }));
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "一次阻挡击倒后，可在护甲或负伤骰上择优 +1；单次可用行动增益已计入"; break;
      }
      case "armourRollRerollOnce": {
        const beforePerDown = kill.armourableKnockdown ? kill.removal / kill.armourableKnockdown : 0;
        const afterPerDown = blockRemovalWithArmorReroll(set);
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * kill.armourableKnockdown * (afterPerDown - beforePerDown) * actionReliability(person, set, "block")));
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "击倒后可选一次整颗护甲骰重掷；只按一次动作的护甲/伤害链计算"; break;
      }
      case "frenziedBlitz": {
        const ordinaryBlitz = blockActionRemoval(person, set, 3, 0, false);
        const frenzyBlitz = blockActionRemoval(person, set, 3, 0, true);
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * (frenzyBlitz - ordinaryBlitz)));
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "限定一次 Blitz；第二次阻挡只在首次未击倒且目标仍可继续阻挡时计入"; break;
      }
      case "goredBlitz": {
        const ordinary = blockActionRemoval(person, set, 3, 0, false);
        const extraDie = blockActionRemoval(person, set, 3, 1, false);
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * (extraDie - ordinary)));
        out.targetDimension = "杀伤"; out.includedInScore = true;
        out.status = "每场一次突袭的额外阻挡骰按 ST3 固定目标计入；若已有 Frenzy，第二次阻挡也沿用额外骰，最多三骰"; break;
      }
      case "blitzBlockReroll": {
        const dice = blockDice(Number(person.st) || 1, 3);
        const die = blockOutcomeProfile({ st: 3 }, set, 3, new Set());
        const dieKnockdown = die.knockdown + die.placedProne;
        const selected = blockOutcomes(person, set, 3, new Set(), 0, false);
        const damagePerKnockdown = selected.armourableKnockdown ? selected.removal / selected.armourableKnockdown : 0;
        const rerollGain = dice.chooser === "attacker" ? Math.pow(1 - dieKnockdown, dice.count) * dieKnockdown : 0;
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * rerollGain * damagePerKnockdown * actionReliability(person, set, "blitz")));
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "一次 Blitz 的阻挡骰重掷；只计算原始骰池没有击倒时的额外成功率"; break;
      }
      case "armourPlus":
        out.scoreGain = marginalDamage(person, set, kill, { armourModifier: 1 });
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "固定阻挡情境已计入"; break;
      case "armourReroll":
        {
          const baseArmour = armourBreak(9, set, 3);
          const revisedArmour = armourBreakWithOneDieReroll(9, set, 3, 4 / 6);
          const targetInjury = removedOnInjury({ av: 9 }, new Set());
          out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * (5 / 6) * (revisedArmour - baseArmour) * targetInjury * actionReliability(person, set, "special")));
          out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "Pro 成功后只重掷失败护甲骰中的一枚；按链锯 +3 护甲修正的 2D6 骰面枚举"; break;
        }
      case "injuryReroll":
        out.scoreGain = marginalDamage(person, set, kill, { rerollInjury: true });
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "固定阻挡情境已计入"; break;
      case "stabInjuryPlus":
        {
          const stabArmour = armourBreak(9, set);
          const stabInjury = removedOnInjury({ av: 9 }, new Set());
          const improved = removedOnInjury({ av: 9 }, new Set(), 1);
          out.scoreGain = 100 * stabArmour * (improved - stabInjury) * actionReliability(person, set, "special");
          out.includedInScore = true;
          out.targetDimension = "杀伤"; out.status = "一次性 Stab 破甲后 +1 负伤，按 Stab 自身护甲/负伤链计入"; break;
        }
      case "agilityPlus": case "moveNoDodge": case "leapReroll":
        if (model.kind === "agilityPlus") {
          const fastGain = has(set, "noBall") ? 0 : movementRuleGain(model.kind, person, set, movement, moveActionReliability);
          const pickupGain = has(set, "noBall") ? 0 : 100 * Math.max(0, pickupProbability(person, set, 1) - pickupProbability(person, set)) * moveActionReliability * movementReach / 3;
          const catchGain = has(set, "noBall") ? 0 : 100 * Math.max(0, catchProbability(person, set, 1) - catchProbability(person, set)) * movementReach / 3;
          const ballGain = Math.min(100 - ball, Math.max(pickupGain, catchGain));
          if (ballGain > fastGain) {
            out.scoreGain = ballGain;
            out.targetDimension = "控球";
          } else {
            out.scoreGain = fastGain;
            out.targetDimension = "快攻";
          }
        } else {
          out.scoreGain = has(set, "noBall") ? 0 : movementRuleGain(model.kind, person, set, movement, moveActionReliability);
          out.targetDimension = "快攻";
        }
        out.includedInScore = true; out.status = has(set, "noBall") ? "规则效果已识别；No Ball 按既定口径使快攻与控球保持 0" : "固定受标记行动路线已计入"; break;
      case "markedRouteControl":
        out.targetDimension = "控场";
        out.status = person.id === "kiroth"
          ? "条件效果：Black Ink 每场一次，必须指定 Kiroth 激活开始时正盯防的目标；V3 control.dynamic 配对记录自身控场变化、对手控场区削减及路线成功率，未给使用频率前不折算固定分"
          : person.id === "zolcath"
            ? "条件效果：每场一次，可指定 Zolcath 激活开始时三格内的一名站立对手；V3 control.dynamic 配对记录自身控场变化、对手控场区削减及路线成功率，未给目标/使用频率前不折算固定分"
            : "条件效果：虚影每场只能用一次，必须指定受标记移动路线；其净团队控场变化由 V3 control.dynamic 的 Bloodboard 终局任务记录。未给路线与战术使用频率前，不折算成固定个人控场分；No Ball 仍使快攻、控球保持 0";
        break;
      case "anyDieReroll": {
        const movementGain = has(set, "noBall") ? 0 : movementRuleGain("anyDieReroll", person, set, movement, moveActionReliability);
        const pickupGain = has(set, "noBall") ? 0 : 100 * Math.max(0, withReroll(pickupProbability(person, set)) - pickupProbability(person, set)) * moveActionReliability * movementReach / 3;
        const pass = passProbability(person, set);
        const passGain = has(set, "noBall") ? 0 : 100 * Math.max(0, withReroll(pass) - pass) * movementReach / 3;
        const blockDie = blockOutcomeProfile(Object.assign({}, person, { st: 3 }), set, 3, new Set()).knockdown;
        const blockGain = 100 * (1 - kill.knockdown) * blockDie * normalArmour * normalInjury;
        const options = [[movementGain, "快攻"], [pickupGain, "控球"], [passGain, "控球"], [blockGain, "杀伤"]].sort((a, b) => b[0] - a[0]);
        out.scoreGain = Math.min(100 - (options[0][1] === "快攻" ? 100 * movement.fastAttackScore : options[0][1] === "控球" ? ball : 100 * kill.removal), options[0][0]);
        out.targetDimension = options[0][1]; out.includedInScore = true; out.status = "按快攻、控球、杀伤固定检定中收益最高的一次重掷计入"; break;
      }
      case "passReroll": {
        const pass = passProbability(person, set);
        const revised = withReroll(pass);
        out.scoreGain = Math.min(100 - ball, 100 * (revised - pass) * movementReach / 3);
        out.targetDimension = "控球"; out.includedInScore = true; out.status = "快速传球检定已计入；投掷队友条件另见说明"; break;
      }
      case "passStrengthModifier": {
        const modifier = Math.max(0, Math.min(Number(person.st) || 0, 6 - (Number(person.pa) || 6)));
        const revised = passProbability(person, set, modifier);
        out.scoreGain = Math.min(100 - ball, Math.max(0, 100 * (revised - passProbability(person, set)) * movementReach / 3));
        out.targetDimension = "控球"; out.includedInScore = true; out.status = "按 ST 加值且传球检定最高修正至 6 计算"; break;
      }
      case "hailMaryContext":
        out.status = "规则效果会改写长传/散球落点或接球队友的成功率；需球场路线与队友站位，单人 Quick Pass 分不代替该情境"; break;
      case "interception":
        out.scoreGain = ballPath(d6(2), 4);
        out.targetDimension = "控球"; out.includedInScore = true; out.status = "一次干扰传球的 2+ 截球路径已按第四种球权路线计入"; break;
      case "extraFoul":
        out.conditionalGain = 100 * foulRemovalChance(person, set);
        out.targetDimension = "杀伤"; out.status = "队伍第二次犯规行动由该明星执行且目标已倒地时的单次犯规移出率"; break;
      case "barrelBash":
        out.scoreGain = Math.min(100 - metrics.controlScore, 100 * (2 / 3) * 0.20 * controlReach);
        out.secondaryScoreGain = Math.max(0, 100 * (2 / 3) * normalArmour * normalInjury - 100 * kill.removal);
        out.secondaryTargetDimension = "杀伤";
        out.riskProbability = 100 / 6;
        out.riskLabel = "自身倒地（不是移出场）";
        out.targetDimension = "控场"; out.includedInScore = true; out.status = "三格内 3+ 击倒目标：按控场模型计入控场，另按破甲/负伤链与标准 Block 取较高杀伤；掷出 1 自身倒地，单独列风险"; break;
      case "firearm": {
        const shot = (5 / 6) * armourBreak(9, new Set()) * normalInjury * actionReliability(person, set, "special");
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * shot - 100 * kill.removal));
        out.secondaryScoreGain = -100 * (1 / 6) * armourBreak(Number(person.av) || 9, set) * removalAfterInjury(person, set);
        out.secondaryTargetDimension = "生存";
        out.secondaryConditionalGain = out.secondaryScoreGain;
        out.secondaryConditionalLabel = "生存情境：掷出 1 时自伤";
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "固定单名目标假设：3+ 命中指定目标，2 点数由对手选择且场上仅有该目标；按 5/6 命中和护甲/负伤链计入。1 点自伤的移出风险同时扣入生存"; break;
      }
      case "survivalArmourReroll": {
        const armour = armourBreak(Number(person.av) || 9, set, survive.chainsawModifier);
        const injury = removalAfterInjury(person, set);
        out.scoreGain = Math.max(0, Math.min(100 - survive.score, 100 * survive.knockdown * (withReroll(armour) - armour) * injury));
        out.targetDimension = "生存"; out.includedInScore = true; out.status = "防守方护甲失败重掷已降低单次移出风险"; break;
      }
      case "survivalBlockReroll": {
        const incoming = blockOutcomeProfile({ st: 3 }, new Set(), Number(person.st) || 1, set);
        const deltaKnockdown = Math.min(incoming.knockdown, (1 - incoming.knockdown) * 0.5);
        out.scoreGain = Math.max(0, 100 * deltaKnockdown * (1 - survive.blockCancelled) * survive.armour * survive.injury);
        out.targetDimension = "生存"; out.includedInScore = true; out.status = "单次来袭阻挡重掷按击倒概率减少量计入"; break;
      }
      case "firstBlockDodge": {
        const before = blockOutcomeProfile({ st: 3 }, new Set(), Number(person.st) || 1, set).knockdown;
        const withDodge = new Set(set); withDodge.add("dodge");
        const after = blockOutcomeProfile({ st: 3 }, new Set(), Number(person.st) || 1, withDodge).knockdown;
        out.scoreGain = Math.max(0, Math.min(100 - survive.score, 100 * (before - after) * survive.armour * survive.injury));
        out.targetDimension = "生存"; out.includedInScore = true; out.status = "每半场首次被阻挡时的 Dodge 效果已计入"; break;
      }
      case "doubleBomb": {
        const bombRemoval = (5 / 6) * armourBreak(9, new Set()) * normalInjury;
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * bombRemoval * (1 - bombRemoval)));
        out.secondaryConditionalGain = -50;
        out.secondaryConditionalLabel = "生存情境：第二次投弹后 1–3 罚下";
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "第二枚炸弹的独立目标移出增量已计入；罚下为整场出场风险，不混入单次 Block 生存分"; break;
      }
      case "clawsBlitz": {
        const clawSet = new Set(set); clawSet.add("claws");
        out.scoreGain = Math.max(0, 100 * kill.knockdown * (armourBreak(9, clawSet, 0, true) - normalArmour) * normalInjury);
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "一次突袭的 Claws 破甲路线已计入"; break;
      }
      case "unchannelledFuryBlock": {
        const fail = 1 - actionReliability(person, set, "block");
        const extra = (5 / 6) * kill.knockdown * normalArmour * normalInjury * fail;
        out.scoreGain = Math.max(0, Math.min(100 - 100 * kill.removal, 100 * extra));
        out.targetDimension = "杀伤"; out.includedInScore = true; out.status = "失败分支的第二次阻挡路径已按机会率计入"; break;
      }
      case "matchupStrength": {
        const targetST = 4;
        const normal = blockOutcomes(person, set, targetST);
        const dauntless = d6(targetST - (Number(person.st) || 1) + 1);
        const boosted = blockOutcomes(Object.assign({}, person, { st: 2 * targetST }), set, targetST);
        out.conditionalGain = Math.max(0, 100 * dauntless * (boosted.removal - normal.removal));
        out.targetDimension = "杀伤"; out.status = "ST4 对手触发条件；仅作对位分差，不计入 ST3 基准总分"; break;
      }
      case "ballBite": {
        const biteArmour = armourBreak(9, new Set());
        out.conditionalGain = 100 * biteArmour * normalInjury;
        out.secondaryConditionalGain = 100 * biteArmour;
        out.secondaryConditionalLabel = "控球：破甲后立即拿球";
        out.secondaryTargetDimension = "控球";
        out.targetDimension = "杀伤"; out.status = "被盯防者接球时触发；目标掷护甲，破甲后的移出率与立即夺球率分开显示"; break;
      }
      case "teammateSteal":
        out.conditionalGain = has(set, "noBall") ? 0 : Math.max(0, 100 - ball);
        out.targetDimension = "控球"; out.status = "相邻队友已持球时可直接夺球；条件成立后不再乘移动可达率"; break;
      case "pairAttack": {
        const stabArmour = has(set, "stab") ? armourBreak(9, set) : 0;
        const stabInjuryGain = stabArmour * (removedOnInjury({ av: 9 }, new Set(), 1) - removedOnInjury({ av: 9 }, new Set())) * actionReliability(person, set, "special");
        const foulBase = foulRemovalChance(person, set);
        const foulImproved = foulRemovalChance(person, set, 0, 1);
        out.conditionalGain = 100 * Math.max(stabInjuryGain, (foulImproved - foulBase) * actionReliability(person, set, "foul"));
        out.targetDimension = "杀伤"; out.status = "需 Dribl 与 Drull 同时盯防目标；+1 作用于 Stab 或犯规负伤骰，不套用 Block 击倒率"; break;
      }
      case "teleportStab":
        out.conditionalGain = 100 * kill.specialRemoval;
        out.targetDimension = "杀伤"; out.status = "指定三格内站立目标并执行一次 Stab；显示该次特殊攻击移出率，实际触发取决于起点和落点"; break;
      case "stabThenMove":
        {
          const stabRemoval = armourBreak(9, set) * normalInjury * actionReliability(person, set, "special");
          out.scoreGain = 100 * stabRemoval;
          out.includedInScore = true;
          out.secondaryConditionalGain = clamp(100 * movement.fastAttackScore, 0, 100);
          out.secondaryValueType = "index";
          out.secondaryConditionalLabel = "Stab 后续移动路线指数（情境值，非额外加分）";
        }
        out.secondaryTargetDimension = "快攻";
        out.targetDimension = "杀伤"; out.status = "一次性规则授予 Stab 行动；固定相邻目标的 Stab 移出率计入杀伤，后续移动只展示 0–100 路线指数，不重复计分"; break;
      case "chainsawFoul":
        out.conditionalGain = 100 * (5 / 6) * armourBreak(9, set, 3) * normalInjury * actionReliability(person, set, "special");
        out.protectionNote = "本次特殊行动不算犯规，不触发因犯规而罚下";
        out.targetDimension = "杀伤"; out.status = "目标已倒地时的一次链锯攻击；按 +3 护甲修正攻击链列条件移出率，并注明免除犯规式罚下"; break;
      case "remoteBlock": {
        const remote = blockActionRemoval(person, set, 3, 0, false);
        out.conditionalGain = 100 * remote;
        out.targetDimension = "杀伤"; out.status = "目标恰在两格外时，可用一次普通 Block 规则执行攻击；这是射程情境值，不混入相邻目标基准"; break;
      }
      case "pairBlockReroll": {
        const dice = blockDice(Number(person.st) || 1, 3);
        const die = blockOutcomeProfile({ st: 3 }, set, 3, new Set());
        const dieKnockdown = die.knockdown + die.placedProne;
        const base = blockOutcomes(person, set, 3);
        const damagePerKnockdown = base.armourableKnockdown ? base.removal / base.armourableKnockdown : 0;
        const gain = dice.chooser === "attacker" ? Math.pow(1 - dieKnockdown, dice.count) * dieKnockdown * damagePerKnockdown : 0;
        out.conditionalGain = 100 * gain * actionReliability(person, set, "block");
        out.targetDimension = "杀伤"; out.status = "只有 Valen 同时盯防同一目标时触发；额外骰重掷增益按一次阻挡计算"; break;
      }
      case "pairPassRange":
        out.conditionalGain = has(set, "noBall") ? 0 : 100 * Math.max(0, passProbability(person, set) - passProbability(person, set, -2)) * movementReach;
        out.conditionalLabel = "远传免距离惩罚的控球增量";
        out.targetDimension = "控球"; out.status = "传给 Lucien 时免除距离修正；以 Long Bomb（−2）与无距离修正传球对比，准确技能等其他修正仍保留；需要配对及远距离传球情境"; break;
      case "bombCatch": {
        out.conditionalGain = 100;
        out.conditionalLabel = "接弹者自动倒地（控场情境值）";
        out.secondaryConditionalGain = 100 * normalArmour * normalInjury;
        out.secondaryConditionalLabel = "接弹者破甲后移出率";
        out.secondaryTargetDimension = "杀伤";
        out.targetDimension = "控场"; out.status = "对手接住轰炸机的炸弹时可立即引爆；接弹者自动倒地并掷护甲/负伤骰，邻格目标另需 4+ 爆炸命中"; break;
      }
      case "blockThenVomit": {
        const vomitRemoval = (5 / 6) * armourBreak(9, set) * normalInjury * actionReliability(person, set, "special");
        out.conditionalGain = Math.max(0, 100 * (1 - kill.removal) * vomitRemoval);
        out.targetDimension = "杀伤";
        out.status = "喷射呕吐物本身已在特殊攻击路径中；本规则额外允许阻挡后再用一次，显示另有有效目标且攻击可结算时的边际移出率"; break;
      }
      case "bloodlustFallback":
        out.conditionalGain = 100 * (1 - d6(skillValue(person, "bloodlust", 2)));
        out.conditionalLabel = "有合格相邻对手时补回的激活可用率";
        out.targetDimension = "适应力";
        out.status = "Bloodlust 失败时，若有相邻 ST3 或更低且非明星的对手，可用其替代 Thrall；这里仅量化失败分支被补救的概率"; break;
      case "teamMove":
        out.conditionalGain = 12.5;
        out.conditionalLabel = "选中队友的一格无视标记移动上限值";
        out.targetDimension = "快攻";
        out.status = "每轮一次，满足五格范围、队友未被标记且存在合法终点时，最多为该队友额外推进一格；不并入 Ivar 本人的快攻分"; break;
      case "pairOnly":
        if (person.id === "deeproot") {
          out.conditionalGain = 100 * (1 - d6(3));
          out.conditionalLabel = "标准 AG3+ 被投掷队友的落地失败率豁免";
          out.targetDimension = "生存";
          out.status = "与队友完成投掷且结果为 Fumble 时，落地敏捷测试自动通过；按标准 AG3+ 队友展示避免倒地的情境率，不计入 Deeproot 个人生存分";
        } else {
          out.status = "需要 Grak 与 Crumbleberry 同时雇佣及抱起/部署位置；规则提升落在配对动作或 Grak 身上，不混入单人的固定六维";
        }
        break;
      case "remoteBlock": case "teamSkillGrant": case "teamReroll": case "teamRerollOnCasualty": case "extraDrive": case "ballChainReroll": case "animalSavageryRedirect":
        out.status = "规则与触发对象已列出；效果取决于可用队友、场上位置、目标事件或整场出场时长，缺少这些输入时不混入个人固定六维"; break;
      case "remoteBlock": case "pairOnly": case "teamMove": case "teamSkillGrant": case "teamReroll": case "teamRerollOnCasualty": case "extraDrive": case "bloodlustFallback": case "ballChainReroll": case "animalSavageryRedirect":
        out.status = "规则与触发对象已列出；效果取决于可用队友/配对、场上位置、目标事件或整场出场时长，缺少这些输入时不混入个人固定六维"; break;
      case "integrated":
        out.scoreGain = 0;
        out.includedInScore = true;
        out.status = "专属效果已融入该行动路径的基础公式；固定情境下没有额外增量，条件效果见说明"; break;
      default:
        out.status = "已登记规则效果；需要对局上下文才能量化";
    }
    return out;
  }

  function scorePlayer(person) {
    const set = ids(person);
    const skillEffects = Array.from(set).filter(id => typeof id === "string").map(id => {
      const effect = (window.BB_SKILL_EFFECTS || {})[id];
      return effect
        ? { id, dimensions: effect.dimensions.slice(), scopes: effect.scopes.slice(), coverage: effect.coverage, coverageNote: effect.coverageNote }
        : { id, dimensions: ["待归类"], scopes: ["自定义/规则未知"] };
    });
    const cannotCarryBall = has(set, "noBall");
    const movement = movementProfile(person, set, [3], hasRule(person, "swiftAsBreeze"));
    const clearMovement = movementProfile(person, set, [], hasRule(person, "swiftAsBreeze"));
    const fastIndex = (marked, open, useBase = false) => {
      const markedDistance = useBase ? marked.baseAvailableDistance : marked.availableDistance;
      const openDistance = useBase ? open.baseAvailableDistance : open.availableDistance;
      const markedCeiling = marked.maxDistance * marked.actionAvailability;
      const openCeiling = open.maxDistance * open.actionAvailability;
      const expectedReach = average([markedDistance, openDistance]);
      const legalCeiling = average([markedCeiling, openCeiling]);
      // A probability curve rewards reliable progress; the separate legal
      // ceiling preserves the value of a player's longest possible route.
      return 100 * (0.70 * expectedReach / 12 + 0.30 * legalCeiling / 12);
    };
    const fast = cannotCarryBall ? 0 : fastIndex(movement, clearMovement);
    const baseFast = cannotCarryBall ? 0 : fastIndex(movement, clearMovement, true);
    const moveActionReliability = actionReliability(person, set, "move") * (has(set, "takeRoot") ? d6(2) : 1);
    const pickupOpenProbability = cannotCarryBall ? 0 : pickupProbability(person, set, 1);
    const pickupProbabilityMarked = cannotCarryBall ? 0 : pickupProbability(person, set);
    const pickupOpen = pickupOpenProbability * 100;
    const pickup = pickupProbabilityMarked * 100;
    const catchBall = cannotCarryBall ? 0 : 100 * catchProbability(person, set);
    const quickPass = cannotCarryBall ? 0 : 100 * passProbability(person, set) * actionReliability(person, set, "pass");
    const openBallArrival = movementRoute(person, set, 2, []).probability * moveActionReliability;
    const markedBallArrival = movementRoute(person, set, 2, [1]).probability * moveActionReliability;
    const movementReach = average([openBallArrival, markedBallArrival]);
    const acquisition = cannotCarryBall ? 0 : average([pickupOpenProbability * openBallArrival, pickupProbabilityMarked * markedBallArrival]);
    const ordinaryRetention = cannotCarryBall ? 0 : ballRetentionProbability(person, set, false);
    const stripBallRetention = cannotCarryBall ? 0 : ballRetentionProbability(person, set, true);
    const retention = average([ordinaryRetention, stripBallRetention]);
    const quickPassChain = cannotCarryBall ? 0 : passProbability(person, set) * actionReliability(person, set, "pass") * catchProbability({ ag: 3 }, new Set());
    const transfer = cannotCarryBall ? 0 : average([catchProbability(person, set), quickPassChain]);
    const baseBall = cannotCarryBall ? 0 : 100 * average([acquisition, retention, transfer]);
    const ruleBallAction = hasRule(person, "catchOfTheDay") ? 100 * d6(3) : hasRule(person, "lookIntoMyEyes") ? 100 * d6(2) : 0;
    const ball = cannotCarryBall ? 0 : Math.max(baseBall, ruleBallAction * movementReach);
    const kill = lethality(person, set);
    const survive = survival(person, set);
    const controlResult = control(person, set);
    const controlReach = clamp(clearMovement.availableDistance / CONTROL_REACH_DISTANCE, 0, 1);
    const controlRetention = staticControlRetention(person, set);
    const controlComposite = composeControlScore(controlResult.held, controlRetention.probability, controlReach);
    const controlScore = controlComposite.score;
    const killWithoutMaximumCarnage = hasRule(person, "maximumCarnage")
      ? lethality(Object.assign({}, person, { specialEffectCodes: person.specialEffectCodes.filter(id => id !== "maximumCarnage") }), set)
      : kill;
    const scoringReceiver = cannotCarryBall ? 0 : 100 * movementRoute(person, set, 6, [3], hasRule(person, "swiftAsBreeze")).probability * moveActionReliability * catchProbability(person, set);
    const openingSupport = 100 * controlResult.guardSupport;
    const roleScores = {
      ballProgression: fast,
      scoringReception: scoringReceiver,
      stableBlitz: 100 * kill.safeKnockdown,
      laneProtection: controlScore,
      openingSupport
    };
    const specialRuleEffects = [];
    if (hasRule(person, "swiftAsBreeze")) specialRuleEffects.push({ id: "swiftAsBreeze", name: "迅疾如风", dimensions: ["快攻"], coverage: "固定路线中把成功率提升最多的一次闪避、飞跃或冲刺检定按 2+（5/6）计算；若原检定已是 2+ 则不会虚增分数", scoreGain: fast - baseFast });
    if (hasRule(person, "maximumCarnage")) specialRuleEffects.push({ id: "maximumCarnage", name: "最大杀戮", dimensions: ["杀伤"], coverage: "计入一次额外链锯攻击；按两名独立目标计算至少移出一人的概率", scoreGain: 100 * (kill.impact - killWithoutMaximumCarnage.impact) });
    if (hasRule(person, "blindRage")) specialRuleEffects.push({ id: "blindRage", name: "盲目愤怒", dimensions: ["杀伤"], coverage: "对本固定 ST 3 对手的无畏检定应用一次 D6 重掷", scoreGain: 100 * (kill.impact - lethality(Object.assign({}, person, { specialEffectCodes: person.specialEffectCodes.filter(id => id !== "blindRage") }), set).impact) });
    if (hasRule(person, "putridRegurgitation")) specialRuleEffects.push({ id: "putridRegurgitation", name: "腐烂重生", dimensions: ["杀伤"], coverage: "每半场可用一次 Projective Vomit 路径，计入 5/6 特殊攻击检定与护甲/伤害链", scoreGain: 100 * (kill.impact - lethality(Object.assign({}, person, { specialEffectCodes: person.specialEffectCodes.filter(id => id !== "putridRegurgitation") }), set).impact) });
    if (hasRule(person, "mesmerizingDance")) specialRuleEffects.push({ id: "mesmerizingDance", name: "催眠之舞", dimensions: ["控场"], coverage: "催眠凝视失败时重掷一次敏捷检定；按个人 AG 与当前控场情境计算", scoreGain: controlScore - composeControlScore(control(Object.assign({}, person, { specialEffectCodes: person.specialEffectCodes.filter(id => id !== "mesmerizingDance") }), set).held, controlRetention.probability, controlReach).score });
    if (hasRule(person, "balefulHex")) specialRuleEffects.push({ id: "balefulHex", name: "恶毒诅咒", dimensions: ["控场"], coverage: "单次 2+ 检定成功后，在范围内令目标下一回合无法激活", scoreGain: controlScore - composeControlScore(control(Object.assign({}, person, { specialEffectCodes: person.specialEffectCodes.filter(id => id !== "balefulHex") }), set).held, controlRetention.probability, controlReach).score });
    if (hasRule(person, "catchOfTheDay")) specialRuleEffects.push({ id: "catchOfTheDay", name: "今日渔获", dimensions: ["控球"], coverage: "站立并在三格内有散球时，按 3+ 直接拿球；以单次散球夺取机会作为替代控球路径", scoreGain: ball - baseBall });
    if (hasRule(person, "lookIntoMyEyes")) specialRuleEffects.push({ id: "lookIntoMyEyes", name: "看着我的眼睛", dimensions: ["控球"], coverage: "盯防持球者时，按 2+ 直接夺取球权作为替代控球路径", scoreGain: ball - baseBall });
    if (hasRule(person, "masterAssassin")) specialRuleEffects.push({ id: "masterAssassin", name: "刺杀大师", dimensions: ["杀伤"], coverage: "一次 Stab 护甲检定失败后重掷护甲骰", scoreGain: 100 * (kill.impact - lethality(Object.assign({}, person, { specialEffectCodes: person.specialEffectCodes.filter(id => id !== "masterAssassin") }), set).impact) });
    if (hasRule(person, "indomitable")) specialRuleEffects.push({ id: "indomitable", name: "不屈不挠", dimensions: ["杀伤"], coverage: "条件未触发：固定目标 ST 3 不高于 Karla 的 ST 3；对 ST 4+ 目标时提升力量至目标两倍。", scoreGain: null });
    if (hasRule(person, "notDismissedOnce")) specialRuleEffects.push({ id: "notDismissedOnce", name: "我会回来的", dimensions: ["生存"], coverage: "比赛持续时间效果；本模型的单次 Block 生存率不含秘密武器罚下时点，暂不加进单次生存分。", scoreGain: null });
    const specialScoreDeltas = [0, 0, 0, 0, 0, 0];
    const ruleModel = STAR_RULE_MODELS[person.id];
    if (person.specialRules && ruleModel) {
      const existing = specialRuleEffects[0];
      if (existing && existing.scoreGain != null) {
        existing.dimensions = ruleModel.dimensions;
        existing.coverage = ruleModel.note + "；" + existing.coverage;
        existing.includedInScore = true;
        existing.status = "固定情境已计入";
        if (ruleModel.kind === "blockThenVomit") {
          const extra = evaluateUncodedRule(ruleModel, person, set, {
            kill, survive, ball, baseBall, pickup, catchBall, quickPass,
            movement, movementReach, controlResult, controlReach, controlScore,
            moveActionReliability
          });
          existing.conditionalGain = extra.conditionalGain;
          existing.status = extra.status;
        }
      } else {
        const result = evaluateUncodedRule(ruleModel, person, set, {
          kill, survive, ball, baseBall, pickup, catchBall, quickPass,
          movement, movementReach, controlResult, controlReach, controlScore,
          moveActionReliability
        });
        const effect = Object.assign({
          id: person.id,
          name: ruleName(person.specialRules),
          dimensions: ruleModel.dimensions,
          coverage: ruleModel.note,
          includedInScore: false
        }, result);
        if (effect.scoreGain != null && result.targetDimension === "杀伤") effect.scoreGain *= 0.5;
        if (effect.secondaryScoreGain != null && result.secondaryTargetDimension === "杀伤") effect.secondaryScoreGain *= 0.5;
        if (existing) Object.assign(existing, effect);
        else specialRuleEffects.push(effect);
        if (result.scoreGain != null && result.includedInScore) {
          const dimensionIndex = ["快攻", "控球", "杀伤", "生存", "控场", "适应力"].indexOf(result.targetDimension);
          if (dimensionIndex >= 0) specialScoreDeltas[dimensionIndex] += result.scoreGain;
        }
        if (result.secondaryScoreGain != null && result.secondaryTargetDimension) {
          const secondaryIndex = ["快攻", "控球", "杀伤", "生存", "控场", "适应力"].indexOf(result.secondaryTargetDimension);
          if (secondaryIndex >= 0) specialScoreDeltas[secondaryIndex] += result.secondaryScoreGain;
        }
      }
    }
    const scoredFast = cannotCarryBall ? 0 : clamp(fast + specialScoreDeltas[0], 0, 100);
    const scoredBall = cannotCarryBall ? 0 : clamp(ball + specialScoreDeltas[1], 0, 100);
    const scoredKill = clamp(100 * kill.impact + specialScoreDeltas[2] * 0.5, 0, 100);
    const scoredSurvival = clamp(survive.score + specialScoreDeltas[3], 0, 100);
    const scoredControl = clamp(controlScore + specialScoreDeltas[4], 0, 100);
    const scoredRoles = {
      ballProgression: scoredFast,
      scoringReception: scoringReceiver,
      stableBlitz: clamp(100 * kill.safeKnockdown, 0, 100),
      laneProtection: scoredControl,
      // Guard is an incremental contribution, not a standalone success chance.
      // Keep it in percentage points so its separately lower thresholds remain legible.
      openingSupport
    };
    const roleCoverage = METHOD.roles.map(role => {
      const score = clamp(Number(scoredRoles[role.id]) || 0, 0, 100);
      return Object.assign({}, role, {
        score,
        coverage: clamp((score - role.minimum) / (role.reliable - role.minimum), 0, 1) * 100
      });
    });
    return {
      scores: [scoredFast, scoredBall, scoredKill, scoredSurvival, scoredControl].map(value => Math.round(clamp(value, 0, 100) * 10) / 10),
      rawScores: [scoredFast, scoredBall, scoredKill, scoredSurvival, scoredControl].map(value => clamp(value, 0, 100)),
      breakdown: {
        skillEffects,
        specialRuleEffects,
        fastAttack: { score: scoredFast, cannotCarryBall, route: "按全程可达距离曲线评估；开阔与一名标记者路径等权，逐格计入闪避、跳跃、冲刺与行动可用率；最长合法移动距离另占30%", maxDistance: movement.maxDistance, expectedDistance: movement.availableDistance, markedExpectedDistance: movement.availableDistance, rawExpectedDistance: movement.expectedDistance, openExpectedDistance: clearMovement.availableDistance, openRawExpectedDistance: clearMovement.expectedDistance, availableMaxDistance: average([movement.availableMaxDistance, clearMovement.availableMaxDistance]), taskDistances: movement.fastDistances, taskRates: movement.fastDistances.map((_, index) => (movement.fastRoutes[index] + clearMovement.fastRoutes[index]) / 2 * 100), markedTaskRates: movement.fastRoutes.map(rate => rate * 100), openTaskRates: clearMovement.fastRoutes.map(rate => rate * 100), completion8: movement.completion8 * 100, baseCompletion8: movement.baseCompletion8 * 100, specialRuleGain: fast - baseFast, reachBySquare: movement.reachBySquare.map(rate => rate * moveActionReliability * 100), rushesFor13: movement.rushesFor13, dodgeEach: movement.dodgeRates, rush: movement.rushRate * 100, formula: "100 × [0.70 × 平均(开阔/单标记路线的期望可达距离 ÷ 12) + 0.30 × 平均(开阔/单标记路线的行动可用最大距离 ÷ 12)]；距离曲线逐格累加精确站立抵达概率" },
        ball: { score: scoredBall, baseScore: baseBall, specialRuleAction: ruleBallAction, cannotCarryBall, acquisition: acquisition * 100, openPickup: pickupOpen, markedPickup: pickup, openArrival: openBallArrival * 100, markedArrival: markedBallArrival * 100, retention: retention * 100, ordinaryHitRetention: ordinaryRetention * 100, stripBallRetention: stripBallRetention * 100, transfer: transfer * 100, markedCatch: catchBall, quickPass, quickPassChain: quickPassChain * 100, movementReach: movementReach * 100, formula: "100 × 均值(开阔/受标记取得球权概率, 受击后保球概率, 球权转移概率)；内部均按 0–1 概率计算，各组等权为暂定情境指数" },
        lethality: { score: scoredKill, attackerST: Number(person.st) || 1, targetST: 3, blockActionAvailable: 100 * kill.blockAvailability, specialActionAvailable: 100 * kill.specialAvailability, foulActionAvailable: 100 * kill.foulAvailability, knockdown: 100 * kill.knockdown, safeKnockdown: 100 * kill.safeKnockdown, turnover: 100 * kill.turnover, armourBreak: 100 * kill.armour, removalAfterArmour: 100 * kill.injury, safeRemoval: 100 * kill.removal, blockImpact: 100 * kill.blockImpact, damageIndex: 100 * kill.impact, expectedRemoval: 100 * kill.expectedRemoval, specialAttack: 100 * kill.specialRemoval, dirtyPlayerFoul: 100 * kill.dirtyPlayerFoul, formula: "固定站立目标 ST3/AV9。阻挡路线指数 = 75% × 安全击倒率 + 25% × 安全移出率；击倒是可重复的主要战斗结果，移出作为更重后果加权，且属于击倒子集，不重复算作独立事件。特殊攻击和条件犯规分别按其移出率作替代路线，取可用路线最高值；ST改变选骰数量与选择权，Brawler 在宣告普通 Block 时可重掷一个 Both Down。球队阵容再按 e^(−0.38×序位) 汇总各名攻击手指数。" },
      survival: { score: scoredSurvival, standingAfterHit: 100 * survive.standing, pushAfterHit: 100 * survive.push, onPitchNow: 100 * survive.onPitch, nextDriveAvailable: 100 * survive.nextDriveAvailable, laterRemoval: 100 * survive.laterRemoval, koRateAfterArmour: 100 * survive.ko, casualtyRateAfterArmour: 100 * survive.casualty, attackerStrengths: survive.attackerStrengths, byOpponentST: survive.byOpponentST.map(row => ({ attackerST: row.attackerST, standing: 100 * row.standing, pushed: 100 * row.push, onPitch: 100 * row.onPitch, nextDriveAvailable: 100 * row.nextDriveAvailable, knockdown: 100 * row.knockdown, placedProne: 100 * row.placedProne })), defenderST: Number(person.st) || 1, knockdownAgainst: 100 * survive.knockdown, placedProneAgainst: 100 * survive.placedProne, armourBreakAgainst: 100 * survive.armour, removalAgainst: 100 * survive.injury, blockCancelled: 100 * survive.blockCancelled, chainsawArmourModifier: survive.chainsawModifier, decay: survive.decay, wrestle: survive.wrestle, regeneration: survive.regeneration, saboteurRemoval: survive.saboteurRemoval, formula: "对手 ST3/4/5/6 各一次无支援阻挡，四种力量基准等权；再分别等权合成仍站立、当前留场、下一进攻段可用三项。力量影响选骰权与击倒风险；推挤率单独展示，因为 ST 本身不会抵消已选 Push" },
        control: { score: scoredControl, stationaryScore: controlComposite.stationary, dynamicScore: controlComposite.dynamic, staticZoneRetention: controlRetention.probability * 100, staticRetentionByOpponentST: controlRetention.byOpponentST.map(row => ({ opponentST: row.opponentST, standing: row.standing * 100, pushed: row.push * 100 })), opponentAG: opponentAGLabel(), opponentST: opponentSTLabel(), playerST: Number(person.st) || 1, escape: 100 * controlResult.escape, escapePrevention: 100 * (1 - controlResult.escape), tentacleHold: 100 * controlResult.tentacle, blockThreat: 100 * controlResult.blockThreat, shadowing: 100 * controlResult.shadowing, specialHold: 100 * controlResult.specialHold, foulAppearance: 100 * controlResult.foulAppearance, guardSupport: 100 * controlResult.guardSupport, movementReach: controlReach * 100, reachDistance: CONTROL_REACH_DISTANCE, formula: "总控场指数 = min(100, 静态控场 + 动态延伸)；静态控场 = 100 × mean(固定压制指数, 对手 ST3/4/5/6 无支援阻挡后仍站立率)；动态延伸 = 100 × 固定压制指数 × 可达距离比例。动态覆盖只加不减，不因移动低而削掉占位者在当前位置已经有的静态控场。局部静态区域允许一格推挤后仍留区，推挤结果另列；ST影响选骰与倒地，Stand Firm/Rooted 才会直接阻止推挤。精确原格留存另由 v3 引擎任务记录。此封顶合成是暂定比较指数，不是概率或整张棋盘求解；ST3/4/5/6 对手等权、无支援仍是暂定基准" },
        adaptability: {
          roles: roleCoverage,
          formula: "适应力以角色向量展示：每种职责分别列出任务代理值 R，以及按最低可用/可靠阈值映射的单角色覆盖度 Cᵣ=100×clamp((Rᵣ−Lᵣ)/(Hᵣ−Lᵣ),0,1)。不跨角色加权合成个人总分；阈值是暂定设置。队内重要性另按指定名单逐角色计算向量"
        }
      }
    };
  }

  function opponentAGLabel() { return "AG 3+，带 Dodge；单个标记者"; }
  function opponentSTLabel() { return "ST 3；单个相邻目标"; }

  function weightedTop(players, valueFor, limit) {
    const ordered = players.slice().sort((a, b) => (Number(valueFor(b)) || 0) - (Number(valueFor(a)) || 0)).slice(0, limit);
    const weights = Array.from({ length: limit }, (_, rank) => Math.exp(-0.38 * rank));
    return ordered.reduce((sum, player, index) => sum + (Number(valueFor(player)) || 0) * weights[index], 0) / weights.reduce((sum, weight) => sum + weight, 0);
  }

  function teamScores(players, format, ordinaryByPosition = {}, options = {}) {
    const limit = format === "sevens" ? 7 : 11;
    const scored = players.map(player => Object.assign({}, player, scorePlayer(player)));
    const requiredPlayerIds = new Set((options.requiredPlayerIds || []).map(String));
    const required = scored.filter(player => requiredPlayerIds.has(String(player.id)));
    if (required.length !== requiredPlayerIds.size) throw new Error("Required team players must exist in the supplied roster.");
    if (required.length > limit) throw new RangeError("Required team players exceed the active lineup limit.");
    const lineupValue = player => player.scores.slice(0, 5).reduce((sum, value, dimension) =>
      sum + value * METHOD.weights[dimension], 0) / METHOD.weights.slice(0, 5).reduce((sum, weight) => sum + weight, 0);
    const optional = scored.filter(player => !requiredPlayerIds.has(String(player.id)));
    const selectActive = valueFor => required.concat(optional.slice().sort((a, b) =>
      (Number(valueFor(b)) || 0) - (Number(valueFor(a)) || 0)
    ).slice(0, limit - required.length));
    // Each task dimension selects its own legal-size available group. A shared
    // blended lineup can exclude a slow/high-Strength anchor from Survival or
    // Control because its unrelated Fast Attack and Ball scores are low.
    // This is a per-task roster capability profile, not one simultaneous
    // starting formation; explicit Bloodboard team tasks remain the source for
    // synergy, assists, positioning, and match-context effects.
    const active = selectActive(lineupValue);
    const activeByDimension = Array.from({ length: 5 }, (_, dimension) =>
      selectActive(player => player.scores[dimension]));
    const killActive = activeByDimension[2];
    const scores = Array.from({ length: 5 }, (_, dimension) =>
      weightedTop(activeByDimension[dimension], player => player.scores[dimension], limit));
    const roleValue = (player, roleIndex) => {
      const role = player.breakdown.adaptability.roles[roleIndex];
      return role ? role.score : 0;
    };
    // Q*(T): each fixed role task may be re-assigned within the same squad;
    // rank weights model the best available performers and roster depth.
    const teamRoleTasks = eligible => METHOD.roles.map((_, roleIndex) =>
      weightedTop(eligible, player => roleValue(player, roleIndex), limit));
    const baselineRoles = teamRoleTasks(scored);
    const retentionScenarios = active.map(lost => {
      const remaining = scored.filter(player => player !== lost);
      const after = teamRoleTasks(remaining);
      return after.map((value, role) => baselineRoles[role] > 0
        ? 100 * clamp(value / baselineRoles[role], 0, 1)
        : 0);
    });
    const retentionByRole = METHOD.roles.map((_, role) => average(retentionScenarios.map(row => row[role])));
    scores[5] = average(retentionByRole);
    const rawScores = Array.from({ length: 5 }, (_, dimension) => weightedTop(
      activeByDimension[dimension],
      player => player.rawScores && Number.isFinite(player.rawScores[dimension]) ? player.rawScores[dimension] : player.scores[dimension],
      limit
    ));
    rawScores.push(scores[5]);

    const playerImportance = options.includeImportance === false ? [] : scored.map(player => {
      const without = scored.filter(other => other !== player);
      const withoutTasks = teamRoleTasks(without);
      const ordinary = ordinaryByPosition[player.positionId];
      const replacement = ordinary
        ? Object.assign({}, ordinary, { id: "ordinary-replacement-" + player.id, positionId: player.positionId })
        : Object.assign({}, player, { id: "ordinary-replacement-" + player.id, boughtSkill: "" });
      const scoredReplacement = Object.assign({}, replacement, scorePlayer(replacement));
      const withOrdinary = teamRoleTasks(without.concat(scoredReplacement));
      return {
        playerId: player.id,
        name: player.name,
        positionId: player.positionId || "",
        lossByRole: baselineRoles.map((value, role) => value - withoutTasks[role]),
        valueOverOrdinaryReplacement: baselineRoles.map((value, role) => value - withOrdinary[role]),
        replacementSource: ordinary ? "同位置普通初始档案" : "本球员去除购入技能代理"
      };
    });
    return {
      scores: scores.map(value => Math.round(value * 10) / 10),
      rawScores,
      killProfile: {
        lineupPlayerIds: killActive.map(player => player.id),
        lineupNames: killActive.map(player => player.name),
      lineupPlayers: killActive.map(player => ({
        id: player.id,
        name: player.name,
        strength: Number(player.st) || 1,
        index: player.scores[2],
        safeKnockdown: Number(player.breakdown.lethality.safeKnockdown) || 0,
        safeRemoval: Number(player.breakdown.lethality.safeRemoval) || 0,
        survival: player.scores[3],
        control: player.scores[4]
      })),
        strengthCounts: killActive.reduce((counts, player) => {
          const strength = Number(player.st) || 1;
          counts[strength] = (counts[strength] || 0) + 1;
          return counts;
        }, {}),
        aggregation: "每名球员的阻挡指数以安全击倒率为主项、安全移出率为严重度加成；球队再按杀伤轴选取不超过赛制人数的攻击阵容，并用 e^(−0.38×序位) 汇总。该值是固定 ST3/AV9 目标的能力代理，不是每回合预计移出数；整队支援站位、行动数量、犯规链和低价替补承担罚下的经济价值尚未模拟。"
      },
      rosterSelection: {
        method: "每个任务维度独立选择不超过赛制人数的最高该轴球员；这表示阵容任务能力，不是一套可同时实现所有维度的首发阵型。协同、支援和站位仍须由 Bloodboard 整队任务单独证明",
        activeLimit: limit,
        byDimension: activeByDimension.map((lineup, dimension) => ({
          dimension: ["快攻", "控球", "杀伤", "生存", "控场"][dimension],
          players: lineup.map(player => ({ id: player.id, name: player.name, positionId: player.positionId || "", strength: Number(player.st) || 1, score: player.scores[dimension] }))
        })),
        resilienceReference: active.map(player => ({ id: player.id, name: player.name, positionId: player.positionId || "" }))
      },
      playerImportance,
      adaptability: {
        method: "按同一任务集分别重新分配五种角色；移除每名优先上场球员后允许名单/替补补位，按角色能力保留率展示",
        roles: METHOD.roles.map(role => role.label),
        retainedByRole: retentionByRole.map(value => Math.round(value * 10) / 10),
        baselineByRole: baselineRoles.map(value => Math.round(value * 10) / 10),
        lossScenarios: retentionScenarios.length
      }
    };
  }

  window.BB_SCORING = { METHOD, d6, withReroll, scorePlayer, teamScores, starRuleModels: STAR_RULE_MODELS };
})();
