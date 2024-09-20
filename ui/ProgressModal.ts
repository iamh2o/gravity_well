// File: ui/ProgressModal.ts

import { App, Modal, ButtonComponent } from 'obsidian';

export class ProgressModal extends Modal {
    // No need to redeclare contentEl as it's inherited from Modal
    progressInfoEl!: HTMLElement;
    cancelButton!: ButtonComponent;
    isCancelled: boolean = false;

    totalFiles: number = 0;
    filesProcessed: number = 0;
    filesFailed: number = 0;

    constructor(app: App) {
        super(app);
        this.app = app;
    }

    onOpen() {
        this.titleEl.setText('Import Progress');

        this.progressInfoEl = this.contentEl.createEl('div', { cls: 'import-progress-info' });
        this.updateProgressInfo();

        const buttonContainer = this.contentEl.createEl('div', { cls: 'modal-button-container' });
        this.cancelButton = new ButtonComponent(buttonContainer);
        this.cancelButton.setButtonText('Cancel Import');
        this.cancelButton.onClick(() => {
            this.isCancelled = true;
            this.close();
        });
    }

    updateProgressInfo() {
        this.progressInfoEl.setText(`Total files detected: ${this.totalFiles}
Files processed: ${this.filesProcessed}
Files failed: ${this.filesFailed}`);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
