document.documentElement.style.setProperty('--neo-sprite','url("data:image/webp;base64,'+(window.__B12S||'')+'")');
window.__B12S='';
(async()=>{
  const mode=document.body.dataset.neoMode||'NEO';
  const title=document.getElementById('neoTitle');
  const status=document.getElementById('neoStatus');
  title.textContent=mode==='JUMP'?'NEO ブーンジャンプ':mode==='RUN'?'NEO ブーンRUN':'NEO MACHINE';
  try{
    const res=await fetch('../assets/neo-machines/machine-registry.json',{cache:'no-store'});
    if(!res.ok)throw new Error('registry '+res.status);
    const reg=await res.json();
    const grid=document.getElementById('machineGrid');
    grid.innerHTML=reg.machines.map(m=>{
      const c=m.previewIndex%4,r=Math.floor(m.previewIndex/4);
      const id=m.machineId||'ID PENDING';
      return `<article class="card"><div class="art" style="--col:${c};--row:${r}"></div><b>${m.nameJa}</b><div class="pair"><span class="pill">${m.category}</span><span class="pill ${m.seriesTier==='RARE'?'rare':''}">${m.seriesTier}</span></div><small>${m.assetKey} · ${id}</small></article>`;
    }).join('');
    status.textContent=`COMMON ROOT OK · ${reg.machines.length}/12 · ${mode} gameplay NOT CONNECTED`;
  }catch(err){status.textContent='COMMON ROOT FAIL · '+err.message;}
})();
