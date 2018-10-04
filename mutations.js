var pull = require('pull-stream')
var u = require('ssb-revisions/test/test-helper')
var tape = require('tape')
var multicb = require('multicb')

var keyA = u.rndKey()
var keyB = u.rndKey()
var keyC = u.rndKey()

var a = u.msg(keyA)
var b = u.msg(keyB, keyA, [keyA])
var c = u.msg(keyC, keyA, [keyB])

a.value.content.groups = [1]
b.value.content.groups = [2,3]
c.value.content.groups = [3,4]

var data = [a, b, c]

module.exports = function (create) {

  var seed = Date.now()
  var filename = '/tmp/test-ssb-review-index_'+seed+'/'
  create(filename, seed, function(err, db) {
    if (err) throw err

    tape('slow live stream', t => {
      const done = multicb({pluck: 1})
      const cb1 = done()
      const cb2 = done()

      done( err => {
        t.error(err)
        t.end()
      })

      pull(
        db.revisions.index.read({live: true, values: true, seqs: false}),
        pull.take(6),
        pull.through( e=>{
          console.log('view', e)
        }),
        pull.collect( (err, result) => {
          t.error(err)
          console.log(JSON.stringify(result, null, 2))
          t.deepEqual(result[0], {sync: true})
          t.deepEqual(result[1], {key: 1, value: a})
          t.deepEqual(result[2], {key: 2, value: b})
          t.deepEqual(result[3], {key: 3, value: b})
          t.deepEqual(result[4], {key: 1, value: undefined, type: 'del'})
          t.deepEqual(result[5], {key: 4, value: c})
          cb1()
        })
      )

      pull(
        db.revisions.index.read({gte: 1, lt: 2, live: true, values: true, seqs: false}),
        pull.take(3),
        pull.through( e=>{
          console.log('view2', e)
        }),
        pull.collect( (err, result) => {
          t.error(err)
          console.log(JSON.stringify(result, null, 2))
          t.deepEqual(result[0], {sync: true})
          t.deepEqual(result[1], {key: 1, value: a})
          t.deepEqual(result[2], {key: 1, value: undefined, type: 'del'})
          cb2()
        })
      )

      pull(
        pull.values(data),
        pull.asyncMap(db.append),
        pull.asyncMap((e, cb)=>{
          setTimeout( ()=>cb(null, e), 100)
        }),
        pull.drain()
      )
    })

  })
}


