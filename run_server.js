import fs from 'fs';
import { exec } from 'child_process';

const logFile = 'server_startup.log';
const log = (msg) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    console.log(msg);
};

log('Attempting to start server...');
const child = exec('node server.js');

child.stdout.on('data', (data) => {
    log(`STDOUT: ${data}`);
});

child.stderr.on('data', (data) => {
    log(`STDERR: ${data}`);
});

child.on('close', (code) => {
    log(`Process exited with code ${code}`);
});

log('Child process spawned');
