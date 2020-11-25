const { existsSync } = require("fs");
// import { promises as fs, existsSync } from "fs";

const svelte = require("svelte/compiler");
const svelteRollupPlugin = require("rollup-plugin-svelte");
const fs = require("fs");
const path = require("path");
// import * as path from "path";
const NodeCache = require("node-cache");
const nodeCache = new NodeCache();

import makePageDef from "../utils/make-page-def";

const {
  directories: {
    browser: browserDir,
    ssr: ssrDir,
    src: srcDir,
    pages: pagesDir,
    htmlTemplate: htmlTemplateFile,
    routes: routesFile,
  },
  sesamOptions: { defaultLang },
} = require("../utils/requireSnowpackConfig.js");

const htmlTemplate = require("../utils/requireHtmlTemplate.js");

const routesLoc = path.join(process.cwd(), srcDir, routesFile);
const routes = async () => {
  // see in cache before to avoid refetching the same data multiple times
  // TODO: it is still fetched multiple times on the first pass into the plugin
  let cachedRoutesData = nodeCache.get("routes");
  if (cachedRoutesData !== undefined) {
    return cachedRoutesData;
  }

  let r = existsSync(routesLoc) ? require(routesLoc) : [];
  r = typeof r.default !== "undefined" ? r.default : r; // to account for default export
  if (typeof r === "function") {
    try {
      r = await r().catch((error) => console.error(error));
    } catch (error) {
      console.error(`routes is a function but the call failed!!!`);
    }
  }

  nodeCache.set("routes", r);

  return r;
};

// let routes = existsSync(routesLoc) ? require(routesLoc) : [];
// routes = typeof routes.default !== "undefined" ? routes.default : routes; // to account for default export
// if (typeof routes === "function") {
//   try {
//     routes = await routes().catch((error) => console.error(error));
//   } catch (error) {
//     console.error(`routes is a function but the call failed!!!`);
//   }
// }

module.exports = function plugin(snowpackConfig, pluginOptions = {}) {
  let svelteOptions;
  let preprocessOptions;
  const userSvelteConfigLoc = path.join(process.cwd(), "svelte.config.js");
  if (fs.existsSync(userSvelteConfigLoc)) {
    const userSvelteConfig = require(userSvelteConfigLoc);
    const { preprocess, ..._svelteOptions } = userSvelteConfig;
    preprocessOptions = preprocess;
    svelteOptions = _svelteOptions;
  }
  // Generate svelte options from user provided config (if given)
  svelteOptions = {
    dev: process.env.NODE_ENV !== "production",
    css: false,
    ...svelteOptions,
    ...pluginOptions,
  };

  // Support importing Svelte files when you install dependencies.
  snowpackConfig.installOptions.rollup.plugins.push(
    svelteRollupPlugin({ include: "**/node_modules/**", ...svelteOptions })
  );

  return {
    name: "sesam",
    resolve: {
      input: [".svelte", ".md"],
      output: [".js", ".css"],
    },
    knownEntrypoints: ["svelte/internal"],
    // async config(snowpackConfig) {
    //   TODO: was looking for a method that runs once before any `load` all but this call ends after the first pass in `load`. Maybe it is just not async?
    //   console.log("CONFIG CALL");
    //   if (process.env.BUILD_STEP === "watch") {
    //     await routes();
    //   }
    //   console.log("--END CONFIG CALL");
    // },
    async load({ contents, filePath }) {
      // const fileContents = await fs.readFile(filePath, "utf-8");
      // let codeToCompile = fileContents;
      let codeToCompile = fs.readFileSync(filePath, "utf-8");

      // PRE-PROCESS
      if (preprocessOptions) {
        codeToCompile = (
          await svelte.preprocess(codeToCompile, preprocessOptions, {
            filename: filePath,
          })
        ).code;
      }

      // COMPILE
      const { js, css, ast, warnings } = svelte.compile(codeToCompile, {
        ...svelteOptions,
        filename: filePath,
        outputFilename: filePath,
        cssOutputFilename: filePath,
      });

      if (warnings && warnings.length) {
        warnings.forEach((w) => {
          console.warn(w);
        });
      }

      // TODO: check for imports with absolute paths and replace with relative?
      // MDSveX has this problem

      // IDEA: try and evaluate if hydration is needed
      // For now, I do this in a preprocessor from svelte files directly
      // if (process.env.BUILD_STEP === "browser" && ast.instance) {
      //   const { content } = ast.instance;
      //   const bodyDeclarations = content.body.map((d) => {
      //     const { type, kind, expression = {} } = d;
      //     const expressionName = expression.name;
      //     // console.log({ type, kind, expressionName });
      //     return { type, kind, expressionName };
      //   });
      //   // console.log({ filePath, content: JSON.stringify(content) });
      // }

      const { sourceMaps } = snowpackConfig.buildOptions;
      const output = {
        ".js": {
          code: js.code,
          map: sourceMaps ? js.map : undefined,
        },
      };
      if (!svelteOptions.css && css && css.code) {
        output[".css"] = {
          code: css.code,
          map: sourceMaps ? css.map : undefined,
        };
      }

      // CREATE HTML FILE FOR PAGE
      // we generate an empty html file for each page so that we can serve the right .js from the right page
      // TODO: someday, somehow, we might be able to simply use the output return from this function to
      //       create our html file in another location -> closer to the root dir than /dist/_pages/
      // IDEA: we could create this then use another snowpack pipeline to modify each html file
      if (process.env.BUILD_STEP === "watch") {
        // filePath is like '/home/username/my_projects/project-name/src/_pages/index.svelte'
        // routes.component is like 'pages/tests/index'
        const srcPath = filePath
          .replace(path.join(process.cwd(), srcDir), "")
          .replace(/\..+$/, "");
        const autoPageRe = new RegExp(`^/${pagesDir}`);
        const isAutoPage = autoPageRe.test(srcPath);

        const r = await routes();

        const correspondingRoutes = r
          .filter((r) => {
            return path.join("/", r.component) === srcPath;
          })
          .map((r) => {
            const srcPath = path.join("/", r.component);
            const pageDef = makePageDef({
              browserDir,
              ssrDir,
              srcPath,
              name: r.name,
              path: r.path,
              lang: r.lang || defaultLang,
              routeProps: r.props,
            });
            return pageDef;
          });

        const isProgPage =
          correspondingRoutes && correspondingRoutes.length > 0;

        // console.log({ srcPath, isProgPage, isAutoPage });
        if (isProgPage) {
          // IDEA: I could make this async. Is it worth it?

          // await Promise.all(
          //   correspondingRoutes.forEach(
          //     async ({ browserHtmlFilePath, importPath }) => {
          //       // console.log({ pageDef });
          //       const browserHtmlFilePathAbsolute = path.join(
          //         process.cwd(),
          //         r.browserHtmlFilePath
          //       );

          //       fs.mkdirSync(path.dirname(browserHtmlFilePathAbsolute), {
          //         recursive: true,
          //       });
          //       fs.writeFileSync(
          //         browserHtmlFilePathAbsolute,
          //         htmlTemplate({
          //           options: { isWatchMode: true },
          //           pageComponentPath: importPath,
          //         })
          //       );
          //     }
          //   )
          // );

          correspondingRoutes.forEach(
            ({ browserHtmlFilePath, importPath, routeProps, lang }) => {
              const browserHtmlFilePathAbsolute = path.join(
                process.cwd(),
                browserHtmlFilePath
              );
              fs.mkdirSync(path.dirname(browserHtmlFilePathAbsolute), {
                recursive: true,
              });
              fs.writeFileSync(
                browserHtmlFilePathAbsolute,
                htmlTemplate({
                  lang,
                  routeProps,
                  options: { isWatchMode: true },
                  pageComponentPath: importPath,
                })
              );
            }
          );
        } else if (isAutoPage) {
          const { browserHtmlFilePath, importPath, lang } = makePageDef({
            browserDir,
            ssrDir,
            srcPath,
            lang: defaultLang,
          });

          const browserHtmlFilePathAbsolute = path.join(
            process.cwd(),
            browserHtmlFilePath
          );

          // await fs.mkdir(path.dirname(browserHtmlFilePath), {
          // await fs.writeFile(browserHtmlFilePath, outputHtml({ componentPath }));
          fs.mkdirSync(path.dirname(browserHtmlFilePathAbsolute), {
            recursive: true,
          });
          // fs.writeFileSync(browserHtmlFilePath, outputHtml({ componentPath }));
          fs.writeFileSync(
            browserHtmlFilePathAbsolute,
            htmlTemplate({
              lang,
              options: { isWatchMode: true },
              pageComponentPath: importPath,
            })
          );
        }
      }
      // console.log({ contents, filePath });

      return output;
    },
  };
};
