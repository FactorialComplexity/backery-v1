

module.exports = runner;

/**
 * Run through the sequence of functions
 *
 * @param  {Function} next
 * @public
 */
function runner (fns, context, next) {
  var last = fns.length - 1;

  (function run(pos) {
    fns[pos].call(context, function (err, obj) {
      if (next){
        if (err || pos === last) return next(err, obj, context.grantType);
    }else{
        if (err || pos === last) return true;
    }
      run(++pos);
    });
  })(0);
}
