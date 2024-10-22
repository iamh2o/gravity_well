// File: handlers/FileHandler.ts

import { TFile, TFolder, Vault, App, normalizePath, Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as pdfjsLib from 'pdfjs-dist';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import natural from 'natural';
import { ProgressModal } from '../ui/ProgressModal';
import { debug } from 'console';

// Initialize wink-nlp
const nlp = winkNLP(model);
const its = nlp.its;
const as = nlp.as;

interface GlobalWorkerOptions {
    workerSrc: string;
}

// Set the workerSrc for PDF.js
(pdfjsLib as { GlobalWorkerOptions: GlobalWorkerOptions }).GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';


// Define custom stop words
const customStopWords: Set<string> = new Set([
    // ... (your list of stop words)
    'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
    'are', "aren't", 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
    'between', 'both', 'but', 'by', "can't", 'cannot', 'could', "couldn't", 'did',
    "didn't", 'do', 'does', "doesn't", 'doing', "don't", 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't", 'have',
    "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's",
    'hers', 'herself', 'him', 'himself', 'his', 'how', "how's", 'i', "i'd",
    "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', "isn't", 'it', "it's",
    'its', 'itself', "let's", 'me', 'more', 'most', "mustn't", 'my', 'myself',
    'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
    'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', "shan't",
    'she', "she'd", "she'll", "she's", 'should', "shouldn't", 'so', 'some', 'such',
    'than', 'that', "that's", 'the', 'their', 'theirs', 'them', 'themselves',
    'then', 'there', "there's", 'these', 'they', "they'd", "they'll", "they're",
    "they've", 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
    'very', 'was', "wasn't", 'we', "we'd", "we'll", "we're", "we've", 'were',
    "weren't", 'what', "what's", 'when', "when's", 'where', "where's", 'which',
    'while', 'who', "who's", 'whom', 'why', "why's", 'with', "won't", 'would',
    "wouldn't", 'you', "you'd", "you'll", "you're", "you've", 'your', 'yours',
    'yourself', 'yourselves'
]);

// Initialize the stemmer for optional stemming
const stemmer = natural.PorterStemmer;

export class FileHandler {
    app: App;
    isCancelled: boolean = false;

    constructor(app: App) {
        this.app = app;
    }

    cancelImport() {
        this.isCancelled = true;
    }

    async processFiles(settings: any, progressModal: ProgressModal) {
        const {
            importDirectory,
            fileExtensions,
            maxRecursionDepth = 0,
            replicateFolderStructure = true,
            filePrefix = '',
            dryRun = false,
            detectExternalUrls = true,
            tagNotes = true,
            maxTags = 2,
            createInternalLinks = true,
            addFileMetadata = true,
            detectAdditionalMetadata = false,
            globalTags = '',
            maxFileSizeMB = 2,
            debugEnabled = false,
        } = settings;

        if (debugEnabled) {
            console.log(`Starting file processing in directory: ${importDirectory} with extensions: ${fileExtensions}`);
        }

        // Validate file extensions
        const allowedExtensions = ['txt', 'md', 'pdf'];
        const extensionsArray = fileExtensions.split(',').map((ext: string) => ext.trim().toLowerCase());
        const invalidExtensions = extensionsArray.filter((ext: string) => !allowedExtensions.includes(ext));

        if (invalidExtensions.length > 0) {
            new Notice('Invalid file extensions: ' + invalidExtensions.join(', ') + '. Only txt, md, pdf are allowed.');
            return;
        }

        // Set the base target directory to 'gravity_well'
        const baseTargetDirectory = 'gravity_well';

        // Generate timestamped subdirectory
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1)
            .toString()
            .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours()
            .toString()
            .padStart(2, '0')}-${now.getMinutes().toString()
            .padStart(2, '0')}-${now
            .getSeconds()
            .toString()
            .padStart(2, '0')}`;

        const targetDirectory = path.join(baseTargetDirectory, formattedDate);

        // Traverse the directory and get the files
        const files = await traverseDirectory(importDirectory, extensionsArray, maxRecursionDepth, debugEnabled);

        const totalFilesDiscovered = files.length;
        let totalNotesCreated = 0;
        let totalFailures = 0;

        // Update total files in progress modal
        progressModal.totalFiles = totalFilesDiscovered;
        progressModal.updateProgressInfo();

        // Collect note titles for internal linking
        const noteTitles = files.map(file => path.basename(file, path.extname(file)));

        // Initialize log entries array
        const logEntries: { filePath: string; status: string }[] = [];

        for (const file of files) {
            if (this.isCancelled || progressModal.isCancelled) {
                if (debugEnabled) {
                    console.log('Import cancelled by user.');
                }
                break;
            }

            try {
                // Check file size
                const stats = await fs.promises.stat(file);
                const fileSizeInBytes = stats.size;
                const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

                if (fileSizeInMB > maxFileSizeMB) {
                    if (dryRun) {
                        if (debugEnabled) {                            
                            console.warn(`Dry Run: Would block importing file ${file} as it exceeds ${maxFileSizeMB}MB`);
                        }
                        logEntries.push({ filePath: file, status: `Would block importing as exceeds ${maxFileSizeMB}MB` });
                    } else {
                        if (debugEnabled) {
                            console.warn(`Blocked importing file ${file} as it exceeds ${maxFileSizeMB}MB`);
                        }
                        logEntries.push({ filePath: file, status: `Blocked importing as exceeds ${maxFileSizeMB}MB` });
                    }
                    totalFailures++;
                    progressModal.filesFailed = totalFailures;
                    progressModal.updateProgressInfo();
                    continue;
                }

                const metadata = await extractMetadata(file, addFileMetadata, detectAdditionalMetadata, debugEnabled);
                let content = await convertToMarkdown(file, debugEnabled);

                // Detect and convert external URLs
                if (detectExternalUrls) {
                    content = await detectAndConvertUrls(content);
                }

                // Tag notes based on content
                if (tagNotes) {
                    const tags = await detectTags(content, maxTags);
                    metadata.tags = tags;
                }

                // Create internal links
                if (createInternalLinks) {
                    content = await createInternalLinksInContent(content, noteTitles);
                }

                if (!dryRun) {
                    await createNote(this.app.vault, file, content, metadata, {
                        replicateFolderStructure,
                        filePrefix,
                        targetDirectory,
                        importDirectory,
                        globalTags,
                        debugEnabled,
                    });
                    if (debugEnabled) {
                        console.log(`Created note: ${path.join(targetDirectory, filePrefix + path.basename(file, path.extname(file)) + '.md')}`);
                    }
                    // Log successful import
                    logEntries.push({ filePath: file, status: 'Created note' });
                    totalNotesCreated++;
                } else {
                    if (debugEnabled) {
                        console.log(`Dry Run: Would create note for ${file} with metadata:`, metadata);
                    }
                    // Log dry run status
                    logEntries.push({ filePath: file, status: 'Would create note' });
                }
            } catch (error) {
                if (debugEnabled) {
                    console.error(`Error processing file ${file}:`, error);
                }
                if (!dryRun) {
                    // Log failed import
                    logEntries.push({ filePath: file, status: 'Failed to create note' });
                } else {
                    // Log failed dry run
                    logEntries.push({ filePath: file, status: 'Dry run failed' });
                }
                totalFailures++;
            }

            progressModal.filesProcessed = totalNotesCreated;
            progressModal.filesFailed = totalFailures;
            progressModal.updateProgressInfo();

            // Wait for a short duration to allow UI update
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // After processing all files, create the import log note
        let logFileNameWithoutExt = `${filePrefix}import_log_${formattedDate}`;
        const logFileName = `${logFileNameWithoutExt}.md`;

        try {
            // Create markdown table for log entries
            let logContent = `# Import Log - ${formattedDate}\n\n| File Path | Status |\n| --- | --- |\n`;
            for (const entry of logEntries) {
                // Escape pipe characters in file paths to prevent markdown table issues
                const escapedFilePath = entry.filePath.replace(/\|/g, '\\|');
                logContent += `| ${escapedFilePath} | ${entry.status} |\n`;
            }

            // Define metadata for the log note
            const logMetadata = {
                filePath: logFileName,
                importDate: now.toISOString(),
                originalExtension: '.md',
                importStatus: 'complete',
            };

            // Create the log note
            await createNote(this.app.vault, logFileNameWithoutExt, logContent, logMetadata, {
                replicateFolderStructure: false, // Place log note directly in targetDirectory
                filePrefix, // Use the same prefix
                targetDirectory,
                importDirectory,
                globalTags: 'gravitywelllog',
                debugEnabled
            });
            if (debugEnabled) {
                console.log(`Import log created: ${path.join(targetDirectory, logFileName)}`);
            }
        } catch (error) {
            if (debugEnabled) {
                console.error(`Error creating import log:`, error);
            }
        }

        // Show completion Notice
        let noticeMessage = `Import complete.\nTotal files discovered: ${totalFilesDiscovered}\nTotal notes created: ${totalNotesCreated}\nTotal failures: ${totalFailures}\nImport log created at: ${path.join(targetDirectory, logFileName)}`;

        new Notice(noticeMessage, 10000); // Show notice for 10 seconds

        // Optionally, open the import log note
        const logNotePath = normalizePath(path.join(targetDirectory, logFileName));
        const logFile = this.app.vault.getAbstractFileByPath(logNotePath);

        if (logFile instanceof TFile) {
            this.app.workspace.getLeaf().openFile(logFile);
        }

        // Reset the cancellation flag
        this.isCancelled = false;
        progressModal.isCancelled = false;
    }
}

export async function traverseDirectory(
    directory: string,
    extensions: string[],
    maxDepth: number,
    currentDepth = 0, 
    debugEnabled = false
): Promise<string[]> {
    let files: string[] = [];

    if (maxDepth !== -1 && currentDepth > maxDepth) return files;

    let dirents;
    try {
        dirents = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (debugEnabled) {
            console.error(`Error reading directory ${directory}:`, error);
        }
        return files;
    }

    for (const dirent of dirents) {
        if ((dirent.name === '.' || dirent.name === '..') || dirent.name.startsWith('.')) {
            continue; // Skip hidden files and directories
        }

        const res = path.resolve(directory, dirent.name);
        if (dirent.isDirectory()) {
            const subFiles = await traverseDirectory(res, extensions, maxDepth, currentDepth + 1, debugEnabled);
            files = files.concat(subFiles);
        } else if (dirent.isFile()) {
            const ext = path.extname(dirent.name).toLowerCase().slice(1); // Remove the dot
            if (extensions.includes(ext)) {
                files.push(res);
            }
        }
    }

    return files;
}

export async function extractMetadata(
    filePath: string,
    addFileMetadata: boolean,
    detectAdditionalMetadata: boolean,
    debugEnabled = false
): Promise<any> {
    const metadata: any = {
        filePath,
        importDate: new Date(),
        originalExtension: path.extname(filePath),
        importStatus: 'complete',
    };

    if (addFileMetadata) {
        try {
            const stats = await fs.promises.stat(filePath);
            metadata.createdAt = stats.birthtime;
            metadata.modifiedAt = stats.mtime;
            metadata.size = stats.size;

            // Get machine name
            metadata.machineName = os.hostname();

            if (detectAdditionalMetadata) {
                // Additional metadata extraction
                metadata.ownerUid = stats.uid;

                let ownerName = '';
                try {
                    // Attempt to get the username associated with the UID
                    const userInfo = os.userInfo();
                    if (userInfo.uid === stats.uid) {
                        ownerName = userInfo.username;
                    } else {
                        // Cross-platform method to get username from UID is complex
                        // Assign 'unknown' if not matching
                        ownerName = 'unknown';
                    }
                } catch (error) {
                    if (debugEnabled) {
                        console.error('Error getting user info:', error);
                    }
                    ownerName = 'unknown';
                }
                metadata.owner = ownerName;
            }
        } catch (error) {
            if (debugEnabled) {
                console.error(`Error extracting metadata for file ${filePath}:`, error);
            }
            metadata.importStatus = 'incomplete';
        }
    }

    return metadata;
}

export async function convertToMarkdown(filePath: string, debugEnabled:boolean): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const resolvedFilePath = path.resolve(filePath);

    if (ext === '.pdf') {
        try {
            // Read the PDF file as a Uint8Array
            const data = new Uint8Array(await fs.promises.readFile(resolvedFilePath));

            // Load the PDF using PDF.js
            const pdfDocument = await pdfjsLib.getDocument({ data }).promise;

            let content = '';
            // Loop through each page in the PDF and extract text
            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();
                const strings = textContent.items.map((item: any) => item.str);
                content += strings.join(' ') + '\n\n';
            }

            return content;
        } catch (error) {
            if (debugEnabled) { 
                console.error(`Error converting PDF file ${resolvedFilePath}:`, error);
            }
            return '';
        }
    } else {
        // Handle other file types
        try {
            const content = await fs.promises.readFile(resolvedFilePath, 'utf8');
            return content;
        } catch (error) {
            if (debugEnabled) {
                console.error(`Error reading file ${resolvedFilePath}:`, error);
            }
            return '';
        }
    }
}

export async function detectAndConvertUrls(content: string): Promise<string> {
    const urlRegex = /((https?:\/\/)|(www\.))[^\s/$.?#].[^\s]*/gi;
    return content.replace(urlRegex, (url) => {
        const href = url.startsWith('http') ? url : `http://${url}`;
        return `[${url}](${href})`;
    });
}
export async function detectTags(content: string, maxTags: number): Promise<string[]> {
    const doc = nlp.readDoc(content.toLowerCase());

    const tokens = doc.tokens().out(its.value) as string[];
    const posTags = doc.tokens().out(its.pos) as string[];

    const namedEntities = tokens.filter((token, index) => posTags[index] === 'PROPN');

    const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b\s\d{1,2},\s\d{4}|\d{1,2}:\d{2}\s?(?:am|pm))\b/i;

    const wordCounts: { [word: string]: number } = {};

    // Process tokens to extract nouns (avoiding overly aggressive stemming)
    tokens.forEach((token: string, index: number) => {
        const pos = posTags[index];

        // Only process nouns, and avoid words in the custom stop word list
        if (pos === 'NOUN' && !customStopWords.has(token)) {
            const cleanToken = token.replace(/[^\w\s]/gi, '').trim();  // Ensure no extra characters remain
            if (cleanToken.length > 1) { // Ignore very short tokens
                wordCounts[cleanToken] = (wordCounts[cleanToken] || 0) + 1;
            }
        }
    });

    // Add named entities to word counts, filtering out dates and times
    namedEntities.forEach(entity => {
        if (entity && !dateRegex.test(entity)) {
            const cleanEntity = entity.toLowerCase().replace(/[^\w\s]/gi, '').trim(); // Clean up named entity
            if (cleanEntity.length > 1) { // Ignore short entities
                wordCounts[cleanEntity] = (wordCounts[cleanEntity] || 0) + 1;
            }
        }
    });

    // Sort tags by frequency in descending order
    const sortedTags = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]);

    // Select top N tags, limited by the maxTags setting
    const tags = sortedTags.slice(0, maxTags);

    return tags;
}


export async function createInternalLinksInContent(content: string, noteTitles: string[]): Promise<string> {
    // Escape special regex characters in titles
    const escapedTitles = noteTitles.map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    const titleRegex = new RegExp(`\\b(${escapedTitles.join('|')})\\b`, 'g');

    content = content.replace(titleRegex, (match) => `[[${match}]]`);

    return content;
}

export async function createNote(
    vault: Vault,
    filePath: string,
    content: string,
    metadata: any,
    options: {
        replicateFolderStructure: boolean,
        filePrefix: string,
        targetDirectory: string,
        importDirectory: string,
        globalTags: string,
        debugEnabled: boolean,
    }
) {
    const { replicateFolderStructure, filePrefix, targetDirectory, importDirectory, globalTags , debugEnabled} = options;

    // Normalize the target directory within the vault
    const vaultTargetDir = normalizePath(targetDirectory);

    // Determine the relative path from the import directory
    const relativePath = path.relative(importDirectory, filePath);
    let notePath: string;

    if (replicateFolderStructure) {
        // Keep the folder structure within the timestamped directory
        notePath = path.join(vaultTargetDir, path.dirname(relativePath));
    } else {
        // Place all notes directly under the timestamped directory
        notePath = vaultTargetDir;
    }

    // Add filePrefix to filename and set the note file name
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const noteFileName = `${filePrefix}${fileNameWithoutExt}.md`;
    const noteFullPath = path.join(notePath, noteFileName);

    // Normalize the full path within the vault
    const normalizedNotePath = normalizePath(noteFullPath);

    // Ensure the directory exists within the vault
    const noteDir = path.dirname(normalizedNotePath);
    const existingDir = vault.getAbstractFileByPath(noteDir);

    if (!existingDir) {
        // Folder does not exist, create it
        await vault.createFolder(noteDir);
    } else if (!(existingDir instanceof TFolder)) {
        // The path exists but is not a folder
        if (debugEnabled) {
            console.error(`Cannot create folder ${noteDir}: a file with the same name already exists.`);
        }
        return;
    }
    // If the folder exists and is a TFolder, proceed without creating it

    // Check if the note already exists in the vault
    const existingFile = vault.getAbstractFileByPath(normalizedNotePath);
    if (existingFile) {
        if (debugEnabled) {
            console.log(`File ${normalizedNotePath} already exists in the vault. Skipping.`);
        }
        return;
    }

    // Merge global tags with detected tags
    let tags = metadata.tags || [];
    const globalTagsArray = globalTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    tags = [...tags, ...globalTagsArray];

    // Ensure tags are unique
    tags = Array.from(new Set(tags));

    // Format tags correctly (with # and double quotes)
    const formattedTags = tags.map((tag: string) => `"#${tag}"`);

    // Update metadata.tags with the correctly formatted tags
    metadata.tags = formattedTags;

    // Construct front matter
    const frontMatter = '---\n' + Object.entries(metadata)
        .map(([key, value]) => {
            if (key === 'tags') {
                return `${key}:\n  - ${formattedTags.join('\n  - ')}`;
            }
            return `${key}: ${value}`;
        })
        .join('\n') + '\n---\n\n';

    // Final content with front matter
    const finalContent = frontMatter + content;

    // Create the note within the vault
    await vault.create(normalizedNotePath, finalContent);
    if (debugEnabled) {
        console.log(`Created note: ${normalizedNotePath}`);
    }
}
