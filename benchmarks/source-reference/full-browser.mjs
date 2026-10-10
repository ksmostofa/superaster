/** Separate research page. Never included in the application. */
const run = document.querySelector('#run');
const cancel = document.querySelector('#cancel');
const output = document.querySelector('#output');
const investigationBoundMs = 600_000;
let worker, timer, used = false, latest = { status: 'READY', last_stage: 'idle' };
const urls = [];
function saveLink(id, data, type) {
  const link = document.querySelector(id);
  const url = URL.createObjectURL(new Blob([data], { type }));
  urls.push(url); link.href = url; link.hidden = false;
}
function finish(report, raw) {
  clearTimeout(timer); worker?.terminate(); worker = undefined;
  cancel.disabled = true;
  latest = report;
  output.textContent = JSON.stringify(report, null, 2);
  window.superasterFullModelProbe = report;
  saveLink('#report-download', output.textContent, 'application/json');
  if (raw) saveLink('#raw-download', raw, 'application/octet-stream');
}
function stop(status, reason) {
  finish({ ...latest, status, reason, execution_completed: false,
    numerical_acceptance: 'NOT AWARDED', quality: 'NOT AWARDED',
    termination: 'Dedicated worker terminated; no retry', investigation_bound_ms: investigationBoundMs });
}
run.addEventListener('click', () => {
  if (used) return;
  used = true; run.disabled = true; cancel.disabled = false;
  latest = { status: 'RUNNING', last_stage: 'worker_start', events: [],
    scope: 'One pinned group tensor in local WASM; research only',
    user_agent: navigator.userAgent, cross_origin_isolated: crossOriginIsolated };
  output.textContent = JSON.stringify(latest, null, 2);
  worker = new Worker('./full-browser-worker.mjs', { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.kind === 'stage') {
      latest.last_stage = data.stage;
      latest.events.push(data);
      output.textContent = JSON.stringify(latest, null, 2);
    } else if (data.kind === 'result') {
      finish({ ...data.report, user_agent: latest.user_agent,
        cross_origin_isolated: latest.cross_origin_isolated,
        events: latest.events, investigation_bound_ms: investigationBoundMs }, data.raw);
    }
  };
  worker.onerror = event => { event.preventDefault(); stop('FAIL', `Worker error: ${event.message}`); };
  timer = setTimeout(() => stop('TIMEOUT', 'Ten-minute investigation bound reached; not an acceptance budget'), investigationBoundMs);
  worker.postMessage({ command: 'one_group_case' });
});
cancel.addEventListener('click', () => stop('CANCELLED', 'User cancelled the dedicated worker'));
window.addEventListener('pagehide', () => { clearTimeout(timer); worker?.terminate(); urls.forEach(url => URL.revokeObjectURL(url)); });
