import { spawn } from 'child_process';
import { CallbackOnMatch } from './Types';
import { findPackageJson } from './fileManagement';
import { window } from 'vscode';
import path from 'path';

let projectRootPath: string | undefined = undefined;

async function getProjectRootPath(): Promise<string> {
  if (!projectRootPath) {
    const packageJsonPath = await getPackageJsonAbsolutePath();

    projectRootPath = path.dirname(packageJsonPath!);
  }

  return projectRootPath;
}

// Create a custom output channel for logging
const outputChannel = window.createOutputChannel('Translation File Watcher');

// Define a global variable to store active AbortControllers, debounce timers, process statuses, and verbosity
const activeControllers: Map<
  string,
  { controller: AbortController; onCancel: () => void }
> = new Map();
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const processStatuses: Map<string, string> = new Map(); // Map to store process statuses: "running", "success", "error", "canceled"
let verboseLogging = false; // Global verbosity flag, default to false

// Enum for log types
enum LogType {
  Verbose,
  Important, // Feel free to replace "Important" with a more suitable name
}

/**
 * @param {boolean} verbose Specifies whether to enable verbose logging
 */
export function setVerboseLogging(verbose: boolean) {
  verboseLogging = verbose;
}

/**
 * @param {string} message The message to log
 * @param {LogType} [logType=LogType.Verbose] Specifies the type of log message
 */
function log(message: string, logType: LogType = LogType.Verbose) {
  if (logType === LogType.Verbose && verboseLogging) {
    outputChannel.appendLine(message);
  } else if (logType === LogType.Important) {
    outputChannel.appendLine(message);
  }
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} successMatchSequence A string to watch for on stdout on the background job. When found, `callbackOnMatch` will be called.
 * @param {CallbackOnMatch} [callbackOnMatch] The method to called when `successMatchSequence` is found.
 * @param {() => void} [onCancel] Callback to be called when the task is cancelled
 * @return {*}  {Promise<{ stdout: string; stderr: string; exitCode: number, cancel: () => void }>}
 */
export async function executeInBackground(
  command: string,
  args: string[],
  successMatchSequence?: string,
  callbackOnMatch?: CallbackOnMatch,
  onCancel?: () => void
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  cancel: () => void;
}> {
  let projectRoot = await getProjectRootPath();

  // Log the start of the execution
  log(`Executing command: ${command} ${args.join(' ')}`, LogType.Important);
  processStatuses.set(command, 'running');

  return new Promise((resolve, reject) => {
    // Create a new AbortController for this execution
    const controller = new AbortController();
    const signal = controller.signal;

    // Function to cancel the execution
    const cancelExecution = () => {
      controller.abort();
      clearTimeout(debounceTimers.get(command));
    };

    // Check if there is an active controller for the same command
    if (activeControllers.has(command)) {
      // If there is an active controller, cancel it
      const { controller: activeController, onCancel: activeOnCancel } =
        activeControllers.get(command)!;
      activeController.abort();
      activeOnCancel();
      clearTimeout(debounceTimers.get(command));
      processStatuses.set(command, 'canceled');
      log(`Execution of command ${command} canceled.`, LogType.Important);
    }

    // Function to execute the command after debouncing
    const executeCommand = () => {
      const childProcess = spawn(command, args, {
        shell: 'cmd',
        cwd: projectRoot,
        signal: signal, // Pass the abort signal to the child process
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data: { toString: () => any }) => {
        const output = data.toString();
        stdout += output;

        log(output);

        if (
          successMatchSequence &&
          callbackOnMatch &&
          output.includes(successMatchSequence)
        ) {
          callbackOnMatch(output);
        }
      });

      childProcess.stderr.on('data', (data: { toString: () => string }) => {
        const errorOutput = data.toString();
        stderr += errorOutput;

        log(errorOutput);
      });

      childProcess.on('error', (error: any) => {
        console.error('Failed to execute command:', error);
        processStatuses.set(command, 'error');
        log(`Failed to execute command: ${error}`, LogType.Important);
        reject(error);
      });

      childProcess.on('exit', (exitCode: null) => {
        activeControllers.delete(command); // Remove the AbortController from the active controllers map
        clearTimeout(debounceTimers.get(command));

        if (exitCode !== null) {
          log(
            `Command ${command} exited with code: ${exitCode}`,
            LogType.Important
          );
          processStatuses.set(command, 'success');
          resolve({ stdout, stderr, exitCode, cancel: cancelExecution });
        } else {
          const errorMessage = `Command ${command} exited with unknown code`;
          console.error(errorMessage);
          processStatuses.set(command, 'error');
          log(errorMessage, LogType.Important);
          reject(new Error(errorMessage));
        }
      });
    };

    // Store the AbortController and onCancel callback for this command in the active controllers map
    activeControllers.set(command, {
      controller,
      onCancel: onCancel || (() => {}),
    });

    // Debounce the execution of the command
    clearTimeout(debounceTimers.get(command));
    debounceTimers.set(
      command,
      setTimeout(() => {
        executeCommand();
        log(`Debounced execution of command: ${command}`, LogType.Important);
      }, 500)
    ); // Adjust the debounce time as needed
  });
}

// Function to show the output channel
export function showOutputChannel() {
  outputChannel.show();
}
