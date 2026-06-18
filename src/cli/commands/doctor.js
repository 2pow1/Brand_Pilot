import { loadConfig } from '../../config.js';
import { buildDoctorReportWithRemoteChecks, formatDoctorReport } from '../../doctor.js';

/**
 * Runs configuration preflight checks for scheduled automation or publishing.
 */
export async function runDoctor(argv) {
  const target = argv[0] || 'schedule';
  if (argv.length > 1) {
    throw new Error('doctor command accepts at most one target: schedule, discord, publish, or notion');
  }

  const config = loadConfig();
  const report = await buildDoctorReportWithRemoteChecks(config, target);

  console.log(formatDoctorReport(report));

  if (!report.ok) {
    process.exitCode = 1;
  }
}
