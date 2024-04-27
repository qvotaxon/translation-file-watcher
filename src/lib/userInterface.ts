import * as vscode from 'vscode';
import { StatusBarItemType } from './enums/statusBarItemType';
import statusBarManager from './statusBarManager';
import configurationManager from './configurationManager';
import { CodeFileChangeHandler } from './fileChangeHandlers/codeFileChangeHandler';
import { JsonFileChangeHandler } from './fileChangeHandlers/jsonFileChangeHandler';
import { PoFileChangeHandler } from './fileChangeHandlers/poFileChangeHandler';
import FileManagement from './fileManagement';

/**
 * A class to manage user interface related functionalities.
 */
export class UserInterfaceManager {
  /**
   * Notifies the user about required extension settings.
   * If the user chooses to open configuration, it opens the extension settings.
   */
  static notifyRequiredSettings() {
    vscode.window
      .showInformationMessage(
        'Please configure the extension settings to use the extension properly.',
        'Open Configuration'
      )
      .then((choice) => {
        if (choice === 'Open Configuration') {
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            '@ext:qvotaxon.translation-file-watcher'
          );
        }
      });
  }

  /**
   * Initializes status bar items for the extension.
   */
  static initializeStatusBarItems() {
    const poStatusBarItem = statusBarManager.addStatusBarItem(
      StatusBarItemType.PO,
      vscode.StatusBarAlignment.Left,
      100
    );
    const jsonStatusBarItem = statusBarManager.addStatusBarItem(
      StatusBarItemType.JSON,
      vscode.StatusBarAlignment.Left,
      90
    );
    const codeStatusBarItem = statusBarManager.addStatusBarItem(
      StatusBarItemType.CODE,
      vscode.StatusBarAlignment.Left,
      80
    );

    poStatusBarItem.text = '$(eye) PO';
    poStatusBarItem.tooltip = 'Watching PO files (click to generate PO files)';

    jsonStatusBarItem.text = '$(eye) JSON';
    jsonStatusBarItem.tooltip =
      'Watching JSON files (click to generate JSON files)';

    codeStatusBarItem.text = '$(eye) CODE';
    codeStatusBarItem.tooltip =
      'Watching code files (click to generate JSON files)';
  }

  public static async setupStatusBarItemsAsync() {
    const packageJsonPath = await FileManagement.getPackageJsonAbsolutePath();
    const statusBarItemType = packageJsonPath ? '$(eye)' : '$(eye-closed)';
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.PO,
      `${statusBarItemType} PO`
    );
    statusBarManager.setStatusBarItemTooltip(
      StatusBarItemType.PO,
      packageJsonPath
        ? ''
        : 'File watcher disabled because required configuration files could not be found.'
    );
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.JSON,
      `${statusBarItemType} JSON`
    );
    statusBarManager.setStatusBarItemTooltip(
      StatusBarItemType.JSON,
      packageJsonPath
        ? ''
        : 'File watcher disabled because required configuration files could not be found.'
    );
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.CODE,
      `${statusBarItemType} CODE`
    );
    statusBarManager.setStatusBarItemTooltip(
      StatusBarItemType.CODE,
      packageJsonPath
        ? ''
        : 'File watcher disabled because required configuration files could not be found.'
    );
  }

  public static async setupStatusBarItemCommandsAsync(
    context: vscode.ExtensionContext
  ) {
    const localesRelativePath = configurationManager.getValue<string>(
      'filePaths.localesRelativePath'
    );
    const packageJsonPath = await FileManagement.getPackageJsonAbsolutePath();
    if (localesRelativePath && packageJsonPath) {
      const localesAbsolutePath = `${
        vscode.workspace.workspaceFolders![0].uri.fsPath
      }\\${localesRelativePath}`;

      const poFileWatcherStatusBarItemClickedCommand =
        vscode.commands.registerCommand(
          'extension.poFileWatcherStatusBarItemClicked',
          () => {
            const jsonFileChangeHandler = new JsonFileChangeHandler();
            jsonFileChangeHandler.processJSONFiles(localesAbsolutePath, false);
            vscode.window.showInformationMessage('Generating PO files.');
          }
        );

      const jsonFileWatcherStatusBarItemClickedCommand =
        vscode.commands.registerCommand(
          'extension.jsonFileWatcherStatusBarItemClicked',
          () => {
            const poFileChangeHandler = new PoFileChangeHandler();
            poFileChangeHandler.processPOFiles(localesAbsolutePath, false);
            vscode.window.showInformationMessage('Generating JSON files.');
          }
        );

      const codeFileWatcherStatusBarItemClickedCommand =
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
  }
}
