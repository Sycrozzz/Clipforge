# ClipForge – AI clipping studio

Drop in a 1–2 hour video → ClipForge transcribes it, finds the most engaging / emotional moments, and cuts them into
short clips. **Before anything is edited you choose your style** (captions, hook headline, zoom, progress bar, format…),
or you can simply grab the **unedited clips** and edit them yourself.

## How it works
1. **Import** a video (browser upload to your own machine, or type a file path to use a huge file in place).
2. **Tell it what you want** – clip length, how many, emotional / funny / controversial…, free-text wishes.
3. **Review clips** – each has a score, reason, emotions, an editable hook headline, trim buttons and a preview.
4. **Unedited clip** (precise cut, or instant stream-copy) **or Edit & subtitle…**
5. In the **style studio** pick a preset, tweak everything, or describe the look in plain words
   ("big pink captions in the middle, no zoom, add my handle") and the AI sets the controls. Test-render 8 seconds, then render.

Edited clips get: word-by-word highlighted subtitles (bundled fonts), 9:16 / 4:5 / 1:1 / 16:9 reframing
(blurred-background or crop), AI hook headline, punch-in / slow zoom, progress bar, handle watermark, loudness normalisation.

## AI provider
Open **Settings** and paste an API key (OpenAI or Groq, or any OpenAI-compatible endpoint). It is used for speech-to-text
(word-level timestamps) and for picking clips. All video processing (ffmpeg) happens locally.

## Getting a double-click app (.exe / .dmg / .AppImage)
The `desktop/` folder contains an Electron wrapper with an embedded database (nothing else to install).
Installers must be built on their target OS, so the easiest route is the included GitHub workflow:

1. Push this project to a GitHub repository.
2. Go to **Actions → Build ClipForge desktop app → Run workflow**.
3. Download the artifact for your OS (Windows `.exe` installer + portable `.exe`, macOS `.dmg`, Linux `.AppImage`).

Or build locally: `node desktop/build.mjs` (installers appear in `dist-desktop/`).
Your clips and database live in `Documents/ClipForge`.

## Development
`npm run dev` – uses PostgreSQL when `DATABASE_URL` is set, otherwise an embedded PGlite database in `./data`.
