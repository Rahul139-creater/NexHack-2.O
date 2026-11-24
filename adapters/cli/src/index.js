#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { KBClient, KBError } from '@team-kb/client';

const baseUrl = process.env.KB_URL || 'http://127.0.0.1:3000';
const token = process.env.KB_TOKEN || '';
const tool = process.env.KB_TOOL || 'cli';

function exitWithError(message, code = 'CLI_ERROR') {
  console.error(JSON.stringify({ error: message, code }));
  process.exit(1);
}

if (!baseUrl) {
  exitWithError('Missing KB_URL environment variable', 'CONFIG_ERROR');
}
if (!token) {
  exitWithError('Missing KB_TOKEN environment variable', 'CONFIG_ERROR');
}

const client = new KBClient({ baseUrl, token, tool });

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command) {
    exitWithError('No command provided. Available: read, claim, submit, context, resume', 'INVALID_COMMAND');
  }

  switch (command) {
    case 'read': {
      const id = args[1];
      if (!id) {
        exitWithError('Usage: kb read <id> [--rev N]', 'VALIDATION_ERROR');
      }

      let rev = undefined;
      const revIndex = args.indexOf('--rev');
      if (revIndex !== -1 && args[revIndex + 1]) {
        rev = parseInt(args[revIndex + 1], 10);
      }

      const res = await client.readRecord(id, rev);
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'claim': {
      const taskId = args[1];
      if (!taskId) {
        exitWithError('Usage: kb claim <taskId>', 'VALIDATION_ERROR');
      }

      const res = await client.claimTask(taskId);
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'submit': {
      const taskId = args[1];
      if (!taskId) {
        exitWithError('Usage: kb submit <taskId> --file result.json', 'VALIDATION_ERROR');
      }

      const fileIndex = args.indexOf('--file');
      if (fileIndex === -1 || !args[fileIndex + 1]) {
        exitWithError('Missing --file argument. Usage: kb submit <taskId> --file result.json', 'VALIDATION_ERROR');
      }

      const filePath = path.resolve(process.cwd(), args[fileIndex + 1]);
      if (!fs.existsSync(filePath)) {
        exitWithError(`File not found: ${filePath}`, 'NOT_FOUND');
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      let payload;
      try {
        payload = JSON.parse(fileContent);
      } catch (e) {
        exitWithError(`Invalid JSON file: ${e.message}`, 'VALIDATION_ERROR');
      }

      const res = await client.submitResult(taskId, payload);
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'context': {
      const taskId = args[1];
      if (!taskId) {
        exitWithError('Usage: kb context <taskId>', 'VALIDATION_ERROR');
      }

      const res = await client.getTaskContext(taskId);
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'resume': {
      const taskId = args[1];
      if (!taskId) {
        exitWithError('Usage: kb resume <taskId>', 'VALIDATION_ERROR');
      }

      const res = await client.resumeTask(taskId);
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    default:
      exitWithError(`Unknown command: ${command}. Available: read, claim, submit, context, resume`, 'INVALID_COMMAND');
  }
}

main().catch(err => {
  const code = err.code || (err instanceof KBError ? 'KB_ERROR' : 'INTERNAL_ERROR');
  exitWithError(err.message, code);
});
