import * as vscode from 'vscode';

import * as duffle from '../../duffle/duffle';
import { succeeded } from '../../utils/errorable';
import { Shell } from '../../utils/shell';
import { BundleRef } from '../../duffle/duffle.objectmodel';

export class BundleExplorer implements vscode.TreeDataProvider<BundleExplorerNode> {
    constructor(private readonly shell: Shell) { }

    private onDidChangeTreeDataEmitter: vscode.EventEmitter<BundleExplorerNode | undefined> = new vscode.EventEmitter<BundleExplorerNode | undefined>();
    readonly onDidChangeTreeData: vscode.Event<BundleExplorerNode | undefined> = this.onDidChangeTreeDataEmitter.event;

    private sortOrder: BundleSortOrder = BundleSortOrder.Default;

    getTreeItem(element: BundleExplorerNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getChildren(element?: any): vscode.ProviderResult<BundleExplorerNode[]> {
        if (!element) {
            return getBundleNodes(this.shell, this.sortOrder);
        }
        return [];
    }

    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire();
    }

    toggleSort(): void {
        this.sortOrder = ((this.sortOrder as number) + 1) % 3;
        this.onDidChangeTreeDataEmitter.fire();
    }
}

enum BundleSortOrder {
    Default = 0,
    Ascending = 1,
    Descending = 2
}

async function getBundleNodes(shell: Shell, sortOrder: BundleSortOrder): Promise<BundleExplorerNode[]> {
    const lr = await duffle.list(shell);
    if (succeeded(lr)) {
        const nodes = lr.result.map((n) => new BundleNode(n));
        return sortNodes(nodes, sortOrder);
    }
    return [new ErrorNode(lr.error[0])];
}

function sortNodes(nodes: BundleNode[], sortOrder: BundleSortOrder): BundleNode[] {
    switch (sortOrder) {
        case BundleSortOrder.Default:
            return nodes;
        case BundleSortOrder.Ascending:
            return nodes.sort((a, b) => compareNodes(a, b));
        case BundleSortOrder.Descending:
            return nodes.sort((a, b) => -compareNodes(a, b));
    }
}

function compareNodes(a: BundleNode, b: BundleNode): number {
    if (a.bundleName === b.bundleName) {
        return 0;
    }
    if (a.bundleName < b.bundleName) {
        return -1;
    }
    return 1;
}

interface BundleExplorerNode {
    getChildren(): Promise<BundleExplorerNode[]>;
    getTreeItem(): vscode.TreeItem;
}

class BundleNode implements BundleExplorerNode, BundleRef {
    constructor(readonly bundleName: string) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.bundleName, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = "duffle.bundle";
        return treeItem;
    }
}

class ErrorNode implements BundleExplorerNode {
    constructor(private readonly error: string) { }

    async getChildren(): Promise<BundleExplorerNode[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem("Error", vscode.TreeItemCollapsibleState.None);
        treeItem.tooltip = this.error;
        return treeItem;
    }
}