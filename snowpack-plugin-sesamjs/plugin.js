// const { existsSync } = require("fs");

const svelte = require('svelte/compiler');
const svelteRollupPlugin = require('rollup-plugin-svelte');
const fs = require('fs');
const path = require('path');

const outputHtml = ({ componentPath = '/_dist_/_pages/index.js' }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="Web site created using create-snowpack-app"
    />
    <title>Snowpack App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="app"></div>
    <script type="module">
      import Comp from "${componentPath}";
      new Comp({
        target: document.querySelector('#app'),
        hydrate: true,
      });
    </script>
  </body>
</html>
`;

module.exports = function plugin(snowpackConfig, pluginOptions = {}) {
  // Support importing Svelte files when you install dependencies.
  snowpackConfig.installOptions.rollup.plugins.push(
    svelteRollupPlugin({ include: '**/node_modules/**' })
  );

  let svelteOptions;
  let preprocessOptions;
  const userSvelteConfigLoc = path.join(process.cwd(), 'svelte.config.js');
  if (fs.existsSync(userSvelteConfigLoc)) {
    const userSvelteConfig = require(userSvelteConfigLoc);
    const { preprocess, ..._svelteOptions } = userSvelteConfig;
    preprocessOptions = preprocess;
    svelteOptions = _svelteOptions;
  }
  // Generate svelte options from user provided config (if given)
  svelteOptions = {
    dev: process.env.NODE_ENV !== 'production',
    css: false,
    ...svelteOptions,
    ...pluginOptions,
  };

  return {
    // name: "@snowpack/plugin-svelte",
    name: 'sesm',
    resolve: {
      input: ['.svelte'],
      output: ['.js', '.css'],
    },
    knownEntrypoints: ['svelte/internal'],
    async load({ contents, filePath }) {
      // const fileContents = await fs.readFile(filePath, "utf-8");
      // let codeToCompile = fileContents;
      let codeToCompile = fs.readFileSync(filePath, 'utf-8');

      // PRE-PROCESS
      if (preprocessOptions) {
        codeToCompile = (
          await svelte.preprocess(codeToCompile, preprocessOptions, {
            filename: filePath,
          })
        ).code;
      }

      // COMPILE
      const { js, css, ast, warnings, vars, stats } = svelte.compile(
        codeToCompile,
        {
          ...svelteOptions,
          filename: filePath,
          outputFilename: filePath,
          cssOutputFilename: filePath,
        }
      );

      if (warnings && warnings.length) {
        warnings.forEach((w) => {
          console.warn(w);
        });
      }

      // TODO: try and evaluate if hydration is needed
      if (process.env.BUILD_STEP === 'browser' && ast.instance) {
        const { content } = ast.instance;
        const bodyDeclarations = content.body.map((d) => {
          const { type, kind, expression = {} } = d;
          const expressionName = expression.name;
          console.log({ type, kind, expressionName });
          return { type, kind, expressionName };
        });
        // console.log({ filePath, content: JSON.stringify(content) });
      }

      // if (process.env.BUILD_STEP === 'browser') console.log({ js });

      const { sourceMaps } = snowpackConfig.buildOptions;
      const output = {
        '.js': {
          code: js.code,
          map: sourceMaps ? js.map : undefined,
        },
      };
      if (!svelteOptions.css && css && css.code) {
        output['.css'] = {
          code: css.code,
          map: sourceMaps ? css.map : undefined,
        };
      }

      // CREATE HTML FILE FOR PAGE
      // we generate an empty html file for each page so that we can serve the right .js from the right page
      // TODO: someday, somehow, we might be able to simply use the output return from this function to
      //       create our html file in another location -> closer to the root dir than /dist/_pages/
      if (process.env.BUILD_STEP === 'watch' && /_pages/.test(filePath)) {
        // console.log({ snowpackConfig });
        // filePath is like '/home/username/my_projects/project-name/src/_pages/index.svelte'
        const browserHtmlFilePath = filePath
          .replace('src/_pages', 'build')
          .replace(/.svelte$/, '.html');
        const componentPath = filePath
          .replace(/^.+\/src\/_pages\//, '/_dist_/_pages/')
          .replace(/.svelte$/, '.js');

        // await fs.mkdir(path.dirname(browserHtmlFilePath), {
        // await fs.writeFile(browserHtmlFilePath, outputHtml({ componentPath }));
        fs.mkdirSync(path.dirname(browserHtmlFilePath), {
          recursive: true,
        });
        fs.writeFileSync(browserHtmlFilePath, outputHtml({ componentPath }));
      }
      // console.log({ contents, filePath });

      return output;
    },
  };
};
