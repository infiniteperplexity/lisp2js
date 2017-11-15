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
		return splt;
	}


	function nest = function(tokens, lst) {
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
			// closed parenthesis ends the list
			} else if (token===")") {
				return lst;
			} else {
				return nest(tokens,lst.concat(atomize(token)));
			}
		}

	}

	function atomize(token) {
		if (!isNaN(parseFloat(input))) {
			return {type: 'literal', value: parseFloat(input)};
		} else if (input[0]==='"' && input.slice(-1)==='"') {
			return {type: 'literal', value: input.slice(1,-1)};
		} else {
			return {type: 'identifier', value: input};
		}
	}

	function Scope(parent) {
		// this is kind of a mess, but I like it better than types
		this.parent = parent || window;
		this.identifiers = {};
		this.specials = {};
		this.macros = {};
		this.functions = {};
		this.values = {};
	}
	let core = new Scope();

	function interpret(list, scope) {
		scope = scope || core;
		let car = ;
		let cdr = scope.cdr(list);
		if (car in core.specials) {
			return specials[car](interpret(cdr));
		} else if (car in macros) {
			return macros[car](interpret(cdr));
		} else if (car in functions) {
			return functions[car](...cdr);
		} else if (car in values) {
			throw new TypeError();
			return null;
		} else {
			throw new ReferenceError();
			return null;
		}
	}

	function parse(input) {
		return nest(tokenize(input));
	}

	core.cons = function(a, b) {
		if (!Array.isArray(b)) {
			throw new Error();
		}
		return [a].concat(b);
	}

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
		} else if (lst.length===1) {
			return [];
		} else {
			return lst.slice(-1);
		}
	}

	core.eq = function(a, b) {
		return (a===b);
	}

	return js;
}
