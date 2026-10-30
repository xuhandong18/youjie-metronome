import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import './prepare-web.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command.endsWith('.bat') });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['--no-daemon', ':app:assembleDebug'], `${root}/android`);
await mkdir(`${root}/dist`, { recursive: true });
await copyFile(`${root}/android/app/build/outputs/apk/debug/app-debug.apk`, `${root}/dist/有节动作节拍器-1.0.0.apk`);
console.log('已生成：dist/有节动作节拍器-1.0.0.apk');
