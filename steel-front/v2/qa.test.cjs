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
const win={confirm:()=>true};
const store=new Map();
const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
const ctx={document,window:win,localStorage,setTimeout,clearTimeout,console};
const source=fs.readFileSync(__dirname+'/game.js','utf8');
new vm.Script(source,{filename:'game.js'});
vm.runInNewContext(source,ctx,{timeout:5000});
const api=win.__SF_TEST__,state=api.getState();
assert.equal(api.distance({x:0,y:0},{x:1,y:0}),1,'adjacent hex');
assert.equal(api.distance({x:0,y:0},{x:0,y:1}),1,'offset row adjacency');
assert.equal(api.kind(7,1),'mountain');
assert.equal(api.terrain(7,1).cost,99);
assert.equal(api.lineOfSight({x:6,y:1},{x:9,y:1}),false,'mountain should block sight');
assert.equal(api.neighbors(5,5).length,6,'six neighbor directions');
assert.equal(state.units.length,14,'14 units');
assert.ok(Object.keys(state.explored).length>0,'initial fog explored');
assert.equal(document.getElementById('redCount').textContent,'?','hidden enemies not counted');
assert.equal(document.getElementById('board').children[0].children.length,204,'204 hex cells');
assert.equal(state.winner,null,'no early victory');
const blue=state.units.find(u=>u.side==='blue');blue.x=16;blue.y=6;state.hold.blue=1;
assert.equal(state.winner,null,'occupation does not win immediately');
assert.equal(api.checkHold('blue'),true,'HQ held until next turn');
assert.equal(state.winner,'blue');
console.log('PASS hex-geometry LOS fog 204-cells HQ-hold win');
