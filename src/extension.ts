import * as vscode from 'vscode';
import {
  createSingleFileWatcherForGlob,
  createFileWatcherForEachFileInGlob,
} from './lib/file-watcher';
import { FileLockManager } from './lib/FileLockManager';
import { TaskBarItemType as StatusBarItemType } from './lib/Enums';
import {
  getConfig,
  updateSynchronizedOptions,
} from './lib/configurationManagement';
import {
  processJSONFiles,
  handleJsonFileChange,
  processPOFiles,
  handlePOFileChange,
  handleCodeFileChange,
} from './lib/fileHandling';
import { getPackageJsonRelativePath } from './lib/fileManagement';
import {
  notifyRequiredSettings,
  initializeStatusBarItems,
} from './lib/userInterface';
import { StatusBarManager } from './lib/StatusBarManager';
import { OutputChannelLogger } from './lib/OutputChannelLogger';

let statusBarManager: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
  OutputChannelLogger.getInstance().appendLine(
    'Activated Translation File Watcher Extension'
  );
  const statusBarManager = StatusBarManager.getInstance();

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
  await initializeConfigurationWatcher(context);

  const packageJsonPath = await getPackageJsonRelativePath();
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
  let localesRelativePath = getConfig().get<string>(
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
          processJSONFiles(localesAbsolutePath, false, handleJsonFileChange);
          vscode.window.showInformationMessage('Generating PO files.');
        }
      );

    let jsonFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.jsonFileWatcherStatusBarItemClicked',
        () => {
          processPOFiles(localesAbsolutePath, false, handlePOFileChange);
          vscode.window.showInformationMessage('Generating JSON files.');
        }
      );

    let codeFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.codeFileWatcherStatusBarItemClicked',
        () => {
          handleCodeFileChange(undefined, false),
            vscode.window.showInformationMessage('Generating JSON files.');
        }
      );

    context.subscriptions.push(
      poFileWatcherStatusBarItemClickedCommand,
      jsonFileWatcherStatusBarItemClickedCommand,
      codeFileWatcherStatusBarItemClickedCommand
    );
  }
  //TODO: use relativeLocalesPath to read po files from. Same for tsx ts files.

  const poFileWatchers = createFileWatcherForEachFileInGlob(
    '**/locales/**/*.po',
    handlePOFileChange,
    FileLockManager.getInstance().isMasterLockEnabled,
    FileLockManager.getInstance().arePoFilesLocked
  );
  const jsonFileWatchers = createFileWatcherForEachFileInGlob(
    '**/locales/**/*.json',
    handleJsonFileChange,
    FileLockManager.getInstance().isMasterLockEnabled
  );
  const codeFileWatcher = createSingleFileWatcherForGlob(
    '**/{apps,libs}/**/*.{tsx,ts}',
    handleCodeFileChange,
    FileLockManager.getInstance().isMasterLockEnabled
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
    FileLockManager.getInstance().setMasterLock(
      !FileLockManager.getInstance().isMasterLockEnabled()
    );
  }
);

export async function initializeConfigurationWatcher(
  context: vscode.ExtensionContext
) {
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (
      event.affectsConfiguration(
        'translationFileWatcher.fileModes.overallFileMode'
      )
    ) {
      const newValue = getConfig().get<string>(
        'fileModes.overallFileMode',
        'automatic'
      );
      await updateSynchronizedOptions(newValue);
    }

    if (
      event.affectsConfiguration(
        'translationFileWatcher.logging.enableVerboseLogging'
      )
    ) {
      const newValue = getConfig().get<boolean>(
        'logging.enableVerboseLogging',
        false
      );
      OutputChannelLogger.getInstance().setVerboseLogging(newValue);
    }

    if (
      event.affectsConfiguration(
        'translationFileWatcher.fileGeneration.generatePo'
      )
    ) {
      const newValue = getConfig().get<boolean>(
        'fileGeneration.generatePo',
        true
      );
      const statusBarManager = StatusBarManager.getInstance();

      if (newValue) {
        statusBarManager.setStatusBarItemText(
          StatusBarItemType.PO,
          '$(eye) PO'
        );
        statusBarManager.setStatusBarItemTooltip(
          StatusBarItemType.PO,
          'Watching PO files (click to generate PO files)'
        );
      } else {
        statusBarManager.setStatusBarItemText(
          StatusBarItemType.PO,
          '$(eye-closed) PO'
        );
        statusBarManager.setStatusBarItemTooltip(
          StatusBarItemType.PO,
          'File watcher disabled because of settings.'
        );
      }
    }
  });
}

export function deactivate() {
  statusBarManager.removeStatusBarItem(StatusBarItemType.PO);
  statusBarManager.removeStatusBarItem(StatusBarItemType.JSON);
  statusBarManager.removeStatusBarItem(StatusBarItemType.CODE);

  OutputChannelLogger.getInstance().appendLine(
    'Deactivated Translation File Watcher Extension'
  );
}
