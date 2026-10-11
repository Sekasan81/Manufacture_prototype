import {connections,rotate} from './connections.mjs';
import {SPECIES,RESOURCES,SHOP,definition} from './data.mjs?v=3';
import {cycleOutput} from './effects.mjs?v=3';
export const STEP=.1, LIMIT=9999, CAPACITY=120;
export function random(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
const sides=s=>Array.from({length:4},()=>Math.floor(random(s)*4));
export function addUnit(s,species){if(!SPECIES[species])throw new Error('Неизвестный вид');const u={id:String(s.nextId++),species,cell:null,sides:sides(s),rotation:0,progress:0,running:false,boosted:false,buffer:0,queue:0,completed:0};s.units.push(u);return u;}
export function createState(seed=Date.now()){
 const s={version:2,rng:(Number(seed)>>>0)||1,nextId:1,units:[],stock:Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0])),elapsed:0,remainder:0,paused:false,log:[],savedAt:Date.now()};
 const p=addUnit(s,'copper'),c=addUnit(s,'crafter');while(!p.sides.some(r=>c.sides.includes(r))){p.sides=sides(s);c.sides=sides(s);}return s;
}
export const power=s=>({used:s.units.filter(u=>u.cell!==null).length*10,capacity:CAPACITY,remaining:CAPACITY-s.units.filter(u=>u.cell!==null).length*10});
export function topology(s){
 const links=connections(s.units), map=new Map(s.units.map(u=>[u.id,u])), graph=new Map();
 const neighbors=u=>links.get(u.id).map(e=>({...e,unit:map.get(e.id)}));
 for(const u of s.units){
  const d=definition(u),ns=neighbors(u),routes=[],receivers=[];
  if(d.role==='producer')for(const n of ns){
   const nd=definition(n.unit);
   if(nd.role==='crafter'){routes.push([u.id,n.id]);receivers.push(n);}
   else if(nd.role==='assembler'&&nd.input===d.output){
    const cs=neighbors(n.unit).filter(c=>definition(c.unit).role==='crafter');
    if(cs.length){receivers.push(n);for(const c of cs)routes.push([u.id,n.id,c.id]);}
   }
  }
  if(d.role==='assembler'){
   const ps=ns.filter(n=>definition(n.unit).role==='producer'&&definition(n.unit).output===d.input);
   const cs=ns.filter(n=>definition(n.unit).role==='crafter');
   for(const p of ps)for(const c of cs)routes.push([p.id,u.id,c.id]);
   if(ps.length)receivers.push(...cs);
  }
  graph.set(u.id,{routes,receivers,neighbors:ns,edges:links.get(u.id),boost:ns.some(n=>definition(n.unit).role==='booster')});
 }return graph;
}
function cancel(u){u.running=false;u.progress=0;u.boosted=false;u.queue=0;}
function start(s,u,g){const d=definition(u);if(s.paused||power(s).remaining<0||!d.cycle||u.running||!g.routes.length)return false;if(d.role==='assembler'){if(u.buffer<d.amount)return false;u.buffer-=d.amount;}u.running=true;u.progress=0;u.boosted=g.boost;return true;}
export function reconcile(s,before=topology(s),moved=[]){
 const after=topology(s),badPower=power(s).remaining<0;
 for(const u of s.units){const old=before.get(u.id),g=after.get(u.id),d=definition(u);
  const untouched=old?.routes.some(route=>!route.some(id=>moved.includes(id))&&g.routes.some(r=>r.join('/')===route.join('/')));
  if(u.running&&(!untouched||badPower||(u.boosted&&!g.boost)))cancel(u);
  if(!g.routes.length&&d.role==='assembler')u.buffer=0;
  if(!old||old.receivers.map(n=>n.id).join(',')!==g.receivers.map(n=>n.id).join(','))u.queue=0;
  if(badPower)cancel(u);
 }
 for(const u of s.units)start(s,u,after.get(u.id));
 return after;
}
export function mutate(s,fn,moved=[]){const old=topology(s);fn();reconcile(s,old,moved);}
export function place(s,id,cell){
 const u=s.units.find(u=>u.id===id);if(!u||!Number.isInteger(cell)||cell<0||cell>=36)return false;if(u.cell===cell)return true;
 const other=s.units.find(o=>o.cell===cell),old=u.cell;
 mutate(s,()=>{u.cell=cell;if(other)other.cell=old;},[u.id,...(other?[other.id]:[])]);return true;
}
export function remove(s,id){const u=s.units.find(u=>u.id===id);if(!u||u.cell===null)return false;mutate(s,()=>u.cell=null,[id]);return true;}
export function turn(s,id){const u=s.units.find(u=>u.id===id);if(!u||u.cell===null)return false;mutate(s,()=>{u.sides=rotate(u.sides);u.rotation=(u.rotation+1)%4;});return true;}
export function rerollCost(s,u){return u.species==='copper'&&s.stock.copper<5?0:5;}
export function reroll(s,id){const u=s.units.find(u=>u.id===id);if(!u||u.cell===null)return false;const cost=rerollCost(s,u);if(s.stock.copper<cost)return false;mutate(s,()=>{s.stock.copper-=cost;u.sides=sides(s);});return true;}
export function shortages(s,item){return Object.entries(item.cost).filter(([r,n])=>s.stock[r]<n).map(([resource,n])=>({resource,amount:n-s.stock[resource]}));}
export function buy(s,species){const item=SHOP.find(i=>i.species===species);if(!item||shortages(s,item).length)return null;for(const [r,n] of Object.entries(item.cost))s.stock[r]-=n;return addUnit(s,species);}
function deposit(s,u,resource,amount,receiver){const accepted=Math.min(amount,LIMIT-s.stock[resource]);s.stock[resource]+=accepted;s.log.unshift({time:s.elapsed,id:u.id,resource,amount:accepted,lost:amount-accepted,receiver});s.log.length=Math.min(12,s.log.length);}
export function advance(s,seconds){
 if(!Number.isFinite(seconds)||seconds<=0||s.paused)return;
 const g=reconcile(s);s.remainder+=seconds;const ticks=Math.floor((s.remainder+1e-8)/STEP);s.remainder=Math.max(0,s.remainder-ticks*STEP);
 const ordered=s.units.filter(u=>u.cell!==null).sort((a,b)=>a.cell-b.cell),canRun=power(s).remaining>=0;
 for(let t=0;t<ticks;t++){
  s.elapsed+=STEP;if(!canRun)continue;
  const deliveries=new Map();
  // Complete and deliver in row-major order. A free assembler can reserve one cycle
  // plus one next-cycle buffer; the reservation is consumed in phase two.
  for(const u of ordered){
   if(!u.running)continue;const d=definition(u);u.progress+=STEP;if(u.progress+1e-8<d.cycle)continue;
   u.running=false;u.progress=0;u.completed++;
   const targets=g.get(u.id).receivers,target=targets[u.queue%targets.length];u.queue=(u.queue+1)%targets.length;
   const amount=cycleOutput(d,u.boosted);u.boosted=false;
   if(d.role==='producer'&&definition(target.unit).role==='assembler'){
    const a=target.unit,need=definition(a).amount;
    const current=deliveries.get(a.id)??a.buffer;
    deliveries.set(a.id,Math.min(a.running?need:need*2,current+amount));
   }else deposit(s,u,d.output,amount,target.id);
  }
  for(const u of ordered){if(deliveries.has(u.id))u.buffer=deliveries.get(u.id);start(s,u,g.get(u.id));if(definition(u).role==='assembler')u.buffer=Math.min(definition(u).amount,u.buffer);}
 }
}
export function evaluate(s){const graph=topology(s),energy=power(s),result=new Map();for(const u of s.units){const d=definition(u),g=graph.get(u.id);let kind='active',reason='Производство';
 if(u.cell===null){kind='reserve';reason='В каталоге';}
 else if(energy.remaining<0){kind='power';reason='Перегрузка — циклы сброшены';}
 else if(s.paused){kind='paused';reason='Пауза';}
 else if(d.cycle&&!g.routes.length){kind='disconnected';reason=d.role==='producer'?'Нет полного маршрута A или B':'Нужны подходящий производитель и крафтер';}
 else if(d.role==='assembler'&&!u.running){kind='waiting';reason=`Ждёт сырьё: ${u.buffer} / ${d.amount}`;}
 else if(d.role==='crafter'){const count=g.neighbors.filter(n=>graph.get(n.id).routes.some(r=>r.includes(u.id))).length;reason=`Активирует ${count} / 4 соседей`;kind=count?'active':'disconnected';}
 else if(d.role==='booster'){const count=g.neighbors.filter(n=>definition(n.unit).cycle).length;reason=count?`Усиливает машин: ${count}`:'Нет производящих соседей';kind=count?'active':'disconnected';}
 result.set(u.id,{...g,kind,reason,stats:d,active:kind==='active'});
 }return result;}
export function serialize(s,now=Date.now()){return JSON.stringify({...s,savedAt:now});}
export function restore(text){
 const x=JSON.parse(text);if(x.version!==2||!Array.isArray(x.units)||x.units.length>10000)throw new Error('Сохранение другой версии');
 const s={version:2,rng:(x.rng>>>0)||1,nextId:1,units:[],stock:{},elapsed:Number.isFinite(x.elapsed)?Math.max(0,x.elapsed):0,remainder:0,paused:x.paused===true,log:[],savedAt:Number.isFinite(x.savedAt)?x.savedAt:Date.now()};
 const ids=new Set(),cells=new Set();
 for(const a of x.units){
 if(!SPECIES[a.species]||!/^\d+$/.test(a.id)||ids.has(a.id)||!Array.isArray(a.sides)||a.sides.length!==4||a.sides.some(v=>!Number.isInteger(v)||v<0||v>3))throw new Error('Повреждённый экземпляр');
 if(a.cell!==null&&(!Number.isInteger(a.cell)||a.cell<0||a.cell>35||cells.has(a.cell)))throw new Error('Повреждённая клетка');ids.add(a.id);if(a.cell!==null)cells.add(a.cell);
 const d=definition(a),u={id:a.id,species:a.species,cell:a.cell,sides:[...a.sides],rotation:Number.isInteger(a.rotation)?((a.rotation%4)+4)%4:0,progress:Number.isFinite(a.progress)&&d.cycle?Math.max(0,Math.min(d.cycle,a.progress)):0,running:!!d.cycle&&a.running===true,boosted:a.boosted===true,buffer:d.amount&&Number.isFinite(a.buffer)?Math.max(0,Math.min(d.amount,Math.floor(a.buffer))):0,queue:Number.isSafeInteger(a.queue)?Math.max(0,a.queue):0,completed:Number.isSafeInteger(a.completed)?Math.max(0,a.completed):0};s.units.push(u);s.nextId=Math.max(s.nextId,+u.id+1);
 }
 for(const r of Object.keys(RESOURCES))s.stock[r]=Number.isFinite(x.stock?.[r])?Math.max(0,Math.min(LIMIT,Math.floor(x.stock[r]))):0;
 s.remainder=Number.isFinite(x.remainder)?Math.max(0,Math.min(STEP,x.remainder)):0;reconcile(s);return s;
}
