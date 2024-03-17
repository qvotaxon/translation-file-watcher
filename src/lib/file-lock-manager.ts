import * as vscode from 'vscode';

// Random comment to bump version using github actions...
// Remove...
// another one

let masterLock = false;
let poFilesLocks = 0;

export function setMasterLock(value: boolean): void {
  masterLock = value;
  vscode.window.showInformationMessage(
    `Masterlock: ${masterLock ? 'enabled' : 'disabled'}`
  );
  console.log(`Set: Masterlock: ${masterLock ? 'enabled' : 'disabled'}`);
}

//TODO: Rename to FileWatchLock? Since it blocks the file watchers from reacting to changes. Instead of not being able to write to the files.
export function addPoFilesLock(): void {
  poFilesLocks++;
  console.log(`Added 1. Po File Locks Active: ${poFilesLocks}`);
}

export function removePoFileLock(): void {
  poFilesLocks--;
  console.log(`Removed 1. Po File Locks Active: ${poFilesLocks}`);
}

export function arePoFilesLocked(): boolean {
  console.log(`Po files locked: ${masterLock || poFilesLocks > 0}`);
  return masterLock || poFilesLocks > 0;
}

export function isMasterLockEnabled(): boolean {
  // console.log(`Masterlock: ${masterLock ? 'enabled' : 'disabled'}`);
  return masterLock;
}
