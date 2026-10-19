/* 声明式规则影响表：不是数字加分，也不是技能覆盖认证。
 * 范围：Bloodboard V7.0.1 SKILL_BY_ID；节点对应冻结的30节点。
 * nodes=[] 的明确长期/阵容效果不等于未知或零贡献。
 * 未知 ID 必须由调用方标记未完成建模，不推定零。
 */
(function(root) {
const value = {
  "attributes": [
    {
      "id": "MA",
      "parameters": "合法路径长度、起身剩余移动、Rush 次数和追踪使用上限",
      "nodes": [
        "M1",
        "M2",
        "M3",
        "M4",
        "M5",
        "C4"
      ],
      "limitation": "不按每点 MA 固定加分；合法移动与到达概率分开。"
    },
    {
      "id": "ST",
      "parameters": "Block 骰数、协助后的有效力量、Dauntless/Break Tackle/Tentacles 等指定判定",
      "nodes": [
        "C1",
        "C2",
        "C4",
        "S1",
        "Z1",
        "Z2"
      ],
      "limitation": "按实际力量门槛与动作作用域计算。"
    },
    {
      "id": "AG",
      "parameters": "闪避、捡球、接球、Jump/Leap、投掷后落地及规则指定检定",
      "nodes": [
        "M2",
        "M3",
        "M4",
        "B1",
        "B2",
        "B4",
        "B6"
      ],
      "limitation": "特殊动作仅在实际规则要求 AG 时使用。"
    },
    {
      "id": "PA",
      "parameters": "传球、Throw Team-mate 与规则指定投掷检定",
      "nodes": [
        "B3",
        "B4",
        "M4"
      ],
      "limitation": "PA 检定成功不等于完整传接或达阵成功。"
    },
    {
      "id": "AV",
      "parameters": "护甲检定阈值及相关修正、替代、例外",
      "nodes": [
        "S2",
        "S3",
        "C3",
        "C5"
      ],
      "limitation": "护甲条件概率与完整攻击结果分开。"
    },
    {
      "id": "keywords",
      "parameters": "动作对象资格、Animosity/Hatred/Bloodlust 等关系、阵容限制",
      "nodes": [
        "B4",
        "R1",
        "R4"
      ],
      "limitation": "阵容合法性不直接提高即时能力；保留关键词参数。"
    },
    {
      "id": "cost",
      "parameters": "预算与招募成本",
      "nodes": [],
      "limitation": "只用于阵容成本与长期培养，不能提高即时能力。"
    },
    {
      "id": "advancement",
      "parameters": "技能获取权限、经验与培养空间",
      "nodes": [],
      "limitation": "仅长期培养模块，不进入即时六维。"
    }
  ],
  "skills": {
    "accurate": {
      "nodes": [
        "B3",
        "B4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "快速或短传的 PA 检定加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "alwaysHungry": {
      "nodes": [
        "M4",
        "B4",
        "R4"
      ],
      "interfaces": [
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "投掷队友前判定饥饿；逃脱成为失手投掷，吞食队友导致 Turnover。",
      "modelingStatus": "已声明待触发审计"
    },
    "animalSavagery": {
      "nodes": [
        "R1",
        "R4"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "声明动作后判定，Block/Blitz 加二；失败攻击相邻站立队友或变 Distracted，按实现结束激活。",
      "modelingStatus": "已声明待触发审计"
    },
    "animosity": {
      "nodes": [
        "B4",
        "R1",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "向指定关键词队友传球或手递手前判定，掷一拒绝并结束激活。",
      "modelingStatus": "已声明待触发审计"
    },
    "armBar": {
      "nodes": [
        "Z1",
        "S3"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "对手从其擒抱区闪避跳跃失败摔倒时，对护甲或伤害加一；伤害属于对手风险。",
      "modelingStatus": "已声明待触发审计"
    },
    "ballAndChain": {
      "nodes": [
        "M1",
        "C1",
        "C2",
        "C3",
        "S3",
        "R1",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换",
        "位置与状态"
      ],
      "mechanism": "唯一可用特殊行动按模板随机逐格移动碰撞；不闪避，不触发 Shadowing/Tentacles；倒地立即伤害，眩晕转 KO。",
      "modelingStatus": "已声明待触发审计"
    },
    "bigHand": {
      "nodes": [
        "B1",
        "B6"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "捡球忽略全部负修正。",
      "modelingStatus": "已声明待触发审计"
    },
    "block": {
      "nodes": [
        "C1",
        "C2",
        "S1"
      ],
      "interfaces": [
        "结果转换"
      ],
      "mechanism": "Both Down 可选择自身不被击倒。",
      "modelingStatus": "已声明待触发审计"
    },
    "bloodlust": {
      "nodes": [
        "M4",
        "B4",
        "R1",
        "R4"
      ],
      "interfaces": [
        "检定参数",
        "动作资格",
        "次数与时序",
        "位置与状态"
      ],
      "mechanism": "声明动作判定失败后须在传递、得分或激活结束前咬相邻 Thrall；缺失导致 Turnover、Distracted 和落球。",
      "modelingStatus": "已声明待触发审计"
    },
    "bombardier": {
      "nodes": [
        "C2",
        "C3",
        "R3",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "每回合一次不先移动的投弹；传球拦截接获后再投，爆炸计算落点和邻格命中及队友伤害。",
      "modelingStatus": "已声明待触发审计"
    },
    "boneHead": {
      "nodes": [
        "R1",
        "Z3"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态"
      ],
      "mechanism": "声明动作后掷一变为 Distracted。",
      "modelingStatus": "已声明待触发审计"
    },
    "brawler": {
      "nodes": [
        "C1",
        "C2",
        "R3"
      ],
      "interfaces": [
        "重掷资源",
        "次数与时序"
      ],
      "mechanism": "仅声明 Block 时每次 Block Action 可重掷一个 Both Down 骰；保留 FAQ 时序。",
      "modelingStatus": "已声明待触发审计"
    },
    "breakTackle": {
      "nodes": [
        "M2",
        "M3",
        "R3"
      ],
      "interfaces": [
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "每回合一次闪避加值随 ST 档位为一、二或三。",
      "modelingStatus": "已声明待触发审计"
    },
    "breatheFire": {
      "nodes": [
        "C1",
        "C2",
        "C4",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "相邻被贴身站立对手的喷火判定区分自身 Knocked Down、目标 Placed Prone 与自然六 Knocked Down，随后结束激活。",
      "modelingStatus": "已声明待触发审计"
    },
    "bullseye": {
      "nodes": [
        "M4",
        "B4"
      ],
      "interfaces": [
        "结果转换",
        "位置与状态"
      ],
      "mechanism": "投掷队友 Superb Throw 落在目标格且不偏移。",
      "modelingStatus": "已声明待触发审计"
    },
    "cannoneer": {
      "nodes": [
        "B3",
        "B4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "长传或长炸弹传球 PA 检定加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "catch": {
      "nodes": [
        "B2",
        "B4",
        "B6",
        "R3"
      ],
      "interfaces": [
        "重掷资源"
      ],
      "mechanism": "允许重掷失败接球 AG 检定。",
      "modelingStatus": "已声明待触发审计"
    },
    "chainsaw": {
      "nodes": [
        "C3",
        "C4",
        "C5",
        "S2",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换"
      ],
      "mechanism": "电锯攻击或犯规先判定反噬，目标护甲加三；自身倒地护甲也加三，须处理 Iron Hard Skin。",
      "modelingStatus": "已声明待触发审计"
    },
    "claws": {
      "nodes": [
        "C3",
        "C4"
      ],
      "interfaces": [
        "结果转换"
      ],
      "mechanism": "Block 击倒目标时自然护甲八以上破甲。",
      "modelingStatus": "已声明待触发审计"
    },
    "cloudBurster": {
      "nodes": [
        "B3",
        "B4",
        "Z5"
      ],
      "interfaces": [
        "动作资格"
      ],
      "mechanism": "对手不能拦截其传球；Very Long Legs 的例外仍需结算。",
      "modelingStatus": "已声明待触发审计"
    },
    "dauntless": {
      "nodes": [
        "C1",
        "C2",
        "C4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "对更强目标以 D6 加自身 ST 比较，成功使用目标 ST。",
      "modelingStatus": "已声明待触发审计"
    },
    "decay": {
      "nodes": [],
      "interfaces": [
        "队伍与长期效果"
      ],
      "mechanism": "伤亡表加一；不改变护甲与当前 KO/CAS 概率，长期伤病须另列。",
      "modelingStatus": "已声明待触发审计"
    },
    "defensive": {
      "nodes": [
        "S1",
        "Z2",
        "Z3"
      ],
      "interfaces": [
        "动作资格"
      ],
      "mechanism": "对手回合，被其贴身的对手不能用 Guard。",
      "modelingStatus": "已声明待触发审计"
    },
    "dirtyPlayer": {
      "nodes": [
        "C5"
      ],
      "interfaces": [
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "犯规掷骰后选择护甲或伤害加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "disturbingPresence": {
      "nodes": [
        "Z5",
        "B3",
        "B2"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "三格内每位持有者使对手传球、接球、拦截检定减一；B 节点表示被测对手任务。",
      "modelingStatus": "已声明待触发审计"
    },
    "divingCatch": {
      "nodes": [
        "B2",
        "B4",
        "B6"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "位置与状态"
      ],
      "mechanism": "允许接相邻空格落下的传球界外球开球但不含弹跳；目标格准确传球接球加一，自身不移位。",
      "modelingStatus": "已声明待触发审计"
    },
    "divingTackle": {
      "nodes": [
        "Z1",
        "Z5",
        "R4"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "对手闪避跳跃检定后减二，自身 Placed Prone 到腾出格。",
      "modelingStatus": "已声明待触发审计"
    },
    "dodge": {
      "nodes": [
        "M2",
        "M3",
        "S1",
        "R3"
      ],
      "interfaces": [
        "重掷资源",
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "每回合一次闪避重掷，Block 的 Stumble 转 Push Back，处理 Tackle 克制。",
      "modelingStatus": "已声明待触发审计"
    },
    "drunkard": {
      "nodes": [
        "M1",
        "M4",
        "R1"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "Rush 检定减一。",
      "modelingStatus": "已声明待触发审计"
    },
    "dumpOff": {
      "nodes": [
        "B4",
        "B5",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "次数与时序"
      ],
      "mechanism": "持球被 Block 或特殊动作针对前可快速传球，按规则且不产生 Turnover。",
      "modelingStatus": "已声明待触发审计"
    },
    "extraArms": {
      "nodes": [
        "B1",
        "B2",
        "B6",
        "Z5"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "接球、捡球、拦截检定加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "eyeGouge": {
      "nodes": [
        "Z2",
        "Z4"
      ],
      "interfaces": [
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "被其推开的对手在下次激活前不能协助。",
      "modelingStatus": "已声明待触发审计"
    },
    "fend": {
      "nodes": [
        "S1",
        "Z3"
      ],
      "interfaces": [
        "动作资格",
        "位置与状态"
      ],
      "mechanism": "被 Block 推开后禁止攻击者跟进。",
      "modelingStatus": "已声明待触发审计"
    },
    "foulAppearance": {
      "nodes": [
        "S1",
        "Z3",
        "R1"
      ],
      "interfaces": [
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "攻击其的 Block 前判定，掷一取消 Block 并结束攻击者激活。",
      "modelingStatus": "已声明待触发审计"
    },
    "frenzy": {
      "nodes": [
        "C1",
        "C2",
        "C4",
        "Z4",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "强制跟进，目标仍站立时必须再次 Block；同链资源与失败状态保留。",
      "modelingStatus": "已声明待触发审计"
    },
    "fumblerooski": {
      "nodes": [
        "B4",
        "B6",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "位置与状态"
      ],
      "mechanism": "持球 Move 可将球留在离开的格，不产生 Turnover；后续球权仍需队友任务。",
      "modelingStatus": "已声明待触发审计"
    },
    "giveAndGo": {
      "nodes": [
        "B4",
        "M5",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "次数与时序"
      ],
      "mechanism": "快速传球或手递手且无 Turnover 后可继续剩余移动。",
      "modelingStatus": "已声明待触发审计"
    },
    "grab": {
      "nodes": [
        "Z4",
        "C1"
      ],
      "interfaces": [
        "位置与状态",
        "结果转换"
      ],
      "mechanism": "Block Action 可推到任意相邻空格，禁止目标 Sidestep；按 FAQ 声明条件。",
      "modelingStatus": "已声明待触发审计"
    },
    "guard": {
      "nodes": [
        "Z2"
      ],
      "interfaces": [
        "动作资格",
        "检定参数"
      ],
      "mechanism": "被多少对手贴身都可提供 Block 协助，仍检验位置和状态资格。",
      "modelingStatus": "已声明待触发审计"
    },
    "hailMaryPass": {
      "nodes": [
        "B3",
        "B4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换"
      ],
      "mechanism": "可向任意格按 Long Bomb 传球，永不 Accurate 且不可拦截；完整落点接球继续计算。",
      "modelingStatus": "已声明待触发审计"
    },
    "hatred": {
      "nodes": [
        "C1",
        "C2",
        "R3"
      ],
      "interfaces": [
        "重掷资源"
      ],
      "mechanism": "对指定关键词目标 Block 可重掷一个 Player Down 骰。",
      "modelingStatus": "已声明待触发审计"
    },
    "hitAndRun": {
      "nodes": [
        "M5",
        "C4"
      ],
      "interfaces": [
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "Block 后可免费移动一格并结束在不被贴身处；FAQ 允许 Blitz Stab 后触发且结束激活。",
      "modelingStatus": "已声明待触发审计"
    },
    "horns": {
      "nodes": [
        "C4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "仅 Blitz 中 Block 的 ST 加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "hypnoticGaze": {
      "nodes": [
        "Z2",
        "Z5",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "可先移动再对相邻站立对手三以上施加 Distracted；无论成败结束激活，下游收益需重算。",
      "modelingStatus": "已声明待触发审计"
    },
    "insignificant": {
      "nodes": [],
      "interfaces": [
        "队伍与长期效果"
      ],
      "mechanism": "组队时该特性人数不能超过无该特性人数；仅阵容合法性，不增加即时能力。",
      "modelingStatus": "已声明待触发审计"
    },
    "ironHardSkin": {
      "nodes": [
        "S2",
        "S3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数"
      ],
      "mechanism": "禁止对手修正针对其的护甲，Claws 无效。",
      "modelingStatus": "已声明待触发审计"
    },
    "juggernaut": {
      "nodes": [
        "C1",
        "C4",
        "Z4"
      ],
      "interfaces": [
        "结果转换",
        "动作资格"
      ],
      "mechanism": "Blitz 中 Both Down 可转 Push Back，目标不能用 Fend、Stand Firm、Wrestle。",
      "modelingStatus": "已声明待触发审计"
    },
    "jumpUp": {
      "nodes": [
        "M1",
        "C1",
        "S5"
      ],
      "interfaces": [
        "动作资格",
        "检定参数"
      ],
      "mechanism": "免费起身；倒地声明 Block 须 AG 加一检定。",
      "modelingStatus": "已声明待触发审计"
    },
    "kick": {
      "nodes": [
        "Z5",
        "B4"
      ],
      "interfaces": [
        "位置与状态",
        "重掷资源"
      ],
      "mechanism": "开球偏移距离可用 D3；Punt 可重掷方向和距离，分别计算实际球落点与球权。",
      "modelingStatus": "已声明待触发审计"
    },
    "kickTeamMate": {
      "nodes": [
        "M4",
        "B4",
        "C3",
        "R3",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换"
      ],
      "mechanism": "每回合一次可先移动的踢队友，不消耗团队 Throw Team-mate；失手踢计算队友伤害与落球。",
      "modelingStatus": "已声明待触发审计"
    },
    "leader": {
      "nodes": [
        "R2",
        "R3"
      ],
      "interfaces": [
        "重掷资源",
        "次数与时序",
        "队伍与长期效果"
      ],
      "mechanism": "半场开始在场提供一次 Leader 重掷；使用时需 Leader 在场，全部伤亡或罚出可能丢失资源。",
      "modelingStatus": "已声明待触发审计"
    },
    "leap": {
      "nodes": [
        "M2",
        "M3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数"
      ],
      "mechanism": "可跨任意邻格 Leap；负修正减一但最低仍负一。",
      "modelingStatus": "已声明待触发审计"
    },
    "lethalFlight": {
      "nodes": [
        "C3",
        "M4",
        "R4"
      ],
      "interfaces": [
        "检定参数",
        "队伍与长期效果"
      ],
      "mechanism": "被投队友撞落击倒对手时护甲或伤害加一；伤退经验归属另列，需要 Right Stuff。",
      "modelingStatus": "已声明待触发审计"
    },
    "loneFouler": {
      "nodes": [
        "C5",
        "R3"
      ],
      "interfaces": [
        "重掷资源",
        "动作资格"
      ],
      "mechanism": "无攻防协助的 Foul 可重掷失败护甲。",
      "modelingStatus": "已声明待触发审计"
    },
    "loner": {
      "nodes": [
        "R3",
        "R1"
      ],
      "interfaces": [
        "重掷资源",
        "检定参数"
      ],
      "mechanism": "使用球队重掷须通过指定 X+，失败仍损失重掷；不作用于专用技能重掷。",
      "modelingStatus": "已声明待触发审计"
    },
    "mightyBlow": {
      "nodes": [
        "C3",
        "C4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "Block 击倒的对手护甲或伤害加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "monstrousMouth": {
      "nodes": [
        "Z1",
        "Z5",
        "B5",
        "C4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "位置与状态"
      ],
      "mechanism": "Chomp 三以上使被贴身目标不能自主离格；可替代 Blitz Block 后继续，持有者免 Strip Ball。",
      "modelingStatus": "已声明待触发审计"
    },
    "multipleBlock": {
      "nodes": [
        "C1",
        "C2",
        "C3",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "Block 同时针对两目标且各 ST 减二，不跟进不与 Frenzy 合用；两次均完整结算含 Turnover 后规则。",
      "modelingStatus": "已声明待触发审计"
    },
    "myBall": {
      "nodes": [
        "B4",
        "R4"
      ],
      "interfaces": [
        "动作资格"
      ],
      "mechanism": "不能声明传球或手递手。",
      "modelingStatus": "已声明待触发审计"
    },
    "nervesOfSteel": {
      "nodes": [
        "B2",
        "B3",
        "B4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "接球和传球忽略 Marking 修正。",
      "modelingStatus": "已声明待触发审计"
    },
    "noBall": {
      "nodes": [
        "B1",
        "B2",
        "B6",
        "Z5",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "结果转换"
      ],
      "mechanism": "自动捡球和接球失败，不能拦截；不可把未实现等同此明确限制。",
      "modelingStatus": "已声明待触发审计"
    },
    "onTheBall": {
      "nodes": [
        "M5",
        "Z5",
        "B6"
      ],
      "interfaces": [
        "动作资格",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "对手传球目标声明后或适用开球时最多移动三格，无 Rush；依次移动，摔倒终止，预览默认未使用需声明策略。",
      "modelingStatus": "已声明待触发审计"
    },
    "pass": {
      "nodes": [
        "B3",
        "B4",
        "R3"
      ],
      "interfaces": [
        "重掷资源"
      ],
      "mechanism": "允许重掷失败 PA 传球检定。",
      "modelingStatus": "已声明待触发审计"
    },
    "pickMeUp": {
      "nodes": [
        "S5",
        "Z2"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "对手回合末三格内 Prone 队友五以上起身；不直接恢复 KO/CAS。",
      "modelingStatus": "已声明待触发审计"
    },
    "pileDriver": {
      "nodes": [
        "C5",
        "S5",
        "R3",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "Block 击倒且仍贴身后额外免费 Foul，自身 Placed Prone 并结束激活；不占团队 Foul。",
      "modelingStatus": "已声明待触发审计"
    },
    "plagueRidden": {
      "nodes": [
        "R2",
        "R4"
      ],
      "interfaces": [
        "次数与时序",
        "队伍与长期效果"
      ],
      "mechanism": "每场一次合资格 Block 导致未救活 Dead 时向替补新增 Lineman；非当前攻击额外伤害且不使新人即时入场。",
      "modelingStatus": "已声明待触发审计"
    },
    "pogo": {
      "nodes": [
        "M2",
        "M3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数"
      ],
      "mechanism": "可越任意邻格 Pogo 并忽略负修正。",
      "modelingStatus": "已声明待触发审计"
    },
    "prehensileTail": {
      "nodes": [
        "Z1",
        "Z5"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "对手离开其擒抱区闪避、Jump、Leap 减一。",
      "modelingStatus": "已声明待触发审计"
    },
    "pro": {
      "nodes": [
        "R3",
        "R1"
      ],
      "interfaces": [
        "重掷资源",
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "每激活一次三以上重掷一个骰，不含护甲伤害伤亡；实际成功链已计入不能再次乘折扣。",
      "modelingStatus": "已声明待触发审计"
    },
    "projectileVomit": {
      "nodes": [
        "C3",
        "C4",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "结果转换"
      ],
      "mechanism": "特殊呕吐或替代 Blitz Block，二以上对目标无修正护甲，一对自身无修正护甲。",
      "modelingStatus": "已声明待触发审计"
    },
    "punt": {
      "nodes": [
        "B3",
        "B4",
        "M4",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "每回合一次可先移动，模板随机方向距离，继续接球弹跳；地面无 Turnover，对手持球或飞出界才 Turnover。",
      "modelingStatus": "已声明待触发审计"
    },
    "putTheBootIn": {
      "nodes": [
        "Z2",
        "C5"
      ],
      "interfaces": [
        "动作资格",
        "检定参数"
      ],
      "mechanism": "受贴身也可提供犯规进攻协助，检验 Defensive 与回合条件。",
      "modelingStatus": "已声明待触发审计"
    },
    "quickFoul": {
      "nodes": [
        "M5",
        "C5"
      ],
      "interfaces": [
        "动作资格",
        "次数与时序"
      ],
      "mechanism": "Foul 后激活不结束，可继续剩余移动。",
      "modelingStatus": "已声明待触发审计"
    },
    "reallyStupid": {
      "nodes": [
        "R1",
        "R4",
        "Z3"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态"
      ],
      "mechanism": "声明动作后判定，合资格相邻队友加二，一至三 Distracted。",
      "modelingStatus": "已声明待触发审计"
    },
    "regeneration": {
      "nodes": [
        "S4"
      ],
      "interfaces": [
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "Casualty 后四以上送替补；当前 drive 仍离场，后续重新可用需时间窗。",
      "modelingStatus": "已声明待触发审计"
    },
    "rightStuff": {
      "nodes": [
        "M4",
        "B4",
        "R4"
      ],
      "interfaces": [
        "动作资格"
      ],
      "mechanism": "可由 Throw Team-mate 队友投掷，包括 Prone；联合任务不得给双方各记完整得分收益。",
      "modelingStatus": "已声明待触发审计"
    },
    "saboteur": {
      "nodes": [
        "S3",
        "C2",
        "C3",
        "R4"
      ],
      "interfaces": [
        "检定参数",
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "被对手 Block 击倒后护甲前四以上使攻击者也击倒，自身 KO；对手持球才相关 Turnover。",
      "modelingStatus": "已声明待触发审计"
    },
    "safePairOfHands": {
      "nodes": [
        "B5",
        "B6"
      ],
      "interfaces": [
        "位置与状态",
        "结果转换"
      ],
      "mechanism": "持球倒地时可放球到相邻空格代替弹跳；不等于保有球权。",
      "modelingStatus": "已声明待触发审计"
    },
    "safePass": {
      "nodes": [
        "B3",
        "B4",
        "R1"
      ],
      "interfaces": [
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "PA 自然一不是 Fumble，保球结束激活且无 Turnover。",
      "modelingStatus": "已声明待触发审计"
    },
    "secretWeapon": {
      "nodes": [
        "R2",
        "R3"
      ],
      "interfaces": [
        "次数与时序",
        "队伍与长期效果"
      ],
      "mechanism": "参加的 drive 结束被罚出，处理申诉贿赂；practice 无 drive 不可假造其影响。",
      "modelingStatus": "已声明待触发审计"
    },
    "shadowing": {
      "nodes": [
        "M5",
        "Z1",
        "Z5",
        "R3"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "对手闪避离开时四以上追踪进腾出格，每回合最多 MA 次。",
      "modelingStatus": "已声明待触发审计"
    },
    "sidestep": {
      "nodes": [
        "S1",
        "Z3",
        "Z4"
      ],
      "interfaces": [
        "位置与状态"
      ],
      "mechanism": "被推开时自身教练选择任意相邻空格，实际选择需策略。",
      "modelingStatus": "已声明待触发审计"
    },
    "sneakyGit": {
      "nodes": [
        "C5",
        "R2"
      ],
      "interfaces": [
        "结果转换"
      ],
      "mechanism": "犯规护甲自然双骰且未破甲时免罚出；保留双骰点数而非仅总和。",
      "modelingStatus": "已声明待触发审计"
    },
    "sprint": {
      "nodes": [
        "M1",
        "M4"
      ],
      "interfaces": [
        "动作资格"
      ],
      "mechanism": "Move Action 可多一次 Rush。",
      "modelingStatus": "已声明待触发审计"
    },
    "stab": {
      "nodes": [
        "C3",
        "C4",
        "R3"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "相邻站立目标无修正护甲、破甲后伤害，可代替 Blitz Block；每回合次数不限但激活结束。",
      "modelingStatus": "已声明待触发审计"
    },
    "standFirm": {
      "nodes": [
        "S1",
        "Z3",
        "Z4"
      ],
      "interfaces": [
        "位置与状态"
      ],
      "mechanism": "可拒绝推开，含 Chain Push。",
      "modelingStatus": "已声明待触发审计"
    },
    "steadyFooting": {
      "nodes": [
        "M1",
        "M2",
        "S1",
        "R1"
      ],
      "interfaces": [
        "检定参数",
        "结果转换",
        "次数与时序"
      ],
      "mechanism": "将要击倒或摔倒时自然六保持站立；FAQ 后失败闪避 Rush Jump 可继续路径，保留比赛规则版本。",
      "modelingStatus": "已声明待触发审计"
    },
    "stripBall": {
      "nodes": [
        "Z5",
        "B6"
      ],
      "interfaces": [
        "结果转换",
        "位置与状态"
      ],
      "mechanism": "推开持球者使其落球，仍须后续回收；处理 Sure Hands/Monstrous Mouth。",
      "modelingStatus": "已声明待触发审计"
    },
    "strongArm": {
      "nodes": [
        "M4",
        "B4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "Throw Team-mate 的 PA 检定加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "stunty": {
      "nodes": [
        "M2",
        "M3",
        "S3",
        "Z5"
      ],
      "interfaces": [
        "检定参数",
        "结果转换"
      ],
      "mechanism": "闪避忽略 Marking 修正，拦截减一且使用 Stunty 伤害表，优势代价分开。",
      "modelingStatus": "已声明待触发审计"
    },
    "sureFeet": {
      "nodes": [
        "M1",
        "M4",
        "R3"
      ],
      "interfaces": [
        "重掷资源",
        "次数与时序"
      ],
      "mechanism": "每回合一次重掷 Rush。",
      "modelingStatus": "已声明待触发审计"
    },
    "sureHands": {
      "nodes": [
        "B1",
        "B5",
        "B6",
        "R3"
      ],
      "interfaces": [
        "重掷资源",
        "结果转换"
      ],
      "mechanism": "失败普通捡球可重掷但不含 Secure the Ball，免 Strip Ball。",
      "modelingStatus": "已声明待触发审计"
    },
    "swoop": {
      "nodes": [
        "M4",
        "B4",
        "R3"
      ],
      "interfaces": [
        "位置与状态",
        "重掷资源"
      ],
      "mechanism": "非 Fumbled Throw 被投队友可用模板方向距离代替偏移并重掷落地；预览默认未使用需声明。",
      "modelingStatus": "已声明待触发审计"
    },
    "tackle": {
      "nodes": [
        "C2",
        "C4",
        "Z1",
        "Z5"
      ],
      "interfaces": [
        "动作资格",
        "结果转换"
      ],
      "mechanism": "对手离其擒抱区闪避不能用 Dodge，攻击时 Stumble 忽略 Dodge。",
      "modelingStatus": "已声明待触发审计"
    },
    "takeRoot": {
      "nodes": [
        "M1",
        "S1",
        "Z3",
        "R1"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "站立声明动作掷一 Rooted，禁移动跟进且不能推开，直到倒地或 drive 结束。",
      "modelingStatus": "已声明待触发审计"
    },
    "taunt": {
      "nodes": [
        "Z4",
        "Z3"
      ],
      "interfaces": [
        "位置与状态"
      ],
      "mechanism": "被 Block 推开可强制攻击者跟进。",
      "modelingStatus": "已声明待触发审计"
    },
    "tentacles": {
      "nodes": [
        "Z1",
        "Z5"
      ],
      "interfaces": [
        "检定参数",
        "位置与状态"
      ],
      "mechanism": "对手离其擒抱区以 D6 加双方 ST 差达到六留住。",
      "modelingStatus": "已声明待触发审计"
    },
    "thickSkull": {
      "nodes": [
        "S3",
        "S5"
      ],
      "interfaces": [
        "结果转换"
      ],
      "mechanism": "普通伤害八或 Stunty 七从 KO 转眩晕。",
      "modelingStatus": "已声明待触发审计"
    },
    "throwTeamMate": {
      "nodes": [
        "M4",
        "B4",
        "R3",
        "R4"
      ],
      "interfaces": [
        "动作资格",
        "检定参数",
        "位置与状态"
      ],
      "mechanism": "授予 Throw Team-mate 资格，完整计算投掷、散落、落地与队友状态，不等于独立得分率。",
      "modelingStatus": "已声明待触发审计"
    },
    "timmmber": {
      "nodes": [
        "M1",
        "S5",
        "Z2",
        "R4"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "MA 二或以下起身，每位相邻 Open 站立队友加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "titchy": {
      "nodes": [
        "M2",
        "M3",
        "Z1"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "自身闪避加一，但对手进入其擒抱区闪避不受 Marking 负一。",
      "modelingStatus": "已声明待触发审计"
    },
    "trickster": {
      "nodes": [
        "M5",
        "S1",
        "B6"
      ],
      "interfaces": [
        "动作资格",
        "位置与状态",
        "次数与时序"
      ],
      "mechanism": "被 Block 或适用特殊动作针对前移到攻击者邻接空格，球格可捡球；Rooted 禁移动，FAQ 清除 Chomped。",
      "modelingStatus": "已声明待触发审计"
    },
    "twoHeads": {
      "nodes": [
        "M2",
        "M3"
      ],
      "interfaces": [
        "检定参数"
      ],
      "mechanism": "闪避检定加一。",
      "modelingStatus": "已声明待触发审计"
    },
    "unchannelledFury": {
      "nodes": [
        "R1",
        "R4"
      ],
      "interfaces": [
        "检定参数",
        "次数与时序"
      ],
      "mechanism": "声明动作判定，Block/Blitz 加二，一至三结束激活。",
      "modelingStatus": "已声明待触发审计"
    },
    "unsteady": {
      "nodes": [
        "B1",
        "R4"
      ],
      "interfaces": [
        "动作资格"
      ],
      "mechanism": "不能声明 Secure the Ball。",
      "modelingStatus": "已声明待触发审计"
    },
    "veryLongLegs": {
      "nodes": [
        "M2",
        "M3",
        "Z5"
      ],
      "interfaces": [
        "检定参数",
        "动作资格"
      ],
      "mechanism": "Leap/Jump 加一，拦截加二且忽略 Cloud Burster。",
      "modelingStatus": "已声明待触发审计"
    },
    "violentInnovator": {
      "nodes": [],
      "interfaces": [
        "队伍与长期效果"
      ],
      "mechanism": "特殊动作造成 Casualty 获得经验；仅培养收益，不增加即时伤害概率，特殊行动范围依实际实现。",
      "modelingStatus": "已声明待触发审计"
    },
    "wrestle": {
      "nodes": [
        "C1",
        "C2",
        "S1"
      ],
      "interfaces": [
        "结果转换"
      ],
      "mechanism": "Both Down 可将双方 Placed Prone 且无护甲检定，不能混同 Knocked Down。",
      "modelingStatus": "已声明待触发审计"
    }
  }
};
if(typeof module==='object' && module.exports) module.exports=value; else root.BB_STANDARD_TASK_RULE_IMPACT_V1=value;
})(typeof window==='object'?window:globalThis);
