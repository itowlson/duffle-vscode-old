import * as vscode from 'vscode';
import * as path from 'path';

import { longRunning, showDuffleResult } from '../utils/host';
import * as duffle from '../duffle/duffle';
import { RepoBundle, RepoBundleRef, LocalBundleRef, LocalBundle } from '../duffle/duffle.objectmodel';
import { map, Errorable } from '../utils/errorable';
import * as shell from '../utils/shell';
import { cantHappen } from '../utils/never';
import { BundleSelection, repoBundleSelection, localBundleSelection, promptLocalBundle } from '../utils/bundleselection';
import { filters } from '../utils/importexport';

export async function exportBundle(target?: any): Promise<void> {
    if (!target) {
        return await exportPrompted();
    }
    if (target.bundleLocation === 'repo') {
        return await exportRepoBundle((target as RepoBundleRef).bundle);
    }
    if (target.bundleLocation === 'local') {
        return await exportLocalBundle((target as LocalBundleRef).bundle);
    }
    await vscode.window.showErrorMessage("Internal error: unexpected command target");
}

async function exportPrompted(): Promise<void> {
    const bundlePick = await promptLocalBundle("Select the bundle to export");

    if (!bundlePick) {
        return;
    }

    return await exportCore(bundlePick);
}

async function exportRepoBundle(bundle: RepoBundle): Promise<void> {
    return await exportCore(repoBundleSelection(bundle));
}

async function exportLocalBundle(bundle: LocalBundle): Promise<void> {
    return await exportCore(localBundleSelection(bundle));
}

async function exportCore(bundlePick: BundleSelection): Promise<void> {
    const saveUri = await vscode.window.showSaveDialog({ filters: filters });
    if (!saveUri) {
        return;
    }

    if (saveUri.scheme !== 'file') {
        await vscode.window.showErrorMessage("This command requires a filesystem output");
        return;
    }

    const savePath = saveUri.fsPath;
    const thick = path.extname(savePath).toLowerCase() === '.tgz';

    const exportResult = await exportBundleTo(bundlePick, savePath, thick);

    await showDuffleResult('export', (bundleId) => bundleId, exportResult);
}

async function exportBundleTo(bundlePick: BundleSelection, destination: string, thick: boolean): Promise<Errorable<string>> {
    if (bundlePick.kind === 'file') {
        // Should never happen, but we need to make the compiler happy
        return { succeeded: false, error: ["Internal error - cannot export from file"] };
    } else if (bundlePick.kind === 'repo' || bundlePick.kind === 'local') {
        const exportResult = await longRunning(`Duffle exporting ${bundlePick.label}`, () =>
            duffle.exportBundle(shell.shell, bundlePick.bundle, destination, thick)
        );
        return map(exportResult, (_) => bundlePick.bundle);
    }
    return cantHappen(bundlePick);
}
