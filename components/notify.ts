export type MessageType = 'info' | 'success' | 'error' | 'warn';

const CONTAINER_ID = 'ext-notify-container';

function getContainer() {
  let c = document.getElementById(CONTAINER_ID) as HTMLDivElement | null;
  if (!c) {
    c = document.createElement('div');
    c.id = CONTAINER_ID;
    document.body.appendChild(c);
  }
  return c;
}

export function showMessage(message: string, type: MessageType = 'info', timeout = 3500) {
  try {
    const container = getContainer();

    const el = document.createElement('div');
    el.className = `ext-notify ${type}`;
    el.textContent = message;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    container.appendChild(el);

    // Allow entrance animation
    requestAnimationFrame(() => el.classList.add('show'));

    const remove = () => {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => el.remove(), 260);
    };

    const timeoutId = setTimeout(remove, timeout);

    el.addEventListener('click', () => {
      clearTimeout(timeoutId);
      remove();
    });
  } catch (e) {
    // Fallback to console if DOM operations fail
    console.warn('showMessage failed:', e, message);
  }
}
