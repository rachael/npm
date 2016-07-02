'use strict'
var fs = require('graceful-fs')
var path = require('path')
var SaveStack = require('./save-stack.js')

module.exports = rename

function rename (from, to, cb) {
  var saved = new SaveStack(rename);
  try {
    fs.rename(from, to);
  } catch(renameErr) {
		try {
		  copyDir(from, to);
		  rmdir(from);
		} catch(copyErr) {
			// only show errors if they're errors
			console.warn("warn: could not rename " + from + " => " + to + ": " + renameErr);
			console.warn("warn: could not copy directory " + from + " => " + to + ": " + copyErr);
			try {
				rmdir(to);
			} catch(cleanupErr) {
				console.warn("warn: could not cleanup partial copy of " + from + " => " + to + ": " + cleanupErr);
			}
		  return cb(saved.completeWith(renameErr));
		}
		return cb();
  }
};

function mkdir (dir) {
	// making directory without exception if exists
	try {
		fs.mkdirSync(dir, '0755');
	} catch(e) {
		if(e.code != "EEXIST") {
			throw e;
		}
	}
};

function rmdir (dir) {
	if (fs.existsSync(dir)) {
		var list = fs.readdirSync(dir);
		for(var i = 0; i < list.length; i++) {
			var filename = path.join(dir, list[i]);
			var stat = fs.statSync(filename);

			if(filename == "." || filename == "..") {
				// pass these files
			} else if(stat.isDirectory()) {
				// rmdir recursively
				rmdir(filename);
			} else {
				// rm fiilename
				fs.unlinkSync(filename);
			}
		}
		fs.rmdirSync(dir);
	} else {
		console.warn("warn: " + dir + " does not exist");
	}
};

function copyDir (src, dest) {
	mkdir(dest);
	var files = fs.readdirSync(src);
	for(var i = 0; i < files.length; i++) {
		var current = fs.lstatSync(path.join(src, files[i]));
		if(current.isDirectory()) {
			copyDir(path.join(src, files[i]), path.join(dest, files[i]));
		} else if(current.isSymbolicLink()) {
			var symlink = fs.readlinkSync(path.join(src, files[i]));
			fs.symlinkSync(symlink, path.join(dest, files[i]));
		} else {
			copy(path.join(src, files[i]), path.join(dest, files[i]));
		}
	}
};

function copy (src, dest) {
	var oldFile = fs.createReadStream(src);
	var newFile = fs.createWriteStream(dest);
	oldFile.pipe(newFile);
};

