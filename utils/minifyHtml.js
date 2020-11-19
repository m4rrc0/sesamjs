import { minify as htmlMinifier } from "html-minifier";

async function minifyHtml({ html, pagePath }) {
  try {
    let outputHtml = html || "";

    if (!html) {
      outputHtml = await fs.readFile(pagePath, "utf8");
    }

    const result = htmlMinifier(outputHtml, {
      caseSensitive: true,
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      //   conservativeCollapse: true,
      keepClosingSlash: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
    });

    if (html) {
      return result;
    }

    await fs.writeFile(pagePath, result);
    console.info(`HTML-minifier minified ${pagePath}`);
  } catch (err) {
    console.log("");
    console.error(`Failed to minify with HTML-minifier: ${pagePath}`);
    console.error(err);
    console.log("");
    return html;
  }
}

export default minifyHtml;
