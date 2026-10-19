window.BB_TEAM_ROSTER_ADJUSTMENTS_V701 = (() => {
  const corrections = {
    "sevens-human": { kind: "tier-budget", playerNumber: 3, removedSkill: "block", reason: "Tier 1 仅有 1 点技能点；保留较早列出的 Blitzer Guard，移除 Catcher 购入 Block。", originalSpent: 2, allowed: 1 },
    "sevens-elvenUnion": { kind: "tier-budget", playerNumber: 2, removedSkill: "leader", reason: "Tier 1 仅有 1 点技能点；保留 Catcher Dodge，移除 Thrower 购入 Leader。", originalSpent: 2, allowed: 1 },
    "sevens-halfling": { kind: "tier-budget", playerNumber: 3, removedSkill: "sureHands", reason: "Tier 3 仅有 3 点技能点；保留两名 Treeman 的 Guard，移除 Catcher 购入 Sure Hands。", originalSpent: 4, allowed: 3 },
    "sevens-necromantic": { kind: "tier-budget", playerNumber: 3, removedSkill: "block", reason: "Tier 1 仅有 1 点技能点；保留 Werewolf 购入 Block，移除 Ghoul 购入 Block。", originalSpent: 2, allowed: 1 },
    "sevens-nurgle": { kind: "tier-budget", playerNumber: 3, removedSkill: "sureHands", reason: "Tier 2 仅有 2 点技能点；保留 Bloater 的 Block 与 Guard，移除 Pestigor 购入 Sure Hands。", originalSpent: 3, allowed: 2 },
    "sevens-skaven": { kind: "tier-budget", playerNumber: 1, removedSkill: "tackle", reason: "Tier 1 仅有 1 点技能点；保留 Gutter Runner 购入 Block，移除 Blitzer 购入 Tackle。", originalSpent: 2, allowed: 1 },
  };

  function apply(data) {
    for (const [teamId, correction] of Object.entries(corrections)) {
      const team = data.teams.find(row => row.id === teamId);
      if (!team) throw new Error(`Roster adjustment target not found: ${teamId}`);
      const player = team.players.find(row => Number(row.number) === correction.playerNumber);
      if (!player) throw new Error(`Roster adjustment player not found: ${teamId} #${correction.playerNumber}`);
      if (correction.kind === "tier-budget") {
        if (player.boughtSkill !== correction.removedSkill) throw new Error(`Unexpected purchase on ${teamId} #${correction.playerNumber}: ${player.boughtSkill}`);
        player.rosterAdjustment = { removedBoughtSkill: player.boughtSkill, reason: correction.reason };
        player.boughtSkill = "";
        const skillLabel = correction.removedSkill === "block" ? "Block" : correction.removedSkill === "leader" ? "Leader" : correction.removedSkill === "sureHands" ? "Sure Hands" : "Tackle";
        player.skillText = String(player.skillText || "").replace(new RegExp(`[、, ]*${skillLabel}（购入）`), "");
        team.rosterAdjustment = { ...correction, source: "V6.1 Sevens Tier skill-point budget", originalBoughtSkillRecorded: correction.removedSkill };
      } else if (correction.kind === "profile-correction") {
        const skill = player.skills.find(row => row.id === correction.skill);
        if (!skill || Number(skill.value) !== correction.from) throw new Error(`Unexpected ${correction.skill} profile on ${teamId} #${correction.playerNumber}`);
        skill.value = correction.to;
        player.skillText = String(player.skillText || "").replace(`Loner (${correction.from}+)`, `Loner (${correction.to}+)`);
        team.rosterAdjustment = { ...correction, source: "Bloodboard V6.1 roster position profile" };
      } else if (correction.kind === "required-setup") {
        if (player.positionId !== "lineman") throw new Error(`Veteran must be assigned to a Lineman: ${teamId} #${correction.playerNumber}`);
        player.veteran = correction.veteran;
        player.ma += correction.maDelta;
        team.rosterAdjustment = { ...correction, source: "Bloodboard V6.1 Sevens team setup rule" };
      }
    }
    return data;
  }

  return Object.freeze({ schema: "bloodbowl-team-roster-adjustments-v701/1", corrections, apply });
})();
