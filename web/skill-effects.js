/*
 * Transparent routing for every Third Season skill/trait in the catalog.
 * A rule can be direct, conditional on a fixed scenario, or team/league scope;
 * being listed never means that it gives an unconditional bonus.
 */
(() => {
  const groups = [
    { ids: "breakTackle dodge drunkard leap noBall pogo sprint sureFeet stunty titchy twoHeads veryLongLegs", dimensions: ["快攻", "控球", "控场", "适应力"], scope: "direct", context: "移动路线：MA、闪避、Rush、跳跃及持球限制", source: "Third Season pp.54–58, 121–138" },
    { ids: "takeRoot jumpUp hitAndRun quickFoul giveAndGo timmmber", dimensions: ["快攻", "生存", "适应力"], scope: "conditional", context: "起身、扎根、格挡后移动或犯规后续行动", source: "Third Season pp.54–58, 121–138" },
    { ids: "accurate bigHand catch divingCatch extraArms myBall nervesOfSteel noBall pass sureHands", dimensions: ["控球", "适应力"], scope: "direct", context: "拾球、接球、短传及球权限制", source: "Third Season pp.54–58, 70–74, 121–138" },
    { ids: "safePairOfHands safePass unsteady", dimensions: ["控球", "生存", "适应力"], scope: "conditional", context: "持球倒地、传球失误保护及 Secure the Ball 限制", source: "Third Season pp.54–58, 70–74, 121–138" },
    { ids: "animosity bombardier bullseye cannoneer cloudBurster dumpOff fumblerooski hailMaryPass kickTeamMate rightStuff strongArm swoop throwTeamMate alwaysHungry", dimensions: ["快攻", "控球", "杀伤", "适应力"], scope: "conditional", context: "炸弹、远传、传掷队友、关键字传递及接球落点", source: "Third Season pp.70–78, 121–138" },
    { ids: "punt", dimensions: ["快攻", "控球", "适应力"], scope: "conditional", context: "Punt 特殊行动、移动后定向踢球、队友接球与球权去向", source: "Third Season p.134", coverage: "scenario-only", coverageNote: "Punt 已在固定参考场景中通过 Bloodboard 枚举接球、球权、落地、达阵与 Turnover；场景频率和对六维的校准权重仍待验证，不作无条件加分。" },
    { ids: "block brawler dauntless frenzy grab guard hatred horns juggernaut mightyBlow multipleBlock tackle wrestle", dimensions: ["杀伤", "生存", "控场", "适应力"], scope: "direct-or-conditional", context: "Block 骰数、击倒、额外攻击、保护性结果及队友援助", source: "Third Season pp.60–68, 121–138" },
    { ids: "armBar ballAndChain breatheFire chainsaw claws dirtyPlayer eyeGouge lethalFlight loneFouler pileDriver projectileVomit putTheBootIn sneakyGit stab violentInnovator", dimensions: ["杀伤", "生存", "控场", "适应力"], scope: "conditional", context: "特殊攻击、犯规、推挤后效果及赛季奖励", source: "Third Season pp.60–69, 121–138" },
    { ids: "stripBall", dimensions: ["控球", "控场"], scope: "conditional", context: "Block 击退持球者并导致球权脱手；球权破坏与控场任务；Sure Hands 等规则抗性", source: "Third Season p.136" },
    { ids: "defensive disturbingPresence divingTackle fend foulAppearance hypnoticGaze ironHardSkin monstrousMouth prehensileTail shadowing sidestep standFirm steadyFooting taunt tentacles trickster", dimensions: ["生存", "控场", "适应力"], scope: "direct-or-conditional", context: "防守检定、脱离封锁、站位保持、干扰传接球、催眠凝视移除相邻对手盯防区并打开通道", source: "Third Season pp.54–68, 121–138" },
    { ids: "animalSavagery bloodlust boneHead reallyStupid unchannelledFury", dimensions: ["快攻", "控球", "杀伤", "适应力"], scope: "direct", context: "激活检定成功率；按 Move、Pass、Block 等行动分别计算", source: "Third Season pp.123–138" },
    { ids: "decay dodge regeneration saboteur secretWeapon stunty thickSkull", dimensions: ["生存", "适应力"], scope: "direct-or-conditional", context: "防守 Block 结果、Stunty 伤害表、KO/伤亡、再生、连带伤害及 Drive 可用性", source: "Third Season pp.65–68, 123–138" },
    { ids: "kick leader loner onTheBall pickMeUp plagueRidden insignificant", dimensions: ["快攻", "控球", "生存", "控场", "适应力"], scope: "team-context", context: "开球、团队重掷、回合外移动、队友起身及名单限制", source: "Third Season pp.89–99, 121–138" },
    { ids: "chainsaw", dimensions: ["杀伤", "生存"], scope: "direct", context: "电锯攻击及自身被击倒时的护甲修正", source: "Third Season p.126" },
    { ids: "pro", dimensions: ["快攻", "控球", "杀伤", "生存", "控场", "适应力"], scope: "direct", context: "每次激活一次 3+ 单骰重掷；不与其他重掷重复使用", source: "Third Season p.133" },
    { ids: "secretWeapon", dimensions: ["生存", "适应力"], scope: "team-context", context: "参加 Drive 后被驱逐，计入跨 Drive 上场可用性", source: "Third Season p.135" },
    { ids: "decay violentInnovator", dimensions: ["生存", "适应力"], scope: "league-context", context: "伤亡表后果或联赛 SPP；单场战术概率不直接等同于加分", source: "Third Season pp.96, 127, 138" }
  ];
  const effects = {};
  for (const group of groups) for (const id of group.ids.split(/\s+/).filter(Boolean)) {
    const current = effects[id] || { dimensions: [], scopes: [], contexts: [], sources: [] };
    current.dimensions = [...new Set(current.dimensions.concat(group.dimensions))];
    current.scopes = [...new Set(current.scopes.concat(group.scope))];
    current.contexts = [...new Set(current.contexts.concat(group.context))];
    current.sources = [...new Set(current.sources.concat(group.source))];
    effects[id] = current;
  }
  // Coverage describes the scoring code, separately from the rules-to-dimension
  // route above. "formula" means at least one fixed-scenario branch uses it;
  // it does not claim that every rule interaction for that skill is simulated.
  const formulaIds = new Set("accurate animalSavagery ballAndChain bigHand block bloodlust boneHead breakTackle breatheFire catch chainsaw claws dauntless dirtyPlayer divingCatch divingTackle dodge drunkard extraArms foulAppearance frenzy horns hypnoticGaze ironHardSkin leap loneFouler mightyBlow monstrousMouth multipleBlock myBall nervesOfSteel noBall pass pileDriver pogo prehensileTail pro projectileVomit reallyStupid regeneration saboteur shadowing sprint stab steadyFooting stunty sureFeet sureHands tackle takeRoot tentacles thickSkull titchy twoHeads unchannelledFury veryLongLegs decay wrestle".split(/\s+/));
  const uncovered = (window.BB_SKILL_CATALOG || []).map(skill => skill.id).filter(id => !effects[id]);
  for (const [id, effect] of Object.entries(effects)) {
    if (formulaIds.has(id)) {
      effect.coverage = "formula";
    effect.coverageNote = id === "ballAndChain"
        ? "当前仅以受限攻击路径估算；Ball & Chain 的逐步随机移动尚未完整模拟。"
        : id === "stripBall"
          ? "V3.80 已在夺球阻挡任务中精确观察到效果；适用对手与触发机会频率仍待标定，不作无条件加分。"
        : id === "decay"
          ? "本场伤亡骰 +1 已进入生存公式；联赛成长/赛后影响仍未模拟。"
          : "至少一条规则效果进入当前六维的数值分支；未触发的其它规则互动不自动加分。";
    } else if (effect.scopes.includes("league-context")) {
      effect.coverage = "league-context";
      effect.coverageNote = "需要联赛赛季或成长结算；当前单场球员公式不把它折算成固定加分。";
    } else if (effect.scopes.includes("team-context")) {
      effect.coverage = "team-context";
      effect.coverageNote = "需要队友、名单或团队资源情境；当前个人固定场景未折算为数值。";
    } else {
      effect.coverage = "scenario-only";
      effect.coverageNote = "已映射到相关维度和规则触发点；当前固定单人情境没有触发该动作，因此尚未进入数值分支。需要在对应比赛动作或局面情境中量化，不作无条件加分。";
    }
  }
  if (uncovered.length) console.error("Skills without a six-dimension rule route:", uncovered);
  const withoutCoverage = (window.BB_SKILL_CATALOG || []).map(skill => skill.id).filter(id => !effects[id] || !effects[id].coverage);
  if (withoutCoverage.length) console.error("Skills without a scoring-coverage status:", withoutCoverage);
  window.BB_SKILL_EFFECTS = effects;
})();
