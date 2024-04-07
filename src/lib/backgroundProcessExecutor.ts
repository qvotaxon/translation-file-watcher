import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { CallbackOnMatch } from './Types';
import path from 'path';
import FileManagement from './fileManagement';
import { LogVerbosity } from './Enums';
import outputChannelManager from './outputChannelManager';

class BackgroundProcessExecutor {
  private projectRootPath: string | undefined;
  private activeControllers: Map<
    string,
    { controller: AbortController; onCancel: () => void }
  > = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private processStatuses: Map<string, string> = new Map();

  private getCommandMapKey(command: string, args: string[]) {
    return `${command}${args.join('_').replace(/ /g, '_')}`;
  }

  private async getProjectRootPath(): Promise<string> {
    if (!this.projectRootPath) {
      const packageJsonPath = await FileManagement.getPackageJsonRelativePath();
      this.projectRootPath = path.dirname(packageJsonPath!);
    }
    return this.projectRootPath;
  }

  async executeInBackground(
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
    let projectRoot = await this.getProjectRootPath();

    outputChannelManager.appendLine(
      `Executing command: ${command} ${args.join(' ')}`,
      LogVerbosity.Important
    );
    this.processStatuses.set(this.getCommandMapKey(command, args), 'running');

    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const signal = controller.signal;

      const cancelExecution = () => {
        controller.abort();
        clearTimeout(
          this.debounceTimers.get(this.getCommandMapKey(command, args))
        );
      };

      if (this.activeControllers.has(this.getCommandMapKey(command, args))) {
        const { controller: activeController, onCancel: activeOnCancel } =
          this.activeControllers.get(this.getCommandMapKey(command, args))!;
        activeController.abort();
        activeOnCancel();
        clearTimeout(
          this.debounceTimers.get(this.getCommandMapKey(command, args))
        );
        this.processStatuses.set(
          this.getCommandMapKey(command, args),
          'canceled'
        );
        outputChannelManager.appendLine(
          `Execution of command ${command} ${args.join(' ')} canceled.`,
          LogVerbosity.Important
        );
      }

      const executeCommand = () => {
        const childProcess: ChildProcessWithoutNullStreams = spawn(
          command,
          args,
          {
            shell: 'cmd',
            cwd: projectRoot,
            signal: signal,
          }
        );

        let stdout = '';
        let stderr = '';

        childProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          stdout += output;

          outputChannelManager.appendLine(output);

          if (
            successMatchSequence &&
            callbackOnMatch &&
            output.includes(successMatchSequence)
          ) {
            callbackOnMatch(output);
          }
        });

        childProcess.stderr.on('data', (data: Buffer) => {
          const errorOutput = data.toString();
          stderr += errorOutput;

          outputChannelManager.appendLine(errorOutput);
        });

        childProcess.on('error', (error: Error) => {
          this.processStatuses.set(
            this.getCommandMapKey(command, args),
            'error'
          );
          outputChannelManager.appendLine(
            `Failed to execute command: ${command} ${args.join(
              ' '
            )}, got error: ${error}`,
            LogVerbosity.Important
          );
          reject(error);
        });

        childProcess.on('exit', (exitCode: null) => {
          this.activeControllers.delete(this.getCommandMapKey(command, args));
          clearTimeout(
            this.debounceTimers.get(this.getCommandMapKey(command, args))
          );

          if (exitCode !== null) {
            outputChannelManager.appendLine(
              `Command ${command} ${args.join(
                ' '
              )} exited with code: ${exitCode}`,
              LogVerbosity.Important
            );
            this.processStatuses.set(
              this.getCommandMapKey(command, args),
              'success'
            );
            resolve({ stdout, stderr, exitCode, cancel: cancelExecution });
          } else {
            const errorMessage = `Command ${command} ${args.join(
              ' '
            )} exited with unknown code`;
            this.processStatuses.set(
              this.getCommandMapKey(command, args),
              'error'
            );
            outputChannelManager.appendLine(
              errorMessage,
              LogVerbosity.Important
            );
            reject(new Error(errorMessage));
          }
        });
      };

      this.activeControllers.set(this.getCommandMapKey(command, args), {
        controller,
        onCancel: onCancel || (() => {}),
      });

      clearTimeout(
        this.debounceTimers.get(this.getCommandMapKey(command, args))
      );
      this.debounceTimers.set(
        this.getCommandMapKey(command, args),
        setTimeout(() => {
          executeCommand();
          outputChannelManager.appendLine(
            `Debounced execution of command: ${command} ${args.join(' ')}`,
            LogVerbosity.Important
          );
        }, 500)
      );
    });
  }
}

export default BackgroundProcessExecutor;
