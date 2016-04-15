'use strict';

/**
 * option setting
 *
 * @function restore
 * @param {Object} options - various options. Check README.md
 */
function copyCollection(srcDb,targetDb,collectionName,cb){
    srcDb.collection(collectionName, function(err1, sourceCollection) {
        if (err1) {
            console.error("error opening source collection");
            cb(err1);
        }
        else {
            targetDb.collection(collectionName, function(err2, targetCollection) {
                if (err2) {
                    console.error("error opening target collection");
                    cb(err2);
                }
                else {
                    // Note: if this fails it's because I was lazy and used toArray
                    // try .each() and insert one doc at a time? (do a count() first so you know it's done)
                    sourceCollection.find().toArray(function(err3, results) {
                        if (err3) {
                            console.error("error finding source results");
                            cb(err3);
                        }
                        else {
                            targetCollection.insert(results, { safe: true }, function(err4, docs) {
                                if (err4) {
                                    console.error("error inserting target results");
                                    cb(err4);
                                }
                                else {
                                    cb(null, docs.length + " docs inserted");
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

function clonedb(options) {
    var opt = options || Object.create(null);
    if (!opt.sourcedb) {
        throw new Error('missing source db option');
    }
    if (!opt.clonedDbname) {
        throw new Error('missing cloned db name option');
    }
    var sourcedb=opt.sourcedb;
    //create cloned db
    var clonedDb = opt.maindb.db(opt.clonedDbname);
    var collSize,srcCollection;
    sourcedb.listCollections().toArray(function(err, collections) {
        // console.log("collection:"+collections);
        // collections.forEach(function(collection){
        //     console.log("collection:"+collection);
        //     clonedDb.createCollection(collection.name, function(err, targetCollection) {
        //             copyCollection(sourcedb,clonedDb,collection.name,function(){
        //             });
        //     });
        // })
        function go(){
            if (collections.length){
                srcCollection=collections.shift();
                clonedDb.createCollection(srcCollection.name, function(err, targetCollection) {
                        copyCollection(sourcedb,clonedDb,srcCollection.name,function(err){
                            if (err){
                                console.log("error when copyCollection:"+err);
                                return;
                            }
                            go();
                        });
                });
            }
        }
        go();
    });

    return opt.callback();
}


var routes = function (config) {
    var exp = {};
    exp.cloneDatabase=function(req,res){
        var opt = config.options;
        clonedb({
            maindb:req.mainConn,
            sourcedb:req.db,
            clonedDbname:req.body.clonedDbname,
            callback:function(){
                res.status(200).json({
                    sourcedb:req.db.databaseName,
                    clonedDb:req.body.clonedDbname,
                    action:'clone',
                    status:"OK"
                });
            }
        });

    };
    return exp;
}
module.exports = routes;
