import { spawn } from 'child_process';
import { CallbackOnMatch } from './Types';
import { getPackageJsonAbsolutePath } from './fileManagement';
import path from 'path';

let projectRootPath: string | undefined = undefined;

async function getProjectRootPath(): Promise<string> {
  if (!projectRootPath) {
    const packageJsonPath = await getPackageJsonAbsolutePath();

    projectRootPath = path.dirname(packageJsonPath!);
  }

  return projectRootPath;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} successMatchSequence A string to watch for on stdout on the background job. When found, `callbackOnMatch` will be called.
 * @param {CallbackOnMatch} [callbackOnMatch] The method to called when `successMatchSequence` is found.
 * @return {*}  {Promise<{ stdout: string; stderr: string; exitCode: number }>}
 */
export async function executeInBackground(
  command: string,
  args: string[],
  successMatchSequence?: string,
  callbackOnMatch?: CallbackOnMatch
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let projectRoot = await getProjectRootPath();

  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      shell: 'cmd',
      cwd: projectRoot,
      // cwd: `${vscode.workspace.workspaceFolders![0].uri.fsPath}`,
    });
    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data: { toString: () => any }) => {
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

    childProcess.stderr.on('data', (data: { toString: () => string }) => {
      stderr += data.toString();
    });

    childProcess.on('error', (error: any) => {
      console.error('Failed to execute command:', error);
      reject(error);
    });

    childProcess.on('exit', (exitCode: null) => {
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
