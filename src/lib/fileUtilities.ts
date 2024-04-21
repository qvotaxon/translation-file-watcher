import path from 'path';
import fs from 'fs';
import vscode from 'vscode';

class FileUtilities {
  private static filePathCache: Map<string, string> = new Map();

  /**
   * Returns the absolute path of a file within the current workspace.
   * @param {string} fileName The name of the file to search for.
   * @returns {string | null} The absolute path of the file, or null if not found.
   */
  public static getFilePathInWorkspace(fileName: string): string | null {
    const excludedDirectories = ['node_modules', '.git'];

    const cachedPath = this.filePathCache.get(fileName);
    if (cachedPath) {
      return cachedPath;
    }

    // Get the currently opened workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder opened.');
      return null;
    }

    function searchRecursively(folderPath: string): string | null {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory() && !excludedDirectories.includes(file)) {
          const result = searchRecursively(filePath);
          if (result) {
            return result;
          }
        } else if (file === fileName && stats.isFile()) {
          return filePath;
        }
      }
      return null;
    }

    for (const folder of workspaceFolders) {
      const workspacePath = folder.uri.fsPath;
      const filePath = searchRecursively(workspacePath);
      if (filePath) {
        this.filePathCache.set(fileName, filePath);
        return filePath;
      }
    }

    vscode.window.showErrorMessage(
      `File '${fileName}' not found in the workspace.`
    );
    return null;
  }

  public static async readFileContentsAsync(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  public static async writeJsonToFileAsync(
    filePath: string,
    data: any
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public static async writePoToFileAsync(
    filePath: string,
    poContents: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(filePath, poContents, 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export default FileUtilities;
