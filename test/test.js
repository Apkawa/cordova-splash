'use strict'
import assert from 'assert'
import { collectPlatformsFromConfig } from '../src/'

describe('index', () => {
  describe('collectPlatformsFromConfig', () => {
    it('generic', () => {
      collectPlatformsFromConfig('/home/apkawa/work/u24-mobile-app/U24App/config.xml')
        .then(function (result) {
          assert(result['ios'])
        })
        .catch(function (err) {
          assert(0, err)

        })
    })
  })
})
