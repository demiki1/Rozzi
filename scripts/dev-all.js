const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

const npm = isWin ? 'npm.cmd' : 'npm';

const commands = [
  ['backend', ['run', 'start:dev'], path.join(root, 'backend')],
  ['customer', ['run', 'dev'], path.join(root, 'apps/customer')],
  ['vendor', ['run', 'dev'], path.join(root, 'apps/vendor')],
  ['rider', ['run', 'dev'], path.join(root, 'apps/rider')],
  ['admin', ['run', 'dev'], path.join(root, 'apps/admin')],
];

const children = [];

for (const [name, args, cwd] of commands) {
  console.log(`[${name}] starting...`);

  const child = spawn(npm, args, {
    cwd,
    env: { ...process.env },
    stdio: 'inherit',
    shell: isWin,
    windowsVerbatimArguments: false,
  });

  child.on('error', (error) => {
    console.error(`[${name}] failed to start:`, error.message);
  });

  child.on('exit', (code, signal) => {
    console.log(
      `[${name}] exited code=${code} signal=${signal || 'none'}`
    );
  });

  children.push(child);
}

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
};

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
