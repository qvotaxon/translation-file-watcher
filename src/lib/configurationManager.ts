import * as vscode from 'vscode';

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

  public getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('translationFileWatcher');
  }
}

const configurationManager = ConfigurationManager.getInstance();
export default configurationManager;
