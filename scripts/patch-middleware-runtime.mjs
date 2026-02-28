import { readFileSync, writeFileSync, existsSync } from 'fs';

const vcConfigPath = '.vercel/output/functions/middleware.func/.vc-config.json';

if (existsSync(vcConfigPath)) {
  const config = JSON.parse(readFileSync(vcConfigPath, 'utf8'));
  config.runtime = 'nodejs22.x';
  delete config.deploymentTarget;
  writeFileSync(vcConfigPath, JSON.stringify(config, null, 2));
  console.log('Patched middleware runtime to nodejs22.x');
} else {
  console.log('No middleware .vc-config.json found, skipping patch');
}
