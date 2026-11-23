# PLSN125 // Check-in

QR check-in page for the Pulsar N125 Official Club (static site, GitHub Pages ready).

```
index.html          page
join.html           WhatsApp preview card (image + group name) that forwards to the group - edit the 2 YOUR-... lines
src/css/style.css   theme + styles
src/js/app.js       login, scanner, WhatsApp
src/data/           data.enc.json  (AES-encrypted rider data)
src/img/            125.jpg    (image link sent in the WhatsApp message)
tools/build_data.py rebuild data.enc.json from the Google Form xlsx (run locally, do NOT upload)
```

**Deploy:** push everything except `tools/` to a repo -> Settings -> Pages -> branch `main`, root.
**Update data:** `ADMIN_PASSWORD='...' N125_GROUP_NAME='Group name' python tools/build_data.py Responses.xlsx`
Never commit the .xlsx. The camera needs HTTPS (GitHub Pages is).
