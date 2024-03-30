import * as vscode from 'vscode';
import { OutputChannelLogger } from './OutputChannelLogger';

let masterLock = false;
let poFilesLocks = new Map<string, number>();

export function setMasterLock(value: boolean): void {
  masterLock = value;
  vscode.window.showInformationMessage(
    `Masterlock: ${masterLock ? 'enabled' : 'disabled'}`
  );
  OutputChannelLogger.appendLine(
    `Set: Masterlock: ${masterLock ? 'enabled' : 'disabled'}`
  );
}

//TODO: Rename to FileWatchLock? Since it blocks the file watchers from reacting to changes. Instead of not being able to write to the files.
export function addPoFilesLock(locale: string): void {
  let currentCount = poFilesLocks.get(locale);
  if (currentCount) {
    poFilesLocks.set(locale, ++currentCount);
  } else {
    poFilesLocks.set(locale, 1);
  }
  OutputChannelLogger.appendLine(
    `Added 1. Po File Locks Active for locale ${locale}: ${poFilesLocks.get(
      locale
    )}`
  );
}

export function removePoFileLock(locale: string): void {
  let currentCount = poFilesLocks.get(locale);
  if (currentCount) {
    poFilesLocks.set(locale, --currentCount);
    OutputChannelLogger.appendLine(
      `Removed 1. Po File Locks Active for locale ${locale}: ${poFilesLocks.get(
        locale
      )}`
    );
  } else {
    OutputChannelLogger.appendLine(`Po files not locked for locale: ${locale}`);
  }
}

export function isPoFileLocked(locale: string): boolean {
  OutputChannelLogger.appendLine(`Po files locked for locale: ${locale}`);

  let localeLock = poFilesLocks.get(locale);

  return localeLock !== undefined && localeLock > 0;
}

export function arePoFilesLocked(): boolean {
  let poFileLockExists = false;

  poFilesLocks.forEach((poFileLock) => {
    if (poFileLock > 0) {
      poFileLockExists = true;
      return;
    }
  });

  OutputChannelLogger.appendLine(
    `Po files locked: ${masterLock || poFileLockExists}`
  );

  return masterLock || poFileLockExists;
}

export function isMasterLockEnabled(): boolean {
  OutputChannelLogger.appendLine(
    `Master lock is ${masterLock ? 'enabled' : 'disabled'}`
  );

  return masterLock;
}
