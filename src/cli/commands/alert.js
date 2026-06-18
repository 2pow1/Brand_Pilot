import { sendMetaTokenExpiryWarning } from '../../alert/meta-token.js';
import { loadConfig } from '../../config.js';

/**
 * Dispatches operational alert subcommands.
 */
export async function runAlert(argv) {
  const action = argv[0];
  if (argv.length > 1) {
    throw new Error('alert command accepts one target: meta-token-expiry');
  }

  if (action !== 'meta-token-expiry') {
    throw new Error('alert command must be: meta-token-expiry');
  }

  const config = loadConfig();
  const result = await sendMetaTokenExpiryWarning({ config });

  console.log(JSON.stringify(result, null, 2));
}
