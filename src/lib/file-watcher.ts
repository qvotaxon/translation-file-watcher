import * as vscode from 'vscode';

export function createFileWatcher(
  pattern: vscode.GlobPattern,
  onChange: (fsPath: string) => void,
  ...disableFlags: (() => boolean)[]
): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  watcher.onDidChange((uri) => {
    if (!disableFlags.some((disableFlag) => disableFlag())) {
      onChange(uri.fsPath);
    }
  });

  return watcher;
}
