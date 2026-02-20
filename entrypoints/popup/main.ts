import './style.css';
import { setupAuth } from '@/components/auth';
import { setupPush } from '@/components/push';
import { setupPull } from '@/components/pull';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>5e.tools Sync</h1>

    <div class="card">
      <button id="auth" type="button">Login Google</button>
      <button id="push" type="button">Save</button>
      <button id="pull" type="button">Load</button>
    </div>
  </div>
`;

setupAuth(document.querySelector<HTMLButtonElement>('#auth')!);
setupPush(document.querySelector<HTMLButtonElement>('#push')!);
setupPull(document.querySelector<HTMLButtonElement>('#pull')!);
