// import { promises as fs, existsSync } from "fs";
import * as path from "path";

// import * as glob from "glob";
// import JSON5 from "json5";

import slugify from "../utils/slugify";

const makePageDef = ({
  ssrDir,
  browserDir,
  srcPath,
  ssrPath: ssrP,
  name: passedName,
  path: p,
  routeProps,
  lang,
}) => {
  // srcPath is like /pages/tests OR /pages/tests/index WITHOUT extension
  let ssrPath = ssrP || path.join(ssrDir, "/_dist_/", srcPath);
  ssrPath = ssrPath.endsWith(".js") ? ssrPath : `${ssrPath}.js`;
  // browserPath is the path to the browser version of the js file
  const browserPath = ssrPath.replace(`${ssrDir}/`, `${browserDir}/`);
  // relativePath is the path to the js file when the site is hosted / the base directory is 'browserDir'
  const relativePath = browserPath.replace(`${browserDir}/`, "");

  const relPathSplit = relativePath.split("/");
  // name is the name of the js file or the parent dir if the js file is called 'index', hence the name of the html page
  const tempName =
    !passedName &&
    relPathSplit[relPathSplit.length - 1]
      .replace(/\..+$/, "")
      .replace(/.h$/, "");
  // if the file is at the root of the pagesDir (and only then), keep 'index' as name
  const name =
    passedName ||
    (tempName === "index" && relPathSplit.length > 3
      ? relPathSplit[relPathSplit.length - 2]
      : tempName
    ).toLowerCase();
  // relativeHtmlPath is the path to the html page (has to be placed at the root, out of the '_dist_/_pages/' directory)
  const relativeHtmlPath =
    p ||
    slugify(
      relativePath
        .replace(/^_dist_\/_pages/, "")
        .replace(/\..+$/, "")
        .replace(/.h$/, ""),
      { keepSlashes: true }
    );

  // all pages are 'index.html' inside the appropriate folder
  const relativeHtmlFilePath =
    tempName === "index"
      ? relativeHtmlPath
      : path.join(relativeHtmlPath, "index");
  // avoid double slashes in case path is '/' for example
  const browserHtmlFilePath = path.join(
    browserDir,
    `${relativeHtmlFilePath}.html`
  );

  const importPath = path.join(
    "/",
    relativePath.endsWith(".js") ? relativePath : `${relativePath}.js`
  );

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
  //   lang,
  //   props: {},
  // });

  return {
    srcPath,
    ssrPath,
    browserPath,
    relativePath,
    importPath,
    relativeHtmlPath,
    relativeHtmlFilePath,
    browserHtmlFilePath,
    name,
    lang,
    routeProps: { url: relativeHtmlPath, ...routeProps },
  };
};

export default makePageDef;
