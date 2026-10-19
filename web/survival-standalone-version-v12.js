(function(){
  'use strict';
  const available = !!window.BB_ROSTER_CANDIDATE_V12?.survival;
  window.BB_ROSTER_CANDIDATE_ACTIVE = available;
  document.title = (window.BB_ROSTER_CANDIDATE_ACTIVE ? '新军表' : '历史军表') + ' V11 生存榜 · 六维球探';
})();
