import * as vscode from 'vscode';
import fs from 'fs';
import { JsonObject } from './Interfaces';
import {
  extractParts,
  hasMergeMarkers,
  isFileModeManual,
} from './fileManagement';
import path from 'path';
import { getConfig } from './configurationManagement';
import {
  removePoFileLock,
  addPoFilesLock,
  isPoFileLocked,
} from './file-lock-manager';
import { FileType, LogVerbosity, TaskBarItemType } from './Enums';
import { executeInBackground } from './backgroundProcessExecution';
import { CallbackOnMatch } from './Types';
import { StatusBarManager } from './StatusBarManager';
import { OutputChannelLogger } from './OutputChannelLogger';

export function checkMergeStatus(): boolean {
  const mergeHeadPath =
    vscode.workspace.workspaceFolders![0].uri.fsPath + '/../.git/MERGE_HEAD';
  return (
    vscode.workspace.workspaceFolders !== undefined &&
    fs.existsSync(mergeHeadPath)
  );
}

export function sortJsonFile(filePath: string): void {
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const jsonObject: JsonObject = JSON.parse(jsonData);
  const sortedObject = sortJson(jsonObject);
  let jsonString = JSON.stringify(sortedObject, null, 4);

  jsonString += '\n';

  fs.writeFileSync(filePath, jsonString, 'utf-8');
}

export function sortJson(obj: JsonObject): JsonObject {
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Input must be a JSON object');
  }

  const sortedObj: JsonObject = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      const value = obj[key];
      if (typeof value === 'object' && !Array.isArray(value)) {
        sortedObj[key] = sortJson(value);
      } else {
        sortedObj[key] = value;
      }
    });
  return sortedObj;
}

export async function handlePOFileChange(
  fsPath: string,
  triggeredByFileWatcher: boolean = true
): Promise<void> {
  const statusBarManager = StatusBarManager.getInstance();
  const { jsonOutputPath, locale } = extractParts(fsPath);

  if (isPoFileLocked(locale)) {
    OutputChannelLogger.appendLine(`Po file ${locale} locked. Skipping.`);
    return;
  }

  if (isFileModeManual(FileType.Po) && triggeredByFileWatcher) {
    OutputChannelLogger.appendLine(
      'Manual mode enabled for Po files. Skipping.'
    );
    return;
  }

  if (hasMergeMarkers(jsonOutputPath) || checkMergeStatus()) {
    OutputChannelLogger.appendLine(
      'File contains Git merge markers. Sorting aborted.',
      LogVerbosity.Important
    );
    return;
  }

  OutputChannelLogger.appendLine(`Po File Changed: ${fsPath}`);
  statusBarManager.setStatusBarItemText(
    TaskBarItemType.JSON,
    '$(sync~spin) JSON'
  );

  const successMatchSequence = 'file written';
  const successMatchCallback: CallbackOnMatch = () => {
    OutputChannelLogger.appendLine(
      `Match found while loocking for ${successMatchSequence}`
    );

    statusBarManager.setStatusBarItemText(TaskBarItemType.JSON, '$(eye) JSON');
  };
  const command = 'npx';
  const args = [
    'i18next-conv',
    `-l "${locale}"`,
    `-s "${fsPath}"`,
    `-t "${jsonOutputPath}"`,
  ];
  try {
    const exitCode = await executeInBackground(
      command,
      args,
      successMatchSequence,
      successMatchCallback
    );
    OutputChannelLogger.appendLine(
      `Command executed with exit code: ${exitCode}`,
      LogVerbosity.Important
    );
  } catch (error) {
    OutputChannelLogger.appendLine(
      `Failed to execute command: ${error}`,
      LogVerbosity.Important
    );
  }

  try {
    sortJsonFile(jsonOutputPath);
  } catch (error) {
    OutputChannelLogger.appendLine(
      `Error loading sort-json: ${error}`,
      LogVerbosity.Important
    );
  }
}

export async function handleJsonFileChange(
  fsPath: string,
  triggeredByFileWatcher: boolean = true
): Promise<void> {
  const statusBarManager = StatusBarManager.getInstance();
  OutputChannelLogger.appendLine(`Json File Changed: ${fsPath}`);

  const generatePo = getConfig().get<boolean>(
    'fileGeneration.generatePo',
    true
  );

  if (
    !generatePo ||
    (isFileModeManual(FileType.Json) && triggeredByFileWatcher)
  ) {
    OutputChannelLogger.appendLine(
      'Either manual mode is enabled for Po files or Po file generation is disabled. Skipping.'
    );
    return;
  }

  if (hasMergeMarkers(fsPath) || checkMergeStatus()) {
    OutputChannelLogger.appendLine(
      'File contains Git merge markers. Sorting aborted.',
      LogVerbosity.Important
    );
    return;
  }

  const { poOutputPath, locale } = extractParts(fsPath);

  statusBarManager.setStatusBarItemText(TaskBarItemType.PO, '$(sync~spin) PO');

  const cancelCallback = () => {
    OutputChannelLogger.appendLine(
      'Removing file lock because task was cancelled.'
    );
    removePoFileLock(locale);
  };

  const successMatchSequence = 'file written';
  const successMatchCallback: CallbackOnMatch = () => {
    OutputChannelLogger.appendLine(
      `Match found while loocking for ${successMatchSequence}`
    );

    statusBarManager.setStatusBarItemText(TaskBarItemType.PO, '$(eye) PO');
    setTimeout(() => {
      // TODO: This callback should only be called when writing to the po file is done.
      // So the json file watcher shouldn't be triggered, but it is...
      // As a workaround we wait for one second after the task is finished.
      removePoFileLock(locale);
    }, 250);
  };
  const command = 'npx';
  const args = [
    'i18next-conv',
    `-l "${locale}"`,
    `-s "${fsPath}"`,
    `-t "${poOutputPath}"`,
  ];

  //TODO: error handling?
  addPoFilesLock(locale);

  try {
    const { stdout, stderr, exitCode } = await executeInBackground(
      command,
      args,
      successMatchSequence,
      successMatchCallback,
      cancelCallback
    );

    if (exitCode === 0) {
      OutputChannelLogger.appendLine(stdout);
    } else {
      OutputChannelLogger.appendLine(stderr, LogVerbosity.Important);
    }
  } catch (error) {
    OutputChannelLogger.appendLine(
      `Failed to execute command: ${error}`,
      LogVerbosity.Important
    );
  }
}

let previousFileContents: string[] = [];
let currentFileContents: string[] = [];

function updateCurrentFileContents(fsPath: string) {
  const fileContent = fs.readFileSync(fsPath, { encoding: 'utf8' });
  currentFileContents[fsPath as keyof object] = fileContent;
}

function storeFileState(fsPath: string) {
  const previousData = previousFileContents[fsPath as keyof object] || '';

  if (currentFileContents[fsPath as keyof object] !== previousData) {
    OutputChannelLogger.appendLine(`File contents of ${fsPath} changed.`);

    previousFileContents[fsPath as keyof object] =
      currentFileContents[fsPath as keyof object];
  }
}

function extractTranslationKeys(lines: string[]) {
  const translationKeys: string[] = [];
  const keyRegex = /(?:I18nKey|t)\(\s*['"`](.*?)['"`]\s*\)/g;

  lines.forEach((line: string) => {
    let match;
    while ((match = keyRegex.exec(line)) !== null) {
      translationKeys.push(match[1]);
    }
  });

  return translationKeys;
}

function getChangedLines(currentData: string, previousData: string): string[] {
  const currentLines = currentData.split('\n');
  const previousLines = previousData?.split('\n') ?? [];

  const changedLines = [];

  const currentLineSet = new Set(currentLines.map((line) => line.trim()));
  const previousLineSet = new Set(previousLines.map((line) => line.trim()));

  // Find the changed lines
  for (let i = 0; i < currentLines.length; i++) {
    const currentLine = currentLines[i].trim();

    if (!previousLineSet.has(currentLine)) {
      changedLines.push(currentLines[i]);
    }
  }

  // Find the removed lines
  for (let i = 0; i < previousLines.length; i++) {
    const previousLine = previousLines[i].trim();

    if (!currentLineSet.has(previousLine)) {
      changedLines.push(previousLines[i]);
    }
  }

  return changedLines;
}

function fileChangeContainsTranslationKeys(fsPath: string): boolean {
  const changedLines = getChangedLines(
    currentFileContents[fsPath as keyof object],
    previousFileContents[fsPath as keyof object]
  );
  const translationKeys = extractTranslationKeys(changedLines);

  console.log('Changed lines:');
  console.log(changedLines);
  console.log('Translation keys:');
  console.log(translationKeys);

  return translationKeys.length > 0;
}

export async function handleCodeFileChange(
  fsPath: string | undefined = undefined,
  triggeredByFileWatcher: boolean = true
): Promise<void> {
  const statusBarManager = StatusBarManager.getInstance();
  if (isFileModeManual(FileType.Code) && triggeredByFileWatcher) {
    OutputChannelLogger.appendLine(
      'Manual mode enabled for Po files. Skipping.'
    );
    return;
  }

  if (checkMergeStatus()) {
    OutputChannelLogger.appendLine(
      'File contains Git merge markers. Sorting aborted.',
      LogVerbosity.Important
    );
    return;
  }

  if (fsPath) {
    OutputChannelLogger.appendLine(
      `Code File (**​/*.{ts,tsx}) Changed: ${fsPath}`
    );
  } else {
    OutputChannelLogger.appendLine(`Manual code change trigger received.`);
  }

  updateCurrentFileContents(fsPath!);

  const fileChangeOccurred =
    currentFileContents[fsPath as keyof object] !==
      previousFileContents[fsPath as keyof object] || '';

  if (fileChangeOccurred && fileChangeContainsTranslationKeys(fsPath!)) {
    statusBarManager.setStatusBarItemText(
      TaskBarItemType.JSON,
      '$(sync~spin) JSON'
    );
    statusBarManager.setStatusBarItemText(
      TaskBarItemType.CODE,
      '$(search) CODE'
    );

    const i18nScannerConfigRelativePath = getConfig().get<string>(
      'i18nScannerConfigRelativePath',
      'i18next-scanner.config.js'
    );
    const command = 'npx';
    const args = [
      'i18next-scanner',
      // `"${uri.fsPath}"`, //TODO: nogmaals kijken of per file idd net zo snel is als hele project. Wel eerst removeUnusedKeys uitzetten.
      `--config ${i18nScannerConfigRelativePath}`,
    ];
    try {
      const exitCode = await executeInBackground(command, args);

      statusBarManager.setStatusBarItemText(
        TaskBarItemType.JSON,
        '$(eye) JSON'
      );
      statusBarManager.setStatusBarItemText(
        TaskBarItemType.CODE,
        '$(eye) CODE'
      );

      OutputChannelLogger.appendLine(
        `Command executed with exit code: ${exitCode}`
      );
    } catch (error) {
      OutputChannelLogger.appendLine(
        `Failed to execute command: '${command} ${args}'.\r\nCaught error: ${error}`,
        LogVerbosity.Important
      );
    }
  }

  storeFileState(fsPath!);
}

export function processPOFiles(
  directory: string,
  triggeredByFileWatcher: boolean,
  callback: (filePath: string, triggeredByFileWatcher: boolean) => void
) {
  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      processPOFiles(filePath, triggeredByFileWatcher, callback);
    } else if (file.endsWith('.po')) {
      callback(filePath, triggeredByFileWatcher);
    }
  });
}

export function processJSONFiles(
  directory: string,
  triggeredByFileWatcher: boolean,
  callback: (filePath: string, triggeredByFileWatcher: boolean) => void
) {
  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      processJSONFiles(filePath, triggeredByFileWatcher, callback);
    } else if (file.endsWith('.json')) {
      callback(filePath, triggeredByFileWatcher);
    }
  });
}
