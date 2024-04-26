import * as vscode from 'vscode';
import outputChannelManager from './outputChannelManager';

class FileLockManager {
  private static instance: FileLockManager;
  private masterLock: boolean = false;
  private fileLocks: Set<string> = new Set<string>();

  private constructor() {}

  public static getInstance(): FileLockManager {
    if (!FileLockManager.instance) {
      FileLockManager.instance = new FileLockManager();
    }
    return FileLockManager.instance;
  }

  public setMasterLock = (value: boolean): void => {
    this.masterLock = value;
    vscode.window.showInformationMessage(
      `Masterlock: ${this.masterLock ? 'enabled' : 'disabled'}`
    );
    outputChannelManager.appendLine(
      `Set: Masterlock: ${this.masterLock ? 'enabled' : 'disabled'}`
    );
  };

  public addFileLock = (filePath: string): void => {
    this.fileLocks.add(filePath);
  };

  public removeFileLock = (filePath: string): void => {
    this.fileLocks.delete(filePath);
  };

  public isFileLocked = (filePath: string): boolean => {
    return this.fileLocks.has(filePath);
  };

  public isMasterLockEnabled = (): boolean => {
    return this.masterLock;
  };
}

const fileLockManager = FileLockManager.getInstance();
export default fileLockManager;
