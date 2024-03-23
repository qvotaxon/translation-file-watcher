import * as vscode from 'vscode';
import { createFileWatcher } from './lib/file-watcher';
import {
  arePoFilesLocked,
  setMasterLock,
  isMasterLockEnabled,
} from './lib/file-lock-manager';
import path from 'path';
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
import { findPackageJson, getLastThreeDirectories } from './lib/fileManagement';
import {
  notifyRequiredSettings,
  initializeStatusBarItems,
  showRestartMessage,
} from './lib/userInterface';
import { StatusBarManager } from './lib/StatusBarManager';

let statusBarManager: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activated Translation File Watcher Extension');
  const statusBarManager = StatusBarManager.getInstance();

  const myExtension = vscode.extensions.getExtension(
    'qvotaxon.translation-file-watcher'
  );
  const currentVersion =
    myExtension!.packageJSON.configurationVersion ?? '0.0.1';

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

  vscode.window.showInformationMessage(
    'Activated Translation File Watcher Extension.'
  );

  const packageJsonPath = await findPackageJson();
  if (packageJsonPath) {
    vscode.window.setStatusBarMessage(
      `TFW: ${getLastThreeDirectories(
        path.dirname(packageJsonPath),
        100
      )} used as project directory.`,
      7500
    );
  } else {
    vscode.window.showErrorMessage(
      `The configured absolute json path could not be found. Please check your configuration.`
    );
    deactivate();
  }

  statusBarManager.showStatusBarItem(StatusBarItemType.PO);
  statusBarManager.setStatusBarItemCommand(
    StatusBarItemType.PO,
    'extension.poFileWatcherStatusBarItemClicked'
  );
  statusBarManager.showStatusBarItem(StatusBarItemType.JSON);
  statusBarManager.setStatusBarItemCommand(
    StatusBarItemType.PO,
    'extension.jsonFileWatcherStatusBarItemClicked'
  );
  statusBarManager.showStatusBarItem(StatusBarItemType.CODE);
  statusBarManager.setStatusBarItemCommand(
    StatusBarItemType.PO,
    'extension.codeFileWatcherStatusBarItemClicked'
  );

  /**
   * TODO> Move to seperate function
   */
  const localesAbsolutePath = getConfig().get<string>('localesAbsolutePath');
  if (localesAbsolutePath) {
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
  } else {
    vscode.window.showErrorMessage(
      'Please configure a locales path in the extension settings.'
    );
  }

  const poFileWatcher = createFileWatcher(
    '**/locales/**/*.po',
    handlePOFileChange,
    isMasterLockEnabled,
    arePoFilesLocked
  );

  const codeFileWatcher = createFileWatcher(
    '**/{apps,libs}/**/*.{tsx,ts}',
    handleCodeFileChange,
    isMasterLockEnabled
  );
  const jsonFileWatcher = createFileWatcher(
    '**/locales/**/*.json',
    handleJsonFileChange,
    isMasterLockEnabled
  );

  context.subscriptions.push(poFileWatcher, codeFileWatcher, jsonFileWatcher);
}

vscode.commands.registerCommand(
  'translation-file-watcher.toggleFileWatchers',
  () => {
    setMasterLock(!isMasterLockEnabled());
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

    if (event.affectsConfiguration('translationFileWatcher')) {
      showRestartMessage();
    }
  });
}

export function deactivate() {
  statusBarManager.removeStatusBarItem(StatusBarItemType.PO);
  statusBarManager.removeStatusBarItem(StatusBarItemType.JSON);
  statusBarManager.removeStatusBarItem(StatusBarItemType.CODE);

  console.log('Deactivated Translation File Watcher Extension');
}
