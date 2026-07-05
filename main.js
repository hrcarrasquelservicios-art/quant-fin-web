import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const signalsRealContainer = document.getElementById('signals-real-container');
  const signalsDemoContainer = document.getElementById('signals-demo-container');
  const lastUpdateEl = document.getElementById('last-update');

  // Función para obtener señales y renderizarlas
  async function fetchSignals() {
    try {
      // Intentar cargar de equity_signals.json
      let res = await fetch('https://raw.githubusercontent.com/hrcarrasquelservicios-art/quant-fin-web/main/public/equity_signals.json');
      if (!res.ok) {
        // Fallback a live_signals.json
        res = await fetch('https://raw.githubusercontent.com/hrcarrasquelservicios-art/quant-fin-web/main/public/live_signals.json');
      }
      if (!res.ok) throw new Error("No se pudo cargar el archivo de señales");
      
      const signals = await res.json();
      renderSignals(signals);
      
      // Actualizar hora
      const now = new Date();
      lastUpdateEl.textContent = now.toLocaleTimeString('es-ES', { hour12: false });
    } catch (err) {
      console.error("Error fetching signals:", err);
      lastUpdateEl.textContent = "ERROR";
      lastUpdateEl.classList.add("text-red");
    }
  }

  function renderSignals(signals) {
    // Limpiar ambos contenedores
    signalsRealContainer.innerHTML = '';
    signalsDemoContainer.innerHTML = '';
    
    let realCount = 0;
    let demoCount = 0;

    signals.forEach(sig => {
      const isLong = sig.type?.toUpperCase() === 'LONG' || sig.direction?.toUpperCase() === 'BUY';
      const statusClass = sig.status?.toUpperCase() === 'ACTIVE' || sig.status?.toUpperCase() === 'OPEN' ? 'status-active' : 'status-closed';
      const pair = sig.pair || sig.activo || sig.asset?.ticker || 'BTC-USD';
      const entry = sig.entry || sig.precioActual || sig.precio_entrada || 0;
      const target = sig.target1 || (sig.takeProfits && sig.takeProfits[0]?.price) || 0;
      const stopLoss = sig.stopLoss?.price || sig.stopLoss || sig.sl || 0;
      const status = sig.status || 'open';
      const typeLabel = isLong ? 'BUY' : 'SELL';

      let pnlHtml = '';
      const pnlPercent = sig.pnl_percent !== undefined ? sig.pnl_percent : (sig.result?.pnlPercent);
      if (pnlPercent !== undefined) {
        const pnlColor = pnlPercent > 0 ? 'text-green' : 'text-red';
        const pnlSign = pnlPercent > 0 ? '+' : '';
        pnlHtml = `<span class="${pnlColor}">${pnlSign}${pnlPercent}%</span>`;
      } else {
        pnlHtml = `<span class="text-muted">En progreso</span>`;
      }

      const html = `
        <div class="signal-card ${isLong ? 'long' : 'short'}">
          <div class="signal-header">
            <span class="pair">${pair}</span>
            <span class="type ${isLong ? 'long' : 'short'}">${typeLabel}</span>
          </div>
          
          <div class="signal-body">
            <div class="data-point">
              <span class="data-label">ENTRY</span>
              <span class="data-val">${entry}</span>
            </div>
            <div class="data-point">
              <span class="data-label">TARGET</span>
              <span class="data-val text-green">${target}</span>
            </div>
            <div class="data-point">
              <span class="data-label">STOP LOSS</span>
              <span class="data-val text-red">${stopLoss}</span>
            </div>
            <div class="data-point">
              <span class="data-label">PNL</span>
              <span class="data-val">${pnlHtml}</span>
            </div>
          </div>
          
          <div class="signal-footer">
            <span class="status-badge ${statusClass}">${status}</span>
            <span class="timestamp">${new Date(sig.timestamp || sig.fecha_hora || Date.now()).toLocaleString('es-ES')}</span>
          </div>
        </div>
      `;

      const isReal = sig.mode?.toUpperCase() === 'REAL' || sig.executionType?.toUpperCase() === 'REAL';
      if (isReal) {
        signalsRealContainer.insertAdjacentHTML('beforeend', html);
        realCount++;
      } else {
        signalsDemoContainer.insertAdjacentHTML('beforeend', html);
        demoCount++;
      }
    });

    if (realCount === 0) {
      signalsRealContainer.innerHTML = '<div class="no-signals" style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px;"><p class="text-muted" style="margin: 0; font-size: 0.95rem;">Esperando señales en vivo — El motor de ejecución real se encuentra en fase de activación.</p></div>';
    }
    if (demoCount === 0) {
      signalsDemoContainer.innerHTML = '<div class="no-signals" style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px;"><p class="text-muted" style="margin: 0; font-size: 0.95rem;">Sistema en fase de activación — Las señales de validación pública (DEMO) se publicarán en breve.</p></div>';
    }
  }

  // Función para obtener y renderizar tasas de cambio
  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://raw.githubusercontent.com/hrcarrasquelservicios-art/quant-fin-web/main/public/exchange_rates.json');
      if (!res.ok) throw new Error("No se pudo cargar las tasas de cambio");
      const data = await res.json();
      
      document.getElementById('rates-timestamp').textContent = data.timestamp;
      document.getElementById('rate-bcv-usd').textContent = `Bs. ${data.bcv_usd.toFixed(2)}`;
      document.getElementById('rate-bcv-eur').textContent = `Bs. ${data.bcv_eur.toFixed(2)}`;
      document.getElementById('rate-paralelo').textContent = `Bs. ${data.paralelo.toFixed(2)}`;
      document.getElementById('rate-usdt').textContent = `Bs. ${data.usdt.toFixed(2)}`;
      document.getElementById('rate-cop').textContent = `Bs. ${data.cop.toFixed(4)}`;
      document.getElementById('rate-clp').textContent = `Bs. ${data.clp.toFixed(4)}`;
    } catch (err) {
      console.error("Error fetching exchange rates:", err);
    }
  }

  // Primera carga
  fetchSignals();
  fetchExchangeRates();

  // Polling cada 30 segundos
  setInterval(fetchSignals, 30000);
  setInterval(fetchExchangeRates, 60000); // Tasas de cambio se actualizan cada minuto
});
