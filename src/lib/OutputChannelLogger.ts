import { OutputChannel, window } from 'vscode';
import { LogVerbosity } from './Enums';

export class OutputChannelLogger {
  private _verboseLogging = false;
  private _outputChannel: OutputChannel;
  private static _instance: OutputChannelLogger;

  private constructor() {
    this._outputChannel = window.createOutputChannel(
      'Translation File Watcher'
    );
  }

  public static getInstance(): OutputChannelLogger {
    if (!OutputChannelLogger._instance) {
      OutputChannelLogger._instance = new OutputChannelLogger();
    }
    return OutputChannelLogger._instance;
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
    if (verbosity === LogVerbosity.Verbose && this._verboseLogging) {
      this._outputChannel.appendLine(message);
    } else if (verbosity === LogVerbosity.Important) {
      this._outputChannel.appendLine(message);
    }
  }
}
