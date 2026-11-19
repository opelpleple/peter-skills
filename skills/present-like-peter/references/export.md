# Export

The HTML is the master. PDF and PPTX are for sending, printing and for rooms that only accept PowerPoint.

```sh
node <skill>/scripts/export.cjs dist/<deck-slug>.html export/ [lang]   # <deck-slug>.pdf, png/NN.png (2x), notes.json
python3 <skill>/scripts/to_pptx.py export/ export/<deck-slug>.pptx    # image slides + presenter notes
```

- **PDF**: named after the HTML file. `?print=1` makes the engine lay out every slide as one 1920 x 1080 page in its final state, and Chrome prints it as one vector PDF (text stays selectable; canvas scenes are raster). For a bilingual deck export one PDF per language plus the bilingual one if the audience needs it.
- **PNG**: one per slide at 2x for the PPTX, social posts and the contact sheet.
- **PPTX**: full-bleed images (compressed to JPG in a temp folder, so `export/` keeps only the PNGs) with the speaker notes in the notes pane. It looks exactly like the deck but is not editable text. If the user needs an editable native PPTX, rebuild the content with a PPTX tool instead and say what is lost (motion, set pieces).
- **Build steps in exports**: exports show each slide's final state. When a build step carries meaning (a reveal, a race), export that slide's steps separately by extending `export.cjs` to loop steps for the slide indices you name, and say so in the hand back.
- **Errors**: `export.cjs` exits 1 on page errors, console errors or any network request, the same as `check.cjs`.
- **Check**: the PDF page count equals the slide count; open two pages to confirm fonts were inlined (no fallback faces).
- **Size**: a deck with inlined fonts and three.js is typically 1 to 3 MB as HTML. Large raster assets belong in the deck only when they are the content.
