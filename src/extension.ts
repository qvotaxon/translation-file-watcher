import * as vscode from 'vscode';
import { StatusBarItemType } from './lib/Enums';
import {
  notifyRequiredSettings,
  initializeStatusBarItems,
} from './lib/userInterface';
import configurationManager from './lib/configurationManager';
import statusBarManager from './lib/statusBarManager';
import fileChangeHandler from './lib/fileChangeHandler';
import fileLockManager from './lib/fileLockManager';
import FileManagement from './lib/fileManagement';
import FileWatcherCreator from './lib/fileWatcherCreator';
import outputChannelManager from './lib/outputChannelManager';

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
  await initializeConfigurationWatcher(context);

  const packageJsonPath = await FileManagement.getPackageJsonRelativePath();
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
  let localesRelativePath = configurationManager
    .getConfig()
    .get<string>('filePaths.localesRelativePath');
  if (localesRelativePath && packageJsonPath) {
    const localesAbsolutePath = `${
      vscode.workspace.workspaceFolders![0].uri.fsPath
    }\\${localesRelativePath}`;

    let poFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.poFileWatcherStatusBarItemClicked',
        () => {
          fileChangeHandler.processJSONFiles(
            localesAbsolutePath,
            false,
            fileChangeHandler.handleJsonFileChange
          );
          vscode.window.showInformationMessage('Generating PO files.');
        }
      );

    let jsonFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.jsonFileWatcherStatusBarItemClicked',
        () => {
          fileChangeHandler.processPOFiles(
            localesAbsolutePath,
            false,
            fileChangeHandler.handlePOFileChange
          );
          vscode.window.showInformationMessage('Generating JSON files.');
        }
      );

    let codeFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.codeFileWatcherStatusBarItemClicked',
        () => {
          fileChangeHandler.handleCodeFileChange(undefined, false);
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

  const poFileWatchers = fileWatcherCreator.createFileWatcherForEachFileInGlob(
    '**/locales/**/*.po',
    fileChangeHandler.handlePOFileChange,
    fileLockManager.isMasterLockEnabled,
    fileLockManager.arePoFilesLocked
  );
  const jsonFileWatchers =
    fileWatcherCreator.createFileWatcherForEachFileInGlob(
      '**/locales/**/*.json',
      fileChangeHandler.handleJsonFileChange,
      fileLockManager.isMasterLockEnabled
    );
  const codeFileWatcher = fileWatcherCreator.createSingleFileWatcherForGlob(
    '**/{apps,libs}/**/*.{tsx,ts}',
    fileChangeHandler.handleCodeFileChange,
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

export async function initializeConfigurationWatcher(
  context: vscode.ExtensionContext
) {
  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (
      event.affectsConfiguration(
        'translationFileWatcher.fileModes.overallFileMode'
      )
    ) {
      const newValue = configurationManager
        .getConfig()
        .get<string>('fileModes.overallFileMode', 'automatic');
      await configurationManager.updateSynchronizedOptions(newValue);
    }

    if (
      event.affectsConfiguration(
        'translationFileWatcher.logging.enableVerboseLogging'
      )
    ) {
      const newValue = configurationManager
        .getConfig()
        .get<boolean>('logging.enableVerboseLogging', false);
      outputChannelManager.setVerboseLogging(newValue);
    }

    if (
      event.affectsConfiguration(
        'translationFileWatcher.fileGeneration.generatePo'
      )
    ) {
      const newValue = configurationManager
        .getConfig()
        .get<boolean>('fileGeneration.generatePo', true);

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

  outputChannelManager.appendLine(
    'Deactivated Translation File Watcher Extension'
  );
}
