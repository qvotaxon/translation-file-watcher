import { PoFileChangeHandler } from './fileChangeHandlers/poFileChangeHandler';
import { JsonFileChangeHandler } from './fileChangeHandlers/jsonFileChangeHandler';
import { CodeFileChangeHandler } from './fileChangeHandlers/codeFileChangeHandler';

export class FileChangeHandlerFactory {
  public createFileChangeHandler(changeFileLocation: string) {
    const fileExt = changeFileLocation.split('.').pop();

    switch (fileExt) {
      case 'po':
        return new PoFileChangeHandler();
      case 'json':
        return new JsonFileChangeHandler();
      default:
        return new CodeFileChangeHandler();
    }
  }
}
