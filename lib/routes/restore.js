'use strict';
/*
 * initialize module
 */
var fs = require('fs');
var resolve = require('path').resolve;
var targz = require('tar.gz');
var BSON;
var logger;
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

    fs.readdirSync(path).forEach(function(first) { // database

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
 * @function fromJson
 * @param {Object} collection - collection model
 * @param {String} collectionPath - path of collection
 * @param {Function} next - callback
 */
function fromJson(collection, collectionPath, next) {

    var docsBulk = [];
    var docs = fs.readdirSync(collectionPath);
    var last = docs.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    return docs.forEach(function(docName) {

        var doc;
        var docPath = collectionPath + docName;
        if (fs.statSync(docPath).isFile() === false) {
            var err = new Error('document is not a valid format');
            return last === ++index ? next(err) : error(err);
        }
        try {
            doc = JSON.parse(fs.readFileSync(docPath, {
                encoding: 'utf8'
            }));
        } catch (err) {
            return last === ++index ? next(err) : error(err);
        }

        docsBulk.push({
            insertOne: {
                document: doc
            }
        });
        return last === ++index ? collection.bulkWrite(docsBulk, next) : null;
    });
}

/**
 * BSON parser
 *
 * @function fromBson
 * @param {Object} collection - collection model
 * @param {String} collectionPath - path of collection
 * @param {Function} next - callback
 */
function fromBson(collection, collectionPath, next) {

    var docsBulk = [];
    var docs = fs.readdirSync(collectionPath);
    var last = docs.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    return docs.forEach(function(docName) {

        var doc;
        var docPath = collectionPath + docName;
        if (fs.statSync(docPath).isFile() === false) {
            var err = new Error('document is not a valid format');
            return last === ++index ? next(err) : error(err);
        }
        try {
            doc = BSON.deserialize(fs.readFileSync(docPath, {
                encoding: null
            }));
        } catch (err) {
            return last === ++index ? next(err) : error(err);
        }

        docsBulk.push({
            insertOne: {
                document: doc
            }
        });
        return last === ++index ? collection.bulkWrite(docsBulk, next) : null;
    });
}


function restoreData (db, rootDir, targetCollectionName, parser, next) {
    var collections = fs.readdirSync(rootDir);
    var last = collections.length, index = 0;
    if (last < 1) {
        return next(null);
    }

    if (collections.indexOf('.metadata') >= 0) { // undefined is not a dir
        delete collections[collections.indexOf('.metadata')];
        last--;
    }

    var collectionFilePath = rootDir + collections[0];//one collection only
    if (!fs.statSync(collectionFilePath).isDirectory()) {
        var err = new Error(collectionFilePath + ' is not a directory');
        return next(err);
    }

    return db.createCollection(targetCollectionName, function(err, collection) {

        if (err) {
            next(err);
        }
        logger('create collection ' + targetCollectionName);
        return parser(collection, collectionFilePath + '/', function(err) {
            if (err) {
                return next(err);
            }
            return next(null);
        });
    });
}


function dropCollectionByName(db,collectionName,next){
    return db.collection(collectionName, function(err, collection) {
        logger('drop collection ' + collection.collectionName);
        if (err) {
            next(err);
        }
        collection.drop(function(err) {

            if (err) {
                next(err);
            }
            return next(null);
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
                parser = fromBson;
                break;
            case 'json':
                // JSON error on ObjectId and Date
                parser = fromJson;
                break;
            default:
                throw new Error('missing parser option');
        }
    }

    // var discriminator = allCollections;

    if (my.logger === null) {
        logger = function() {

            return;
        };
    } else {
        logger = require('logger-request')({
            filename: my.logger,
            standalone: true,
            winston: {
                logger: '_mongo_r' + my.logger,
                level: 'info',
                json: false
            }
        });
        logger('restore start');
        var log = require('mongodb').Logger;
        log.setLevel('info');
        log.setCurrentLogger(function(msg) {

            return logger(msg);
        });
    }


    function callback() {

        logger('restore stop');
        if (my.targz) {
            rmDir(my.dir);
        }
        if (my.callback !== null) {
            logger('callback run');
            my.callback();
        }
        return;
    }

    /**
     * entry point
     *
     * @return {Null}
     */
    function go(root) {

        return (function(db,my) {

                function next(err,targetCollectionName) {

                    if (err) {
                        error(err);
                        return callback();
                    }

                    return restoreData(db, root, targetCollectionName, parser, function(err) {

                        if (err) {
                            error(err);
                        }
                        return callback();
                    });
                }
                    logger('drop collections');
                    if (my.dropCollection) {
                        return dropCollectionByName(db, my.dropCollection, function(err) {
                            return next(err,my.dropCollection);
                        });
                    } else if (my.createCollection){
                        return next(null,my.createCollection);
                    }

            })(my.db,my);
    }

    return makeDir(my.dir, function() {
        targz().extract(my.root + my.targz, my.dir, function(err){
            if(err){
                error(err);
                return;
            }
            var dirs = fs.readdirSync(my.dir);
            for (var i = 0, ii = dirs.length; i < ii; i++) {
                var t = my.dir + dirs[i];
                if (fs.statSync(t).isFile() === false) {
                    return go(t + '/');
                }
            }
            return;
        });
    });
}

/**
 * option setting
 *
 * @exports restore
 * @function restore
 * @param {Object} options - various options. Check README.md
 */
function restore(options) {

    var opt = options || Object.create(null);
    if (!opt.db) {
        throw new Error('missing db option');
    }
    if (!opt.stream) {
        if (!opt.root) {
            throw new Error('missing root option');
        } else if (!fs.existsSync(opt.root) || !fs.statSync(opt.root).isDirectory()) {
            throw new Error('root option is not a directory');
        }
    }

    var my = {
        dir: resolve(__dirname + '/../../../'+(opt.mongodumpTempDir||'mongodump-temp'))+"/",
        db:opt.db,
        root: resolve(String(opt.root)) + '/',
        stream: opt.stream || null,
        parser: opt.parser || 'bson',
        callback: typeof opt.callback === 'function' ? opt.callback : null,
        targz: typeof opt.targz === 'string' ? opt.targz : null,
        logger: typeof opt.logger === 'string' ? resolve(opt.logger) : null,
        metadata: Boolean(opt.metadata),
        drop: Boolean(opt.drop),
        dropCollection: opt.dropCollection,
        createCollection: opt.createCollection,
        options: typeof opt.options === 'object' ? opt.options : {}
    };
    if (my.stream) {
        my.targz = true; // override
    }
    return wrapper(my);
}


var routes = function (config) {
    var exp = {};
    exp.restoreDatabase=function(req,res){
        var opt = config.options;
        var data = req.body;
        restore({
            db:req.db,
            root: resolve(__dirname + '/../../../'+(config.options.mongodumpDir||'mongodump')),
            mongodumpTempDir:config.options.mongodumpTempDir||'temp-mongodump',
            targz: data.filename, // restore the file from
            dropCollection:(data.isNewCollection)?undefined:data.collection,
            createCollection:(data.isNewCollection)?data.collection:undefined,
            callback:function(){
                res.status(200).json({
                    database:data.dbname,
                    collection:data.collection,
                    action:'restore',
                    file:resolve(__dirname + '/../../../'+(config.options.mongodumpDir||'mongodump'))+"/"+data.filename,
                    status:"OK"
                });
            }
        });
    };
    return exp;
}
module.exports = routes;
