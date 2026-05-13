##### **Hopper Note**

![ImageAlt](https://github.com/keyouts/HopperNote/blob/6431c4c87b24b8e92f3ab52b42c864b0f501852e/HopperScreencap.png)

# Hopper Note

Hopper Note is a desktop journaling app built to work alongside Highlight Hopper and Highlight Hopper Desktop.

It lets you import exported highlight CSV files, keep a searchable library of saved highlights, and turn them into longer journal entries with formatting, images, and embedded video.

The app is designed to feel like a writing space first while remaining compatible with the broader Highlight Hopper workflow.

---

## Features

- Create and edit journal entries
- Auto-save entries locally
- Import highlight CSV files exported from Highlight Hopper
- Keep a searchable highlight library in the right sidebar
- Insert saved highlights directly into entries
- Format text with:
  - Bold
  - Italics
  - Headings
  - Lists
  - Blockquotes
- Insert images into entries
- Embed YouTube and Vimeo links
- Export entries as HTML files that can:
  - Be opened in a browser
  - Be imported into Google Docs
- Export the highlight library back to CSV

---

## Compatibility

Hopper Note is designed to work with the same CSV structure used by Highlight Hopper and Highlight Hopper Desktop.

### Expected CSV Columns

- `URL`
- `Color`
- `Text`
- `Note`
- `Timestamp`

If a CSV includes those columns, Hopper Note should be able to import it.

---

## Project Structure

```text
hopper-journal/
├─ main.js
├─ preload.js
├─ package.json
├─ icon.ico
├─ index.html
├─ app.js
└─ styles.css
```

---

## Running the App

### Install Dependencies

```bash
npm install
```

### Start the App

Install Node.js if needed.

From the `HopperNote1.2.4` folder, open a command prompt or terminal and run:

```bash
npm start
```

---

## Building the App

To build a packaged version:

```bash
npm run build
```

---

## Exporting Entries

Entries can be exported as `.html` files. Exported files:

- Preserve most formatting
- Keep inserted images
- Keep inserted highlight blocks
- Can be opened in a browser
- Can be uploaded to Google Drive and opened in Google Docs

---

## Notes About Saving

The app is intended to save data locally on the device it is running on.

Regular exports are recommended to ensure backups of your notes.

Depending on configuration, saving may use:

- Electron-backed local file storage
- Local browser storage as a fallback

This app does not require an account and does not sync to a remote server.

