module.exports = function ({
  head = "",
  css = "",
  html = "",
  importScripts = "",
  lang = "en",
  routeProps,
  options: { noJS = false, isWatchMode = false } = {},
  pageComponentPath = "/_dist_/_pages/index.js",
}) {
  return `
<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="/global.css">
    
    <link rel="icon" type="image/png" href="/favicon.png">
    
    ${css ? `<style>${css}</style>` : ""}
    ${head}
  </head>
  <body>
    <div id="app">${html}</div>
    ${
      !noJS && importScripts && importScripts.length
        ? `<script type="module">${importScripts}</script>`
        : ""
    }${
    isWatchMode
      ? `
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <script type="module">
      import Comp from "${pageComponentPath}";
      new Comp({
        target: document.querySelector('#app'),
        // hydrate: true,
        ${
          routeProps ? `props: ${JSON.stringify(routeProps, undefined, 2)}` : ""
        }
      });
    </script>
    `
      : ""
  }
  </body>
</html>
`;
};
