import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FileHandler } from './handlers/FileHandler';

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
    targetDirectory: string;
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
    createInternalLinks: true,
    addFileMetadata: true,
    detectAdditionalMetadata: false,
    importDirectory: "/Users/daylily/to_import/",
    targetDirectory: "gravity_well",
}

export default class GravityWellPlugin extends Plugin {
    settings: GravityWellSettings = DEFAULT_SETTINGS;
    fileHandler!: FileHandler;

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
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Function to trigger file processing
    async processFiles() {
        const { importDirectory, fileExtensions, maxRecursionDepth, dryRun } = this.settings;

        if (!importDirectory) {
            console.log('No import directory specified.');
            return;
        }

        // Call the FileHandler method to process files
        await this.fileHandler.processFiles(this.settings);
    }
}


class GravityWellSettingTab extends PluginSettingTab {
    plugin: GravityWellPlugin;

    constructor(app: any, plugin: GravityWellPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Gravity Well Plugin Settings' });

        // Group 1: File Import Options
        new Setting(containerEl)
            .setName('File Extensions')
            .setDesc('Comma-separated list of file extensions to import (e.g., txt, md, pdf).')
            .addText(text => text
                .setPlaceholder('txt, md, pdf')
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

        new Setting(containerEl)
            .setName('Import Directory')
            .setDesc('Set the directory to import files from.')
            .addText(text => text
                .setPlaceholder('full path to import, e.g., /Users/me/to_import/ , with trailing slash')
                .setValue(this.plugin.settings.importDirectory || '')
                .onChange(async (value) => {
                    this.plugin.settings.importDirectory = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Vault Folder to Import Into')
            .setDesc('Set the folder to create newly imported notes and subfolders. This should exist in the top-level vault folder, if not it will be created.')
            .addText(text => text
                .setPlaceholder('Enter the folder name')
                .setValue(this.plugin.settings.targetDirectory || '')
                .onChange(async (value) => {
                    this.plugin.settings.targetDirectory = value;
                    await this.plugin.saveSettings();
                }));

        // Group 2: File Naming
        new Setting(containerEl)
            .setName('File Prefix')
            .setDesc('Prefix to add to all newly created files. Null adds no prefix. Add separator if desired, e.g., "_".')
            .addText(text => text
                .setPlaceholder('Prefix')
                .setValue(this.plugin.settings.filePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.filePrefix = value;
                    await this.plugin.saveSettings();
                }));

        // Group 3: Processing and Metadata
        new Setting(containerEl)
            .setName('Dry Run')
            .setDesc('Check for conflicts without making changes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dryRun)
                .onChange(async (value) => {
                    this.plugin.settings.dryRun = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Detect External URLs')
            .setDesc('Detect URLs and convert them into links.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.detectExternalUrls)
                .onChange(async (value) => {
                    this.plugin.settings.detectExternalUrls = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Tag Notes')
            .setDesc('Automatically add tags based on note content.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.tagNotes)
                .onChange(async (value) => {
                    this.plugin.settings.tagNotes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Tags')
            .setDesc('Maximum number of tags per note.')
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
            .setDesc('Automatically link between notes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createInternalLinks)
                .onChange(async (value) => {
                    this.plugin.settings.createInternalLinks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Add File Metadata')
            .setDesc('Add file metadata like creation date, size, etc.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addFileMetadata)
                .onChange(async (value) => {
                    this.plugin.settings.addFileMetadata = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Detect Additional Metadata')
            .setDesc('Attempt to detect additional metadata from files.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.detectAdditionalMetadata)
                .onChange(async (value) => {
                    this.plugin.settings.detectAdditionalMetadata = value;
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
                        await this.plugin.fileHandler.processFiles(this.plugin.settings);
                    });
            });
    }
}
