import fs from 'fs';
import path from 'path';
import stringify from 'json-stable-stringify';
import { FileChangeHandler } from '../interfaces/fileChangeHandler';
import { LogVerbosity } from '../enums/logVerbosity';
import { StatusBarItemType } from '../enums/statusBarItemType';
import { FileType } from '../enums/fileType';
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

    const { jsonOutputPath } = FileManagement.extractParts(changeFileLocation);

    const { prerequisitesFulfilled, reason } = this.prerequisitesFulfilled(
      jsonOutputPath,
      triggeredByFileWatcher
    );

    outputChannelManager.appendLine(`Po File Changed: ${changeFileLocation}`);

    if (!prerequisitesFulfilled) {
      outputChannelManager.appendLine(reason);
      return;
    }

    statusBarManager.setStatusBarItemText(
      StatusBarItemType.JSON,
      '$(sync~spin) JSON'
    );

    try {
      const po = await FileUtilities.readFileContentsAsync(changeFileLocation);
      const res = po2i18next(po, { compatibilityJSON: 'v3' });

      let jsonResult = stringify(res, {
        space: 4,
        cycles: false,
      });
      jsonResult = jsonResult + '\n';

      await FileUtilities.writeToFileAsync(jsonOutputPath, jsonResult);
      outputChannelManager.appendLine(`Wrote to json file ${jsonOutputPath}`);
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
    jsonOutputPath: string,
    triggeredByFileWatcher: boolean
  ) {
    let reason = '';
    let prerequisitesFulfilled = true;

    if (fileLockManager.isFileLocked(jsonOutputPath)) {
      reason = `Json file ${jsonOutputPath} locked. Skipping.`;
      prerequisitesFulfilled = false;
    }

    if (
      FileManagement.isFileModeManual(FileType.Po) &&
      triggeredByFileWatcher
    ) {
      reason = 'Manual mode enabled for Po files.';
      prerequisitesFulfilled = false;
    }

    if (
      FileUtilities.hasMergeMarkers(jsonOutputPath) ||
      FileUtilities.checkMergeStatus()
    ) {
      reason = 'File contains Git merge markers.';
      prerequisitesFulfilled = false;
    }

    return { prerequisitesFulfilled, reason };
  }

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
