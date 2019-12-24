'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function fileReadableAsync(filePath) {
	return new Promise((resolve, reject) => {
		fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK, err => {
			if (err) {
				resolve('');
			} else {
				resolve(filePath);
			}
		});
	});
}

function removeFromDiskFile(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return new Promise((resolve, reject) => {
		fs.unlink(pPath, err => {
			if (err) {
				if ('ENOENT' === err.code) {
					// OK, Already removed.
					resolve(pPath);
				} else if ('EISDIR' === err.code) {
					// Redirect to a directory removal strategy.
					resolve(removeFromDiskDirectory(pPath));
				} else {
					reject(err);
				}
			} else {
				// OK removed.
				resolve(pPath);
			}
		});
	});
}

function removeFromDiskEmptyDirectory(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return new Promise((resolve, reject) => {
		fs.rmdir(pPath, err => {
			if (err) {
				if ('ENOENT' === err.code) {
					// OK, Already removed.
					resolve(pPath);
				} else if ('ENOTDIR' === err.code) {
					// Redirect to a file removal strategy.
					resolve(removeFromDiskFile(pPath));
				} else if ('ENOTEMPTY' === err.code) {
					// Rediret to a folder remove content strategy.
					resolve(removeFromDiskDirectoryContent(pPath).then(_ => removeFromDiskEmptyDirectory(pPath)));
				} else {
					reject(err);
				}
			} else {
				// OK removed.
				resolve(pPath);
			}
		});
	});
}

function removeFromDiskDirectoryContent(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return new Promise((resolve, reject) => {
		fs.readdir(pPath, (err, files) => {
			if (err) {
				if ('ENOENT' === err.code) {
					// OK parent directory does not even exists.
					resolve(pPath);
				} else if ('ENOTDIR' === err.code) {
					// Redirect to a file strategy
					resolve(removeFromDiskFileContent(pPath));
				} else {
					reject(err);
				}
			} else {
				resolve(Promise.all(files.map(x => path.join(pPath, x)).map(x => removeFromDisk(x))).then(Promise.resolve(pPath)));
			}
		});
	});
}

function removeFromDiskFileContent(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return new Promise((resolve, reject) => {
		fs.truncate(pPath, err => {
			if (err) {
				if ('ENOENT' === err.code) {
					// OK file does not even exists.
					resolve(pPath);
				} else if ('EISDIR' === err.code) {
					// Redirect to a directory strategy.
					resolve(removeFromDiskDirectoryContent(pPath));
				} else {
					reject(err);
				}
			} else {
				// OK removed.
				resolve(pPath);
			}
		});
	});
}

function removeFromDiskDirectory(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return removeFromDiskEmptyDirectory(pPath);
}

function removeFromDisk(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return removeFromDiskFile(pPath);
}

function removeFromDiskContent(pPath) {
	if (!pPath) {
		return Promise.resolve(pPath);
	}

	return removeFromDiskFileContent(pPath);
}

function createTempFolder(tempPath = os.tmpdir()) {
	return new Promise((resolve, reject) => {
		fs.mkdtemp(path.join(tempPath, 'atom_python_linters'), (err, folder) => {
			if (err) {
				reject(err);
			} else {
				resolve(folder);
			}
		});
	});
}

function createTextFile(pPath, text = '', mode = 0o666) {
	return new Promise((resolve, reject) => {
		fs.writeFile(pPath, text, {encoding: 'utf8', mode}, err => {
			if (err) {
				reject(err);
			} else {
				resolve(pPath);
			}
		});
	});
}

module.exports = {fileReadableAsync, removeFromDisk, removeFromDiskContent, createTempFolder, createTextFile};
