'use strict';


/*
 * initialize module
 */
var systemRegex = /^system\./;
var fs = require('fs');
var resolve = require('path').resolve;
var targz = require('tar.gz');
var BSON;
var logger;
var meta;

/*
 * functions
 */
/**
 * error handler
 *
 * @function error
 * @param {Object} err - raised error
 */
function error(err) {

    return logger(err.message);
}

/**
 * save collection metadata to file
 *
 * @function writeMetadata
 * @param {Object} collection - db collection
 * @param {String} metadata - path of metadata
 * @param {Function} next - callback
 */
function writeMetadata(collection, metadata, next) {

    return collection.indexes(function(err, indexes) {

        if (err) {
            error(err);
            return next(null);
        }

        fs.writeFileSync(metadata + collection.collectionName, JSON
            .stringify(indexes), {
            encoding: 'utf8'
        });
        return next(null);
    });
}

/**
 * make dir
 *
 * @function makeDir
 * @param {String} path - path of dir
 * @param {Function} next - callback
 */
function makeDir(path, next) {

    return fs.stat(path, function(err, stats) {

        if (err && err.code === 'ENOENT') {
            logger('make dir at ' + path);
            return fs.mkdir(path, function(err) {

                return next(err, path);
            });

        } else if (stats && stats.isDirectory() === false) {
            logger('unlink file at ' + path);
            return fs.unlink(path, function() {

                logger('make dir at ' + path);
                return fs.mkdir(path, function(err) {

                    return next(err, path);
                });
            });
        }

        return next(null, path);
    });
}

/**
 * remove dir
 *
 * @function rmDir
 * @param {String} path - path of dir
 * @param {Function} [next] - callback
 */
function rmDir(path, next) {

    return fs.readdirSync(path).forEach(function(first) { // database

        var database = path + first;
        if (fs.statSync(database).isDirectory() === false) {
            return;
        }

        var metadata = '';
        var collections = fs.readdirSync(database);
        if (fs.existsSync(database + '/.metadata') === true) {
            metadata = database + '/.metadata/';
            delete collections[collections.indexOf('.metadata')]; // undefined is not a dir
        }

        collections.forEach(function(second) { // collection

            var collection = database + '/' + second;
            if (fs.statSync(collection).isDirectory() === false) {
                return;
            }
            fs.readdirSync(collection).forEach(function(third) { // document

                var document = collection + '/' + third;
                fs.unlinkSync(document);
                return next ? next(null, document) : '';
            });

            if (metadata !== '') {
                fs.unlinkSync(metadata + second);
            }
            return fs.rmdirSync(collection);
        });

        if (metadata !== '') {
            fs.rmdirSync(metadata);
        }
        return fs.rmdirSync(database);
    });
}

/**
 * JSON parser
 *
 * @function toJson
 * @param {Array} docs - documents from query
 * @param {String} collectionPath - path of collection
 * @param {Function} next - callback
 */
function toJson(docs, collectionPath, next) {

    var last = docs.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    return docs.forEach(function(doc) {

        // no async. EMFILE error
        fs.writeFileSync(collectionPath + doc._id + '.json', JSON.stringify(doc), {
            encoding: 'utf8'
        });
        return last === ++index ? next(null) : null;
    });
}

/**
 * BSON parser
 *
 * @function toBson
 * @param {Array} docs - documents from query
 * @param {String} collectionPath - path of collection
 * @param {Function} next - callback
 */
function toBson(docs, collectionPath, next) {

    var last = docs.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    return docs.forEach(function(doc) {

        // no async. EMFILE error
        fs.writeFileSync(collectionPath + doc._id + '.bson', BSON.serialize(doc), {
            encoding: null
        });
        return last === ++index ? next(null) : null;
    });
}

/**
 * get data from all available collections
 *
 * @function allCollections
 * @param {Object} db - database
 * @param {String} name - path of dir
 * @param {Object} query - find query
 * @param {String} metadata - path of metadata
 * @param {Function} parser - data parser
 * @param {Function} next - callback
 */
function allCollections(db, name, query, metadata, parser, next) {

    return db.collections(function(err, collections) {

        if (err) {
            return error(err);
        }
        var last = collections.length, index = 0;
        if (last < 1) {
            return next(null);
        }

        return collections.forEach(function(collection) {

            if (systemRegex.test(collection.collectionName) === true) {
                return last === ++index ? next(null) : null;
            }

            logger('select collection ' + collection.collectionName);
            return makeDir(name + collection.collectionName + '/',
                function(err, name) {

                    return meta(collection, metadata, function() {

                        return collection.find(query).snapshot(true).toArray(
                            function(err, docs) {

                                if (err) {
                                    return last === ++index ? next(err) : error(err);
                                }
                                return parser(docs, name, function(err) {

                                    if (err) {
                                        return last === ++index ? next(err) : error(err);
                                    }
                                    return last === ++index ? next(null) : null;
                                });
                            });
                    });
                });
        });
    });
}

/**
 * get data from all available collections without query (parallelCollectionScan)
 *
 * @function allCollectionsScan
 * @param {Object} db - database
 * @param {String} name - path of dir
 * @param {Integer} numCursors - number of multiple cursors [1:10000]
 * @param {String} metadata - path of metadata
 * @param {Function} parser - data parser
 * @param {Function} next - callback
 */
function allCollectionsScan(db, name, numCursors, metadata, parser, next) {

    return db.collections(function(err, collections) {

        if (err) {
            return error(err);
        }
        var last = collections.length, index = 0;
        if (last < 1) {
            return next(null);
        }

        return collections.forEach(function(collection) {

            if (systemRegex.test(collection.collectionName) === true) {
                return last === ++index ? next(null) : null;
            }

            logger('select collection scan ' + collection.collectionName);
            return makeDir(name + collection.collectionName + '/',
                function(err, name) {

                    return meta(collection, metadata, function() {

                        return collection.parallelCollectionScan({
                            numCursors: numCursors
                        }, function(err, cursors) {

                            var left = cursors.length;
                            if (left === 0) {
                                return last === ++index ? next(null) : null;
                            }
                            for (var i = 0; i < left; ++i) {
                                cursors[i].toArray(function(err, docs) {

                                    if (err) {
                                        return last === ++index ? next(err) : error(err);
                                    }
                                    return parser(docs, name, function(err) {

                                        if (err) {
                                            return last === ++index ? next(err) : error(err);
                                        }
                                        return last === ++index ? next(null) : null;
                                    });
                                });
                            }
                        });
                    });
                });
        });
    });
}

/**
 * get data from some collections
 *
 * @function someCollections
 * @param {Object} db - database
 * @param {String} name - path of dir
 * @param {Object} query - find query
 * @param {String} metadata - path of metadata
 * @param {Function} parser - data parser
 * @param {Function} next - callback
 * @param {Array} collections - selected collections
 */
function someCollections(db, name, query, metadata, parser, next, collections) {

    var last = collections.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    return collections.forEach(function(collection) {

        return db.collection(collection, function(err, collection) {

            logger('select collection ' + collection.collectionName);
            if (err) {
                return last === ++index ? next(err) : error(err);
            }
            return makeDir(name + collection.collectionName + '/',
                function(err, name) {

                    return meta(collection, metadata, function() {

                        return collection.find(query).snapshot(true).toArray(
                            function(err, docs) {

                                if (err) {
                                    return last === ++index ? next(err) : error(err);
                                }
                                return parser(docs, name, function(err) {

                                    if (err) {
                                        return last === ++index ? next(err) : error(err);
                                    }
                                    return last === ++index ? next(null) : null;
                                });
                            });
                    });
                });
        });
    });
}

/**
 * get data from some collections without query (parallelCollectionScan)
 *
 * @function someCollectionsScan
 * @param {Object} db - database
 * @param {String} name - path of dir
 * @param {Integer} numCursors - number of multiple cursors [1:10000]
 * @param {String} metadata - path of metadata
 * @param {Function} parser - data parser
 * @param {Function} next - callback
 * @param {Array} collections - selected collections
 */
function someCollectionsScan(db, name, numCursors, metadata, parser, next,
                             collections) {

    var last = collections.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    return collections.forEach(function(collection) {

        return db.collection(collection, function(err, collection) {

            logger('select collection scan ' + collection.collectionName);
            if (err) {
                return last === ++index ? next(err) : error(err);
            }
            return makeDir(name + collection.collectionName + '/',
                function(err, name) {

                    return meta(collection, metadata, function() {

                        return collection.parallelCollectionScan({
                            numCursors: numCursors
                        }, function(err, cursors) {

                            var left = cursors.length;
                            if (left === 0) {
                                return last === ++index ? next(null) : null;
                            }
                            for (var i = 0; i < left; ++i) {
                                cursors[i].toArray(function(err, docs) {

                                    if (err) {
                                        return last === ++index ? next(err) : error(err);
                                    }
                                    return parser(docs, name, function(err) {

                                        if (err) {
                                            return last === ++index ? next(err) : error(err);
                                        }
                                        return last === ++index ? next(null) : null;
                                    });
                                });
                            }
                        });
                    });
                });
        });
    });
}

/**
 * function wrapper
 *
 * @function wrapper
 * @param {Object} my - parsed options
 */
function wrapper(my) {

    var parser;
    if (typeof my.parser === 'function') {
        parser = my.parser;
    } else {
        switch (my.parser) {
            case 'bson':
                BSON = require('bson');
                BSON = new BSON.BSONPure.BSON();
                parser = toBson;
                break;
            case 'json':
                // JSON error on ObjectId, Date and Long
                parser = toJson;
                break;
            default:
                throw new Error('missing parser option');
        }
    }

    var discriminator = allCollections;
    if (my.collections !== null) {
        discriminator = someCollections;
        if (my.numCursors) {
            discriminator = someCollectionsScan;
            my.query = my.numCursors; // override
        }
    } else if (my.numCursors) {
        discriminator = allCollectionsScan;
        my.query = my.numCursors; // override
    }

    if (my.logger === null) {
        logger = function() {

            return;
        };
    } else {
        logger = require('logger-request')({
            filename: my.logger,
            standalone: true,
            winston: {
                logger: '_mongo_b' + my.logger,
                level: 'info',
                json: false
            }
        });
        logger('backup start');
        var log = require('mongodb').Logger;
        log.setLevel('info');
        log.setCurrentLogger(function(msg) {

            return logger(msg);
        });
    }

    var metadata = '';
    if (my.metadata === true) {
        meta = writeMetadata;
    } else {
        meta = function(a, b, c) {

            return c();
        };
    }

    function callback() {

        logger('backup stop');
        if (my.callback !== null) {
            logger('callback run');
            my.callback();
        }
        return;
    }

    return (function(db,my) {
            var root = my.targz === null ? my.root : my.dir;
            makeDir(root, function(err, name) {

                makeDir(name + db.databaseName + '/', function(err, name) {

                    function go() {

                        // waiting for `db.fsyncLock()` on node driver
                        return discriminator(db, name, my.query, metadata, parser,
                            function(err) {

                                if (err) {
                                    error(err);
                                }
                                // logger('db close');
                                // db.close();

                                if (my.targz) {
                                    return makeDir(my.root, function(err, name) {

                                        if (err) {
                                            error(err);
                                        }
                                        var dest;
                                        if (my.stream) { // user stream
                                            logger('send targz file to stream');
                                            dest = my.stream;
                                        } else { // filesystem stream
                                            logger('make targz file at ' + name + my.targz);
                                            dest = fs.createWriteStream(name + my.targz);
                                        }

                                        targz().compress(root + db.databaseName, name + my.targz, function(err){
                                            if(err)
                                               return error(err);

                                            rmDir(root);
                                            return callback();
                                        });
                                        // var packer = require('tar').Pack().on('error', error).on(
                                        //     'end', function() {
                                        //
                                        //         rmDir(root);
                                        //         return callback();
                                        //     });

                                        // return require('fstream').Reader({
                                        //     path: root + db.databaseName,
                                        //     type: 'Directory'
                                        // }).on('error', error).pipe(packer).pipe(dest);

                                        // return targz().createReadStream(root + db.databaseName).on('error', error).pipe(dest);
                                    });
                                }

                                return callback();
                            }, my.collections);
                    }

                    if (my.metadata === false) {
                        go();
                    } else {
                        metadata = name + '.metadata/';
                        makeDir(metadata, go);
                    }
                    return;
                });
            });
        })(my.db,my);
}

/**
 * option setting
 *
 * @exports backup
 * @function backup
 * @param {Object} options - various options. Check README.md
 */
function backup(options) {



    var opt = options || Object.create(null);
    if (!opt.db) {
        throw new Error('missing db option');
    }
    if (!opt.stream) {
        if (!opt.root) {
            throw new Error('missing root option');
        } else if (fs.existsSync(opt.root) && !fs.statSync(opt.root).isDirectory()) {
            throw new Error('root option is not a directory');
        }
    }

    var my = {
        dir: __dirname + '/../../../'+(opt.mongodumpTempDir||'mongodump-temp')+"/",
        // dir: './../../temp-mongodump/',
        // uri: String(opt.uri),
        db:opt.db,
        root: resolve(String(opt.root || '')) + '/',
        stream: opt.stream || null,
        parser: opt.parser || 'bson',
        numCursors: ~~opt.numCursors,
        collections: Array.isArray(opt.collections) ? opt.collections : null,
        callback: typeof (opt.callback) == 'function' ? opt.callback : null,
        targz: typeof opt.targz === 'string' ? opt.targz : null,
        query: typeof opt.query === 'object' ? opt.query : {},
        logger: typeof opt.logger === 'string' ? resolve(opt.logger) : null,
        options: typeof opt.options === 'object' ? opt.options : {},
        metadata: Boolean(opt.metadata)
    };
    if (my.stream) {
        my.targz = true; // override
    }
    return wrapper(my);
}

function getBackupFileName(dbname,collections){
    var now=new Date();
    var mm=now.getMonth()+1;
    var month=(mm>9)?mm:("0"+mm);
    var day=(now.getDate()>9)?now.getDate():('0'+now.getDate());
    var hours=(now.getHours()>9)?now.getHours():('0'+now.getHours);
    var minutes=(now.getMinutes()>9)?now.getMinutes():('0'+now.getMinutes());
    var seconds=(now.getSeconds()>9)?now.getSeconds():('0'+now.getSeconds());
    return now.getFullYear()+month+day+"-"+hours+minutes+seconds+"-"+dbname;

}

var routes = function (config) {
    var exp = {};
    exp.backupDatabase=function(req,res){
        var opt = config.options;
        var file = getBackupFileName(req.db.databaseName)+'.tar.gz'
        backup({
            db:req.db,
            // root:  './../../dump',
            root: resolve(__dirname + '/../../../'+(config.options.mongodumpDir||'mongodump')),
            mongodumpTempDir:config.options.mongodumpTempDir||'temp-mongodump',
            targz: file, // save backup into this tar.gz file
            callback:function(){
                res.status(200).json({
                    database:req.params.database,
                    action:'backup',
                    file:resolve(__dirname + '/../../../'+(config.options.mongodumpDir||'mongodump'))+"/"+file,
                    status:"OK"
                });
            }
        });
    };
    return exp;
}
module.exports = routes;
