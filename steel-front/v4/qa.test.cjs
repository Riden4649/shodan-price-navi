const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element {
 constructor(id=''){this.id=id;this.children=[];this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.disabled=false;this.hidden=true;this.classList={add(){},remove(){}};this.handlers={};}
 setAttribute(k,v){this[k]=v;}
 appendChild(v){this.children.push(v);return v;}
 replaceChildren(...v){this.children=v;}
 addEventListener(ev,fn){this.handlers[ev]=fn;}
}
const elements=new Map();
const document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},
 createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
const win={confirm:()=>true,__SF_SEED__:31};
const store=new Map();
const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
const ctx={document,window:win,localStorage,setTimeout,clearTimeout,console};
const source=fs.readFileSync(__dirname+'/game.js','utf8');
new vm.Script(source,{filename:'game.js'});
vm.runInNewContext(source,ctx,{timeout:5000});

const api=win.__SF_TEST__;
assert.equal(api.distance({x:0,y:0},{x:1,y:0}),1,'adjacent hex');
assert.equal(api.distance({x:0,y:0},{x:0,y:1}),1,'offset row adjacency');
assert.equal(api.neighbors(5,5).length,6,'six neighbor directions');
assert.equal(document.getElementById('board').children[0].children.length,204,'204 hex cells');
const variants=new Set(),plans=new Set(),formations=new Set(),terrainSignatures=new Set();
for(let seed=1;seed<=40;seed++){
 win.__SF_SEED__=seed;api.newGame();const game=api.getState(),objectives=api.getObjectives();
 assert.equal(game.seed,seed);
 assert.equal(game.units.length,14);
 assert.equal(objectives.length,3);
 assert.equal(new Set(game.units.map(u=>u.x+','+u.y)).size,14,'unique deployment');
 for(const u of game.units)assert.ok(api.terrain(u.x,u.y).cost<90,'spawn must be passable');
 for(const o of objectives)assert.ok(api.terrain(o.x,o.y).cost<90,'objective must be passable');
 assert.equal(game.winner,null);
 variants.add(game.operation);plans.add(game.plan);
 formations.add(game.units.map(u=>u.x+','+u.y).join('|'));
 terrainSignatures.add(Array.from({length:12},(_,y)=>Array.from({length:17},(_,x)=>api.kind(x,y).charAt(0)).join('')).join('|'));
 for(const enemy of game.units.filter(u=>u.side==='red')){
  const next=api.aimAI(enemy);
  assert.ok(next&&Number.isInteger(next.x)&&Number.isInteger(next.y),'AI valid move');
  assert.ok(next.x>=0&&next.x<17&&next.y>=0&&next.y<12,'AI bounded');
 }
 game.round=4;const now=api.weather();
 assert.ok(['晴れ','霧','雨'].includes(now));
 const scout=game.units.find(u=>u.type==='scout');
 assert.ok(api.sightRange(scout)>=1&&api.moveRange(scout)>=1);
}
assert.equal(variants.size,4,'all four theaters represented');
assert.equal(plans.size,3,'all AI plans represented');
assert.ok(formations.size>4,'random deployment variety');
assert.ok(terrainSignatures.size>=4,'map layouts must differ');
win.__SF_SEED__=99;api.newGame();const game=api.getState(),objs=api.getObjectives();
const scout=game.units[0],tank=game.units[1],heavy=game.units[2];
scout.x=objs[0].x;scout.y=objs[0].y;
assert.equal(api.objectiveOwner(objs[0]),null,'scout cannot capture');
scout.x=0;scout.y=0;
tank.x=objs[0].x;tank.y=objs[0].y;
heavy.x=objs[1].x;heavy.y=objs[1].y;
assert.equal(api.controlled('blue').length,2);
assert.equal(api.awardControl('blue'),false,'first hold no win');
assert.equal(game.winner,null);
tank.x=0;tank.y=2;
assert.equal(api.awardControl('blue'),false,'lost control resets');
tank.x=objs[0].x;tank.y=objs[0].y;
assert.equal(api.awardControl('blue'),false,'first renewed hold');
assert.equal(api.awardControl('blue'),true,'second consecutive hold wins');
assert.equal(game.winner,'blue');
assert.ok(!source.includes('checkHold('),'HQ cannot win');
console.log('PASS V4 terrain/random formations AI plans 40 seeds fog tactical victory');
