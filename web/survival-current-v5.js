(() => {
  'use strict';
  const names={amazon:'亚马逊',dwarf:'矮人',orc:'兽人',blackOrc:'黑兽人',highElf:'高精',norse:'诺斯',lizardmen:'蜥蜴人',underworld:'地下世界',darkElf:'黑暗精灵',gnome:'侏儒',vampire:'吸血鬼',skaven:'鼠人',oldWorldAlliance:'旧世界联盟',chaosRenegade:'混沌叛军',woodElf:'木精灵',imperialNobility:'帝国贵族',halfling:'半身人',necromantic:'死灵队',nurgle:'纳垢',elvenUnion:'精灵联盟',chaosChosen:'混沌神选',khorne:'恐虐',human:'人类',snotling:'鼻涕精',chaosDwarf:'混沌矮人',shamblingUndead:'亡灵',bretonnian:'布列塔尼亚',ogre:'食人魔',goblin:'哥布林',tombKings:'古墓王'};
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const show=(lo,hi,d=2)=>Number.isFinite(lo)&&Number.isFinite(hi)?Math.abs(hi-lo)<1e-8?lo.toFixed(d):lo.toFixed(d)+'–'+hi.toFixed(d):'未确定';
  const start=()=>{
    const candidate=Boolean(window.BB_ROSTER_CANDIDATE_ACTIVE);
    const root=document.getElementById('survival-weight-playground'),data=candidate?window.BB_ROSTER_CANDIDATE_V12?.survival:window.BB_SURVIVAL_BLOODLUST_V11;
    if(!root||!data)return;
    const ref=candidate?null:data.rows.find(r=>r.teamId==='standard-highElf')?.individuals.find(p=>p.playerId==='book-highElf-s-7')?.preserved;
    const reference=candidate?data.referenceRisk:ref&&ref.lowerBound===ref.upperBound?100-ref.lowerBound:null;
    if(!Number.isFinite(reference)||reference<=0){root.textContent='风险参照未确定，暂不能计算；不补零。';return;}
    const toRisk=v=>100*reference/(reference+100-v);
    // Candidate publication already contains risk-mapped B; historical rows contain retention B.
    const rows=data.rows.map(r=>({id:r.teamId,name:names[r.teamId.replace('standard-','')]||r.name,axes:candidate?r.components:[r.components[0],{lowerBound:toRisk(r.components[1].lowerBound),upperBound:toRisk(r.components[1].upperBound)},r.components[2]]}));
    const geometric=candidate&&data.aggregationMethod==='weighted-geometric';
    const labels=['抗击倒','抗伤（风险分）','恢复／队友内耗'],defaults=candidate&&Array.isArray(data.weights)?data.weights.map(w=>w*100):[45,45,10];
    root.innerHTML=`<p class="eyebrow muted">${candidate?"当前1150K高手军表":"历史旧军表研究"} · V11生存</p><h2>${candidate?"当前30队":"历史旧30队"}生存权重手调</h2><p>采用<strong>风险抗伤＋嗜血内耗 V11${geometric?" · 加权几何平均":""}</strong>。三个比例可调，排名即时更新；分数不先取整。这里只预览生存赋分，不改变已发布六维或综合总榜。${candidate?"当前使用高手军表及已明确的11人首发。":"当前使用历史旧军表数据，与历史评分版本的综合总榜另列。"}</p><div class="survival-weight-controls">${labels.map((name,i)=>`<div><label for="survival-current-weight-${i}">${name}</label><input id="survival-current-weight-${i}" type="number" data-current-number="${i}" min="0" max="100" step="0.1" value="${defaults[i]}" aria-label="${name}权重"><span>份</span><input type="range" data-current-range="${i}" min="0" max="100" step="0.1" value="${defaults[i]}" aria-label="${name}权重滑块"><strong data-current-share="${i}"></strong></div>`).join('')}</div><p><button type="button" data-current-reset>恢复${defaults.join("／")}</button></p><p data-current-formula></p><p data-current-error role="alert" hidden></p><p>生存分为30队内的相对赋分；范围表示名次尚未唯一确定，不取中点、不把缺项填零。</p><div class="survival-weight-scroll" tabindex="0" aria-label="30队完整生存表，可横向滚动"><table class="survival-current-table"><thead><tr><th>名次</th><th>球队</th><th>生存分</th><th>抗击倒</th><th>抗伤风险分</th><th>恢复／内耗</th><th>${geometric?"几何底分":"加权底分"}</th></tr></thead><tbody data-current-results></tbody></table></div><details><summary>三个分项怎么算</summary><p>A抗击倒：普通Block的力量3／4／6固定任务，各占三分之一，首发11人等权。</p><p>B抗伤风险分：只看已经被击倒后的伤害；r＝KO＋再生后最终伤退。B＝100×r₀÷(r₀＋r)，固定参照r₀＝${reference.toFixed(5)}%，${candidate?"采用发布时冻结的参照风险；不通过新球员ID重新查找旧参照。":"来自历史文件中AV9、无初始技能球员。"}再生回替补区保留，不当成立即仍在场。</p><p>C恢复／队友内耗：两次恢复行动机会；吸血鬼用〔完成行动次数−血仆受伤损失机会〕÷2，队友眩晕、KO和伤退都会影响结果；两轮共用一枚重掷。同一伤害不再从B重复扣分。其他球员沿用恢复任务。</p><p>${geometric?"几何底分＝100×(A/100)^a×(B/100)^b×(C/100)^c，a/b/c为归一化比例；不是连续事件成功率。权重为0的项不参与乘积；":"加权底分＝三个分项按输入比例归一后相加；"}生存分＝100×〔低于本队的队数＋其他同分队数÷2〕÷29。并列同名次；区间按最好可能名次展示，重叠行序不代表确定先后。</p><p>这是固定规则任务，不是比赛胜率。Ball & Chain没有合法留场倒地起点，恢复项保留范围。医师、替补回场和整场受击频率仍未加入；不增加阵型或教练操作加成。<a href="${candidate?"standard-task-roster-candidate-data-v12.js":"survival-bloodlust-v11.json.gz"}">查看${candidate?"候选新军表":"历史旧军表"}任务数据与来源</a></p></details>`;
    const paint=()=>{
      const weights=Array.from(root.querySelectorAll('[data-current-number]'),n=>n.value.trim()===''?NaN:Number(n.value)),total=weights.reduce((a,b)=>a+b,0);
      const valid=weights.every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&total>0,error=root.querySelector('[data-current-error]'),body=root.querySelector('[data-current-results]');
      error.hidden=valid;error.textContent=valid?'':'请填写0至100，至少一项大于0。当前无法计算。';
      root.querySelectorAll('[data-current-share]').forEach((node,i)=>node.textContent=valid?'实际占比 '+(weights[i]/total*100).toFixed(2)+'%':'实际占比 —');
      root.querySelector('[data-current-formula]').textContent=valid?(geometric?'加权几何平均：':'')+labels.map((label,i)=>(weights[i]/total*100).toFixed(2)+'% '+label).join(geometric?' × ':' ＋ '):'';
      if(!valid){body.innerHTML='';return;}
      const scored=rows.map(r=>{
        const complete=r.axes.every(v=>Number.isFinite(v.lowerBound)&&Number.isFinite(v.upperBound)&&v.lowerBound<=v.upperBound);
        const aggregate=key=>geometric?100*r.axes.reduce((n,v,i)=>weights[i]===0?n:n*Math.pow(v[key]/100,weights[i]/total),1):r.axes.reduce((n,v,i)=>n+v[key]*weights[i]/total,0);
        return {...r,lo:complete?aggregate('lowerBound'):null,hi:complete?aggregate('upperBound'):null};
      });
      const ranked=scored.map(e=>{
        if(e.lo===null)return {...e,rankLo:null,rankHi:null};
        let aboveMin=0,aboveMax=0,pointMin=0,pointMax=0;
        for(const other of scored){
          if(other===e)continue;
          if(other.lo===null){aboveMax++;pointMax++;continue;}
          const tied=Math.abs(e.hi-e.lo)<1e-8&&Math.abs(other.hi-other.lo)<1e-8&&Math.abs(e.lo-other.lo)<1e-8;
          if(tied){pointMin+=.5;pointMax+=.5;continue;}
          if(other.lo>e.hi+1e-8)aboveMin++;
          if(other.hi>e.lo+1e-8)aboveMax++;
          pointMin+=e.lo>other.hi+1e-8?1:Math.abs(e.lo-other.hi)<1e-8?.5:0;
          pointMax+=e.hi>other.lo+1e-8?1:Math.abs(e.hi-other.lo)<1e-8?.5:0;
        }
        return {...e,rankLo:aboveMin+1,rankHi:aboveMax+1,pointsLo:100*pointMin/(scored.length-1),pointsHi:100*pointMax/(scored.length-1)};
      }).sort((a,b)=>(a.rankLo??Infinity)-(b.rankLo??Infinity)||(a.rankHi??Infinity)-(b.rankHi??Infinity)||a.name.localeCompare(b.name));
      body.innerHTML=ranked.map(e=>`<tr><td>${show(e.rankLo,e.rankHi,0)}</td><th>${esc(e.name)}</th><td><strong>${show(e.pointsLo,e.pointsHi)}</strong></td>${e.axes.map(v=>`<td>${show(v.lowerBound,v.upperBound)}</td>`).join('')}<td>${show(e.lo,e.hi,4)}</td></tr>`).join('');
    };
    root.oninput=event=>{
      const input=event.target;
      if(input.matches('[data-current-range]'))root.querySelector(`[data-current-number="${input.dataset.currentRange}"]`).value=input.value;
      else if(input.matches('[data-current-number]')){if(input.value!==''&&input.validity.valid)root.querySelector(`[data-current-range="${input.dataset.currentNumber}"]`).value=input.value;}
      else return;
      paint();
    };
    root.querySelector('[data-current-reset]').onclick=()=>{defaults.forEach((v,i)=>{root.querySelector(`[data-current-number="${i}"]`).value=v;root.querySelector(`[data-current-range="${i}"]`).value=v;});paint();};
    paint();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
