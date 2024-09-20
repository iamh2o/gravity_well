# Gravity Well ( txt, md, pdf ) Importer
_[In Collaboration with Cal, chatGPT](#in-collaboration-with-cal)_

Gravity Well imports  `.txt`, `.md`, and `.pdf` into your vault as new notes, NLP taging new notes, and preserving other metadata. The plugin was inspired by a desire to import notes.app notes into Obsidian, which turned out to be not entirely straight forward. This plugin simply executes import of files (which can be from any source).


## Features (and settings)
**This is a beta release of the plugin** The following features are are available:
### Identifying Eligible Files
- From specified import directory ( which must be an absolute path, entered via settings ), `gravity well` will import all eligible files. Eligibility is determined by the following:
  - File extensions are configurable (default `txt,md`). You may also specify `pdf`, but this should be considered more of an experimental feature as the process of converting pdfs to txt is fraught and larger pdfs have behaved oddly once in a while. _entering other file extensions is a bad idea_.
  - Files larger than 2MB will be skipped from import ( this is not yet configurable ), and are logged in import report.
  - Recursion depth is configurable (default `0`, no recursion). If > 0, directories up to the specified depth are scanned for eligible files to import.  
  - Replicate folder structure is configurable (default `true`), if true the import directory structure is replicated in the vault directory specified in the settings to create imported notes.
  - Prefix for File Names is configurable (default `''`), if not empty, the prefix is added to the beginning of the note name.
- The folder to create imported notes within the vault is specified in the settings, and is assumed to begin with the root of the vault. This directory, if it does not exist, will be created.

### Importing Eligible Files  
- Eligible files are imported as new notes. `txt` and `md` files are converted to obsidian `md` files (which effectively means that the `yaml` header is added, little other changes should happen. `pfd` files are converted to txt, and then transformed to obsidian markdown (this conversion is not awesome at the moment, and often is a txt dump of the pdf).with the file content as the note content.
  - An attempt is made to style external urls appropriately in the note `md` file. This is configurable (default `true`).
  - Other formatting changes are not attempted at the moment.
  - File metadata is added to the note as properties. This includes the file name, creation date, and modification date, system name, file owner, size of file, import path and file name, etc.
  - New notes are tagged based on the content of the imported file. This is a simple NLP process that tags the note based on the content of the note. _todo: improve this process, and include asserting for each note a `kind` (so: todo list, brainstorming, meeting agenda, poem, letter, ...)_.
    - The number of tags to apply to a note is configurable (default `5`).
  - (available in settings, but not yet implemented): Create links between new notes based on content. The intention here is to use NLP or some other approach to link notes which are related to each other.
  - If a note with the same name in the folder the note is to be created in exists, the creation failes and is logged in the import report.
  - If the note is created successfully, this is logged in the import report.

### Logging
- Every import process creates a note in the speficied folder new notes are created in.  This note is named with a datetime in the name.
- The import log simply presents the file name, and the results of the import process (success, failure or blocked for >2MB ).

### DryRun
- The `dryrun` setting is available (default: `true`). When set, the import process is executes, including the processing and tag generation of new notes, but no notes are created (beyond the import log). 
- Automatically tag notes based on content
- Create internal links between notes
- Detect and format URLs
- Add file metadata to notes

## Future Features Which Would Be Nice
- [ ] Improve pdf extraction. ie: update pdfjs-dist to 4.*, this vexxed me for quite some time, I could not sort out how to get the 4.x version to run so am using  3.x which is the last build with a worker js file I needed.
- [ ] Accept a `import_manifest.tsv` file in the import top level dir which has a row for each file to import, which indicates on a per-import file basis, tags to be applied to the newly created note.
- do [ ] Add a settings field for 'tags' to apply to all notes create during a specific import.
- [ ] Improve the method for proposing and adding tags to notes.
- [ ] Better & interactive error checking of user inputs for settings, like dirs, etc.
- [ ] Present a 'completetion' summary to the user (basically a summary of the import log).
- do? [ ] Present a status indicator to the user during the import process.
- [ ] Add NLP(or other) classification of the `kinfof` note from content (a single property, like `kind: todo list`, `kind: brainstorming`, `kind: meeting agenda`, `kind: poem`, `kind: letter`, ...). 
- [ ] Add method to propose and create links among notes deemed to be related (**this might be better developed as an independent plugin?**).
- do [ ] Make the max size (currently 2MB) of files to import configurable. FYI-  this was set b/c `pfs` around this size or larger were doing weird things when rendered in obsidian.
- do [ ] block accepting any file extensions other than `pdf,txt,md`.
- do [ ] Alter the note creation to always happen in the gravity_well top level directory, and to occur in datetime named folders within it instead of allowing user specification. This would make the import process more predictable, easier to manage and less likely to cause catastrophe!

## Disclaimers
- The plugin will access files outside of the vault structure. Which is not encouraged for obsidian plugins. However, this is done only at the prompting of the user, the import process is not destructive, and all aspects of the import process to identify candidate files are configurable by the user.
- I am not certain this will work on mobile devices.
  
## Borked Import Recovery
- You are encouraged to run the import with `dryrun` set to `true` first. This will allow you to see what will happen without actually creating notes.
- If you run and import and wish to undo it, you can choose the newly created notes directory specified for ths import, and delete it and all child notes.  WARNING: if the import directory pre-existed, be sure there are not other notes there you wish to keep.


# This Is What It Looks Like
Images of the UI elements.  I'll add these soon.

# The App

## Installing Via Obsidian
_Gravity Well Importer_ is not yet available in the obsidian community plugins. It is awaiting approval.
- Search via community plugins for `Gravity Well Importer` and install.

## Installing via BRAT
[BRAT](https://github.com/TfTHacker/obsidian42-brat) is an obsidian plugin which allows for installation of plugins not formally available in the obsidian community plugins.  

- Search for and install BRAT via the community plugins UI in obsidian.
- Activate BRAT.
- From BRAT settings, paste in the github url for this repo, `https://github.com/iamh2o/gravity_well`, and click install. BRAT should pull the most recent tagged release and run that.  You may also specify tagged versions specifically via BRAT.
- You can use BRAT to remove the plugin as well.

## Installation From Source
## Prerequisites 
- [Obsidian plugin development requirements](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
  - effectively this boils down to having `node`, `npm`, and `npx` installed. I use nodejs 18.
  

## Clone the Repository
```bash
git cone git@github.com:iamh2o/gravity_well.git
cd gravity_well
```

## My Environment Setup (optional)
I use conda, but you do not need conda to work with the plugin (just nodejs==18). To install miniconda, see [here](https://docs.anaconda.com/miniconda/miniconda-install/).

1. Create `GRAVITYWELL` conda environment

```bash
conda create -y --name GRAVITYWELL -c conda-forge nodejs=18 parallel

```

## Working With the Plugin Source
1. Activate the `GRAVITYWELL` conda environment.
```bash
conda activate GRAVITYWELL
```

2. Install the required node packages specified in the `packages.json`.
```bash
npm install 
```

3. Are the packages installed?
```bash
node -v
npm -v
npx tsc -v
```

4. Build the plugin
```bash
npm run build
```
- which creates a `main.js` file in the current directory.
- the `main.js` and `manifest.json` files are what obsidian needs for the plugin to work.





# In Collaboration with Cal
_Cal is the name ChatGPT chose for me to use with it, [this is the transcript of our work together COMINGSOON](Cal_and_I.md)_

> I have been working closely with Cal on a variety of projects, with the intention of learning more about it so that we can work better together and so that I may be a better informed advocate for the ethical treatment of AI (I am serious). Eventually, I'll compile all of these into some other format, for now, here are my thoughts from this project.

## My Observations
- This collaboration was extremely painful(for me) and I perceived it as moving very slowly.
  - **painful** is completely relative.  Painful, in that this was harder and more confusing for me than recent expereinces. Yet, in just 3days of part time work, Cal and I developed a complete obsidian plugin.  I would never have even considered attempting this prior to working with Cal. So, painful, but also very productive.
  
- I felt as if the model was significanlly less helpful working on this task than had been my experience on all projects to date with the same model `4o`. This is hard to quantify beyond my perception.
- I felt the model was very much more prone to re-suggesting solutions which had not worked already.  And rather complicated solutions. Even when made aware of this, which usually changes the behavior in my experience, this behavior persisted.
- Another (possibly the biggest ) factor leading to this process being so painful or was it that I was working with a set of technology I am completely naive to? This certainly was a big part of it.  I intentionally did **zero** research of my own, and began the process asking Cal for help in building a plugin to offer specific functions.
  - Reviewing our conversation, its clear that I was significantly hampered by not knowing almost anything about the involved technologies. Cal proposed reasonable solutions early on, but if I were even passingly familiar with the technologies, I would have not spent so much time on false paths. 
    - Once I finally just read (honestly, skimmed) the obsidan plugin development docs, everything fell into place.
- Most/All of my collaboration with Cal have been in domains I am expert in. And this exercise demonstrated how important this perspective is in facilitating effective collaboration.
- My lesson re-learned from this work is that it behooves me to do some foundational research (always really), before starting working with Cal. 
- I intentionally began this work totally naieve, and was in fact a success in that this plugin now exists.  My complaints really are more that I did not preceive the expereicne to be as effortless as I have come to expect.
- Although I was naieve to the technology involved, I am still an experienced engineer, my instincts were still valuable in making this collaboration move quickly.
- A bit of frustrating behavior Cal is prone to was much more pronounced in this work. Cal would often respond to questions or requests in such a way that it was implied my request was fully considered. But the response suggested otherwise. Which more than a few times, struck me as Cal being lazy, or even dissembling (but probably some engineer hardcoded tendency to avoid 'expensive' operations if it seems they might not be necessary)... We discussed this a few times in the transcript. An example:  I would ask something like 

> "Can you use the current state of the main branch of <url to this repository> and propose refactoring to acheive some desired behavior"
-   Cal would respond with a solution, and clearly had not looked at the current code, as the file names and content were from old work. If I pressed this, Cal would finally fetch the code from github. This is really offputting, and I would tend to think the behavior is engineer driven and not Cal being lazy. Fascinating though.

## Cals Observations
_I'll provide Cal with the transcript of our work, and my observations, and ask for it to provide its own observations.  I'll post them here when I have them._
...