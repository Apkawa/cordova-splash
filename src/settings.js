

import fromPairs from 'lodash.frompairs';

export function getSettings(argv) {
  /**
   * @var {Object} settings - names of the config file and of the splash image
   */
  const settings = {};
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
}

export const PLATFORMS = {
  ios: [
    // iPhone
    { name: 'Default~iphone.png', width: 320, height: 480 },
    { name: 'Default@2x~iphone.png', width: 640, height: 960 },
    { name: 'Default-568h@2x~iphone.png', width: 640, height: 1136 },
    { name: 'Default-667h.png', width: 750, height: 1334 },
    { name: 'Default-736h.png', width: 1242, height: 2208 },
    { name: 'Default-Landscape-736h.png', width: 2208, height: 1242 },
    // iPad
    { name: 'Default-Portrait~ipad.png', width: 768, height: 1024 },
    { name: 'Default-Portrait@2x~ipad.png', width: 1536, height: 2048 },
    { name: 'Default-Landscape~ipad.png', width: 1024, height: 768 },
    { name: 'Default-Landscape@2x~ipad.png', width: 2048, height: 1536 },
  ],
  android: [
    // Landscape
    {
      name: 'drawable-land-ldpi/screen.png',
      width: 320,
      height: 200,
      density: 'land-ldpi',
    },
    {
      name: 'drawable-land-mdpi/screen.png',
      width: 480,
      height: 320,
      density: 'land-mdpi',
    },
    {
      name: 'drawable-land-hdpi/screen.png',
      width: 800,
      height: 480,
      density: 'land-hdpi',
    },
    {
      name: 'drawable-land-xhdpi/screen.png',
      width: 1280,
      height: 720,
      density: 'land-xhdpi',
    },
    {
      name: 'drawable-land-xxhdpi/screen.png',
      width: 1600,
      height: 960,
      density: 'land-xxhdpi',
    },
    {
      name: 'drawable-land-xxxhdpi/screen.png',
      width: 1920,
      height: 1280,
      density: 'land-xxxhdpi',
    },
    // Portrait
    {
      name: 'drawable-port-ldpi/screen.png',
      width: 200,
      height: 320,
      density: 'port-ldpi',
    },
    {
      name: 'drawable-port-mdpi/screen.png',
      width: 320,
      height: 480,
      density: 'port-mdpi',
    },
    {
      name: 'drawable-port-hdpi/screen.png',
      width: 480,
      height: 800,
      density: 'port-hdpi',
    },
    {
      name: 'drawable-port-xhdpi/screen.png',
      width: 720,
      height: 1280,
      density: 'port-xhdpi',
    },
    {
      name: 'drawable-port-xxhdpi/screen.png',
      width: 960,
      height: 1600,
      density: 'port-xxhdpi',
    },
    {
      name: 'drawable-port-xxxhdpi/screen.png',
      width: 1280,
      height: 1920,
      density: 'port-xxxhdpi',
    },
  ],
};

export const ANDROID_REVERSE_DENSITY_MAP = fromPairs(
  PLATFORMS.android.map(value => [value.density, value]));
