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

let projectRootPath: string | undefined = undefined;
const poFileWatcherStatusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);
poFileWatcherStatusBarItem.text = '$(eye) PO';
poFileWatcherStatusBarItem.tooltip = 'Watching PO files';

const jsonFileWatcherStatusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);
jsonFileWatcherStatusBarItem.text = '$(eye) JSON';
jsonFileWatcherStatusBarItem.tooltip = 'Watching JSON files';

const codeFileWatcherStatusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);
codeFileWatcherStatusBarItem.text = '$(eye) CODE';
codeFileWatcherStatusBarItem.tooltip = 'Watching code files';

type CallbackOnMatch = (output: string) => void;

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

async function handlePOFileChange(uri: vscode.Uri): Promise<void> {
  console.log(`Po File Changed: ${uri.fsPath}`);
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
  const { jsonOutputPath, locale } = extractParts(uri.fsPath);
  const command = 'npx';
  const args = [
    'i18next-conv',
    `-l "${locale}"`,
    `-s "${uri.fsPath}"`,
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
}

async function handleJsonFileChange(uri: vscode.Uri): Promise<void> {
  console.log(`Json File Changed: ${uri.fsPath}`);
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
  const { poOutputPath, locale } = extractParts(uri.fsPath);
  const command = 'npx';
  const args = [
    'i18next-conv',
    `-l "${locale}"`,
    `-s "${uri.fsPath}"`,
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

async function handleCodeFileChange(uri: vscode.Uri): Promise<void> {
  console.log(`Code File (**​/*.{ts,tsx}) Changed: ${uri.fsPath}`);
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

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activated Translation File Watcher Extension');

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
    // Set the root path as the current working directory for subsequent commands
    // vscode.workspace.updateWorkspaceFolders(0, null, {
    //   uri: vscode.Uri.file(rootPath),
    // });
  }

  poFileWatcherStatusBarItem.show();
  jsonFileWatcherStatusBarItem.show();
  codeFileWatcherStatusBarItem.show();

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

  context.subscriptions.push(poFileWatcher, codeFileWatcher, jsonFileWatcher);
}

vscode.commands.registerCommand(
  'translation-file-watcher.toggleFileWatchers',
  () => {
    setMasterLock(!isMasterLockEnabled());
  }
);

export function deactivate() {
  // Dispose of status bar items when the extension is deactivated
  poFileWatcherStatusBarItem.dispose();
  jsonFileWatcherStatusBarItem.dispose();
  codeFileWatcherStatusBarItem.dispose();

  console.log('Deactivated Translation File Watcher Extension');
}
