import * as vscode from 'vscode';
import { OutputChannelLogger } from './OutputChannelLogger';

export function createFileWatcherForEachFileInGlob(
  pattern: vscode.GlobPattern,
  onChange: (fsPath: string) => void,
  ...disableFlags: (() => boolean)[]
): vscode.FileSystemWatcher[] {
  const files = vscode.workspace.findFiles(pattern);
  const fileWatchers: vscode.FileSystemWatcher[] = [];
  files.then((fileURIs) => {
    fileURIs.forEach((fileURI) => {
      const filePath = fileURI.fsPath;
      let fileWatcher = createSingleFileWatcherForGlob(
        filePath,
        onChange,
        ...disableFlags
      );
      fileWatchers.push(fileWatcher);
    });
  });

  return fileWatchers;
}

export function createSingleFileWatcherForGlob(
  pattern: vscode.GlobPattern,
  onChange: (fsPath: string) => void,
  ...disableFlags: (() => boolean)[]
): vscode.FileSystemWatcher {
  const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

  OutputChannelLogger.appendLine(`Activated File Watcher for: ${pattern}.`);

  fileWatcher.onDidChange((uri) => {
    if (!disableFlags.some((disableFlag) => disableFlag())) {
      onChange(uri.fsPath);
    }
  });

  return fileWatcher;
}
