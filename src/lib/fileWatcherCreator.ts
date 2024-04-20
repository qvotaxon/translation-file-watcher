import * as vscode from 'vscode';
import outputChannelManager from './outputChannelManager';

class FileWatcherCreator {
  public createSingleFileWatcherForGlobAsync = async (
    pattern: vscode.GlobPattern,
    onChange: (fsPath: string) => void,
    ...disableFlags: (() => boolean)[]
  ): Promise<vscode.FileSystemWatcher> => {
    return new Promise<vscode.FileSystemWatcher>((resolve, reject) => {
      const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

      outputChannelManager.appendLine(
        `Activated File Watcher for: ${pattern.valueOf}.`
      );

      fileWatcher.onDidChange((uri) => {
        if (!disableFlags.some((disableFlag) => disableFlag())) {
          onChange(uri.fsPath);
        }
      });

      resolve(fileWatcher);
    });
  };

  public async createFileWatcherForEachFileInGlobAsync(
    pattern: vscode.GlobPattern,
    onChange: (fsPath: string) => void,
    ...disableFlags: (() => boolean)[]
  ): Promise<vscode.FileSystemWatcher[]> {
    const fileURIs = await vscode.workspace.findFiles(pattern);
    const fileWatchers: vscode.FileSystemWatcher[] = [];

    await Promise.all(
      fileURIs.map(async (fileURI) => {
        const filePath = fileURI.fsPath;
        const fileWatcher = await this.createSingleFileWatcherForGlobAsync(
          filePath,
          onChange,
          ...disableFlags
        );
        fileWatchers.push(fileWatcher);
      })
    );

    return fileWatchers;
  }
}

export default FileWatcherCreator;
