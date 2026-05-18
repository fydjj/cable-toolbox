(function(){
  const KEY = 'cable-toolbox:v2';
  const DEFAULT_GROUPS = [
    { id:'VBUS', label:'VBUS', defaults: { contactOn: true, contact_mohm: 10, diameter_mm: 0.08, length_m: 1, cables: 1, resistivity_e8: 1.78 } },
    { id:'GND', label:'GND', defaults: { contactOn: true, contact_mohm: 10, diameter_mm: 0.08, length_m: 1, cables: 1, resistivity_e8: 1.78 } },
    { id:'TWIST_IN', label:'内层缠绕', defaults: { contactOn: true, contact_mohm: 35, diameter_mm: 0.08, length_m: 1, cables: 1, resistivity_e8: 10.14 } },
    { id:'TWIST_OUT', label:'外层缠绕', opts: { enabled: true }, defaults: { contactOn: false, contact_mohm: 35, diameter_mm: 0.08, length_m: 1, cables: 1, resistivity_e8: 10.14 } },
  ];

  const state = load() || {
    groups: DEFAULT_GROUPS.map(g => ({
      id: g.id,
      label: g.label,
      opts: g.opts || {},
      inputs: { strands: '', diameter_mm: '', length_m: '', cables: '', resistivity_e8: '', contactOn: (g.defaults?.contactOn ?? false), contact_mohm: (g.defaults?.contact_mohm ?? ''), _isDefault: { d:true, L:true, K:true, rho:true } }
    })),
    twist_contact_total_mohm: 35
  };

  // 兼容旧状态：补上新字段默认值
  if(state.twist_contact_total_mohm == null) state.twist_contact_total_mohm = 35;

  function load(){
    try{ const raw = localStorage.getItem(KEY); return raw? JSON.parse(raw): null }catch{ return null }
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }

  function mm2_from_strands_d(strands, d_mm){
    // 每根导体截面积 = π*(d/2)^2 (mm²)，总截面积 = 根数*N
    const r = d_mm/2;
    return Math.PI*r*r*strands; // mm²
  }
  function eq_diameter_from_bundle(strands, d_mm){
    // 经验系数：D ≈ 1.15 · d · √N
    return 1.15 * d_mm * Math.sqrt(strands);
  }
  function resistance_mohm({strands, d_mm, length_m, cables, rho_ohm_m}){
    // 算法.md：电阻(毫欧) = (电阻率 * 长度) / (截面积 * 绞合后线缆根数) × 1000
    // 截面积 = 单根导体截面积 * 绞合导体根数。注意单位换算：
    // ρ[Ω·m]，长度[m]，截面积需要[m²]；当前 mm² → m² 需 ÷1e6。
    const area_mm2 = mm2_from_strands_d(strands, d_mm);
    const area_m2 = area_mm2 / 1e6;
    if(area_m2 <= 0 || cables <= 0) return { per_m_mohm: NaN, total_mohm: NaN };
    const R_total_ohm = (rho_ohm_m * length_m) / (area_m2 * cables);
    return {
      per_m_mohm: (rho_ohm_m / (area_m2 * cables)) * 1e3, // 每米毫欧
      total_mohm: R_total_ohm * 1e3
    };
  }

  function number(v){
    const n = Number(v); return Number.isFinite(n)? n: NaN;
  }
  function fmt(x, unit){
    if(!Number.isFinite(x)) return '—';
    return x.toFixed(4).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1')+ (unit? ' '+unit: '');
  }

  function bindTwistContactTotal(){
    const input = document.getElementById('twistContactTotal');
    if(!input) return;
    input.value = state.twist_contact_total_mohm;
    input.addEventListener('input', ()=>{ state.twist_contact_total_mohm = Number(input.value); save(); renderCombined(); });
  }

  function render(){
    const root = document.getElementById('groups');
    root.innerHTML = '';
    // 网格布局：按 VBUS(左) / GND(右) / 内层缠绕(左) / 外层缠绕(右)
    const order = ['VBUS','GND','TWIST_IN','TWIST_OUT'];
    state.groups.sort((a,b)=> order.indexOf(a.id)-order.indexOf(b.id));
    state.groups.forEach((g, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <fieldset>
          <legend>${g.label}</legend>
          <div class="row">
            <div>
              <label>绞合导体根数 N</label>
              <input type="number" min="1" step="1" data-key="strands" value="${g.inputs.strands}">
            </div>
            <div>
              <label>单根导体直径 d (mm)</label>
              <input class="is-default" type="number" min="0" step="0.001" data-key="diameter_mm" value="${g.inputs.diameter_mm ?? g.defaults?.diameter_mm ?? ''}">
            </div>
            <div>
              <label>导体长度 L (m)</label>
              <input class="is-default" type="number" min="0" step="0.01" data-key="length_m" value="${g.inputs.length_m ?? g.defaults?.length_m ?? ''}">
            </div>
            <div>
              <label>绞合后线缆根数 K</label>
              <input class="is-default" type="number" min="1" step="1" data-key="cables" value="${g.inputs.cables ?? g.defaults?.cables ?? ''}">
            </div>
            <div class="full">
              <label>电阻率 ρ (×10⁻⁸ Ω·m)</label>
              <input class="is-default" type="number" min="0" step="0.01" data-key="resistivity_e8" value="${g.inputs.resistivity_e8 ?? g.defaults?.resistivity_e8 ?? ''}">
            </div>
            <div>
              <label>接触阻抗开关</label>
              <select data-key="contactOn">
                <option value="true" ${g.inputs.contactOn? 'selected':''}>开</option>
                <option value="false" ${!g.inputs.contactOn? 'selected':''}>关</option>
              </select>
            </div>
            <div>
              <label>接触阻抗 (mΩ)</label>
              <input type="number" min="0" step="0.01" data-key="contact_mohm" value="${g.inputs.contact_mohm}">
            </div>
          </div>
        </fieldset>
        <div class="stats">
          <div class="stat"><div class="sub">绞合外径 D≈1.15·d·√N</div><div class="v" data-out="D"></div></div>
          <div class="stat"><div class="sub">绞合截面积 A=π(d/2)²·N</div><div class="v" data-out="A"></div></div>
          <div class="stat"><div class="sub">单位电阻 r (mΩ/m)</div><div class="v" data-out="rperm"></div></div>
        </div>
        <div class="grid-3" style="margin-top:12px">
          <div class="stat"><div class="sub">总电阻 R (mΩ)</div><div class="v" data-out="Rtot"></div></div>
          <div class="stat"><div class="sub">提示</div><div class="sub">仅按几何与直流电阻率计算，未计入接触电阻/温度系数/真实绞合填充率等修正。η可在顶部配置。</div></div>
        </div>
      `;

      // 外层缠绕“有/无”开关
      if(g.id === 'TWIST_OUT'){
        const fs = card.querySelector('fieldset');
        const ctrl = document.createElement('div');
        ctrl.className = 'row';
        ctrl.innerHTML = `
          <div class="full">
            <label>外层缠绕</label>
            <select data-key="enabled">
              <option value="true" ${g.opts.enabled!==false? 'selected':''}>有</option>
              <option value="false" ${g.opts.enabled===false? 'selected':''}>无</option>
            </select>
          </div>`;
        fs.prepend(ctrl);
        ctrl.querySelector('select').addEventListener('change', (e)=>{
          g.opts.enabled = e.target.value === 'true';
          save();
          // 外层切换影响到内/外层缠绕卡片的接触阻抗可用性，整体重渲染
          render();
        });
      }

      card.querySelectorAll('input, select').forEach(inp => {
        inp.addEventListener('input', () => {
          const key = inp.dataset.key;
          g.inputs[key] = inp.value;
          // 去掉默认色：用户输入任何值即视为自定义
          if(['diameter_mm','length_m','cables','resistivity_e8'].includes(key)){
            inp.classList.remove('is-default');
          }
          if(key === 'contactOn'){
            const contactInput = card.querySelector('input[data-key="contact_mohm"]');
            const on = (inp.value === 'true' || inp.value === true);
            if(on){
              const cur = Number(g.inputs.contact_mohm);
              if(!Number.isFinite(cur)){
                const def = g.defaults?.contact_mohm ?? ((g.id==='TWIST_IN'||g.id==='TWIST_OUT')?35:10);
                g.inputs.contact_mohm = def;
                if(contactInput) contactInput.value = def;
              }
              if(contactInput) contactInput.disabled = false;
            } else {
              if(contactInput) contactInput.disabled = true;
            }
          }
          save();
          update(card, g);
          renderCombined();
        });
      });

      root.appendChild(card);
      update(card, g);
      bindTwistContactTotal();
    });
  }

  function update(card, g){
    // 外层缠绕“无”时，禁用并清空输出
    if(g.id === 'TWIST_OUT' && g.opts && g.opts.enabled === false){
      card.classList.add('disabled');
      card.querySelector('[data-out="D"]').textContent = '—';
      card.querySelector('[data-out="A"]').textContent = '—';
      card.querySelector('[data-out="rperm"]').textContent = '—';
      card.querySelector('[data-out="Rtot"]').textContent = '—';
      // 自身接触阻抗控件置灰
      const sel = card.querySelector('select[data-key="contactOn"]');
      const inp = card.querySelector('input[data-key="contact_mohm"]');
      if(sel) sel.disabled = true; if(inp) inp.disabled = true;
      return;
    } else {
      card.classList.remove('disabled');
    }

    const strands = number(g.inputs.strands);
    const d_mm = number(g.inputs.diameter_mm || g.defaults?.diameter_mm);
    const L = number(g.inputs.length_m || g.defaults?.length_m);
    const K = number(g.inputs.cables || g.defaults?.cables);
    const rho_e8 = number(g.inputs.resistivity_e8 || g.defaults?.resistivity_e8); // 输入单位 ×10⁻⁸ Ω·m
    const rho = Number.isFinite(rho_e8)? rho_e8 * 1e-8 : NaN;

    const D = eq_diameter_from_bundle(strands, d_mm);
    const A_mm2 = mm2_from_strands_d(strands, d_mm);
    const { per_m_mohm, total_mohm } = resistance_mohm({
      strands, d_mm, length_m: L, cables: K, rho_ohm_m: rho
    });

    // 接触阻抗输入框的禁用逻辑：当外层=有且当前是内/外层缠绕时，UI禁用
    const isTwist = (g.id==='TWIST_IN' || g.id==='TWIST_OUT');
    const hasOuter = !(state.groups.find(x=>x.id==='TWIST_OUT')?.opts?.enabled === false);
    const sel = card.querySelector('select[data-key="contactOn"]');
    const inp = card.querySelector('input[data-key="contact_mohm"]');
    if(isTwist && hasOuter){ if(sel) sel.disabled = true; if(inp) inp.disabled = true; } else { if(sel) sel.disabled = false; if(inp) inp.disabled = (String(g.inputs.contactOn)!=='true'); }

    // 默认值的外观：如果仍为默认（空或等于 defaults），则标灰
    const fldMap = [
      ['input[data-key="diameter_mm"]','diameter_mm'],
      ['input[data-key="length_m"]','length_m'],
      ['input[data-key="cables"]','cables'],
      ['input[data-key="resistivity_e8"]','resistivity_e8'],
    ];
    for(const [selStr, key] of fldMap){
      const el = card.querySelector(selStr);
      if(!el) continue;
      const v = g.inputs[key];
      const def = g.defaults?.[key];
      if(v==='' || v==null || (Number(v)===def)) el.classList.add('is-default'); else el.classList.remove('is-default');
    }

    // 叠加接触阻抗（总电阻）
    let Rtot_with_contact = total_mohm;
    const contactOn = String(g.inputs.contactOn) === 'true' || g.inputs.contactOn === true;
    const Rc = number(g.inputs.contact_mohm);
    if(contactOn && Number.isFinite(Rc) && !(isTwist && hasOuter)){
      Rtot_with_contact = Number.isFinite(total_mohm) ? (total_mohm + Rc) : Rc;
    }

    card.querySelector('[data-out="D"]').textContent = fmt(D, 'mm');
    card.querySelector('[data-out="A"]').textContent = fmt(A_mm2, 'mm²');
    card.querySelector('[data-out="rperm"]').textContent = fmt(per_m_mohm, 'mΩ/m');
    card.querySelector('[data-out="Rtot"]').textContent = fmt(Rtot_with_contact, 'mΩ');
  }

  // 导入导出
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cable-toolbox.json';
    a.click();
  });
  // 第三行：并联后的合成阻抗展示
  function renderCombined(){
    const box = document.getElementById('combined');
    const byId = Object.fromEntries(state.groups.map(g => [g.id, g]));

    function totalWithContact(g){
      const strands = number(g.inputs.strands);
      const d_mm = number(g.inputs.diameter_mm);
      const L = number(g.inputs.length_m);
      const K = number(g.inputs.cables);
      const rho_e8 = number(g.inputs.resistivity_e8);
      const rho = Number.isFinite(rho_e8)? rho_e8 * 1e-8 : NaN;
      const { total_mohm } = resistance_mohm({ strands, d_mm, length_m: L, cables: K, rho_ohm_m: rho });
      const contactOn = String(g.inputs.contactOn) === 'true' || g.inputs.contactOn === true;
      const Rc = number(g.inputs.contact_mohm);
      if(contactOn && Number.isFinite(Rc)) return Number.isFinite(total_mohm)? total_mohm + Rc : Rc;
      return total_mohm;
    }

    // 依据“有无外层缠绕”选择并联对象与接触阻抗口径
    const hasOuter = !(byId['TWIST_OUT']?.opts?.enabled === false);

    let Rg = totalWithContact(byId['GND']);
    let Rin = totalWithContact(byId['TWIST_IN']);
    let Rout;
    if(hasOuter){
      // 关闭内/外层卡片上的接触阻抗，改由“缠绕总接触阻抗”统一输入（来自第三行输入框）
      byId['TWIST_IN'].inputs.contactOn = false;
      byId['TWIST_OUT'].inputs.contactOn = false;
      const Rin_no = totalWithContact(byId['TWIST_IN']); // 已不含接触
      const Rout_no = (function(){
        const g = byId['TWIST_OUT'];
        const strands = number(g.inputs.strands);
        const d_mm = number(g.inputs.diameter_mm);
        const L = number(g.inputs.length_m);
        const K = number(g.inputs.cables);
        const rho_e8 = number(g.inputs.resistivity_e8);
        const rho = Number.isFinite(rho_e8)? rho_e8 * 1e-8 : NaN;
        const { total_mohm } = resistance_mohm({ strands, d_mm, length_m: L, cables: K, rho_ohm_m: rho });
        return total_mohm;
      })();
      // 使用第三行输入的“缠绕总接触阻抗”
      const Rc_twist = number(state.twist_contact_total_mohm);
      const Rin_eff = Number.isFinite(Rin_no)? Rin_no : NaN;
      const Rout_eff = Number.isFinite(Rout_no)? (Number.isFinite(Rc_twist)? (Rout_no + Rc_twist) : Rout_no) : NaN;
      Rin = Rin_eff; Rout = Rout_eff;
    } else {
      // 无外层：按更新要求，输出 GND 与内层缠绕各自加接触阻抗再并联
      Rout = NaN;
    }

    function parallel(...vals){
      const arr = vals.filter(v => Number.isFinite(v) && v>0);
      if(arr.length === 0) return NaN;
      const sum = arr.reduce((s,x)=> s + 1/x, 0);
      return 1 / sum;
    }

    const Rpar_noOuter = parallel(Rg, Rin);
    const Rpar_withOuter = parallel(Rg, Rin, Rout);

    const detailsNoOuter = `GND_out=${fmt(Rg,'mΩ')}，内层_out=${fmt(Rin,'mΩ')}`;
    const detailsWithOuter = `GND_out=${fmt(Rg,'mΩ')}，内层(不含接触)=${fmt(Rin,'mΩ')}，外层(含缠绕接触)=${fmt(Rout,'mΩ')}`;

    box.innerHTML = `
      <div class="row">
        <div>
          <div class="stat"><div class="sub">合成（无外层：GND∥内层）</div><div class="v">${fmt(Rpar_noOuter,'mΩ')}</div><div class="sub">${detailsNoOuter}</div></div>
        </div>
        <div>
          <div class="stat"><div class="sub">合成（有外层：GND∥(内层∥外层*)）</div><div class="v">${fmt(Rpar_withOuter,'mΩ')}</div><div class="sub">${detailsWithOuter}</div></div>
        </div>
      </div>`;
  }

  document.getElementById('importFile').addEventListener('change', ev => {
    const f = ev.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const obj = JSON.parse(r.result); if(obj && obj.groups) { Object.assign(state, obj); save(); render(); } }
      catch(e){ alert('导入失败：文件格式不正确'); }
    };
    r.readAsText(f);
  });

  // 预留：后续若需开放外径系数可在此注入全局控件

  // PWA SW 注册
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    });
  }

  render();
})();
