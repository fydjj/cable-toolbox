(function(){
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
})();
