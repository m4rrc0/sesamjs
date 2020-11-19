const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const svelte = require("svelte/compiler");

const {
  directories: {
    browser: browserDir,
    ssr: ssrDir,
    pages: pagesDir,
    htmlTemplate: htmlTemplateFile,
  },
  sesamOptions: { defaultLang },
} = require("../utils/requireSnowpackConfig.js");

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

// Parse AST to
// 1. list all components
// 1. associate a checksum (for later incremental builds)
// 1. determine if each component has to be hydrated
// 1. list children components and associate their position in the content (just used as unique id in the parent)
// 1. if a component has to be hydrated, find each time it is instanciated and associate a `data-hid` attribute
// + save data close to the parent (page), so that we easily know what js we need to import for that page

// Things that make a component hydratable
// - let variable declared
// - Element - attribute - type: "EventHandler"
module.exports = {
  markup: ({ content, filename }) => {
    if (process.env.BUILD_STEP === "browser") return null;

    const componentDirAbsolute = filename.substring(
      0,
      filename.lastIndexOf("/")
    );

    // determine component name from filename
    const compNameArr = filename
      .replace(/\.(?:svelte|md)$/, "")
      .replace(/\.h$/, "")
      .replace(/\/index$/, "")
      .split("/");
    let compName = compNameArr[compNameArr.length - 1];
    compName = compName === pagesDir ? "index" : compName;

    // Persist components infos in a JSON file in `build-temp/components-infos.json`
    const srcPath = filename.replace(`${process.cwd()}/src`, "").split(".")[0];

    const currentComponentInfos = {
      filename,
      srcPath,
      name: compName,
      checksum: generateChecksum(content),
      shouldBeHydrated: false,
      children: [],
    };

    let ast;

    try {
      ast = svelte.parse(content);
    } catch (e) {
      console.error(e, "Error parsing component content");
    }

    // console.log({
    //   // content, filename,
    //   ast,
    // });

    svelte.walk(ast, {
      // leave: (node, parent, prop, index) => {
      //   if (!node.type) {
      //     // if we populate imports in the equivalent if statement in the `enter` API
      //     console.log("leave", {
      //       // html: node.html,
      //       compName,
      //       srcPath,
      //       compChildrenimports: currentComponentInfos.children,
      //     });
      //   }
      // },
      enter: (node, parent, prop, index) => {
        // if (!["Element", "Fragment", "InlineComponent"].includes(node.type)) {
        //   return;
        //   this.skip(); // so that the nodes are not even called on leave method
        // }

        // console.log({ parent, prop, index });
        /////////////////
        // TODO: we should ba able to specify manually which components need hydration
        // for example, when importing components from packages, we won't get a signal that the child need to be hydrated
        // Ex: Router -> set a prop on the element invocation directly? Then I should detect invocations instea of imports
        // NOTE: we can use the `leave` API if, for example, something depends on the children...?

        if (node.type === "InlineComponent") {
          const hidAttr =
            node.attributes &&
            node.attributes.filter((attr) => attr.name === "data-hid")[0];

          if (!hidAttr) return;

          const invocationName = node.name;
          const startPos = node.start;
          const hidValue =
            hidAttr.value && hidAttr.value[0] && hidAttr.value[0].data;

          console.log({
            invocationName,
            startPos,
            hidAttr,
            hidValue,
          });
        }
        if (!node.type) {
          // console.log("enter", {
          //   // html: node.html,
          //   compName,
          //   srcPath,
          //   compChildrenimports: currentComponentInfos.children,
          //   // type: node.html.type,
          //   directChildrenInvocations:
          //     node.html.children &&
          //     node.html.children.filter(({ type: cType, data: cData }) => {
          //       const isEmpty = /^(\n)+$/.test(cData) && cType === "Text";
          //       const isComment = cType === "Comment";
          //       return !isEmpty && !isComment;
          //     }),
          // });
          /////////////////
          // TODO: find components invocations
        }

        if (!node.type) {
          // console.log(node.html);
          /////////////////
          // TODO: can I do something here to remember the wrapper tag of this component
          // then, if the current comp shouldBeHydrated, I can add the prop...?
        }
        if (node.type === "VariableDeclaration" && node.kind === "let") {
          currentComponentInfos.shouldBeHydrated = true;
        }
        if (node.type === "ImportDeclaration") {
          // how the imports are named. Can be multiple named imports for 1 import statement
          const specifiers = node.specifiers.map(({ local }) => local.name);
          // sourcePath can be a relative path or the name of the package
          // (or an absolute path from project directory or using an alias)
          const sourcePath = node.source.value;
          const isRelative = sourcePath.startsWith(".");
          const isAbsolute = sourcePath.startsWith("/");
          const isPackage = !isRelative && !isAbsolute;
          const absolutePath = isPackage
            ? path.join(process.cwd(), "node_modules", sourcePath)
            : path.join(
                isRelative ? componentDirAbsolute : process.cwd(),
                sourcePath
              );
          // should be like /_pages/index-copy
          // here, can also be like /node_modules/svelte
          const childSrcPath = absolutePath
            .replace(process.cwd(), "")
            .replace(/^\/src/, "")
            .split(".")[0];

          if (!isPackage) {
            //////////////////////
            // TODO: children needs to contain package components as well
            // how to filter out functions?
            // instead of doing all this work with imports, I should do it with invocations
            // it is probably complementary
            currentComponentInfos.children = [
              ...currentComponentInfos.children,
              ...specifiers.map((n) => ({
                name: n,
                srcPath: childSrcPath,
                hid: `${n}-${node.start}`,
              })),
            ];
          }
        }
        // if (node.type === "Program") {

        // }
        // if (!["Element", "Fragment", "InlineComponent"].includes(node.type)) {
        //   return;
        // }

        // if (options.optimizeAll && node.name === "img") {
        //   imageNodes.push(node);
        //   return;
        // }

        // if (node.name !== options.tagName) return;
        // imageNodes.push(node);
      },
    });

    // const testContent =
    //   typeof content === "string" &&
    //   content.replaceAll(
    //     /<([\w-])+((?!>)[\s\S])+data-hid="([\w-_])+"/g,
    //     (...match) => {
    //       console.log({ match });
    //       return `<span data-hid="Router-hid" /><Router`;
    //     }
    //   );
    const testMatch = typeof content === "string" && [
      ...content.matchAll(/<([\w-]+)((?!>|<)[\s\S])+data-hid="([\w-_]*)"/g),
    ];

    let testContent = content;
    testMatch.forEach((match) => {
      const dataHid = `${compName}-${match[1]}-${match.index}`;
      const appendedSpan = match[0]
        .replace(match[1], "span")
        .replace(/data-hid=".*"/, `data-hid="${dataHid}" /><${match[1]}`);

      testContent = testContent.replace(match[0], appendedSpan);
    });

    if (testMatch.length) {
      console.log({ testMatch, testContent });
    }

    let childrenComponents = [];
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
        [srcPath]: currentComponentInfos,
      })
    );

    return {
      code: newContent,
      // , map, dependencies
    };
  },
};
