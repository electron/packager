#!/usr/bin/env node
var fs = require('fs')
var args = require('minimist')(process.argv.slice(2), {boolean : [ 'prune', 'asar', 'all', 'overwrite', 'strict-ssl' ]})
var packager = require('./')
var usage = fs.readFileSync(__dirname + '/usage.txt').toString()

var slice = [ ].slice

var areIdentical = function () {
	var baseValue, i, len, notIdentical, v, value
	baseValue = arguments[0], value = 2 <= arguments.length ? slice.call(arguments, 1) : [ ]
	for ( i = 0, len = value.length; i < len; i++ ) {
		v = value[i]
		if (baseValue !== v) {
			notIdentical = true
			break
		}
	}
	return notIdentical == null
}

getUnique = function (v, i, a) {
	return ((a.slice(0, i)).indexOf(v)) === -1
}

args.dir = args._[0]
args.name = args._[1]

var protocolSchemes = [ ].concat(((ref = args.protocol) != null ? ref.scheme : void 0) || [ ])
var protocolNames = [ ].concat(((ref1 = args.protocol) != null ? ref1.name : void 0) || [ ])
var protocolRoles = [ ].concat(((ref2 = args.protocol) != null ? ref2.role : void 0) || [ ]).map(function (v, i) {
	v = (function () {
		var char, i, result
		result = (function () {
			var j, len, results
			results = [ ]
			for ( i = j = 0, len = v.length; j < len; i = ++j ) {
				char = v[i]
				if (i === 0) {
					results.push(char.toUpperCase())
				} else {
					results.push(char.toLowerCase())
				}
			}
			return results
		})()
		return result.join('')
	})()
	var allowed = [ 'Editor', 'Viewer', 'Shell', 'None' ]
	if (allowed.indexOf(v) == -1) {
		return 'None'
	}
	return v
})

if (protocolSchemes && protocolNames && protocolRoles && areIdentical(protocolNames.length, protocolSchemes.length, protocolRoles.length)) {
	args.protocols = (function (apc) {
		var i, i1, name, name1, protocol, protocol1, result, role, role1
		return result = (function () {
			var ref, results
			results = [ ]
			for ( i in apc ) {
				protocol = apc[i]
				i = parseInt(i)
				ref = apc.slice(i + 1, apc.length)
				for ( i1 in ref ) {
					protocol1 = ref[i1]
					name = protocol.name, role = protocol.role
					name1 = protocol1.name, role1 = protocol1.role
					if (areIdentical(name, name1) && areIdentical(role, role1)) {
						protocol.schemes = protocol.schemes.concat(protocol1.schemes)
						protocol.schemes.filter(getUnique)
						delete apc[apc.indexOf(protocol1)]
					}
				}
				results.push(protocol)
			}
			return results
		})()
	})(protocolSchemes.map(function (scheme, i) {
		return {schemes : [ scheme ], name : protocolNames[i], role : protocolRoles[i]}
	}))
}

if (!args.dir || !args.name || !args.version || (!args.all && (!args.platform || !args.arch))) {
	console.error(usage)
	process.exit(1)
}

packager(args, function done (err, appPaths) {
	if (err) {
		if (err.message) console.error(err.message)
		else console.error(err, err.stack)
		process.exit(1)
	}

	if (appPaths.length > 1) console.error('Wrote new apps to:\n' + appPaths.join('\n'))
	else if (appPaths.length === 1) console.error('Wrote new app to', appPaths[0])
})
