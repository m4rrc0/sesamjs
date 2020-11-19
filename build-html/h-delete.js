module.exports = function ({
  lang = "en",
  head = "",
  css = "",
  html = "",
  importScripts = "",
  options: { noJS = false } = {},
}) {
  return `
<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="/global.css">
    
    <link rel="icon" type="image/png" href="favicon.png">
    
    ${css ? `<style>${css}</style>` : ""}
    ${head}
  </head>
  <body>
    <div id="app">${html}</div>
    ${
      !noJS && importScripts && importScripts.length
        ? `<script type="module">${importScripts}</script>`
        : ""
    }
  </body>
</html>
`;
};
