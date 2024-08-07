import * as vscode from 'vscode';
import outputChannelManager from './outputChannelManager';
import { FileChangeHandlerFactory } from './fileChangeHandlerFactory';

class FileWatcherCreator {
  public createSingleFileWatcherForGlobAsync = async (
    pattern: vscode.GlobPattern,
    ...disableFlags: (() => boolean)[]
  ): Promise<vscode.FileSystemWatcher> => {
    return new Promise<vscode.FileSystemWatcher>((resolve, reject) => {
      try {
        const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        const fileChangeHandlerFactory = new FileChangeHandlerFactory();

        if (typeof pattern === 'string') {
          outputChannelManager.appendLine(
            `Activated File Watcher for: ${pattern}.`
          );
        }

        fileWatcher.onDidChange(async (uri) => {
          if (!disableFlags.some((disableFlag) => disableFlag())) {
            const fileChangeHandler =
              fileChangeHandlerFactory.createFileChangeHandler(uri.fsPath);
            await fileChangeHandler?.handleFileChangeAsync(true, uri.fsPath);
          }
        });

        resolve(fileWatcher);
      } catch (error) {
        reject(new Error(error as string));
      }
    });
  };

  public async createFileWatcherForEachFileInGlobAsync(
    pattern: string,
    ...disableFlags: (() => boolean)[]
  ): Promise<vscode.FileSystemWatcher[]> {
    const fileURIs = await vscode.workspace.findFiles(pattern);
    const fileWatchers: vscode.FileSystemWatcher[] = [];

    await Promise.all(
      fileURIs.map(async (fileURI) => {
        const filePath = fileURI.fsPath;
        const fileWatcher = await this.createSingleFileWatcherForGlobAsync(
          filePath,
          ...disableFlags
        );
        fileWatchers.push(fileWatcher);
      })
    );

    return fileWatchers;
  }
}

export default FileWatcherCreator;
