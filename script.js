// ===== STATE =====
let isActive = false;
let isUnlimited = false;
let startTime = 0;
let totalBytesWasted = 0;
let currentSpeedBps = 0;
let peakSpeedBps = 0;
let threads = 3;
let sessionTimer = null;
let speedHistory = [];

// ===== URLS (Fast CDN sources) =====
const TEST_URLS = [
    'https://cachefly.cachefly.net/100mb.test',
    'https://cachefly.cachefly.net/10mb.test',
];

// ===== DOM REFS =====
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusEl = document.getElementById('global-status');
const statusText = statusEl.querySelector('.status-text');
const totalDataEl = document.getElementById('total-data');
const totalUnitEl = document.getElementById('total-unit');
const currentSpeedEl = document.getElementById('current-speed');
const peakSpeedEl = document.getElementById('peak-speed');
const elapsedTimeEl = document.getElementById('elapsed-time');
const threadRange = document.getElementById('thread-range');
const threadCountEl = document.getElementById('thread-count');
const canvas = document.getElementById('speed-chart');
const ctx = canvas.getContext('2d');

// ===== CANVAS INIT =====
function initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}

window.addEventListener('resize', () => {
    initCanvas();
    drawChart();
});
initCanvas();

// ===== DOWNLOAD ENGINE =====
async function downloadChunk() {
    if (!isActive) return;
    const url = TEST_URLS[0] + '?r=' + Math.random();

    try {
        const response = await fetch(url, {
            cache: 'no-store',
            mode: 'cors',
        });
        const reader = response.body.getReader();
        let lastTime = performance.now();
        let window_bytes = 0;

        while (isActive) {
            const { done, value } = await reader.read();
            if (done) break;

            const len = value.length;
            totalBytesWasted += len;
            window_bytes += len;

            const now = performance.now();
            const elapsed_s = (now - lastTime) / 1000;
            if (elapsed_s >= 0.2) {
                currentSpeedBps = (window_bytes * 8) / elapsed_s;
                window_bytes = 0;
                lastTime = now;
            }
        }
    } catch (_) { /* silent retry */ }

    if (isActive) downloadChunk();
}

// ===== UI UPDATE LOOP =====
function updateUI() {
    if (!isActive) return;

    // Total data
    const mb = totalBytesWasted / (1024 * 1024);
    const gb = mb / 1024;
    if (gb >= 1) {
        totalDataEl.textContent = gb.toFixed(2);
        totalUnitEl.textContent = 'GB';
    } else {
        totalDataEl.textContent = mb.toFixed(2);
        totalUnitEl.textContent = 'MB';
    }

    // Speed
    const mbps = currentSpeedBps / 1_000_000;
    currentSpeedEl.textContent = mbps.toFixed(2);
    speedHistory.push(mbps);
    if (speedHistory.length > 80) speedHistory.shift();

    // Peak
    if (currentSpeedBps > peakSpeedBps) {
        peakSpeedBps = currentSpeedBps;
        peakSpeedEl.textContent = (peakSpeedBps / 1_000_000).toFixed(2);
    }

    // Timer
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    elapsedTimeEl.textContent = `${h}:${m}:${s}`;

    drawChart();
}

// ===== CHART =====
function drawChart() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);
    if (speedHistory.length < 2) {
        drawGrid(W, H);
        return;
    }

    drawGrid(W, H);

    const max = Math.max(...speedHistory, 5);
    const step = W / (speedHistory.length - 1);

    // Fill
    ctx.beginPath();
    speedHistory.forEach((v, i) => {
        const x = i * step;
        const y = H - (v / max) * (H - 10) - 5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo((speedHistory.length - 1) * step, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, H);
    fill.addColorStop(0, 'rgba(251,191,36,0.25)');
    fill.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = fill;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    speedHistory.forEach((v, i) => {
        const x = i * step;
        const y = H - (v / max) * (H - 10) - 5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Glow on last point
    const lx = (speedHistory.length - 1) * step;
    const ly = H - (speedHistory[speedHistory.length - 1] / max) * (H - 10) - 5;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawGrid(W, H) {
    ctx.strokeStyle = 'rgba(251,191,36,0.06)';
    ctx.lineWidth = 1;
    const rows = 4;
    for (let i = 0; i <= rows; i++) {
        const y = (H / rows) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
}

// ===== MODE TOGGLE =====
window.setMode = function(mode) {
    isUnlimited = mode === 'unlimited';
    document.getElementById('mode-normal').classList.toggle('active', !isUnlimited);
    document.getElementById('mode-unlimited').classList.toggle('active', isUnlimited);

    if (isActive) {
        if (isUnlimited) {
            document.body.classList.add('extreme');
            statusEl.className = 'status-pill extreme';
            statusText.textContent = 'EXTREME';
            for (let i = 0; i < 40; i++) downloadChunk();
        } else {
            document.body.classList.remove('extreme');
            statusEl.className = 'status-pill active';
            statusText.textContent = 'WASTING';
        }
    }
};

// ===== CONTROLS =====
threadRange.addEventListener('input', (e) => {
    threads = parseInt(e.target.value);
    threadCountEl.textContent = threads;
});

startBtn.addEventListener('click', () => {
    isActive = true;
    startTime = Date.now();
    totalBytesWasted = 0;
    peakSpeedBps = 0;
    speedHistory = [];
    currentSpeedEl.textContent = '0.00';
    peakSpeedEl.textContent = '0.00';
    totalDataEl.textContent = '0.00';
    totalUnitEl.textContent = 'MB';
    elapsedTimeEl.textContent = '00:00:00';

    startBtn.disabled = true;
    stopBtn.disabled = false;

    const threadCount = isUnlimited ? 60 : threads;
    for (let i = 0; i < threadCount; i++) downloadChunk();

    document.body.classList.add('running');
    if (isUnlimited) {
        document.body.classList.add('extreme');
        statusEl.className = 'status-pill extreme';
        statusText.textContent = 'EXTREME';
    } else {
        statusEl.className = 'status-pill active';
        statusText.textContent = 'WASTING';
    }

    sessionTimer = setInterval(updateUI, 500);
});

stopBtn.addEventListener('click', () => {
    isActive = false;
    clearInterval(sessionTimer);

    startBtn.disabled = false;
    stopBtn.disabled = true;

    document.body.classList.remove('running', 'extreme');
    statusEl.className = 'status-pill';
    statusText.textContent = 'STOPPED';
    currentSpeedBps = 0;
    currentSpeedEl.textContent = '0.00';
});
