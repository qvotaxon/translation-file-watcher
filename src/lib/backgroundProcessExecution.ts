import { spawn } from 'child_process';
import { CallbackOnMatch } from './Types';
import { window } from 'vscode';
import path from 'path';
import { getPackageJsonRelativePath } from './fileManagement';
import { LogVerbosity } from './Enums';
import { OutputChannelLogger } from './OutputChannelLogger';

let projectRootPath: string | undefined = undefined;

function getCommandMapKey(command: string, args: string[]) {
  return `${command}${args.join('_').replace(new RegExp(' ', 'g'), '_')}`;
}

async function getProjectRootPath(): Promise<string> {
  if (!projectRootPath) {
    const packageJsonPath = await getPackageJsonRelativePath();

    projectRootPath = path.dirname(packageJsonPath!);
  }

  return projectRootPath;
}

// Define a global variable to store active AbortControllers, debounce timers, process statuses, and verbosity
const activeControllers: Map<
  string,
  { controller: AbortController; onCancel: () => void }
> = new Map();
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const processStatuses: Map<string, string> = new Map(); // Map to store process statuses: "running", "success", "error", "canceled"

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
  OutputChannelLogger.appendLine(
    `Executing command: ${command} ${args.join(' ')}`,
    LogVerbosity.Important
  );
  processStatuses.set(getCommandMapKey(command, args), 'running');

  return new Promise((resolve, reject) => {
    // Create a new AbortController for this execution
    const controller = new AbortController();
    const signal = controller.signal;

    // Function to cancel the execution
    const cancelExecution = () => {
      controller.abort();
      clearTimeout(debounceTimers.get(getCommandMapKey(command, args)));
    };

    // Check if there is an active controller for the same command
    if (activeControllers.has(getCommandMapKey(command, args))) {
      // If there is an active controller, cancel it
      const { controller: activeController, onCancel: activeOnCancel } =
        activeControllers.get(getCommandMapKey(command, args))!;
      activeController.abort();
      activeOnCancel();
      clearTimeout(debounceTimers.get(getCommandMapKey(command, args)));
      processStatuses.set(getCommandMapKey(command, args), 'canceled');
      OutputChannelLogger.appendLine(
        `Execution of command ${command} ${args.join(' ')} canceled.`,
        LogVerbosity.Important
      );
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

        OutputChannelLogger.appendLine(output);

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

        OutputChannelLogger.appendLine(errorOutput);
      });

      childProcess.on('error', (error: any) => {
        processStatuses.set(getCommandMapKey(command, args), 'error');
        OutputChannelLogger.appendLine(
          `Failed to execute command: ${command} ${args.join(
            ' '
          )}, got error: ${error}`,
          LogVerbosity.Important
        );
        reject(error);
      });

      childProcess.on('exit', (exitCode: null) => {
        activeControllers.delete(getCommandMapKey(command, args)); // Remove the AbortController from the active controllers map
        clearTimeout(debounceTimers.get(getCommandMapKey(command, args)));

        if (exitCode !== null) {
          OutputChannelLogger.appendLine(
            `Command ${command} ${args.join(
              ' '
            )} exited with code: ${exitCode}`,
            LogVerbosity.Important
          );
          processStatuses.set(getCommandMapKey(command, args), 'success');
          resolve({ stdout, stderr, exitCode, cancel: cancelExecution });
        } else {
          const errorMessage = `Command ${command} ${args.join(
            ' '
          )} exited with unknown code`;
          processStatuses.set(getCommandMapKey(command, args), 'error');
          OutputChannelLogger.appendLine(errorMessage, LogVerbosity.Important);
          reject(new Error(errorMessage));
        }
      });
    };

    // Store the AbortController and onCancel callback for this command in the active controllers map
    activeControllers.set(getCommandMapKey(command, args), {
      controller,
      onCancel: onCancel || (() => {}),
    });

    // Debounce the execution of the command
    clearTimeout(debounceTimers.get(getCommandMapKey(command, args)));
    debounceTimers.set(
      getCommandMapKey(command, args),
      setTimeout(() => {
        executeCommand();
        OutputChannelLogger.appendLine(
          `Debounced execution of command: ${command} ${args.join(' ')}`,
          LogVerbosity.Important
        );
      }, 500)
    ); // Adjust the debounce time as needed
  });
}
