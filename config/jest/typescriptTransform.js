'use strict';

const babelJest = require('babel-jest');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const paths = require('../paths');
const THIS_FILE = fs.readFileSync(__filename);

let babel;
let tsc;
let projectConfig = {};

function transformSupportsFile(filename) {
  return (filename.endsWith('.ts') || filename.endsWith('.tsx'));
}

if (fs.existsSync(paths.appTsconfig)) {
  projectConfig = require(paths.appTsconfig);
}

module.exports = {
  process(src, filename, config, transformOptions = {instrument: false}) {
    if (!transformSupportsFile(filename)) {
      return src;
    }

    if (!tsc) {
      tsc = require('typescript');
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

    if (transformOptions.instrument) {
      delete theseOptions.outDir;
      delete theseOptions.sourceMap;

      theseOptions.inlineSourceMap = true;
      theseOptions.inlineSources = true;
    }

    const result = tsc.transpileModule(src, theseOptions, filename, []);
    const jsFile = filename.replace(/\.(ts|tsx)$/, '.js');

    const babelTransformOptions = Object.assign({}, transformOptions);
    babelTransformOptions.instrument = false;

    const outputText = babel.process(result.outputText, jsFile, config, babelTransformOptions);
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
  getCacheKey(fileData, filename, configString, options = { instrument: false }) {
    return crypto.createHash('md5')
      .update(THIS_FILE)
      .update('\0', 'utf8')
      .update(fileData)
      .update('\0', 'utf8')
      .update(filename)
      .update('\0', 'utf8')
      .update(configString)
      .update('\0', 'utf8')
      .update(JSON.stringify(projectConfig), 'utf8')
      .update('\0', 'utf8')
      .update(options.instrument ? 'instrument' : '')
      .digest('hex');
  }
};
