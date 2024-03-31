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
  // Read the JSON data from the file
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const jsonObject: JsonObject = JSON.parse(jsonData);

  // Sort the JSON object
  const sortedObject = sortJson(jsonObject);

  // Convert the sorted JSON object to a string with indentation of 4 spaces and desired line endings
  let jsonString = JSON.stringify(sortedObject, null, 4);

  // Add a trailing newline
  jsonString += '\n';

  // Write the modified JSON string back to the file
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

//
//
//
//
//
//
//
//
//
//
//
//
//
//
//

let previousFileContents: string[] = [];
let currentFileContents: string[] = [];

// Function to handle file changes
function updateCurrentFileContents(fsPath: string) {
  // Read the current content of the file
  const fileContent = fs.readFileSync(fsPath, { encoding: 'utf8' });
  // fs.readFile(fsPath, 'utf8', (err, fileContent) => {
  //   if (err) {
  //     console.error(err);
  //     return;
  //   }

  currentFileContents[fsPath as keyof object] = fileContent;

  // });
}

function storeFileState(fsPath: string) {
  // Get the previous content of the file
  const previousData = previousFileContents[fsPath as keyof object] || '';

  // Compare the current content with the previous content
  if (currentFileContents[fsPath as keyof object] !== previousData) {
    // Content has changed
    OutputChannelLogger.appendLine(`File contents of ${fsPath} changed.`);

    // Update the previous content with the current content
    previousFileContents[fsPath as keyof object] =
      currentFileContents[fsPath as keyof object];
  }
}

// Function to extract translation keys from the changed lines
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

// Function to extract changed lines from the file
// function getChangedLines(currentData: string, previousData: string): string[] {
//   // Split the content into lines
//   const currentLines = currentData.split('\n');
//   const previousLines = previousData?.split('\n') ?? [];

//   // Find the changed lines
//   const changedLines = [];
//   for (let i = 0; i < currentLines.length; i++) {
//     if (currentLines[i] !== previousLines[i]) {
//       changedLines.push(currentLines[i]);
//     }
//   }

//   return changedLines;
// }

function getChangedLines(currentData: string, previousData: string): string[] {
  // Split the content into lines
  const currentLines = currentData.split('\n');
  const previousLines = previousData?.split('\n') ?? [];

  const changedLines = [];

  // Create maps of trimmed lines for efficient lookup
  const currentLineSet = new Set(currentLines.map((line) => line.trim()));
  const previousLineSet = new Set(previousLines.map((line) => line.trim()));

  // Find the changed lines
  for (let i = 0; i < currentLines.length; i++) {
    const currentLine = currentLines[i].trim();

    // If the line is not in the previous version, it's an added line
    if (!previousLineSet.has(currentLine)) {
      changedLines.push(currentLines[i]);
    }
  }

  // Find the removed lines
  for (let i = 0; i < previousLines.length; i++) {
    const previousLine = previousLines[i].trim();

    // If the line is not in the current version, it's a removed line
    if (!currentLineSet.has(previousLine)) {
      changedLines.push(previousLines[i]);
    }
  }

  return changedLines;
}

// Function to extract changed lines from the file
// function getChangedLines(currentData: string, previousData: string): string[] {
//   // Split the content into lines
//   const currentLines = currentData.split('\n');
//   const previousLines = previousData?.split('\n') ?? [];

//   // Compare line counts
//   if (currentLines.length !== previousLines.length) {
//     // Line counts are different, but text content might be the same
//     const minLength = Math.min(currentLines.length, previousLines.length);
//     let commonLines = 0;

//     // Find the number of common lines at the beginning
//     for (let i = 0; i < minLength; i++) {
//       if (currentLines[i] === previousLines[i]) {
//         commonLines++;
//       } else {
//         break;
//       }
//     }

//     // Calculate the number of lines added or removed
//     const linesAdded = currentLines.length - commonLines;
//     const linesRemoved = previousLines.length - commonLines;

//     // If lines are added at the top
//     if (linesAdded > linesRemoved) {
//       return currentLines.slice(0, linesAdded);
//     }
//     // If lines are removed from the top
//     else if (linesRemoved > linesAdded) {
//       return previousLines.slice(0, linesRemoved);
//     }
//   }

//   // Find the changed lines
//   const changedLines = [];
//   for (let i = 0; i < currentLines.length; i++) {
//     if (currentLines[i] !== previousLines[i]) {
//       changedLines.push(currentLines[i]);
//     }
//   }

//   return changedLines;
// }

function fileChangeContainsTranslationKeys(fsPath: string): boolean {
  // Extract translation keys from the changed lines
  const changedLines = getChangedLines(
    currentFileContents[fsPath as keyof object],
    previousFileContents[fsPath as keyof object]
  );
  const translationKeys = extractTranslationKeys(changedLines);

  // Output the found translation keys
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

  // Compare the current content with the previous content
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
      // Recursively search subdirectories
      processPOFiles(filePath, triggeredByFileWatcher, callback);
    } else if (file.endsWith('.po')) {
      // Call the callback function for *.po files
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
      // Recursively search subdirectories
      processJSONFiles(filePath, triggeredByFileWatcher, callback);
    } else if (file.endsWith('.json')) {
      // Call the callback function for *.json files
      callback(filePath, triggeredByFileWatcher);
    }
  });
}
