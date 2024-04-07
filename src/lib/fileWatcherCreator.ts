import * as vscode from 'vscode';
import outputChannelManager from './outputChannelManager';

class FileWatcherCreator {
  public createSingleFileWatcherForGlob = (
    pattern: vscode.GlobPattern,
    onChange: (fsPath: string) => void,
    ...disableFlags: (() => boolean)[]
  ): vscode.FileSystemWatcher => {
    const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    outputChannelManager.appendLine(
      `Activated File Watcher for: ${pattern.valueOf}.`
    );

    fileWatcher.onDidChange((uri) => {
      if (!disableFlags.some((disableFlag) => disableFlag())) {
        onChange(uri.fsPath);
      }
    });

    return fileWatcher;
  };

  public createFileWatcherForEachFileInGlob(
    pattern: vscode.GlobPattern,
    onChange: (fsPath: string) => void,
    ...disableFlags: (() => boolean)[]
  ): vscode.FileSystemWatcher[] {
    const fileWatchers: vscode.FileSystemWatcher[] = [];
    vscode.workspace.findFiles(pattern).then((fileURIs) => {
      fileURIs.forEach((fileURI) => {
        const filePath = fileURI.fsPath;
        const fileWatcher = this.createSingleFileWatcherForGlob(
          filePath,
          onChange,
          ...disableFlags
        );
        fileWatchers.push(fileWatcher);
      });
    });
    return fileWatchers;
  }
}

export default FileWatcherCreator;
