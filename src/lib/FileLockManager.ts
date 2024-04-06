import * as vscode from 'vscode';
import { OutputChannelLogger } from './OutputChannelLogger';

export class FileLockManager {
  private static instance: FileLockManager;
  private masterLock: boolean = false;
  private poFilesLocks: Map<string, number> = new Map<string, number>();

  private constructor() {}

  public static getInstance(): FileLockManager {
    if (!FileLockManager.instance) {
      FileLockManager.instance = new FileLockManager();
    }
    return FileLockManager.instance;
  }

  public setMasterLock(value: boolean): void {
    this.masterLock = value;
    vscode.window.showInformationMessage(
      `Masterlock: ${this.masterLock ? 'enabled' : 'disabled'}`
    );
    OutputChannelLogger.getInstance().appendLine(
      `Set: Masterlock: ${this.masterLock ? 'enabled' : 'disabled'}`
    );
  }

  public addPoFilesLock(locale: string): void {
    let currentCount = this.poFilesLocks.get(locale) || 0;
    this.poFilesLocks.set(locale, currentCount + 1);
    OutputChannelLogger.getInstance().appendLine(
      `Added 1. Po File Locks Active for locale ${locale}: ${this.poFilesLocks.get(
        locale
      )}`
    );
  }

  public removePoFileLock(locale: string): void {
    let currentCount = this.poFilesLocks.get(locale) || 0;
    if (currentCount > 0) {
      this.poFilesLocks.set(locale, currentCount - 1);
      OutputChannelLogger.getInstance().appendLine(
        `Removed 1. Po File Locks Active for locale ${locale}: ${this.poFilesLocks.get(
          locale
        )}`
      );
    } else {
      OutputChannelLogger.getInstance().appendLine(
        `Po files not locked for locale: ${locale}`
      );
    }
  }

  public isPoFileLocked(locale: string): boolean {
    OutputChannelLogger.getInstance().appendLine(
      `Po files locked for locale: ${locale}`
    );

    let localeLock = this.poFilesLocks.get(locale);

    return localeLock !== undefined && localeLock > 0;
  }

  public arePoFilesLocked(): boolean {
    let poFileLockExists = false;

    this.poFilesLocks.forEach((poFileLock) => {
      if (poFileLock > 0) {
        poFileLockExists = true;
        return;
      }
    });

    OutputChannelLogger.getInstance().appendLine(
      `Po files locked: ${this.masterLock || poFileLockExists}`
    );

    return this.masterLock || poFileLockExists;
  }

  public isMasterLockEnabled(): boolean {
    OutputChannelLogger.getInstance().appendLine(
      `Master lock is ${this.masterLock ? 'enabled' : 'disabled'}`
    );

    return this.masterLock;
  }
}
