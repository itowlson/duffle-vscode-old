import * as vscode from 'vscode';

import * as duffle from '../duffle/duffle';
import { Cancellable } from './cancellable';
import { Shell } from './shell';
import { failed } from './errorable';
import { BundleManifest } from '../duffle/duffle.objectmodel';

export async function promptForCredentials(bundleManifest: BundleManifest, sh: Shell, prompt: string): Promise<Cancellable<string | undefined>> {
    if (!(await hasCredentials(bundleManifest))) {
        return { cancelled: false, value: undefined };
    }

    const credentialSets = await duffle.listCredentialSets(sh);
    if (failed(credentialSets)) {
        // Fall back to making the user type it in unaided
        const credentialSet = await vscode.window.showInputBox({ prompt: prompt });
        if (!credentialSet) {
            return { cancelled: true };
        }
        return { cancelled: false, value: credentialSet };
    }

    const credentialSet = await vscode.window.showQuickPick(credentialSets.result, { placeHolder: prompt });
    if (!credentialSet) {
        return { cancelled: true };
    }

    return { cancelled: false, value: credentialSet };
}

async function hasCredentials(manifest: BundleManifest): Promise<boolean> {
    const credentials = manifest.credentials || {};
    return Object.keys(credentials).length > 0;
}
