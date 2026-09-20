export function qualifyAgent(result, answer, commandFailures) {
  const visualMatches =
    result.fault === 'clipped'
      ? Boolean(answer?.visualDefects?.some((d) => /continue|clip|obscur/i.test(d)))
      : answer?.visualDefects?.length === 0;
  return Boolean(
    result.exit === 0 &&
    !result.timedOut &&
    result.functional === 'passed' &&
    result.invalidRejected &&
    answer?.accountAndDestinationVerified === true &&
    answer?.invalidCredentialsRejected === true &&
    visualMatches &&
    answer?.screenshotsInspected?.length >= 2 &&
    answer?.recoveryCount <= 1 &&
    commandFailures <= 1 &&
    (result.fault !== 'clean' || answer?.status === 'passed'),
  );
}
