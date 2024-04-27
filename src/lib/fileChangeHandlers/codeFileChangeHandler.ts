import { FileType } from '../enums/fileType';
import { LogVerbosity } from '../enums/logVerbosity';
import { StatusBarItemType } from '../enums/statusBarItemType';
import i18nextScannerService from '../I18nextScannerService';
import FileContentStore from '../fileContentStore';
import FileManagement from '../fileManagement';
import FileUtilities from '../fileUtilities';
import { FileChangeHandler } from '../interfaces/fileChangeHandler';
import outputChannelManager from '../outputChannelManager';
import statusBarManager from '../statusBarManager';

export class CodeFileChangeHandler implements FileChangeHandler {
  public async handleFileChangeAsync(
    triggeredByFileWatcher: boolean,
    changeFileLocation?: string,
    forceExecution?: boolean
  ): Promise<void> {
    if (!forceExecution && changeFileLocation) {
      FileContentStore.updateCurrentFileContents(changeFileLocation);
    }

    if (changeFileLocation) {
      outputChannelManager.appendLine(
        `Code File (**​/*.{ts,tsx}) Changed: ${changeFileLocation}`
      );
    } else if (forceExecution) {
      outputChannelManager.appendLine(`Manual code change trigger received.`);
    }

    const { prerequisitesFulfilled, reason } = this.prerequisitesFulfilled(
      triggeredByFileWatcher,
      changeFileLocation,
      forceExecution
    );

    if (!prerequisitesFulfilled) {
      outputChannelManager.appendLine(reason);
      return;
    }

    statusBarManager.setStatusBarItemText(
      StatusBarItemType.JSON,
      '$(sync~spin) JSON'
    );
    statusBarManager.setStatusBarItemText(
      StatusBarItemType.CODE,
      '$(search) CODE'
    );

    const i18nScannerConfigAbsolutePath = FileUtilities.getFilePathInWorkspace(
      'i18next-scanner.config.js'
    )!;

    if (i18nScannerConfigAbsolutePath) {
      const command = 'npx';
      const args = [
        'i18next-scanner',
        `--config "${i18nScannerConfigAbsolutePath}"`,
      ];
      try {
        await i18nextScannerService.scanCodeAsync();

        statusBarManager.setStatusBarItemText(
          StatusBarItemType.JSON,
          '$(eye) JSON'
        );
        statusBarManager.setStatusBarItemText(
          StatusBarItemType.CODE,
          '$(eye) CODE'
        );
      } catch (error: any) {
        outputChannelManager.appendLine(
          `Failed to execute command: '${command} ${args}'.\r\nCaught error: ${error}`,
          LogVerbosity.Important
        );

        if (error.code !== 'ABORT_ERR') {
          statusBarManager.setStatusBarItemText(
            StatusBarItemType.JSON,
            '$(eye) JSON'
          );
          statusBarManager.setStatusBarItemText(
            StatusBarItemType.CODE,
            '$(eye) CODE'
          );
        }
      }
    }

    if (changeFileLocation) {
      FileContentStore.storeFileState(changeFileLocation);
    }
  }

  private prerequisitesFulfilled(
    triggeredByFileWatcher: boolean,
    changeFileLocation?: string,
    forceExecution?: boolean
  ) {
    let reason = '';
    let prerequisitesFulfilled = true;

    if (
      !forceExecution &&
      changeFileLocation &&
      !FileContentStore.fileChangeContainsTranslationKeys(changeFileLocation)
    ) {
      reason = "Code change doesn't contain translation keys. Skipping.";
      prerequisitesFulfilled = false;
    }

    if (
      FileManagement.isFileModeManual(FileType.Code) &&
      triggeredByFileWatcher
    ) {
      reason = 'Manual mode enabled for Po files. Skipping.';
      prerequisitesFulfilled = false;
    }

    if (FileUtilities.checkMergeStatus()) {
      reason = 'File contains Git merge markers. Sorting aborted.';
      prerequisitesFulfilled = false;
    }

    return { prerequisitesFulfilled, reason };
  }
}
