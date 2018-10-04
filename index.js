var u = require('ssb-revisions/test/test-helper')
var tape = require('tape')

var keyA = u.rndKey()
var keyB = u.rndKey()
var keyC = u.rndKey()

var data = [
  {key: keyA, value: {content: {foo: true, bar: Date.now()}}},
  {key: keyB, value: {content: {foo: true, bar: Date.now()}}},
  {key: keyC, value: {content: {foo: true, bar: Date.now()}}}
]

module.exports = function (create) {

  var seed = Date.now()
  var filename = '/tmp/test-ssb-review-index_'+seed+'/'
  create(filename, seed, function(err, db) {
    if (err) throw err

    tape('simple', function (t) {
      db.append(data, function (err, m) {
        if(err) throw err
        t.end()
      })
    })

    function test (db, t) {
      db.revisions.index.get(data[0].key, function (err, value) {
        if(err) throw err
        t.deepEqual(value, data[0])
        db.revisions.index.get(data[1].key, function (err, value) {
          if(err) throw err
          t.deepEqual(value, data[1])
          db.revisions.index.get(data[2].key, function (err, value) {
            if(err) throw err
            t.deepEqual(value, data[2])
            t.end()
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


