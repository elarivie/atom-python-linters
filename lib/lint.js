'use strict';

const path = require('path');
const helpers = require('atom-linter'); // https://github.com/steelbrain/atom-linter
const NamedRegexp = require('named-js-regexp');

const promiseCreator = require('./promises-creator.js');
const settings = require('./settings.js');

// Lazy-loaded modules
let errHandling;
function fetchErrHandling() {
	if (!errHandling) {
		errHandling = require('./error-handling.js');
	}

	return errHandling;
}

function adjustPath(pathString, fileDir, projectPath) {
	// Search & replace variables
	let result = pathString;
	result = result.replace(/%PROJECT_NAME/g, path.basename(projectPath));
	result = result.replace(/%PROJECT_PATH/g, projectPath);
	result = result.replace(/%FILE_DIR/g, fileDir);
	return result;
}

function getProjectPath(filePath) {
	// Get the project path.
	const atomProject = atom.project.relativizePath(filePath)[0];
	if (null !== atomProject) {
		return atomProject;
	}

	// Fallback to file directory if project path cannot be determined
	return path.dirname(filePath);
}

function getPythonPath(fileDir, projectPath) {
	return adjustPath(settings.rawPythonPath, fileDir, projectPath);
}

function getPythonExecutablePath(fileDir, projectPath) {
	return adjustPath(settings.rawPythonExecutablePath, fileDir, projectPath);
}

function getConfigPath(fileDir, projectPath) {
	return adjustPath(settings.rawConfigPath, fileDir, projectPath);
}

function provideLinter() {
	// Declare regex which extract information about the lint details.
	const regexLineFlake8 = new NamedRegexp('^(?<file>([A-Z]\\:)?[^:]+)\\:(?<line>\\d+)\\:(?:(?<col>\\d+)\\:)?\\ (?<message>.+)$');
	const regexLineMypy = new NamedRegexp('^(?<file>([A-Z]:)?[^:]+)[:](?<line>\\d+):(?:(?<col>\\d+):)? (?<severity>[a-z]+): (?<message>.+)');
	const regexLinePylint = new NamedRegexp('^(?<file>([A-Z]\\:)?[^:]+)\\:(?<line>\\d+)\\:(?:(?<col>\\d+)\\:)?\\ (?<message>.+)$');
	const regexLinePydocstyle = new NamedRegexp('^(?<file>([A-Z]:)?[^:]+)[:](?<line>\\d+)[^:]*:(?<message>.+)$');

	return {
		name: 'python-linters',
		scope: 'file',
		lintsOnChange: 'LintAsYouType' === settings.rawLintTrigger,
		grammarScopes: ['source.python', 'source.python.django'],
		lint(textEditor) {
			// Quickly take snapshot of some volatile stuff.
			const editorPath = textEditor.getPath();
			const editorText = textEditor.getText();

			if ('' === editorText) {
				return Promise.resolve([]);
			}

			// Sync compute some derived stuff
			const editorPathParsed = path.parse(editorPath); // https://node.readthedocs.io/en/latest/api/path/
			const projectPath = getProjectPath(editorPath);
			const pythonExecutablePath = getPythonExecutablePath(editorPathParsed.dir, projectPath);
			const pythonPath = getPythonPath(editorPathParsed.dir, projectPath);
			const env = Object.create(process.env);
			env.LANG = {value: 'en_US.UTF-8', enumerable: true};
			if ('' !== pythonPath) {
				env.PYTHONPATH = pythonPath;
			}

			// Async Prepare some promises
			const configPath = promiseCreator.fileReadableAsync(getConfigPath(editorPathParsed.dir, projectPath));
			const editorPathCopy = promiseCreator.createTempFolder(settings.rawTempFolderPath).then(tempPath => {
				return promiseCreator.createTextFile(path.join(tempPath, editorPathParsed.base), editorText);
			});

			// Do lint.

			// Define a default promise for each lint tool.  Each of them must resolve an array of linter messages: https://steelbrain.me/linter/types/linter-message-v2.html
			let lintFlake8 = Promise.resolve([]);
			let lintMypy = Promise.resolve([]);
			let lintPydocstyle = Promise.resolve([]);
			let lintPylint = Promise.resolve([]);
			// The available severity level are [info, warning, error]

			if (settings.rawLintWithFlake8) {
				lintFlake8 = Promise.all([editorPath, editorText, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
					const editorPath = values[0];
					const editorText = values[1];
					const pythonExecutablePath = values[2];
					const env = values[3];
					const configPath = values[4];
					const editorPathRoot = values[5];

					return new Promise((resolve, reject) => {
						const params = [];
						params.push('-m');
						params.push('flake8');

						if (configPath) {
							params.push('--config');
							params.push(configPath);
						}

						params.push('--stdin-display-name');
						params.push(editorPath);
						params.push('-');

						const options = {
							stream: 'both',
							stdin: editorText,
							ignoreExitCode: true,
							cwd: editorPathRoot,
							env,
							timeout: Infinity};

						helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
							if ('' !== stderr) {
								reject(stderr);
								return;
							}

							// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
							const resultFlake8 = stdout.split(/\r\n|\r|\n/g).map(x => regexLineFlake8.execGroups(x)).reduce((total, currParsedMessage) => {
								if (currParsedMessage) {
									total.push({
										severity: 'error',
										location: {
											file: editorPath,
											position: [[parseInt(currParsedMessage.line, 10) - 1, parseInt(currParsedMessage.col, 10) - 1], [parseInt(currParsedMessage.line, 10) - 1, parseInt(currParsedMessage.col, 10)]]
										},
										excerpt: currParsedMessage.message,
										description: '',
										url: '',
										solutions: []
									});
								}

								return total;
							}, []);
							resolve(resultFlake8);
						}, err => {
							reject(err);
						});
					});
				});
			}

			if (settings.rawLintWithMypy) {
				lintMypy = Promise.all([editorPath, editorPathCopy, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
					const editorPath = values[0];
					const editorPathCopy = values[1];
					const pythonExecutablePath = values[2];
					const env = values[3];
					const configPath = values[4];
					const editorPathRoot = values[5];

					return new Promise((resolve, reject) => {
						const params = [];
						params.push('-m');
						params.push('mypy');

						const options = {
							stream: 'both',
							ignoreExitCode: true,
							cwd: editorPathRoot,
							env,
							timeout: Infinity};

						if (configPath) {
							params.push('--config-file');
							params.push(configPath);
							options.cwd = path.dirname(configPath);
						}

						params.push('--hide-error-context');
						params.push('--no-error-summary');
						params.push('--no-pretty');
						params.push('--no-color-output');
						params.push('--show-error-codes');
						params.push('--show-column-numbers');
						params.push('--show-absolute-path');
						params.push('--show-traceback');
						params.push('--shadow-file');
						params.push(editorPath);
						params.push(editorPathCopy);

						params.push(editorPath);

						const regexNoConfigSection = new NamedRegexp('[^:]+: No \\[mypy\\] section in config file');
						const regexNoConfigSectionHeaders = new NamedRegexp('File contains no section headers.');
						const regexConfigUnparseable = new NamedRegexp(': Source contains parsing errors');
						helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
							if ('' !== stderr) {
								if (regexNoConfigSection.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'No \\[mypy\\] section in config file');
								} else	if (regexNoConfigSectionHeaders.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'No \\[mypy\\] section in config file');
								} else	if (regexConfigUnparseable.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'parsing error in config file');
								} else {
									reject(stderr);
									return;
								}
							}

							// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
							const resultMypy = stdout.split(/\r\n|\r|\n/g).map(x => regexLineMypy.execGroups(x)).reduce((total, currParsedMessage) => {
								if (currParsedMessage & (editorPath === currParsedMessage.file)) {
									total.push({
										severity: currParsedMessage.severity.replace('note', 'info'),
										location: {
											file: editorPath,
											position: [[parseInt(currParsedMessage.line, 10) - 1, parseInt(currParsedMessage.col, 10) - 1], [parseInt(currParsedMessage.line, 10) - 1, parseInt(currParsedMessage.col, 10)]]
										},
										excerpt: currParsedMessage.message,
										description: '',
										url: '',
										solutions: []
									});
								}

								return total;
							}, []);
							resolve(resultMypy);
						}, err => {
							reject(err);
						});
					});
				});
			}

			if (settings.rawLintWithPydocstyle) {
				lintPydocstyle = Promise.all([editorPath, editorPathCopy, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
					const editorPath = values[0];
					const editorPathCopy = values[1];
					const pythonExecutablePath = values[2];
					const env = values[3];
					const configPath = values[4];
					const editorPathRoot = values[5];

					return new Promise((resolve, reject) => {
						const params = [];
						params.push('-m');
						params.push('pydocstyle');

						const options = {
							stream: 'both',
							ignoreExitCode: true,
							cwd: editorPathRoot,
							env,
							timeout: Infinity};

						if (configPath) {
							params.push('--config');
							params.push(configPath);
							options.cwd = path.dirname(configPath);
						}

						params.push(editorPathCopy);

						const regexCannotParse = new NamedRegexp('^WARNING: Error in file .+: Cannot parse file\\.$');
						const regexNoConfigSectionPydocstyle = new NamedRegexp('^WARNING: Configuration file does not contain a pydocstyle section. Using default configuration.');
						const regexNoConfigSection = new NamedRegexp('MissingSectionHeaderError: File contains no section headers.');
						const regexConfigUnparseable = new NamedRegexp('configparser.ParsingError');
						helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
							if ('' !== stderr) {
								if (regexCannotParse.execGroups(stderr)) {
									// Ignore.
								} else if (regexNoConfigSection.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'No \\[pydocstyle\\] section in config file');
								} else if (regexNoConfigSectionPydocstyle.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'No \\[pydocstyle\\] section in config file');
								} else if (regexConfigUnparseable.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'parsing error in config file');
								} else {
									reject(stderr);
									return;
								}
							}

							// Combine multi line output and then
							// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
							const resultPydocstyle = stdout.replace(/:(\r\n|\r|\n)\s+/mg, ':').split(/\r\n|\r|\n/g).map(x => regexLinePydocstyle.execGroups(x)).reduce((total, currParsedMessage) => {
								if (currParsedMessage) {
									total.push({
										severity: 'info',
										location: {
											file: editorPath,
											position: [[parseInt(currParsedMessage.line, 10) - 1, 0], [parseInt(currParsedMessage.line, 10) - 1, 1]]
										},
										excerpt: currParsedMessage.message,
										description: '',
										url: '',
										solutions: []
									});
								}

								return total;
							}, []);

							if (regexCannotParse.execGroups(stderr)) {
								resultPydocstyle.push({
									severity: 'error',
									location: {
										file: editorPath,
										position: [[0, 0], [0, 1]]
									},
									excerpt: 'Pydocstyle Syntax error, Cannot parse file',
									description: '',
									url: '',
									solutions: []
								});
							}

							resolve(resultPydocstyle);
						}, err => {
							reject(err);
						});
					});
				});
			}

			if (settings.rawLintWithPylint) {
				lintPylint = Promise.all([editorPath, editorText, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
					const editorPath = values[0];
					const editorText = values[1];
					const pythonExecutablePath = values[2];
					const env = values[3];
					const configPath = values[4];
					const editorPathRoot = values[5];

					return new Promise((resolve, reject) => {
						const params = [];
						params.push('-m');
						params.push('pylint');

						if (configPath) {
							params.push('--rcfile');
							params.push(configPath);
						}

						params.push('--score');
						params.push('n');
						params.push('--output-format');
						params.push('text');

						params.push('--from-stdin');
						params.push(editorPath);

						const options = {
							stream: 'both',
							stdin: editorText,
							ignoreExitCode: true,
							cwd: editorPathRoot,
							env,
							timeout: Infinity};

						helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
							const regexParseFail = new NamedRegexp('Parsing Python code failed:');
							const regexNoConfigSection = new NamedRegexp('[^:]+: No \\[pylint\\] section in config file');
							const regexNoConfigSectionHeaders = new NamedRegexp('File contains no section headers.');
							const regexConfigUnparseable = new NamedRegexp(': Source contains parsing errors');

							if ('' !== stderr) {
								if (regexNoConfigSection.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'No \\[pylint\\] section in config file');
								} else	if (regexNoConfigSectionHeaders.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'No \\[pylint\\] section in config file');
								} else	if (regexConfigUnparseable.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'parsing error in config file');
								} else {
									reject(stderr);
									return;
								}
							}

							if ('' !== stderr) {
								if (regexParseFail.execGroups(stderr)) {
									// ignore.
								} else if (regexNoConfigSectionHeaders.execGroups(stderr)) {
									// ignore.
								} else	if (regexConfigUnparseable.execGroups(stderr)) {
									fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'parsing error in config file');
								} else {
									reject(stderr);
									return;
								}
							}

							// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
							const resultPylint = stdout.split(/\r\n|\r|\n/g).map(x => regexLinePylint.execGroups(x)).reduce((total, currParsedMessage) => {
								if (currParsedMessage) {
									total.push({
										severity: 'error',
										location: {
											file: editorPath,
											position: [[parseInt(currParsedMessage.line, 10) - 1, parseInt(currParsedMessage.col, 10) - 1], [parseInt(currParsedMessage.line, 10) - 1, parseInt(currParsedMessage.col, 10)]]
										},
										excerpt: currParsedMessage.message,
										description: '',
										url: '',
										solutions: []
									});
								}

								return total;
							}, []);
							if (regexParseFail.execGroups(stderr)) {
								resultPylint.push({
									severity: 'error',
									location: {
										file: editorPath,
										position: [[0, 0], [0, 1]]
									},
									excerpt: 'pylint Syntax error, Cannot parse file',
									description: '',
									url: '',
									solutions: []
								});
							}

							resolve(resultPylint);
						}, err => {
							reject(err);
						});
					});
				});
			}

			const lintTool = [lintFlake8, lintMypy, lintPylint, lintPydocstyle];

			return Promise.all(lintTool).then(values => {
				const sumResult = values.reduce((total, newValues) => {
					return total.concat(newValues);
				}, []);
				return sumResult;
			}, err => {
				// Well, Well, Well... something went wrong with a lint tool.
				// Instead of crashing or giving cryptic error message, let's try to be user friendly.

				if ('ENOENT' === err.code) {
					fetchErrHandling().failToLaunchPython(pythonExecutablePath);
				} else {
					const regexNoModuleNamedTypedAst = new NamedRegexp('^.*The typed_ast package is not installed$');
					const regexNoModuleNamedX = new NamedRegexp('^.+No module named (?<moduleName>flake8|mypy|pydocstyle|pylint).*$');
					const regexUsageModuleNamedX = new NamedRegexp('^.*[u|U]sage: (?<moduleName>flake8|mypy|pydocstyle|pylint).*$');

					const parsedNoModuleNamedTypedAst = regexNoModuleNamedTypedAst.execGroups(err);
					const parsedNoModuleNamedX = regexNoModuleNamedX.execGroups(err);
					const parsedregexUsageModuleNamedX = regexUsageModuleNamedX.execGroups(err);
					if (parsedNoModuleNamedTypedAst) {
						fetchErrHandling().failMissingPythonModuleTypeAst(pythonExecutablePath);
					} else if (parsedNoModuleNamedX) {
						fetchErrHandling().failMissingPythonModule(pythonExecutablePath, parsedNoModuleNamedX.moduleName);
					} else if (parsedregexUsageModuleNamedX) {
						fetchErrHandling().failModuleOld(pythonExecutablePath, parsedregexUsageModuleNamedX.moduleName);
					} else if (err.message) {
						fetchErrHandling().failUnknown(err.message);
					} else {
						fetchErrHandling().failUnknown(err);
					}
				}

				// Something wrong occured, therefore there is no lint message to report.
				return [];
			}).finally(() => {
				editorPathCopy.then(x => promiseCreator.removeFromDisk(path.dirname(x)));
			});
		}
	};
}

module.exports = {provideLinter};
