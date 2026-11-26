import { MultiplayerClient } from "./multiplayer.js";
const canvas=document.querySelector("#game"),ctx=canvas.getContext("2d"),coords=document.querySelector("#coords"),net=document.querySelector("#network-status");
const keys=new Set(),player={x:0,z:0,y:0,vy:0,facing:0},platforms=[{x:-4,z:0,w:8,d:5,h:0},{x:5,z:-2,w:3,d:3,h:1},{x:10,z:1,w:3,d:3,h:2},{x:15,z:-2,w:4,d:4,h:1}];
const multiplayer=new MultiplayerClient(),params=new URLSearchParams(location.search),serverUrl=params.get("server");
if(serverUrl){multiplayer.connect(serverUrl,{name:params.get("name")||"Player",room:params.get("room")||"lobby"});net.textContent="CONNECTING TO PLATWFC"}
multiplayer.addEventListener("connected",()=>net.textContent="PLATWFC CONNECTED");
multiplayer.addEventListener("disconnected",()=>net.textContent="PLATWFC OFFLINE");
addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key===" "&&player.y<=.001)player.vy=8.5});
addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0)}
new ResizeObserver(resize).observe(canvas);resize();
function project(x,z,h,cx,cy){return{x:cx+(x-z)*24,y:cy+(x+z)*12-h*28}}
function poly(ps,fill){ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle="#ffffff20";ctx.stroke()}
function drawAvatar(p,cx,cy,color="#ffd166",label=""){const q=project(p.x,p.z,p.y||0,cx,cy);ctx.fillStyle="#0005";ctx.beginPath();ctx.ellipse(q.x,q.y+12,13,5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;ctx.fillRect(q.x-9,q.y-28,18,27);ctx.fillStyle="#ff8b5c";ctx.fillRect(q.x-11,q.y-40,22,13);ctx.fillStyle="#182238";ctx.fillRect(q.x+2,q.y-35,3,3);if(label){ctx.font="11px system-ui";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText(label.slice(0,16),q.x,q.y-47)}}
let last=0;
function draw(t){const dt=Math.min((t-last)/1000||0,.04);last=t;
 const ax=(keys.has("d")||keys.has("arrowright")?1:0)-(keys.has("a")||keys.has("arrowleft")?1:0),az=(keys.has("s")||keys.has("arrowdown")?1:0)-(keys.has("w")||keys.has("arrowup")?1:0);
 player.x+=ax*dt*5;player.z+=az*dt*5;if(ax||az)player.facing=Math.atan2(az,ax);player.vy-=20*dt;player.y=Math.max(0,player.y+player.vy*dt);if(player.y===0)player.vy=0;
 multiplayer.sendState(player);
 const w=canvas.clientWidth,h=canvas.clientHeight,cx=w*.5-player.x*24+player.z*24,cy=h*.62-(player.x+player.z)*12;
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#182d4b");sky.addColorStop(1,"#263d55");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 platforms.slice().sort((a,b)=>(a.x+a.z)-(b.x+b.z)).forEach(q=>{const a=project(q.x,q.z,q.h,cx,cy),b=project(q.x+q.w,q.z,q.h,cx,cy),c=project(q.x+q.w,q.z+q.d,q.h,cx,cy),d=project(q.x,q.z+q.d,q.h,cx,cy),down=28;poly([d,c,{x:c.x,y:c.y+down},{x:d.x,y:d.y+down}],"#246b67");poly([b,c,{x:c.x,y:c.y+down},{x:b.x,y:b.y+down}],"#1d555b");poly([a,b,c,d],q.h?"#72e6c1":"#4e8f91")});
 for(const peer of multiplayer.peers.values())drawAvatar(peer,cx,cy,"#7bb7ff",peer.name);
 drawAvatar(player,cx,cy);
 coords.textContent="X "+player.x.toFixed(1)+" · Z "+player.z.toFixed(1)+" · "+(multiplayer.peers.size+1)+" PLAYER(S)";
 requestAnimationFrame(draw)}
requestAnimationFrame(draw);