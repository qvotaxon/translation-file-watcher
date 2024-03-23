import * as vscode from 'vscode';
import { TaskBarItemType as StatusBarItemType } from './Enums';

export class StatusBarManager {
  private static instance: StatusBarManager;
  private statusBarItemMap: Map<StatusBarItemType, vscode.StatusBarItem>;

  private constructor() {
    this.statusBarItemMap = new Map<StatusBarItemType, vscode.StatusBarItem>();
  }

  public static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
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
    this.statusBarItemMap.set(type, statusBarItem);
    return statusBarItem;
  }

  public getStatusBarItem(
    type: StatusBarItemType
  ): vscode.StatusBarItem | undefined {
    return this.statusBarItemMap.get(type);
  }

  public removeStatusBarItem(type: StatusBarItemType): void {
    const statusBarItem = this.statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.dispose();
      this.statusBarItemMap.delete(type);
    }
  }

  public setStatusBarItemText(type: StatusBarItemType, text: string): void {
    const statusBarItem = this.statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.text = text;
    }
  }

  public setStatusBarItemTooltip(
    type: StatusBarItemType,
    tooltip: string
  ): void {
    const statusBarItem = this.statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.tooltip = tooltip;
    }
  }

  public setStatusBarItemCommand(
    type: StatusBarItemType,
    command: string
  ): void {
    const statusBarItem = this.statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.command = command;
    }
  }

  public showStatusBarItem(type: StatusBarItemType): void {
    const statusBarItem = this.statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.show();
    }
  }

  public hideStatusBarItem(type: StatusBarItemType): void {
    const statusBarItem = this.statusBarItemMap.get(type);
    if (statusBarItem) {
      statusBarItem.hide();
    }
  }
}
