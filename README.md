# grunt-mocha-phantom-hack

Automatically run client-side mocha specs via grunt/mocha/PhantomJS and get real reporter data.

Forked from [https://github.com/kmiyashiro/grunt-mocha](https://github.com/kmiyashiro/grunt-mocha) because I am addicted to reporters.
And because the new dependencies are prolly too much to ask for in a pull request. And because I'm antisocial, probably.

Also, if you don't need the gruntyness, [https://github.com/metaskills/mocha-phantomjs](https://github.com/metaskills/mocha-phantomjs) is gonna be more your bag.

## Broken.

* running against multiple files doesn't clear counts between files
* timers are all out of whack
* huge blob of dependency for the JSON.decycle() in the phantom js shim
* stack traces are not always perfect
* "0 assertions passed (0s)" printout at end of grunt task

Meh.
