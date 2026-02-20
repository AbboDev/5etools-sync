import './style.css';
import { setupAuth } from '@/components/auth';
import { setupPush } from '@/components/push';
import { setupPull } from '@/components/pull';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>5e<span>tools.</span> Sync 🔄</h1>

    <div class="flex">
      <button id="auth" type="button">Login Google</button>
      <button id="push" type="button" disabled>Save</button>
      <button id="pull" type="button" disabled>Load</button>
    </div>
  </div>
`;

setupAuth(document.querySelector<HTMLButtonElement>('#auth')!);
setupPush(document.querySelector<HTMLButtonElement>('#push')!);
setupPull(document.querySelector<HTMLButtonElement>('#pull')!);
