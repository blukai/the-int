module.exports = {
    "extends": "google",
    "rules": {
        "one-var": ["error", "always"],
        indent: [2, 2, {"SwitchCase": 1, "VariableDeclarator": 2}],
        camelcase: ["error", {properties: "never"}]
    }
};

// npm i -g eslint eslint-config-google