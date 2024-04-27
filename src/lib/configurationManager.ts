import * as vscode from 'vscode';
import outputChannelManager from './outputChannelManager';
import statusBarManager from './statusBarManager';
import { StatusBarItemType } from './enums/statusBarItemType';
import { UserInterfaceManager } from './userInterface';

/**
 * A class to manage extension configuration settings and related functionality.
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: vscode.WorkspaceConfiguration;

  /**
   * Constructs a new instance of ConfigurationManager.
   * Private to enforce singleton pattern.
   */
  private constructor() {
    this.config = vscode.workspace.getConfiguration('translationFileWatcher');
  }

  /**
   * Gets the singleton instance of ConfigurationManager.
   * @returns The singleton instance of ConfigurationManager.
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Notifies the user if the configuration version has changed.
   * @param context The extension context.
   */
  public notifyUserIfConfigurationVersionHasChanged(
    context: vscode.ExtensionContext
  ) {
    const myExtension = vscode.extensions.getExtension(
      'qvotaxon.translation-file-watcher'
    );
    const currentVersion =
      myExtension?.packageJSON.configurationVersion ?? '0.0.2';
    const lastVersion = context.globalState.get(
      'TranslationFileWatcherExtensionVersion'
    );

    if (currentVersion !== lastVersion) {
      void context.globalState.update(
        'TranslationFileWatcherExtensionVersion',
        currentVersion
      );
      UserInterfaceManager.notifyRequiredSettings();
    }
  }

  /**
   * Initializes the configuration watcher to react to configuration changes.
   */
  public initializeConfigurationWatcher() {
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration(
          'translationFileWatcher.logging.enableVerboseLogging'
        )
      ) {
        const newValue = this.getValue<boolean>(
          'logging.enableVerboseLogging',
          false
        )!;
        outputChannelManager.setVerboseLogging(newValue);
      }

      if (
        event.affectsConfiguration(
          'translationFileWatcher.fileGeneration.generatePo'
        )
      ) {
        const newValue = this.getValue<boolean>(
          'fileGeneration.generatePo',
          true
        );

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

  /**
   * Retrieves the value of a configuration setting.
   * @param configurationKey The key of the configuration setting.
   * @param defaultValue The default value to return if the setting is not found.
   * @returns The value of the configuration setting, or undefined if not found.
   */
  public getValue<T>(
    configurationKey: string,
    defaultValue?: T
  ): T | undefined {
    return defaultValue
      ? this.config.get<T>(configurationKey, defaultValue)
      : this.config.get<T>(configurationKey);
  }
}

const configurationManager = ConfigurationManager.getInstance();
export default configurationManager;
