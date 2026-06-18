/**
 * Parses shared boolean and limit options used by pipeline commands.
 */
export function parseOptions(argv) {
  const options = {
    confirm: false,
    dryRun: false,
    mock: false,
    limit: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--mock') {
      options.mock = true;
    } else if (arg === '--limit') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit must be a positive integer');
      }
      options.limit = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}
