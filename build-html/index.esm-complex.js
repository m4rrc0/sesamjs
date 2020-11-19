import { promises as fs, existsSync } from "fs";
import * as path from "path";

import * as glob from "glob";
import JSON5 from "json5";

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
      `unable to create HTML for page "${name}" because it is lacking relativeHtmlPath or relativePath. pageDef is`,
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
    // IMPORTANT: for replacing nodes and hydrating, some info here: https://github.com/sveltejs/svelte/issues/1549

    const pageInfos = componentsInfos[srcPath];
    const hydratePage = !usePartialHydration || pageInfos.shouldBeHydrated;

    const { head, html, css } = Comp.render({
      ...routeProps,
    });

    let importScripts = "";

    // TODO: if (pageInfos.shouldBeHydrated) -> we could skip most of this logic and go straight to the `importScripts`

    if (false && hydratePage) {
      console.info(`page ${importPath} will be hydrated`);
      importScripts = `import Comp from '${importPath}';new Comp({target: document.querySelector('#app'),hydrate: true,props: ${
        routeProps && JSON.stringify(routeProps)
      }});`;
    } else {
      // Retrieve import statements in file so that I have the file path corresponding to the components invocations
      const componentsImported = CompStr.match(
        // match things like 'import MainTitle from "../partials/MainTitle.js";'
        /import.+\.js";/g
      ).map((importStatementString) => {
        const currentName = importStatementString
          .replace("import ", "")
          .replace(/ from.+/, "");

        // TODO: more solid way to construct the import path
        // currently the algo depends on the import statement navigating back to src,
        // we can not navigate inside a sub dir or the importPath will not match
        // INFO: for this to work, pages have to be in a separate folder than the children they call
        const currentImportPath = importStatementString.replace(
          /(\.\.\/)+/,
          "/_dist_/"
        );
        const currentSrcPath = currentImportPath
          .replace(/^.+"(.+)".+$/, (...match) => match[1])
          .replace("/_dist_", "")
          .replace(/\.js$/, "")
          .replace(/\.h$/, "");

        return {
          importStatementString,
          importPath: currentImportPath,
          srcPath: currentSrcPath,
          name: currentName,
        };
      });

      // To retrieve components invocations throughout the file
      const compInvocationRe = new RegExp(
        /validate_component\((\w+), "(\w+)".+render.+result, (.+), .+, .+\n/,
        "g"
      );
      // INFO: one invocation match is like [
      //   'validate_component(CompName, "CompName").$$render($$result, { ...props }, {}, {\n', // the match
      //   'CompName',
      //   'CompName',
      //   '{ ...props }',
      //   index: 563,
      //   input: '...the content of the ssr component file',
      //   groups: undefined
      // ]
      // TODO: check how it works for slots. Is it implemented in another set of curlies?
      // TODO: does it work if we use named imports? Is it a practice in Svelte?
      const allComponentsInvocations = [
        ...CompStr.matchAll(compInvocationRe),
      ].map((invocation, i) => {
        console.log({ invocation });
        const currentName = invocation[1];
        // We can provide props to a component by using its name as a key in the page props
        // TODO: is it necessary? Aren't the props passed on page?
        // Probably not -> I expect we'll have the reference to a variable, not the actual 'static' data
        const currentRouteProps = routeProps && routeProps[currentName];
        let staticProps = {};
        try {
          staticProps = JSON5.parse(invocation[3]);
        } catch (error) {
          console.warn(
            `static props for ${currentName} in component ${srcPath} can not be parsed as JSON`
          );
        }
        const currentCompInfos = pageInfos.children[i];
        if (currentName !== (currentCompInfos && currentCompInfos.name)) {
          console.warn(
            `component names don't match: ${currentName}, ${
              currentCompInfos && currentCompInfos.name
            }`
          );
        }

        // match the invocation with its import statement infos
        const importInfos = componentsImported.filter(
          ({ name: importName }) => importName === currentName
        )[0];

        // console.log({ componentsImported });

        // Extend information we have on the child component invoked thanks to our componentsInfos JSON
        const extendedInfos =
          importInfos && componentsInfos[importInfos.srcPath];

        return {
          ...extendedInfos,
          ...importInfos,
          ...currentCompInfos,
          name: currentName,
          props: {
            ...staticProps,
            ...currentRouteProps,
          },
        };
      });

      const hydratableComponents = allComponentsInvocations.filter((inv) => {
        return inv.shouldBeHydrated;
      });

      if (hydratableComponents && hydratableComponents.length) {
        // INFO: The normal component mount is replaced by `mountReplace` here
        // to allow replacing the component instead of appending it to its parent
        // new ${r.name}({
        //   target: document.querySelector('#${r.name}'),
        //   hydrate: true,
        //   props: ${r.props && JSON.stringify(r.props)}
        //   anchor:	null	// A child of target to render the component immediately before
        //   intro:	false //	If true, will play transitions on initial render, rather than waiting for subsequent state changes
        // });
        let compImports = [];
        let compMounts = [];
        hydratableComponents.forEach((hc) => {
          console.info(`component ${hc.srcPath} will be hydrated`);
          if (compImports.indexOf(hc.importPath) < 0) {
            compImports.push(hc.importPath);
          }
          compMounts.push(
            `mountReplace(${
              hc.name
            },{target: document.querySelector('[data-hid="${
              hc.hid
            }"]'),props: ${hc.props && JSON.stringify(hc.props)}});`
          );
        });

        importScripts = `import mountReplace from '/mountReplace.js';${compImports.join(
          "\n"
        )}${compMounts.join("\n")}`;
      }
    }

    let outputHtml = htmlTemplate({
      head,
      css: css && css.code,
      html,
      importScripts,
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
  } catch {
    console.info("no /src/routes.js file defined for programmatic page");
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
