/*
Issues:
	- Parses strings wrong if they have spaces
	- Parses strings wrong if they have values equal to identifiers
	- How should we handle multi-line input?
*/

let Lisp = {};

Lisp = (function(Lisp) {

	function tokenize(input) {
		// pad parentheses with spaces
		let lpars = input.replace(/\(/g,' ( ');
		let rpars = lpars.replace(/\)/g,' ) ');
		// trim the edges
		let trm = rpars.trim();
		// split on whitespace
		let splt = trm.split(/\s+/);
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
		} else if (token[0]==='"' && token.slice(-1)==='"') {
			return token.slice(1,-1);
		} else {
			return token;
		}
	}

	function context(parent) {
		let ctx = {};
		if (parent===undefined) {
			ctx.specials = {};
			ctx.macros = {};
			ctx.functions = {};
			ctx.scope = {};
		} else {
			ctx.specials = Object.create(parent.specials);
			ctx.macros = Object.create(parent.macros);
			ctx.functions = Object.create(parent.functions);
			ctx.scope = Object.create(parent.scope);
		}
		return ctx;
	}
	
	let core = context();

	function transpile(input, ctx) {
		console.log("transpiling...");
		//console.log(input);
		ctx = ctx || core;
		if (Array.isArray(input)) {
			if (input.length===0) {
				return input;
			}
			let [head, ...tail] = input;
			// special form
			if (head in ctx.specials) {
				//console.log("special form");
				return ctx.scope[head](tail, ctx, transpile);
			// macro identifier
			} else if (head in ctx.macros) {
				//console.log("macro");
				return ctx.scope[head](tail, ctx, transpile);
			} else {
			// process it as a list
				let list = [head, ...tail] = input.map(function(element) {return transpile(element, ctx);});
				return ["(",head,")("].concat(tail.join("\\, \\").split("\\"),")").join("");
			}
		} else {
			return input;
		}
	}

	function interpret(input, ctx) {
		console.log("interpreting...");
		//console.log(input);
		ctx = ctx || core;
		if (Array.isArray(input)) {
			if (input.length===0) {
				return input;
			}
			let [head, ...tail] = input;
			// special form
			if (head in ctx.specials) {
				console.log("special form");
				return ctx.scope[head](tail, ctx);
			// macro identifier
			} else if (head in ctx.macros) {
				console.log("macro");
				return ctx.scope[head](tail, ctx);
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

	function parse(input) {
		let parsed = nest(tokenize(input));
		console.log("parsed:");
		console.log(parsed);
		return parsed;
	};

	function cons(a, b) {
		if (!Array.isArray(b)) {
			throw new Error();
		}
		return [a].concat(b);
	}

	function car(lst) {
		if (!Array.isArray(lst)  ) {
			throw new Error();
		} else if (lst.length===0) {
			throw new Error();
		} else {
			return lst[0];
		}
	}

	function cdr(lst) {
		if (!Array.isArray(lst)  ) {
			throw new Error();
		} else if (lst.length===0) {
			throw new Error();
		} else {
			return lst.slice(1);
		}
	}

	function eq(a, b) {
		return (a===b);
	}

	function lambda([args, body], ctx, method) {
		method = method || interpret;
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
	}

	function cond(clauses, ctx, method) {
		method = method || interpret;
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
	}

	function quote(lst) {

	}
	function atom() {
		// returns true for anything but a non-quoted list
	}

	function add() {
		let acc = 0;
		for (let arg of arguments) {
			acc += arg;
		}
		return acc;
	}

	function println() {
		Lisp.output(...arguments);
		return null;
	}
	
	for (let func of ["cons","car","cdr","eq","cond","lambda","atom","quote","add","println"]) {
		eval("core.scope['" + func + "'] = " + func + ";");
	}
	for (let func of ["cons","car","cdr","eq","add","println"]) {
		eval("core.functions['" + func + "'] = " + func + ";");
	}
	for (let func of ["cond","lambda"]) {
		eval("core.specials['" + func + "'] = " + func + ";");
	}

	core.scope.true = true;
	core.scope.false = false;

	Lisp.core = core.scope;
	console.log("Lisp core:");
	console.log(core);
	Lisp.tokenize = tokenize;
	Lisp.nest = nest; 
	Lisp.parse = parse;
	Lisp.interpret = interpret;
	Lisp.transpile = transpile;
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
	}
	return Lisp;
})(Lisp);