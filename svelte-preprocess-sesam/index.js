const fs = require("fs");
const path = require("path");
var crypto = require("crypto");

const userSnowpackConfigLoc = path.join(process.cwd(), "snowpack.config.js");
const userSnowpackConfig = fs.existsSync(userSnowpackConfigLoc)
  ? require(userSnowpackConfigLoc)
  : {};

const {
  browserConfig: { devOptions: { out: browserDir = "build" } = {} } = {},
  ssrConfig: { devOptions: { out: ssrDir = "build-temp" } = {} } = {},
} = userSnowpackConfig;
const pagesDir = "_pages";

const componentsInfosLoc = path.join(
  process.cwd(),
  ssrDir,
  "components-infos.json"
);

function generateChecksum(str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || "md5")
    .update(str, "utf8")
    .digest(encoding || "hex");
}

module.exports = {
  markup: ({ content, filename }) => {
    if (process.env.BUILD_STEP === "browser") return null;

    // determine component name from filename
    const compNameArr = filename
      .replace(/\.(?:svelte|md)$/, "")
      .replace(/\.h$/, "")
      .replace(/\/index$/, "")
      .split("/");
    let compName = compNameArr[compNameArr.length - 1];
    compName = compName === pagesDir ? "index" : compName;

    const childrenComponents = [];

    // check if the component should be hydrated
    // TODO: find a more robust way. For now, we simply look for `let` in the script

    // 1. isolate the script part
    const markupScript = content.match(/<script[\S\s]+<\/script>/);

    // 2. look for `let` not preceded by `export`: /(?<!export )(let)/
    const shouldBeHydrated =
      !!markupScript && markupScript[0].search(/(?<!export )(let)/) > -1;

    // 3. a parent component should inject an `hId` into every child component
    let newContent = content
      // we recognize components because they should start with an uppercase letter
      .replace(/<(?!(?:script|style|[a-z0-9]+)\b)\b\w+/g, (...match) => {
        // match[0] is like `<CompName`
        // match[0].substring(1) is the CompName
        const childCompName = match[0].substring(1);
        const hid = `${childCompName}-${match[1]}`;
        childrenComponents.push({ name: childCompName, hid });
        // match[1] is the position where the match was found
        return `${match[0]} hid="${hid}"`;
      });

    // 4. a child component will receive an `hId` prop that it should `export let`
    newContent = !shouldBeHydrated
      ? newContent
      : newContent
          .replace(/(<script.*>)/g, (...match) => {
            return `${match[0]}\nexport let hid;`;
          })
          // 5. if the current component should be hydrated, inject the hId in the top markup component
          .replace(/<(?!(?:script|style)\b)\b\w+/, (...match) => {
            return `${match[0]} data-hid={hid}`;
          });

    // Persist components infos in a JSON file in `build-temp/components-infos.json`
    const srcPath = filename
      .replace(`${process.cwd()}/src`, "")
      .replace(/.svelte$/, "")
      .replace(/.h$/, "");
    const componentsInfos = {
      filename,
      srcPath,
      name: compName,
      shouldBeHydrated,
      // isPage: null,
      // hash: hashFnv32a(content, true),
      checksum: generateChecksum(content),
      children: childrenComponents,
    };

    if (!fs.existsSync(componentsInfosLoc)) {
      fs.mkdirSync(path.dirname(componentsInfosLoc), {
        recursive: true,
      });
      fs.writeFileSync(componentsInfosLoc, "{}");
    }

    let fileComponentsInfo = fs.readFileSync(componentsInfosLoc, "utf-8");
    fileComponentsInfo = fileComponentsInfo && JSON.parse(fileComponentsInfo);

    fs.writeFileSync(
      componentsInfosLoc,
      JSON.stringify({
        ...fileComponentsInfo,
        [srcPath]: componentsInfos,
      })
    );

    return {
      code: newContent,
      // , map, dependencies
    };
  },
};
