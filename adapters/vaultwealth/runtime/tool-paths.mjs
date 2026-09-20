export const maestroCli = process.env.MAESTRO_CLI ?? 'maestro';
export const xcodebuildMcpCli = process.env.XCODEBUILDMCP_CLI ?? 'xcodebuildmcp';
export const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || null;
export const fleetSkillRun = process.env.FLEET_SKILL_RUN ?? 'fleet-skill-run';

export function simulatorUdid() {
  const udid = process.env.IOS_SIMULATOR_UDID;
  if (!udid) throw new Error('Set IOS_SIMULATOR_UDID to the dedicated test simulator');
  return udid;
}

export function optionalChromiumExecutable() {
  return chromiumExecutable ? { executablePath: chromiumExecutable } : {};
}
