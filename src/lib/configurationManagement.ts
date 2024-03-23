import * as vscode from 'vscode';

export function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('translationFileWatcher');
}

// Function to update synchronized options
export async function updateSynchronizedOptions(value: string) {
  await getConfig().update(
    'fileModes.poFileMode',
    value,
    vscode.ConfigurationTarget.Global
  );
  await getConfig().update(
    'fileModes.jsonFileMode',
    value,
    vscode.ConfigurationTarget.Global
  );
  await getConfig().update(
    'fileModes.codeFileMode',
    value,
    vscode.ConfigurationTarget.Global
  );
}
