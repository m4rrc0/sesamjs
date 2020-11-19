import { promises as fs, existsSync } from "fs";
import * as path from "path";

import * as glob from "glob";
import JSON5 from "json5";

import slugify from "../utils/slugify";

import makePageDef from "./make-page-def";
import compileHtml from "./compile-html";

const {
  directories: {
    browser: browserDir,
    ssr: ssrDir,
    pages: pagesDir,
    htmlTemplate: htmlTemplateFile,
  },
  sesamOptions: { defaultLang },
} = require("../utils/requireSnowpackConfig.js");

const htmlTemplate = require("../utils/requireHtmlTemplate.js");

const componentsInfosLoc = path.join(
  process.cwd(),
  ssrDir,
  "components-infos.json"
);
const componentsInfos = existsSync(componentsInfosLoc)
  ? require(componentsInfosLoc)
  : {};

const tempHtml = `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="/global.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
  `;

module.exports = function plugin(snowpackConfig, pluginOptions = {}) {
  return {
    name: "sesam-html",
    resolve: {
      input: [".js"],
      output: [".html"],
    },
    async load({ filePath }) {
      const fileContents = await fs.readFile(filePath, "utf-8");
      // // let codeToCompile = fileContents;
      // let fileContents = fs.readFileSync(filePath, "utf-8");

      // // PRE-PROCESS
      // if (preprocessOptions) {
      //   codeToCompile = (
      //     await svelte.preprocess(codeToCompile, preprocessOptions, {
      //       filename: filePath,
      //     })
      //   ).code;
      // }

      // // COMPILE
      // const { js, css, ast, warnings } = svelte.compile(codeToCompile, {
      //   ...svelteOptions,
      //   filename: filePath,
      //   outputFilename: filePath,
      //   cssOutputFilename: filePath,
      // });

      // if (warnings && warnings.length) {
      //   warnings.forEach((w) => {
      //     console.warn(w);
      //   });
      // }

      // const { sourceMaps } = snowpackConfig.buildOptions;
      // const output = {
      //   ".js": {
      //     code: js.code,
      //     map: sourceMaps ? js.map : undefined,
      //   },
      // };
      // if (!svelteOptions.css && css && css.code) {
      //   output[".css"] = {
      //     code: css.code,
      //     map: sourceMaps ? css.map : undefined,
      //   };
      // }

      console.log({ filePath, fileContents });

      return {
        ".html": {
          code: tempHtml,
          // map: sourceMaps ? js.map : undefined,
        },
      };
    },
  };
};
