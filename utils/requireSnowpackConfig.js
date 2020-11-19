const path = require("path");
const { existsSync } = require("fs");

const userSnowpackConfigLoc = path.join(process.cwd(), "snowpack.config.js");
const snowpackConfig = existsSync(userSnowpackConfigLoc)
  ? require(userSnowpackConfigLoc)
  : require("../snowpack.config.js");

module.exports = {
  ...snowpackConfig,
  buildOptions: {
    minify: false,
    ...snowpackConfig.buildOptions,
  },
  directories: {
    browser: "build",
    ssr: "build-temp",
    src: "src",
    pages: "_pages",
    htmlTemplate: "html.js",
    routes: "routes.js",
    ...snowpackConfig.directories,
  },
  sesamOptions: {
    ...snowpackConfig.sesamOptions,
  },
};
