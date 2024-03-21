import * as vscode from 'vscode';
import { createFileWatcher } from './lib/file-watcher';
import {
  arePoFilesLocked,
  addPoFilesLock,
  setMasterLock,
  isMasterLockEnabled,
  removePoFileLock,
} from './lib/file-lock-manager';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface JsonObject {
  [key: string]: any;
}

let projectRootPath: string | undefined = undefined;
let poFileWatcherStatusBarItem: vscode.StatusBarItem;
let jsonFileWatcherStatusBarItem: vscode.StatusBarItem;
let codeFileWatcherStatusBarItem: vscode.StatusBarItem;
type CallbackOnMatch = (output: string) => void;

function hasMergeMarkers(filePath: string): boolean {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  // Check if the file content contains any Git merge markers
  return /<<<<<<<|=======|>>>>>>>/.test(fileContent);
}

function checkMergeStatus(): boolean {
  const mergeHeadPath =
    vscode.workspace.workspaceFolders![0].uri.fsPath + '/../.git/MERGE_HEAD';
  return (
    vscode.workspace.workspaceFolders !== undefined &&
    fs.existsSync(mergeHeadPath)
  );
}

function getLastThreeDirectories(
  directoryPath: string,
  maxLength = 200
): string {
  const pathComponents = directoryPath.split(/[\\/]/).filter(Boolean);
  const lastThreePaths = pathComponents.slice(-3).join('/');

  if (lastThreePaths.length > maxLength) {
    return directoryPath;
  } else {
    return lastThreePaths;
  }
}

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('translationFileWatcher');
}

function extractParts(filePath: string): {
  jsonOutputPath: string;
  poOutputPath: string;
  locale: string;
} {
  const localePattern = /\\locales\\([^\\]+)\\/;
  const match = localePattern.exec(filePath);

  if (!match || match.length < 2) {
    throw new Error('Invalid file path format');
  }

  const locale = match[1];
  const isPOFile = filePath.endsWith('.po');
  const extension = isPOFile ? 'json' : 'po';

  const commonPath = filePath.replace(/\.po$|\.json$/, '');
  const jsonOutputPath = isPOFile ? `${commonPath}.${extension}` : filePath;
  const poOutputPath = !isPOFile ? `${commonPath}.${extension}` : filePath;

  return { jsonOutputPath, poOutputPath, locale };
}

async function findPackageJson(): Promise<string | undefined> {
  const packageJsonAbsolutePath = getConfig().get<string>(
    'packageJsonAbsolutePath'
  );

  if (packageJsonAbsolutePath) {
    if (!fs.existsSync(packageJsonAbsolutePath)) {
      vscode.window.showErrorMessage(
        `The configured absolute json path (${packageJsonAbsolutePath}) does not exist. Please check your configuration.`
      );
      deactivate();
      return;
    }

    return packageJsonAbsolutePath;
  }

  const files = await vscode.workspace.findFiles('**/package.json');
  if (files.length > 0) {
    return files[0].fsPath;
  }
  return undefined;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} successMatchSequence A string to watch for on stdout on the background job. When found, `callbackOnMatch` will be called.
 * @param {CallbackOnMatch} [callbackOnMatch] The method to called when `successMatchSequence` is found.
 * @return {*}  {Promise<{ stdout: string; stderr: string; exitCode: number }>}
 */
function executeInBackground(
  command: string,
  args: string[],
  successMatchSequence?: string,
  callbackOnMatch?: CallbackOnMatch
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      shell: 'cmd',
      cwd: projectRootPath,
      // cwd: `${vscode.workspace.workspaceFolders![0].uri.fsPath}`,
    });
    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      console.log(output);
      if (
        successMatchSequence &&
        callbackOnMatch &&
        output.includes(successMatchSequence)
      ) {
        callbackOnMatch(output);
      }
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('error', (error) => {
      console.error('Failed to execute command:', error);
      reject(error);
    });

    childProcess.on('exit', (exitCode) => {
      if (exitCode !== null) {
        console.log('Command exited with code:', exitCode);
        resolve({ stdout, stderr, exitCode });
      } else {
        const errorMessage = 'Command exited with unknown code';
        console.error(errorMessage);
        reject(new Error(errorMessage));
      }
    });
  });
}

function sortJsonFile(filePath: string): void {
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

function sortJson(obj: JsonObject): JsonObject {
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

async function handlePOFileChange(fsPath: string): Promise<void> {
  const { jsonOutputPath, locale } = extractParts(fsPath);

  if (hasMergeMarkers(jsonOutputPath) || checkMergeStatus()) {
    console.error('File contains Git merge markers. Sorting aborted.');
    return;
  }

  console.log(`Po File Changed: ${fsPath}`);
  poFileWatcherStatusBarItem.text = '$(loading~spin) PO';

  const successMatchSequence = 'file written';
  const successMatchCallback: CallbackOnMatch = () => {
    console.log(`Match found while loocking for ${successMatchSequence}`);
    setTimeout(() => {
      // TODO: This callback should only be called when writing to the file is done.
      // So the file watcher shouldn't be triggered, but it is...
      // As a workaround we wait for one second after the task is finished.
      // See handleJsonFileChange todo for a better example.
      poFileWatcherStatusBarItem.text = '$(check) PO';

      setTimeout(() => {
        poFileWatcherStatusBarItem.text = '$(eye) PO';
      }, 2000);
    }, 1000);
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
    console.log('Command executed with exit code:', exitCode);
  } catch (error) {
    console.error('Failed to execute command:', error);
  }

  try {
    sortJsonFile(jsonOutputPath);

    // const options = { ignoreCase: false, reverse: false, depth: 1 };
    // const sortJson = await import('sort-json').then((module) => module.default);
    // sortJson.overwrite(`"${jsonOutputPath}"`, options);
    // const jsonSortCommand = 'npx';
    // const jsonSortArgs = [
    //   'json-sort-cli',
    //   `"${jsonOutputPath}"`,
    //   `"${jsonOutputPath}"`,
    // ];
    // try {
    //   const exitCode = await executeInBackground(jsonSortCommand, jsonSortArgs);
    //   console.log('Command executed with exit code:', exitCode);
    // } catch (error) {
    //   console.error('Failed to execute command:', error);
    // }
  } catch (error) {
    console.error('Error loading sort-json:', error);
  }
}

async function handleJsonFileChange(fsPath: string): Promise<void> {
  console.log(`Json File Changed: ${fsPath}`);

  const generatePo = getConfig().get<boolean>('generatePo', true);

  if (!generatePo) {
    console.error(
      'Po file generation is disabled by extension settings. Skipping.'
    );
    return;
  }

  if (hasMergeMarkers(fsPath) || checkMergeStatus()) {
    console.error('File contains Git merge markers. Sorting aborted.');
    return;
  }

  jsonFileWatcherStatusBarItem.text = '$(loading~spin) JSON';

  const successMatchSequence = 'file written';
  const successMatchCallback: CallbackOnMatch = () => {
    console.log(`Match found while loocking for ${successMatchSequence}`);
    setTimeout(() => {
      // TODO: This callback should only be called when writing to the po file is done.
      // So the json file watcher shouldn't be triggered, but it is...
      // As a workaround we wait for one second after the task is finished.
      removePoFileLock();
      jsonFileWatcherStatusBarItem.text = '$(check) JSON';
      setTimeout(() => {
        jsonFileWatcherStatusBarItem.text = '$(eye) JSON';
      }, 2000);
    }, 1000);
  };
  const { poOutputPath, locale } = extractParts(fsPath);
  const command = 'npx';
  const args = [
    'i18next-conv',
    `-l "${locale}"`,
    `-s "${fsPath}"`,
    `-t "${poOutputPath}"`,
  ];

  //TODO: error handling?
  addPoFilesLock();

  try {
    const { stdout, stderr, exitCode } = await executeInBackground(
      command,
      args,
      successMatchSequence,
      successMatchCallback
    );

    if (exitCode === 0) {
      console.log(stdout);
    } else {
      console.error(stderr);
    }
  } catch (error) {
    console.error('Failed to execute command:', error);
  }
}

async function handleCodeFileChange(
  fsPath: string | undefined = undefined
): Promise<void> {
  if (checkMergeStatus()) {
    console.error('File contains Git merge markers. Sorting aborted.');
    return;
  }

  if (fsPath) {
    console.log(`Code File (**​/*.{ts,tsx}) Changed: ${fsPath}`);
  } else {
    console.log(`Manual code change trigger received.`);
  }

  codeFileWatcherStatusBarItem.text = '$(loading~spin) CODE';

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

    codeFileWatcherStatusBarItem.text = '$(check) CODE';
    setTimeout(() => {
      codeFileWatcherStatusBarItem.text = '$(eye) CODE';
    }, 2000);

    console.log('Command executed with exit code:', exitCode);
  } catch (error) {
    console.error('Failed to execute command:', error);
  }
}

function processPOFiles(
  directory: string,
  callback: (filePath: string) => void
) {
  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      processPOFiles(filePath, callback);
    } else if (file.endsWith('.po')) {
      // Call the callback function for *.po files
      callback(filePath);
    }
  });
}

function processJSONFiles(
  directory: string,
  callback: (filePath: string) => void
) {
  fs.readdirSync(directory).forEach((file) => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      processJSONFiles(filePath, callback);
    } else if (file.endsWith('.json')) {
      // Call the callback function for *.json files
      callback(filePath);
    }
  });
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activated Translation File Watcher Extension');

  initializeStatusBarIcons();
  initializeConfigurationWatcher(context);

  vscode.window.showInformationMessage(
    'Activated Translation File Watcher Extension.'
  );

  const packageJsonPath = await findPackageJson();
  if (packageJsonPath) {
    projectRootPath = path.dirname(packageJsonPath);
    vscode.window.setStatusBarMessage(
      `TFW: ${getLastThreeDirectories(
        projectRootPath,
        100
      )} used as project directory.`,
      7500
    );
  }

  poFileWatcherStatusBarItem.show();
  jsonFileWatcherStatusBarItem.show();
  codeFileWatcherStatusBarItem.show();

  /**
   * TODO> Move to seperate function
   */
  const localesAbsolutePath = getConfig().get<string>('localesAbsolutePath');
  if (localesAbsolutePath) {
    let poFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.poFileWatcherStatusBarItemClicked',
        () => {
          processJSONFiles(localesAbsolutePath, handleJsonFileChange);
          vscode.window.showInformationMessage('Generating PO files.');
        }
      );

    poFileWatcherStatusBarItem.command =
      'extension.poFileWatcherStatusBarItemClicked';

    let jsonFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.jsonFileWatcherStatusBarItemClicked',
        () => {
          processPOFiles(localesAbsolutePath, handlePOFileChange);
          vscode.window.showInformationMessage('Generating JSON files.');
        }
      );

    jsonFileWatcherStatusBarItem.command =
      'extension.jsonFileWatcherStatusBarItemClicked';

    let codeFileWatcherStatusBarItemClickedCommand =
      vscode.commands.registerCommand(
        'extension.codeFileWatcherStatusBarItemClicked',
        () => {
          handleCodeFileChange(),
            vscode.window.showInformationMessage('Generating JSON files.');
        }
      );

    codeFileWatcherStatusBarItem.command =
      'extension.codeFileWatcherStatusBarItemClicked';

    context.subscriptions.push(
      poFileWatcherStatusBarItemClickedCommand,
      jsonFileWatcherStatusBarItemClickedCommand,
      codeFileWatcherStatusBarItemClickedCommand
    );
  } else {
    vscode.window.showErrorMessage(
      'Please configure a locales path in the extension settings.'
    );
  }

  const poFileWatcher = createFileWatcher(
    '**/locales/**/*.po',
    handlePOFileChange,
    isMasterLockEnabled,
    arePoFilesLocked
  );

  const codeFileWatcher = createFileWatcher(
    '**/{apps,libs}/**/*.{tsx,ts}',
    handleCodeFileChange,
    isMasterLockEnabled
  );
  const jsonFileWatcher = createFileWatcher(
    '**/locales/**/*.json',
    handleJsonFileChange,
    isMasterLockEnabled
  );

  const defaultFileLockOnBoot = getConfig().get<boolean>(
    'defaultFileLockOnBoot',
    false
  );
  setMasterLock(defaultFileLockOnBoot);

  context.subscriptions.push(poFileWatcher, codeFileWatcher, jsonFileWatcher);
}

vscode.commands.registerCommand(
  'translation-file-watcher.toggleFileWatchers',
  () => {
    setMasterLock(!isMasterLockEnabled());
  }
);

function initializeStatusBarIcons() {
  // if (!poFileWatcherStatusBarItem) {
  poFileWatcherStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  poFileWatcherStatusBarItem.text = '$(eye) PO';
  poFileWatcherStatusBarItem.tooltip =
    'Watching PO files (click to generate PO files)';
  // }
  // if (!codeFileWatcherStatusBarItem) {
  codeFileWatcherStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  codeFileWatcherStatusBarItem.text = '$(eye) CODE';
  codeFileWatcherStatusBarItem.tooltip =
    'Watching code files (click to generate JSON files)';

  // }
  // if (!jsonFileWatcherStatusBarItem) {
  jsonFileWatcherStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  jsonFileWatcherStatusBarItem.text = '$(eye) JSON';
  jsonFileWatcherStatusBarItem.tooltip =
    'Watching JSON files (click to generate JSON files)';
  // }
}

function initializeConfigurationWatcher(context: vscode.ExtensionContext) {
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('translationFileWatcher')) {
      vscode.window.showInformationMessage(
        'Detected configuration change. Reinitalizing Translation File Watcher extension.'
      );
      deactivate();
      activate(context);
    }
  });
}

export function deactivate() {
  // Dispose of status bar items when the extension is deactivated
  poFileWatcherStatusBarItem.dispose();
  jsonFileWatcherStatusBarItem.dispose();
  codeFileWatcherStatusBarItem.dispose();

  console.log('Deactivated Translation File Watcher Extension');
}
