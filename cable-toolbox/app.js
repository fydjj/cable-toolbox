(function(){
  // 轻量选项卡切换
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab, .subtab');
    if(!btn) return;
    const target = btn.getAttribute('data-target');
    if(!target) return;
    // 主选项卡切换
    if(btn.classList.contains('tab')){
      document.querySelectorAll('.tab').forEach(b=>{
        b.classList.toggle('active', b===btn);
        b.setAttribute('aria-selected', b===btn ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-pane').forEach(p=>{
        p.classList.toggle('active', '#'+p.id === '#'+target);
      });
    }
    // 子选项卡切换（特性阻抗）
    if(btn.classList.contains('subtab')){
      document.querySelectorAll('.subtab').forEach(b=>{
        const sameGroup = b.parentElement === btn.parentElement;
        if(sameGroup){ b.classList.toggle('active', b===btn); b.setAttribute('aria-selected', b===btn ? 'true' : 'false'); }
      });
      const container = btn.closest('#tab-z0');
      if(container){
        container.querySelectorAll('.model-pane').forEach(p=>{
          p.classList.toggle('active', p.id === target);
        });
      }
    }
  });

  const groupsMeta = [
    { key: 'vbus', name: 'VBUS',     defaults: { N: undefined, d: 0.08, L: 1, K: 1, rho: 1.78, Rc: 10, contact: true } },
    { key: 'gnd',  name: 'GND',      defaults: { N: undefined, d: 0.08, L: 1, K: 1, rho: 1.78, Rc: 10, contact: true } },
    { key: 'wrap', name: '内层缠绕', defaults: { N: undefined, d: 0.08, L: 1, K: 1, rho: 10.14, Rc: 35, contact: true } },
  ];

  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
  const fmt2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  const fmt3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');

  function calcOne(input){
    const {N, d, L, K, rho, Rc, contact} = input;
    const errs = [];
    if(!Number.isFinite(N) || N < 1) errs.push('N ≥ 1');
    if(!(d > 0))  errs.push('d > 0');
    if(!(L > 0))  errs.push('L > 0');
    if(!(K >= 1)) errs.push('K ≥ 1');
    if(!(rho > 0)) errs.push('ρ > 0');
    if(!(Rc >= 0)) errs.push('R_c ≥ 0');
    if(errs.length) return { error: '参数无效：' + errs.join('，') };

    const D = 1.15 * d * Math.sqrt(N);
    const A_mm2 = Math.PI * Math.pow(d/2, 2) * N;
    const A_m2 = A_mm2 / 1e6;
    const rho_SI = rho * 1e-8;
    const r_mOhmPerM = (rho_SI / (A_m2 * K)) * 1e3;
    const R_mOhm = (rho_SI * L / (A_m2 * K)) * 1e3;
    const R_out = (contact ? (R_mOhm + Rc) : R_mOhm);

    return { D, A_mm2, r_mOhmPerM, R_mOhm, R_out };
  }

  function parallelCombine(R1, R2){
    if(!Number.isFinite(R1) || !Number.isFinite(R2) || R1<=0 || R2<=0) return NaN;
    return 1 / (1/R1 + 1/R2);
  }

  function buildGroup(meta){
    const tpl = document.getElementById('groupTemplate');
    const node = tpl.content.firstElementChild.cloneNode(true);
    $('.title', node).textContent = meta.name;

    const inpN = $('.inpN', node);
    const inpD = $('.inpD', node);
    const inpL = $('.inpL', node);
    const inpK = $('.inpK', node);
    const inpRho = $('.inpRho', node);
    const inpRc = $('.inpRc', node);
    const modes = $$('.contactMode', node);
    const segs = $$('.seg', node);

    const err = $('.err', node);
    const outD = $('.outD', node);
    const outAmm2 = $('.outAmm2', node);
    const outRunit = $('.outRunit', node);
    const outR = $('.outR', node);
    const outRout = $('.outRout', node);

    function read(){
      return {
        N: Number(inpN.value),
        d: Number(inpD.value || meta.defaults.d),
        L: Number(inpL.value || meta.defaults.L),
        K: Math.round(Number(inpK.value || meta.defaults.K)),
        rho: Number(inpRho.value || meta.defaults.rho),
        Rc: Number(inpRc.value || meta.defaults.Rc),
        contact: (modes.find(m=>m.checked)?.value === 'finished'),
      }
    }

    function render(){
      const data = read();
      const res = calcOne(data);
      if(res.error){ err.textContent = res.error; outD.textContent = outAmm2.textContent = outRunit.textContent = outR.textContent = outRout.textContent = '-'; return; }
      err.textContent = '';
      outD.textContent = fmt3(res.D);
      outAmm2.textContent = fmt3(res.A_mm2);
      outRunit.textContent = fmt2(res.r_mOhmPerM);
      outR.textContent = fmt2(res.R_mOhm);
      outRout.textContent = fmt2(res.R_out);
      node.__lastRout = res.R_out;
    }

    function fillDefaults(){
      inpN.value = '';
      inpD.value = meta.defaults.d;
      inpL.value = meta.defaults.L;
      inpK.value = meta.defaults.K;
      inpRho.value = meta.defaults.rho;
      inpRc.value = meta.defaults.Rc;
      // 裸线=关，成品=开：默认维持原 meta.defaults.contact
      const defaultMode = 'finished'; // 全局默认成品
      modes.forEach(m => m.checked = (m.value === defaultMode));
      render();
      // 初始化分段高亮
      const cur = modes.find(m=>m.checked)?.value;
      segs.forEach(s => s.classList.toggle('active', s.querySelector('input')?.value === cur));
    }

    const syncSegUI = () => {
      const cur = modes.find(m=>m.checked)?.value;
      segs.forEach(s => s.classList.toggle('active', s.querySelector('input')?.value === cur));
    };
    const onChange = () => { render(); syncSegUI(); try { refreshSummary(); } catch(e){} };
    [inpN, inpD, inpL, inpK, inpRho, inpRc].forEach(el => el.addEventListener('input', onChange));
    const onModeChangeLocal = () => {
      const mode = modes.find(m=>m.checked)?.value;
      if(mode) setGlobalMode(mode);
    };
    modes.forEach(m => m.addEventListener('change', onModeChangeLocal));
    segs.forEach(s => s.addEventListener('click', (e)=>{
      const val = s.querySelector('input')?.value;
      if(!val) return;
      setGlobalMode(val);
    }));

    node.__fillDefaults = fillDefaults;
    node.__render = render;
    node.__clear = () => { $$('input', node).forEach(i => { if(i.type==='checkbox'){ i.checked=false; } else { i.value=''; } }); err.textContent=''; render(); };

    fillDefaults();
    return node;
  }

  const wrap = document.getElementById('groups');
  const groupNodes = [
    buildGroup(groupsMeta[0]),
    buildGroup(groupsMeta[1]),
    buildGroup(groupsMeta[2]),
  ];
  groupNodes.forEach(n => wrap.appendChild(n));

  function setGlobalMode(mode){
    // 同步三组的裸线/成品选择
    groupNodes.forEach(node => {
      const modes = Array.from(node.querySelectorAll('.contactMode'));
      const segs = Array.from(node.querySelectorAll('.seg'));
      modes.forEach(m => m.checked = (m.value === mode));
      segs.forEach(s => s.classList.toggle('active', s.querySelector('input')?.value === mode));
      node.__render();
    });
    try { refreshSummary(); } catch(e){}
  }

  function refreshSummary(){
    groupNodes.forEach(n => n.__render());
    const vbus = groupNodes[0].__lastRout;
    const gnd  = groupNodes[1].__lastRout;
    const wrapR= groupNodes[2].__lastRout;
    $('#sum_vbus').textContent = fmt2(vbus);
    const gndWrap = parallelCombine(gnd, wrapR);
    $('#sum_gw').textContent = Number.isFinite(gndWrap) ? fmt2(gndWrap) : '-';
  }

  document.getElementById('fillDefaults').addEventListener('click', () => { groupNodes.forEach(n => n.__fillDefaults()); setGlobalMode('finished'); refreshSummary(); });
  document.getElementById('resetAll').addEventListener('click', () => { groupNodes.forEach(n => n.__clear()); refreshSummary(); });

  // 初始渲染一次汇总 + 设定全局默认为成品
  setGlobalMode('finished');
  refreshSummary();

  // ========== 特性阻抗：同轴线模型 ==========
  const inpCoax_d   = document.getElementById('inpCoax_d');
  const inpCoax_do  = document.getElementById('inpCoax_do');
  const inpCoax_dw  = document.getElementById('inpCoax_dw');
  const inpCoax_D   = document.getElementById('inpCoax_D');
  const inpCoax_eps = document.getElementById('inpCoax_eps');
  const inpCoax_K1  = document.getElementById('inpCoax_K1');
  const outCoaxZ0   = document.getElementById('outCoaxZ0');
  const sumCoaxZ0   = document.getElementById('sum_coax_z0');
  const errCoax     = document.getElementById('errCoax');
  const btnFillCoax = document.getElementById('fillCoaxDefaults');
  const btnResetCoax= document.getElementById('resetCoax');

  function readCoax(){
    return {
      d:   Number(inpCoax_d && inpCoax_d.value),            // mm
      do:  Number(inpCoax_do && inpCoax_do.value),          // mm（保留输入以便参考）
      dw:  Number(inpCoax_dw && inpCoax_dw.value),          // 已使用 mm 直接输入
      D:   Number(inpCoax_D && inpCoax_D.value),            // mm
      eps: Number(inpCoax_eps && inpCoax_eps.value),        // 介电常数
      K1:  Number(inpCoax_K1 && inpCoax_K1.value),
    };
  }

  function calcCoaxZ0(p){
    const errs = [];
    if(!(p.d>0)) errs.push('d>0');
    if(!(p.D>0)) errs.push('D>0');
    if(!(p.eps>0)) errs.push('ε>0');
    if(!(p.K1>0)) errs.push('K1>0');
    if(!(p.dw>=0)) errs.push('dw≥0');
    const Deff = p.D + 1.5*p.dw;
    const denom = p.K1 * p.d;
    if(!(Deff>0)) errs.push('D+1.5·dw>0');
    if(!(denom>0)) errs.push('K1·d>0');
    if(Deff <= denom) errs.push('几何约束不满足：Deff > K1·d');
    if(errs.length){ return { error: '参数无效：' + errs.join('，') }; }
    const z0 = (60/Math.sqrt(p.eps)) * Math.log(Deff/denom); // 自然对数公式
    return { z0, Deff };
  }

  function renderCoax(){
    if(!inpCoax_d) return; // 页签不存在时直接跳过
    const p = readCoax();
    const r = calcCoaxZ0(p);
    if(r.error){ if(errCoax) errCoax.textContent = r.error; if(outCoaxZ0) outCoaxZ0.textContent='-'; if(sumCoaxZ0) sumCoaxZ0.textContent='-'; return; }
    if(errCoax) errCoax.textContent = '';
    if(outCoaxZ0) outCoaxZ0.textContent = fmt2(r.z0);
    if(sumCoaxZ0) sumCoaxZ0.textContent = fmt2(r.z0);
    // 同步公式块中的 Deff 显示（如后续需要可加入显示）
  }

  function fillCoaxDefaults(){
    if(!inpCoax_d) return;
    inpCoax_d.value = 0.8;     // 绞合外径 0.8 mm
    inpCoax_do.value = 0.08;   // 单根导体直径（用于K1参考图理解）
    inpCoax_dw.value = 0.05;   // 有效屏蔽厚度 0.05 mm
    inpCoax_D.value = 3.0;     // 绝缘体外径 3.0 mm
    inpCoax_eps.value = 2.3;   // 介电常数（PE）
    inpCoax_K1.value = 0.95;   // 绞合系数示例
    renderCoax();
  }

  function resetCoax(){
    if(!inpCoax_d) return;
    [inpCoax_d, inpCoax_do, inpCoax_dw, inpCoax_D, inpCoax_eps, inpCoax_K1].forEach(i=> i && (i.value=''));
    renderCoax();
  }

  [inpCoax_d, inpCoax_do, inpCoax_dw, inpCoax_D, inpCoax_eps, inpCoax_K1].forEach(i=> i && i.addEventListener('input', renderCoax));
  if(btnFillCoax) btnFillCoax.addEventListener('click', fillCoaxDefaults);
  if(btnResetCoax) btnResetCoax.addEventListener('click', resetCoax);

  // 初始渲染
  renderCoax();
})();
