export interface FileChangeHandler {
  handleFileChangeAsync(
    triggeredByFileWatcher: boolean,
    changeFileLocation?: string,
    forceExecution?: boolean
  ): Promise<void>;
}
