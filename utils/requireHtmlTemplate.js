const path = require("path");
const { existsSync } = require("fs");

const {
  directories: { htmlTemplate: htmlTemplateFile },
} = require("./requireSnowpackConfig.js");

const userhtmlTemplateLoc = path.join(process.cwd(), "src", htmlTemplateFile);
const htmlTemplate = existsSync(userhtmlTemplateLoc)
  ? require(userhtmlTemplateLoc)
  : require("./html");

module.exports = htmlTemplate;
