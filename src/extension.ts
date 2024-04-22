import * as vscode from 'vscode';
import { StatusBarItemType } from './lib/Enums';
import {
  notifyRequiredSettings,
  initializeStatusBarItems,
} from './lib/userInterface';
import configurationManager from './lib/configurationManager';
import statusBarManager from './lib/statusBarManager';
import fileLockManager from './lib/fileLockManager';
import FileManagement from './lib/fileManagement';
import FileWatcherCreator from './lib/fileWatcherCreator';
import outputChannelManager from './lib/outputChannelManager';
import FileContentStore from './lib/fileContentStore';
import { CodeFileChangeHandler } from './lib/fileChangeHandlers/codeFileChangeHandler';
import { JsonFileChangeHandler } from './lib/fileChangeHandlers/jsonFileChangeHandler';
import { PoFileChangeHandler } from './lib/fileChangeHandlers/poFileChangeHandler';

export async function activate(context: vscode.ExtensionContext) {
  const fileWatcherCreator: FileWatcherCreator = new FileWatcherCreator();

  outputChannelManager.appendLine(
    'Activated Translation File Watcher Extension'
  );

  const myExtension = vscode.extensions.getExtension(
    'qvotaxon.translation-file-watcher'
  );
  const currentVersion =
    myExtension!.packageJSON.configurationVersion ?? '0.0.2';

  const lastVersion = context.globalState.get(
    'TranslationFileWatcherExtensionVersion'
  );
  if (currentVersion !== lastVersion) {
    void context.globalState.update(
      'TranslationFileWatcherExtensionVersion',
      currentVersion
    );
    notifyRequiredSettings();
  }

  initializeStatusBarItems();
  await configurationManager.initializeConfigurationWatcher(context);

  const packageJsonPath = await FileManagement.getPackageJsonAbsolutePath();
  if (packageJsonPath) {
    statusBarManager.setStatusBarItemCommand(
      StatusBarItemType.PO,
      'extension.poFileWatcherStatusBarItemClicked'
    );
    statusBarManager.setStatusBarItemCommand(
      StatusBarItemType.JSON,
      'extension.jsonFileWatcherStatusBarItemClicked'
    );
    statusBarManager.setStatusBarItemCommand(
      StatusBarItemType.CODE,
      'extension.codeFileWatcherStatusBarItemClicked'
    );
  } else {
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.PO,
      '$(eye-closed) PO'
    );
    statusBarManager.setStatusBarItemTooltip(
      StatusBarItemType.PO,
      'File watcher disabled because required configuration files could not be found.'
    );
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.JSON,
      '$(eye-closed) JSON'
    );
    statusBarManager.setStatusBarItemTooltip(
      StatusBarItemType.JSON,
      'File watcher disabled because required configuration files could not be found.'
    );
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.CODE,
      '$(eye-closed) CODE'
    );
    statusBarManager.setStatusBarItemTooltip(
      StatusBarItemType.CODE,
      'File watcher disabled because required configuration files could not be found.'
    );
  }

  statusBarManager.showStatusBarItem(StatusBarItemType.PO);
  statusBarManager.showStatusBarItem(StatusBarItemType.JSON);
  statusBarManager.showStatusBarItem(StatusBarItemType.CODE);

  /**
   * TODO> Move to seperate function
   */
  let localesRelativePath = configurationManager.getValue<string>(
    'filePaths.localesRelativePath'
  );
  if (localesRelativePath && packageJsonPath) {
    const localesAbsolutePath = `${
      vscode.workspace.workspaceFolders![0].uri.fsPath
    }\\${localesRelativePath}`;

    let poFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.poFileWatcherStatusBarItemClicked',
        () => {
          const jsonFileChangeHandler = new JsonFileChangeHandler();
          jsonFileChangeHandler.processJSONFiles(localesAbsolutePath, false);
          vscode.window.showInformationMessage('Generating PO files.');
        }
      );

    let jsonFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.jsonFileWatcherStatusBarItemClicked',
        () => {
          const poFileChangeHandler = new PoFileChangeHandler();
          poFileChangeHandler.processPOFiles(localesAbsolutePath, false);
          vscode.window.showInformationMessage('Generating JSON files.');
        }
      );

    let codeFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.codeFileWatcherStatusBarItemClicked',
        async () => {
          vscode.window.showInformationMessage('Generating JSON files.');

          const codeFileChangeHandler = new CodeFileChangeHandler();
          await codeFileChangeHandler.handleFileChangeAsync(
            false,
            undefined,
            true
          );
        }
      );

    context.subscriptions.push(
      poFileWatcherStatusBarItemClickedCommand,
      jsonFileWatcherStatusBarItemClickedCommand,
      codeFileWatcherStatusBarItemClickedCommand
    );
  }

  const codeFileGlobPattern = '**/{apps,libs}/**/*.{tsx,ts}';
  const poFileGlobPattern = `${localesRelativePath}/**/*.po`;
  const jsonFileGlobPattern = `${localesRelativePath}/**/*.json`;

  //TODO: use relativeLocalesPath to read po files from. Same for tsx ts files.
  await FileContentStore.getInstance().initializeInitialFileContentsAsync(
    codeFileGlobPattern
  );

  const poFileWatchers =
    await fileWatcherCreator.createFileWatcherForEachFileInGlobAsync(
      poFileGlobPattern,
      fileLockManager.isMasterLockEnabled,
      fileLockManager.arePoFilesLocked
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
