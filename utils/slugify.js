function slugify(strRaw, options = {}) {
  const { separator = "-", keepSlashes = false } = options;
  let str = strRaw;
  str = str.trim();
  str = str.toLowerCase();

  // remove accents, swap ñ for n, etc
  const from = keepSlashes
    ? "åàáãäâèéëêìíïîòóöôùúüûñç·_,:;"
    : "åàáãäâèéëêìíïîòóöôùúüûñç·/_,:;";
  const to = keepSlashes
    ? "aaaaaaeeeeiiiioooouuuunc-----"
    : "aaaaaaeeeeiiiioooouuuunc------";

  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), "g"), to.charAt(i));
  }

  str = str
    .replace(/[^a-z0-9 -/]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-") // collapse dashes
    .replace(/^-+/, "") // trim - from start of text
    .replace(/-+$/, "") // trim - from end of text
    .replace(/-/g, separator);

  return str;
}

module.exports = slugify;
