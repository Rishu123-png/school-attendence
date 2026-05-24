// toast.js — Toast notifications, styled confirm/prompt dialogs, loading spinner

(function injectStyles() {
  if (document.getElementById('toastStyles')) return;
  const s = document.createElement('style');
  s.id = 'toastStyles';
  s.textContent = `
    @keyframes slideInToast { from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)} }
    @keyframes fadeOutToast { to{opacity:0;transform:translateX(110%)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    #toastContainer{position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;}
    .toast-item{pointer-events:all;display:flex;align-items:center;gap:10px;padding:14px 18px;
      border-radius:14px;font-size:14px;font-weight:500;min-width:240px;max-width:360px;
      box-shadow:0 8px 24px rgba(0,0,0,0.5);cursor:pointer;animation:slideInToast 0.3s ease;}
    .toast-success{background:linear-gradient(135deg,#1e7e44,#27ae60);color:#fff;}
    .toast-error{background:linear-gradient(135deg,#8b1a1a,#e74c3c);color:#fff;}
    .toast-warning{background:linear-gradient(135deg,#7a5200,#f39c12);color:#fff;}
    .toast-info{background:linear-gradient(135deg,#0a4a6e,#2980b9);color:#fff;}
  `;
  document.head.appendChild(s);
})();

function getContainer() {
  let c = document.getElementById('toastContainer');
  if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; document.body.appendChild(c); }
  return c;
}

function dismiss(toast) {
  if (!toast.isConnected) return;
  toast.style.animation = 'fadeOutToast 0.3s ease forwards';
  setTimeout(() => toast.remove(), 300);
}

export function showToast(message, type = 'success', duration = 3000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`;
  toast.onclick = () => dismiss(toast);
  getContainer().appendChild(toast);
  setTimeout(() => dismiss(toast), duration);
}

export function showConfirm(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.78);z-index:99998;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#100e1e;border:1px solid rgba(255,255,255,0.12);border-radius:22px;
      padding:32px;width:90%;max-width:380px;box-shadow:0 24px 64px rgba(0,0,0,0.8);text-align:center;">
      <div style="font-size:38px;margin-bottom:14px;">🤔</div>
      <p style="color:#fff;font-size:15px;margin-bottom:24px;line-height:1.5;">${message}</p>
      <div style="display:flex;gap:12px;">
        <button id="cfNo" style="flex:1;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,0.18);
          background:transparent;color:#ccc;cursor:pointer;font-size:14px;">Cancel</button>
        <button id="cfYes" style="flex:1;padding:13px;border-radius:12px;border:none;
          background:linear-gradient(135deg,#ff6bc4,#6b6cff);color:#fff;cursor:pointer;
          font-size:14px;font-weight:600;">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cfYes').onclick = () => { overlay.remove(); if (onConfirm) onConfirm(); };
  overlay.querySelector('#cfNo').onclick  = () => { overlay.remove(); if (onCancel) onCancel(); };
}

export function showPrompt(label, defaultVal, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.78);z-index:99998;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#100e1e;border:1px solid rgba(255,255,255,0.12);border-radius:22px;
      padding:28px;width:90%;max-width:360px;box-shadow:0 24px 64px rgba(0,0,0,0.8);">
      <p style="color:#fff;font-size:15px;margin-bottom:14px;">${label}</p>
      <input id="promptInp" value="${defaultVal||''}" placeholder="Enter value..."
        style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);
        background:rgba(255,255,255,0.07);color:#fff;font-size:14px;outline:none;margin-bottom:16px;">
      <div style="display:flex;gap:10px;">
        <button id="pNo" style="flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);background:transparent;color:#ccc;cursor:pointer;">Cancel</button>
        <button id="pYes" style="flex:1;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff6bc4,#6b6cff);color:#fff;cursor:pointer;font-weight:600;">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const inp = overlay.querySelector('#promptInp');
  inp.focus(); inp.select();
  const confirm = () => { overlay.remove(); if (onConfirm) onConfirm(inp.value.trim()); };
  overlay.querySelector('#pYes').onclick = confirm;
  overlay.querySelector('#pNo').onclick = () => overlay.remove();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
}

export function showLoading(msg = 'Loading…') {
  if (document.getElementById('globalSpinner')) return;
  const el = document.createElement('div');
  el.id = 'globalSpinner';
  el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.62);z-index:99997;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
  el.innerHTML = `
    <div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.15);
      border-top-color:#ff6bc4;border-radius:50%;animation:spin 0.75s linear infinite;"></div>
    <p style="color:#fff;font-size:14px;font-weight:500;">${msg}</p>`;
  document.body.appendChild(el);
}

export function hideLoading() {
  document.getElementById('globalSpinner')?.remove();
}
