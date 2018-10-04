var pull = require('pull-stream')
var compare = require('typewise').compare
var tape = require('tape')
var u = require('ssb-revisions/test/test-helper')

module.exports = function (create, N) {
  N = N || 10
  var data = []
  for(var i = 0; i < N; i++)
    data.push({key: u.rndKey(), value: {content: {foo: true, bar: Date.now(), i}}})

  var sorted = data.slice().sort(function (a, b) {
    return compare(a.key, b.key)
  })

  var seed = Date.now()
  var filename = '/tmp/test-flumeview-index_'+seed+'/'
  create(filename, seed, (err, db) => {
    if (err) throw err

    tape('simple', function (t) {
      db.append(data, function (err, m) {
        if(err) throw err
        t.end()
      })
    })

    function all (db, opts, cb) {
      pull(
        db.revisions.index.read(opts),
        pull.collect(cb)
      )
    }

    function test (db, t) {
      all(db, {old: true, live: false}, function (err, ary) {
        t.deepEqual(ary.map(function (e) { return {key:e.value.key, value:e.value.value}}), sorted)
        all(db, {keys: true, values: false}, function (err, _ary) {
          t.deepEqual(_ary, ary.map(function (e) { return {key: e.key, seq: e.seq} }))
          all(db, {keys: false, values: true}, function (err, _ary) {
            t.deepEqual(_ary, ary.map(function (e) { return {seq: e.seq, value: e.value} }))
            all(db, {values: true, seqs: false, keys: false}, function (err, _ary) {
              t.deepEqual(_ary, ary.map(function (e) { return e.value }))
              t.end()
            })
          })
        })
      })
    }

    tape('test', t => test(db, t))

    tape('close', function (t) {
      db.close(t.end)
    })

    tape('retest', t => {
      create(filename, seed, function(err, db) {
        if (err) throw err
        test(db, t)
      })
    })

  })
}

