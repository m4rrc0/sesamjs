const util = require("util");
const execSync = require("child_process").execSync;
const exec = util.promisify(require("child_process").exec);

async function build() {
  try {
    // const { stdout, stderr } = await exec("snowpack build");
    // console.log("stdout:", stdout);
    // console.log("stderr:", stderr);
    console.log(`${execSync("snowpack build")}`);
  } catch (err) {
    console.error(err);
  }
}

export function cli(args) {
  // args are like
  //   [
  //     "/usr/bin/node",
  //     "/home/marcoet/code/tests/sesm-demo/node_modules/.bin/sesam",
  //     "test",
  //   ]
  //   let options = parseArgumentsIntoOptions(args);
  console.log(args);

  if (args[2] === "build") {
    build();
  }
}

const tocopy = {
  start: "snowpack dev",
  dev: "snowpack dev",
  "build-watch": "BUILD_STEP=watch snowpack build",
  "build-ssr": "BUILD_STEP=ssr snowpack build",
  "build-browser": "BUILD_STEP=browser snowpack build",
  "build-html": "BUILD_STEP=ssr node libs/build-html-files/index.js",
  "build-htmll": "BUILD_STEP=ssr sesamjs.buildHtml",
  build: "npm run build-ssr && npm run build-browser && npm run build-html",
  servee: "node libs/serve/index.js",
  serve: "es-dev-server --root-dir build --port 8081 --watch --open",
  "build-serve": "npm run build-watch && npm run serve",
  watchh: "nodemon -e js,svelte --watch src --exec 'npm run build-watch'",
  watch: "BUILD_STEP=watch snowpack build --watch",
  test: "jest",
  sesam: "sesam test",
};
