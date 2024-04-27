import * as vscode from 'vscode';
import { LogVerbosity } from './lib/enums/logVerbosity';
import { StatusBarItemType } from './lib/enums/statusBarItemType';
import configurationManager from './lib/configurationManager';
import statusBarManager from './lib/statusBarManager';
import fileLockManager from './lib/fileLockManager';
import FileWatcherCreator from './lib/fileWatcherCreator';
import outputChannelManager from './lib/outputChannelManager';
import FileContentStore from './lib/fileContentStore';
import { UserInterfaceManager } from './lib/userInterface';

export async function activate(context: vscode.ExtensionContext) {
  outputChannelManager.appendLine(
    'Activated Translation File Watcher Extension',
    LogVerbosity.Important
  );

  configurationManager.notifyUserIfConfigurationVersionHasChanged(context);

  UserInterfaceManager.initializeStatusBarItems();
  const enableVerboseLogging = configurationManager.getValue<boolean>(
    'logging.enableVerboseLogging',
    false
  )!;
  outputChannelManager.setVerboseLogging(enableVerboseLogging);
  configurationManager.initializeConfigurationWatcher();

  await UserInterfaceManager.setupStatusBarItemsAsync();
  await UserInterfaceManager.setupStatusBarItemCommandsAsync(context);
  await initializeFileWatchersAsync(context);
}

async function initializeFileWatchersAsync(context: vscode.ExtensionContext) {
  const fileWatcherCreator: FileWatcherCreator = new FileWatcherCreator();
  const localesRelativePath = configurationManager.getValue<string>(
    'filePaths.localesRelativePath'
  );
  const codeFileGlobPattern = '**/{apps,libs}/**/*.{tsx,ts}';
  const poFileGlobPattern = `${localesRelativePath}/**/*.po`;
  const jsonFileGlobPattern = `${localesRelativePath}/**/*.json`;

  await FileContentStore.getInstance().initializeInitialFileContentsAsync(
    codeFileGlobPattern
  );

  const poFileWatchers =
    await fileWatcherCreator.createFileWatcherForEachFileInGlobAsync(
      poFileGlobPattern,
      fileLockManager.isMasterLockEnabled
    );
  const jsonFileWatchers =
    await fileWatcherCreator.createFileWatcherForEachFileInGlobAsync(
      jsonFileGlobPattern,
      fileLockManager.isMasterLockEnabled
    );
  const codeFileWatcher =
    await fileWatcherCreator.createSingleFileWatcherForGlobAsync(
      codeFileGlobPattern,
      fileLockManager.isMasterLockEnabled
    );

  context.subscriptions.push(
    ...poFileWatchers,
    ...jsonFileWatchers,
    codeFileWatcher
  );
}

vscode.commands.registerCommand(
  'translation-file-watcher.toggleFileWatchers',
  () => {
    fileLockManager.setMasterLock(!fileLockManager.isMasterLockEnabled());
  }
);

export function deactivate() {
  statusBarManager.removeStatusBarItem(StatusBarItemType.PO);
  statusBarManager.removeStatusBarItem(StatusBarItemType.JSON);
  statusBarManager.removeStatusBarItem(StatusBarItemType.CODE);

  outputChannelManager.appendLine(
    'Deactivated Translation File Watcher Extension'
  );
}
