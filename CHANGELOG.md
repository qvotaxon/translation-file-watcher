# Changelog

## [1.10.1](https://github.com/qvotaxon/translation-file-watcher/compare/v1.10.0...v1.10.1) (2024-04-01)

### Features

* **config:** add logging to output window 
The extension now logs messages to the output window. You can toggle verbose logging in the settings. 

### Performance Improvements

* **background-workers:** implement file specific handling ([#59](https://github.com/qvotaxon/translation-file-watcher/issues/59)) ([4fe100b](https://github.com/qvotaxon/translation-file-watcher/commit/4fe100bd3caa5918d7766f393206e822de226c0e)).

* **background-workers:** specific code file change handling
Each po and json file will now have its own file watching process to improve simultaneous file change handling.
Next to this, the file locks on the po files are now file specific, making it possible to edit multiple po files simultaneously or in quick succession. 

* **background-workers:** handle calls in quick succession
The tasks executed by the file watchers are now debounced, so multiple saves in quick succession don't impact performance. Additionally, if any task is already running it will be cancelled when a debounced task is executed, because only the output of the last will count anyway. This also prevents multiple file scanners to start when Save All Files is used. 

* **background-workers:** only run key extraction when change is translation related
Code file changes are now checked for translation keys in the changed lines in order to determine whether to run the scanner logic. This will improve performance since saves will no longer cause the code scanner to execute, unless it's translation related. The logic takes into consideration changes in line positions. Meaning that adding new code without translation keys, above existing code with translation keys, will not cause the translation key extraction to executed. Of course, this will occur when the newly added c ode does contain translation keys.
