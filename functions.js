let path = require("path");
module.exports = {
  divisions: function() {
    let regions = require(path.join(__dirname, './json/regions.json')).regions,
        regionKeys = Object.keys(regions),
        clusters = {},
        divisions = [];

    for (let i in regionKeys) {
      if (regionKeys[i] === 'unspecified') continue;
      let r = regions[regionKeys[i]];
      clusters[r.division] = [];
    }

    divisions = Object.keys(clusters);

    for (let i in regionKeys) {
      if (regionKeys[i] === 'unspecified') continue;
      let r = regions[regionKeys[i]];
      for (let i in divisions) {
        if (divisions[i] === r.division) {
          for (let i in r.clusters) {
            clusters[r.division].push(Number(r.clusters[i]));
          }
        }
      }
    }
    return clusters;
  }
};
