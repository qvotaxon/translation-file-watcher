import fs from 'fs';
import * as deepl from 'deepl-node';

class TranslationService {
  private static instance: TranslationService;
  private translator: deepl.Translator;

  private constructor() {
    const authKey = ''; // Replace with your key
    this.translator = new deepl.Translator(authKey);
  }

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  // Create a function that will take a path like this: 'C:\Users\j.vervloed\RGF\USG Portals React Web\portals-web\public\locales\de\common.json' and uses that to search in its parent directory for any other directories. Then is should scan those direcotories to find any file with the same name as the name of the file in the provided file path. It should return an array of the paths to those files.
  public getOtherTranslationFilesPaths = (
    fileLocation: string,
    locale: string
  ): string[] => {
    //write some logic that will get just the file name and its extension from fileLocation.
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
    locale: string,
    changedFileContent: string
  ): void => {
    this.getOtherTranslationFilesPaths(fileLocation, locale).forEach(
      (filePath) => {
        const changedTranslations = JSON.parse(changedFileContent);
        const existingTranslations = JSON.parse(
          fs.readFileSync(filePath, 'utf-8')
        );
        //write a small method that will extract the locale from the filePath
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

        //write a method that will loop through the missing translations and uses the originalValue to translate it to the target language. Then it should write the translation to the existing translations object and write that object back to the file.
        missingTranslations.forEach(async (missingTranslation) => {
          //write a method that will call DeepL to retrieve the translated value of the originalValue in the target language.
          const translateText = async (
            text: string,
            targetLanguage: string
          ): Promise<string> => {
            // Call DeepL API or any other translation service to retrieve the translated value
            // of the originalValue in the target language
            // Return the translated text

            //implement an actual api call to DeepL. I have an api key.

            if (targetLanguage === 'en') {
              targetLanguage = 'en-US';
            }

            const result = await this.translator.translateText(
              text,
              null,
              targetLanguage as deepl.TargetLanguageCode
            );
            console.log(
              `Determined source language to be: ${result.detectedSourceLang}`
            );

            return result.text;
          };

          const translatedValue = await translateText(
            missingTranslation.originalValue,
            missingTranslation.locale
          );
          // Write the translation to the existing translations object
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
          // Write the updated translations object back to the file
          fs.writeFileSync(
            filePath,
            JSON.stringify(existingTranslations, null, 2)
          );

          //write the translation to the existing translations object
        });

        return missingTranslations;
      }
    );
  };
}

const translationService = TranslationService.getInstance();
export default translationService;
