'use strict';

var express     = require('express');
var cons        = require('consolidate');
var swig        = require('swig');
var swigFilters = require('./filters');
var router      = require('./router');

//name should follow: yyyyMMdd-hhmmss-[dbname]-collection[name].tar.gz
function displayBackupFile (name){
  if (name&&name.indexOf(".gz")){
    var nameParser = name.replace(".gz","").split("-");
    var year=nameParser[0].substring(0,4);
    var month=nameParser[0].substring(4,6)
    var date=nameParser[0].substring(6);
    var hour=nameParser[1].substring(0,2);
    var min=nameParser[1].substring(2,4);
    var dbname=nameParser[2];
    var date = new Date(month+"/"+date+"/"+year+" "+hour+":"+min);
    return date.toLocaleString()+" "+dbname;
  }
  return name;
}

var middleware = function (config) {
  var app = express();

  //Set up swig
  app.engine('html', cons.swig);
  Object.keys(swigFilters).forEach(function (name) {
    swig.setFilter(name, swigFilters[name]);
    // swig.setFilter("displayBackupFile", displayBackupFile);
  });

  //App configuration
  app.set('views', __dirname + '/views');
  // app.set('view cache', false);
  app.set('view engine', 'html');
  app.set('view options', { layout: false });

  app.use('/', router(config));

  return app;
};

module.exports = middleware;
