/* BOONRUN v1.2.3 RC9 — AUDIO RUNTIME GUARD
   BOONRUN-only adapter layered on top of the COMMON ASOBooN Audio Manager.
   Keeps root/assets/audio as the COMMON source of truth while hardening
   WebAudio user-gesture unlock and runtime asset freshness for Safari/LINE. */
(function(global){
  'use strict';

  const api=global.ASOBOON_AUDIO;
  const Player=api&&api.Player;
  if(!api||!Player||Player.prototype.__boonrunAudioFix1)return;

  const TOKEN='20260816-v123-rc9-sound-fix1';
  const proto=Player.prototype;
  const originalUnlock=proto.unlock;
  const originalCreate=api.create;
  proto.__boonrunAudioFix1=true;

  const versioned=path=>`${path}${path.includes('?')?'&':'?'}v=${TOKEN}`;

  proto._loadManifest=async function(){
    if(this.manifest)return this.manifest;
    if(this.manifestPromise)return this.manifestPromise;
    this.manifestPromise=fetch(versioned(this.base+'sound-manifest.json'),{cache:'reload'})
      .then(r=>{if(!r.ok)throw new Error('manifest '+r.status);return r.json();})
      .then(m=>{
        this.manifest=m;
        this.assetMap=new Map((m.assets||[]).map(a=>[a.id,a]));
        this.machineMap=m.machineMap||{};
        return m;
      })
      .catch(err=>{
        this._log?.('manifest unavailable',err);
        this.manifestPromise=null;
        return null;
      });
    return this.manifestPromise;
  };

  proto._fetchBytes=async function(id){
    if(this.bytes.has(id))return this.bytes.get(id);
    const a=this.assetMap.get(id);if(!a)return null;
    const p=fetch(versioned(this.base+a.file),{cache:'reload'})
      .then(r=>{if(!r.ok)throw new Error(a.file+' '+r.status);return r.arrayBuffer();})
      .catch(err=>{
        this._log?.('fetch failed',id,err);
        this.bytes.delete(id);
        return null;
      });
    this.bytes.set(id,p);
    return p;
  };

  proto.unlock=async function(){
    if(!this.enabled)return false;
    if(this.ctx?.state==='running')return true;
    const ok=await originalUnlock.call(this);
    if(this.ctx?.state==='suspended')await this.ctx.resume().catch(()=>{});
    return !!ok&&this.ctx?.state==='running';
  };

  proto._decode=async function(id){
    const existing=this.buffers.get(id);if(existing)return existing;
    const p=(async()=>{
      if(!this.ctx||this.ctx.state!=='running'){
        const ok=await this.unlock();if(!ok)return null;
      }
      const ab=await this._fetchBytes(id);
      if(!ab||!this.ctx||this.ctx.state!=='running')return null;
      try{return await this.ctx.decodeAudioData(ab.slice(0));}
      catch(err){this._log?.('decode failed',id,err);return null;}
    })();
    this.buffers.set(id,p);
    const b=await p;
    if(b)this.buffers.set(id,b);else this.buffers.delete(id);
    return b;
  };

  function installGestureUnlock(player){
    const events=['pointerdown','touchstart','mousedown','keydown','click'];
    let installed=true;
    const remove=()=>{
      if(!installed)return;
      installed=false;
      for(const type of events)global.document?.removeEventListener?.(type,onGesture,true);
    };
    const onGesture=()=>{
      if(!player.enabled)return;
      player.unlock().then(ok=>{
        if(ok&&player.ctx?.state==='running')remove();
      }).catch(()=>{});
    };
    for(const type of events)global.document?.addEventListener?.(type,onGesture,{capture:true,passive:true});
    const destroy=player.destroy?.bind(player);
    if(destroy)player.destroy=()=>{remove();return destroy();};
    return player;
  }

  api.create=opts=>installGestureUnlock(originalCreate(opts));
  api.runtimeFix='boonrun-rc9-audio1';
})(window);
