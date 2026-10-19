/* Select candidate publication or a frozen historical version before mounting score views. */
(() => {
  'use strict';
  const v7=window.BB_STANDARD_TASK_EXPERIMENT_V1,delta8=window.BB_STANDARD_TASK_EXPERIMENT_V8;
  const v8=delta8?.browserDelta?{...delta8,dossiers:v7.dossiers,teamDossiers:v7.teamDossiers.map(r=>delta8.teamDossiers.find(n=>n.subjectId===r.subjectId)||r)}:delta8||v7;
  window.BB_STANDARD_TASK_PREVIOUS_V7=v7;
  const mode='candidate';
  window.BB_ROSTER_CANDIDATE_PENDING=!window.BB_ROSTER_CANDIDATE_V12;
  const v9=window.BB_STANDARD_TASK_EXPERIMENT_V9;
  window.BB_STANDARD_VERSION_MODE=mode;
  window.BB_STANDARD_TASK_EXPERIMENT_V1=mode==='previous'?v7:mode==='experiment'&&v9?{...v8,...v9,dossiers:v8.dossiers,teamDossiers:v8.teamDossiers.map(r=>v9.teamDossiers.find(n=>n.subjectId===r.subjectId)||r)}:v8;
  window.BB_SURVIVAL_V9_ACTIVE=mode==='experiment'&&Boolean(v9);
  const candidate=window.BB_ROSTER_CANDIDATE_V12;
  window.BB_ROSTER_CANDIDATE_ACTIVE=mode==='candidate'&&Boolean(candidate);
  if(window.BB_ROSTER_CANDIDATE_ACTIVE){
    const replacements=new Map((candidate.teamDossiers||[]).filter(r=>r.format==='11s').map(r=>[r.subjectId+'|'+r.format,r]));
    window.BB_STANDARD_TASK_EXPERIMENT_V1={...v8,version:candidate.version,generatedAt:candidate.generatedAt,summary:{...v8.summary,...candidate.summary,teams:v8.summary.teams,rosterCandidateTeams:replacements.size},teamDossiers:v8.teamDossiers.map(r=>replacements.get(r.subjectId+'|'+r.format)||r)};
  }
})();
