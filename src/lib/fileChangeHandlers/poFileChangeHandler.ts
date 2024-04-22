import fs from 'fs';
import path from 'path';
import { FileChangeHandler } from '../interfaces/fileChangeHandler';
import { FileType, LogVerbosity, StatusBarItemType } from '../Enums';
import fileLockManager from '../fileLockManager';
import FileManagement from '../fileManagement';
import FileUtilities from '../fileUtilities';
import outputChannelManager from '../outputChannelManager';
import statusBarManager from '../statusBarManager';
import { po2i18next } from 'gettext-converter';
import { FileChangeHandlerFactory } from '../fileChangeHandlerFactory';

export class PoFileChangeHandler implements FileChangeHandler {
  private fileChangeHandlerFactory: FileChangeHandlerFactory;

  constructor() {
    this.fileChangeHandlerFactory = new FileChangeHandlerFactory();
  }

  public async handleFileChangeAsync(
    triggeredByFileWatcher: boolean,
    changeFileLocation?: string
  ): Promise<void> {
    if (!changeFileLocation) {
      return;
    }

    const { jsonOutputPath, locale } =
      FileManagement.extractParts(changeFileLocation);

    const { prerequisitesFulfilled, reason } = this.prerequisitesFulfilled(
      locale,
      jsonOutputPath,
      triggeredByFileWatcher
    );

    if (!prerequisitesFulfilled) {
      outputChannelManager.appendLine(reason);
      return;
    }

    outputChannelManager.appendLine(`Po File Changed: ${changeFileLocation}`);
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.JSON,
      '$(sync~spin) JSON'
    );

    try {
      const po = await FileUtilities.readFileContentsAsync(changeFileLocation);
      const res = po2i18next(po, { compatibilityJSON: 'v3' });
      await FileUtilities.writeToFileAsync(
        jsonOutputPath,
        JSON.stringify(res, null, 4)
      );
    } catch (error) {
      outputChannelManager.appendLine(
        `An error occured whilst trying to convert Po to Json. ${error}`,
        LogVerbosity.Important
      );
    } finally {
      statusBarManager.setStatusBarItemText(
        StatusBarItemType.JSON,
        '$(eye) JSON'
      );
    }
  }

  private prerequisitesFulfilled(
    locale: string,
    jsonOutputPath: string,
    triggeredByFileWatcher: boolean
  ) {
    let reason = '';
    let prerequisitesFulfilled = true;

    if (fileLockManager.isPoFileLocked(locale)) {
      reason = `Po file ${locale} locked. Skipping.`;
      prerequisitesFulfilled = false;
    }

    if (
      FileManagement.isFileModeManual(FileType.Po) &&
      triggeredByFileWatcher
    ) {
      reason = 'Manual mode enabled for Po files. Skipping.';
      prerequisitesFulfilled = false;
    }

    if (
      FileUtilities.hasMergeMarkers(jsonOutputPath) ||
      FileUtilities.checkMergeStatus()
    ) {
      reason = 'File contains Git merge markers. Sorting aborted.';
      prerequisitesFulfilled = false;
    }

    return { prerequisitesFulfilled, reason };
  }

  //TODO: move to own class.
  public processPOFiles = (
    directory: string,
    triggeredByFileWatcher: boolean
  ) => {
    fs.readdirSync(directory).forEach(async (file) => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        this.processPOFiles(filePath, triggeredByFileWatcher);
      } else if (file.endsWith('.po')) {
        const fileChangeHandler =
          this.fileChangeHandlerFactory.createFileChangeHandler(filePath);
        await fileChangeHandler?.handleFileChangeAsync(false, filePath);
      }
    });
  };
}
