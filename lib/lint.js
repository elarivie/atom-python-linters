'use strict';

const path = require('path');
const {Point, Range} = require('atom');
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
	return adjustPath(settings.getS(settings.sPythonPath), fileDir, projectPath);
}

function getPythonExecutablePath(fileDir, projectPath) {
	return adjustPath(settings.getS(settings.sPythonExecutable), fileDir, projectPath);
}

function getConfigPath(fileDir, projectPath) {
	return adjustPath(settings.getS(settings.sConfig), fileDir, projectPath);
}

function getEnv(pythonPath) {
	const env = Object.create(process.env);
	env.LANG = {value: 'en_US.UTF-8', enumerable: true};
	if ('' !== pythonPath) {
		env.PYTHONPATH = pythonPath;
	}
}

// Shared regex
const regexNoModuleNamedX = new NamedRegexp('No module named (?<moduleName>flake8|mypy|pydocstyle|pylint)');
const regexUsageModuleNamedX = new NamedRegexp('[u|U]sage: (?<moduleName>flake8|mypy|pydocstyle|pylint)');

// Shared logic
function createLintRange(startLine = null, startColumn = null, endLine = null, endColumn = null) {
	// Create ling messages v2 location using 0-based values defining lint message regions.
	if (!Number.isInteger(startLine)) {
		startLine = endLine;
		startColumn = endColumn;
	}

	if (!Number.isInteger(endLine)) {
		endLine = startLine;
		endColumn = startColumn;
	}

	const values = [startLine, startColumn, endLine, endColumn];

	for (const [i, v] of [startLine, startColumn, endLine, endColumn].entries()) {
		if (!Number.isInteger(v)) {
			values[i] = 0;
		} else if (0 > values[i]) {
			values[i] = 0;
		}
	}

	startLine = values[0];
	startColumn = values[1];
	endLine = values[2];
	endColumn = values[3];
	if (startLine === endLine) { // Same line
		if (startColumn === endColumn) { // Same column
			endColumn += 1; // Heuristic: Since a linter point at something it must be at least be 1 character long.
		} else if (startColumn > endColumn) {
			// Put Start before end
			[startColumn, endColumn] = [endColumn, startColumn];
		}
	} else if (endLine < startLine) {
		// Put Start before end
		[startLine, endLine] = [endLine, startLine];
		[startColumn, endColumn] = [endColumn, startColumn];
	}

	return new Range(new Point(startLine, startColumn), new Point(endLine, endColumn));
}

function pushLintMsgPythonParseError(result, editorPath) {
	result.push({
		severity: 'error',
		location: {
			file: editorPath,
			position: createLintRange()
		},
		excerpt: 'Syntax error, Cannot parse file',
		description: '',
		url: '',
		solutions: []
	});
}

function pushLintMsgByte0(result, editorPath) {
	result.push({
		severity: 'error',
		location: {
			file: editorPath,
			position: createLintRange()
		},
		excerpt: 'Syntax error, source code cannot contain null bytes',
		description: '',
		url: '',
		solutions: []
	});
}

function decodeSeverity(message) {
	if (message) {
		if (0 < message.length) {
			switch (message.charAt(0)) {
				case 'C': // Programming standard violation
					return 'info';
				case 'D': // Documentation
					return 'info';
				case 'E': // Error
					return 'error';
				case 'F': // Fail
					return 'error';
				case 'R': // Refactor, Bad code smell
					return 'info';
				case 'W':
					return 'warning';
				default:
					return 'warning';
			}
		}
	}

	return 'warning';
}

function provideLinterFlake8() {
	// Declare regex which extract information about the lint messages.
	const regexLineFlake8 = new NamedRegexp('^(?<file>([A-Z]\\:)?[^:]+)\\:(?<line>\\d+)\\:(?:(?<col>\\d+)\\:)?\\ (?<message>.+)$');
	return {
		name: 'python-linters flake8',
		scope: 'file',
		lintsOnChange: settings.isLintsOnChange(settings.getS(settings.sLintTriggerFlake8)),
		grammarScopes: ['source.python', 'source.python.django'],
		lint(textEditor) {
			// Quickly take snapshot of some volatile stuff.
			const editorText = textEditor.getText();
			const editorPath = textEditor.getPath();

			if ('' === editorText) {
				return Promise.resolve([]);
			}

			if ('Never' === settings.getS(settings.sLintTriggerFlake8)) {
				return Promise.resolve([]);
			}

			// Sync compute some derived stuff
			const editorPathParsed = path.parse(editorPath); // https://node.readthedocs.io/en/latest/api/path/
			const projectPath = getProjectPath(editorPath);

			// Prepare some promises
			const pythonExecutablePath = new Promise((resolve, reject) => {
				resolve(getPythonExecutablePath(editorPathParsed.dir, projectPath));
			});
			const env = new Promise((resolve, reject) => {
				resolve(getEnv(getPythonPath(editorPathParsed.dir, projectPath)));
			});
			const configPath = promiseCreator.fileReadableAsync(getConfigPath(editorPathParsed.dir, projectPath));

			// Do lint.
			return Promise.all([editorPath, editorText, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
				const editorPath = values[0];
				const editorText = values[1];
				const pythonExecutablePath = values[2];
				const env = values[3];
				const configPath = values[4];
				const editorPathRoot = values[5];

				return new Promise((resolve, reject) => {
					const options = {
						stream: 'both',
						stdin: editorText,
						ignoreExitCode: true,
						cwd: editorPathRoot,
						env,
						timeout: Infinity};

					const params = [];
					params.push('-m');
					params.push('flake8');

					if (configPath) {
						options.cwd = path.dirname(configPath);
						params.push('--config');
						params.push(configPath);
					}

					params.push('--stdin-display-name');
					params.push(editorPath);
					params.push('-');

					helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
						if ('' !== stderr) {
							reject(stderr);
							return;
						}

						// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
						const resultFlake8 = stdout.split(/\r\n|\r|\n/g).map(x => regexLineFlake8.execGroups(x)).reduce((total, currParsedMessage) => {
							try {
								if (currParsedMessage) {
									let {line, col, severity, message} = currParsedMessage;

									line = parseInt(line, 10) - 1;
									col = parseInt(col, 10);
									severity = decodeSeverity(message);

									const columnStart = col - 1;
									let columnEnd = columnStart;
									const parsedRegexF821 = new NamedRegexp('F821 undefined name \\\'(?<variableName>[^\\\']+)\\\'').execGroups(message);
									if (parsedRegexF821) {
										columnEnd += parsedRegexF821.variableName.length;
									}

									total.push({
										severity,
										location: {
											file: editorPath,
											position: createLintRange(line, columnStart, line, columnEnd)
										},
										excerpt: message,
										description: '',
										url: '',
										solutions: []
									});
								}
							} catch (error) {
								reject(error);
							}

							return total;
						}, []);
						resolve(resultFlake8);
					}, err => {
						reject(err);
					});
				}).catch(error => {
					// Well, Well, Well... something went wrong.
					// Instead of crashing or giving cryptic error message, let's try to be user friendly.
					const resultFlake8 = [];

					if ('ENOENT' === error.code) {
						fetchErrHandling().failToLaunchPython(pythonExecutablePath);
					} else {
						const parsedNoModuleNamedX = regexNoModuleNamedX.execGroups(error);
						const parsedregexUsageModuleNamedX = regexUsageModuleNamedX.execGroups(error);
						if (parsedNoModuleNamedX) {
							fetchErrHandling().failMissingPythonModule(pythonExecutablePath, parsedNoModuleNamedX.moduleName);
						} else if (parsedregexUsageModuleNamedX) {
							fetchErrHandling().failModuleOld(pythonExecutablePath, parsedregexUsageModuleNamedX.moduleName);
						} else if (error.message) {
							fetchErrHandling().failUnknown(error.message);
						} else if (new NamedRegexp('configparser.DuplicateSectionError').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'flake8', 'duplicate sections detected in config file');
						} else if (new NamedRegexp('pydocstyle.parser.ParseError')) { // Flake8 effectively raise a pydocstyle.parser.ParseError, this is not a typo
							pushLintMsgPythonParseError(resultFlake8, editorPath);
						} else {
							fetchErrHandling().failUnknown('flake8' + error);
						}

						return resultFlake8;
					}
				});
			});
		}
	};
}

function provideLinterMypy() {
	// Declare regex which extract information about the lint messages.
	const regexLineMypy = new NamedRegexp('^(?<file>([A-Z]:)?[^:]+)[:](?<line>\\d+):(?:(?<col>\\d+):)? (?<severity>[a-z]+): (?<message>.+)');
	return {
		name: 'python-linters mypy',
		scope: 'file',
		lintsOnChange: settings.isLintsOnChange(settings.getS(settings.sLintTriggerMypy)),
		grammarScopes: ['source.python', 'source.python.django'],
		lint(textEditor) {
			// Quickly take snapshot of some volatile stuff.
			const editorText = textEditor.getText();
			const editorPath = textEditor.getPath();

			if ('' === editorText) {
				return Promise.resolve([]);
			}

			if ('Never' === settings.getS(settings.sLintTriggerMypy)) {
				return Promise.resolve([]);
			}

			// Sync compute some derived stuff
			const editorPathParsed = path.parse(editorPath); // https://node.readthedocs.io/en/latest/api/path/
			const projectPath = getProjectPath(editorPath);
			const pythonExecutablePath = getPythonExecutablePath(editorPathParsed.dir, projectPath);
			const env = getEnv(getPythonPath(editorPathParsed.dir, projectPath));

			// Prepare some promises
			const configPath = promiseCreator.fileReadableAsync(getConfigPath(editorPathParsed.dir, projectPath));
			const editorPathCopy = promiseCreator.createTempFolder(settings.rawTempFolderPath).then(tempPath => {
				return promiseCreator.createTextFile(path.join(tempPath, editorPathParsed.base), editorText);
			});

			// Do lint.

			return Promise.all([editorPath, editorPathCopy, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
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

					helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
						if (new NamedRegexp('error: INTERNAL ERROR -- ').execGroups(stderr)) {
							reject(new Error(stderr + '\n' + stdout));
						}

						if ('' !== stderr) {
							reject(stderr);
							return;
						}

						// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
						const resultMypy = stdout.split(/\r\n|\r|\n/g).map(x => regexLineMypy.execGroups(x)).reduce((total, currParsedMessage) => {
							try {
								if (currParsedMessage) {
									let {line, col, severity, message} = currParsedMessage;

									line = parseInt(line, 10) - 1;
									col = parseInt(col, 10) - 1;
									severity = severity.replace('note', 'info');

									let columnStart = col;
									let columnEnd = col;

									const parsedRegexNameIsNotDefined = new NamedRegexp('^Name \\\'(?<variableName>[^\\\']+)\\\' is not defined').execGroups(message);
									if (message.startsWith('Revealed type is \'')) {
										columnStart -= 'reveal_type('.length;
										columnEnd -= 1;
									} else if (message.startsWith('Return value expected')) {
										columnEnd += 'return'.length;
									} else if (parsedRegexNameIsNotDefined) {
										columnEnd += parsedRegexNameIsNotDefined.variableName.length;
									}

									if (editorPath === currParsedMessage.file) {
										total.push({
											severity,
											location: {
												file: editorPath,
												position: createLintRange(line, columnStart, line, columnEnd)
											},
											excerpt: message,
											description: '',
											url: '',
											solutions: []
										});
									}
								}
							} catch (error) {
								reject(error);
							}

							return total;
						}, []);

						resolve(resultMypy);
					}, err => {
						reject(err);
					});
				}).catch(error => {
					// Well, Well, Well... something went wrong.
					// Instead of crashing or giving cryptic error message, let's try to be user friendly.
					const resultMypy = [];
					if ('ENOENT' === error.code) {
						fetchErrHandling().failToLaunchPython(pythonExecutablePath);
					} else if (error.message) {
						if (new NamedRegexp('ValueError: source code string cannot contain null bytes').execGroups(error.message)) {
							pushLintMsgByte0(resultMypy, editorPath);
						} else {
							fetchErrHandling().failUnknown(error.message);
						}
					} else {
						const parsedUnrecognizedOption = new NamedRegexp('\\[mypy\\]\\: Unrecognized option\\: (?<optionName>[^\\ ]+) =').execGroups(error);
						const parsedNoModuleNamedX = regexNoModuleNamedX.execGroups(error);
						const parsedregexUsageModuleNamedX = regexUsageModuleNamedX.execGroups(error);
						if (new NamedRegexp('^.*The typed_ast package is not installed$').execGroups(error)) {
							fetchErrHandling().failMissingPythonModuleTypeAst(pythonExecutablePath);
						} else if (parsedNoModuleNamedX) {
							fetchErrHandling().failMissingPythonModule(pythonExecutablePath, parsedNoModuleNamedX.moduleName);
						} else if (parsedregexUsageModuleNamedX) {
							fetchErrHandling().failModuleOld(pythonExecutablePath, parsedregexUsageModuleNamedX.moduleName);
						} else if (new NamedRegexp('[^:]+: No \\[mypy\\] section in config file').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'No \\[mypy\\] section in config file');
						} else if (new NamedRegexp('File contains no section headers.').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'No \\[mypy\\] section in config file');
						} else if (new NamedRegexp('configparser.ParsingError:').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'parsing error in config file');
						} else if (new NamedRegexp(': section \'(?<sectionName>.+)\' already exists').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'duplicate \'' + new NamedRegexp(': section \'(?<sectionName>.+)\' already exists').execGroups(error).sectionName + '\' sections detected in config file');
						} else if (new NamedRegexp(': Source contains parsing errors:').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'parsing error in config file');
						} else if (parsedUnrecognizedOption) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'mypy', 'Unrecognized option\'' + parsedUnrecognizedOption.optionName + '\' in config file');
						} else {
							fetchErrHandling().failUnknown('mypy' + error);
						}
					}

					// Something wrong occured, therefore there is no lint message to report.
					return resultMypy;
				}).finally(() => {
					promiseCreator.removeFromDisk(path.dirname(editorPathCopy));
				});
			});
		}
	};
}

function provideLinterPydocstyle() {
	// Declare regex which extract information about the lint messages.
	const regexLinePydocstyle = new NamedRegexp('^(?<file>([A-Z]:)?[^:]+)[:](?<line>\\d+)[^:]*:(?<message>.+)$');
	return {
		name: 'python-linters pydocstyle',
		scope: 'file',
		lintsOnChange: settings.isLintsOnChange(settings.getS(settings.sLintTriggerPydocstyle)),
		grammarScopes: ['source.python', 'source.python.django'],
		lint(textEditor) {
			// Quickly take snapshot of some volatile stuff.
			const editorText = textEditor.getText();
			const editorPath = textEditor.getPath();

			if ('' === editorText) {
				return Promise.resolve([]);
			}

			if ('Never' === settings.getS(settings.sLintTriggerPydocstyle)) {
				return Promise.resolve([]);
			}

			// Sync compute some derived stuff
			const editorPathParsed = path.parse(editorPath); // https://node.readthedocs.io/en/latest/api/path/
			const projectPath = getProjectPath(editorPath);
			const pythonExecutablePath = getPythonExecutablePath(editorPathParsed.dir, projectPath);
			const env = getEnv(getPythonPath(editorPathParsed.dir, projectPath));

			// Prepare some promises
			const configPath = promiseCreator.fileReadableAsync(getConfigPath(editorPathParsed.dir, projectPath));
			const editorPathCopy = promiseCreator.createTempFolder(settings.rawTempFolderPath).then(tempPath => {
				return promiseCreator.createTextFile(path.join(tempPath, editorPathParsed.base), editorText);
			});

			// Do lint.

			return Promise.all([editorPath, editorPathCopy, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
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

					helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
						if ('' !== stderr) {
							reject(stderr);
							return;
						}

						// Combine multi line output and then
						// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
						const resultPydocstyle = stdout.replace(/:(\r\n|\r|\n)\s+/mg, ':').split(/\r\n|\r|\n/g).map(x => regexLinePydocstyle.execGroups(x)).reduce((total, currParsedMessage) => {
							try {
								if (currParsedMessage) {
									let {line, col, severity, message} = currParsedMessage;

									line = parseInt(line, 10) - 1;
									col = parseInt(col, 10) - 1;
									severity = 'info';

									const columnStart = col;
									const columnEnd = col;

									total.push({
										severity,
										location: {
											file: editorPath,
											position: createLintRange(line, columnStart, line, columnEnd)
										},
										excerpt: message,
										description: '',
										url: '',
										solutions: []
									});
								}
							} catch (error) {
								reject(error);
							}

							return total;
						}, []);
						resolve(resultPydocstyle);
					}, err => {
						reject(err);
					});
				}).catch(error => {
					// Well, Well, Well... something went wrong.
					// Instead of crashing or giving cryptic error message, let's try to be user friendly.

					// Something wrong occured, therefore there is no lint message to report.
					const resultPydocstyle = [];
					if ('ENOENT' === error.code) {
						fetchErrHandling().failToLaunchPython(pythonExecutablePath);
					} else if (error.message) {
						fetchErrHandling().failUnknown(error.message);
					} else {
						const parsedNoModuleNamedX = regexNoModuleNamedX.execGroups(error);
						const parsedregexUsageModuleNamedX = regexUsageModuleNamedX.execGroups(error);
						const parsedUnrecognizedOption = new NamedRegexp('WARNING: Unknown option \\\'(?<optionName>[^\\ ]+)\\\' ignored').execGroups(error);

						if (new NamedRegexp('^WARNING: Error in file .+: Cannot parse file\\.$').execGroups(error)) {
							pushLintMsgPythonParseError(resultPydocstyle, editorPath);
						} else if (new NamedRegexp('SyntaxWarning:').execGroups(error)) {
							pushLintMsgPythonParseError(resultPydocstyle, editorPath);
						} else if (new NamedRegexp('MissingSectionHeaderError: File contains no section headers.').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'No \\[pydocstyle\\] section in config file');
						} else if (new NamedRegexp('configparser.DuplicateSectionError').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'duplicate sections detected in config file');
						} else if (new NamedRegexp('^WARNING: Configuration file does not contain a pydocstyle section. Using default configuration.').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'No \\[pydocstyle\\] section in config file');
						} else if (parsedUnrecognizedOption) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'Unrecognized option\'' + parsedUnrecognizedOption.optionName + '\' in config file');
						} else if (new NamedRegexp('configparser.ParsingError').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pydocstyle', 'parsing error in config file');
						} else if (parsedNoModuleNamedX) {
							fetchErrHandling().failMissingPythonModule(pythonExecutablePath, parsedNoModuleNamedX.moduleName);
						} else if (parsedregexUsageModuleNamedX) {
							fetchErrHandling().failModuleOld(pythonExecutablePath, parsedregexUsageModuleNamedX.moduleName);
						} else if (new NamedRegexp('ValueError: source code string cannot contain null bytes').execGroups(error)) {
							pushLintMsgByte0(resultPydocstyle, editorPath);
						} else {
							fetchErrHandling().failUnknown('pydocstyle' + error);
						}

						return resultPydocstyle;
					}
				}).finally(() => {
					promiseCreator.removeFromDisk(path.dirname(editorPathCopy));
				});
			});
		}
	};
}

function provideLinterPylint() {
	// Declare regex which extract information about the lint messages.
	const regexLinePylint = new NamedRegexp('^(?<file>([A-Z]\\:)?[^:]+)\\:(?<line>\\d+)\\:(?:(?<col>\\d+)\\:)?\\ (?<message>(?<code>[^:]+)\\:.+)$');
	return {
		name: 'python-linters pylint',
		scope: 'file',
		lintsOnChange: settings.isLintsOnChange(settings.getS(settings.sLintTriggerPylint)),
		grammarScopes: ['source.python', 'source.python.django'],
		lint(textEditor) {
			// Quickly take snapshot of some volatile stuff.
			const editorText = textEditor.getText();
			const editorPath = textEditor.getPath();

			if ('' === editorText) {
				return Promise.resolve([]);
			}

			if ('Never' === settings.getS(settings.sLintTriggerPylint)) {
				return Promise.resolve([]);
			}

			// Sync compute some derived stuff
			const editorPathParsed = path.parse(editorPath); // https://node.readthedocs.io/en/latest/api/path/
			const projectPath = getProjectPath(editorPath);

			// Prepare some promises
			const pythonExecutablePath = new Promise((resolve, reject) => {
				resolve(getPythonExecutablePath(editorPathParsed.dir, projectPath));
			});
			const env = new Promise((resolve, reject) => {
				resolve(getEnv(getPythonPath(editorPathParsed.dir, projectPath)));
			});
			const configPath = promiseCreator.fileReadableAsync(getConfigPath(editorPathParsed.dir, projectPath));

			// Do lint.
			return Promise.all([editorPath, editorText, pythonExecutablePath, env, configPath, editorPathParsed.root].map(x => Promise.resolve(x))).then(values => {
				const editorPath = values[0];
				const editorText = values[1];
				const pythonExecutablePath = values[2];
				const env = values[3];
				const configPath = values[4];
				const editorPathRoot = values[5];

				return new Promise((resolve, reject) => {
					const options = {
						stream: 'both',
						stdin: editorText,
						ignoreExitCode: true,
						cwd: editorPathRoot,
						env,
						timeout: Infinity};

					const params = [];
					params.push('-m');
					params.push('pylint');

					if (configPath) {
						options.cwd = path.dirname(configPath);
						params.push('--rcfile');
						params.push(configPath);
					}

					params.push('--score');
					params.push('n');
					params.push('--output-format');
					params.push('text');

					params.push('--from-stdin');
					params.push(editorPath);
					helpers.exec(pythonExecutablePath, params, options).then(({stdout, stderr, exitCode}) => {
						if ('' !== stderr) {
							reject(stderr);
							return;
						}

						// Each line of the output may be a potential lint message so we create an array of string containing each line of the output.
						const resultPylint = stdout.split(/\r\n|\r|\n/g).map(x => regexLinePylint.execGroups(x)).reduce((total, currParsedMessage) => {
							try {
								if (currParsedMessage) {
									let {line, col, severity, message, code} = currParsedMessage;

									line = parseInt(line, 10) - 1;
									col = parseInt(col, 10);
									severity = decodeSeverity(message);

									let columnStart = col;
									let columnEnd = col;

									if (message.startsWith('W0107: Unnecessary pass statement')) {
										columnEnd += 'pass'.length;
									} else {
										const parsedRegexE0602 = new NamedRegexp('^E0602: Undefined variable \'(?<variableName>[^\\\']+)\'').execGroups(message);
										const parsedRegexC0103a = new NamedRegexp('^C0103: Class name "(?<className>[^"]+)" doesn\'t conform to PascalCase naming style').execGroups(message);
										const parsedRegexC0103b = new NamedRegexp('^C0103: Method name "(?<methodName>[^"]+)" doesn\'t conform to snake_case naming style').execGroups(message);
										if (parsedRegexE0602) {
											columnEnd += parsedRegexE0602.variableName.length;
										}

										if (parsedRegexC0103a) {
											columnStart += 'class '.length;
											columnEnd = columnStart + parsedRegexC0103a.className.length;
										}

										if (parsedRegexC0103b) {
											columnStart += 'def '.length;
											columnEnd = columnStart + parsedRegexC0103b.methodName.length;
										}
									}

									total.push({
										severity,
										location: {
											file: editorPath,
											position: createLintRange(line, columnStart, line, columnEnd)
										},
										excerpt: message,
										description: '',
										url: 'http://pylint-messages.wikidot.com/messages:' + code,
										solutions: []
									});
								}
							} catch (error) {
								reject(error);
							}

							return total;
						}, []);
						resolve(resultPylint);
					}, err => {
						reject(err);
					});
				}).catch(error => {
					// Well, Well, Well... something went wrong.
					const resultPylint = [];
					// Instead of crashing or giving cryptic error message, let's try to be user friendly.

					if ('ENOENT' === error.code) {
						fetchErrHandling().failToLaunchPython(pythonExecutablePath);
					} else {
						const parsedNoModuleNamedX = regexNoModuleNamedX.execGroups(error);
						const parsedregexUsageModuleNamedX = regexUsageModuleNamedX.execGroups(error);
						if (parsedNoModuleNamedX) {
							fetchErrHandling().failMissingPythonModule(pythonExecutablePath, parsedNoModuleNamedX.moduleName);
						} else if (parsedregexUsageModuleNamedX) {
							fetchErrHandling().failModuleOld(pythonExecutablePath, parsedregexUsageModuleNamedX.moduleName);
						} else if (new NamedRegexp('Parsing Python code failed').execGroups(error)) {
							pushLintMsgPythonParseError(resultPylint, editorPath);
						} else if (error.message) {
							fetchErrHandling().failUnknown(error.message);
						} else if (new NamedRegexp(': Source contains parsing errors:').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'parsing error in config file');
						} else if (new NamedRegexp('configparser.MissingSectionHeaderError:').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'parsing error in config file');
						} else if (new NamedRegexp('configparser.DuplicateSectionError').execGroups(error)) {
							fetchErrHandling().failConfigFileInvalid(configPath, 'pylint', 'duplicate sections detected in config file');
						} else if (new NamedRegexp('AttributeError: \'list\' object has no attribute \'args\'')) {
							pushLintMsgPythonParseError(resultPylint, editorPath);
						} else {
							fetchErrHandling().failUnknown('pylint' + error);
						}

						return resultPylint;
					}
				});
			});
		}
	};
}

function provideLinter() {
	return [provideLinterFlake8(), provideLinterMypy(), provideLinterPydocstyle(), provideLinterPylint()];
}

module.exports = {provideLinter};
