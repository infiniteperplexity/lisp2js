function macroexpand (expr, env) { // much like CLtL's macroexpand

    env  = env || global_macros;

    var count = 0;

    var me_1 = function (expr) { // me_1 is like CLtL's macroexpand-1

      if (expr && expr.constructor == Cons) {

        var macro = table_get(env, expr.car);

        if (macro) {

          count++;

          var args = mapcar2arr(me_1, expr.cdr);

          return macro.apply(null, args);

        }

        return mapcar(me_1, expr);

      }

      return expr;

    };

    while (true) {

      expr = me_1(expr);

      if (count == 0)  break;

      count = 0;

    }

    return expr;

  }
