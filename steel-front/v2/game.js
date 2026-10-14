(()=>{'use strict';
const W=17,H=12,R=31,MAX_ROUND=18,STORAGE='steel-front-v2';
const TYPES={scout:{name:'偵察車',code:'R',move:5,atk:2,armor:0,hp:4,min:1,max:1,sight:5},tank:{name:'中戦車',code:'T',move:3,atk:3,armor:1,hp:6,min:1,max:1,sight:3},heavy:{name:'重戦車',code:'H',move:2,atk:4,armor:2,hp:8,min:1,max:1,sight:2},arty:{name:'自走砲',code:'A',move:2,atk:4,armor:0,hp:4,min:2,max:4,sight:2}};
const MOUNTAINS=new Set(['7,1','8,1','8,2','9,2','7,3','6,4','7,4','9,5','10,5','9,6','7,7','8,7','8,8','6,9','7,9','10,9','11,9']);
const LAKES=new Set(['10,2','11,2','10,3','11,3','5,10','6,10','5,11']);
const FORTS={blue:{x:0,y:5},red:{x:16,y:6}};
const TERRAIN={plain:{name:'平地',cost:1,cover:0,color:'#c9c6a8',glyph:''},forest:{name:'森',cost:2,cover:1,color:'#7e9d84',glyph:'♣'},hill:{name:'高地',cost:2,cover:1,color:'#a69f84',glyph:'▲'},mountain:{name:'山岳',cost:99,cover:2,color:'#797f80',glyph:'⛰'},water:{name:'湖',cost:99,cover:0,color:'#84abb4',glyph:'≋'},city:{name:'集落',cost:1,cover:1,color:'#bb9f87',glyph:'▦'},road:{name:'道路',cost:1,cover:0,color:'#d3c39c',glyph:'·'}};
const $=id=>document.getElementById(id),board=$('board'),detail=$('detail'),feed=$('feed'),guide=$('guide'),endBtn=$('endBtn'),skipBtn=$('skipBtn');
const k=(x,y)=>x+','+y,inside=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
let state=null,selected=null,reach=new Map(),session=0,toastTimer,visibleBlue=new Set(),visibleRed=new Set();
function kind(x,y){let p=k(x,y);if(MOUNTAINS.has(p))return 'mountain';if(LAKES.has(p))return 'water';if((x===0&&y===5)||(x===16&&y===6))return 'city';
 if((y===5||y===6)&&x>3&&x<14)return 'road';
 if((x===4&&y===2)||(x===12&&y===8)||(x===6&&y===6)||(x===11&&y===5)||(x===8&&y===10))return 'city';
 const v=(x*73+y*41+x*y*19+((x*11+y*7)%13))%29;
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
 for(const u of units){let sight=TYPES[u.type].sight+(kind(u.x,u.y)==='hill'?1:0);
 for(let y=Math.max(0,u.y-sight);y<=Math.min(H-1,u.y+sight);y++)for(let x=Math.max(0,u.x-sight);x<=Math.min(W-1,u.x+sight);x++){
  if(distance(u,{x,y})<=sight&&lineOfSight(u,{x,y}))result.add(k(x,y));
 }}return result;
}
function refresh(){visibleBlue=visible('blue');visibleRed=visible('red');if(state.phase==='blue'){for(const p of visibleBlue)state.explored[p]=1;}}
function unit(id,side,type,x,y){return {id,side,type,x,y,hp:TYPES[type].hp,moved:false,fired:false};}
function initial(){return {round:1,phase:'blue',winner:null,reason:'',units:[
 unit(1,'blue','scout',1,2),unit(2,'blue','tank',2,4),unit(3,'blue','heavy',1,5),unit(4,'blue','tank',1,7),unit(5,'blue','arty',0,9),unit(6,'blue','scout',2,10),unit(7,'blue','tank',0,1),
 unit(8,'red','scout',15,2),unit(9,'red','tank',14,4),unit(10,'red','heavy',15,6),unit(11,'red','tank',14,8),unit(12,'red','arty',16,10),unit(13,'red','scout',15,11),unit(14,'red','tank',16,0)
 ],explored:{},contacts:[],hold:{blue:null,red:null},logs:['出撃！敵軍の位置は不明です。偵察車で視界を広げよう。'],moves:0};}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}}
function load(){try{const o=JSON.parse(localStorage.getItem(STORAGE));if(!o||!Array.isArray(o.units)||!o.explored||!o.hold||!Number.isInteger(o.round)||o.round<1||o.round>MAX_ROUND||!['blue','red'].includes(o.phase))return null;
 if(!o.units.every(u=>inside(u.x,u.y)&&TYPES[u.type]&&['blue','red'].includes(u.side)&&Number.isFinite(u.hp)))return null;return o;}catch(e){return null;}}
function alive(side){return state.units.filter(u=>u.side===side&&u.hp>0);}
function at(x,y){return state.units.find(u=>u.hp>0&&u.x===x&&u.y===y);}
function opponent(side){return side==='blue'?'red':'blue';}
function objective(side){return FORTS[opponent(side)];}
function onHQ(u){let h=objective(u.side);return u.x===h.x&&u.y===h.y;}
function log(s){state.logs.unshift(s);state.logs=state.logs.slice(0,12);}
function toast(s){const e=$('toast');e.textContent=s;e.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('visible'),2100);}
function neighbors(x,y){const delta=y%2?[[1,0],[-1,0],[0,1],[1,1],[0,-1],[1,-1]]:[[1,0],[-1,0],[-1,1],[0,1],[-1,-1],[0,-1]];
 return delta.map(d=>({x:x+d[0],y:y+d[1]})).filter(p=>inside(p.x,p.y));}
function reachable(u){const best=new Map([[k(u.x,u.y),0]]),queue=[{x:u.x,y:u.y,cost:0}];const sight=u.side==='blue'?visibleBlue:visibleRed;
 while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.cost!==best.get(k(p.x,p.y)))continue;
 for(const n of neighbors(p.x,p.y)){const t=terrain(n.x,n.y),occupant=at(n.x,n.y);
 if(t.cost>9||(occupant&&(occupant.side===u.side||sight.has(k(n.x,n.y)))))continue;
 const c=p.cost+t.cost,key=k(n.x,n.y);if(c>TYPES[u.type].move||c>=(best.get(key)??Infinity))continue;best.set(key,c);queue.push({...n,cost:c});
 }}best.delete(k(u.x,u.y));return best;
}
function canAttack(u,v,moved=u.moved){if(!u||!v||u.hp<=0||v.hp<=0||u.side===v.side||u.fired)return false;
 const d=distance(u,v),t=TYPES[u.type],intel=u.side==='blue'?visibleBlue:visibleRed;
 return d>=t.min&&d<=t.max&&!(u.type==='arty'&&moved)&&intel.has(k(v.x,v.y))&&(u.type==='arty'||lineOfSight(u,v));
}
function damage(u,v){return Math.max(1,TYPES[u.type].atk-TYPES[v.type].armor-terrain(v.x,v.y).cover);}
function select(id){selected=id;const u=state.units.find(v=>v.id===id&&v.hp>0);reach=u&&u.side==='blue'&&!u.moved&&!u.fired?reachable(u):new Map();render();}
function checkVictory(){let winner=null,reason='';
 if(!alive('blue').length){winner='red';reason='青軍の戦力が全滅した';}
 else if(!alive('red').length){winner='blue';reason='赤軍の戦力を全滅させた';}
 if(winner){finish(winner,reason);return true;}return false;
}
function finish(winner,reason){state.winner=winner;state.reason=reason;selected=null;reach=new Map();log(reason);save();outcome();}
function checkHold(side){if(state.hold[side]!==null&&alive(side).some(onHQ)){finish(side,side==='blue'?'敵本部を1ターン守り抜いた！':'自軍本部が1ターン保持された');return true;}return false;}
function updateHold(u){if(onHQ(u)&&state.hold[u.side]===null){state.hold[u.side]=state.round;log((u.side==='blue'?'青軍':'赤軍')+'が敵本部に突入！ 次の自軍ターンまで守れば勝利');}}
function relocate(u,x,y){const blocker=at(x,y);if(blocker){if(blocker.side!==u.side){u.moved=true;u.fired=true;state.contacts.push(blocker.id);
 if(u.side==='blue')log('進路で敵と遭遇！ '+TYPES[blocker.type].name+'を発見');else log('前線で車両同士が接触');refresh();save();return false;}return false;}
 u.x=x;u.y=y;u.moved=true;state.moves++;refresh();updateHold(u);
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
 let cpu=state.phase==='red',b=alive('blue').some(onHQ),r=alive('red').some(onHQ);
 $('phaseTitle').textContent=state.winner?'戦闘終了':cpu?'赤軍ターン / CPU行動中':'青軍ターン / YOUR MOVE';
 $('phaseSub').textContent=state.winner?state.reason:r?'⚠ 自軍本部に敵！次の赤軍ターンまでに排除':b?'★ 敵本部に突入！次の青軍ターンまで守れ':'索敵しながら前進｜最大18ラウンド';
 board.replaceChildren();svgMap();
 let u=state.units.find(t=>t.id===selected&&t.hp>0);
 if(!u)detail.innerHTML='<div class="panel-kicker">UNIT DATA / 部隊情報</div><div class="empty-detail"><h3>見えない敵を探せ。</h3><p>青軍の部隊をタップして移動。偵察車は視界が広く、山岳の向こうには死角ができます。</p></div>';
 else{const d=TYPES[u.type];detail.innerHTML='<div class="panel-kicker">UNIT DATA / 部隊情報</div><div class="unit-detail-head"><div class="unit-detail-icon">'+d.code+'</div><div class="detail-title"><h3>'+d.name+'</h3><small>青軍 / '+d.code+'-'+u.id+'</small></div></div><div class="stats"><div class="stat"><b>'+d.move+'</b><small>移動</small></div><div class="stat"><b>'+d.sight+(kind(u.x,u.y)==='hill'?'+1':'')+'</b><small>索敵</small></div><div class="stat"><b>'+d.min+'–'+d.max+'</b><small>射程</small></div></div><div class="healthline">HP '+u.hp+' / '+d.hp+'<span class="bar"><i style="width:'+(u.hp/d.hp*100)+'%"></i></span></div><div class="info-line">'+(u.fired?'✓ 行動済み':u.moved?'移動済み。射撃できる敵がいれば攻撃可能':u.type==='arty'?'移動後は射撃不可。味方の索敵情報を利用できる':'水色の地点へ移動。敵が見えたら攻撃')+'</div>';}
 endBtn.disabled=!!state.winner||cpu;skipBtn.disabled=!!state.winner||cpu||!u||u.fired;const quick=$('quickEnd');quick.disabled=endBtn.disabled;quick.textContent=cpu?'CPU作戦中…':'ターン終了 →';
 guide.textContent=state.winner?'作戦終了':cpu?'⏳ 敵軍の行動中…':!u?'① 青軍を選択し索敵':'② 水色へ移動 / 見える敵を攻撃';
 feed.replaceChildren(...state.logs.map(x=>{let li=document.createElement('li');li.textContent=x;return li;}));save();
}
function modal(title,kicker,html,button='戦場へ戻る',restart=false){$('modalTitle').textContent=title;$('modalKicker').textContent=kicker;$('modalBody').innerHTML=html;$('closeModal').textContent=button;$('closeModal').onclick=()=>{if(restart)newGame();else $('modal').hidden=true;};$('modal').hidden=false;}
function rules(){modal('遊び方','HEX FIELD MANUAL','<p>17×12のヘックスで戦う、索敵型の戦車ボードゲームです。青軍をタップして水色のヘックスへ移動、視認できた敵を攻撃します。</p><ul class="rule-list"><li><b>視界：</b>偵察車5・中戦車3・重戦車2・自走砲2ヘックス。高地では+1。</li><li><b>山：</b>山岳は通行不可・視線を遮ります。高地も地上からの視線を遮ることがあります。</li><li><b>霧：</b>暗いマスは未探索、くすんだ色は探索済みで現在は見えない場所。敵は視界に入るまで非表示です。</li><li><b>砲撃：</b>戦車は射程1、自走砲は射程2〜4。自走砲は移動後に攻撃不可ですが、味方が発見した敵を間接砲撃できます。</li><li><b>本部制圧：</b>敵HQへ入り、敵の反撃をしのいで<b>次の自軍ターン開始まで保持すると勝利</b>。入った瞬間には勝ちません。</li><li><b>その他：</b>敵全滅でも勝利。18ラウンド終了時は残HP＋HQ保持ボーナスで判定します。</li><li><b>地形：</b>森・高地の移動コスト2、防御+1。湖・山岳は通れません。</li></ul><p>コツ：偵察車で敵の方向を探り、山陰から回り込み、戦車と自走砲を組み合わせましょう。</p>');}
function score(side){return alive(side).reduce((s,u)=>s+u.hp,0)+(alive(side).some(onHQ)?12:0);}
function outcome(){render();const b=score('blue'),r=score('red'),winner=state.winner;
 modal('作戦終了','BATTLE RESULT','<div class="outcome '+(winner==='blue'?'win':winner==='red'?'lose':'draw')+'">'+(winner==='blue'?'勝利！':winner==='red'?'敗北':'引き分け')+'</div><p>'+state.reason+'</p><div class="scorecard"><div>青軍<br><strong>'+b+'</strong></div><span>—</span><div>赤軍<br><strong>'+r+'</strong></div></div><p>第'+state.round+' / '+MAX_ROUND+'ラウンドで終了</p>','もう一戦',true);}
function newGame(){session++;state=initial();selected=null;reach=new Map();$('modal').hidden=true;refresh();render();}
function endTurn(){if(state.phase!=='blue'||state.winner)return;selected=null;reach=new Map();state.contacts=[];state.phase='red';alive('red').forEach(u=>{u.moved=false;u.fired=false;});render();if(checkHold('red'))return;runCPU(++session);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function aimAI(u){
 const opts=[{x:u.x,y:u.y,cost:0}];if(!u.moved&&!u.fired)for(const [key,cost]of reachable(u)){let a=key.split(',').map(Number);opts.push({x:a[0],y:a[1],cost});}
 let best=null,bestValue=-1e6;const goal=objective('red');const targets=alive('blue').filter(v=>visibleRed.has(k(v.x,v.y)));
 for(const p of opts){let moved=p.x!==u.x||p.y!==u.y;let dummy={...u,x:p.x,y:p.y},target=null,bonus=0;
 for(const t of targets){if(!canAttack(dummy,t,moved))continue;let val=28+damage(u,t)*8+(damage(u,t)>=t.hp?24:0);if(val>bonus){bonus=val;target=t;}}
 let dst=distance(p,goal);let v=-dst*2+(TERRAIN[kind(p.x,p.y)].cover*.8)+bonus+(p.x===goal.x&&p.y===goal.y?110:0);
 if(u.type==='arty'){v-=moved?4:0;v+=Math.min(5,dst)*1.0;}
 if(u.type==='scout')v+=Math.abs(p.y-(u.id%2?2:9))<3?1.5:0;
 if(v>bestValue){bestValue=v;best={...p,target};}}
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
 soundHint();if(state.round>=MAX_ROUND){let b=score('blue'),r=score('red');finish(b===r?'draw':b>r?'blue':'red',MAX_ROUND+'ラウンド終了。残存戦力で判定');return;}
 state.round++;state.phase='blue';state.contacts=[];alive('blue').forEach(u=>{u.moved=false;u.fired=false;});refresh();if(checkHold('blue'))return;log('第'+state.round+'ラウンド開始。索敵情報を更新');render();}
$('rulesBtn').onclick=rules;
$('restartBtn').onclick=()=>{if(window.confirm('新しい対戦を始めますか？'))newGame();};
endBtn.onclick=endTurn;$('quickEnd').onclick=endTurn;
skipBtn.onclick=()=>{let u=state.units.find(v=>v.id===selected);if(!u)return;u.moved=true;u.fired=true;select(u.id);};
$('closeModal').onclick=()=>{$('modal').hidden=true;};
window.__SF_TEST__={distance,lineOfSight,visible,kind,terrain,neighbors,checkHold,getState:()=>state,canAttack};
state=load()||initial();refresh();render();if(state.winner)outcome();else if(state.phase==='red')runCPU(++session);
})();