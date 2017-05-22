'use strict';

const fs = require('fs-extra');
const path = require('path');
const babelJest = require('babel-jest');
const paths = require('../paths');

let babel;
let tsc;
let projectConfig = {};

function transformSupportsFile(filename) {
  return (filename.endsWith('.ts') || filename.endsWith('.tsx'));
}

module.exports = {
  process(src, filename, config, transformOptions = {}) {
    if (!transformSupportsFile(filename)) {
      return src;
    }

    if (!tsc) {
      tsc = require('typescript');
      if (fs.existsSync(paths.appTsconfig)) {
          projectConfig = require(paths.appTsconfig);
      }
    }

    if (!babel) {
      babel = babelJest.createTransformer({
        presets: [
          require.resolve('babel-preset-react-app'),
        ],
        babelrc: false,
      });
    }

    const theseOptions = Object.assign({
      module: tsc.ModuleKind.ES2015,
      jsx: tsc.JsxEmit.React,
    }, projectConfig.compilerOptions);

    const result = tsc.transpileModule(src, theseOptions, filename, []);
    const jsFile = filename.replace(/\.(ts|tsx)$/, '.js');
    const outputText = babel.process(result.outputText, jsFile, config, transformOptions);
    const start = outputText.length > 12 ? outputText.substr(1, 10) : '';

    const root = require('pkg-dir').sync();
    filename = filename.startsWith(root) ? filename.substr(root.length) : filename;

    //store transpiled code contains source map into cache, except test cases
    if (!config.testRegex || !filename.match(config.testRegex)) {
      fs.outputFileSync(path.join(config.cacheDirectory, '/typescript-jest/', new Buffer(filename).toString('base64')), outputText);
    }

    const modified = start === 'use strict'
      ? `"use strict";require("ts-jest").install();${outputText}`
      : `require('ts-jest').install();${outputText}`;

    return modified;
  },
};
