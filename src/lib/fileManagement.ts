import * as vscode from 'vscode';
import fs from 'fs';
import { FileMode, FileType } from './Enums';
import { getConfig } from './configurationManagement';

export function isFileModeManual(fileType: FileType) {
  const overallFileMode = getConfig().get<FileMode>(
    'fileModes.overallFileMode',
    FileMode.Automatic
  );
  const poFileMode = getConfig().get<FileMode>(
    'fileModes.poFileMode',
    FileMode.Automatic
  );
  const jsonFileMode = getConfig().get<FileMode>(
    'fileModes.jsonFileMode',
    FileMode.Automatic
  );
  const codeFileMode = getConfig().get<FileMode>(
    'fileModes.codeFileMode',
    FileMode.Automatic
  );

  switch (fileType) {
    case FileType.Po:
      return (
        overallFileMode === FileMode.Manual || poFileMode === FileMode.Manual
      );
    case FileType.Json:
      return (
        overallFileMode === FileMode.Manual || jsonFileMode === FileMode.Manual
      );
    case FileType.Code:
      return (
        overallFileMode === FileMode.Manual || codeFileMode === FileMode.Manual
      );
  }
}

export function hasMergeMarkers(filePath: string): boolean {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  // Check if the file content contains any Git merge markers
  return /<<<<<<<|=======|>>>>>>>/.test(fileContent);
}

export function getLastThreeDirectories(
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

export function extractParts(filePath: string): {
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

export async function getPackageJsonAbsolutePath(): Promise<
  string | undefined
> {
  const packageJsonRelativePath = getConfig().get<string>(
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
