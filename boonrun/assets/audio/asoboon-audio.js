/* ASOBooN SOUND SYSTEM v1.2.0 — SOUND MASTER
   Shared by BOONJUMP / BOONRUN.
   Mobile-first Web Audio runtime with focus ducking, limiter/compressor,
   group voice caps, retry-safe loading and silent failure semantics. */
(function(global){
  'use strict';
  const AC=()=>global.AudioContext||global.webkitAudioContext;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const GROUP_LIMIT=Object.freeze({signature:1,judge:2,ui:2,item:3,action:4,warning:1,world:1,reward:2,result:2,ultimate:2,default:4});
  class Player{
    constructor(opts={}){
      this.base=(opts.base||'./assets/audio/').replace(/\/?$/,'/');
      this.enabled=opts.enabled!==false;
      this.master=clamp(Number(opts.master??.86)||0,0,1);
      this.maxVoices=clamp(Number(opts.maxVoices)||10,4,16);
      this.ctx=null;this.manifest=null;this.assetMap=new Map();this.machineMap={};
      this.bytes=new Map();this.buffers=new Map();this.voices=[];this.cooldowns=new Map();
      this.manifestPromise=null;this.unlockPromise=null;
      this.masterGain=null;this.bedBus=null;this.focusBus=null;this.compressor=null;
      this.duckUntil=0;this.duckTimer=0;
      this.debug=!!opts.debug;this.stopOnHidden=opts.stopOnHidden!==false;
      this._onVisibility=()=>{if(this.stopOnHidden&&global.document?.hidden)this.stopAll();};
      global.document?.addEventListener?.('visibilitychange',this._onVisibility,{passive:true});
      this._loadManifest().then(()=>{if(opts.autoWarm!==false&&this.enabled)this.warmBytes().catch(()=>{});}).catch(()=>{});
    }
    _log(...a){if(this.debug&&global.console)console.debug('[ASOBOON AUDIO]',...a);}
    async _loadManifest(){
      if(this.manifest)return this.manifest;
      if(this.manifestPromise)return this.manifestPromise;
      this.manifestPromise=fetch(this.base+'sound-manifest.json',{cache:'force-cache'})
        .then(r=>{if(!r.ok)throw new Error('manifest '+r.status);return r.json();})
        .then(m=>{this.manifest=m;this.assetMap=new Map((m.assets||[]).map(a=>[a.id,a]));this.machineMap=m.machineMap||{};return m;})
        .catch(err=>{this._log('manifest unavailable',err);this.manifestPromise=null;return null;});
      return this.manifestPromise;
    }
    _ensureGraph(){
      if(!this.ctx||this.ctx.state==='closed')return false;
      if(this.masterGain&&this.masterGain.context===this.ctx)return true;
      try{
        const c=this.ctx;
        this.bedBus=c.createGain();this.focusBus=c.createGain();this.compressor=c.createDynamicsCompressor();this.masterGain=c.createGain();
        this.bedBus.gain.value=1;this.focusBus.gain.value=1;this.masterGain.gain.value=this.enabled?this.master:0;
        this.compressor.threshold.value=-13;this.compressor.knee.value=12;this.compressor.ratio.value=4;this.compressor.attack.value=.004;this.compressor.release.value=.18;
        this.bedBus.connect(this.compressor);this.focusBus.connect(this.compressor);this.compressor.connect(this.masterGain).connect(c.destination);
        return true;
      }catch(err){this._log('graph failed',err);return false;}
    }
    output(priority=3){this._ensureGraph();return Number(priority)>=6?(this.focusBus||this.ctx?.destination):(this.bedBus||this.ctx?.destination);}
    setEnabled(v){
      const was=this.enabled;this.enabled=!!v;
      if(!this.enabled){if(this.masterGain&&this.ctx){const t=this.ctx.currentTime;this.masterGain.gain.cancelScheduledValues(t);this.masterGain.gain.setValueAtTime(0,t);}this.stopAll();return;}
      this.unlock().then(ok=>{if(ok&&this.masterGain&&this.ctx){const t=this.ctx.currentTime;this.masterGain.gain.cancelScheduledValues(t);this.masterGain.gain.setTargetAtTime(this.master,t,.018);}}).catch(()=>{});
      if(!was)this.warmBytes().catch(()=>{});
    }
    setMaster(v){this.master=clamp(Number(v)||0,0,1);if(this.masterGain&&this.ctx&&this.enabled){const t=this.ctx.currentTime;this.masterGain.gain.cancelScheduledValues(t);this.masterGain.gain.setTargetAtTime(this.master,t,.025);}}
    isReady(id){const v=this.buffers.get(id);return !!(v&&typeof v.then!=='function');}
    async warmBytes(ids=null){
      const m=await this._loadManifest();if(!m)return false;
      const list=(ids&&ids.length?ids:(m.assets||[]).map(a=>a.id)).filter(id=>this.assetMap.has(id));
      await Promise.allSettled(list.map(id=>this._fetchBytes(id)));return true;
    }
    async _fetchBytes(id){
      if(this.bytes.has(id))return this.bytes.get(id);
      const a=this.assetMap.get(id);if(!a)return null;
      const p=fetch(this.base+a.file,{cache:'force-cache'})
        .then(r=>{if(!r.ok)throw new Error(a.file+' '+r.status);return r.arrayBuffer();})
        .catch(err=>{this._log('fetch failed',id,err);this.bytes.delete(id);return null;});
      this.bytes.set(id,p);return p;
    }
    async unlock(){
      if(!this.enabled)return false;
      if(this.unlockPromise)return this.unlockPromise;
      this.unlockPromise=(async()=>{
        try{
          const C=AC();if(!C)return false;
          if(!this.ctx||this.ctx.state==='closed')this.ctx=new C({latencyHint:'interactive'});
          if(this.ctx.state==='suspended')await this.ctx.resume().catch(()=>{});
          if(this.ctx.state==='closed')return false;
          this._ensureGraph();
          const b=this.ctx.createBuffer(1,1,this.ctx.sampleRate),s=this.ctx.createBufferSource();s.buffer=b;s.connect(this.output(7));s.start();
          return this.ctx.state!=='closed';
        }catch(err){this._log('unlock failed',err);return false;}
      })();
      const ok=await this.unlockPromise;this.unlockPromise=null;return ok;
    }
    async preload(ids=[]){if(!this.enabled)return false;const ok=await this.unlock();if(!ok)return false;await this.warmBytes(ids);await Promise.allSettled(ids.map(id=>this._decode(id)));return true;}
    async preloadAll(){const m=await this._loadManifest();if(!m)return false;return this.preload((m.assets||[]).map(a=>a.id));}
    async _decode(id){
      const existing=this.buffers.get(id);if(existing)return existing;
      const p=(async()=>{if(!this.ctx){const ok=await this.unlock();if(!ok)return null;}const ab=await this._fetchBytes(id);if(!ab||!this.ctx)return null;try{return await this.ctx.decodeAudioData(ab.slice(0));}catch(err){this._log('decode failed',id,err);return null;}})();
      this.buffers.set(id,p);const b=await p;if(b)this.buffers.set(id,b);else this.buffers.delete(id);return b;
    }
    _groupFor(a,opts){
      if(opts.group)return String(opts.group);
      const tags=a?.tags||[];
      if(tags.includes('signature')||tags.includes('machine'))return 'signature';
      if(tags.includes('judge'))return 'judge';if(tags.includes('ui'))return 'ui';if(tags.includes('item'))return 'item';if(tags.includes('action'))return 'action';
      if(tags.includes('warning'))return 'warning';if(tags.includes('world'))return 'world';if(tags.includes('reward')||tags.includes('record'))return 'reward';if(tags.includes('result'))return 'result';if(tags.includes('ultimate'))return 'ultimate';
      return a?.category||'default';
    }
    _defaultCooldown(group){return ({ui:30,judge:30,item:42,action:40,warning:350,world:420,reward:250,result:300,signature:500,ultimate:220})[group]||0;}
    _rateFor(a,opts,group){
      if(opts.rate!=null)return clamp(Number(opts.rate)||1,.55,1.8);
      if(group==='action'||group==='item')return 1+(Math.random()-.5)*.022;
      return 1;
    }
    _prune(){this.voices=this.voices.filter(v=>!v.done);}
    _stopVoice(v,fade=.012){
      if(!v||v.done)return;v.done=true;
      try{if(v.gain&&this.ctx){const t=this.ctx.currentTime;v.gain.gain.cancelScheduledValues(t);v.gain.gain.setTargetAtTime(.0001,t,fade);v.source.stop(t+Math.max(.02,fade*4));}else v.source.stop();}catch(_){}
    }
    _claim(priority,group,limit){
      this._prune();
      const same=this.voices.filter(v=>!v.done&&v.group===group).sort((a,b)=>a.started-b.started);
      const groupLimit=Math.max(1,Number(limit)||GROUP_LIMIT[group]||GROUP_LIMIT.default);
      while(same.length>=groupLimit){const victim=same.shift();if(!victim||victim.priority>priority)return false;this._stopVoice(victim);}
      this._prune();if(this.voices.length<this.maxVoices)return true;
      let victim=null;for(const v of this.voices){if(!victim||v.priority<victim.priority||(v.priority===victim.priority&&v.started<victim.started))victim=v;}
      if(victim&&victim.priority<=priority){this._stopVoice(victim);this._prune();return true;}return false;
    }
    _duck(priority,a,opts){
      if(!this.ctx||!this.bedBus||priority<8)return;
      const isSignature=(a?.tags||[]).includes('signature');
      const amount=clamp(Number(opts.duck??(isSignature?.48:.58)),.35,.9),hold=clamp(Number(opts.duckMs??(isSignature?520:320)),80,1600);
      const t=this.ctx.currentTime;this.duckUntil=Math.max(this.duckUntil,performance.now()+hold);
      this.bedBus.gain.cancelScheduledValues(t);this.bedBus.gain.setTargetAtTime(amount,t,.012);
      clearTimeout(this.duckTimer);this.duckTimer=setTimeout(()=>{if(!this.ctx||!this.bedBus)return;if(performance.now()+8<this.duckUntil)return;const n=this.ctx.currentTime;this.bedBus.gain.cancelScheduledValues(n);this.bedBus.gain.setTargetAtTime(1,n,.09);},hold+20);
    }
    stopAll(){clearTimeout(this.duckTimer);for(const v of this.voices)this._stopVoice(v,.006);this.voices=[];if(this.bedBus&&this.ctx){const t=this.ctx.currentTime;this.bedBus.gain.cancelScheduledValues(t);this.bedBus.gain.setValueAtTime(1,t);}}
    async play(id,opts={}){
      if(!this.enabled)return null;
      const m=await this._loadManifest();if(!m||!this.enabled)return null;
      const a=this.assetMap.get(id);if(!a)return null;
      const group=this._groupFor(a,opts),now=performance.now(),cool=Math.max(0,Number(opts.cooldown??this._defaultCooldown(group))||0),last=this.cooldowns.get(id)||-Infinity;if(now-last<cool)return null;
      const b=await this._decode(id);if(!b||!this.ctx||!this.enabled)return null;
      const priority=clamp(Number(opts.priority)||2,0,10);if(!this._claim(priority,group,opts.groupLimit))return null;
      this.cooldowns.set(id,performance.now());this._duck(priority,a,opts);
      try{
        const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=b;s.playbackRate.value=this._rateFor(a,opts,group);
        const gain=clamp((a.volume??1)*(Number(opts.gain)??1),0,1.25);g.gain.value=gain;
        s.connect(g).connect(this.output(priority));
        const v={source:s,gain:g,priority,group,started:performance.now(),done:false};this.voices.push(v);s.onended=()=>{v.done=true;};
        s.start(this.ctx.currentTime+Math.max(0,Number(opts.delay)||0));return s;
      }catch(err){this._log('play failed',id,err);return null;}
    }
    machine(machineId,opts={}){const id=this.machineMap[machineId];return id?this.play(id,{priority:10,group:'signature',groupLimit:1,duck:.46,duckMs:620,...opts}):null;}
    status(){return {version:'1.2.0',enabled:this.enabled,context:this.ctx?.state||'none',manifest:!!this.manifest,assets:this.assetMap.size,bytes:this.bytes.size,buffers:[...this.buffers.values()].filter(v=>v&&typeof v.then!=='function').length,voices:this.voices.filter(v=>!v.done).length,master:this.master,limiter:!!this.compressor};}
    destroy(){this.stopAll();global.document?.removeEventListener?.('visibilitychange',this._onVisibility);try{this.ctx?.close?.();}catch(_){}this.ctx=null;this.masterGain=this.bedBus=this.focusBus=this.compressor=null;}
  }
  global.ASOBOON_AUDIO={version:'1.2.0',create:opts=>new Player(opts),Player};
})(window);
