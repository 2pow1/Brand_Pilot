/**
 * Prints the available CLI commands and arguments.
 */
export function printUsage() {
  console.log(`Brand Pilot CLI

Usage:
  node src/cli.js init
  node src/cli.js status
  node src/cli.js sample
  node src/cli.js collect [--dry-run] [--limit <n>]
  node src/cli.js draft [--mock] [--limit <n>]
  node src/cli.js review check
  node src/cli.js review request [--mock] [--limit <n>]
  node src/cli.js review approve <content-id>
  node src/cli.js review reject <content-id> [reason]
  node src/cli.js channel generate [--mock] [--limit <n>]
  node src/cli.js channel regenerate <content-id> [--mock]
  node src/cli.js instagram preview-sketch
  node src/cli.js instagram render [--limit <n>]
  node src/cli.js instagram upload [--limit <n>]
  node src/cli.js instagram publish [--mock] [--limit <n>]
  node src/cli.js notion check
  node src/cli.js notion sync [--limit <n>]
  node src/cli.js notion backup [--limit <n>]
  node src/cli.js storage cleanup [--dry-run] [--confirm] [--limit <n>]
  node src/cli.js alert meta-token-expiry
  node src/cli.js doctor [schedule|discord|publish|notion]
  node src/cli.js transitions
`);
}
