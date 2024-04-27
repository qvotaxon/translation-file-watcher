import * as vscode from 'vscode';
import { StatusBarItemType } from './enums/statusBarItemType';
import statusBarManager from './statusBarManager';

export function notifyRequiredSettings() {
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

export function initializeStatusBarItems() {
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
