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

	function parse(input) {
		return nest(tokenize(input));
	}

	function cons(a, b) {

	}










	return js;
}

(defmacro unless (test body) (list 'if (list 'not test) body))