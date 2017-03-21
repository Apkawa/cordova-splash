'use strict';
var fs = require('fs-extra');
var path = require('path');
var xml2js = require('xml2js');
var ig = require('imagemagick');
var colors = require('colors');
var _ = require('underscore');
var Q = require('q');
var argv = require('minimist')(process.argv.slice(2));

var fromPairs = require('lodash.frompairs');

/**
 * @var {Object} settings - names of the config file and of the splash image
 */
var settings = {};
settings.CONFIG_FILE = argv.config || 'config.xml';
settings.SPLASH_FILE = argv.splash || 'splash.png';
settings.IOS = argv.ios || false;
settings.ANDROID = argv.android || false;
settings.ALL_PLATFORMS = !settings.IOS && !settings.ANDROID;
settings.PATCH_9 = argv['9-patch'] || false;
settings.PATCH_9_WIDTH = parseFloat(argv['9-patch-width'] || 0.25);
settings.PATCH_9_HEIGHT = parseFloat(argv['9-patch-height'] || 0.25);
settings.UPDATE_CONFIG_RESOURCES = argv['update-config'] || false;
settings.OLD_XCODE_PATH = argv['xcode-old'] || false;

var PLATFORMS = {
  ios: [
    // iPhone
    {name: 'Default~iphone.png', width: 320, height: 480},
    {name: 'Default@2x~iphone.png', width: 640, height: 960},
    {name: 'Default-568h@2x~iphone.png', width: 640, height: 1136},
    {name: 'Default-667h.png', width: 750, height: 1334},
    {name: 'Default-736h.png', width: 1242, height: 2208},
    {name: 'Default-Landscape-736h.png', width: 2208, height: 1242},
    // iPad
    {name: 'Default-Portrait~ipad.png', width: 768, height: 1024},
    {name: 'Default-Portrait@2x~ipad.png', width: 1536, height: 2048},
    {name: 'Default-Landscape~ipad.png', width: 1024, height: 768},
    {name: 'Default-Landscape@2x~ipad.png', width: 2048, height: 1536}
  ],
  android: [
    // Landscape
    {name: 'drawable-land-ldpi/screen.png', width: 320, height: 200, density: "land-ldpi"},
    {name: 'drawable-land-mdpi/screen.png', width: 480, height: 320, density: "land-mdpi"},
    {name: 'drawable-land-hdpi/screen.png', width: 800, height: 480, density: "land-hdpi"},
    {name: 'drawable-land-xhdpi/screen.png', width: 1280, height: 720, density: "land-xhdpi"},
    {name: 'drawable-land-xxhdpi/screen.png', width: 1600, height: 960, density: "land-xxhdpi"},
    {name: 'drawable-land-xxxhdpi/screen.png', width: 1920, height: 1280, density: "land-xxxhdpi"},
    // Portrait
    {name: 'drawable-port-ldpi/screen.png', width: 200, height: 320, density: "port-ldpi"},
    {name: 'drawable-port-mdpi/screen.png', width: 320, height: 480, density: "port-mdpi"},
    {name: 'drawable-port-hdpi/screen.png', width: 480, height: 800, density: "port-hdpi"},
    {name: 'drawable-port-xhdpi/screen.png', width: 720, height: 1280, density: "port-xhdpi"},
    {name: 'drawable-port-xxhdpi/screen.png', width: 960, height: 1600, density: "port-xxhdpi"},
    {name: 'drawable-port-xxxhdpi/screen.png', width: 1280, height: 1920, density: "port-xxxhdpi"}
  ]
};

var ANDROID_REVERSE_DENSITY_MAP = fromPairs(PLATFORMS.android.map(function (value, index) {
  return [value.density, value];
}))

var collectPlatformsFromConfig = function (configFile) {

  var deferred = Q.defer();
  var parser = new xml2js.Parser();
  fs.readFile(configFile, function (err, data) {
    if (err) {
      deferred.reject(err);
    }
    parser.parseString(data, function (err, result) {
      if (err) {
        deferred.reject(err);
      }
      var platforms = {};
      for (var i = 0; i < result.widget.platform.length; i++) {
        var platform = result.widget.platform[i];
        var platform_name = platform.$.name;
        var splash_list = [];

        for (var s = 0; s < platform.splash.length; s++) {
          var splash = platform.splash[s];
          var opts = {
            name: splash.$.src,
            width: splash.$.width,
            height: splash.$.height,
          }
          var density = splash.$.density;
          var density_info = ANDROID_REVERSE_DENSITY_MAP[density];
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
}

/**
 * Check which platforms are added to the project and return their splash screen names and sizes
 *
 * @param  {String} projectName
 * @param {object} configPlatforms
 * @return {Promise} resolves with an array of platforms
 */
var getPlatforms = function (args) {
  var projectName = args[0]
  var configPlatforms = args[1]
  var deferred = Q.defer();
  var platforms = [];
  var xcodeFolder = '/Images.xcassets/LaunchImage.launchimage/';

  if (settings.OLD_XCODE_PATH) {
    xcodeFolder = '/Resources/splash/';
  }
  var platform;
  // TODO collect path from config.xml
  if (settings.ALL_PLATFORMS || settings.IOS) {
    platform = {
      name: 'ios',
      // TODO: use async fs.exists
      isAdded: fs.existsSync('platforms/ios'),
      splashPath: 'platforms/ios/' + projectName + xcodeFolder,
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
    }
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
      {name: 'SplashScreen.scale-100.png', width: 620, height: 300},
      {name: 'SplashScreen.scale-125.png', width: 775, height: 375},
      {name: 'SplashScreen.scale-150.png', width: 930, height: 450},
      {name: 'SplashScreen.scale-200.png', width: 1240, height: 600},
      {name: 'SplashScreen.scale-400.png', width: 2480, height: 1200},
      // Portrait
      {name: 'SplashScreenPhone.scale-240.png', width: 1152, height: 1920},
      {name: 'SplashScreenPhone.scale-140.png', width: 672, height: 1120},
      {name: 'SplashScreenPhone.scale-100.png', width: 480, height: 800}
    ]
  });
  deferred.resolve(platforms);
  return deferred.promise;
};

/**
 * @var {Object} console utils
 */
var display = {};
display.success = function (str) {
  str = '✓  '.green + str;
  console.log('  ' + str);
};
display.error = function (str) {
  str = '✗  '.red + str;
  console.log('  ' + str);
};
display.header = function (str) {
  console.log('');
  console.log(' ' + str.cyan.underline);
  console.log('');
};

/**
 * read the config file and get the project name
 *
 * @return {Promise} resolves to a string - the project's name
 */
var getProjectName = function () {
  var deferred = Q.defer();
  var parser = new xml2js.Parser();
  fs.readFile(settings.CONFIG_FILE, function (err, data) {
    if (err) {
      deferred.reject(err);
    }
    parser.parseString(data, function (err, result) {
      if (err) {
        deferred.reject(err);
      }
      var projectName = result.widget.name[0];
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
var generateSplash = function (platform, splash) {
  var deferred = Q.defer();
  var srcPath = settings.SPLASH_FILE;
  var platformPath = srcPath.replace(/\.png$/, '-' + platform.name + '.png');
  if (fs.existsSync(platformPath)) {
    srcPath = platformPath;
  }
  var dstPath = platform.splashPath + splash.name;

  var has9Patch = (platform.name == 'android' && dstPath.match(/\.9\.png$/));
  dstPath = dstPath.replace(/\.9\.png$/, '.png')

  var dst = path.dirname(dstPath);
  if (!fs.existsSync(dst)) {
    fs.mkdirsSync(dst);
  }
  ig.identify(srcPath, function (err, srcInfo) {
    if (err) {
      deferred.reject(err);
    }
    ig.crop({
      srcPath: srcPath,
      dstPath: dstPath,
      quality: 1,
      format: 'png',
      width: splash.width,
      height: splash.height
    }, function (err, stdout, stderr) {
      if (err) {
        deferred.reject(err);
      } else {
        if (platform.name == 'android' && (has9Patch || settings.PATCH_9)) {
          // TODO from source size
          var new_size = Math.max.apply(null, [splash.width, splash.height]);
          var ratio = splash.width / splash.height;

          var base_border = ((srcInfo.height * 0.25) * new_size) / srcInfo.height

          var y_border = ((srcInfo.height * settings.PATCH_9_HEIGHT) * new_size) / srcInfo.height;
          var x_border = ((srcInfo.width * settings.PATCH_9_WIDTH) * new_size) / srcInfo.width;

          if (ratio < 1) {
            x_border = (base_border - y_border) * ratio;
          } else {
            y_border = (base_border - x_border) * ratio;
          }

          y_border = Math.round(y_border)
          x_border = Math.round(x_border)

          var convert_args = [
            '-background',
            'white',
            '-bordercolor',
            'white',
            dstPath,
            '-border', '1',
            '-fill', 'black',
            '-draw', 'line 1,0 ' + x_border + ',0',
            '-draw', 'line ' + (splash.width - x_border) + ',0 ' + splash.width + ',0',

            '-draw', 'line 0,1 ' + ' 0,' + y_border,
            '-draw', 'line 0,' + (splash.height - y_border) + ' 0,' + splash.height,
            dstPath.replace(/\.png$/, '.9.png')
          ];
          ig.convert(convert_args);
        }
        deferred.resolve();
        display.success(splash.name + ' created');
      }
    });

  })
  return deferred.promise;
};

/**
 * Generates splash based on the platform object
 *
 * @param  {Object} platform
 * @return {Promise}
 */
var generateSplashForPlatform = function (platform) {
  var deferred = Q.defer();
  display.header('Generating splash screen for ' + platform.name);
  var all = [];
  var splashes = platform.splash;
  splashes.forEach(function (splash) {
    all.push(generateSplash(platform, splash));
  });
  Q.all(all).then(function () {
    deferred.resolve();
  }).catch(function (err) {
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
var generateSplashes = function (platforms) {
  var deferred = Q.defer();
  var sequence = Q();
  var all = [];
  _(platforms).where({isAdded: true}).forEach(function (platform) {
    sequence = sequence.then(function () {
      return generateSplashForPlatform(platform);
    });
    all.push(sequence);
  });
  Q.all(all).then(function () {
    deferred.resolve();
  });
  return deferred.promise;
};

/**
 * Checks if at least one platform was added to the project
 *
 * @return {Promise} resolves if at least one platform was found, rejects otherwise
 */
var atLeastOnePlatformFound = function () {
  var deferred = Q.defer();
  getPlatforms().then(function (platforms) {
    var activePlatforms = _(platforms).where({isAdded: true});
    if (activePlatforms.length > 0) {
      display.success('platforms found: ' + _(activePlatforms).pluck('name').join(', '));
      deferred.resolve();
    } else {
      display.error(
        'No cordova platforms found. ' +
        'Make sure you are in the root folder of your Cordova project ' +
        'and add platforms with \'cordova platform add\''
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
var validSplashExists = function () {
  var deferred = Q.defer();
  fs.exists(settings.SPLASH_FILE, function (exists) {
    if (exists) {
      display.success(settings.SPLASH_FILE + ' exists');
      deferred.resolve();
    } else {
      display.error(settings.SPLASH_FILE + ' does not exist');
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
var configFileExists = function () {
  var deferred = Q.defer();
  fs.exists(settings.CONFIG_FILE, function (exists) {
    if (exists) {
      display.success(settings.CONFIG_FILE + ' exists');
      deferred.resolve();
    } else {
      display.error('cordova\'s ' + settings.CONFIG_FILE + ' does not exist');
      deferred.reject();
    }
  });
  return deferred.promise;
};


module.exports = {
  collectPlatformsFromConfig: collectPlatformsFromConfig,
  main: function () {
    display.header('Checking Project & Splash');

    // atLeastOnePlatformFound()
    validSplashExists()
      .then(configFileExists)
      .then(function () {
        return Q.all([getProjectName(), collectPlatformsFromConfig(settings.CONFIG_FILE)])
      })
      .then(getPlatforms)
      .then(generateSplashes)
      .catch(function (err) {
        if (err) {
          console.log(err);
        }
      }).then(function () {
      console.log('');
    });
  },
}


