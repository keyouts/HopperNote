##### **Hopper Note**

![ImageAlt](https://github.com/keyouts/HopperNote/blob/6431c4c87b24b8e92f3ab52b42c864b0f501852e/HopperScreencap.png)

**Hopper Note is a desktop journaling app built to work alongside Highlight Hopper and Highlight Hopper Desktop.**



**It lets you import your exported highlight CSV files, keep a searchable library of saved highlights, and turn them into longer journal entries with formatting, images, and embedded video. It is meant to feel like a writing space first, while still staying compatible with the rest of the Highlight Hopper workflow.**



##### **What it does**



**- Create and edit journal entries**

**- Auto-save entries locally**

**- Import highlight CSV files exported from Highlight Hopper**

**- Keep a searchable highlight library in the right sidebar**

**- Insert saved highlights directly into entries**

**- Format text with bold, italics, headings, lists, and blockquotes**

**- Insert images into entries**

**- Embed YouTube and Vimeo links**

**- Export entries as HTML files that can be opened in a browser or imported into Google Docs**

**- Export the highlight library back to CSV**



##### **Compatibility**



**Hopper Note is designed to work with the same CSV structure used by Highlight Hopper and Highlight Hopper Desktop.**



##### **Expected CSV columns:**



**- URL**

**- Color**

**- Text**

**- Note**

**- Timestamp**



**If a CSV includes those columns, Hopper Note should be able to import it.**



##### **Project structure**



**hopper-journal/**

**├─ main.js**

**├─ preload.js**

**├─ package.json**

**├─ icon.ico**

**├─ index.html**

**├─ app.js**

**└─ styles.css**



##### **Running the app**



**Install dependencies:**



**npm install**



**Start the app:**

**Install Node.js if needed.

**From HopperNote1.2.4 folder, run command / console prompt. (cmd)

**npm start**

**Building the app**



**To build a packaged version:**



**npm run build**

##### 

##### **Exporting entries**



Entries can be exported as .html files. These:



* preserve most formatting
* keep inserted images
* keep inserted highlight blocks
* can be opened in a browser
* can be uploaded to Google Drive and opened in Google Docs


Notes about saving



**The app is intended to save data locally on the device it is running on. It's advised to export regularly to ensure backups of your notes.**



Depending on configuration, saving may use:


Electron-backed local file storage

local browser storage as a fallback


This app does not require an account and does not sync to a remote server.

