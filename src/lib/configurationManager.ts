import * as vscode from 'vscode';
import outputChannelManager from './outputChannelManager';
import statusBarManager from './statusBarManager';
import { StatusBarItemType } from './Enums';

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: vscode.WorkspaceConfiguration;

  private constructor() {
    this.config = vscode.workspace.getConfiguration('translationFileWatcher');
  }

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  public async updateSynchronizedOptions(value: string) {
    await this.config.update(
      'fileModes.poFileMode',
      value,
      vscode.ConfigurationTarget.Global
    );
    await this.config.update(
      'fileModes.jsonFileMode',
      value,
      vscode.ConfigurationTarget.Global
    );
    await this.config.update(
      'fileModes.codeFileMode',
      value,
      vscode.ConfigurationTarget.Global
    );
  }

  public async initializeConfigurationWatcher(
    context: vscode.ExtensionContext
  ) {
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration(
          'translationFileWatcher.logging.enableVerboseLogging'
        )
      ) {
        const newValue = configurationManager
          .getConfig()
          .get<boolean>('logging.enableVerboseLogging', false);
        outputChannelManager.setVerboseLogging(newValue);
      }

      if (
        event.affectsConfiguration(
          'translationFileWatcher.fileGeneration.generatePo'
        )
      ) {
        const newValue = configurationManager
          .getConfig()
          .get<boolean>('fileGeneration.generatePo', true);

        if (newValue) {
          statusBarManager.setStatusBarItemText(
            StatusBarItemType.PO,
            '$(eye) PO'
          );
          statusBarManager.setStatusBarItemTooltip(
            StatusBarItemType.PO,
            'Watching PO files (click to generate PO files)'
          );
        } else {
          statusBarManager.setStatusBarItemText(
            StatusBarItemType.PO,
            '$(eye-closed) PO'
          );
          statusBarManager.setStatusBarItemTooltip(
            StatusBarItemType.PO,
            'File watcher disabled because of settings.'
          );
        }
      }
    });
  }

  public getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('translationFileWatcher');
  }
}

const configurationManager = ConfigurationManager.getInstance();
export default configurationManager;
