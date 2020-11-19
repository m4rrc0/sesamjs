import { promises as fs, existsSync } from "fs";
import * as path from "path";

import * as glob from "glob";
import JSON5 from "json5";
const unescape = require("unescape");

import makePageDef from "../utils/make-page-def";
import minifyHtml from "../utils/minifyHtml";

const {
  directories: {
    browser: browserDir,
    ssr: ssrDir,
    pages: pagesDir,
    htmlTemplate: htmlTemplateFile,
  },
  sesamOptions: { defaultLang },
  buildOptions: { minify: shouldMinify },
} = require("../utils/requireSnowpackConfig.js");

const usePartialHydration = true;

const htmlTemplate = require("../utils/requireHtmlTemplate.js");

const componentsInfosLoc = path.join(
  process.cwd(),
  ssrDir,
  "components-infos.json"
);
const componentsInfos = existsSync(componentsInfosLoc)
  ? require(componentsInfosLoc)
  : {};

async function compileHtml(pageDef /*, options */) {
  // console.log({ pageDef });
  const {
    srcPath,
    ssrPath,
    browserPath,
    relativePath,
    importPath,
    relativeHtmlPath,
    relativeHtmlFilePath,
    browserHtmlFilePath,
    name,
    routeProps,
    lang,
    options: { noJS } = {},
  } = pageDef;

  // console.log({
  //   srcPath,
  //   ssrPath,
  //   browserPath,
  //   relativePath,
  //   importPath,
  //   relativeHtmlPath,
  //   relativeHtmlFilePath,
  //   browserHtmlFilePath,
  //   name,
  //   routeProps,
  // });

  if (!relativeHtmlPath || !relativePath) {
    console.error(
      `unable to create HTML for page "${srcPath}" because it is lacking relativeHtmlPath or relativePath. pageDef is`,
      pageDef
    );
    return;
  }
  // TODO: don't load JS if it is an individual page (not SPA) and there are no side effects in this page
  // IDEA: check the content of the JS output of Comp.render to see if there are dom events or onMount svelte method or things like that
  // IDEA: explicitely set a comment in our svelte component to be found here?
  // if (/no-js/.test(html)) {
  //   console.log(html);
  // }

  try {
    const Comp = require(path.join(process.cwd(), ssrPath)).default;
    const CompStr = await fs.readFile(
      path.join(process.cwd(), ssrPath),
      "utf-8"
    );

    // IMPORTANT: for replacing nodes and hydrating, some info here (for Svelte 2!!!!!): https://github.com/sveltejs/svelte/issues/1549

    const pageInfos = componentsInfos[srcPath];
    // const hydratePage = !usePartialHydration || pageInfos.shouldBeHydrated;

    const { head, html, css } = Comp.render({
      ...routeProps,
    });

    // let importScripts = "";

    // TODO: if (pageInfos.shouldBeHydrated) -> we could skip most of this logic and go straight to the `importScripts`

    // if (false && hydratePage) {
    //   console.info(`page ${importPath} will be hydrated`);
    //   importScripts = `import Comp from '${importPath}';new Comp({target: document.querySelector('#app'),hydrate: true,props: ${
    //     routeProps && JSON.stringify(routeProps)
    //   }});`;
    // } else {
    //   // Retrieve import statements in file so that I have the file path corresponding to the components invocations
    //   const componentsImported = CompStr.match(
    //     // match things like 'import MainTitle from "../partials/MainTitle.js";'
    //     /import.+\.js";/g
    //   ).map((importStatementString) => {
    //     const currentName = importStatementString
    //       .replace("import ", "")
    //       .replace(/ from.+/, "");

    //     // TODO: more solid way to construct the import path
    //     // currently the algo depends on the import statement navigating back to src,
    //     // we can not navigate inside a sub dir or the importPath will not match
    //     // INFO: for this to work, pages have to be in a separate folder than the children they call
    //     const currentImportPath = importStatementString.replace(
    //       /(\.\.\/)+/,
    //       "/_dist_/"
    //     );
    //     const currentSrcPath = currentImportPath
    //       .replace(/^.+"(.+)".+$/, (...match) => match[1])
    //       .replace("/_dist_", "")
    //       .replace(/\.js$/, "")
    //       .replace(/\.h$/, "");

    //     return {
    //       importStatementString,
    //       importPath: currentImportPath,
    //       srcPath: currentSrcPath,
    //       name: currentName,
    //     };
    //   });

    // // To retrieve components invocations throughout the file
    // const compInvocationRe = new RegExp(
    //   /validate_component\((\w+), "(\w+)".{4}render.{3}result, (.+), (.+),/,
    //   "g"
    // );
    // // INFO: one invocation match is like [
    // //   'validate_component(CompName, "CompName").$$render($$result, { ...props }, {}, {\n', // the match
    // //   'CompName',
    // //   'CompName',
    // //   '{ ...props }',
    // //   index: 563,
    // //   input: '...the content of the ssr component file',
    // //   groups: undefined
    // // ]
    // // TODO: check how it works for slots. Is it implemented in another set of curlies?
    // // TODO: does it work if we use named imports? Is it a practice in Svelte?
    // const allComponentsInvocations = [
    //   ...CompStr.matchAll(compInvocationRe),
    // ].map((invocation, i) => {
    //   // let [wholeMatch, currentName, , staticProps, staticBindings] = invocation
    //   const currentName = invocation[1];
    //   if (ssrPath === "build-temp/_dist_/_pages/index.js") {
    //     console.log({ invocation });
    //   }
    //   // We can provide props to a component by using its name as a key in the page props
    //   // TODO: is it necessary? Aren't the props passed on page?
    //   // Probably not -> I expect we'll have the reference to a variable, not the actual 'static' data
    //   const currentRouteProps = routeProps && routeProps[currentName];
    //   let staticProps = {};
    //   try {
    //     staticProps = JSON5.parse(invocation[3]);
    //   } catch (error) {
    //     console.error(
    //       `static props for ${currentName} in component ${srcPath} can not be parsed as JSON`
    //     );
    //   }
    //   const { hid } = staticProps;
    //   const currentCompInfos = pageInfos && pageInfos.children[i];
    //   if (currentName !== (currentCompInfos && currentCompInfos.name)) {
    //     console.warn(
    //       `component names don't match: ${currentName}, ${
    //         currentCompInfos && currentCompInfos.name
    //       }`
    //     );
    //   }

    //   // match the invocation with its import statement infos
    //   // const importInfos = componentsImported.filter(
    //   //   ({ name: importName }) => importName === currentName
    //   // )[0];

    //   // console.log({ componentsImported });

    //   // Extend information we have on the child component invoked thanks to our componentsInfos JSON
    //   // const extendedInfos = importInfos && componentsInfos[importInfos.srcPath];

    //   return {
    //     // ...extendedInfos,
    //     // ...importInfos,
    //     ...currentCompInfos,
    //     name: currentName,
    //     hid,
    //     props: {
    //       ...staticProps,
    //       ...currentRouteProps,
    //     },
    //   };
    // });

    //   const hydratableComponents = allComponentsInvocations.filter((inv) => {
    //     return inv.shouldBeHydrated;
    //   });

    //   if (hydratableComponents && hydratableComponents.length) {
    //     // INFO: The normal component mount is replaced by `mountReplace` here
    //     // to allow replacing the component instead of appending it to its parent
    //     // new ${r.name}({
    //     //   target: document.querySelector('#${r.name}'),
    //     //   hydrate: true,
    //     //   props: ${r.props && JSON.stringify(r.props)}
    //     //   anchor:	null	// A child of target to render the component immediately before
    //     //   intro:	false //	If true, will play transitions on initial render, rather than waiting for subsequent state changes
    //     // });
    //     let compImports = [];
    //     let compMounts = [];
    //     hydratableComponents.forEach((hc) => {
    //       console.info(`component ${hc.srcPath} will be hydrated`);
    //       if (compImports.indexOf(hc.importPath) < 0) {
    //         compImports.push(hc.importPath);
    //       }
    //       compMounts.push(
    //         `mountReplace(${
    //           hc.name
    //         },{target: document.querySelector('[data-hid="${
    //           hc.hid
    //         }"]'),props: ${hc.props && JSON.stringify(hc.props)}});`
    //       );
    //     });

    //     importScripts = `import mountReplace from '/mountReplace.js';${compImports.join(
    //       "\n"
    //     )}${compMounts.join("\n")}`;
    //   }
    // }

    // TODO: what we bo for html we should do for head as well probably
    // TODO: props
    // TODO: must work when there are multiple times the same component on the page

    const hydratableSlots = [
      ...html.matchAll(
        /<([\w-]+)((?!>|<)[\s\S])+data-h(parent)((?!>|<)[\s\S])+>/g
      ),
    ].map(({ 0: hm, index: htmlIndex }) => {
      // transform array of arrays into object of hydratable props { id, path, data }
      const hprops = [
        ...hm.matchAll(/(slot|data-h(parent))="([^"]*)"/g),
      ].reduce((accu, { 1: hTypeFb, 2: hType, 3: hVal }) => {
        return {
          ...accu,
          [hType || hTypeFb]: hVal,
        };
      }, {});

      return {
        htmlIndex,
        ...hprops,
      };
    });

    const hydratableMatches = [
      // ...html.matchAll(/<([\w-]+)((?!>|<)[\s\S])+data-hpath="([\w-_/]*)"/g),
      ...html.matchAll(
        /<([\w-]+)((?!>|<)[\s\S])+data-h(path|id|data)((?!>|<)[\s\S])+>/g
      ),
    ].map(({ 0: hm, index: htmlIndex }) => {
      // transform array of arrays into object of hydratable props { id, path, data }
      const hprops = [...hm.matchAll(/data-h(path|id|data)="([^"]*)"/g)].reduce(
        (accu, { 1: hType, 2: hVal }) => {
          // let hValParsed;
          // if (hType === "data") {
          //   try {
          //     hValParsed = !hVal ? {} : JSON5.parse(unescape(hVal));
          //   } catch (error) {}
          // }
          return {
            ...accu,
            [hType]: hType === "data" ? unescape(hVal) : hVal,
          };
        },
        {}
      );

      hprops.importName = hprops.path.replace(/\//g, "");
      hprops.importStatement = `import ${hprops.importName} from '${path.join(
        "/_dist_",
        hprops.path
      )}.js'`;

      hprops.slots = hydratableSlots
        .filter(({ parent }) => {
          return parent === hprops.id;
        })
        .map(({ parent, slot }) => {
          const qs = `[data-hparent="${parent}"]${
            typeof slot !== "undefined" ? `[slot="${slot}"]` : ":not([slot])"
          }`;
          return `${slot || "default"}: document.querySelector('${qs}')`;
        })
        .join(",");

      // try {
      //   hprops.slots = JSON5.stringify(hprops.slots);
      // } catch (error) {
      //   console.error(
      //     `Slots for parent ${hprops.id} does not have proper attributes`
      //   );
      //   hprops.slots = null;
      // }

      // if (typeof hprops.data === "string") {
      //   console.error(
      //     `hydratable props for ${hprops.id} in component ${srcPath} can not be parsed with JSON5`
      //   );
      // }

      return {
        htmlIndex,
        ...hprops,
      };
    });

    // console.log({ hydratableSlots, hydratableMatches });

    let compImports = [];
    let compMounts = [];
    hydratableMatches.forEach(
      ({
        htmlIndex,
        path: hSrcPath,
        id: hid,
        data: hdata = "{}",
        importName,
        importStatement,
        slots,
      }) => {
        if (!hid || !hSrcPath) {
          console.error(
            `component ${hSrcPath} in page ${srcPath} can not be hydrated because it lacks data props`
          );
          return;
        }

        console.info(
          `component ${hSrcPath} with id ${hid} will be hydrated on page ${srcPath}`
        );
        if (compImports.indexOf(importStatement) < 0) {
          compImports.push(importStatement);
        }
        //////////////////////////////
        // TODO: slots!
        // Problem: is it because hydrated component does not have the same attributes anymore???
        compMounts.push(
          `mountReplace(${importName},{
            target:document.querySelector('[data-hid="${hid}"]'),
            hydrate:true,
            props:{"hdata":${hdata}},
            ${slots ? `slots: {${slots}}` : ""}
          });`
        );
      }
    );

    // if (ssrPath === "build-temp/_dist_/_pages/index.js") {
    //   // console.log({
    //   //   str: CompStr.match("hid"),
    //   //   html: html.match("data-hid="),
    //   // });
    //   console.log({ hydratableMatches });
    // }

    // const compImports = [`import MainTitle from '/partials/MainTitle.js;`];
    // const compMounts = [
    //   `mountReplace(MainTitle,
    //     {target: document.querySelector('[data-hpath="/partials/MainTitle"]'),
    //     props: {});`,
    // ];
    const importScripts = !compImports.length
      ? ""
      : `import mountReplace from '/mountReplace.js';
        ${compImports.join("\n")}
        ${compMounts.join("\n")}`;
    // const importScripts = `
    //   import mountReplace from '/mountReplace.js';
    //   import partialsMainTitle from '/_dist_/partials/MainTitle.js';
    //   import Routing from '/_dist_/pages/spa/Routing.js';
    //   mountReplace(partialsMainTitle, {
    //     target: document.querySelector('[data-hpath="/partials/MainTitle"]'),
    //     props: {}
    //   });
    //   mountReplace(Routing, {
    //     target: document.querySelector('[data-hpath="/pages/spa/Routing"]'),
    //     props: {}
    //   });`;

    let outputHtml = htmlTemplate({
      head,
      css: css && css.code,
      html,
      importScripts,
      lang,
      routeProps,
      // options: { noJS = false, isWatchMode = false },
      // pageComponentPath = "/_dist_/_pages/index.js",
    });
    //     `
    // <!DOCTYPE html>
    //   <html lang="en">
    //   <head>
    //     ${head}
    //     <link rel="stylesheet" type="text/css" href="/global.css">
    //     <style>${css && css.code}</style>
    //   </head>
    //   <body>
    //     <div id="app">${html}</div>
    //     ${!noJS ? `<script type="module">${importScripts()}</script>` : ""}
    //   </body>
    // </html>
    //     `;

    // TODO: Minify HTML files with html-minifier if in production.
    if (shouldMinify) {
      outputHtml = await minifyHtml({ html: outputHtml });
    }

    await fs.mkdir(path.dirname(browserHtmlFilePath), { recursive: true });
    await fs.writeFile(browserHtmlFilePath, outputHtml);

    console.info(`Compiled HTML ${browserHtmlFilePath}`);

    return { browserHtmlFilePath };
  } catch (err) {
    console.log("");
    console.error(`Failed to compile page: ${browserHtmlFilePath}`);
    console.error(err);
    console.log("");
    process.exit(1);
    return { browserHtmlFilePath };
  }
}

async function initialBuild() {
  const globConfig = { nodir: true };
  const ssrFiles = glob.sync(
    `${ssrDir}/_dist_/**/!(*+(spec|test)).+(js|mjs)`,
    globConfig
  );
  const jsAutomaticPagesPaths = glob.sync(
    `${ssrDir}/_dist_/_pages/**/!(*+(spec|test)).+(js|mjs)`,
    globConfig
  );
  let programmaticPages = []; // TODO:
  try {
    programmaticPages =
      require(path.join(process.cwd(), "/src/routes.js")).default || [];
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      console.info("no /src/routes.js file defined for programmatic page");
    } else {
      console.error(error);
    }
  }

  // create pageDef
  const jsAutomaticPages = jsAutomaticPagesPaths.map((ssrPath) => {
    // ssrPath is like 'build-temp/_dist_/_pages/about/index.js
    const srcPath = ssrPath
      .replace(`${ssrDir}/_dist_`, "")
      .replace(/\.js$/, "")
      .replace(/\.h$/, "");

    const pageDef = makePageDef({
      browserDir,
      ssrDir,
      srcPath,
      ssrPath,
      lang: defaultLang,
    });
    return pageDef;
  });
  if (typeof programmaticPages === "function") {
    try {
      programmaticPages = await programmaticPages().catch((error) =>
        console.error(error)
      );
    } catch (error) {
      console.error(`programmaticPages is a function but the call failed!!!`);
    }
  }
  programmaticPages = programmaticPages.map((route) => {
    const srcPath = path.join("/", route.component);
    const pageDef = makePageDef({
      browserDir,
      ssrDir,
      srcPath,
      name: route.name,
      path: route.path,
      lang: route.lang || defaultLang,
      routeProps: route.props,
    });
    return pageDef;
  });

  // Modify js files to properly import from the 'build-temp' folder
  // TODO: account for other imports as well, not only web_modules ?
  // NOTE: might not be necessary anymore as it seems Snowpack has switched to relative paths
  // await Promise.all(
  //   ssrFiles.map(async (ssrPath) => {
  //     // ssrPath is like 'build-temp/_dist_/_pages/index.js
  //     const absolutePath = path.join(
  //       process.cwd(),
  //       `/${browserDir}/web_modules`
  //     );
  //     const content = await fs.readFile(ssrPath, "utf-8");
  //     const result = content.replace(
  //       /from "\/web_modules/g,
  //       `from "${absolutePath}`
  //     );

  //     await fs.writeFile(ssrPath, result, "utf-8");
  //   })
  // );

  // console.log({ jsAutomaticPages });

  const pages = await Promise.all(
    [...jsAutomaticPages, ...programmaticPages].map(async (pageDef) => {
      // console.log({ pageDef });
      await compileHtml(pageDef);
    })
  );
}

async function main() {
  await initialBuild();

  fs.copyFile(
    path.join(__dirname, "/../public-scripts/mountReplace.js"),
    path.join(process.cwd(), browserDir, "mountReplace.js")
  );
}

main();
