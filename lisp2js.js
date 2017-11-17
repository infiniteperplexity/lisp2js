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
			return nest(tokens,[]);
		} else {
			let token = tokens.shift();
			// I'm not clear what this does
			if (token===undefined) {
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
				console.log("special form");
				return ctx.scope[head](tail, ctx, interpret);
			// macro identifier
			} else if (head in ctx.macros) {
				console.log("macro");
				return ctx.scope[head](tail, ctx, interpret);
			} else {
			// process it as a list
				let list = input.map(function(element) {return interpret(element, ctx);});
				[head, ...tail] = list;
				if (head instanceof Function) {
					console.log("anonymous function");
					return head(...tail);
				} else if (head in ctx.functions) {
					console.log("named function");
					return ctx.functions[head](...tail);
				} else if  (!(Array.isArray(head)) && tail.length>0) {
					console.log("non-standard value " + head + " at head of list");
				} else {
					console.log("recursing...");
					return list;
				}
			}
		} else {
			if (ctx.scope.hasOwnProperty(input)) {
				console.log("named value");
				return ctx.scope[input];
			} else {
				console.log("primitive value");
				return input;
			}
		}
	}

	function transpile(input, ctx) {
		console.log("transpiling...");
		//console.log(input);
		ctx = ctx || core;
		if (Array.isArray(input)) {
			if (input.length===0) {
				return input;
			}
			let [head, ...tail] = input;
			head = (head in ctx.operators) ? ctx.operators[head] : head;
			// special form
			if (head in ctx.specials) {
				//console.log("special form");
				return ctx.scope[head](tail, ctx, transpile);
			// macro identifier
			} else if (head in ctx.macros) {
				//console.log("macro");
				return ctx.scope[head](tail, ctx, transpile);
			} else if (input.length>1) {
			// process it as a list
				let list = [head, ...tail] = input.map(function(element) {return transpile(element, ctx);});
				head = (head in ctx.operators) ? ctx.operators[head] : head;
				return ["(",head,")("].concat(tail.join(SPACER+", "+SPACER).split(SPACER),")").join("");
			} else {
				return head;
			}
		} else {
			return input;
		}
	}

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

	core.specials.lambda = function([args, body], ctx, method) {
		method = method || interpret || transpile;
		return (method===interpret) ?
			(function() {
				let cont = context(ctx);
				Array.prototype.map.call(arguments,function(_,i) {
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

	core.specials.quote = function(lst, ctx, method) {
		method = method || interpet || transpile;
		[lst] = lst;
		return (method===interpret) ? lst : `[${lst.join(",")}]`;
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


	 {

	}

	core.specials.let = function(lst, ctx, method) {
		method = method || interpet || transpile;
		let [bindings, ...tail] = lst;
		let cont = context(ctx);
		if (method===interpret) {
			// Y-combinator for anonymous recursion
			core.functions.Y(f => function([key, val, ...rest]) {
				cont.scope[key] = interpret(val, ctx);
				if (rest.length>0) {
					f(...rest);
				}
			})(bindings);
			return interpret(tail, cont);
		} else {
			let txt = `(function() {
				${bindings.reduce((acc,val,i,arr) => {
					if (i%2===0) {
						acc.push(`	let ${val}=${transpile(arr[i+1],ctx)};`);	
					}
					return acc;
				},[]).join("\n")}
				${tail.map(
					(e,i,a) => (i===a.length-1) ? "	return " + transpile(e, ctx) : "")
				}})();`;
			console.log(txt);
			return txt;
		}
	}
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