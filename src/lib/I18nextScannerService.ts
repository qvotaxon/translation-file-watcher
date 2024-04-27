import * as path from 'path';
import I18nextScanner from 'i18next-scanner';
import vfs from 'vinyl-fs';
import sort from 'gulp-sort';
import FileManagement from './fileManagement';

/**
 * Service for scanning code using i18next-scanner.
 */
class I18nextScannerService {
  private static instance: I18nextScannerService;

  private constructor() {}

  /**
   * Get the singleton instance of I18nextScannerService.
   * @returns The singleton instance.
   */
  public static getInstance(): I18nextScannerService {
    if (!I18nextScannerService.instance) {
      I18nextScannerService.instance = new I18nextScannerService();
    }
    return I18nextScannerService.instance;
  }

  /**
   * Scan code for translation keys in the code file for which the path is provided.
   * @param codeFilePath The path to the code file to be scanned.
   * @returns A promise resolving to the scan results.
   */
  public async scanCodeAsync(): Promise<any> {
    const packageJsonFileAbsolutePath =
      await FileManagement.getPackageJsonAbsolutePath();
    const packageJsonAbsoluteFolderPath = path.dirname(
      packageJsonFileAbsolutePath!
    );
    //TODO: Fix path to run on all os's
    const fixedPackageJsonAbsoluteFolderPath = StringUtils.replaceAll(
      packageJsonAbsoluteFolderPath!,
      '\\',
      '/'
    );
    const options = {
      compatibilityJSON: 'v3',
      debug: true,
      removeUnusedKeys: true,
      sort: true,
      func: {
        list: ['I18nKey', 't'],
        extensions: ['.ts', '.tsx'],
      },
      lngs: ['nl', 'en', 'de', 'pl'],
      ns: ['common', 'onboarding', 'validation'],
      defaultLng: 'nl',
      defaultNs: 'common',
      defaultValue: '',
      resource: {
        loadPath: `${fixedPackageJsonAbsoluteFolderPath}/public/locales/{{lng}}/{{ns}}.json`,
        savePath: `${fixedPackageJsonAbsoluteFolderPath}/public/locales/{{lng}}/{{ns}}.json`,
        jsonIndent: 4,
        lineEnding: 'CRLF',
      },
      nsSeparator: ':',
      keySeparator: '.',
      pluralSeparator: '_',
      contextSeparator: ':',
      contextDefaultValues: [],
      interpolation: {
        prefix: '{{',
        suffix: '}}',
      },
      metadata: {},
      allowDynamicKeys: false,
    };

    vfs
      .src(
        [
          `apps/**/*.{ts,tsx}`,
          `libs/**/*.{ts,tsx}`,
          `!apps/**/*.spec.{ts,tsx}`,
          `!libs/**/*.spec.{ts,tsx}`,
          `!node_modules/**`,
        ],
        {
          cwd: fixedPackageJsonAbsoluteFolderPath,
        }
      )
      .pipe(sort())
      .pipe(I18nextScanner(options))
      .pipe(vfs.dest('./'));
  }
}

class StringUtils {
  // SiwachGaurav's version from http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript
  static replaceAll(str: string, find: string, replace: string): string {
    return str.replace(
      new RegExp(find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
      replace
    );
  }
}

const i18nextScannerService = I18nextScannerService.getInstance();
export default i18nextScannerService;
