# Gravity Well - Obsidian Plugin
_[In Collaboration with Cal, chatGPT](#in-collaboration-with-cal)_

Gravity Well is an Obsidian community plugin that imports `.txt`, `.md`, and `.pdf` files into your vault, preserving metadata, adding tags, and replicating folder structure.


## Features
- Import files with recursion control
- Preserve and replicate folder structure
- Automatically tag notes based on content
- Create internal links between notes
- Detect and format URLs
- Add file metadata to notes

# The App
## Prerequisites ( intended for Mac/Linux, no promises on Windows)
- Miniconda
  
## Environment Setup
1. Create `GRAVITYWELL` conda environment

```bash
conda create -y --name GRAVITYWELL -c conda-forge nodejs=18 parallel

```

## Installation
1. Activate the `GRAVITYWELL` environment.
```bash
conda activate GRAVITYWELL
```

2. Install the required node packages.
```bash
npm install 
npm run build
```


1. Are the packages installed?
```bash
node -v
npm -v
npx tsc -v
```





## Settings
- File Extensions: Specify which file types to import (.txt, .md, .pdf)
- Recursion Depth: Set how many levels of folders to import
- Replicate Folder Structure: Whether to replicate the directory structure
- Prefix for File Names: Add a prefix to each imported file
- Dry Run: Simulate the import process and report conflicts

## Usage
After enabling the plugin, use the command `Process and Import Files` from the command palette.

 

# In Collaboration with Cal
_Cal is the name ChatGPT chose for me to use with it, below is a link to our collaborative transcript_
- [Cal and I](Cal_and_I.md)


# To Do
- [ ] update pdfjs-dist to 4.*, this vexxed me for quite some time, so it sits at 3.x(max) which is the last build with a worker js file I needed.
- [x] create final report of imports
- [ ] Accept a `import_manifest.tsv` file in the import top level dir which has a row for each file to import, which indicates on a per-import file basis, tags to be applied to the newly created note.
- [ ] Add a settings field for 'tags' to apply to all notes create during a specific import.
- [x] rearrange settings to be more user friendly
- [x] figure out how to get working w/BRAT.
- [ ] take a pass through the initial docs, clean up, and clearly write sections on intended use cases, features, and so on.
- [ ] review how tags are determined
- [ ] Better & interactive error checking of user inputs for settings, like dirs, etc.
- [ ] Present a 'completetion' summary to the user (basically from the log).
- [ ] Expose this to the obsidian plugin community.
- [ ] NLP tagging of notes from the original file content is _minimal_, and largely ignores numeric, date or other 'non-word' content.  This can be improved.
- [x] Block creating files from input files > 2MB, make this configurable. Blocked files are logged to the final report.
