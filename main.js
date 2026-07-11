import './style.css';

const SIGNALS_URL = 'https://85.215.73.107.nip.io/api/live_positions.json?key=Rufflow777';
const RATES_URL = 'https://85.215.73.107.nip.io/api/exchange_rates.json?key=Rufflow777';
const TICKER_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'DOGE-USD', 'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];

const $ = id => document.getElementById(id);
let allPositions = [];

function norm(s) {
  const ticker = s.asset?.ticker || s.pair || s.ticker || '--';
  const tps = s.takeProfits || [];
  return {
    id: s.id || s.signal_id,
    signal_id: s.signal_id || s.id,
    score_pts: s.score_pts,
    score_label: s.score_label,
    ticker, pair: ticker,
    direction: s.direction,
    entry: s.entry || 0,
    sl: s.stopLoss?.price ?? (s.sl ?? 0),
    tp1: tps[0]?.price ?? (s.tp1 ?? 0),
    tp2: tps[1]?.price ?? (s.tp2 ?? 0),
    tp3: tps[2]?.price ?? (s.tp3 ?? 0),
    quantity: s.quantity || 0.001,
    status: s.status || 'open',
    timestamp: s.timestamp || '',
    closed_at: s.result?.exitAt || s.closed_at || '',
    exit_price: s.result?.exitPrice ?? (s.exit_price ?? 0),
    pnl_percent: s.result?.pnlPercent ?? (s.pnl_percent ?? (s.status !== 'open' && s.status !== 'active' ? 0 : undefined)),
    bloque: s.bloque || s.asset?.bloque || '',
    mode: s.mode || 'REAL',
  };
}

function shortTS(ts) {
  if (!ts) return '--';
  try { return new Date(ts.replace('Z','+00:00')).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',hour12:false}) }
  catch { return ts; }
}

function statusClass(s) {
  return ({'open':'open','active':'open','tp1_hit':'win','tp2_hit':'win','tp3_hit':'win','stopped':'loss','expired':'loss'})[s?.toLowerCase()]||'open';
}

// ─── CLOCK ────────────────────────────
function updateClock() {
  const el = $('clock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}

// ─── TICKER ────────────────────────────
async function updateTicker() {
  const tape = $('ticker-tape');
  if (!tape) return;
  try {
    const results = await Promise.allSettled(TICKER_SYMBOLS.map(t =>
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=1d&interval=1m`).then(r=>r.json()).then(d=>{
        const m = d?.chart?.result?.[0]?.meta; if(!m) return null;
        return {ticker:t, price:m.regularMarketPrice, change:((m.regularMarketPrice-(m.chartPreviousClose||m.regularMarketPrice))/(m.chartPreviousClose||m.regularMarketPrice)*100)};
      }).catch(()=>null)
    ));
    const items = results.map(r=>r.value).filter(Boolean);
    if (!items.length) return;
    tape.innerHTML = items.map(p =>
      `<span class="ti">${p.ticker.replace('-USD','/USD')} <span class="ti-${p.change>=0?'up':'down'}">${p.change>=0?'▲':'▼'}</span> ${p.price.toFixed(2)} <span class="ti-chg ${p.change>=0?'up':'down'}">${p.change>=0?'+':''}${p.change.toFixed(2)}%</span></span>`
    ).join(' <span class="ti-sep">•</span> ') + ' <span class="ti-sep">•</span> ' + tape.innerHTML;
  } catch {}
}

// ─── MARKET GRID ───────────────────────
async function updateMarketGrid() {
  const grid = $('market-grid');
  if (!grid) return;
  try {
    const results = await Promise.allSettled(TICKER_SYMBOLS.slice(0,8).map(t =>
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=1d&interval=1m`).then(r=>r.json()).then(d=>{
        const m = d?.chart?.result?.[0]?.meta; if(!m) return null;
        const chg = ((m.regularMarketPrice-(m.chartPreviousClose||m.regularMarketPrice))/(m.chartPreviousClose||m.regularMarketPrice)*100);
        return {t, p:m.regularMarketPrice, chg};
      }).catch(()=>null)
    ));
    const items = results.map(r=>r.value).filter(Boolean);
    if (!items.length) return;
    grid.innerHTML = items.map(x =>
      `<div class="mkt-item"><span class="mkt-symbol">${x.t.replace('-USD','')}</span><span class="mkt-price">$${x.p.toFixed(2)}</span><span class="mkt-chg ${x.chg>=0?'up':'down'}">${x.chg>=0?'+':''}${x.chg.toFixed(2)}%</span></div>`
    ).join('');
  } catch {}
}

// ─── HEALTH REPORT ───────────────────────
async function fetchRealData() {
  await Promise.all([
    fetchPositions(),
    fetchHistory(),
    fetchPortfolio(),
    fetchAnalytics(),
    fetchHealthData()
  ]);
  updateSidePanel();
}

async function fetchHealthData() {
  try {
    const res = await fetch(`${API_BASE}/system_health.json${API_KEY}`);
    if (!res.ok) throw new Error('Health data not available');
    const health = await res.json();
    
    document.getElementById('health-time').textContent = `Última sinc: ${new Date(health.last_sync).toLocaleString('es-VE')}`;
    let rows = '';
    
    // VMs
    for (const [name, data] of Object.entries(health.vms)) {
      const statusColor = data.status === 'active' ? 'var(--green)' : 'var(--red)';
      rows += `<tr>
        <td style="text-transform: uppercase;">Servidor ${name}</td>
        <td style="text-align:center; color:${statusColor}; font-weight:bold;">${data.status.toUpperCase()}</td>
        <td style="text-align:right;">CPU: ${data.cpu}% | RAM: ${data.ram}%</td>
      </tr>`;
    }
    // Services
    for (const [name, status] of Object.entries(health.services)) {
      const statusColor = status === 'active' ? 'var(--green)' : 'var(--red)';
      rows += `<tr>
        <td style="text-transform: capitalize;">${name.replace('_', ' ')}</td>
        <td style="text-align:center; color:${statusColor}; font-weight:bold;">${status.toUpperCase()}</td>
        <td style="text-align:right;">OK</td>
      </tr>`;
    }
    
    document.getElementById('health-tbody').innerHTML = rows;
  } catch(e) {
    document.getElementById('health-tbody').innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--red);">Error cargando telemetría</td></tr>`;
  }
}

// ─── TABS ─────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = $('tab-' + btn.dataset.tab);
      if (tab) tab.classList.add('active');
    });
  });
}

// ─── PAIR SELECTOR ────────────────────
function initPairSelector() {
  const sel = $('pair-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const pair = sel.value;
    const info = $('pair-info');
    if (!info) return;
    const closed = allPositions.filter(s => s.pnl_percent !== undefined && (s.ticker === pair || s.pair === pair));
    const trades = closed.length;
    const wins = closed.filter(p => p.pnl_percent > 0).length;
    const wr = trades > 0 ? (wins / trades * 100).toFixed(1) : '--';
    const totalPnl = closed.reduce((s, p) => s + (p.pnl_percent || 0), 0);
    info.innerHTML = `
      <div class="pair-stat"><span>Velas 1h</span><span class="text-dim">Procesadas</span></div>
      <div class="pair-stat"><span>Señales</span><span class="text-dim">${trades}</span></div>
      <div class="pair-stat"><span>Consenso</span><span class="${parseFloat(wr) >= 50 ? 'green' : 'red'}">${wr}% WR</span></div>
      <div class="pair-stat"><span>P&L</span><span class="${totalPnl >= 0 ? 'green' : 'red'}">${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%</span></div>
    `;
  });
}

// ─── RENDER POSITIONS ──────────────────
function renderPositions(signals) {
  const tbody = $('positions-tbody');
  const open = signals.filter(s => s.status === 'open' || s.status === 'active');
  if (!open.length) { tbody.innerHTML = '<tr class="empty"><td colspan="8">Sin posiciones activas</td></tr>'; return; }
  tbody.innerHTML = open.map(p => {
    const dir = (p.direction||'').toUpperCase();
    return `<tr>
      <td><strong>${p.pair||p.ticker}</strong></td>
      <td><span class="dir-badge ${dir==='BUY'?'buy':'sell'}">${dir}</span></td>
      <td>${(p.quantity||0.001).toFixed(4)}</td>
      <td>$${(p.entry||0).toFixed(4)}</td>
      <td class="red">$${(p.sl||0).toFixed(4)}</td>
      <td class="green">$${(p.tp1||0).toFixed(4)}</td>
      <td id="pr-${p.id||Math.random()}" class="text-dim">--</td>
      <td id="pn-${p.id||Math.random()}" class="text-dim">--</td>
    </tr>`;
  }).join('');
}

// ─── RENDER HISTORY ────────────────────
function renderHistory(signals) {
  const tbody = $('history-tbody');
  const closed = signals.filter(s => s.status!=='open' && s.status!=='active' && s.status!=='pending' && s.pnl_percent!==undefined);
  if (!closed.length) { tbody.innerHTML = '<tr class="empty"><td colspan="7">Sin historial aun</td></tr>'; return; }
  const sorted = closed.sort((a,b)=>((b.closed_at||b.timestamp)||'').localeCompare((a.closed_at||a.timestamp)||'')).slice(0,50);
  tbody.innerHTML = sorted.map(p => {
    const pnl = p.pnl_percent||0;
    const dir = (p.direction||'').toUpperCase();
    return `<tr>
      <td class="text-dim" title="${p.signal_id||p.id}">${((p.signal_id||p.id||'').slice(-12))}</td>
      <td><strong>${p.pair||p.ticker}</strong></td>
      <td><span class="dir-badge ${dir==='BUY'?'buy':'sell'}">${dir}</span></td>
      <td>$${(p.entry||0).toFixed(4)}</td>
      <td>$${(p.exit_price||0).toFixed(4)}</td>
      <td class="${pnl>=0?'green':'red'}">${pnl>=0?'+':''}${pnl.toFixed(2)}%</td>
      <td><span class="result-badge ${pnl>0?'win':'loss'}">${pnl>0?'GANANCIA':'PERDIDA'}</span></td>
    </tr>`;
  }).join('');
}

// ─── RENDER ORDERS ─────────────────────
function renderOrders(signals) {
  const tbody = $('orders-tbody');
  if (!signals||!signals.length) { tbody.innerHTML = '<tr class="empty"><td colspan="12">No hay operaciones aun</td></tr>'; return; }
  const sorted = [...signals].sort((a,b)=>((b.timestamp||'')).localeCompare((a.timestamp||'')));
  tbody.innerHTML = sorted.map(p => {
    const pnl = p.pnl_percent||0;
    const dir = (p.direction||'').toUpperCase();
    const st = p.status||'open';
    const score = p.score_pts ? `<span class="text-dim">${p.score_pts}/6</span>` : '<span class="text-dim">--</span>';
    return `<tr>
      <td class="text-dim" title="${p.signal_id||p.id}">${((p.signal_id||p.id||'').slice(-12))}</td>
      <td>${score}</td>
      <td><strong>${p.pair||p.ticker}</strong></td>
      <td><span class="dir-badge ${dir==='BUY'?'buy':'sell'}">${dir}</span></td>
      <td>$${(p.entry||0).toFixed(4)}</td>
      <td class="red">$${(p.sl||0).toFixed(4)}</td>
      <td class="green">$${(p.tp1||0).toFixed(4)}</td>
      <td class="gold">$${(p.tp2||0).toFixed(4)}</td>
      <td class="gold">$${(p.tp3||0).toFixed(4)}</td>
      <td class="${pnl>0?'green':pnl<0?'red':''}">${pnl>=0?'+':''}${pnl.toFixed(2)}%</td>
      <td><span class="result-badge ${statusClass(st)}">${st}</span></td>
      <td class="text-dim">${shortTS(p.timestamp)}</td>
    </tr>`;
  }).join('');
}

// ─── TRADE FEED ─────────────────────────
function renderTradeFeed(signals) {
  const feed = $('trade-feed');
  const sorted = [...signals].sort((a,b)=>((b.timestamp||'')).localeCompare((a.timestamp||''))).slice(0,20);
  if (!sorted.length) { feed.innerHTML = '<div class="feed-empty">Esperando operaciones...</div>'; return; }
  feed.innerHTML = sorted.map(p => {
    const dir = (p.direction||'').toUpperCase();
    const isBuy = dir==='BUY';
    const pnl = p.pnl_percent;
    let h = '';
    if (pnl!==undefined) h = `<span class="fi-pnl ${pnl>=0?'pos':'neg'}">${pnl>=0?'+':''}${pnl.toFixed(2)}%</span>`;
    else if (p.status==='open') h = '<span class="fi-pnl" style="color:var(--cyan)">◉ activa</span>';
    return `<div class="feed-item">
      <span class="fi-icon ${isBuy?'buy':'sell'}">${isBuy?'▲':'▼'}</span>
      <span class="fi-pair">${p.pair||p.ticker}</span>
      <span class="fi-action">${isBuy?'COMPRA':'VENTA'}</span>
      <span class="fi-price">@ $${(p.entry||0).toFixed(4)}</span>${h}
    </div>`;
  }).join('');
}

// ─── EQUITY CURVE ───────────────────────
function drawEquityCurve(positions) {
  const canvas = $('equity-curve');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const closed = positions.filter(p=>p.pnl_percent!==undefined && p.status!=='open');
  if (closed.length<2) {
    ctx.fillStyle='#4a5a7a'; ctx.font='12px Inter'; ctx.textAlign='center';
    ctx.fillText('Se necesitan al menos 2 trades cerrados',W/2,H/2); return;
  }
  const sorted = closed.sort((a,b)=>(a.closed_at||a.timestamp||'').localeCompare(b.closed_at||b.timestamp||''));
  let cum=0;
  const curve = sorted.map(p=>{cum+=(p.pnl_percent||0);return cum});
  const pad=25,cw=W-pad*2,ch=H-pad*2;
  const max=Math.max(...curve.map(Math.abs),1),mid=pad+ch/2;
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=pad+(ch/4)*i;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke()}
  ctx.beginPath();
  curve.forEach((v,i)=>{const x=pad+(i/Math.max(curve.length-1,1))*cw,y=mid-(v/max)*(ch/2);i===0?ctx.moveTo(x,mid):ctx.lineTo(x,y)});
  const lx=pad+cw,ly=mid-(curve[curve.length-1]/max)*(ch/2);
  ctx.lineTo(lx,ly);ctx.lineTo(lx,mid);ctx.closePath();
  const g=ctx.createLinearGradient(0,pad,0,pad+ch),pos=curve[curve.length-1]>=0;
  g.addColorStop(0,pos?'rgba(0,214,143,0.15)':'rgba(247,82,90,0.15)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();
  curve.forEach((v,i)=>{const x=pad+(i/Math.max(curve.length-1,1))*cw,y=mid-(v/max)*(ch/2);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});
  ctx.strokeStyle=pos?'#00d68f':'#f7525a';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(pad,mid);ctx.lineTo(W-pad,mid);ctx.stroke();ctx.setLineDash([]);
  const last=curve[curve.length-1];
  ctx.fillStyle=pos?'#00d68f':'#f7525a';ctx.font='bold 13px JetBrains Mono';ctx.textAlign='right';
  ctx.fillText(`${last>=0?'+':''}${last.toFixed(2)}%`,W-pad,pad+16);
}

// ─── ASSET BREAKDOWN ────────────────────
function renderAssetBreakdown(signals) {
  const tbody = $('asset-tbody');
  const atbody = $('analytics-asset-tbody');
  const blqbody = $('analytics-bloque-tbody');
  const closed = signals.filter(s=>s.status!=='open'&&s.status!=='pending'&&s.pnl_percent!==undefined);
  if(!closed.length){
    if(tbody)tbody.innerHTML='<tr class="empty"><td colspan="4">Sin datos</td></tr>';
    if(atbody)atbody.innerHTML='<tr class="empty"><td colspan="7">Cargando...</td></tr>';
    if(blqbody)blqbody.innerHTML='<tr class="empty"><td colspan="6">Cargando...</td></tr>';
    return;
  }
  const by={}, byBlock={};
  closed.forEach(p=>{
    const t=p.ticker||p.pair||'?';
    if(!by[t])by[t]={trades:0,wins:0,pnl:0};
    by[t].trades++;if(p.pnl_percent>0)by[t].wins++;by[t].pnl+=p.pnl_percent;
    const bl = p.bloque || 'General';
    if(!byBlock[bl])byBlock[bl]={trades:0,wins:0,pnl:0};
    byBlock[bl].trades++;if(p.pnl_percent>0)byBlock[bl].wins++;byBlock[bl].pnl+=p.pnl_percent;
  });
  const sorted=Object.entries(by).sort((a,b)=>b[1].pnl-a[1].pnl);
  if(tbody)tbody.innerHTML=sorted.map(([t,d])=>`<tr><td>${t}</td><td>${d.trades}</td><td>${d.trades>0?(d.wins/d.trades*100).toFixed(1):'0'}%</td><td class="${d.pnl>=0?'green':'red'}">${d.pnl>=0?'+':''}${d.pnl.toFixed(2)}%</td></tr>`).join('');
  if(atbody)atbody.innerHTML=sorted.map(([t,d])=>{
    const wr=(d.wins/d.trades*100).toFixed(1);
    const bl=closed.find(p=>(p.ticker||p.pair)===t)?.bloque||'--';
    return `<tr><td><strong>${t}</strong></td><td>${d.trades}</td><td class="green">${d.wins}</td><td class="red">${d.trades-d.wins}</td><td>${wr}%</td><td class="${d.pnl>=0?'green':'red'}">${d.pnl>=0?'+':''}${d.pnl.toFixed(2)}%</td><td class="text-dim">${bl}</td></tr>`;
  }).join('');
  if(blqbody)blqbody.innerHTML=Object.entries(byBlock).sort((a,b)=>b[1].pnl-a[1].pnl).map(([bl,d])=>{
    const wr=d.trades>0?(d.wins/d.trades*100).toFixed(1):'0';
    return `<tr><td><strong>${bl}</strong></td><td>${d.trades}</td><td class="green">${d.wins}</td><td class="red">${d.trades-d.wins}</td><td>${wr}%</td><td class="${d.pnl>=0?'green':'red'}">${d.pnl>=0?'+':''}${d.pnl.toFixed(2)}%</td></tr>`;
  }).join('');
}

// ─── ACCOUNT SUMMARY ─────────────────────
function renderAccount(signals) {
  const balance = 1000;
  const open = signals.filter(s=>s.status==='open'||s.status==='active');
  const exposure = open.reduce((s,p)=>s+(p.entry||0)*(p.quantity||0.001),0);
  const margin = Math.min(exposure/balance*100,100);
  const closed = signals.filter(s=>s.status!=='open'&&s.status!=='pending'&&s.pnl_percent!==undefined);
  const upl = open.reduce((s,p)=>s+((p.pnl_percent||0)/100*(p.entry||0)*(p.quantity||0.001)),0);

  $('acct-balance').textContent = `$${balance.toFixed(2)}`;
  $('acct-equity').textContent = `$${(balance+upl).toFixed(2)}`;
  $('acct-margin').textContent = `$${exposure.toFixed(2)}`;
  $('acct-available').textContent = `$${Math.max(0,balance-exposure).toFixed(2)}`;
  $('acct-upl').textContent = `${upl>=0?'+':''}$${upl.toFixed(2)}`;
  $('acct-upl').className = `ar-val ${upl>=0?'green':'red'}`;
  $('acct-positions').textContent = open.length;
  $('acct-progress-fill').style.width = `${margin}%`;
  $('acct-margin-pct').textContent = margin.toFixed(0);

  if ($('topbar-margin')) $('topbar-margin').textContent = `${margin.toFixed(0)}%`;

  const wins = closed.filter(p=>p.pnl_percent>0).length;
  const totalPnl = closed.reduce((s,p)=>s+(p.pnl_percent||0),0);
  const gp = closed.filter(p=>p.pnl_percent>0).reduce((s,p)=>s+p.pnl_percent,0);
  const gl = Math.abs(closed.filter(p=>p.pnl_percent<0).reduce((s,p)=>s+p.pnl_percent,0));
  const pf = gl>0?gp/gl:(gp>0?gp:0);
  const wr = closed.length>0?(wins/closed.length*100):0;
  const returns = closed.map(p=>p.pnl_percent);
  const avgR = returns.length>0?returns.reduce((a,b)=>a+b,0)/returns.length:0;
  const std = returns.length>1?Math.sqrt(returns.reduce((s,r)=>s+(r-avgR)**2,0)/returns.length):0;
  const sharpe = std>0?avgR/std:0;

  $('dash-wr').textContent = `${wr.toFixed(1)}%`;
  $('dash-wr').className = `si-val ${wr>=50?'green':'red'}`;
  $('dash-pf').textContent = pf.toFixed(2);
  $('dash-trades').textContent = closed.length;
  $('dash-sharpe').textContent = sharpe.toFixed(2);
  $('dash-pnl').textContent = `${totalPnl>=0?'+':''}$${totalPnl.toFixed(2)}`;
  $('dash-pnl').className = `si-val big ${totalPnl>=0?'green':'red'}`;

  if ($('topbar-daypnl')) {
    $('topbar-daypnl').textContent = `${totalPnl>=0?'+':''}$${totalPnl.toFixed(2)}`;
    $('topbar-daypnl').className = `stat-val ${totalPnl>=0?'green':'red'}`;
  }

  // Analytics metrics
  $('metric-signals').textContent = closed.length;
  $('metric-wr').textContent = `${wr.toFixed(1)}%`;
  $('metric-pf').textContent = pf.toFixed(2);
  $('metric-pnl').textContent = `${totalPnl>=0?'+':''}${totalPnl.toFixed(2)}%`;
  $('metric-pnl').className = `m-value ${totalPnl>=0?'green':'red'}`;
  $('metric-wins').textContent = wins;
  $('metric-losses').textContent = closed.length-wins;

  // Weekly
  const weekClosed = closed.filter(p=>Date.now()-new Date(p.closed_at||p.timestamp||Date.now()).getTime()<7*86400000);
  const weekWins = weekClosed.filter(p=>p.pnl_percent>0).length;
  const weekPnl = weekClosed.reduce((s,p)=>s+(p.pnl_percent||0),0);
  const weekPf = calcPf(weekClosed);
  $('pw-trades').textContent = weekClosed.length;
  $('pw-wr').textContent = weekClosed.length>0?(weekWins/weekClosed.length*100).toFixed(1)+'%':'0%';
  $('pw-pnl').textContent = `${weekPnl>=0?'+':''}${weekPnl.toFixed(2)}%`;
  $('pw-pnl').className = weekPnl>=0?'green':'';

  // Monthly
  const monClosed = closed.filter(p=>Date.now()-new Date(p.closed_at||p.timestamp||Date.now()).getTime()<30*86400000);
  const monWins = monClosed.filter(p=>p.pnl_percent>0).length;
  const monPnl = monClosed.reduce((s,p)=>s+(p.pnl_percent||0),0);
  const monPf = calcPf(monClosed);
  $('pm-trades').textContent = monClosed.length;
  $('pm-wr').textContent = monClosed.length>0?(monWins/monClosed.length*100).toFixed(1)+'%':'0%';
  $('pm-pnl').textContent = `${monPnl>=0?'+':''}${monPnl.toFixed(2)}%`;
  $('pm-pnl').className = monPnl>=0?'green':'';

  // Reports tab metrics
  renderReports(closed, totalPnl, wr, pf, sharpe);
  updateConsensusMetrics(closed);
}

function calcPf(list) {
  const gp = list.filter(p=>p.pnl_percent>0).reduce((s,p)=>s+p.pnl_percent,0);
  const gl = Math.abs(list.filter(p=>p.pnl_percent<0).reduce((s,p)=>s+p.pnl_percent,0));
  return gl>0?gp/gl:(gp>0?999:0);
}

// ─── REPORTS ────────────────────────────
function renderReports(closed, totalPnl, wr, pf, sharpe) {
  const now = Date.now();
  const weekTrades = closed.filter(p => now - new Date(p.closed_at || p.timestamp || now).getTime() < 7*86400000);
  const monthTrades = closed.filter(p => now - new Date(p.closed_at || p.timestamp || now).getTime() < 30*86400000);

  const weekPnl = weekTrades.reduce((s,p)=>s+(p.pnl_percent||0),0);
  const weekWins = weekTrades.filter(p=>p.pnl_percent>0).length;
  const monthPnl = monthTrades.reduce((s,p)=>s+(p.pnl_percent||0),0);
  const monthWins = monthTrades.filter(p=>p.pnl_percent>0).length;

  // Find max drawdown
  let cum=0, peak=0, mdd=0;
  const sorted = [...closed].sort((a,b)=>(a.closed_at||a.timestamp||'').localeCompare(b.closed_at||b.timestamp||''));
  sorted.forEach(p => { cum += (p.pnl_percent||0); if(cum>peak)peak=cum; if(cum<peak) mdd=Math.max(mdd, (peak-cum)/Math.max(peak,1)*100); });

  if($('report-week-date')) $('report-week-date').textContent = new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short'});
  if($('report-month-date')) $('report-month-date').textContent = new Date().toLocaleDateString('es-ES',{month:'long',year:'numeric'});

  if($('r-week-trades')) $('r-week-trades').textContent = weekTrades.length;
  if($('r-week-wr')) { $('r-week-wr').textContent = weekTrades.length>0?(weekWins/weekTrades.length*100).toFixed(1)+'%':'0%'; }
  if($('r-week-pf')) $('r-week-pf').textContent = calcPf(weekTrades).toFixed(2);
  if($('r-week-pnl')) { $('r-week-pnl').textContent = `${weekPnl>=0?'+':''}${weekPnl.toFixed(2)}%`; }

  if($('r-month-trades')) $('r-month-trades').textContent = monthTrades.length;
  if($('r-month-wr')) { $('r-month-wr').textContent = monthTrades.length>0?(monthWins/monthTrades.length*100).toFixed(1)+'%':'0%'; }
  if($('r-month-pf')) $('r-month-pf').textContent = calcPf(monthTrades).toFixed(2);
  if($('r-month-pnl')) { $('r-month-pnl').textContent = `${monthPnl>=0?'+':''}${monthPnl.toFixed(2)}%`; }

  if($('r-all-trades')) $('r-all-trades').textContent = closed.length;
  if($('r-all-wr')) $('r-all-wr').textContent = `${wr.toFixed(1)}%`;
  if($('r-all-pf')) $('r-all-pf').textContent = pf.toFixed(2);
  if($('r-all-sharpe')) $('r-all-sharpe').textContent = sharpe.toFixed(2);
  if($('r-all-mdd')) { $('r-all-mdd').textContent = `${mdd.toFixed(2)}%`; }
  if($('r-all-pnl')) { $('r-all-pnl').textContent = `${totalPnl>=0?'+':''}${totalPnl.toFixed(2)}%`; }
}

// ─── CONSENSUS METRICS ──────────────────
function updateConsensusMetrics(closed) {
  const total = closed.length;
  const wins = closed.filter(p=>p.pnl_percent>0).length;
  const losses = total - wins;
  const approved = wins; // Approved by consensus = wins
  const rejected = losses; // Rejected = losses
  const rate = total>0 ? (wins/total*100) : 0;

  if($('consensus-signals')) $('consensus-signals').textContent = total;
  if($('consensus-approved')) $('consensus-approved').textContent = approved;
  if($('consensus-rejected')) $('consensus-rejected').textContent = rejected;
  if($('consensus-rate')) $('consensus-rate').textContent = `${rate.toFixed(1)}%`;
}

// ─── LIVE PRICE UPDATES ─────────────────
let lastPnl = {};
function startLivePriceUpdates(signals) {
  const open = signals.filter(s=>s.status==='open'||s.status==='active');
  open.forEach(async p=>{
    const ticker = p.ticker||p.pair;
    if(!ticker) return;
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1m`);
      const d = await r.json();
      const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if(!price) return;
      const pnlPct = p.direction==='BUY'?((price-p.entry)/p.entry*100):((p.entry-price)/p.entry*100);
      const pnlAbs = pnlPct/100 * p.entry * p.quantity;
      const pe = $(`pr-${p.id||''}`);
      const pn = $(`pn-${p.id||''}`);
      if(pe) pe.textContent=`$${price.toFixed(4)}`;
      if(pn){
        const old = lastPnl[p.id];
        const pnlStr = `${pnlPct>=0?'+':''}${pnlPct.toFixed(2)}%`;
        pn.textContent = pnlStr;
        pn.className = pnlPct>=0?'green':'red';
        if (old !== undefined && old !== pnlPct) {
          pn.classList.add(pnlPct>old?'flash-up':'flash-down');
          setTimeout(()=>pn.classList.remove('flash-up','flash-down'), 600);
        }
        lastPnl[p.id] = pnlPct;
      }
      const totalUpl = open.reduce((s,o)=>{
        const l = lastPnl[o.id]||0;
        return s + l/100 * o.entry * o.quantity;
      }, 0);
      if ($('topbar-daypnl')) {
        $('topbar-daypnl').textContent = `${totalUpl>=0?'+':''}$${totalUpl.toFixed(2)}`;
        $('topbar-daypnl').className = `stat-val ${totalUpl>=0?'green':'red'}`;
      }
      if ($('acct-upl')) {
        $('acct-upl').textContent = `${totalUpl>=0?'+':''}$${totalUpl.toFixed(2)}`;
        $('acct-upl').className = `ar-val ${totalUpl>=0?'green':'red'}`;
      }
      if ($('acct-equity')) {
        $('acct-equity').textContent = `$${(1000+totalUpl).toFixed(2)}`;
        $('acct-equity').className = `eq-val ${totalUpl>=0?'green':'red'}`;
      }
    } catch {}
  });
}

// ─── FETCH SIGNALS ──────────────────────
async function fetchSignals() {
  try {
    const res = await fetch(SIGNALS_URL + '&t=' + new Date().getTime());
    if (!res.ok) throw new Error('HTTP '+res.status);
    const signals = await res.json();
    allPositions = (Array.isArray(signals)?signals:[]).map(norm);
    renderPositions(allPositions);
    renderHistory(allPositions);
    renderOrders(allPositions);
    renderTradeFeed(allPositions);
    renderAssetBreakdown(allPositions);
    renderAccount(allPositions);
    drawEquityCurve(allPositions);
    startLivePriceUpdates(allPositions);
    // Trigger pair selector refresh if pair is selected
    if ($('pair-select')) $('pair-select').dispatchEvent(new Event('change'));
    
    // Fetch System Health
    if (typeof fetchHealthData === 'function') {
      fetchHealthData();
    }
  } catch(err) { console.error(err); }
}

// ─── INIT ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  updateTicker();
  updateMarketGrid();
  fetchSignals();
  initTabs();
  initPairSelector();
  setInterval(updateClock, 1000);
  setInterval(updateTicker, 60000);
  setInterval(updateMarketGrid, 30000);
  setInterval(fetchSignals, 30000);
});
