var pull = require('pull-stream')

module.exports = function (create) {

  function Timer (name) {
    var start = Date.now()
    return function (ops) {
      var seconds = (Date.now() - start)/1000
      console.log(name, ops, ops/seconds)
    }
  }

  function initialize (db, N, cb) {
    var data = []
    for(var i = 0; i < N; i++)
      data.push({key: '#'+i, value: {
        content: {
          foo: Math.random(), bar: Date.now()
        }
      }})

    var t = Timer('append')
    db.append(data, function (err, offset) {
      if(err) throw err
      //wait until the view is consistent!
      db.revisions.index.since(function (v) {
        if(v < offset) return
        cb(null, N)
      })
    })
  }

  function ordered (db, N, cb) {
    //ordered reads
    var n = 0
    for(var i = 0; i < N; i++) {
      db.revisions.index.get('#'+i, next)
    }

    function next (err, v) {
      if(++n == N) cb(null, N)
    }
  }

  function random (db, N, cb) {
    ;(function get(i) {
      if(i >= N) return cb(null, N)

      db.revisions.index.get('#'+~~(Math.random()*N), function (err, data) {
        setImmediate(function () { get(i+1) })
      })

    })(0)

  }

  function random_ranges (db, N, makeOpts, cb) {
    if(!db.revisions.index.read) return cb(new Error('not supported'))

    ;(function get(i) {
      if(i >= N) return cb(null, N)

      pull(
        db.revisions.index.read(
          makeOpts('#'+~~(Math.random()*N))
//        {gt: '#'+~~(Math.random()*N), limit: 10, keys: false}

        ),
        pull.collect(function (err, ary) {
          setImmediate(function () { get(i + ary.length) })
        })
      )
    })(0)
  }

  var seed = Date.now()
  var file = '/tmp/test-flumeview-index_'+seed+'/'

  create(file, seed, (err, db) =>{
    if (err) throw err
    var N = 50000
    var t = Timer('append')
    initialize(db, N, function (err, n) {
      t(n)
      t = Timer('ordered_cached')
      ordered(db, N, function (err, n) {
        t(n)
        t = Timer('random_cached')
        random(db, N, function (err, n) {
          t(n)
          t = Timer('ordered')
          db.close(function () {
            create(file, undefined, (err, db) => {
              if (err) throw err
              ordered(db, N, function (err, n) {
                t(n)
                t = Timer('random_ranges')
                random_ranges(db, N, function (key) {
                  return {gt: key, limit: 10, keys: false}
                }, function (err, n) {
                  t(n)
                  t = Timer('random_ranges_reverse')
                  random_ranges(db, N, function (key) {
                    return {lt: key, limit: 10, keys: false, reverse: true}
                  }, function (err, n) {
                    t(n)
                    db.close(function () {
                      create(file, undefined, (err, db) => {
                        if (err) throw err
                        t = Timer('random_cached2')
                        random(db, N, function (err, n) {
                          t(n)
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
}




