import fs from 'fs';
import * as deepl from 'deepl-node';
import configurationManager from './configurationManager';
import outputChannelManager from './outputChannelManager';

class TranslationService {
  private static instance: TranslationService;
  private translator: deepl.Translator | undefined;
  private authKey: string | undefined;

  private constructor() {}

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  private getTranslator = (): deepl.Translator => {
    const authKey =
      this.authKey ||
      configurationManager.getValue<string>('translations.deeplApiKey');

    if (!authKey) {
      throw new Error('No DeepL API key found in the configuration.');
    }

    this.translator = this.translator || new deepl.Translator(authKey);

    return this.translator;
  };

  public getOtherTranslationFilesPaths = (fileLocation: string): string[] => {
    const directory = fileLocation.substring(0, fileLocation.lastIndexOf('\\'));
    const parentDirectory = directory.substring(0, directory.lastIndexOf('\\'));
    const fileName = fileLocation.substring(fileLocation.lastIndexOf('\\') + 1);

    const files: string[] = [];
    fs.readdirSync(parentDirectory).forEach((file) => {
      const filePath = `${parentDirectory}\\${file}`;
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.readdirSync(filePath).forEach((subFile) => {
          if (subFile === fileName) {
            files.push(`${filePath}\\${subFile}`);
          }
        });
      }
    });

    const index = files.indexOf(fileLocation);
    if (index > -1) {
      files.splice(index, 1);
    }

    return files;
  };

  public translateOtherI18nFiles = (
    fileLocation: string,
    changedFileContent: string
  ): void => {
    this.getOtherTranslationFilesPaths(fileLocation).forEach((filePath) => {
      const changedTranslations = JSON.parse(changedFileContent);
      const existingTranslations = JSON.parse(
        fs.readFileSync(filePath, 'utf-8')
      );
      const getLocaleFromFilePath = (filePath: string): string => {
        const parts = filePath.split('\\');
        return parts[parts.length - 2];
      };

      const missingTranslations: {
        key: string;
        filePath: string;
        originalValue: string;
        locale: string;
      }[] = [];

      const findMissingTranslations = (
        changedObj: any,
        existingObj: any,
        path: string
      ) => {
        for (const key in changedObj) {
          if (changedObj.hasOwnProperty(key)) {
            const changedValue = changedObj[key];
            const existingValue = existingObj[key];

            if (
              typeof changedValue === 'object' &&
              typeof existingValue === 'object'
            ) {
              findMissingTranslations(
                changedValue,
                existingValue,
                path ? `${path}.${key}` : key
              );
            } else if (changedValue !== '' && existingValue === '') {
              missingTranslations.push({
                filePath: filePath,
                key: path ? `${path}.${key}` : key,
                originalValue: changedValue,
                locale: getLocaleFromFilePath(filePath),
              });
            }
          }
        }
      };

      findMissingTranslations(changedTranslations, existingTranslations, '');

      missingTranslations.forEach(async (missingTranslation) => {
        const translateText = async (
          text: string,
          targetLanguage: string
        ): Promise<string> => {
          let formality = configurationManager.getValue<string>(
            'translations.deeplFormality',
            'default'
          );
          outputChannelManager.appendLine(
            `formality from config: ${formality}`
          );
          const preserveFormatting = configurationManager.getValue<boolean>(
            'translations.deeplPreserveFormatting',
            false
          );

          if (targetLanguage === 'en') {
            targetLanguage = 'en-US';
            formality = 'default';
          }

          const result = await this.getTranslator().translateText(
            text,
            null,
            targetLanguage as deepl.TargetLanguageCode,
            {
              formality: (formality as deepl.Formality) ?? 'default',
              preserveFormatting: preserveFormatting ?? false,
            }
          );
          outputChannelManager.appendLine(
            `Determined source language to be: ${result.detectedSourceLang}`
          );
          outputChannelManager.appendLine(
            `Using ${
              formality as deepl.Formality
            } as formality level for translation.`
          );
          outputChannelManager.appendLine(
            `Preserving formatting: ${preserveFormatting}.`
          );

          return result.text;
        };

        const translatedValue = await translateText(
          missingTranslation.originalValue,
          missingTranslation.locale
        );
        const keys = missingTranslation.key.split('.');
        let nestedObj = existingTranslations;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!nestedObj[key]) {
            nestedObj[key] = {};
          }
          nestedObj = nestedObj[key];
        }
        nestedObj[keys[keys.length - 1]] = translatedValue;
        fs.writeFileSync(
          filePath,
          JSON.stringify(existingTranslations, null, 2)
        );
      });

      return missingTranslations;
    });
  };
}

const translationService = TranslationService.getInstance();
export default translationService;
