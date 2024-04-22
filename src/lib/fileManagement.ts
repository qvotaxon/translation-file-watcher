import * as vscode from 'vscode';
import fs from 'fs';
import { FileMode, FileType } from './Enums';
import configurationManager from './configurationManager';

class FileManagement {
  public static isFileModeManual(fileType: FileType) {
    const poFileMode = configurationManager.getValue<FileMode>(
      'fileModes.poFileMode',
      FileMode.Automatic
    );
    const jsonFileMode = configurationManager.getValue<FileMode>(
      'fileModes.jsonFileMode',
      FileMode.Automatic
    );
    const codeFileMode = configurationManager.getValue<FileMode>(
      'fileModes.codeFileMode',
      FileMode.Automatic
    );

    switch (fileType) {
      case FileType.Po:
        return poFileMode === FileMode.Manual;
      case FileType.Json:
        return jsonFileMode === FileMode.Manual;
      case FileType.Code:
        return codeFileMode === FileMode.Manual;
      default:
        return false;
    }
  }

  public static extractParts(filePath: string): {
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

  public static async getPackageJsonAbsolutePath(): Promise<
    string | undefined
  > {
    const packageJsonRelativePath = configurationManager.getValue<string>(
      'filePaths.packageJsonRelativePath'
    );
    const packageJsonAbsolutePath = `${
      vscode.workspace.workspaceFolders![0].uri.fsPath
    }\\${packageJsonRelativePath}`;

    if (packageJsonRelativePath) {
      if (!fs.existsSync(packageJsonAbsolutePath)) {
        return undefined;
      }

      return packageJsonAbsolutePath;
    }

    const files = await vscode.workspace.findFiles('**/package.json');
    if (files.length > 0) {
      return files[0].fsPath;
    }
    return undefined;
  }
}

export default FileManagement;
