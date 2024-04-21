import * as fs from 'fs';
import * as path from 'path';
import vscode from 'vscode';

import I18nextScanner from 'i18next-scanner';
import vfs from 'vinyl-fs';
import sort from 'gulp-sort';
import configurationManager from './configurationManager';
import FileManagement from './fileManagement';

// import { Parser as I18nextScanner } from 'i18next-scanner';
// import { Parser as I18nextScanner } from 'i18next-scanner';

/**
 * Service for scanning code using i18next-scanner.
 */
class I18nextScannerService {
  private static instance: I18nextScannerService;
  private scanner: any;

  private constructor() {
    this.scanner = I18nextScanner;
  }

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
  public async scanCode(codeFilePath: string): Promise<any> {
    // const options = {
    //   input: [
    //     'apps/**/*.{ts,tsx}',
    //     'libs/**/*.{ts,tsx}',
    //     '!apps/**/*.spec.{ts,tsx}',
    //     '!libs/**/*.spec.{ts,tsx}',
    //     '!**/node_modules/**',
    //   ],
    //   output: './',
    //   options: {
    //     compatibilityJSON: 'v3',
    //     debug: false,
    //     removeUnusedKeys: true,
    //     sort: true,
    //     func: {
    //       list: ['I18nKey', 't'],
    //       extensions: ['.ts', '.tsx'],
    //     },
    //     lngs: ['nl', 'en', 'de', 'pl'],
    //     ns: ['common', 'onboarding', 'validation'],
    //     defaultLng: 'nl',
    //     defaultNs: 'common',
    //     defaultValue: '',
    //     resource: {
    //       loadPath: 'public/locales/{{lng}}/{{ns}}.json',
    //       savePath: 'public/locales/{{lng}}/{{ns}}.json',
    //       jsonIndent: 4,
    //       lineEnding: 'CRLF',
    //     },
    //     nsSeparator: ':',
    //     keySeparator: '.',
    //     pluralSeparator: '_',
    //     contextSeparator: ':',
    //     contextDefaultValues: [],
    //     interpolation: {
    //       prefix: '{{',
    //       suffix: '}}',
    //     },
    //     metadata: {},
    //     allowDynamicKeys: false,
    //   },
    // };
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
    try {
      const maybeAScanner = I18nextScanner(
        options,
        (err: any, resources: any) => {
          if (err) {
            console.error('Error scanning code:', err);
            return;
          }
          console.log('Extracted resources:', resources);
        }
      );
    } catch (error) {
      console.error('Error reading configuration file:', error);
    }
    // const fileCOntentsOrSomething = await maybeAScanner;

    // let localesRelativePath = configurationManager.getValue<string>(
    //   'filePaths.localesRelativePath'
    // );
    // const localesAbsolutePath = `${
    //   vscode.workspace.workspaceFolders![0].uri.fsPath
    // }\\${localesRelativePath}`;

    // const fixedlocalesAbsolutePath = StringUtils.replaceAll(
    //   localesAbsolutePath,
    //   '\\',
    //   '/'
    // );

    // const packageJsonFolderAbsolutePath = `${
    //   vscode.workspace.workspaceFolders![0].uri.fsPath
    // }\\${packageJsonFileFolderName}`;

    // const fixed = StringUtils.replaceAll(
    //   packageJsonFolderAbsolutePath!,
    //   '\\',
    //   '/'
    // );

    vfs
      //   .src(codeFilePath)
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
      .pipe(sort()) // Sort files in stream by path
      //   .pipe(I18nextScanner(config.options, config.transform, config.flush))
      .pipe(I18nextScanner(options))

      .pipe(vfs.dest('./'));
    //   .pipe(console.log);

    // const test = scanner(options);

    // const test2 = await test;

    // vfs
    //   .src([codeFilePath])
    //   .pipe(sort()) // Sort files in stream by path
    //   .pipe()
    //   .pipe(vfs.dest('/path/to/dest'));

    // const content = fs.readFile(codeFilePath, {
    //     encoding: null,
    //     flag: undefined
    // });

    // try {
    //   const configPath = path.resolve(configFile);
    //   const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    //   const scanResults = await this.scanner.scan(config);
    //   return scanResults;
    // } catch (error) {
    //   console.error('Error scanning code:', error);
    //   throw error;
    // }
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
