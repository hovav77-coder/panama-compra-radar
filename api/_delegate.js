const appHandler = require("../server");

function delegateTo(pathname) {
  return (req, res) => {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    req.url = `${pathname}${query}`;
    return appHandler(req, res);
  };
}

module.exports = delegateTo;
