// File: handlers/FileHandler.ts

import { TFile, TFolder, Vault, App, normalizePath, Notice } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as pdfjsLib from 'pdfjs-dist';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import natural from 'natural';

console.log("Model Loaded:", model);
// Initialize wink-nlp
const nlp = winkNLP(model);
const its = nlp.its;

console.log("Model Loaded:", model);
console.log("Wink NLP Initialized:", nlp);

// Set the workerSrc to the provided URL
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// Define custom stop words
const customStopWords: Set<string> = new Set([
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

    constructor(app: App) {
        this.app = app;
    }

    async processFiles(settings: any) {
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
        } = settings;

        console.log(`Starting file processing in directory: ${importDirectory} with extensions: ${fileExtensions}`);

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
        const files = await traverseDirectory(importDirectory, extensionsArray, maxRecursionDepth);

        const totalFilesDiscovered = files.length;
        let totalNotesCreated = 0;
        let totalFailures = 0;

        // Collect note titles for internal linking
        const noteTitles = files.map(file => path.basename(file, path.extname(file)));

        // Initialize log entries array
        const logEntries: { filePath: string; status: string }[] = [];

        for (const file of files) {
            try {
                // Check file size
                const stats = await fs.promises.stat(file);
                const fileSizeInBytes = stats.size;
                const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

                if (fileSizeInMB > maxFileSizeMB) {
                    if (dryRun) {
                        console.warn(`Dry Run: Would block importing file ${file} as it exceeds ${maxFileSizeMB}MB`);
                        logEntries.push({ filePath: file, status: `Would block importing as exceeds ${maxFileSizeMB}MB` });
                    } else {
                        console.warn(`Blocked importing file ${file} as it exceeds ${maxFileSizeMB}MB`);
                        logEntries.push({ filePath: file, status: `Blocked importing as exceeds ${maxFileSizeMB}MB` });
                    }
                    totalFailures++;
                    // Skip processing this file
                    continue;
                }

                const metadata = await extractMetadata(file, addFileMetadata, detectAdditionalMetadata);
                let content = await convertToMarkdown(file);

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
                    });
                    console.log(`Created note: ${path.join(targetDirectory, filePrefix + path.basename(file, path.extname(file)) + '.md')}`);
                    // Log successful import
                    logEntries.push({ filePath: file, status: 'Created note' });
                    totalNotesCreated++;
                } else {
                    console.log(`Dry Run: Would create note for ${file} with metadata:`, metadata);
                    // Log dry run status
                    logEntries.push({ filePath: file, status: 'Would create note' });
                }
            } catch (error) {
                console.error(`Error processing file ${file}:`, error);
                if (!dryRun) {
                    // Log failed import
                    logEntries.push({ filePath: file, status: 'Failed to create note' });
                } else {
                    // Log failed dry run
                    logEntries.push({ filePath: file, status: 'Dry run failed' });
                }
                totalFailures++;
            }
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
                globalTags: '',
            });

            console.log(`Import log created: ${path.join(targetDirectory, logFileName)}`);
        } catch (error) {
            console.error(`Error creating import log:`, error);
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
    }
}

export async function traverseDirectory(
    directory: string,
    extensions: string[],
    maxDepth: number,
    currentDepth = 0
): Promise<string[]> {
    let files: string[] = [];

    if (maxDepth !== -1 && currentDepth > maxDepth) return files;

    let dirents;
    try {
        dirents = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (error) {
        console.error(`Error reading directory ${directory}:`, error);
        return files;
    }

    for (const dirent of dirents) {
        const res = path.resolve(directory, dirent.name);
        if (dirent.isDirectory()) {
            const subFiles = await traverseDirectory(res, extensions, maxDepth, currentDepth + 1);
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
    detectAdditionalMetadata: boolean
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
                    console.error('Error getting user info:', error);
                    ownerName = 'unknown';
                }
                metadata.owner = ownerName;
            }
        } catch (error) {
            console.error(`Error extracting metadata for file ${filePath}:`, error);
            metadata.importStatus = 'incomplete';
        }
    }

    return metadata;
}

export async function convertToMarkdown(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const resolvedFilePath = path.resolve(filePath);

    if (ext === '.pdf') {
        try {
            // Read the PDF file as a Uint8Array
            const data = new Uint8Array(await fs.promises.readFile(resolvedFilePath));

            // Load the PDF using PDF.js with workers disabled
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
            console.error(`Error converting PDF file ${resolvedFilePath}:`, error);
            return '';
        }
    } else {
        // Handle other file types
        try {
            const content = await fs.promises.readFile(resolvedFilePath, 'utf8');
            return content;
        } catch (error) {
            console.error(`Error reading file ${resolvedFilePath}:`, error);
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

    // Extract tokens and their part-of-speech
    const tokens = doc.tokens().out(its.value);
    const posTags = doc.tokens().out(its.pos);

    // Extract named entities as objects
    const namedEntities = doc.entities().out('array');  // Use 'array' to get full entity objects

    // Regular expression to match dates and times
    const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b\s\d{1,2},\s\d{4}|\d{1,2}:\d{2}\s?(?:am|pm))\b/i;

    // Initialize word counts for filtering based on relevance
    const wordCounts: { [word: string]: number } = {};

    // Process tokens to extract nouns
    tokens.forEach((token, index) => {
        const pos = posTags[index];

        if (pos === 'NOUN' && !customStopWords.has(token)) {
            const stemmedWord = stemmer.stem(token);
            wordCounts[stemmedWord] = (wordCounts[stemmedWord] || 0) + 1;
        }
    });

    // Add named entities to word counts, filtering out dates and times
    namedEntities.forEach(entity => {
        // Check if the entity is an object and has a 'normal' property and is not a date or time
        if (entity && typeof entity === 'object' && entity.normal && !dateRegex.test(entity.normal)) {
            const normalizedEntity = entity.normal.toLowerCase();  // Access 'normal' property
            if (!customStopWords.has(normalizedEntity)) {
                const stemmedEntity = stemmer.stem(normalizedEntity);
                wordCounts[stemmedEntity] = (wordCounts[stemmedEntity] || 0) + 1;
            }
        } else {
            console.warn(`Entity without 'normal' property or date/time encountered:`, entity);
        }
    });

    // Sort tags by frequency in descending order
    const sortedTags = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]);

    // Select top N tags, limited by the maxTags setting
    const tags = sortedTags.slice(0, maxTags);

    return tags;
}

export async function createInternalLinksInContent(content: string, noteTitles: string[]): Promise<string> {
    const titleSet = new Set(noteTitles);

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
    }
) {
    const { replicateFolderStructure, filePrefix, targetDirectory, importDirectory, globalTags } = options;

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
        console.error(`Cannot create folder ${noteDir}: a file with the same name already exists.`);
        return;
    }
    // If the folder exists and is a TFolder, proceed without creating it

    // Check if the note already exists in the vault
    const existingFile = vault.getAbstractFileByPath(normalizedNotePath);
    if (existingFile) {
        console.log(`File ${normalizedNotePath} already exists in the vault. Skipping.`);
        return;
    }

    // Merge global tags with detected tags
    let tags = metadata.tags || [];
    const globalTagsArray = globalTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    tags = [...tags, ...globalTagsArray];

    // Ensure tags are unique
    tags = Array.from(new Set(tags));

    // Update metadata.tags
    metadata.tags = tags;

    // Construct front matter
    const frontMatter = '---\n' + Object.entries(metadata)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n') + '\n---\n\n';

    // Final content with front matter
    const finalContent = frontMatter + content;

    // Create the note within the vault
    await vault.create(normalizedNotePath, finalContent);
    console.log(`Created note: ${normalizedNotePath}`);
}
