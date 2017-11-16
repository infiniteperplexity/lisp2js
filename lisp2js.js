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

	function transpile(lst, ctx) {
		console.log("interpreting...");
		console.log(lst);
		ctx = ctx || core;
		let head = car(lst);
		let tail = cdr(lst);
		if (Array.isArray(head)) {
			// this is surely wrong.
			return interpret(head, ctx);
		} else if (head in ctx.specials) {
			return ctx[head](interpret(tail, ctx));
		} else if (head in ctx.macros) {
			return ctx[head](interpret(tail, ctx));
		} else if (head in ctx.functions) {
			let rslt = [head,"("].concat(tail.join("\\, \\").split("\\"),")").join("");
			console.log(rslt);
			return rslt;
		} else if (head in ctx.scope) {
			throw new TypeError();
			return null;
		} else {
			throw new ReferenceError();
			return null;
		}
	}

	function interpret(lst, ctx) {
		console.log("interpreting...");
		console.log(lst);
		ctx = ctx || core;
		let head = car(lst);
		let tail = cdr(lst);
		if (Array.isArray(car)) {
			// this is surely wrong.
			return interpret(head, ctx);
		} else if (head in ctx.specials) {
			return ctx.scope[head](interpret(tail, ctx));
		} else if (head in ctx.macros) {
			return ctx.scope[head](interpret(tail, ctx));
		} else if (head in ctx.functions) {
			return ctx.scope[head](...tail);
		} else if (head in ctx.scope) {
			throw new TypeError();
			return null;
		} else {
			throw new ReferenceError();
			return null;
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
	};

	function eq(a, b) {
		return (a===b);
	};


	function lambda([identifier, args, body]) {
		// so...does this get added to the scope automatically?
		return function() {
			// I'm not sure how to get the right scope here...
			let ctx = context(this);
			for (let i=0; i<args.length; i++) {
				ctx.scope[args[i]] = arguments[i];
			}
			return interpret(body, ctx);
		}
	};

	function cond(clauses) {
		for (clause in clauses) {
			if (interpret(clause[0],this)) {
				return interpret(clause[1],this);
			}
		}
		throw new Error();
	};

	function quote(lst) {

	};
	function atom() {
		// returns true for anything but a non-quoted list
	};

	function add() {
		let acc = 0;
		for (let arg of arguments) {
			acc += arg;
		}
		return acc;
	};
	
	for (let func of ["cons","car","cdr","eq","cond","lambda","atom","quote","add"]) {
		eval("core.scope['" + func + "'] = " + func + ";");
	}
	for (let func of ["cons","car","cdr","eq","add"]) {
		eval("core.functions['" + func + "'] = " + func + ";");
	}

	Lisp.core = core.scope;
	console.log("Lisp core:");
	console.log(core);
	Lisp.tokenize = tokenize;
	Lisp.nest = nest; 
	Lisp.parse = parse;
	Lisp.interpret = interpret;
	Lisp.transpile = transpile;
	return Lisp;
})(Lisp);
