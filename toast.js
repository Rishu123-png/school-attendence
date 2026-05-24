// toast.js — Replaces all alert() / confirm() with styled UI

export function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

export function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p class="confirm-msg">${message}</p>
        <div class="confirm-btns">
          <button class="confirm-no">Cancel</button>
          <button class="confirm-yes">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    const cleanup = val => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(val);
    };
    overlay.querySelector('.confirm-yes').onclick = () => cleanup(true);
    overlay.querySelector('.confirm-no').onclick  = () => cleanup(false);
  });
}

export function showLoader(message = 'Loading...') {
  if (document.getElementById('global-loader')) return;
  const el = document.createElement('div');
  el.id = 'global-loader';
  el.innerHTML = `<div class="loader-box"><div class="spinner"></div><p>${message}</p></div>`;
  document.body.appendChild(el);
}

export function hideLoader() {
  document.getElementById('global-loader')?.remove();
}
