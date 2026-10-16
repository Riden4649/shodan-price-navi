(()=>{'use strict';
const W=17,H=12,R=31,MAX_ROUND=18,STORAGE='steel-front-v4';
const TYPES={scout:{name:'偵察車',code:'R',move:5,atk:2,armor:0,hp:4,min:1,max:1,sight:5},tank:{name:'中戦車',code:'T',move:3,atk:3,armor:1,hp:6,min:1,max:1,sight:3},heavy:{name:'重戦車',code:'H',move:2,atk:4,armor:2,hp:8,min:1,max:1,sight:2},arty:{name:'自走砲',code:'A',move:2,atk:4,armor:0,hp:4,min:2,max:4,sight:2}};
const BASE_MOUNTAINS=new Set(['7,1','8,1','8,2','9,2','7,3','6,4','7,4','9,5','10,5','9,6','7,7','8,7','8,8','6,9','7,9','10,9','11,9']);
const BASE_LAKES=new Set(['10,2','11,2','10,3','11,3','5,10','6,10','5,11']);
const FORTS={blue:{x:0,y:5},red:{x:16,y:6}};
const OPERATIONS=[
{name:'山岳回廊',objectives:[{x:6,y:2,name:'北部監視所',short:'北'},{x:8,y:5,name:'中央交差点',short:'中'},{x:11,y:8,name:'南部補給所',short:'南'}]},
{name:'森林突破戦',objectives:[{x:5,y:3,name:'北部高台',short:'北'},{x:8,y:6,name:'中央林道',short:'中'},{x:11,y:9,name:'南部補給庫',short:'南'}]},
{name:'湖畔の攻防',objectives:[{x:12,y:2,name:'湖岸監視塔',short:'北'},{x:8,y:4,name:'中央橋頭堡',short:'中'},{x:5,y:8,name:'西部補給所',short:'南'}]},
{name:'迂回包囲戦',objectives:[{x:6,y:5,name:'西側峠',short:'西'},{x:9,y:4,name:'中央監視所',short:'中'},{x:11,y:7,name:'東側街道',short:'東'}]}];
const PLANS=['強攻','拠点防衛','側面迂回'];
const FORMATIONS=[
[[1,2],[2,4],[1,5],[1,7],[0,9],[2,10],[0,1]],
[[1,1],[2,3],[1,6],[2,7],[0,10],[1,11],[0,4]],
[[2,2],[1,4],[2,5],[0,8],[1,10],[2,9],[0,1]]];
let OBJECTIVES=OPERATIONS[0].objectives,MOUNTAINS=new Set(),LAKES=new Set();
function mix(seed,salt){let x=(seed^Math.imul(salt,0x9e3779b1))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return x>>>0;}
function prepare(seed,operation){OBJECTIVES=OPERATIONS[operation].objectives;
 const vertical=[0,1,-1,0][operation],horizontal=[0,-1,1,0][operation];
 MOUNTAINS=new Set([...BASE_MOUNTAINS].map(p=>{let [x,y]=p.split(',').map(Number);return k(x,y+vertical);}));
 LAKES=new Set([...BASE_LAKES].map(p=>{let [x,y]=p.split(',').map(Number);return k(x+horizontal,y);}));
}
function weather(){if(!state||state.round<=3)return '晴れ';return ['霧','雨','晴れ'][(mix(state.seed,55)%2+Math.floor((state.round-4)/3))%3];}
function sightRange(u){return Math.max(1,TYPES[u.type].sight+(kind(u.x,u.y)==='hill'?1:0)-(weather()==='霧'?2:0));}
function moveRange(u){return Math.max(1,TYPES[u.type].move-(weather()==='雨'&&u.type==='scout'?1:0));}
const CAPTURE_TYPES=new Set(['tank','heavy']);
const TERRAIN={plain:{name:'平地',cost:1,cover:0,color:'#c9c6a8',glyph:''},forest:{name:'森',cost:2,cover:1,color:'#7e9d84',glyph:'♣'},hill:{name:'高地',cost:2,cover:1,color:'#a69f84',glyph:'▲'},mountain:{name:'山岳',cost:99,cover:2,color:'#797f80',glyph:'⛰'},water:{name:'湖',cost:99,cover:0,color:'#84abb4',glyph:'≋'},city:{name:'集落',cost:1,cover:1,color:'#bb9f87',glyph:'▦'},road:{name:'道路',cost:1,cover:0,color:'#d3c39c',glyph:'·'}};
const $=id=>document.getElementById(id),board=$('board'),detail=$('detail'),feed=$('feed'),guide=$('guide'),endBtn=$('endBtn'),skipBtn=$('skipBtn');
const k=(x,y)=>x+','+y,inside=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
let state=null,selected=null,reach=new Map(),session=0,toastTimer,visibleBlue=new Set(),visibleRed=new Set();
function kind(x,y){let p=k(x,y);if(OBJECTIVES.some(o=>o.x===x&&o.y===y))return 'city';if(MOUNTAINS.has(p))return 'mountain';if(LAKES.has(p))return 'water';if((x===0&&y===5)||(x===16&&y===6))return 'city';
 if((y===5||y===6)&&x>3&&x<14)return 'road';
 if((x===4&&y===2)||(x===12&&y===8)||(x===6&&y===6)||(x===11&&y===5)||(x===8&&y===10))return 'city';
 const v=mix(state?.seed??1,x*59+y*113+x*y*17)%29;
 return v<6?'forest':v<10?'hill':'plain';
}
const terrain=(x,y)=>TERRAIN[kind(x,y)];
function axial(c){return {q:c.x-Math.floor(c.y/2),r:c.y};}
function cube(c){const a=axial(c);return {x:a.q,z:a.r,y:-a.q-a.r};}
function fromCube(c){return {x:c.x+Math.floor(c.z/2),y:c.z};}
function distance(a,b){const A=cube(a),B=cube(b);return Math.max(Math.abs(A.x-B.x),Math.abs(A.y-B.y),Math.abs(A.z-B.z));}
function roundedCube(p){let rx=Math.round(p.x),ry=Math.round(p.y),rz=Math.round(p.z),dx=Math.abs(rx-p.x),dy=Math.abs(ry-p.y),dz=Math.abs(rz-p.z);
 if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;return {x:rx,y:ry,z:rz};
}
function lineOfSight(a,b){let A=cube(a),B=cube(b),n=distance(a,b);if(n<=1)return true;
 for(let i=1;i<n;i++){let t=i/n,c=fromCube(roundedCube({x:A.x+(B.x-A.x)*t+1e-7,y:A.y+(B.y-A.y)*t+2e-7,z:A.z+(B.z-A.z)*t-3e-7}));
 if(!inside(c.x,c.y))return false;let g=kind(c.x,c.y);if(g==='mountain'||(g==='hill'&&kind(a.x,a.y)!=='hill'&&kind(b.x,b.y)!=='hill'))return false;
 }return true;
}
function visible(side){const result=new Set(),units=alive(side);
 for(const u of units){let sight=sightRange(u);
 for(let y=Math.max(0,u.y-sight);y<=Math.min(H-1,u.y+sight);y++)for(let x=Math.max(0,u.x-sight);x<=Math.min(W-1,u.x+sight);x++){
  if(distance(u,{x,y})<=sight&&lineOfSight(u,{x,y}))result.add(k(x,y));
 }}return result;
}
function refresh(){visibleBlue=visible('blue');visibleRed=visible('red');if(state.phase==='blue'){for(const p of visibleBlue)state.explored[p]=1;}}
function unit(id,side,type,x,y){return {id,side,type,x,y,hp:TYPES[type].hp,moved:false,fired:false};}
function initial(previousOperation=null){
 const seed=Number.isInteger(window.__SF_SEED__)?window.__SF_SEED__:Math.floor(Math.random()*2147483647);
 let operation=mix(seed,11)%OPERATIONS.length;
 if(previousOperation!==null&&operation===previousOperation)operation=(operation+1+mix(seed,29)%(OPERATIONS.length-1))%OPERATIONS.length;
 const plan=mix(seed,23)%PLANS.length;
 prepare(seed,operation);
 const a=FORMATIONS[mix(seed,37)%FORMATIONS.length],b=FORMATIONS[mix(seed,47)%FORMATIONS.length];
 const types=['scout','tank','heavy','tank','arty','scout','tank'];
 const units=[...a.map((c,i)=>unit(i+1,'blue',types[i],c[0],c[1])),...b.map((c,i)=>unit(i+8,'red',types[i],W-1-c[0],H-1-c[1]))];
 return {seed,operation,plan,round:1,phase:'blue',winner:null,reason:'',units,
 explored:{},contacts:[],controlStreak:{blue:0,red:0},
 logs:['作戦「'+OPERATIONS[operation].name+'」開始。敵の行動パターンは不明。'],moves:0};
}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}
function load(){try{const o=JSON.parse(localStorage.getItem(STORAGE));if(!o||!Number.isInteger(o.seed)||!Number.isInteger(o.operation)||!OPERATIONS[o.operation]||!Number.isInteger(o.plan)||!PLANS[o.plan]||!Array.isArray(o.units)||!o.explored||!o.controlStreak||!Number.isInteger(o.round)||o.round<1||o.round>MAX_ROUND||!['blue','red'].includes(o.phase))return null;
 if(!o.units.every(u=>inside(u.x,u.y)&&TYPES[u.type]&&['blue','red'].includes(u.side)&&Number.isFinite(u.hp)))return null;prepare(o.seed,o.operation);return o;}catch(e){return null;}}
function alive(side){return state.units.filter(u=>u.side===side&&u.hp>0);}
function at(x,y){return state.units.find(u=>u.hp>0&&u.x===x&&u.y===y);}
function opponent(side){return side==='blue'?'red':'blue';}
function objectiveHere(x,y){return OBJECTIVES.find(o=>o.x===x&&o.y===y);}
function objectiveOwner(o){const u=at(o.x,o.y);return u&&CAPTURE_TYPES.has(u.type)?u.side:null;}
function controlled(side){return OBJECTIVES.filter(o=>objectiveOwner(o)===side);}
function eligible(u){return CAPTURE_TYPES.has(u.type);}
function announceObjective(u){const o=objectiveHere(u.x,u.y);if(o&&eligible(u)){log((u.side==='blue'?'青軍':'赤軍')+' '+o.name+'を確保。2拠点を2ターン維持せよ');}}
function seizedBy(side){return 7-alive(opponent(side)).length;}
function log(s){state.logs.unshift(s);state.logs=state.logs.slice(0,12);}
function toast(s){const e=$('toast');e.textContent=s;e.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('visible'),2100);}
function neighbors(x,y){const delta=y%2?[[1,0],[-1,0],[0,1],[1,1],[0,-1],[1,-1]]:[[1,0],[-1,0],[-1,1],[0,1],[-1,-1],[0,-1]];
 return delta.map(d=>({x:x+d[0],y:y+d[1]})).filter(p=>inside(p.x,p.y));}
function reachable(u){const best=new Map([[k(u.x,u.y),0]]),queue=[{x:u.x,y:u.y,cost:0}];const sight=u.side==='blue'?visibleBlue:visibleRed;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.cost!==best.get(k(p.x,p.y)))continue;
 for(const n of neighbors(p.x,p.y)){const t=terrain(n.x,n.y),occupant=at(n.x,n.y);
 if(t.cost>9||(occupant&&(occupant.side===u.side||sight.has(k(n.x,n.y)))))continue;
 const c=p.cost+t.cost,key=k(n.x,n.y);if(c>moveRange(u)||c>=(best.get(key)??Infinity))continue;best.set(key,c);queue.push({...n,cost:c});
 }}best.delete(k(u.x,u.y));return best;
}
function canAttack(u,v,moved=u.moved){if(!u||!v||u.hp<=0||v.hp<=0||u.side===v.side||u.fired)return false;
 const d=distance(u,v),t=TYPES[u.type],intel=u.side==='blue'?visibleBlue:visibleRed;
 return d>=t.min&&d<=t.max&&!(u.type==='arty'&&moved)&&intel.has(k(v.x,v.y))&&(u.type==='arty'||lineOfSight(u,v));
}
function damage(u,v){return Math.max(1,TYPES[u.type].atk-TYPES[v.type].armor-terrain(v.x,v.y).cover);}
function select(id){selected=id;const u=state.units.find(v=>v.id===id&&v.hp>0);reach=u&&u.side==='blue'&&!u.moved&&!u.fired?reachable(u):new Map();render();}
function checkVictory(){let winner=null,reason='';
 if(!alive('blue').length){winner='red';reason='青軍が全滅した';}
 else if(!alive('red').length){winner='blue';reason='赤軍が全滅した';}
 else if(seizedBy('blue')>=5){winner='blue';reason='敵部隊を5つ撃破。戦力優勢で勝利！';}
 else if(seizedBy('red')>=5){winner='red';reason='味方部隊を5つ失った。戦力劣勢で敗北';}
 if(winner){finish(winner,reason);return true;}return false;
}
function finish(winner,reason){state.winner=winner;state.reason=reason;selected=null;reach=new Map();log(reason);save();outcome();}
function awardControl(side){
 const count=controlled(side).length;
 state.controlStreak[side]=count>=2?state.controlStreak[side]+1:0;
 if(count>=2){log((side==='blue'?'青軍':'赤軍')+'が'+count+'拠点を保持（'+state.controlStreak[side]+'/2ターン）');}
 if(state.controlStreak[side]>=2){finish(side,'3つのうち2拠点を2ターン連続で確保。戦域制圧！');return true;}
 return false;
}
function relocate(u,x,y){const blocker=at(x,y);if(blocker){if(blocker.side!==u.side){u.moved=true;u.fired=true;state.contacts.push(blocker.id);
 if(u.side==='blue')log('進路で敵と遭遇！ '+TYPES[blocker.type].name+'を発見');else log('前線で車両同士が接触');refresh();save();return false;}return false;}
 u.x=x;u.y=y;u.moved=true;state.moves++;refresh();announceObjective(u);
 if(u.side==='blue')log('青軍 '+TYPES[u.type].name+'が前進');
 else if(visibleBlue.has(k(x,y)))log('敵 '+TYPES[u.type].name+'を視認');
 save();return true;
}
function attack(u,v){const beforeSeen=visibleBlue.has(k(u.x,u.y)),n=damage(u,v);v.hp=Math.max(0,v.hp-n);u.fired=true;u.moved=true;state.moves++;
 if(v.side==='red'){log('青軍が'+TYPES[v.type].name+'に'+n+'ダメージ'+(v.hp===0?' / 撃破':'後退を阻止'));}
 else if(beforeSeen)log('敵 '+TYPES[u.type].name+'から'+n+'ダメージ'+(v.hp===0?' / 撃破':''));
 else log('見えない敵から砲撃！ '+n+'ダメージ'+(v.hp===0?' / 撃破':''));
 refresh();checkVictory();save();
}
function onCell(x,y){if(state.phase!=='blue'||state.winner)return;
 let v=at(x,y),u=state.units.find(z=>z.id===selected&&z.hp>0),known=visibleBlue.has(k(x,y))||state.contacts.includes(v?.id);
 if(v&&v.side==='blue'){select(v.id);return;}
 if(!u){toast('青軍の部隊を選んでください');return;}
 if(v&&v.side==='red'&&known){if(!canAttack(u,v)){toast(u.fired?'この部隊は攻撃済みです':'射程・視界・地形を確認してね');return;}attack(u,v);if(!state.winner)select(u.id);return;}
 if(reach.has(k(x,y))){relocate(u,x,y);if(!state.winner)select(u.id);return;}
 toast('水色は移動可能、赤い印は攻撃可能。まず偵察を！');
}
function coords(x,y){return {cx:42+Math.sqrt(3)*R*(x+(y%2)*.5),cy:41+1.5*R*y};}
function points(cx,cy){const p=[];for(let i=0;i<6;i++){let a=Math.PI/180*(60*i-90);p.push((cx+R*Math.cos(a)).toFixed(1)+','+(cy+R*Math.sin(a)).toFixed(1));}return p.join(' ');}
function node(tag,attrs,parent,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const name in attrs)e.setAttribute(name,String(attrs[name]));if(text!==undefined)e.textContent=text;parent.appendChild(e);return e;}
function svgMap(){
 let svg=node('svg',{viewBox:'0 0 1000 620',width:1000,height:620,role:'grid','aria-label':'17列12行の六角形マップ'},board);
 const selectedUnit=state.units.find(z=>z.id===selected&&z.hp>0);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let pos=k(x,y),seen=visibleBlue.has(pos),known=seen||state.explored[pos],g=terrain(x,y),unit=at(x,y),isOur=unit?.side==='blue',shownUnit=unit&&(isOur||(seen||state.contacts.includes(unit.id)));
  let focus=selectedUnit&&selectedUnit.x===x&&selectedUnit.y===y,canMove=selectedUnit&&reach.has(pos),canFire=selectedUnit&&shownUnit&&unit.side==='red'&&canAttack(selectedUnit,unit);
  let hq=x===FORTS.blue.x&&y===FORTS.blue.y?'blue':x===FORTS.red.x&&y===FORTS.red.y?'red':null;
  const c=coords(x,y),group=node('g',{class:'hex-group','data-k':pos,role:'gridcell',tabindex:'0','aria-label':(known?g.name:'未探索')+(shownUnit?' '+(unit.side==='blue'?'味方':'敵')+TYPES[unit.type].name:'')},svg);
  let fill=!known?'#35464a':!seen?'#68766e':g.color;
  node('polygon',{points:points(c.cx,c.cy),fill:fill,stroke:focus?'#ffe17d':canFire?'#e94e41':canMove?'#49d9ff':'#c9c9b36c','stroke-width':focus?4:canFire||canMove?3:1.5},group);
  if(known){if(g.glyph)node('text',{x:c.cx,y:c.cy+7,'text-anchor':'middle','font-size':24,'font-weight':800,fill:seen?'#334940':'#c1ccc0',opacity:seen?.48:.37,'pointer-events':'none'},group,g.glyph);}
  else node('text',{x:c.cx,y:c.cy+6,'text-anchor':'middle','font-size':16,fill:'#839290','pointer-events':'none'},group,'?');
  if(hq){node('rect',{x:c.cx-20,y:c.cy-25,width:40,height:12,rx:3,fill:hq==='blue'?'#24779c':'#a24c3d',opacity:.95,'pointer-events':'none'},group);node('text',{x:c.cx,y:c.cy-16,'text-anchor':'middle',fill:'white','font-size':9,'font-weight':800,'pointer-events':'none'},group,hq==='blue'?'青HQ':'赤HQ');}
  const objective=objectiveHere(x,y);
  if(objective){
   const owner=objectiveOwner(objective);
   const visibleOwner=owner==='red'&&!seen?null:owner;
   node('circle',{cx:c.cx,cy:c.cy,r:24,fill:'none',stroke:visibleOwner==='blue'?'#46c7e9':visibleOwner==='red'?'#ff9475':'#f0ca66','stroke-width':3.5,'stroke-dasharray':visibleOwner?'none':'4 3','pointer-events':'none'},group);
   node('rect',{x:c.cx-18,y:c.cy-24,width:36,height:15,rx:4,fill:visibleOwner==='blue'?'#227999':visibleOwner==='red'?'#a64b38':'#9b7736',stroke:'#faf2d5','stroke-width':.5,'pointer-events':'none'},group);
   node('text',{x:c.cx,y:c.cy-13,'text-anchor':'middle',fill:'#fff','font-size':11,'font-weight':900,'pointer-events':'none'},group,objective.short+'拠点');
  }
  if(canMove&&!shownUnit)node('circle',{cx:c.cx,cy:c.cy,r:6,fill:'#6cdeff',stroke:'#fcffff','stroke-width':2,'pointer-events':'none'},group);
  if(shownUnit){const color=unit.side==='blue'?'#146b94':'#ab4939',type=TYPES[unit.type];node('rect',{x:c.cx-22,y:c.cy-13,width:44,height:28,rx:7,fill:color,stroke:'#faf9ed','stroke-width':1.5,opacity:unit.fired&&unit.moved?.67:1,'pointer-events':'none'},group);
  node('text',{x:c.cx,y:c.cy+3,'text-anchor':'middle',fill:'#fff','font-size':14,'font-weight':900,'pointer-events':'none'},group,type.code+' '+unit.hp);
  if(canFire)node('circle',{cx:c.cx,cy:c.cy,r:24,fill:'none',stroke:'#fb654d','stroke-width':3,'stroke-dasharray':'4 3','pointer-events':'none'},group);
  }
  group.addEventListener('click',()=>onCell(x,y));group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onCell(x,y);}});
 }
}
function render(){if(!state)return;refresh();
 $('roundNumber').textContent=state.round;$('blueCount').textContent=alive('blue').length;$('redCount').textContent=state.winner?alive('red').length:'?';
 let cpu=state.phase==='red',ours=controlled('blue').length,streak=state.controlStreak.blue,kills=seizedBy('blue');
 $('phaseTitle').textContent=state.winner?'戦闘終了':cpu?'赤軍ターン / CPU行動中':'青軍ターン / YOUR MOVE';
 $('phaseSub').textContent=state.winner?state.reason:'作戦 '+OPERATIONS[state.operation].name+'｜天候 '+weather()+'｜確保 '+ours+'/3｜維持 '+streak+'/2｜撃破 '+kills+'/5';
 board.replaceChildren();svgMap();
 let u=state.units.find(t=>t.id===selected&&t.hp>0);
 if(!u)detail.innerHTML='<div class="panel-kicker">UNIT DATA / 部隊情報</div><div class="empty-detail"><h3>索敵して戦域を制圧。</h3><p>偵察車で敵を見つけ、中戦車・重戦車で拠点を確保。3つのうち2拠点を2ターン維持、または敵5部隊撃破で勝利。</p></div>';
 else{const d=TYPES[u.type];detail.innerHTML='<div class="panel-kicker">UNIT DATA / 部隊情報</div><div class="unit-detail-head"><div class="unit-detail-icon">'+d.code+'</div><div class="detail-title"><h3>'+d.name+'</h3><small>青軍 / '+d.code+'-'+u.id+'</small></div></div><div class="stats"><div class="stat"><b>'+moveRange(u)+'</b><small>移動</small></div><div class="stat"><b>'+sightRange(u)+'</b><small>索敵</small></div><div class="stat"><b>'+d.min+'–'+d.max+'</b><small>射程</small></div></div><div class="healthline">HP '+u.hp+' / '+d.hp+'<span class="bar"><i style="width:'+(u.hp/d.hp*100)+'%"></i></span></div><div class="info-line">'+(u.fired?'✓ 行動済み':u.moved?'移動済み。射撃できる敵がいれば攻撃可能':u.type==='arty'?'移動後は射撃不可。味方の索敵情報を利用できる':'水色の地点へ移動。敵が見えたら攻撃')+'</div>';}
 endBtn.disabled=!!state.winner||cpu;skipBtn.disabled=!!state.winner||cpu||!u||u.fired;const quick=$('quickEnd');quick.disabled=endBtn.disabled;quick.textContent=cpu?'CPU作戦中…':'ターン終了 →';
 guide.textContent=state.winner?'作戦終了':cpu?'⏳ 敵軍の行動中…':!u?'① 青軍を選択し索敵':'② 水色へ移動 / 見える敵を攻撃';
 feed.replaceChildren(...state.logs.map(x=>{let li=document.createElement('li');li.textContent=x;return li;}));save();
}
function modal(title,kicker,html,button='戦場へ戻る',restart=false){$('modalTitle').textContent=title;$('modalKicker').textContent=kicker;$('modalBody').innerHTML=html;$('closeModal').textContent=button;$('closeModal').onclick=()=>{if(restart)newGame();else $('modal').hidden=true;};$('modal').hidden=false;}
function rules(){modal('遊び方','HEX FIELD MANUAL','<p>17×12ヘックス。対戦ごとに地形・拠点・両軍の配置と敵の作戦が変わる戦術ゲームです。</p><ul class="rule-list"><li><b>勝利① 拠点制圧：</b>黄色の丸で囲んだ北・中・南の3拠点のうち、<b>2つを中戦車または重戦車で2回連続の自軍ターン終了時に保持</b>すれば勝利。</li><li><b>勝利② 戦力撃破：</b>敵7部隊のうち<b>5部隊を撃破</b>すれば勝利。全滅でも勝利です。</li><li><b>時間切れ：</b>18ラウンドで残HP＋撃破数×6＋保有拠点×14を比較して勝敗判定。</li><li><b>偵察車：</b>速く、視界は5。敵発見・側面索敵が役目。<b>拠点の占領はできません。</b></li><li><b>中戦車・重戦車：</b>索敵された敵と戦い、拠点を占領・防衛。高地・森は防御+1。</li><li><b>自走砲：</b>射程2〜4。味方が見つけた敵を間接砲撃。移動後は撃てません。</li><li><b>地形・天候：</b>山岳は進入不可で視線を遮断。高地は視界+1。霧では視界-2、雨では偵察車の移動力-1。天候は3ラウンドごとに変化します。</li><li><b>旧来の本部：</b>両端のHQは初期配置地点。入っても勝利しません。</li></ul><p>コツ：偵察車で敵の接近方向を見極め、主力戦車を複数の拠点へ分散。自走砲は後方から援護すると有利です。</p>');}
function score(side){return alive(side).reduce((s,u)=>s+u.hp,0)+seizedBy(side)*6+controlled(side).length*14;}

function outcome(){render();const b=score('blue'),r=score('red'),winner=state.winner;
 modal('作戦終了','BATTLE RESULT','<div class="outcome '+(winner==='blue'?'win':winner==='red'?'lose':'draw')+'">'+(winner==='blue'?'勝利！':winner==='red'?'敗北':'引き分け')+'</div><p>'+state.reason+'</p><div class="scorecard"><div>青軍<br><strong>'+b+'</strong></div><span>—</span><div>赤軍<br><strong>'+r+'</strong></div></div><p>第'+state.round+' / '+MAX_ROUND+'ラウンドで終了</p>','もう一戦',true);}
function newGame(){const previous=state?.operation??null;session++;state=initial(previous);selected=null;reach=new Map();$('modal').hidden=true;refresh();render();}
function endTurn(){if(state.phase!=='blue'||state.winner)return;if(awardControl('blue'))return;selected=null;reach=new Map();state.contacts=[];state.phase='red';alive('red').forEach(u=>{u.moved=false;u.fired=false;});render();runCPU(++session);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function routesTo(goal){
 const best=new Map([[k(goal.x,goal.y),0]]),q=[{...goal,cost:0}];
 while(q.length){q.sort((a,b)=>a.cost-b.cost);let p=q.shift(),key=k(p.x,p.y);if(p.cost!==best.get(key))continue;
 for(const n of neighbors(p.x,p.y)){const t=terrain(n.x,n.y);if(t.cost>9)continue;
 let alt=p.cost+terrain(p.x,p.y).cost,nk=k(n.x,n.y);
 if(alt<(best.get(nk)??Infinity)){best.set(nk,alt);q.push({...n,cost:alt});}}}
 return best;
}
function aimAI(u){
 const opts=[{x:u.x,y:u.y,cost:0}];
 if(!u.moved&&!u.fired)for(const [key,cost]of reachable(u)){let a=key.split(',').map(Number);opts.push({x:a[0],y:a[1],cost});}
 const main=eligible(u),targets=alive('blue').filter(t=>visibleRed.has(k(t.x,t.y)));
 const goalRoutes=OBJECTIVES.map(o=>({o,costs:routesTo(o),owner:objectiveOwner(o)}));
 let best=null,bestValue=-Infinity;
 for(const p of opts){
  let moved=p.x!==u.x||p.y!==u.y,target=null,attackScore=0,dummy={...u,x:p.x,y:p.y};
  for(const t of targets){if(!canAttack(dummy,t,moved))continue;
   const val=24+damage(u,t)*7+(damage(u,t)>=t.hp?27:0)+(objectiveHere(t.x,t.y)?22:0);
   if(val>attackScore){attackScore=val;target=t;}}
  const nearGoals=goalRoutes.map(z=>({...z,cost:z.costs.get(k(p.x,p.y))??999})).sort((a,b)=>{
   const aa=a.cost+(a.owner==='red'&&!(p.x===a.o.x&&p.y===a.o.y)?21:0),bb=b.cost+(b.owner==='red'&&!(p.x===b.o.x&&p.y===b.o.y)?21:0);return aa-bb;});
  const closest=nearGoals.find(z=>z.owner!=='red')||nearGoals[0],o=objectiveHere(p.x,p.y),stay=!moved;
  let v=attackScore+terrain(p.x,p.y).cover*2;
  if(main){
   v-=(closest.cost??999)*3.2;
   if(o){v+=o===closest.o?55:38;if(stay&&objectiveOwner(o)==='red')v+=45;}
   if(stay&&o&&objectiveOwner(o)==='red')v+=36;
  }else if(u.type==='scout'){
   // Reconnaissance: approach contested area, favor cover/high ground; avoid blocking capture tiles.
   const near=Math.min(...goalRoutes.map(z=>z.costs.get(k(p.x,p.y))??999));
   v-=Math.abs(near-2)*2.4;
   v-=Math.abs(p.x-7.5)*1.0;
   if(kind(p.x,p.y)==='hill')v+=10;
   if(o)v-=20;
   if(p.x===u.x&&p.y===u.y&&near>3)v-=4;
  }else{
   const near=Math.min(...goalRoutes.map(z=>z.costs.get(k(p.x,p.y))??999));
   v-=Math.abs(near-3)*2.7;
   if(near<=1)v-=12;
   if(o)v-=15;
   if(moved)v-=4;
  }
  if(state.plan===0){v+=attackScore*.45;if(main&&target)v+=8;}
  else if(state.plan===1){if(main&&o&&objectiveOwner(o)==='red')v+=18;if(main&&o&&objectiveOwner(o)==='blue')v+=15;}
  else {const preferred=OBJECTIVES[(u.id+state.seed)%OBJECTIVES.length];
    if(main&&objectiveOwner(preferred)!=='red')v-=distance(p,preferred)*2;
    if(u.type==='scout')v-=Math.abs(p.y-(u.id%2===0?1:H-2))*1.4;}
  v+=(mix(state.seed,u.id*47+state.round*391+p.x*19+p.y*27)%101)/60;
  if(v>bestValue){bestValue=v;best={...p,target};}
 }
 return best;
}

function soundHint(){let seen=visibleBlue,near=[];
 for(const e of alive('red')){if(seen.has(k(e.x,e.y)))continue;for(const u of alive('blue')){let d=distance(u,e);if(d<=5)near.push({e,u,d});}}
 if(!near.length)return;near.sort((a,b)=>a.d-b.d);let a=near[0],dx=a.e.x-a.u.x,dy=a.e.y-a.u.y;
 let dir=Math.abs(dx)>Math.abs(dy)*1.7?(dx>0?'東':'西'):Math.abs(dy)>Math.abs(dx)*1.7?(dy>0?'南':'北'):(dy<0?'北':'南')+(dx>0?'東':'西');
 log(dir+'方向でエンジン音…敵の位置は不明');}
async function runCPU(n){let ids=alive('red').sort((a,b)=>(a.type==='arty'?1:0)-(b.type==='arty'?1:0)).map(u=>u.id);
 for(const id of ids){if(n!==session||state.winner)return;let u=state.units.find(z=>z.id===id);if(!u||u.hp<=0)continue;
 refresh();let p=aimAI(u);await sleep(135);if(n!==session||state.winner)return;
 if(p.x!==u.x||p.y!==u.y){relocate(u,p.x,p.y);refresh();render();}
 if(checkVictory())return;
 if(p.target?.hp>0&&canAttack(u,p.target)){attack(u,p.target);if(state.winner)return;}
 u.moved=true;u.fired=true;render();}
 if(n!==session||state.winner)return;
 soundHint();if(awardControl('red'))return;if(state.round>=MAX_ROUND){let b=score('blue'),r=score('red');finish(b===r?'draw':b>r?'blue':'red',MAX_ROUND+'ラウンド終了。残存戦力で判定');return;}
 state.round++;state.phase='blue';state.contacts=[];alive('blue').forEach(u=>{u.moved=false;u.fired=false;});refresh();log('第'+state.round+'ラウンド開始。天候 '+weather()+'。索敵情報を更新');render();}
$('rulesBtn').onclick=rules;
$('restartBtn').onclick=()=>{if(window.confirm('新しい対戦を始めますか？'))newGame();};
endBtn.onclick=endTurn;$('quickEnd').onclick=endTurn;
skipBtn.onclick=()=>{let u=state.units.find(v=>v.id===selected);if(!u)return;u.moved=true;u.fired=true;select(u.id);};
$('closeModal').onclick=()=>{$('modal').hidden=true;};
window.__SF_TEST__={distance,lineOfSight,visible,kind,terrain,neighbors,awardControl,controlled,objectiveOwner,aimAI,score,weather,sightRange,moveRange,newGame,mix,prepare,getObjectives:()=>OBJECTIVES,getState:()=>state,canAttack};
state=load()||initial();refresh();render();if(state.winner)outcome();else if(state.phase==='red')runCPU(++session);
})();