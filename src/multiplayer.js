export class MultiplayerClient extends EventTarget {
  constructor(){super();this.socket=null;this.id=null;this.connected=false;this.peers=new Map();this.lastSent=0;}
  connect(url,{name="Player",room="lobby"}={}){
    if(!url)return;
    try{
      this.socket=new WebSocket(url);
      this.socket.addEventListener("open",()=>{this.connected=true;this.socket.send(JSON.stringify({type:"join",name:String(name).slice(0,16),room:String(room).slice(0,24)}));this.dispatchEvent(new Event("connected"));});
      this.socket.addEventListener("message",e=>this.onMessage(e.data));
      this.socket.addEventListener("close",()=>{this.connected=false;this.peers.clear();this.dispatchEvent(new Event("disconnected"));});
      this.socket.addEventListener("error",()=>this.dispatchEvent(new Event("disconnected")));
    }catch(error){console.warn("PLATWFC connection failed",error);this.dispatchEvent(new Event("disconnected"));}
  }
  onMessage(raw){
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.type==="welcome")this.id=m.id;
    if(m.type==="joined"){this.peers.clear();for(const p of m.players||[])if(p.id!==this.id)this.peers.set(p.id,p);this.dispatchEvent(new Event("players-changed"));}
    if(m.type==="peer-joined"||m.type==="peer-state"){const p=m.player;if(p&&p.id!==this.id)this.peers.set(p.id,p);this.dispatchEvent(new Event("players-changed"));}
    if(m.type==="peer-left"){this.peers.delete(m.id);this.dispatchEvent(new Event("players-changed"));}
    if(m.type==="error")console.warn("PLATWFC:",m.message);
  }
  sendState(s){const now=performance.now();if(!this.connected||!this.socket||this.socket.readyState!==WebSocket.OPEN||now-this.lastSent<50)return;this.lastSent=now;this.socket.send(JSON.stringify({type:"state",x:s.x,z:s.z,y:s.y,facing:s.facing||0}));}
}