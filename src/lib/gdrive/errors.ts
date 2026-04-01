/** Fatal error thrown when a Google Drive API call fails due to an OAuth/auth issue. */
export class GDriveAuthError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
    public readonly portcoId?: string,
  ) {
    super(message);
    this.name = "GDriveAuthError";
  }
}
