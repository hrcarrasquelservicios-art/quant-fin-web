import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const signalsContainer = document.getElementById('signals-container');
  const lastUpdateEl = document.getElementById('last-update');

  // Función para obtener señales y renderizarlas
  async function fetchSignals() {
    try {
      // En producción leerá de /live_signals.json, para dev usamos la misma ruta local
      const res = await fetch('/live_signals.json');
      if (!res.ok) throw new Error("No se pudo cargar las señales");
      
      const signals = await res.json();
      renderSignals(signals);
      
      // Actualizar hora
      const now = new Date();
      lastUpdateEl.textContent = now.toLocaleTimeString('es-ES', { hour12: false });
    } catch (err) {
      console.error("Error fetching signals:", err);
      // Solo en caso de error crítico
      lastUpdateEl.textContent = "ERROR";
      lastUpdateEl.classList.add("text-red");
    }
  }

  function renderSignals(signals) {
    signalsContainer.innerHTML = ''; // Limpiar contenedor
    
    signals.forEach(sig => {
      const isLong = sig.type.toUpperCase() === 'LONG';
      const statusClass = sig.status.toUpperCase() === 'ACTIVE' ? 'status-active' : 'status-closed';
      
      let pnlHtml = '';
      if (sig.pnl_percent !== undefined) {
        const pnlColor = sig.pnl_percent > 0 ? 'text-green' : 'text-red';
        const pnlSign = sig.pnl_percent > 0 ? '+' : '';
        pnlHtml = `<span class="${pnlColor}">${pnlSign}${sig.pnl_percent}%</span>`;
      } else {
        pnlHtml = `<span class="text-muted">En progreso</span>`;
      }

      const html = `
        <div class="signal-card ${isLong ? 'long' : 'short'}">
          <div class="signal-header">
            <span class="pair">${sig.pair}</span>
            <span class="type ${isLong ? 'long' : 'short'}">${sig.type}</span>
          </div>
          
          <div class="signal-body">
            <div class="data-point">
              <span class="data-label">ENTRY</span>
              <span class="data-val">${sig.entry}</span>
            </div>
            <div class="data-point">
              <span class="data-label">TARGET</span>
              <span class="data-val text-green">${sig.target1}</span>
            </div>
            <div class="data-point">
              <span class="data-label">STOP LOSS</span>
              <span class="data-val text-red">${sig.stopLoss}</span>
            </div>
            <div class="data-point">
              <span class="data-label">PNL</span>
              <span class="data-val">${pnlHtml}</span>
            </div>
          </div>
          
          <div class="signal-footer">
            <span class="status-badge ${statusClass}">${sig.status}</span>
            <span class="timestamp">${new Date(sig.timestamp).toLocaleString('es-ES')}</span>
          </div>
        </div>
      `;
      signalsContainer.insertAdjacentHTML('beforeend', html);
    });
  }

  // Primera carga
  fetchSignals();

  // Polling cada 30 segundos
  setInterval(fetchSignals, 30000);
});
