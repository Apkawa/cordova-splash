'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPlatforms = exports.collectPlatformsFromConfig = undefined;
exports.main = main;

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _imagemagick = require('imagemagick');

var _imagemagick2 = _interopRequireDefault(_imagemagick);

var _xml2js = require('xml2js');

var _xml2js2 = _interopRequireDefault(_xml2js);

var _settings = require('./settings');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const argv = (0, _minimist2.default)(process.argv.slice(2));

const settings = (0, _settings.getSettings)(argv);

const collectPlatformsFromConfig = exports.collectPlatformsFromConfig = function (configFile) {
  const deferred = _q2.default.defer();
  const parser = new _xml2js2.default.Parser();
  _fsExtra2.default.readFile(configFile, (err, data) => {
    if (err) {
      deferred.reject(err);
    }
    parser.parseString(data, (err, result) => {
      if (err) {
        deferred.reject(err);
      }
      const platforms = {};
      for (let i = 0; i < result.widget.platform.length; i++) {
        const platform = result.widget.platform[i];
        const platform_name = platform.$.name;
        const splash_list = [];

        for (let s = 0; s < platform.splash.length; s++) {
          const splash = platform.splash[s];
          const opts = {
            name: splash.$.src,
            width: splash.$.width,
            height: splash.$.height
          };
          const density = splash.$.density;
          const density_info = _settings.ANDROID_REVERSE_DENSITY_MAP[density];
          if (density_info) {
            opts.width = density_info.width;
            opts.height = density_info.height;
          }
          splash_list.push(opts);
        }
        platforms[platform_name] = splash_list;
      }
      deferred.resolve(platforms);
    });
  });
  return deferred.promise;
};

/**
 * Check which platforms are added to the project and return their splash screen names and sizes
 *
 * @param  {String} projectName
 * @param {object} configPlatforms
 * @return {Promise} resolves with an array of platforms
 */
const getPlatforms = exports.getPlatforms = function (args) {
  const projectName = args[0];
  const configPlatforms = args[1];
  const deferred = _q2.default.defer();
  const platforms = [];
  let xcodeFolder = '/Images.xcassets/LaunchImage.launchimage/';

  if (settings.OLD_XCODE_PATH) {
    xcodeFolder = '/Resources/splash/';
  }
  let platform;
  // TODO collect path from config.xml
  if (settings.ALL_PLATFORMS || settings.IOS) {
    platform = {
      name: 'ios',
      // TODO: use async fs.exists
      isAdded: _fsExtra2.default.existsSync('platforms/ios'),
      splashPath: `platforms/ios/${ projectName }${ xcodeFolder }`,
      splash: _settings.PLATFORMS.ios
    };
    if (settings.UPDATE_CONFIG_RESOURCES) {
      platform.splashPath = '';
      platform.splash = configPlatforms.ios;
    }
    platforms.push(platform);
  }
  if (settings.ALL_PLATFORMS || settings.ANDROID) {
    platform = {
      name: 'android',
      isAdded: _fsExtra2.default.existsSync('platforms/android'),
      splashPath: 'platforms/android/res/',
      splash: _settings.PLATFORMS.android
    };
    if (settings.UPDATE_CONFIG_RESOURCES) {
      platform.splashPath = '';
      platform.splash = configPlatforms.android;
    }
    platforms.push(platform);
  }
  platforms.push({
    name: 'windows',
    isAdded: _fsExtra2.default.existsSync('platforms/windows'),
    splashPath: 'platforms/windows/images/',
    splash: [
    // Landscape
    { name: 'SplashScreen.scale-100.png', width: 620, height: 300 }, { name: 'SplashScreen.scale-125.png', width: 775, height: 375 }, { name: 'SplashScreen.scale-150.png', width: 930, height: 450 }, { name: 'SplashScreen.scale-200.png', width: 1240, height: 600 }, { name: 'SplashScreen.scale-400.png', width: 2480, height: 1200 },
    // Portrait
    { name: 'SplashScreenPhone.scale-240.png', width: 1152, height: 1920 }, { name: 'SplashScreenPhone.scale-140.png', width: 672, height: 1120 }, { name: 'SplashScreenPhone.scale-100.png', width: 480, height: 800 }]
  });
  deferred.resolve(platforms);
  return deferred.promise;
};

/**
 * @var {Object} console utils
 */
const display = {};
display.success = function (str) {
  str = '✓  '.green + str;
  console.log(`  ${ str }`);
};
display.error = function (str) {
  str = '✗  '.red + str;
  console.log(`  ${ str }`);
};
display.header = function (str) {
  console.log('');
  console.log(` ${ str.cyan.underline }`);
  console.log('');
};

/**
 * read the config file and get the project name
 *
 * @return {Promise} resolves to a string - the project's name
 */
const getProjectName = function () {
  const deferred = _q2.default.defer();
  const parser = new _xml2js2.default.Parser();
  _fsExtra2.default.readFile(settings.CONFIG_FILE, (err, data) => {
    if (err) {
      deferred.reject(err);
    }
    parser.parseString(data, (err, result) => {
      if (err) {
        deferred.reject(err);
      }
      const projectName = result.widget.name[0];
      deferred.resolve(projectName);
    });
  });
  return deferred.promise;
};

/**
 * Crops and creates a new splash in the platform's folder.
 *
 * @param  {Object} platform
 * @param  {Object} splash
 * @return {Promise}
 */
const generateSplash = function (platform, splash) {
  const deferred = _q2.default.defer();
  let srcPath = settings.SPLASH_FILE;
  const platformPath = srcPath.replace(/\.png$/, `-${ platform.name }.png`);
  if (_fsExtra2.default.existsSync(platformPath)) {
    srcPath = platformPath;
  }
  let dstPath = platform.splashPath + splash.name;

  const has9Patch = platform.name == 'android' && dstPath.match(/\.9\.png$/);
  dstPath = dstPath.replace(/\.9\.png$/, '.png');

  const dst = _path2.default.dirname(dstPath);
  if (!_fsExtra2.default.existsSync(dst)) {
    _fsExtra2.default.mkdirsSync(dst);
  }
  _imagemagick2.default.identify(srcPath, (err, srcInfo) => {
    if (err) {
      deferred.reject(err);
    }
    _imagemagick2.default.crop({
      srcPath,
      dstPath,
      quality: 1,
      format: 'png',
      width: splash.width,
      height: splash.height
    }, (err, stdout, stderr) => {
      if (err) {
        deferred.reject(err);
      } else {
        if (platform.name == 'android' && (has9Patch || settings.PATCH_9)) {
          // TODO from source size
          const new_size = Math.max.apply(null, [splash.width, splash.height]);
          const ratio = splash.width / splash.height;

          const base_border = srcInfo.height * 0.25 * new_size / srcInfo.height;

          let y_border = srcInfo.height * settings.PATCH_9_HEIGHT * new_size / srcInfo.height;
          let x_border = srcInfo.width * settings.PATCH_9_WIDTH * new_size / srcInfo.width;

          if (ratio < 1) {
            x_border = (base_border - y_border) * ratio;
          } else {
            y_border = (base_border - x_border) * ratio;
          }

          y_border = Math.round(y_border);
          x_border = Math.round(x_border);

          const convert_args = ['-background', 'white', '-bordercolor', 'white', dstPath, '-border', '1', '-fill', 'black', '-draw', `line 1,0 ${ x_border },0`, '-draw', `line ${ splash.width - x_border },0 ${ splash.width },0`, '-draw', `${ 'line 0,1 ' + ' 0,' }${ y_border }`, '-draw', `line 0,${ splash.height - y_border } 0,${ splash.height }`, dstPath.replace(/\.png$/, '.9.png')];
          _imagemagick2.default.convert(convert_args);
        }
        deferred.resolve();
        display.success(`${ splash.name } created`);
      }
    });
  });
  return deferred.promise;
};

/**
 * Generates splash based on the platform object
 *
 * @param  {Object} platform
 * @return {Promise}
 */
const generateSplashForPlatform = function (platform) {
  const deferred = _q2.default.defer();
  display.header(`Generating splash screen for ${ platform.name }`);
  const all = [];
  const splashes = platform.splash;
  splashes.forEach(splash => {
    all.push(generateSplash(platform, splash));
  });
  _q2.default.all(all).then(() => {
    deferred.resolve();
  }).catch(err => {
    console.log(err);
  });
  return deferred.promise;
};

/**
 * Goes over all the platforms and triggers splash screen generation
 *
 * @param  {Array} platforms
 * @return {Promise}
 */
const generateSplashes = function (platforms) {
  const deferred = _q2.default.defer();
  let sequence = (0, _q2.default)();
  const all = [];
  (0, _underscore2.default)(platforms).where({ isAdded: true }).forEach(platform => {
    sequence = sequence.then(() => generateSplashForPlatform(platform));
    all.push(sequence);
  });
  _q2.default.all(all).then(() => {
    deferred.resolve();
  });
  return deferred.promise;
};

/**
 * Checks if at least one platform was added to the project
 *
 * @return {Promise} resolves if at least one platform was found, rejects otherwise
 */
const atLeastOnePlatformFound = function () {
  const deferred = _q2.default.defer();
  getPlatforms().then(platforms => {
    const activePlatforms = (0, _underscore2.default)(platforms).where({ isAdded: true });
    if (activePlatforms.length > 0) {
      display.success(`platforms found: ${ (0, _underscore2.default)(activePlatforms).pluck('name').join(', ') }`);
      deferred.resolve();
    } else {
      display.error('No cordova platforms found. ' + 'Make sure you are in the root folder of your Cordova project ' + 'and add platforms with \'cordova platform add\'');
      deferred.reject();
    }
  });
  return deferred.promise;
};

/**
 * Checks if a valid splash file exists
 *
 * @return {Promise} resolves if exists, rejects otherwise
 */
const validSplashExists = function () {
  const deferred = _q2.default.defer();
  _fsExtra2.default.exists(settings.SPLASH_FILE, exists => {
    if (exists) {
      display.success(`${ settings.SPLASH_FILE } exists`);
      deferred.resolve();
    } else {
      display.error(`${ settings.SPLASH_FILE } does not exist`);
      deferred.reject();
    }
  });
  return deferred.promise;
};

/**
 * Checks if a config.xml file exists
 *
 * @return {Promise} resolves if exists, rejects otherwise
 */
const configFileExists = function () {
  const deferred = _q2.default.defer();
  _fsExtra2.default.exists(settings.CONFIG_FILE, exists => {
    if (exists) {
      display.success(`${ settings.CONFIG_FILE } exists`);
      deferred.resolve();
    } else {
      display.error(`cordova's ${ settings.CONFIG_FILE } does not exist`);
      deferred.reject();
    }
  });
  return deferred.promise;
};

function main() {
  display.header('Checking Project & Splash');
  // atLeastOnePlatformFound()
  validSplashExists().then(configFileExists).then(() => _q2.default.all([getProjectName(), collectPlatformsFromConfig(settings.CONFIG_FILE)])).then(getPlatforms).then(generateSplashes).catch(err => {
    if (err) {
      console.log(err);
    }
  }).then(() => {
    console.log('');
  });
}