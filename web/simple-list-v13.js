(() => {
  'use strict';
  const start=()=>{
    const main=document.querySelector('main');
    if(!main)return;
    const list=document.getElementById('compact-list')||document.createElement('div');list.id='compact-list';main.prepend(list);
    for(const id of ['standard-task-rankings']){
      const node=document.getElementById(id);if(node)list.append(node);
    }
    const fold=(node,id,label)=>{
      if(!node)return null;
      const d=document.createElement('details');d.id=id;d.className='simple-fold';
      const s=document.createElement('summary');s.textContent=label;d.append(s);
      node.before(d);d.append(node);return d;
    };
    const catalog=document.getElementById('catalog');
    const tasks=fold(document.getElementById('standard-task-experiment'),'simple-task-detail','任务详情');
    const ranking=document.getElementById('standard-task-rankings');
    const heading=ranking?.querySelector('h2');if(heading)heading.textContent='排行榜';
    const nav=document.getElementById('standard-ranking-nav');if(nav){nav.textContent='排行榜';nav.href='#compact-list';nav.dataset.simpleView='rank';}
    const browse=document.querySelector('.top-links a[data-simple-view="browse"]')||document.createElement('a');browse.href='#catalog';browse.textContent='浏览';browse.dataset.simpleView='browse';if(!browse.isConnected)nav?.before(browse);
    const survival=document.createElement('a');survival.href='survival.html';survival.textContent='调整生存三项权重';
    const survivalTools=document.createElement('details');survivalTools.className='appearance-details';
    const survivalTitle=document.createElement('summary');survivalTitle.textContent='生存权重';survivalTools.append(survivalTitle,survival);ranking?.append(survivalTools);
    const setView=(view,updateHash=false)=>{
      document.body.dataset.simpleView=view;
      browse.setAttribute('aria-current',view==='browse'?'page':'false');nav?.setAttribute('aria-current',view==='rank'?'page':'false');
      if(updateHash)history.replaceState(null,'',location.pathname+location.search+(view==='rank'?'#compact-list':'#catalog'));
    };
    const openAtlas=window.BB_OPEN_ATLAS_PROFILE;
    if(typeof openAtlas==='function')window.BB_OPEN_ATLAS_PROFILE=function(...args){setView('browse',true);if(tasks)tasks.open=false;return openAtlas.apply(this,args);};
    const openTask=window.BB_OPEN_STANDARD_TASK_PROFILE;
    if(typeof openTask==='function')window.BB_OPEN_STANDARD_TASK_PROFILE=function(...args){if(tasks)tasks.open=true;setView('browse',true);return openTask.apply(this,args);};
    const openImportance=window.BB_OPEN_IMPORTANCE_PROFILE;
    if(typeof openImportance==='function')window.BB_OPEN_IMPORTANCE_PROFILE=function(...args){if(tasks)tasks.open=true;setView('browse',true);return openImportance.apply(this,args);};
    // Old comparison bookmarks now lead to the current useful list.
    const withdrawn=['roster-candidate-comparison','team-task-selection-comparison','norse-task-comparison','survival-weight-playground'];
    const resolveHash=()=>{
      const id=location.hash.slice(1);
      if(withdrawn.includes(id)){setView('rank',true);list.scrollIntoView({block:'start'});return;}
      setView(id==='compact-list'||id==='standard-task-rankings'?'rank':'browse');
      if(id==='standard-task-experiment')tasks.open=true;
    };
    window.addEventListener('hashchange',resolveHash);resolveHash();
    document.addEventListener('click',event=>{const link=event.target.closest('a[data-simple-view]');if(!link)return;tasks.open=false;setView(link.dataset.simpleView);});
    document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k')setView('browse',true);},true);
    const featured=document.getElementById('featured-panel');
    const compactExplanation=()=>{
      const copy=featured?.querySelector('.featured-copy');if(!copy||copy.querySelector('[data-simple-explanation]'))return;
      const paragraphs=[...copy.children].filter(n=>n.tagName==='P'&&/^(先计算标准任务底分|80个模板均用实际名单|控球、生存已按当前名单更新|快攻、控场与适应力已接入)/.test(n.textContent));
      if(!paragraphs.length)return;
      const d=document.createElement('details');d.className='appearance-details';d.dataset.simpleExplanation='';
      const s=document.createElement('summary');s.textContent='评分依据';d.append(s);paragraphs[0].before(d);paragraphs.forEach(p=>d.append(p));
    };
    if(featured)new MutationObserver(compactExplanation).observe(featured,{childList:true});
    compactExplanation();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
