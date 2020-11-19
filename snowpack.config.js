const configKey = process.env.BUILD_STEP;

const sesamOptions = { defaultLang: "en" };
const directories = {
  watch: "build",
  browser: "build",
  ssr: "build-temp",
  pages: "_pages", // automatic pages are placed inside `src/_pages`
  htmlTemplate: "html.js", // the html template to mount components on is at `src/html.js`
};

const sesamPluginOptions = {
  browser: {},
  ssr: {
    generate: "ssr",
    css: true,
  },
};

// see https://www.snowpack.dev/#all-config-options
module.exports = {
  plugins: [["sesamjs/snowpack-plugin-sesam", sesamPluginOptions[configKey]]],
  // scripts: {
  //   "mount:public": "mount public --to /",
  //   [`mount:${configKey}`]: "mount src --to /_dist_",
  // },
  mount: {
    public: "/",
    src: "/_dist_",
  },
  devOptions: { bundle: false, open: "none", out: directories[configKey] },
  buildOptions: {
    clean: true,
    minify: false,
  },
  directories, // used by sesam to retrieve the right folder paths
  sesamOptions, // used by sesam
};
