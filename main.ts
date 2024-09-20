import { Plugin, PluginSettingTab, Setting, Notice, App } from 'obsidian';
import { FileHandler } from './handlers/FileHandler';
import { ProgressModal } from './ui/ProgressModal';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

interface GravityWellSettings {
    fileExtensions: string;
    maxRecursionDepth: number;
    replicateFolderStructure: boolean;
    filePrefix: string;
    dryRun: boolean;
    detectExternalUrls: boolean;
    tagNotes: boolean;
    maxTags: number;
    createInternalLinks: boolean;
    addFileMetadata: boolean;
    detectAdditionalMetadata: boolean;
    importDirectory: string;
    globalTags: string;
    maxFileSizeMB: number;
}

const DEFAULT_SETTINGS: GravityWellSettings = {
    fileExtensions: "txt,md,pdf",
    maxRecursionDepth: 0,
    replicateFolderStructure: true,
    filePrefix: "",
    dryRun: true,
    detectExternalUrls: true,
    tagNotes: true,
    maxTags: 5,
    createInternalLinks: false,
    addFileMetadata: true,
    detectAdditionalMetadata: false,
    importDirectory: "", // We'll set the default in loadSettings
    globalTags: "",
    maxFileSizeMB: 2,
}

export default class GravityWellPlugin extends Plugin {
    settings: GravityWellSettings = DEFAULT_SETTINGS;
    fileHandler!: FileHandler;
    isImportInProgress: boolean = false;
    progressModal: ProgressModal | null = null;

    async onload() {
        console.log('Loading Gravity Well Plugin');

        // Load settings
        await this.loadSettings();

        // Initialize the fileHandler
        this.fileHandler = new FileHandler(this.app);

        // Add the settings tab
        this.addSettingTab(new GravityWellSettingTab(this.app, this));

        // Add the command to process files
        this.addCommand({
            id: 'process-import-files',
            name: 'Process and Import Files',
            callback: () => {
                this.processFiles();
            }
        });
    }

    onunload() {
        console.log('Unloading Gravity Well Plugin');
        if (this.isImportInProgress) {
            this.fileHandler.cancelImport();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Set the default import directory to $HOME/gravity_well_import if not set
        if (!this.settings.importDirectory) {
            this.settings.importDirectory = path.join(os.homedir(), 'gravity_well_import');
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Function to trigger file processing
    async processFiles() {
        const { importDirectory } = this.settings;

        // Check if import directory exists
        if (!importDirectory || !fs.existsSync(importDirectory)) {
            new Notice(`Import directory does not exist: ${importDirectory}`);
            return;
        }

        if (!this.settings.fileExtensions) {
            new Notice('No file extensions specified.');
            return;
        }

        if (this.isImportInProgress) {
            new Notice('An import is already in progress.');
            return;
        }

        // Initialize progress modal
        this.progressModal = new ProgressModal(this.app);
        this.progressModal.open();

        // Set import in progress
        this.isImportInProgress = true;

        // Start processing files
        await this.fileHandler.processFiles(this.settings, this.progressModal)
            .then(() => {
                this.isImportInProgress = false;
                if (this.progressModal) {
                    this.progressModal.close();
                    this.progressModal = null;
                }
            })
            .catch((error) => {
                console.error('Error during import:', error);
                this.isImportInProgress = false;
                if (this.progressModal) {
                    this.progressModal.close();
                    this.progressModal = null;
                }
            });
    }

    // Function to cancel the import
    cancelImport() {
        if (this.isImportInProgress) {
            this.fileHandler.cancelImport();
            this.isImportInProgress = false;
            if (this.progressModal) {
                this.progressModal.close();
                this.progressModal = null;
            }
            new Notice('Import has been cancelled.');
        } else {
            new Notice('No import is in progress.');
        }
    }
}


class GravityWellSettingTab extends PluginSettingTab {
    plugin: GravityWellPlugin;

    constructor(app: App, plugin: GravityWellPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Gravity Well Plugin Settings' });

        // Mention that files will be created in datetime stamped subdirs of the gravity_well folder
        containerEl.createEl('p', { text: 'Imported files will be created in datetime-stamped subdirectories of the gravity_well folder in your vault.' });

        // Group 1: File Import Options

        new Setting(containerEl)
            .setName('Import Directory')
            .setDesc('Set the directory to import files from.')
            .addText(text => text
                .setPlaceholder('Full path to import, e.g., /Users/me/gravity_well_import/ , with trailing slash')
                .setValue(this.plugin.settings.importDirectory || '')
                .onChange(async (value) => {
                    this.plugin.settings.importDirectory = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('File Extensions')
            .setDesc('Comma-separated list of file extensions to import (e.g., txt,md,pdf). Allowed extensions: txt, md, pdf.')
            .addText(text => text
                .setPlaceholder('txt, md')
                .setValue(this.plugin.settings.fileExtensions)
                .onChange(async (value) => {
                    this.plugin.settings.fileExtensions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Recursion Depth')
            .setDesc('Max recursion depth for folder traversal (0 for none, >=1 for each level of child folders to process).')
            .addSlider(slider => {
                const sliderLabel = containerEl.createEl('span', { text: `${this.plugin.settings.maxRecursionDepth}`, cls: 'slider-value' });

                slider.setLimits(0, 10, 1)
                    .setValue(this.plugin.settings.maxRecursionDepth)
                    .onChange(async (value) => {
                        this.plugin.settings.maxRecursionDepth = value;
                        sliderLabel.setText(`${value}`);
                        await this.plugin.saveSettings();
                    });

                slider.sliderEl.parentElement?.appendChild(sliderLabel);
            });

        new Setting(containerEl)
            .setName('Replicate Folder Structure')
            .setDesc('Replicate the folder structure of imported files.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.replicateFolderStructure)
                .onChange(async (value) => {
                    this.plugin.settings.replicateFolderStructure = value;
                    await this.plugin.saveSettings();
                }));

        // Group 2: File Naming
        new Setting(containerEl)
            .setName('File Prefix')
            .setDesc('Add this prefix to all newly created notes. Null adds no prefix. Add separator if desired, e.g., "_".')
            .addText(text => text
                .setPlaceholder('Prefix')
                .setValue(this.plugin.settings.filePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.filePrefix = value;
                    await this.plugin.saveSettings();
                }));

        // Group 3: Processing and Metadata
        new Setting(containerEl)
            .setName('Detect External URLs')
            .setDesc('Detect URLs and convert them into md links.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.detectExternalUrls)
                .onChange(async (value) => {
                    this.plugin.settings.detectExternalUrls = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Tag Notes')
            .setDesc('Use NLP to create tags for each note based on the note content.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.tagNotes)
                .onChange(async (value) => {
                    this.plugin.settings.tagNotes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Tags')
            .setDesc('Maximum number of tags to apply per note.')
            .addSlider(slider => {
                const sliderLabel = containerEl.createEl('span', { text: `${this.plugin.settings.maxTags}`, cls: 'slider-value' });

                slider.setLimits(1, 10, 1)
                    .setValue(this.plugin.settings.maxTags)
                    .onChange(async (value) => {
                        this.plugin.settings.maxTags = value;
                        sliderLabel.setText(`${value}`);
                        await this.plugin.saveSettings();
                    });

                slider.sliderEl.parentElement?.appendChild(sliderLabel);
            });

        new Setting(containerEl)
            .setName('Create Internal Links')
            .setDesc('Identify links between notes, and add links.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createInternalLinks)
                .onChange(async (value) => {
                    this.plugin.settings.createInternalLinks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Add File Metadata')
            .setDesc('Add original file metadata like creation date, size, owner, etc. as note properties.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addFileMetadata)
                .onChange(async (value) => {
                    this.plugin.settings.addFileMetadata = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Detect Additional Metadata')
            .setDesc('Detect additional metadata from pdf files.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.detectAdditionalMetadata)
                .onChange(async (value) => {
                    this.plugin.settings.detectAdditionalMetadata = value;
                    await this.plugin.saveSettings();
                }));

        // New Setting: Max File Size
        new Setting(containerEl)
            .setName('Max File Size (MB)')
            .setDesc('Maximum file size to import in MB. Enter an integer greater than 0 only, no other characters.')
            .addText(text => text
                .setPlaceholder('2')
                .setValue(this.plugin.settings.maxFileSizeMB.toString())
                .onChange(async (value) => {
                    // Allow an empty value temporarily (null/blank)
                    if (value === '') {
                        // Do not update the setting yet
                        return;
                    }

                    // Parse the value and check if it's an integer > 0
                    const parsedValue = parseInt(value, 10);
                    if (!isNaN(parsedValue) && parsedValue > 0 && parsedValue.toString() === value.trim()) {
                        this.plugin.settings.maxFileSizeMB = parsedValue;
                        await this.plugin.saveSettings();
                    } else {
                        new Notice('Please enter a valid integer greater than 0 for Max File Size.');
                        text.setValue(this.plugin.settings.maxFileSizeMB.toString()); // Reset to previous valid value
                    }
                }));

        // New Setting: Global Tags
        new Setting(containerEl)
            .setName('Global Tags')
            .setDesc('Comma-separated tags to tag all newly created notes with. These must be valid tag strings (no spaces, special chars, leading digits).')
            .addText(text => text
                .setPlaceholder('tag1, tag2')
                .setValue(this.plugin.settings.globalTags)
                .onChange(async (value) => {
                    // Validate tags
                    const tagsArray = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                    const invalidTags = tagsArray.filter(tag => !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tag));
                    if (invalidTags.length > 0) {
                        new Notice('Invalid tags: ' + invalidTags.join(', ') + '. Tags must not have spaces, special characters, or start with digits.');
                        // Reset to previous valid value
                        text.setValue(this.plugin.settings.globalTags);
                    } else {
                        this.plugin.settings.globalTags = value;
                        await this.plugin.saveSettings();
                    }
                }));

        // Move Dry Run toggle just above the Import Files button
        new Setting(containerEl)
            .setName('Dry Run')
            .setDesc('Run import process, but create no new notes. Only create an import report of what would happen if not a dry run. Disable to run import.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dryRun)
                .onChange(async (value) => {
                    this.plugin.settings.dryRun = value;
                    await this.plugin.saveSettings();
                }));

        // Group 4: Import Action
        new Setting(containerEl)
            .setName('Import Files')
            .setDesc('Click to import files from the specified directory.')
            .addButton(button => {
                button.setButtonText('Import Files')
                    .setCta()
                    .onClick(async () => {
                        await this.plugin.processFiles();
                    });
            });

        // Cancel Import Button
        const cancelImportSetting = new Setting(containerEl)
            .setName('Cancel Import')
            .setDesc('Click to cancel the ongoing import process.')
            .addButton(button => {
                button.setButtonText('Cancel Import')
                    .setDisabled(!this.plugin.isImportInProgress)
                    .onClick(() => {
                        this.plugin.cancelImport();
                        // Refresh settings to update button state
                        this.display();
                    });
            });

        // Update the cancel button state based on import progress
        if (this.plugin.isImportInProgress) {
            cancelImportSetting.controlEl.querySelector('button')?.removeAttribute('disabled');
        } else {
            cancelImportSetting.controlEl.querySelector('button')?.setAttribute('disabled', 'true');
        }
    }
}
