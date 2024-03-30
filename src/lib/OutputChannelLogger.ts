import { OutputChannel, window } from 'vscode';
import { LogVerbosity } from './Enums';

export class OutputChannelLogger {
  private static _verboseLogging = false;
  private static readonly _outputChannel: OutputChannel =
    window.createOutputChannel('Translation File Watcher');

  /**
   * @param {boolean} verbose Specifies whether to enable verbose logging
   */
  public static setVerboseLogging(verbose: boolean) {
    OutputChannelLogger._verboseLogging = verbose;
  }

  // Function to show the output channel
  public static showOutputChannel() {
    OutputChannelLogger._outputChannel.show();
  }

  /**
   * @param {string} message The message to log
   * @param {LogVerbosity} [verbosity=LogType.Verbose] Specifies the type of log message
   */
  public static appendLine(
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
