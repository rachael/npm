module.exports = adduser

var log = require('npmlog')
var npm = require('./npm.js')
var usage = require('./utils/usage')
var crypto

try {
  crypto = require('crypto')
} catch (ex) {}

adduser.usage = usage(
  'adduser',
  'npm adduser [--registry=url] [--scope=@orgname] [--always-auth]'
)

function adduser (args, cb) {
  if (!crypto) {
    return cb(new Error(
    'You must compile node with ssl support to use the adduser feature'
    ))
  }

  var registry = npm.config.get('registry')
  var scope = npm.config.get('scope')
  var creds = npm.config.getCredentialsByURI(registry)
  var authMod = require('./auth/legacy')

  log.disableProgress()

  return authMod.login(creds, registry, scope, function (err, newCreds) {
    if (err) return cb(err)
    npm.config.setCredentialsByURI(registry, newCreds)
    npm.config.save('user', cb)
  })
}
