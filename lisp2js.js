function lisp2js(lisp) {
	let js = "";

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

	function scope(parent) {
		let o = {};
		parent = parent || window;
		if (parent===window) {
			o.specials = {};
			o.macros = {};
			o.functions = {};
			o.identifiers = {};	
		} else {
			o.specials = Object.create(parent.specials);
			o.macros = Object.create(parent.macros);
			o.functions = Object.create(parent.functions);
			o.identifiers = Object.create(parent.identifiers);
		}
		return o;
	}
	let core = scope();

	function transpile(lst, scp) {
		console.log("interpreting...");
		console.log(lst);
		scp = scp || core;
		let car = core.car(lst);
		let cdr = core.cdr(lst);
		if (Array.isArray(car)) {
			// this is surely wrong.
			return interpret(car, scp);
		} else if (car in scp.specials) {
			return scp[car](interpret(cdr, scp));
		} else if (car in scp.macros) {
			return scp[car](interpret(cdr, scp));
		} else if (car in scp.functions) {
			let rslt = [car,"("].concat(cdr.join("\\, \\").split("\\"),")").join("");
			console.log(rslt);
			return rslt;
		} else if (car in scp.identifiers) {
			throw new TypeError();
			return null;
		} else {
			throw new ReferenceError();
			return null;
		}
	}

	function interpret(lst, scp) {
		console.log("interpreting...");
		console.log(lst);
		scp = scp || core;
		let car = core.car(lst);
		let cdr = core.cdr(lst);
		if (Array.isArray(car)) {
			// this is surely wrong.
			return interpret(car, scp);
		} else if (car in scp.specials) {
			return scp[car](interpret(cdr, scp));
		} else if (car in scp.macros) {
			return scp[car](interpret(cdr, scp));
		} else if (car in scp.functions) {
			return scp[car](...cdr);
		} else if (car in scp.identifiers) {
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

	core.cons = function(a, b) {
		if (!Array.isArray(b)) {
			throw new Error();
		}
		return [a].concat(b);
	};

	core.car = function(lst) {
		if (!Array.isArray(lst)  ) {
			throw new Error();
		} else if (lst.length===0) {
			throw new Error();
		} else {
			return lst[0];
		}
	}

	core.cdr = function(lst) {
		if (!Array.isArray(lst)  ) {
			throw new Error();
		} else if (lst.length===0) {
			throw new Error();
		} else {
			return lst.slice(1);
		}
	};

	core.eq = function(a, b) {
		return (a===b);
	};


	core.lambda = function([identifier, args, body]) {
		// so...does this get added to the scope automatically?
		return function() {
			// I'm not sure how to get the right scope here...
			let scp = scope(this);
			for (let i=0; i<args.length; i++) {
				scp[args[i]] = arguments[i];
			}
			return interpret(body, scp);
		}
	};
	core.specials.lambda = core.lambda;

	core.cond = function(clauses) {
		for (clause in clauses) {
			if (interpret(clause[0],this)) {
				return interpret(clause[1],this);
			}
		}
		throw new Error();
	};
	core.specials.cond = core.cond;

	core.quote = function(lst) {

	};
	core.atom = function() {
		// returns true for anything but a non-quoted list
	};


	core.add = function() {
		let acc = 0;
		for (let arg of arguments) {
			acc += arg;
		}
		return acc;
	};
	core.functions.add = core.add;

	let parsed = parse(lisp);
	let results = [transpile(parsed), interpret(parsed)];
	return results;
}
