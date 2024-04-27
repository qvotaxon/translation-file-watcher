import { OutputChannel, window } from 'vscode';
import { LogVerbosity } from './enums/logVerbosity';

class OutputChannelManager {
  private _verboseLogging = false;
  private _outputChannel: OutputChannel;
  private static _instance: OutputChannelManager;

  private constructor() {
    this._outputChannel = window.createOutputChannel(
      'Translation File Watcher'
    );
  }

  public static getInstance(): OutputChannelManager {
    if (!OutputChannelManager._instance) {
      OutputChannelManager._instance = new OutputChannelManager();
    }
    return OutputChannelManager._instance;
  }

  /**
   * @param {boolean} verbose Specifies whether to enable verbose logging
   */
  public setVerboseLogging(verbose: boolean) {
    this._verboseLogging = verbose;
  }

  // Function to show the output channel
  public showOutputChannel() {
    this._outputChannel.show();
  }

  /**
   * @param {string} message The message to log
   * @param {LogVerbosity} [verbosity=LogType.Verbose] Specifies the type of log message
   */
  public appendLine(
    message: string,
    verbosity: LogVerbosity = LogVerbosity.Verbose
  ) {
    if (
      (verbosity === LogVerbosity.Verbose && this._verboseLogging) ||
      verbosity === LogVerbosity.Important
    ) {
      this._outputChannel.appendLine(message);
    }
  }
}

const outputChannelManager = OutputChannelManager.getInstance();
export default outputChannelManager;
