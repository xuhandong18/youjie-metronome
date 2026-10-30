import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(new URL('../web/', import.meta.url), { recursive: true });
await copyFile(`${root}/node_modules/@capacitor/core/dist/capacitor.js`, `${root}/web/capacitor.js`);
await copyFile(`${root}/node_modules/@capacitor/core/LICENSE`, `${root}/web/third-party-licenses.txt`);
console.log('已准备离线网页与 Capacitor 运行库。');
