import { OutputChannel, window } from 'vscode';
import { LogVerbosity } from './Enums';

export class OutputChannelLogger {
  private static _verboseLogging = false;
  private static _outputChannel: OutputChannel;
  private static _instance: OutputChannelLogger;

  private constructor() {
    OutputChannelLogger._outputChannel = window.createOutputChannel(
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
    OutputChannelLogger._verboseLogging = verbose;
  }

  // Function to show the output channel
  public showOutputChannel() {
    OutputChannelLogger._outputChannel.show();
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
      verbosity === LogVerbosity.Verbose &&
      OutputChannelLogger._verboseLogging
    ) {
      OutputChannelLogger._outputChannel.appendLine(message);
    } else if (verbosity === LogVerbosity.Important) {
      OutputChannelLogger._outputChannel.appendLine(message);
    }
  }
}
