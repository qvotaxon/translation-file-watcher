import * as vscode from 'vscode';
import { TaskBarItemType as StatusBarItemType } from './Enums';

export class StatusBarManager {
  private static _instance: StatusBarManager;
  private _statusBarItemMap: Map<StatusBarItemType, vscode.StatusBarItem>;

  private constructor() {
    this._statusBarItemMap = new Map<StatusBarItemType, vscode.StatusBarItem>();
  }

  public static getInstance(): StatusBarManager {
    if (!StatusBarManager._instance) {
      StatusBarManager._instance = new StatusBarManager();
    }
    return StatusBarManager._instance;
  }

  public addStatusBarItem(
    type: StatusBarItemType,
    alignment: vscode.StatusBarAlignment,
    priority: number
  ): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
      alignment,
      priority
    );
    this._statusBarItemMap.set(type, statusBarItem);
    return statusBarItem;
  }

  public getStatusBarItem(
    type: StatusBarItemType
  ): vscode.StatusBarItem | undefined {
    return this._statusBarItemMap.get(type);
  }

  public removeStatusBarItem(type: StatusBarItemType): void {
    const statusBarItem = this._statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.dispose();
      this._statusBarItemMap.delete(type);
    }
  }

  public setStatusBarItemText(type: StatusBarItemType, text: string): void {
    const statusBarItem = this._statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.text = text;
    }
  }

  public setStatusBarItemTooltip(
    type: StatusBarItemType,
    tooltip: string
  ): void {
    const statusBarItem = this._statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.tooltip = tooltip;
    }
  }

  public setStatusBarItemCommand(
    type: StatusBarItemType,
    command: string
  ): void {
    const statusBarItem = this._statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.command = command;
    }
  }

  public showStatusBarItem(type: StatusBarItemType): void {
    const statusBarItem = this._statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.show();
    }
  }

  public hideStatusBarItem(type: StatusBarItemType): void {
    const statusBarItem = this._statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.hide();
    }
  }
}
