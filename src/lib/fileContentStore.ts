import fs from 'fs';
import { GlobPattern, ProgressLocation, window, workspace } from 'vscode';

export default class FileContentStore {
  private static instance: FileContentStore;
  //TODO: remove current file / old files contents from cache after save to prevent invalid / outdated entries.
  private static previousFileContents: string[] = [];
  private static currentFileContents: string[] = [];
  private static i18nScannerConfigAbsolutePath: string;

  public getCurrentFileContents = () => FileContentStore.currentFileContents;
  public getPreviousFileContents = () => FileContentStore.previousFileContents;

  private constructor() {}

  public static getInstance(): FileContentStore {
    if (!FileContentStore.instance) {
      FileContentStore.instance = new FileContentStore();
    }
    return FileContentStore.instance;
  }

  public async initializeInitialFileContentsAsync(pattern: GlobPattern) {
    window.withProgress(
      {
        location: ProgressLocation.Window,
        title: 'Initializing file caches',
      },
      async () => {
        try {
          const fileUris = await workspace.findFiles(
            pattern,
            '**​/{node_modules,.git,.next}/**'
          );

          fileUris.forEach((fileUri) => {
            FileContentStore.updatePreviousFileContents(fileUri.fsPath);
          });
        } catch (error) {
          console.error('Error initializing initial file contents:', error);
          window.showErrorMessage('Error initializing initial file contents');
        }
      }
    );
  }

  public static fileChangeContainsTranslationKeys(fsPath: string): boolean {
    const changedLines = FileContentStore.getChangedLines(
      FileContentStore.currentFileContents[fsPath as keyof object],
      FileContentStore.previousFileContents[fsPath as keyof object]
    );
    const translationKeys =
      FileContentStore.extractTranslationKeys(changedLines);

    return translationKeys.length > 0;
  }

  public static updatePreviousFileContents(fsPath: string) {
    const fileContent = fs.readFileSync(fsPath, { encoding: 'utf8' });
    FileContentStore.previousFileContents[fsPath as keyof object] = fileContent;
  }

  public static updateCurrentFileContents(fsPath: string) {
    const fileContent = fs.readFileSync(fsPath, { encoding: 'utf8' });
    FileContentStore.currentFileContents[fsPath as keyof object] = fileContent;
  }

  public static storeFileState(fsPath: string) {
    const previousData =
      FileContentStore.previousFileContents[fsPath as keyof object] || '';

    if (
      FileContentStore.currentFileContents[fsPath as keyof object] !==
      previousData
    ) {
      FileContentStore.previousFileContents[fsPath as keyof object] =
        FileContentStore.currentFileContents[fsPath as keyof object];
    }
  }

  private static getChangedLines = (
    currentData: string,
    previousData: string
  ): string[] => {
    const currentLines = currentData.split('\n');
    const previousLines = previousData?.split('\n') ?? [];

    const changedLines = [];

    const currentLineSet = new Set(currentLines.map((line) => line.trim()));
    const previousLineSet = new Set(previousLines.map((line) => line.trim()));

    for (const element of currentLines) {
      const currentLine = element.trim();

      if (!previousLineSet.has(currentLine)) {
        changedLines.push(element);
      }
    }

    for (const element of previousLines) {
      const previousLine = element.trim();

      if (!currentLineSet.has(previousLine)) {
        changedLines.push(element);
      }
    }

    return changedLines;
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
}
