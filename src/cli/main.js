import { runAlert } from './commands/alert.js';
import { runChannel } from './commands/channel.js';
import { runCollect } from './commands/collect.js';
import { runDoctor } from './commands/doctor.js';
import { runDraft } from './commands/draft.js';
import { runInit } from './commands/init.js';
import { runInstagram } from './commands/instagram.js';
import { runNotion } from './commands/notion.js';
import { runReview } from './commands/review.js';
import { runSample } from './commands/sample.js';
import { runStatus } from './commands/status.js';
import { runStorage } from './commands/storage.js';
import { runTransitions } from './commands/transitions.js';
import { printUsage } from './usage.js';

/**
 * Dispatches the top-level CLI command.
 */
export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  const args = argv.slice(1);

  if (command === 'init') await runInit();
  else if (command === 'status') await runStatus();
  else if (command === 'sample') await runSample();
  else if (command === 'collect') await runCollect(args);
  else if (command === 'draft') await runDraft(args);
  else if (command === 'review') await runReview(args);
  else if (command === 'channel') await runChannel(args);
  else if (command === 'instagram') await runInstagram(args);
  else if (command === 'notion') await runNotion(args);
  else if (command === 'storage') await runStorage(args);
  else if (command === 'alert') await runAlert(args);
  else if (command === 'doctor') await runDoctor(args);
  else if (command === 'transitions') runTransitions();
  else {
    printUsage();
    process.exitCode = command ? 1 : 0;
  }
}
