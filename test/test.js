'use strict';
var assert = require('assert');

var collectPlatformsFromConfig = require('../index').collectPlatformsFromConfig;

describe('index', function () {
  describe('collectPlatformsFromConfig', function () {
    it('generic', function () {
      collectPlatformsFromConfig('/home/apkawa/work/u24-mobile-app/U24App/config.xml')
        .then(function (result) {
          assert(result['ios'])
        })
        .catch(function (err) {
          assert(0, err)

        })

    });
  });
});
