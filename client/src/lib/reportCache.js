// The Reports section's answer cache, kept apart from ReportParts so the auth
// context can clear it without pulling chart code into the initial bundle.
// Cleared whenever the signed-in user changes: a report fetched by one
// director must not paint for the next person on the same tab.
export const reportCache = new Map();

export function clearReportCache() {
  reportCache.clear();
}
