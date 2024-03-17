import * as vscode from 'vscode';

export function createFileWatcher(
  pattern: vscode.GlobPattern,
  onChange: (uri: vscode.Uri) => void,
  ...disableFlags: (() => boolean)[]
): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  watcher.onDidChange((uri) => {
    if (!disableFlags.some((disableFlag) => disableFlag())) {
      onChange(uri);
    }
  });

  return watcher;
}
