import path from 'path';
import vscode from 'vscode';
import fs from 'fs';
import { FileType, LogVerbosity, StatusBarItemType } from './Enums';
import { CallbackOnMatch } from './Types';
import statusBarManager from './statusBarManager';
import configurationManager from './configurationManager';
import { JsonObject } from './Interfaces';
import FileManagement from './fileManagement';
import fileLockManager from './fileLockManager';
import outputChannelManager from './outputChannelManager';
import BackgroundProcessExecutor from './backgroundProcessExecutor';

class FileChangeHandler {
  private static instance: FileChangeHandler;
  private static previousFileContents: string[] = [];
  private static currentFileContents: string[] = [];
  private static backgroundProcessExecutor: BackgroundProcessExecutor =
    new BackgroundProcessExecutor();

  private constructor() {}

  public static getInstance(): FileChangeHandler {
    if (!FileChangeHandler.instance) {
      FileChangeHandler.instance = new FileChangeHandler();
    }
    return FileChangeHandler.instance;
  }

  public async handlePOFileChange(
    fsPath: string,
    triggeredByFileWatcher: boolean = true
  ): Promise<void> {
    const { jsonOutputPath, locale } = FileManagement.extractParts(fsPath);

    if (fileLockManager.isPoFileLocked(locale)) {
      outputChannelManager.appendLine(`Po file ${locale} locked. Skipping.`);
      return;
    }

    if (
      FileManagement.isFileModeManual(FileType.Po) &&
      triggeredByFileWatcher
    ) {
      outputChannelManager.appendLine(
        'Manual mode enabled for Po files. Skipping.'
      );
      return;
    }

    if (
      FileManagement.hasMergeMarkers(jsonOutputPath) ||
      FileChangeHandler.checkMergeStatus()
    ) {
      outputChannelManager.appendLine(
        'File contains Git merge markers. Sorting aborted.',
        LogVerbosity.Important
      );
      return;
    }

    outputChannelManager.appendLine(`Po File Changed: ${fsPath}`);
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.JSON,
      '$(sync~spin) JSON'
    );

    const successMatchSequence = 'file written';
    const successMatchCallback: CallbackOnMatch = () => {
      outputChannelManager.appendLine(
        `Match found while loocking for ${successMatchSequence}`
      );

      statusBarManager.setStatusBarItemText(
        StatusBarItemType.JSON,
        '$(eye) JSON'
      );
    };
    const command = 'npx';
    const args = [
      'i18next-conv',
      `-l "${locale}"`,
      `-s "${fsPath}"`,
      `-t "${jsonOutputPath}"`,
    ];
    try {
      const executionResult =
        await FileChangeHandler.backgroundProcessExecutor.executeInBackground(
          command,
          args,
          successMatchSequence,
          successMatchCallback
        );
      outputChannelManager.appendLine(
        `Command executed with exit code: ${executionResult.exitCode}`,
        LogVerbosity.Important
      );
    } catch (error) {
      outputChannelManager.appendLine(
        `Failed to execute command: ${error}`,
        LogVerbosity.Important
      );
    }

    try {
      FileChangeHandler.sortJsonFile(jsonOutputPath);
    } catch (error) {
      outputChannelManager.appendLine(
        `Error loading sort-json: ${error}`,
        LogVerbosity.Important
      );
    }
  }

  public async handleJsonFileChange(
    fsPath: string,
    triggeredByFileWatcher: boolean = true
  ): Promise<void> {
    outputChannelManager.appendLine(`Json File Changed: ${fsPath}`);

    const generatePo = configurationManager
      .getConfig()
      .get<boolean>('fileGeneration.generatePo', true);

    if (
      !generatePo ||
      (FileManagement.isFileModeManual(FileType.Json) && triggeredByFileWatcher)
    ) {
      outputChannelManager.appendLine(
        'Either manual mode is enabled for Po files or Po file generation is disabled. Skipping.'
      );
      return;
    }

    if (
      FileManagement.hasMergeMarkers(fsPath) ||
      FileChangeHandler.checkMergeStatus()
    ) {
      outputChannelManager.appendLine(
        'File contains Git merge markers. Sorting aborted.',
        LogVerbosity.Important
      );
      return;
    }

    const { poOutputPath, locale } = FileManagement.extractParts(fsPath);

    statusBarManager.setStatusBarItemText(
      StatusBarItemType.PO,
      '$(sync~spin) PO'
    );

    const cancelCallback = () => {
      outputChannelManager.appendLine(
        'Removing file lock because task was cancelled.'
      );
      fileLockManager.removePoFileLock(locale);
    };

    const successMatchSequence = 'file written';
    const successMatchCallback: CallbackOnMatch = () => {
      outputChannelManager.appendLine(
        `Match found while loocking for ${successMatchSequence}`
      );

      statusBarManager.setStatusBarItemText(StatusBarItemType.PO, '$(eye) PO');
      setTimeout(() => {
        // TODO: This callback should only be called when writing to the po file is done.
        // So the json file watcher shouldn't be triggered, but it is...
        // As a workaround we wait for one second after the task is finished.
        fileLockManager.removePoFileLock(locale);
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
    fileLockManager.addPoFilesLock(locale);

    try {
      const { stdout, stderr, exitCode } =
        await FileChangeHandler.backgroundProcessExecutor.executeInBackground(
          command,
          args,
          successMatchSequence,
          successMatchCallback,
          cancelCallback
        );

      if (exitCode === 0) {
        outputChannelManager.appendLine(stdout);
      } else {
        outputChannelManager.appendLine(stderr, LogVerbosity.Important);
      }
    } catch (error) {
      outputChannelManager.appendLine(
        `Failed to execute command: ${error}`,
        LogVerbosity.Important
      );
    }
  }

  public async handleCodeFileChange(
    fsPath: string | undefined = undefined,
    triggeredByFileWatcher: boolean = true
  ): Promise<void> {
    if (
      FileManagement.isFileModeManual(FileType.Code) &&
      triggeredByFileWatcher
    ) {
      outputChannelManager.appendLine(
        'Manual mode enabled for Po files. Skipping.'
      );
      return;
    }

    if (FileChangeHandler.checkMergeStatus()) {
      outputChannelManager.appendLine(
        'File contains Git merge markers. Sorting aborted.',
        LogVerbosity.Important
      );
      return;
    }

    if (fsPath) {
      outputChannelManager.appendLine(
        `Code File (**​/*.{ts,tsx}) Changed: ${fsPath}`
      );
    } else {
      outputChannelManager.appendLine(`Manual code change trigger received.`);
    }

    FileChangeHandler.updatecurrentFileContents(fsPath!);

    const fileChangeOccurred =
      FileChangeHandler.currentFileContents[fsPath as keyof object] !==
        FileChangeHandler.previousFileContents[fsPath as keyof object] || '';

    if (
      fileChangeOccurred &&
      FileChangeHandler.fileChangeContainsTranslationKeys(fsPath!)
    ) {
      statusBarManager.setStatusBarItemText(
        StatusBarItemType.JSON,
        '$(sync~spin) JSON'
      );
      statusBarManager.setStatusBarItemText(
        StatusBarItemType.CODE,
        '$(search) CODE'
      );

      const i18nScannerConfigRelativePath = configurationManager
        .getConfig()
        .get<string>(
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
        const executionResult =
          await FileChangeHandler.backgroundProcessExecutor.executeInBackground(
            command,
            args
          );

        statusBarManager.setStatusBarItemText(
          StatusBarItemType.JSON,
          '$(eye) JSON'
        );
        statusBarManager.setStatusBarItemText(
          StatusBarItemType.CODE,
          '$(eye) CODE'
        );

        outputChannelManager.appendLine(
          `Command executed with exit code: ${executionResult.exitCode}`
        );
      } catch (error: any) {
        outputChannelManager.appendLine(
          `Failed to execute command: '${command} ${args}'.\r\nCaught error: ${error}`,
          LogVerbosity.Important
        );

        if (error.code !== 'ABORT_ERR') {
          statusBarManager.setStatusBarItemText(
            StatusBarItemType.JSON,
            '$(eye) JSON'
          );
          statusBarManager.setStatusBarItemText(
            StatusBarItemType.CODE,
            '$(eye) CODE'
          );
        }
      }
    }

    FileChangeHandler.storeFileState(fsPath!);
  }

  public processPOFiles = (
    directory: string,
    triggeredByFileWatcher: boolean,
    callback: (filePath: string, triggeredByFileWatcher: boolean) => void
  ) => {
    fs.readdirSync(directory).forEach((file) => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fileChangeHandler.processPOFiles(
          filePath,
          triggeredByFileWatcher,
          callback
        );
      } else if (file.endsWith('.po')) {
        callback(filePath, triggeredByFileWatcher);
      }
    });
  };

  public processJSONFiles = (
    directory: string,
    triggeredByFileWatcher: boolean,
    callback: (filePath: string, triggeredByFileWatcher: boolean) => void
  ) => {
    fs.readdirSync(directory).forEach((file) => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fileChangeHandler.processJSONFiles(
          filePath,
          triggeredByFileWatcher,
          callback
        );
      } else if (file.endsWith('.json')) {
        callback(filePath, triggeredByFileWatcher);
      }
    });
  };

  private static checkMergeStatus = (): boolean => {
    const mergeHeadPath =
      vscode.workspace.workspaceFolders![0].uri.fsPath + '/../.git/MERGE_HEAD';
    return (
      vscode.workspace.workspaceFolders !== undefined &&
      fs.existsSync(mergeHeadPath)
    );
  };

  private static sortJsonFile = (filePath: string): void => {
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const jsonObject: JsonObject = JSON.parse(jsonData);
    const sortedObject = FileChangeHandler.sortJson(jsonObject);
    let jsonString = JSON.stringify(sortedObject, null, 4);

    jsonString += '\n';

    fs.writeFileSync(filePath, jsonString, 'utf-8');
  };

  private static sortJson = (obj: JsonObject): JsonObject => {
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Input must be a JSON object');
    }

    const sortedObj: JsonObject = {};
    Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        const value = obj[key];
        if (typeof value === 'object' && !Array.isArray(value)) {
          sortedObj[key] = FileChangeHandler.sortJson(value);
        } else {
          sortedObj[key] = value;
        }
      });
    return sortedObj;
  };

  private static updatecurrentFileContents = (fsPath: string) => {
    const fileContent = fs.readFileSync(fsPath, { encoding: 'utf8' });
    FileChangeHandler.currentFileContents[fsPath as keyof object] = fileContent;
  };

  private static storeFileState = (fsPath: string) => {
    const previousData =
      FileChangeHandler.previousFileContents[fsPath as keyof object] || '';

    if (
      FileChangeHandler.currentFileContents[fsPath as keyof object] !==
      previousData
    ) {
      outputChannelManager.appendLine(`File contents of ${fsPath} changed.`);

      FileChangeHandler.previousFileContents[fsPath as keyof object] =
        FileChangeHandler.currentFileContents[fsPath as keyof object];
    }
  };

  private static extractTranslationKeys = (lines: string[]) => {
    const translationKeys: string[] = [];
    const keyRegex = /(?:I18nKey|t)\(\s*['"`](.*?)['"`]\s*\)/g;

    lines.forEach((line: string) => {
      let match;
      while ((match = keyRegex.exec(line)) !== null) {
        translationKeys.push(match[1]);
      }
    });

    return translationKeys;
  };

  private static getChangedLines = (
    currentData: string,
    previousData: string
  ): string[] => {
    const currentLines = currentData.split('\n');
    const previousLines = previousData?.split('\n') ?? [];

    const changedLines = [];

    const currentLineSet = new Set(currentLines.map((line) => line.trim()));
    const previousLineSet = new Set(previousLines.map((line) => line.trim()));

    // Find the changed lines
    for (const element of currentLines) {
      const currentLine = element.trim();

      if (!previousLineSet.has(currentLine)) {
        changedLines.push(element);
      }
    }

    // Find the removed lines
    for (const element of previousLines) {
      const previousLine = element.trim();

      if (!currentLineSet.has(previousLine)) {
        changedLines.push(element);
      }
    }

    return changedLines;
  };

  private static fileChangeContainsTranslationKeys(fsPath: string): boolean {
    const changedLines = FileChangeHandler.getChangedLines(
      FileChangeHandler.currentFileContents[fsPath as keyof object],
      FileChangeHandler.previousFileContents[fsPath as keyof object]
    );
    const translationKeys =
      FileChangeHandler.extractTranslationKeys(changedLines);

    console.log('Changed lines:');
    console.log(changedLines);
    console.log('Translation keys:');
    console.log(translationKeys);

    return translationKeys.length > 0;
  }
}

const fileChangeHandler = FileChangeHandler.getInstance();
export default fileChangeHandler;
