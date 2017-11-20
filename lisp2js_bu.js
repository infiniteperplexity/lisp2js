/*
Issues:
	- Not sure if it parses strings correctly in general
	- Can't handle special whitespace in quoted strings
	- How should we handle multi-line input?
	- The final JS output shows the full text of any unevaluated functions
	- Can't figure out a way to handle the return value of "def" in the transpiler

Features:
	- anything else used in the chapter
	- reader macros?
*/

let Lisp = {};

Lisp = (function(Lisp) {

	// **************** Lexxing and Parsing ******************** //
	let SPACER = "\u0000";
	let SREGEX = new RegExp(SPACER,"g");
	function tokenize(input) {
		//let flag quoted strings	
		let quotes = input.replace(/\"/g,SPACER);
		let qts = quotes.split(SPACER);
		for (let i=0; i<qts.length; i++) {
			if (i%2===1) {
				// swap whitespace in quotes strings
				qts[i] = qts[i].replace(/\s/g,SPACER);			
			}
		}
		let replaced = qts.join('"');
		// pad parentheses with spaces
		let lpars = replaced.replace(/\(/g," ( ");
		let rpars = lpars.replace(/\)/g," ) ");
		// trim the edges
		let trm = rpars.trim();
		// split on whitespace
		let splt = trm.split(/\s+/);
		for (let i=0; i<splt.length; i++) {
			// reinsert whitespace in quoted strings
			splt[i] = splt[i].replace(SREGEX," ");
		}
		console.log("tokenized:");
		console.log(splt);
		return splt;	
	}

	function nest(tokens, lst) {
		// begin accumulating a list
		if (lst===undefined) {
			console.log("building new list");
			return nest(tokens,[]);
		} else {
			let token = tokens.shift();
			// finish reading input
			if (token===undefined) {
				//this returns only the last list, so you have to use progn
				// eventually want to wrap with an implicit progn
				return lst.pop();
			// open parenthesis begins a new list
			} else if (token==="(") {
				lst.push(nest(tokens,[]));
				return nest(tokens, lst);
			// closed parenthesis ends the list
			} else if (token===")") {
				return lst;
			} else {
				return nest(tokens,lst.concat(atomize(token)));
			}
		}
	}

	function atomize(token) {
		if (!isNaN(parseFloat(token))) {
			return parseFloat(token);
		//// Is this line actually needed?
		//} else if (token[0]==='"' && token.slice(-1)==='"') {
		//	return token.slice(1,-1);
		} else {
			return token;
		}
	}

	function parse(input) {
		let parsed = nest(tokenize(input));
		console.log("parsed:");
		console.log(parsed);
		return parsed;
	}


	// ******************** Interpreting and Transpiling ***************** //
	function interpret(input, ctx) {
		console.log("interpreting...");
		console.log(input);
		ctx = ctx || core;
		if (Array.isArray(input)) {
			if (input.length===0) {
				return input;
			}
			let [head, ...tail] = input;
			// special form
			if (head in ctx.specials) {
				//console.log("special form");
				return ctx.scope[head](tail, ctx, interpret);
			// macro identifier
			} else if (head in ctx.macros) {
				//console.log("macro");
				return ctx.scope[head](tail, ctx, interpret);
			} else {
			// process it as a list
				let list = input.map(function(element) {return interpret(element, ctx);});
				[head, ...tail] = list;
				if (head instanceof Function) {
					//console.log("anonymous function");
					return head(...tail);
				} else if (head in ctx.functions) {
					//console.log("named function");
					return ctx.functions[head](...tail);
				} else if  (!(Array.isArray(head)) && tail.length>0) {
					console.log("non-standard value " + head + " at head of list");
				} else {
					//console.log("recursing...");
					return list;
				}
			}
		} else {
			if (ctx.scope.hasOwnProperty(input)) {
				//console.log("named value");
				return ctx.scope[input];
			} else {
				//console.log("primitive value");
				return input;
			}
		}
	}

	function transpile(input, ctx) {
		console.log("transpiling...");
		console.log(input);
		ctx = ctx || core;
		if (Array.isArray(input)) {
			if (input.length===0) {
				console.log("empty array");
				return input;
			}
			let [head, ...tail] = input;
			head = (head in ctx.operators) ? ctx.operators[head] : head;
			// special form
			if (head in ctx.specials) {
				console.log("special form");
				return ctx.scope[head](tail, ctx, transpile);
			// macro identifier
			} else if (head in ctx.macros) {
				console.log("macro");
				return ctx.scope[head](tail, ctx, transpile);
			} else if (input.length>1) {
			// process it as a list
				console.log("as list");
				let list = [head, ...tail] = input.map(function(element) {return transpile(element, ctx);});
				head = (head in ctx.operators) ? ctx.operators[head] : head;
				return ["(",head,")("].concat(tail.join(SPACER+", "+SPACER).split(SPACER),")").join("");
			} else {
				// I don't think this is ever correct...
				console.log("head");
				return head;
			}
		} else {
			console.log("thing itself");
			return input;
		}
	}
	//(quote (println 2))

	function context(parent) {
		let ctx = {};
		if (parent===undefined) {
			ctx.specials = {};
			ctx.macros = {};
			ctx.functions = {};
			// operators are not special in Lisp but they are in JS
			ctx.operators = {};
			ctx.scope = {};	
		} else {
			ctx.specials = Object.create(parent.specials);
			ctx.macros = Object.create(parent.macros);
			ctx.functions = Object.create(parent.functions);
			ctx.operators = Object.create(parent.operators);
			ctx.scope = Object.create(parent.scope);
		}
		return ctx;
	}

	let core = context();

	// ************ API ***************** //
	Lisp.core = core.scope;
	Lisp.tokenize = tokenize;
	Lisp.nest = nest; 
	Lisp.parse = parse;
	Lisp.interpret = interpret;
	Lisp.transpile = transpile;
	console.log("Lisp core:");
	console.log(core);

	function output() {
		console.log("Output:");
		console.log(...arguments);
		return null;
	}

	Lisp.output = output;

	Lisp.bindOutput = function(func) {
		Lisp.output = function() {
			func(...arguments);
			return output(...arguments);
		}
	};

	core.functions.println = function() {
		Lisp.output(...arguments);
		return null;
	};

	// ******************* Primitives ********************** //

	core.scope.true = true;
	core.scope.false = false;


	// ******************* Special Forms ******************** //

	core.specials.progn = function(args, ctx, method) {
		method = method || interpret || transpile;
		let [head, ...rest] = args;
		if (method===interpret) {
			if (rest.length===0) {
				return interpret(head, ctx);
			} else {
				interpret(head);
				return progn(rest, ctx, interpret);
				
			}
		} else {
			if (rest.length===0) {
				return transpile(head, ctx);
			} else {
				return transpile(head, ctx)+";\n"+progn(rest, ctx, transpile);
			}
		}
	};

	core.specials.lambda = function([args, body], ctx, method) {
		method = method || interpret || transpile;
		return (method===interpret) ?
			(function() {
				let cont = context(ctx);
				Array.prototype.map.call(arguments,function(_,i) {
					// should this interpret?
					cont.scope[args[i]]=arguments[i];
				});
				return interpret(body, cont);
			}) :
			`(function(${args.map(arg => transpile(arg, ctx)).join(",")}) {
				return ${transpile(body,ctx)};})`;
	};

	core.specials.cond = function(clauses, ctx, method) {
		method = method || interpret || transpile;
		let err = "You can't handle the truth!";
		if (clauses.length===0) {
			return (method===interpret) ? (new Error(err)) : `(new Error("${err}"))`;
		} else {
			let [[head, tail], ...rest] = clauses;
			if (method===interpret) {
				return interpret(head, ctx) ?
					interpret(tail, ctx) :
					cond(rest, ctx, method);
			} else {
				return `((${transpile(head, ctx)}) ?
					${transpile(tail, ctx)} :
					${cond(rest, ctx, method)})`
				;
			}
		}
	};

	core.specials.if = function(lst, ctx, method) {
		method = method || interpret || transpile;
		let [test, body, fallback] = lst;
		return (method===interpret) ?
			(interpret(test, ctx)) ?
				interpret(body, ctx) :
				interpret(fallback, ctx) :
			`((${transpile(test, ctx)}) ?
				${transpile(body, ctx)} :
				${transpile(fallback, ctx)})`;
	};

	function rquotify(lst) {
		if (Array.isArray(lst)) {
			return "["+lst.map(rquotify)+"]";
		} else if (typeof(lst)==="string") {
			return '"'+lst+'"';
		} else {
			return lst;
		}
	}
	core.specials.quote = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let first = [lst[0]];
		// two issues...
		// first, we need to wrap the transpiled stuff in ()
		// second...do we need to recursively add ""?  Yes we do.
		first = (method===transpile && Array.isArray(first)) ? [first] : first;
		return (method===interpret) ? first : rquotify(first);
	};

	core.specials.and = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let [head, ...tail] = lst;
		return (method===interpret) ?
			(!head) ?
				false :
				(tail.length===0) ?
					head :
					core.specials.and(tail, ctx, interpret) :
			"("+lst.map(function(e) {return transpile(e,ctx);}).join("&&")+")"
		;
	};

	core.specials.or = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let [head, ...tail] = lst;
		return (method===interpret) ?
			(!head) ?
				false :
				(tail.length===0) ?
					head :
					core.specials.and(tail, ctx, interpret) :
			"("+lst.map(function(e) {return transpile(e,ctx);}).join("||")+")"
		;
	};

	core.specials.def = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let [name, val] = lst;
		if (method===interpret) {
			ctx.scope[name] = interpret(val, ctx);
			// huh...if it's a function, I could test that and add it to functions...
			// ...but that seems like the wrong approach...
			return name;
		} else {
			// oh dear...can the return value translate?
			return `let ${name} = ${transpile(val, ctx)}`;
		}
	};


	core.specials.let = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let [bindings, ...tail] = lst;
		let cont = context(ctx);
		if (method===interpret) {
			for (let i=0; i<bindings.length; i+=2) {
				cont.scope[bindings[i]] = interpret(bindings[i+1], ctx);
			}
			return interpret(tail, cont);
		} else {
			return (`(function() {
				${bindings.reduce((acc,val,i,arr) => {
					if (i%2===0) {
						acc.push(`	let ${val}=${transpile(arr[i+1],ctx)};`);	
					}
					return acc;
				},[]).join("\n")}
				${tail.map(
					(e,i,a) => (i===a.length-1) ? "	return " + transpile(e, ctx) : "")
				}})();`);
		}
	}

	//(progn (defmacro twoify (v) (list (quote def) v 2)) (twoify foo) (foo))
	// core.macros.falsify = function(lst, ctx, method) {
	// 	interpret([def, lst[0], false]);
	// this feels like it's getting close, but it's slightly off...
	// is it possible that it's just quote that doesn't work right?
	// a macro is a lisp function that returns expressions
	core.specials.defmacro = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let [name, args, ...body] = lst;
		// args are the arguments specified in defmacro
		let cont = context(ctx);
		if (method===interpret) {
			ctx.macros[name] = ctx.scope[name] = function() {
				let [margs, mctx, mmethod] = arguments;
				Array.prototype.map.call(margs, function(_,i) {
					cont.scope[args[i]] = margs[i];
				});
				// this is (list (quote def) v 2);
				// console.log(body);
				// it should be (def foo 2)
				// this is (((quote def) foo 2))
				console.log(interpret(body, cont));
				return interpret(body, cont);
			}
		} else {
		// hold on...do we actually need a "transpile" version of this guy?
			console.log("lookie here!");
			console.log(transpile(transpile(body, cont), cont));
		}
	};
	// `(function(${args.map(arg => transpile(arg, ctx)).join(",")}) {
	// 			return ${transpile(body,ctx)};})`;
	// };


	// so...can I answer coherently why "(list + 1 1)" returns (<function> 1 1)?
	// actually maybe I can...is it because lists passed as arguments aren't interpreted, but items are?
	// '(a b c) = (list 'a 'b 'c)
	// ,@ is a horrible visual design choice, but it strips a layer of parentheses, and it tends to be used
		// for macros that take a variable number of arguments
	// Paul Graham has convinced me that syntax quoting is good.
	// "whenever you find a parenthesis that isn't part of an argument in the macro call..."
	// while (test &body body) confuses me a bit.  What's the last "body"?
	// should I look up "inline" on page 26, from page 102?
	// what is progn?  I think it's "do"
	// Macros typically do one of four things...
		// Transformation - I don't quite get this...
		// Binding - This one I get.
		// Conditional evalution.
		// Multiple evaluation (loops)
	// Plus several more that apparently didn't count...
		// Using the calling environment, which you usually don't want to do.
		// Wrapping a new environment
		// Inlining
	// Macros can't be passed as arguments, so there's a new layer of abstraction you can't do
	
	// *********** Core Functions ************************ //

	core.functions.cons = function(a, b) {
		if (!Array.isArray(b)) {
			console.log(lst);
			throw new TypeError("cons used on non-list");
		}
		return [a].concat(b);
	};

	core.functions.car = function(lst) {
		if (!Array.isArray(lst)  ) {
			console.log(lst);
			throw new TypeError("car used on non-list");
		} else if (lst.length===0) {
			throw new Error("car used on empty list");
		} else {
			return lst[0];
		}
	};

	core.functions.cdr = function(lst) {
		if (!Array.isArray(lst)  ) {
			console.log(lst);
			throw new TypeError("cdr used on non-list");
		} else if (lst.length===0) {
			throw new Error("cdr used on empty list");
		} else {
			return lst.slice(1);
		}
	};

	core.functions.list = function() {
		return Array.from(arguments);
	};

	core.functions.atom = function(a) {
		return Array.isArray(a);
	};

	core.functions.eq = function(a, b) {
		return (a===b);
	};

	core.functions.not = function(a) {
		return !a;
	};

	core.functions.Y = f => (x => x(x))(x => f(y => x(x)(y)));


	// *********************** Operators ******************************* //

	let mathematical = {
		_PLUS_ : "+",
		_MINUS_ : "-",
		_MULTIPLY_ : "*",
		_DIVISION_ : "/",
		_MODULUS_ : "%"
	};
	for (let op in mathematical) {
		let ops = mathematical;
		let oper = function() {
			let args = Array.from(arguments);
			let last = args.pop();
			if (args.length===0) {
				return last;
			} else {
				return(eval("oper(...args)"+ops[op]+"last;"));
			}
		}
		core.functions[op] = oper;
		core.operators[ops[op]] = op;
	}

	let comparison = {
		_EQ_ : "==",
		_SEQ_ : "===",
		_NEQ_ : "!=",
		_NSEQ_ : "!==",
		_GT_ : ">",
		_GE_ : ">=",
		_LT_ : "<",
		_LE_ : "<="
	};
	// It's debatable whether != and !== should chain in this way.
	for (let op in comparison) {
		let ops = comparison;
		let oper = function() {
			let [head, ...tail] = Array.from(arguments);
			if (tail.length===0) {
				return true;
			} else {
				return eval("(head"+ops[op]+"tail[0]) && oper(...tail);")
			}
		}
		core.functions[op] = oper;
		core.operators[ops[op]] = op;
	}

	// functions defined with ordinary names
	let others = {
		eq : "=",
		and : "&&",
		or : "||",
		not : "!",
		inc: "++",
		dec: "--"
	};

	for (let op in others) {
		let ops = others;
		core.operators[ops[op]] = op;
	}

	// JS operators not used in this implementation
	let unused = [
		"=",
		"+=",
		"-=",
		"*=",
		"/=",
		"%=",
		"&",
		"|",
		"~",
		"^",
		"<<",
		">>"
	];

	// ********************** Populate core namespace ***************** //
	for (let s of ["specials","macros","functions"]) {
		for (let form in core[s]) {
			core.scope[form] = core[s][form];
		}
	}
	for (let operator in core.operators) {
		//core.scope[operator] = core.operators[operator];
		for (let s of ["specials","macros","functions"]) {
			if (core.operators[operator] in core[s]) {
				core.scope[operator] = core[s][operator] = core[s][core.operators[operator]];
			}
		}
	}

	return Lisp;
})(Lisp);

//(defmacro falsify (v) (list (quote def) v false))

// function macroexpand (expr, env) { // much like CLtL's macroexpand

//     env  = env || global_macros;

//     var count = 0;

//     var me_1 = function (expr) { // me_1 is like CLtL's macroexpand-1

//       if (expr && expr.constructor == Cons) {

//         var macro = table_get(env, expr.car);

//         if (macro) {

//           count++;

//           var args = mapcar2arr(me_1, expr.cdr);

//           return macro.apply(null, args);

//         }

//         return mapcar(me_1, expr);

//       }

//       return expr;

//     };

//     while (true) {

//       expr = me_1(expr);

//       if (count == 0)  break;

//       count = 0;

//     }

//     return expr;

//   }


  // specials.defmacro = function (expr, env) {

  //   env = env || global_macros;

  //   var def = "env[\"" + expr.car + "\"] = " + specials.lambda(expr.cdr);

  //   eval(def); // macros are installed eagerly, to give other forms a chance to see them

  //   return "\"" + expr.car + "\"";

  // };



  // var gensym = function () { // mainly used in macro definitions that introduce bindings

  //   var roots = {"G$$": 0}; //

  //   return function (nm) {

  //     nm = nm || "G$$";

  //     var count = roots[nm];

  //     if (count) roots[nm] = count+1;

  //     else { roots[nm] = 1; count = 0; }

  //     return new String("" + nm + count);

  //   };

  // }();