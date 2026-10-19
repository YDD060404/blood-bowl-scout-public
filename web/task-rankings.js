(() => {
  // These compare one declared event. They are neither axis scores nor Strength.
  const METRICS = [
    ...[4, 6, 8].map(distance => ({ id: `task-open${distance}`, label: `机动 · 开阔 ${distance} 格安全站立抵达`, task: `open${distance}`, field: "safeObjective" })),
    { id: "task-escape", label: "机动 · 脱离单人盯防后两格安全抵达", task: "escape", field: "safeObjective" },
    { id: "task-pickup", label: "球权 · 一步拾球后本人安全持球", task: "pickup", field: "safeObjective" },
    { id: "task-handoff", label: "球权 · 相邻交接后接应者安全持球", task: "handoff", field: "safeObjective" },
    { id: "task-pass", label: "球权 · 三格传球后接应者安全持球", task: "pass", field: "safeObjective" },
    ...["normal", "stripBall", "tackle"].map((threat, index) => ({ id: `task-carrier-${threat}`, label: `球权 · ${["普通", "剥球", "擒抱"][index]}来袭后本人保球`, task: `carrier-${threat}`, field: "carrier", incoming: true })),
    { id: "task-block", label: "对抗 · 对 ST3 / AV9 安全击倒或移出", task: "block", field: "safeObjective" },
    { id: "task-removal", label: "对抗 · 对 ST3 / AV9 安全移出", task: "block", field: "safeRemoval" },
    { id: "task-foul", label: "对抗 · 已有倒地 AV9 目标的安全犯规移出", task: "foul", field: "safeRemoval" },
    { id: "task-chainsaw", label: "对抗 · 电锯对 AV9 目标安全移出", task: "weapon", field: "safeRemoval", requiredTask: "chainsaw" },
    { id: "task-ballchain", label: "对抗 · 球链单步对 ST3 / AV9 安全击倒或移出", task: "weapon", field: "safeObjective", requiredTask: "ballAndChain" },
    ...[3, 4, 6].map(strength => ({ id: `task-survival${strength}`, label: `生存 · ST${strength} + Block 来袭后未被移出`, task: `incoming${strength}`, field: "removed", complement: true, incoming: true })),
    ...[3, 4, 6].map(strength => ({ id: `task-control${strength}`, label: `静态控场 · ST${strength} + Block 来袭后局部仍有盯防区`, task: `incoming${strength}`, field: "localTackleZone", incoming: true })),
    { id: "task-disruption", label: "控场 · 对 ST3 持球人安全破坏对方球权", task: "disruption", field: "safeObjective" },
    { id: "task-block-risk", label: "可靠性 · 同条件普通阻挡 Turnover 风险", task: "block", field: "turnover", risk: true },
    { id: "task-pickup-risk", label: "可靠性 · 同条件一步拾球 Turnover 风险", task: "pickup", field: "turnover", risk: true }
  ];
  function signature(player) {
    return JSON.stringify([player.name, player.ma, player.st, player.ag, player.pa, player.av, player.cost,
      [...(player.keywords || [])].sort(), (player.skills || []).map(skill => [skill.id, skill.value ?? null])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  }
  function lookup(data, person, format, metricId, policy = "withoutTeamRerolls") {
    const metric = METRICS.find(item => item.id === metricId);
    if (!metric) return { reason: "未声明的排名任务" };
    const dossier = data?.rows?.[person.id + ":" + format];
    if (!dossier) return { reason: "该赛制没有参考档案" };
    if (dossier.signature !== signature(person)) return { reason: "档案已修改，需到详情重新计算；基准榜不混入旧结果" };
    const task = metric.requiredTask ? dossier.tasks[metric.requiredTask] : dossier.tasks[metric.task];
    if (!task || !task.measures) return { reason: task?.reason || "本档案不适用该任务" };
    if (metric.requiredTask && task.taskId !== metric.requiredTask) return { reason: "使用其他武器，目标事件不同" };
    const result = task.measures[policy]?.[metric.field];
    if (!result || !Number.isFinite(result.lowerBound) || !Number.isFinite(result.upperBound)) return { reason: "该事件没有概率结果" };
    const lowerBound = metric.complement ? 1 - result.upperBound : result.lowerBound;
    const upperBound = metric.complement ? 1 - result.lowerBound : result.upperBound;
    return { lowerBound, upperBound, exact: result.exact, taskId: metric.task,
      timepoint: task.timepoint, replaySha256: task.replaySha256, policy,
      // Conservative ordering is only a browsing convention; overlapping intervals are not a proved order.
      sortValue: metric.risk ? upperBound : lowerBound };
  }
  window.BB_TASK_RANKINGS = { METRICS, signature, lookup };
})();
