/*
 * grunt
 * https://github.com/cowboy/grunt
 *
 * Copyright (c) 2012 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * http://benalman.com/about/license/
 *
 * Mocha task
 * Copyright (c) 2012 Kelly Miyashiro
 * Licensed under the MIT license.
 * http://benalman.com/about/license/
 */

 'use strict';

var JSON2 = require('JSON2');
var Mocha = require('mocha');

module.exports = function(grunt) {
  // Nodejs libs.
  var path = require('path');

  // External lib.
  var phantomjs = require('grunt-lib-phantomjs').init(grunt);
  
  var growl;
  // Growl is optional
  try {
    growl = require('growl');
  } catch(e) {
    growl = function(){};
    grunt.verbose.write('Growl not found, npm install growl for Growl support');
  }

  // Keep track of the last-started module, test and status.
  var currentModule, currentTest, status;
  // Keep track of the last-started test(s).
  var unfinished = {};

  // Get an asset file, local to the root of the project.
  var asset = path.join.bind(null, __dirname, '..');

  // Allow an error message to retain its color when split across multiple lines.
  function formatMessage(str) {
    return String(str).split('\n').map(function(s) { return s.magenta; }).join('\n');
  }

  // Keep track of failed assertions for pretty-printing.
  var failedAssertions = [];
  function logFailedAssertions() {
    var assertion;
    // Print each assertion error.
    while (assertion = failedAssertions.shift()) {
      grunt.verbose.or.error(assertion.testName);
      grunt.log.error('Message: ' + formatMessage(assertion.message));
      if (assertion.actual !== assertion.expected) {
        grunt.log.error('Actual: ' + formatMessage(assertion.actual));
        grunt.log.error('Expected: ' + formatMessage(assertion.expected));
      }
      if (assertion.source) {
        grunt.log.error(assertion.source.replace(/ {4}(at)/g, '  $1'));
      }
      grunt.log.writeln();
    }
  }

  // ----------------------------------------------------------------------
  // Mocha hooks.
  // ----------------------------------------------------------------------
  var mocha = new Mocha({
    // useColors: true, // TODO(gregp)
    timeout: 2000,
    reporter: 'spec',
  });
  var runner = {};
  runner.__proto__ = Mocha.Runner.prototype;
  var reporter = new mocha._reporter(runner);

  // Add each of the handlers
  [
  'end',       // ==> 'mocha.end'
  'fail',      // ==> 'mocha.fail'
  'hook end',  // ==> 'mocha.hook_end'
  'hook',      // ==> 'mocha.hook'
  'pass',      // ==> 'mocha.pass'
  'pending',   // ==> 'mocha.pending'
  'start',     // ==> 'mocha.start'
  'suite end', // ==> 'mocha.suite_end'
  'suite',     // ==> 'mocha.suite'
  'test end',  // ==> 'mocha.test_end'
  'test',      // ==> 'mocha.test'
  ].forEach(function (key) {
    // Listen for the prefixed event type
    var gruntMochaKey = 'mocha.' + key.replace(/ /g, '_');
    phantomjs.on(gruntMochaKey, function () {
      if (key == 'end') {
        phantomjs.halt();
      }
      // Convert all the args from json
      var args = [].slice.call(arguments).map(_fromJson);
      args.unshift(key);
      // console.log(args);
      runner.emit.apply(runner, args);
    });
  });

  function _mochaEntity (key, value) {
    if (value && typeof value === 'object') {
      var type = value['$jsonClass'];
      if (typeof type === 'string' && type.indexOf('Mocha.') === 0) {
        var subtype = type.slice('Mocha.'.length);
        switch (subtype) {
          case 'Context':
          case 'Hook':
          case 'Suite':
          case 'Test':
            value.__proto__ = Mocha[subtype].prototype;
        }
      }
    }
    return value;
  }

  function _fromJson(json) {
    return JSON2.retrocycle(JSON2.parse(json, _mochaEntity));
  }

  function _resetGruntMocha() {
    // Reset current module.
    currentModule = null;
  }


  // // Re-broadcast qunit events on grunt.event.
  // phantomjs.on('mocha.*', function() {
  //   var args = [this.event].concat(grunt.util.toArray(arguments));
  //   grunt.event.emit.apply(grunt.event, args);
  // });

  // ----------------------------------------------------------------------
  // END Mocha hooks.
  // ----------------------------------------------------------------------





  // Built-in error handlers.
  phantomjs.on('fail.load', function(url) {
    phantomjs.halt();
    grunt.verbose.write('Running PhantomJS...').or.write('...');
    grunt.log.error();
    grunt.warn('PhantomJS unable to load "' + url + '" URI.', 90);
  });

  phantomjs.on('fail.timeout', function() {
    phantomjs.halt();
    grunt.log.writeln();
    grunt.warn('PhantomJS timed out, possibly due to a missing Mocha run() call.', 90);
  });

  // console.log pass-through.
  phantomjs.on('console', console.log.bind(console));

  // Debugging messages.
  // phantomjs.on('debug', grunt.log.debug.bind(log, 'phantomjs')

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('mocha', 'Run Mocha unit tests in a headless PhantomJS instance.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      // Default PhantomJS timeout.
      timeout: 5000,
      // Mocha-PhantomJS bridge file to be injected.
      inject: asset('phantomjs/bridge.js'),
      // Main PhantomJS script file
      phantomScript: asset('phantomjs/main.js'),
      // Explicit non-file URLs to test.
      urls: []
    });

    var configStr = JSON.stringify(options);
    grunt.verbose.writeln('Additional configuration: ' + configStr);

    // Combine any specified URLs with src files.
    var urls = options.urls.concat(this.filesSrc);
    
    // This task is asynchronous.
    var done = this.async();

    // Reset status.
    status = {failed: 0, passed: 0, total: 0, duration: 0};

    // Process each filepath in-order.
    grunt.util.async.forEachSeries(urls, function(url, next) {
      var basename = path.basename(url);
      grunt.verbose.subhead('Testing ' + basename).or.write('Testing ' + basename);

      _resetGruntMocha();

      // Launch PhantomJS.
      phantomjs.spawn(url, {
        // Exit code to use if PhantomJS fails in an uncatchable way.
        failCode: 90,
        // Additional PhantomJS options.
        options: options,
        // Do stuff when done.
        done: function(err) {
          if (err) {
            // If there was an error, abort the series.
            done();
          } else {
            // Otherwise, process next url.
            next();
          }
        },
      });
    },
    // All tests have been run.
    function() {
      // Log results.
      if (status.failed > 0) {
        growl(status.failed + ' of ' + status.total + ' tests failed!', {
          image: asset('growl/error.png'),
          title: 'Tests Failed',
          priority: 3
        });
        grunt.warn(status.failed + '/' + status.total + ' assertions failed (' +
          status.duration + 's)', Math.min(99, 90 + status.failed));
      } else {
        growl('All Clear: ' + status.total + ' tests passed', {
          title: 'Tests Passed',
          image: asset('growl/ok.png')
        });
        grunt.verbose.writeln();
        grunt.log.ok(status.total + ' assertions passed (' + status.duration + 's)');
      }

      // All done!
      done();
    });
  });
};
