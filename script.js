// State Management
let isActive = false;
let startTime = 0;
let totalBytesWasted = 0;
let currentSpeedBps = 0;
let peakSpeedBps = 0;
let threads = 3;
let targetSizeMB = 50;
let sessionTimer = null;
let speedHistory = [];
let sessionHistory = JSON.parse(localStorage.getItem('dw_sessions') || '[]');
let isUnlimited = false;

// DOM Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const globalStatus = document.getElementById('global-status');
const totalDataEl = document.getElementById('total-data');
const currentSpeedEl = document.getElementById('current-speed');
const elapsedTimeEl = document.getElementById('elapsed-time');
const threadRange = document.getElementById('thread-range');
const threadCountLabel = document.getElementById('thread-count');
const fileSizeSelect = document.getElementById('file-size');
const canvas = document.getElementById('speed-chart');
const ctx = canvas.getContext('2d');

// Constants
const TEST_URLS = [
    'https://cachefly.cachefly.net/100mb.test',
    'https://cachefly.cachefly.net/10mb.test',
    'https://cachefly.cachefly.net/100mb.test' // Duplicate as fallback
];

// Initialize Canvas
function initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
}
window.addEventListener('resize', initCanvas);
initCanvas();

// Logic
async function downloadChunk() {
    if (!isActive) return;

    // We use CacheFly as it's one of the fastest global CDNs
    const url = `${TEST_URLS[0]}?cb=${Math.random()}`;
    
    try {
        const controller = new AbortController();
        const response = await fetch(url, { 
            cache: 'no-store',
            signal: controller.signal,
            mode: 'cors'
        });
        
        const reader = response.body.getReader();
        
        while (isActive) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const len = value.length;
            totalBytesWasted += len;
            
            // Speed calculation using a moving window
            const now = performance.now();
            currentSpeedBps = (len * 8) / 0.1; // Estimate for UI smoothness
        }
    } catch (error) {
        // Silently retry to maintain speed
    }

    if (isActive) {
        // Immediate recursion for zero downtime
        downloadChunk();
    }
}

function updateUI() {
    if (!isActive) return;

    // Update Data Wasted
    const mbWasted = totalBytesWasted / (1024 * 1024);
    const gbWasted = mbWasted / 1024;
    
    if (gbWasted > 1) {
        totalDataEl.innerHTML = `${gbWasted.toFixed(2)} <span class="unit">GB</span>`;
    } else {
        totalDataEl.innerHTML = `${mbWasted.toFixed(2)} <span class="unit">MB</span>`;
    }

    // Update Speed
    const mbps = (currentSpeedBps / 1000000);
    currentSpeedEl.innerHTML = `${mbps.toFixed(2)} <span class="unit">Mbps</span>`;
    
    if (currentSpeedBps > peakSpeedBps) {
        peakSpeedBps = currentSpeedBps;
        const peakMbps = (peakSpeedBps / 1000000).toFixed(2);
        document.getElementById('peak-speed').innerHTML = `${peakMbps} <span class="unit">Mbps</span>`;
    }
    
    speedHistory.push(mbps);
    if (speedHistory.length > 100) speedHistory.shift();

    // Update Time
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    elapsedTimeEl.textContent = `${h}:${m}:${s}`;

    drawChart();
}

function drawChart() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);
    if (speedHistory.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#00f2ff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    const step = width / (speedHistory.length - 1);
    const maxSpeed = Math.max(...speedHistory, 50);
    
    speedHistory.forEach((speed, i) => {
        const x = i * step;
        const y = height - (speed / maxSpeed) * (height - 30) - 15;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 242, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 242, 255, 0)');
    
    ctx.stroke();
    
    ctx.lineTo((speedHistory.length - 1) * step, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = gradient;
    ctx.fill();
}

// Event Listeners
startBtn.addEventListener('click', () => {
    isActive = true;
    startTime = Date.now();
    totalBytesWasted = 0;
    speedHistory = [];
    peakSpeedBps = 0;
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    globalStatus.textContent = isUnlimited ? 'EXTREME WASTING...' : 'WASTING DATA...';
    globalStatus.classList.add('active');
    
    if (isUnlimited) {
        document.body.classList.add('unlimited-active');
        threads = 60; // Extreme concurrency for gigabit connections
    } else {
        threads = parseInt(threadRange.value);
    }

    for (let i = 0; i < threads; i++) {
        downloadChunk();
    }

    sessionTimer = setInterval(updateUI, 1000);
});

stopBtn.addEventListener('click', () => {
    isActive = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    globalStatus.textContent = 'SESSION STOPPED';
    globalStatus.classList.remove('active');
    document.body.classList.remove('unlimited-active');
    clearInterval(sessionTimer);
    currentSpeedBps = 0;
    currentSpeedEl.innerHTML = `0.00 <span class="unit">Mbps</span>`;
});

document.getElementById('unlimited-mode').addEventListener('change', (e) => {
    isUnlimited = e.target.checked;
    if (isActive && isUnlimited) {
        document.body.classList.add('unlimited-active');
        globalStatus.textContent = 'EXTREME WASTING...';
        // Add even more threads immediately for instant spike
        for (let i = 0; i < 40; i++) {
            downloadChunk();
        }
    } else if (!isUnlimited) {
        document.body.classList.remove('unlimited-active');
        if (isActive) globalStatus.textContent = 'WASTING DATA...';
    }
});

threadRange.addEventListener('input', (e) => {
    threadCountLabel.textContent = `${e.target.value} Threads`;
    if (isActive) {
        const newThreads = parseInt(e.target.value);
        if (newThreads > threads) {
            for (let i = 0; i < newThreads - threads; i++) {
                downloadChunk();
            }
        }
        threads = newThreads;
    }
});

fileSizeSelect.addEventListener('change', (e) => {
    targetSizeMB = parseInt(e.target.value);
});
