import fs from 'fs-extra';
import path from 'path';
import minimist from 'minimist';
import Q from 'q';
import _ from 'underscore';
import ig from 'imagemagick';
import xml2js from 'xml2js';

import { getSettings, ANDROID_REVERSE_DENSITY_MAP, PLATFORMS } from './settings';

const argv = minimist(process.argv.slice(2));

const settings = getSettings(argv);

export const collectPlatformsFromConfig = function (configFile) {
  const deferred = Q.defer();
  const parser = new xml2js.Parser();
  fs.readFile(configFile, (err, data) => {
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
            height: splash.$.height,
          };
          const density = splash.$.density;
          const density_info = ANDROID_REVERSE_DENSITY_MAP[density];
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
export const getPlatforms = function (args) {
  const projectName = args[0];
  const configPlatforms = args[1];
  const deferred = Q.defer();
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
      isAdded: fs.existsSync('platforms/ios'),
      splashPath: `platforms/ios/${projectName}${xcodeFolder}`,
      splash: PLATFORMS.ios,
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
      isAdded: fs.existsSync('platforms/android'),
      splashPath: 'platforms/android/res/',
      splash: PLATFORMS.android,
    };
    if (settings.UPDATE_CONFIG_RESOURCES) {
      platform.splashPath = '';
      platform.splash = configPlatforms.android;
    }
    platforms.push(platform);
  }
  platforms.push({
    name: 'windows',
    isAdded: fs.existsSync('platforms/windows'),
    splashPath: 'platforms/windows/images/',
    splash: [
      // Landscape
      { name: 'SplashScreen.scale-100.png', width: 620, height: 300 },
      { name: 'SplashScreen.scale-125.png', width: 775, height: 375 },
      { name: 'SplashScreen.scale-150.png', width: 930, height: 450 },
      { name: 'SplashScreen.scale-200.png', width: 1240, height: 600 },
      { name: 'SplashScreen.scale-400.png', width: 2480, height: 1200 },
      // Portrait
      { name: 'SplashScreenPhone.scale-240.png', width: 1152, height: 1920 },
      { name: 'SplashScreenPhone.scale-140.png', width: 672, height: 1120 },
      { name: 'SplashScreenPhone.scale-100.png', width: 480, height: 800 },
    ],
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
  console.log(`  ${str}`);
};
display.error = function (str) {
  str = '✗  '.red + str;
  console.log(`  ${str}`);
};
display.header = function (str) {
  console.log('');
  console.log(` ${str.cyan.underline}`);
  console.log('');
};

/**
 * read the config file and get the project name
 *
 * @return {Promise} resolves to a string - the project's name
 */
const getProjectName = function () {
  const deferred = Q.defer();
  const parser = new xml2js.Parser();
  fs.readFile(settings.CONFIG_FILE, (err, data) => {
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
  const deferred = Q.defer();
  let srcPath = settings.SPLASH_FILE;
  const platformPath = srcPath.replace(/\.png$/, `-${platform.name}.png`);
  if (fs.existsSync(platformPath)) {
    srcPath = platformPath;
  }
  let dstPath = platform.splashPath + splash.name;

  const has9Patch = (platform.name == 'android' && dstPath.match(/\.9\.png$/));
  dstPath = dstPath.replace(/\.9\.png$/, '.png');

  const dst = path.dirname(dstPath);
  if (!fs.existsSync(dst)) {
    fs.mkdirsSync(dst);
  }
  ig.identify(srcPath, (err, srcInfo) => {
    if (err) {
      deferred.reject(err);
    }
    ig.crop({
      srcPath,
      dstPath,
      quality: 1,
      format: 'png',
      width: splash.width,
      height: splash.height,
    }, (err, stdout, stderr) => {
      if (err) {
        deferred.reject(err);
      } else {
        if (platform.name == 'android' && (has9Patch || settings.PATCH_9)) {
          // TODO from source size
          const new_size = Math.max.apply(null, [splash.width, splash.height]);
          const ratio = splash.width / splash.height;

          const base_border = ((srcInfo.height * 0.25) * new_size) /
            srcInfo.height;

          let y_border = ((srcInfo.height * settings.PATCH_9_HEIGHT) *
            new_size) / srcInfo.height;
          let x_border = ((srcInfo.width * settings.PATCH_9_WIDTH) * new_size) /
            srcInfo.width;

          if (ratio < 1) {
            x_border = (base_border - y_border) * ratio;
          } else {
            y_border = (base_border - x_border) * ratio;
          }

          y_border = Math.round(y_border);
          x_border = Math.round(x_border);

          const convert_args = [
            '-background',
            'white',
            '-bordercolor',
            'white',
            dstPath,
            '-border', '1',
            '-fill', 'black',
            '-draw', `line 1,0 ${x_border},0`,
            '-draw', `line ${splash.width - x_border},0 ${splash.width},0`,

            '-draw', `${'line 0,1 ' + ' 0,'}${y_border}`,
            '-draw', `line 0,${splash.height - y_border} 0,${splash.height}`,
            dstPath.replace(/\.png$/, '.9.png'),
          ];
          ig.convert(convert_args);
        }
        deferred.resolve();
        display.success(`${splash.name} created`);
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
  const deferred = Q.defer();
  display.header(`Generating splash screen for ${platform.name}`);
  const all = [];
  const splashes = platform.splash;
  splashes.forEach((splash) => {
    all.push(generateSplash(platform, splash));
  });
  Q.all(all).then(() => {
    deferred.resolve();
  }).catch((err) => {
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
  const deferred = Q.defer();
  let sequence = Q();
  const all = [];
  _(platforms).where({ isAdded: true }).forEach((platform) => {
    sequence = sequence.then(() => generateSplashForPlatform(platform));
    all.push(sequence);
  });
  Q.all(all).then(() => {
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
  const deferred = Q.defer();
  getPlatforms().then((platforms) => {
    const activePlatforms = _(platforms).where({ isAdded: true });
    if (activePlatforms.length > 0) {
      display.success(
        `platforms found: ${_(activePlatforms).pluck('name').join(', ')}`);
      deferred.resolve();
    } else {
      display.error(
        'No cordova platforms found. ' +
        'Make sure you are in the root folder of your Cordova project ' +
        'and add platforms with \'cordova platform add\'',
      );
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
  const deferred = Q.defer();
  fs.exists(settings.SPLASH_FILE, (exists) => {
    if (exists) {
      display.success(`${settings.SPLASH_FILE} exists`);
      deferred.resolve();
    } else {
      display.error(`${settings.SPLASH_FILE} does not exist`);
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
  const deferred = Q.defer();
  fs.exists(settings.CONFIG_FILE, (exists) => {
    if (exists) {
      display.success(`${settings.CONFIG_FILE} exists`);
      deferred.resolve();
    } else {
      display.error(`cordova's ${settings.CONFIG_FILE} does not exist`);
      deferred.reject();
    }
  });
  return deferred.promise;
};

export function main() {
  display.header('Checking Project & Splash');
  // atLeastOnePlatformFound()
  validSplashExists()
    .then(configFileExists)
    .then(() => Q.all(
      [getProjectName(), collectPlatformsFromConfig(settings.CONFIG_FILE)]))
    .then(getPlatforms)
    .then(generateSplashes)
    .catch((err) => {
      if (err) {
        console.log(err);
      }
    })
    .then(() => {
      console.log('');
    });
}

