'use strict';

function failToLaunchPython(pythonExecutablePath) {
	/*
	The Problem: The error is about a process spawn which failed
	The Context: At this point the process we launched was Python using the provided path in the setting @pythonExecutablePath
	The Conclusion: The provided executable path is therefore probably incorrect
	The Solution: Let's:
		1- Inform the user about the situation with a pop-up.
		2- Offer him a link to adjust the setting.
	*/
	const notification = atom.notifications.addWarning(
		'The executable of <strong>' + pythonExecutablePath + '</strong> was not found.<br />Either install <a href="https://www.python.org/downloads/">python</a> or adjust the python executable path setting of python-linters.',
		{
			buttons: [
				{
					text: 'Adjust the python-linters setting',
					onDidClick: () => {
						atom.workspace.open('atom://config/packages/pynthon-linters');
						notification.dismiss();
					}
				}
			],
			dismissable: true
		}
	);
}

function failMissingPythonModuleTypeAst(pythonExecutablePath) {
	const notification = atom.notifications.addWarning(
		'The python module <strong>typed_ast</strong> required by mypy was not found.<br />Install it with ' + pythonExecutablePath + ' -m pip install -U typed_ast',
		{
			buttons: [
				{
					text: 'Adjust the python-linters setting',
					onDidClick: () => {
						atom.workspace.open('atom://config/packages/pynthon-linters');
						notification.dismiss();
					}
				},
				{
					text: 'Deactivate linting with mypy',
					onDidClick: () => {
						atom.config.set('python-linters.useLintTool.mypy', false);
						notification.dismiss();
					}
				}
			],
			dismissable: true
		}
	);
}

function failMissingPythonModule(pythonExecutablePath, missingModuleName) {
	const notification = atom.notifications.addWarning(
		'The python module <strong>' + missingModuleName + '</strong> was not found.<br />Install it with ' + pythonExecutablePath + ' -m pip install -U ' + missingModuleName,
		{
			buttons: [
				{
					text: 'Adjust the python-linters setting',
					onDidClick: () => {
						atom.workspace.open('atom://config/packages/pynthon-linters');
						notification.dismiss();
					}
				},
				{
					text: 'Deactivate linting with ' + missingModuleName,
					onDidClick: () => {
						atom.config.set('python-linters.useLintTool.' + missingModuleName, false);
						notification.dismiss();
					}
				}
			],
			dismissable: true
		}
	);
}

function failModuleOld(pythonExecutablePath, oldModuleName) {
	const notification = atom.notifications.addWarning(
		'The python module <strong>' + oldModuleName + '</strong> does not understand provided parameters.<br />Make sure the latest version is installed with ' + pythonExecutablePath + ' -m pip install -U ' + oldModuleName,
		{
			buttons: [
				{
					text: 'Adjust the python-linters setting',
					onDidClick: () => {
						atom.workspace.open('atom://config/packages/pynthon-linters');
						notification.dismiss();
					}
				},
				{
					text: 'Deactivate linting with ' + oldModuleName,
					onDidClick: () => {
						atom.config.set('python-linters.useLintTool.' + oldModuleName, false);
						notification.dismiss();
					}
				}
			],
			dismissable: true
		}
	);
}

function failUnknown(message) {
	// An unknown bad thing occured.
	atom.notifications.addError(JSON.stringify(message));
}

function failConfigFileInvalid(configPath, moduleName, detail) {
	const notification = atom.notifications.addWarning(
		'The configuration file is invalid for ' + moduleName + ': ' + configPath + '<br><strong>' + detail + '<strong>',
		{
			buttons: [
				{
					text: 'Adjust the python-linters setting',
					onDidClick: () => {
						atom.workspace.open('atom://config/packages/pynthon-linters');
						notification.dismiss();
					}
				},
				{
					text: 'Deactivate linting with ' + moduleName,
					onDidClick: () => {
						atom.config.set('python-linters.useLintTool.' + moduleName, false);
						notification.dismiss();
					}
				},
				{
					text: 'Fix the linting configuration file',
					onDidClick: () => {
						atom.workspace.open(configPath);
						notification.dismiss();
					}
				}
			],
			dismissable: true
		}
	);
}

module.exports = {failToLaunchPython, failMissingPythonModule, failMissingPythonModuleTypeAst, failModuleOld, failConfigFileInvalid, failUnknown};
