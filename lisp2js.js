/*
Issues:
- Can't figure out a way to handle the return value of "def" in the transpiler
x = eval("let y = 7; y;") doesn't work
x = eval("var y = 7; y;") works but works wrong in macros


Here is an example context-free grammar that describes all two-letter strings containing the letters α {\displaystyle \alpha } \alpha and β {\displaystyle \beta } \beta .

S   →   A A

A   →   α

A   →   β

So I think the AST in this case is just...Lisp code.
So the output specification is, like, done.

What are my proposed rules?
- infixing: 
	If there are any operators in a list, that list is transpiled from infix to prefix.
- functions outside parentheses.
	If a name or primitive is immediately followed by a list - no white space between
		then we replace that pair with a list with the value inside.
- line break grouping.
	This is a tough one, and perhaps poorly defined...hmmm...ideas?
		- {...} maps to (do ...)?
		- ...; maps to (...)?

- control structure macros...also a tough one...yeah this may be a deal-breaker...
	value (...) {___} maps to (value (...) (___))


	do {} while ()
	while () {}
	with () {}

	if () {} else {} else {} else {}

	try {} catch () {}

	for () {}

	I don't see a way to map try/catch or do/while

	so...how about...

	A (1) {2} B {3} C {4} maps to (A (1) (2) (B 3) (C 4))

	is there a way to omit the parentheses?

	A 1 {2} B {3} C {4} maps to (A (1) (2) (B 3) (C 4))

	is this compatible with also using {} for dicts?

	a = {A:1} would map to (a (=) {A:1})...although = is an operator...
	...so I guess it maps to (= (a) {A:1}) which is better...but the problem is that's going to set things to the result of the block.
	So here's an idea...{: a:1, b:2, c:3}...let's see if we can avoid that.
	so...does {} always return a namespace?
	(defn a (args) (stuff))
	make : an operator and if that's the first operator in {}?  Not so good...actually, commonly violated.
	...what about using "tables" fron Lua?  [] and stuff...




	(A, B, C) maps to (A B C)
	(A B C) maps to (B A C)
	x = 5 + 3 - 1 -> (= x (+ 5 (- 3 1)))
	egh...need to know operator precedence...
	...so we need to have built-in operators, with precedence assigned to symbols.  This seems acceptable,
	so long as there are lots of them.

	wait...(! A) maps to (A !)...no good.  So...a detailed set of rules that lets the operators rearrange themselves.

	A
	B
	C
	maps to A B C
*/

let Lisp = {};

Lisp = (function(Lisp) {

	let DEBUG = true;
	//let DEBUG = false;

	function debug() {
		if (DEBUG) {
			console.log(...arguments);
		}
	}

	// **************** Lexxing and Parsing ******************** //

	// must begin with letter, _, or $
	// _ and $ are allowed and have no special meanings
	// digits are allowed but not at the beginning
	let lispLexTable ={
		NULL: {
			match: null,
			next: ["NAME1", "NUMBER", "DOT", "QUOTE", "SYMBOL", "BRACE"],
			end: ["WHITE"]
		},
		WHITE: {
			match: /\s/,
			next: ["NAME1", "NUMBER", "DOT", "QUOTE", "SYMBOL", "BRACE"],
			end: ["WHITE"]
		},
		NUMBER: {
			match: /[0-9]/,
			append: ["NUMBER", "DOT"],
			next: ["BRACE"],
			end: ["WHITE"]
		},
		DECIMAL: {
			match: /[0-9]/,
			append: ["DECIMAL"],
			next: ["BRACE"],
			end: ["WHITE"]
		},
		NAME1: {
			match: /[A-Za-z$_]/,
			append: ["NAME"],
			next: ["BRACE"],
			end: ["WHITE"]
		},
		NAME: {
			match: /[A-Za-z0-9_]/,
			append: ["NAME"],
			next: ["BRACE"],
			end: ["WHITE"]
		},
		DOT: {
			match: /\./,
			append: ["DECIMAL"],
			next: ["BRACE"],
			end: ["WHITE"]
		},
		SYMBOL: {
			match: /[\+\*\/-\|&,]/,
			append: ["SYMBOL"],
			next: ["BRACE"],
			end: ["WHITE"]
		},
		BRACE: {
			match: /[()\[\]\{\}]/,
			next: ["BRACE","NAME1","NUMBER","SYMBOL"],
			end: ["WHITE"]
		},
		QUOTE: {
			match: /"/,
			append: ["STRING"],
			close: ["QUOTE"]
		},
		STRING: {
			match: /[^"]/,
			append: ["STRING"],
			close: ["QUOTE"]
		}
	};


	let anotherLexTable = {
		NULL: {
			match: null,
			next: ["NAME1", "NUMBER", "DOT", "QUOTE", "SYMBOL", "BRACE","NEWLINE"],
			end: ["WHITE"]
		},
		NEWLINE: {
			match: /[\n,;]/,
			next: ["NAME1", "NUMBER", "DOT", "QUOTE", "SYMBOL", "BRACE","NEWLINE"],
			end: ["WHITE"]
		},
		WHITE: {
			match: /\s/,
			next: ["NAME1", "NUMBER", "DOT", "QUOTE", "SYMBOL", "BRACE","NEWLINE"],
			end: ["WHITE"]
		},
		NUMBER: {
			match: /[0-9]/,
			append: ["NUMBER", "DOT"],
			next: ["BRACE","NEWLINE"],
			end: ["WHITE"]
		},
		DECIMAL: {
			match: /[0-9]/,
			append: ["DECIMAL"],
			next: ["BRACE","NEWLINE"],
			end: ["WHITE"]
		},
		NAME1: {
			match: /[A-Za-z$_]/,
			append: ["NAME", "OPEN"],
			next: ["BRACE","NEWLINE","SYMBOL","DOT"],
			end: ["WHITE"]
		},
		NAME: {
			match: /[A-Za-z0-9_]/,
			append: ["NAME","OPEN"],
			next: ["BRACE","SYMBOL","NEWLINE","DOT"],
			end: ["WHITE"]
		},
		DOT: {
			match: /\./,
			append: ["DECIMAL"],
			next: ["BRACE","NEWLINE","NAME1","SYMBOL"],
			end: ["WHITE"]
		},
		SYMBOL: {
			match: /[\+\*\/\-\=\>\<\&\|\,\!]/,
			append: ["SYMBOL"],
			next: ["BRACE","NEWLINE","NUMBER","NAME1"],
			end: ["WHITE"]
		},
		OPEN: {
			match: /[(\[\{]/,
			next: ["BRACE","NAME1","NUMBER","SYMBOL","NEWLINE","QUOTE"],
			end: ["WHITE"]
		},
		BRACE: {
			match: /[()\[\]\{\}]/,
			next: ["BRACE","NAME1","NUMBER","SYMBOL","NEWLINE","QUOTE"],
			end: ["WHITE"]
		},
		QUOTE: {
			match: /"/,
			append: ["STRING"],
			close: ["QUOTE"]
		},
		STRING: {
			match: /[^"]/,
			append: ["STRING"],
			close: ["QUOTE"]
		},
		SLASH: {
			match: /\//,
			append: ["SLASH2","ASTERISK"]
		},
		SLASH2: {
			match: /\//,
			append: ["COMMENT"],
			end: ["NEWLINE"]
		},
		COMMENT: {
			match: /[^[\n];]/,
			append: ["COMMENT"],
			end: ["NEWLINE"]
		},
		ASTERISK: {
			match: /\*/,
			append: ["ASTERISK2","BLOCKC"]
		},
		ASTERISK2: {
			match: /\*/,
			append: ["SLASH3","ASTERISK2","BLOCKC"]
		},
		SLASH3: {
			match: /\//,
			next: ["NAME1", "NUMBER", "DOT", "QUOTE", "SYMBOL", "BRACE","NEWLINE"],
			end: ["WHITE"]
		},
		BLOCKC: {
			match: [/^\*/],
			append: ["BLOCKC","ASTERISK2"],
		}
	};
	function lex(input, table) {
		table = table || lispLexTable;
		let tokens = [];
		let token = [];
		let state = "NULL";
		let operations = {
			// finish this token and begin the next one
			next: function(char, s) {
				if (token.length>0) {
					tokens.push(token.join(""));
				}
				token = [char];
				state = s;
			},
			// this doesn't provide a good way to ignore comments
			ignore: function(char, s) {
				// ignore the character
				token = [];
				state = s;
			},
			append: function(char, s) {
				// continue building this token
				token.push(char);
				state = s;
			},
			close: function(char, s) {
				// finish this token and revert to NULL
				token.push(char);
				if (token.length>0) {
					tokens.push(token.join(""));
				}
				token = [];
				state = "NULL";
			},
			end: function(char, s) {
				// finish this token and revert to NULL
				if (token.length>0) {
					tokens.push(token.join(""));
				}
				token = [];
				state = "NULL";
			}
		};

		let loop = function(input, i) {
			if (i>=input.length) {
				operations.next("",state);
				return tokens;
			}
			let char = input[i];
			let pattern = table[state];
			for (let func in pattern) {
				if (func!=="match") {
					for (let match of pattern[func]) {
						if (char.match(table[match].match)) {
							operations[func](char, match);
							return loop(input,i+1);
						} 
					}
				}
			}
			throw new SyntaxError("invalid character '"+char+"' for read state "+state);
		};
		loop(input, 0);
		return tokens;
	}

	let inText =
`let x = 5;
let f = function(x,y) {
	return x + y;
}
let y = f(x,x);
if (y>5) {
	console.log("Hello world!");
} else if (y<0) {
	console.log("Goodbye world!");
} else {
	console.log("Whatever, world.");
}`;
/*


*/


/*

[
  [
    "let",
    "x",
    "=",
    5
  ],
  [],
  "let",
  "f",
  "=",
  [
    [
      "function",
      "x"
    ],
    [
      "y"
    ],
    [
      [
        [
          [],
          [
            "return",
            "x",
            "+",
            "y"
          ]
        ],
        []
      ],
      [
        "let",
        "y",
        "=",
        [
          [
            "f",
            "x"
          ],
          [
            "x"
          ],
          "if",
          [
            "y",
            ">",
            5
          ],
          [
            [
              [],
              [
                "console",
                ".",
                [
                  "log",
                  "\"Hello world!\""
                ]
              ]
            ],
            [],
            "else",
            "if",
            [
              "y",
              "<",
              0
            ],
            [
              [
                [],
                [
                  "console",
                  ".",
                  [
                    "log",
                    "\"Goodbye world!\""
                  ]
                ]
              ],
              [],
              "else",
              [
                [
                  [],
                  [
                    "console",
                    ".",
                    [
                      "log",
                      "\"Whatever, world.\""
                    ]
                  ]
                ],
                []
              ]
            ]
          ]
        ]
      ]
    ]
  ]
]

*/
	let lexed = lex(inText,anotherLexTable);
	console.log(lexed);

	Lisp.lex = lex;
	let SPACER = "\u0000";
	let SREGEX = new RegExp(SPACER,"g");
	// function tokenize(input) {
	// 	//let flag quoted strings	
	// 	let quotes = input.replace(/\"/g,SPACER);
	// 	let qts = quotes.split(SPACER);
	// 	for (let i=0; i<qts.length; i++) {
	// 		if (i%2===1) {
	// 			// swap whitespace in quotes strings
	// 			qts[i] = qts[i].replace(/\s/g,SPACER);			
	// 		}
	// 	}
	// 	let replaced = qts.join('"');
	// 	// pad parentheses with spaces
	// 	let lpars = replaced.replace(/\(/g," ( ");
	// 	let rpars = lpars.replace(/\)/g," ) ");
	// 	// trim the edges
	// 	let trm = rpars.trim();
	// 	// split on whitespace
	// 	let splt = trm.split(/\s+/);
	// 	for (let i=0; i<splt.length; i++) {
	// 		// reinsert whitespace in quoted strings
	// 		splt[i] = splt[i].replace(SREGEX," ");
	// 	}
	// 	debug("tokenized:");
	// 	debug(splt);
	// 	return splt;	
	// }

	function tokenize(input) {
		return lex(input);
	}
	let lst = [];
	lst.__nesting__ = "null";
	console.log(JSON.stringify(newNest(lexed,lst,false),null,"  "));

	function newNest(tokens, lst, nested) {
		if (nested!==false) {
			nested = true;
		}
		// begin accumulating a list
		if (lst===undefined) {
			debug("building new list");
			let sub = [];
			sub.__nesting__ = "null";
			return newNest(tokens,sub);
		} else {
			let token = tokens.shift();
			// finish reading input
			if (token===undefined ) {
				if (nested===true) {
					return lst;
				}
				//this returns only the last list, so you have to use progn
				// eventually want to wrap with an implicit progn
				//return lst.pop();
				if (lst.length===1) {
					return lst[0];
				} else {
					lst.unshift("do");
					return lst;
				}
			// open parenthesis begins a new list
			} else if (["(","[","{"].indexOf(token)!==-1) {
				let sub = [];
				sub.__nesting__ = token;
				lst.push(newNest(tokens, sub));
				return newNest(tokens, lst);
			// function begins new list of arguments
			} else if (token.substring(token.length-1)==="(") {
				let sub = [token.substring(0,token.length-1)];
				sub.__nesting__ = "f(";
				lst.push(newNest(tokens, sub));
				return newNest(tokens, lst);
			} else if (token===",") {
				if (["(","[","f("].indexOf(lst.__nesting__)!==-1) {
					// the first comma in each list
					let prev = [];
					prev.__nesting__ = ",";
					while (lst.length>0) {
						prev.push(lst.shift());
					}
					lst.push(prev)
					let sub = [];
					sub.__nesting__ = ",";
					lst.push(newNest(tokens, sub));
					return newNest(tokens, lst);
				} else if (lst.__nesting__===",") {
					// check for infix?
					return lst;
					// close up current and move to next
				} else {
					throw new Error("Shouldn't find a comma here.");
				}
			} else if (token==="\n" || token===";") {
				if (["(", "[","f("].indexOf(lst.__nesting__)!==-1) {
					// treat as white space
					return newNest(tokens, lst);
				} else if (["null","{"].indexOf(lst.__nesting__)!==-1) {
					//
					let prev = [];
					prev.__nesting__ = ";";
					while (lst.length>0) {
						prev.push(lst.shift());
					}
					lst.push(prev);
					let sub = [];
					sub.__nesting__ = ";";
					lst.push(newNest(tokens, sub));
					return newNest(tokens, lst);
				} else if (lst.__nesting__===";") {
					// check for infix?
					return newNest(tokens,lst);
				}
			} else if ([")","]","}"].indexOf(token)!==-1) {
				// assume it is closed correctly for now?
				// check for infix?
				return lst;
			} else {
				//if (["+","-","*","/",].indexOf(token)) {
					// only within , or ;?
				//	lst.__infixed__ = true;
				//}
				let conc = lst.concat(atomize(token));
				conc.__nesting__ = lst.__nesting__;
				return newNest(tokens, conc);
			}
		}
	}


	function nest(tokens, lst) {
		// begin accumulating a list
		if (lst===undefined) {
			debug("building new list");
			return nest(tokens,[]);
		} else {
			let token = tokens.shift();
			// finish reading input
			if (token===undefined) {
				//this returns only the last list, so you have to use progn
				// eventually want to wrap with an implicit progn
				//return lst.pop();
				if (lst.length===1) {
					return lst[0];
				} else {
					lst.unshift("do");
					return lst;
				}
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

	// probably do this *after* parsing...right?
	function prefixize(tokens) {
		let order = ["*/","+-"];
		let newl = [];
		for (let op in order) {
			for (let i=0; i<tokens.length; i++) {
				if (op.match(tokens[i])) {
					newl = [operators[op]];
					newl.push(tokens.slice(0,i));
					newl.push(tokens.slice(i));
				}
			}
		}
		if (newl.length===0) {
			return lst;
		} else {
			return tokens;
		}
	}

	function atomize(token) {
		if (!isNaN(parseFloat(token))) {
			return parseFloat(token);
		} else {
			return token;
		}
	}

	function parse(input) {
		let parsed = nest(tokenize(input));
		debug("parsed:");
		debug(parsed);
		return parsed;
	}

	// ******************** Interpreting and Transpiling ***************** //
	function interpret(input, scp) {
		scp = scp || core;
		debug("interpreting " + JSON.stringify(input));
		if (Array.isArray(input)) {
			if (input.length===0) {
				debug("interpreting an empty list");
				// an empty list
				return input;
			}
			let [head, ...tail] = input;
			if (scp[head] instanceof Function && (scp[head].__special__ || scp[head].__macro__)) {
				// macros and special forms
				debug("interpreting special/macro "+head+"...");
				debug("...on ["+JSON.stringify(tail)+"]");
				return scp[head](tail, scp, interpret);
			} else {
				// process list
				debug("interpreting list " + JSON.stringify(input) + "...");
				let list = input.map(function(element) {return interpret(element, scp);});
				[head, ...tail] = list;
				debug("...to "+JSON.stringify(list));
				if (head instanceof Function) {
					// any risk that this could be a macro or a special?
					debug("interpreting anonymous function on "+JSON.stringify(tail)); 
					if (head.__special || head.__macro__) {
						alert("this thing happened!");
						return head(tail, scp, interpret);
					} else {
						return head(...tail);
					}
				} else if (scp[head] instanceof Function) {
					debug("interpreting named function "+head+" on "+JSON.stringify(tail)); 
					return scp[head](...tail);
				} else if  (!(Array.isArray(head)) && tail.length>0) {
					throw new TypeError(head + " is not callable.");
				} else {
					debug("interpreting list recursively - appopriate?");
					// recursing further...is this appropriate?
					return list;
				}
			}
		// are these even allowed?
		} else if (scp[input]!==undefined) {
			// this seemed to work wrong...println went to null
			debug("interpreting named value " + input);
			// named value
			return scp[input];
		} else {
			debug("interpreting primitive value " + input);
			// primitive value
			return input;
		}
	}

	function transpile(input, scp) {
		scp = scp || core;
		debug("transpiling " + JSON.stringify(input));
		if (Array.isArray(input)) {
			if (input.length===0) {
				debug("transpiling an empty list");
				// empty list
				return "[]";
			}
			let [head, ...tail] = input;
			// map reserved names
			if (scp[head]!==undefined && scp[head].__reserved__) {
				debug("transpiling " + head + " to " + scp[head].__reserved__);
			}
			head = (scp[head]!==undefined && scp[head].__reserved__) ? scp[head].__reserved__ : head;
			if (scp[head] instanceof Function && (scp[head].__special__ || scp[head].__macro__)) {
				// macros and special forms
				debug("transpiling special/macro "+head+"...");
				debug("...on ["+JSON.stringify(tail)+"]");
				return scp[head](tail, scp, transpile);
			} else if (input.length>1) {
				// process list
				debug("transpiling list " + JSON.stringify(input) + "...");
				let list = input.map(function(element) {return transpile(element, scp);});
				[head, ...tail] = list;
				debug("...to "+JSON.stringify(list));
				// map reserved names
				if (scp[head].__reserved__) {
					debug("transpiling " + head + " to " + scp[head].__reserved__);
				}
				head = (scp[head]!==undefined && scp[head].__reserved__) ? scp[head].__reserved__ : head;
				return ["(",head,")("].concat(tail.join(SPACER+", "+SPACER).split(SPACER),")").join("");
			} else {
				// I don't think this is ever correct...
				debug("debateable whether it's a good idea to return first list item..."+head);
				return head;
			}
		} else {
			debug("transpiling primitive or named value " + input);
			if (input==="false") {
				debug("returning the string value false");
			}
			// may need to wrap strings in ""?
			// primitive or named value
			//return JSON.stringify(input)
			return input;
		}
	}

	function scope(parent) {
		parent = parent || {};
		return Object.create(parent);
	}

	let core = scope();

	// ************ API ***************** //
	Lisp.core = core;
	Lisp.tokenize = tokenize;
	Lisp.nest = nest; 
	Lisp.parse = parse;
	Lisp.eval = function(code) {
		with (core) {
			return eval(code);
		}
	};
	Lisp.format4js = function(code) {
		if (typeof(code)==="string") {
			return code+";";
		} else {
			let stringified = JSON.stringify(code);
			if (stringified===undefined) {
				return "null";
			}
			let nodoubles = stringified.replace(/""/g,SPACER);
			let noquotes = nodoubles.replace(/"/g,"");
			let formatted = noquotes.replace(SREGEX,'"');
			return formatted;
		}
	};
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

	core.println = function() {
		Lisp.output(...arguments);
		return null;
	};

	// ******************* Primitives ********************** //

	core.true = true;
	core.false = false;
	core.null = null;


	// ******************* Special Forms ******************** //
	let specials = {};

	specials.progn = function(args, scp, method) {
		method = method || interpret || transpile;
		let [head, ...rest] = args;
		if (method===interpret) {
			if (rest.length===0) {
				return interpret(head, scp);
			} else {
				interpret(head, scp);
				return specials.progn(rest, scp, interpret);
				
			}
		} else {
			if (rest.length===0) {
				return transpile(head, scp);
			} else {
				return transpile(head, scp)+";\n"+specials.progn(rest, scp, transpile);
			}
		}
	};

	specials.lambda = function([args, body], scp, method) {
		method = method || interpret || transpile;
		return (method===interpret) ?
			(function() {
				let fscp= context(scp);
				Array.prototype.map.call(arguments,function(_,i) {
					// should this interpret?
					fscp.scope[args[i]]=arguments[i];
				});
				return interpret(body, fscp);
			}) :
			`(function(${args.map(arg => transpile(arg, scp)).join(",")}) {
				return ${transpile(body,scp)};})`;
	};

	specials.cond = function(clauses, scp, method) {
		method = method || interpret || transpile;
		let err = "You can't handle the truth!";
		if (clauses.length===0) {
			return (method===interpret) ? (new Error(err)) : `(new Error("${err}"))`;
		} else {
			let [[head, tail], ...rest] = clauses;
			return (method===interpret) ?
				interpret(head, scp) ?
					interpret(tail, scp) :
					specials.cond(rest, scp, interpret) :
				`((${transpile(head, scp)}) ?
					${transpile(tail, scp)} :
					${specials.cond(rest, scp, transpile)})`;
		}
	};

	specials.if = function(lst, scp, method) {
		method = method || interpret || transpile;
		let [test, body, fallback] = lst;
		return (method===interpret) ?
			(interpret(test, scp)) ?
				interpret(body, scp) :
				interpret(fallback, scp) :
			`((${transpile(test, scp)}) ?
				${transpile(body, scp)} :
				${transpile(fallback, scp)})`;
	};

	specials.quote = function([arg], scp, method) {
		method = method || interpet || transpile;
		return (method===interpret) ?
			arg :
			// be careful with this one..
			arg
		;
	};

	specials.and = function(lst, scp, method) {
		method = method || interpet || transpile;
		let [head, ...tail] = lst;
		return (method===interpret) ?
			(!head) ?
				false :
				(tail.length===0) ?
					head :
					core.specials.and(tail, scp, interpret) :
			"("+lst.map(function(e) {return transpile(e,scp);}).join("&&")+")"
		;
	};

	specials.or = function(lst, scp, method) {
		method = method || interpet || transpile;
		let [head, ...tail] = lst;
		return (method===interpret) ?
			(!head) ?
				false :
				(tail.length===0) ?
					head :
					core.specials.and(tail, scp, interpret) :
			"("+lst.map(function(e) {return transpile(e,scp);}).join("||")+")"
		;
	};

	specials.def = function(lst, scp, method) {
		method = method || interpet || transpile;
		let [name, val] = lst;
		if (method===interpret) {
			scp[name] = interpret(val, scp);
			// huh...if it's a function, I could test that and add it to functions...
			// ...but that seems like the wrong approach...
			return name;
		} else {
			// oh dear...can the return value translate?
			return `let ${name} = ${transpile(val, scp)}`;
			//return `eval("var ${name} = ${transpile(val, scp)}; ${name};")`;
		}
	};


	specials.let = function(lst, scp, method) {
		method = method || interpet || transpile;
		let [bindings, ...tail] = lst;
		let lscp = scope(scp);
		if (method===interpret) {
			for (let i=0; i<bindings.length; i+=2) {
				lscp[bindings[i]] = interpret(bindings[i+1], scp);
			}
			return interpret(tail, cont);
		} else {
			return (`(function() {
				${bindings.reduce((acc,val,i,arr) => {
					if (i%2===0) {
						acc.push(`	let ${val}=${transpile(arr[i+1],scp)};`);	
					}
					return acc;
				},[]).join("\n")}
				${tail.map(
					(e,i,a) => (i===a.length-1) ? "	return " + transpile(e, scp) : "")
				}})();`);
		}
	}

	specials.defmacro = function(lst, scp, method) {
		method = method || interpet || transpile;
		let [name, args, body] = lst;
		let macro = (function() {
			let mscp = scope(scp);
			let [margs, cscp, mmethod] = arguments;
			Array.prototype.map.call(margs, function(arg,i) {
				mscp[args[i]] = arg;
			});
			return mmethod(interpret(body, mscp),cscp);
		});
		macro.__body__ = body;
		macro.__args__ = args;
		// if this exact macro has already been defined...
		// ...usually because interpret and transpile were run sequentially
		if (!scp[name] || !(scp[name] instanceof Function) || scp[name].toSource()!==macro.toSource()) {
			scp[name] = macro;
			macro.__macro__ = true;
		}
		return (method===interpret) ? macro : name + "; // macro definition";
	};

	specials.macroexpand = function([name, args], scp, method) {
		method = method || interpet || transpile;
		let mscp = scope(scp);
		let macro = scp[name];
		Array.prototype.map.call(args, function(arg,i) {
			mscp[macro.__args__[i]] = arg;
		});
		return (method===interpret) ?
			interpret(macro.__body__, mscp) :
			transpile(interpret(macro.__body__, mscp), scp);
	};

	// *********** Core Functions ************************ //

	core.cons = function(a, b) {
		if (!Array.isArray(b)) {
			console.log(lst);
			throw new TypeError("cons used on non-list");
		}
		return [a].concat(b);
	};

	core.car = function(lst) {
		if (!Array.isArray(lst)  ) {
			console.log(lst);
			throw new TypeError("car used on non-list");
		} else if (lst.length===0) {
			throw new Error("car used on empty list");
		} else {
			return lst[0];
		}
	};

	core.cdr = function(lst) {
		if (!Array.isArray(lst)  ) {
			console.log(lst);
			throw new TypeError("cdr used on non-list");
		} else if (lst.length===0) {
			throw new Error("cdr used on empty list");
		} else {
			return lst.slice(1);
		}
	};

	core.list = function() {
		return Array.from(arguments);
	};

	core.atom = function(a) {
		return Array.isArray(a);
	};

	core.eq = function(a, b) {
		return (a===b);
	};

	core.not = function(a) {
		return !a;
	};

	core.Y = f => (x => x(x))(x => f(y => x(x)(y)));

	// ******************* Math *********************** //

	core.inc = function(a) {
		return a+1;
	}

	core.dec = function(a) {
		return a-1;
	}


	// ********************** Populate core namespace ***************** //
	for (let s in specials) {
		core[s] = specials[s];
		core[s].__special__ = true;
		core[s].__name__ = "<core.special."+s+">";
	}

	// *********************** Handle JS operators and JS reserved words ******************** //

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
		core[ops[op]] = core[op] = oper;
		oper.__reserved__ = op;
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
		core[ops[op]] = core[op] = oper;
		oper.__reserved__ = op;
	}

	// functions defined with ordinary names
	let others = {
		eq : "=",
		and : "&&",
		or : "||",
		not : "!",
		inc: "++",
		dec: "--",
		progn: "do"
	};

	for (let op in others) {
		let ops = others;
		core[ops[op]] = core[op];
		core[op].__reserved__ = op;
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

	return Lisp;
})(Lisp);