var log = require('npmlog')
var npm = require('../npm.js') // only for npm-registry-client
var read = require('read')
var userValidate = require('npm-user-validate')
var output = require('../utils/output')
var chain = require('slide').chain

module.exports.login = function login (creds, registry, scope, cb) {
  // ignore creds for now, cause we're pretending to always log in
  var c = {
    u: creds.username || '',
    p: creds.password || '',
    e: creds.email || ''
  }
  var u = {}

  chain([
    [readUsername, c, u],
    [readPassword, c, u],
    [readEmail, c, u],
    [save, c, u, registry, scope]
  ], cb)
}

function readUsername (c, u, cb) {
  var v = userValidate.username
  read({prompt: 'Username: ', default: c.u || ''}, function (er, un) {
    if (er) {
      return cb(er.message === 'cancelled' ? er.message : er)
    }

    // make sure it's valid.  we have to do this here, because
    // couchdb will only ever say "bad password" with a 401 when
    // you try to PUT a _users record that the validate_doc_update
    // rejects for *any* reason.

    if (!un) {
      return readUsername(c, u, cb)
    }

    var error = v(un)
    if (error) {
      log.warn(error.message)
      return readUsername(c, u, cb)
    }

    c.changed = c.u !== un
    u.u = un
    cb(er)
  })
}

function readPassword (c, u, cb) {
  var v = userValidate.pw

  var prompt
  if (c.p && !c.changed) {
    prompt = 'Password: (or leave unchanged) '
  } else {
    prompt = 'Password: '
  }

  read({prompt: prompt, silent: true}, function (er, pw) {
    if (er) {
      return cb(er.message === 'cancelled' ? er.message : er)
    }

    if (!c.changed && pw === '') {
      // when the username was not changed,
      // empty response means "use the old value"
      pw = c.p
    }

    if (!pw) {
      return readPassword(c, u, cb)
    }

    var error = v(pw)
    if (error) {
      log.warn(error.message)
      return readPassword(c, u, cb)
    }

    c.changed = c.changed || c.p !== pw
    u.p = pw
    cb(er)
  })
}

function readEmail (c, u, cb) {
  var v = userValidate.email
  var r = { prompt: 'Email: (this IS public) ', default: c.e || '' }
  read(r, function (er, em) {
    if (er) {
      return cb(er.message === 'cancelled' ? er.message : er)
    }

    if (!em) {
      return readEmail(c, u, cb)
    }

    var error = v(em)
    if (error) {
      log.warn(error.message)
      return readEmail(c, u, cb)
    }

    u.e = em
    cb(er)
  })
}

function save (c, u, registry, scope, cb) {
  // there may be a saved scope and no --registry (for login)
  if (scope) {
    if (scope.charAt(0) !== '@') scope = '@' + scope

    var scopedRegistry = npm.config.get(scope + ':registry')
    var cliRegistry = npm.config.get('registry', 'cli')
    if (scopedRegistry && !cliRegistry) registry = scopedRegistry
  }

  var params = {
    auth: {
      username: u.u,
      password: u.p,
      email: u.e
    }
  }
  npm.registry.adduser(registry, params, function (er, doc) {
    if (er) return cb(er)

    // don't want this polluting the configuration
    npm.config.del('_token', 'user')

    if (scope) npm.config.set(scope + ':registry', registry, 'user')

    var newCreds
    if (doc && doc.token) {
      newCreds = {
        token: doc.token
      }
    } else {
      newCreds = {
        username: u.u,
        password: u.p,
        email: u.e,
        alwaysAuth: npm.config.get('always-auth')
      }
    }

    log.info('adduser', 'Authorized user %s', u.u)
    var scopeMessage = scope ? ' to scope ' + scope : ''
    output('Logged in as %s%s on %s.', u.u, scopeMessage, registry)
    cb(null, newCreds)
  })
}
