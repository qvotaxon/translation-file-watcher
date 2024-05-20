import fs from 'fs';
import path from 'path';
import { StatusBarItemType } from '../enums/statusBarItemType';
import { FileType } from '../enums/fileType';
import configurationManager from '../configurationManager';
import fileLockManager from '../fileLockManager';
import FileManagement from '../fileManagement';
import FileUtilities from '../fileUtilities';
import { FileChangeHandler } from '../interfaces/fileChangeHandler';
import { i18next2po } from 'gettext-converter';
import outputChannelManager from '../outputChannelManager';
import statusBarManager from '../statusBarManager';
import { FileChangeHandlerFactory } from '../fileChangeHandlerFactory';
import { CallbackOnMatch } from '../types/callbackOnMatch';
import translationService from '../translationService';

export class JsonFileChangeHandler implements FileChangeHandler {
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

    const generatePo = configurationManager.getValue<boolean>(
      'fileGeneration.generatePo',
      true
    );

    const { prerequisitesFulfilled, reason } = this.prerequisitesFulfilled(
      triggeredByFileWatcher,
      changeFileLocation,
      generatePo
    );

    outputChannelManager.appendLine(`Json File Changed: ${changeFileLocation}`);

    if (!prerequisitesFulfilled) {
      outputChannelManager.appendLine(reason);
      return;
    }

    const { poOutputPath, locale } =
      FileManagement.extractParts(changeFileLocation);

    statusBarManager.setStatusBarItemText(
      StatusBarItemType.PO,
      '$(sync~spin) PO'
    );

    const successMatchCallback: CallbackOnMatch = () => {
      statusBarManager.setStatusBarItemText(StatusBarItemType.PO, '$(eye) PO');
      setTimeout(() => {
        // TODO: This callback should only be called when writing to the po file is done.
        // So the json file watcher shouldn't be triggered, but it is...
        // As a workaround we wait for one second after the task is finished.
        fileLockManager.removeFileLock(changeFileLocation);
      }, 250);
    };

    fileLockManager.addFileLock(changeFileLocation);

    const json = await FileUtilities.readFileContentsAsync(changeFileLocation);

    translationService.translateOtherI18nFiles(
      changeFileLocation,
      locale,
      json
    );

    const res = i18next2po(locale, json, { compatibilityJSON: 'v3' });
    await FileUtilities.writeToFileAsync(poOutputPath, res);

    outputChannelManager.appendLine('Writing to po file ' + poOutputPath);

    successMatchCallback('');
  }

  private prerequisitesFulfilled(
    triggeredByFileWatcher: boolean,
    changeFileLocation: string,
    generatePo?: boolean
  ) {
    let reason = '';
    let prerequisitesFulfilled = true;

    if (
      !generatePo ||
      (FileManagement.isFileModeManual(FileType.Json) && triggeredByFileWatcher)
    ) {
      reason =
        'Either manual mode is enabled for Po files or Po file generation is disabled. Skipping.';
      prerequisitesFulfilled = false;
    }

    if (
      FileUtilities.hasMergeMarkers(changeFileLocation) ||
      FileUtilities.checkMergeStatus()
    ) {
      reason = 'File contains Git merge markers. Sorting aborted.';
      prerequisitesFulfilled = false;
    }

    return { prerequisitesFulfilled, reason };
  }

  //TODO: move to own class
  public processJSONFiles = (
    directory: string,
    triggeredByFileWatcher: boolean
  ) => {
    fs.readdirSync(directory).forEach(async (file) => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        this.processJSONFiles(filePath, triggeredByFileWatcher);
      } else if (file.endsWith('.json')) {
        const fileChangeHandler =
          this.fileChangeHandlerFactory.createFileChangeHandler(filePath);
        await fileChangeHandler?.handleFileChangeAsync(false, filePath);
      }
    });
  };
}
