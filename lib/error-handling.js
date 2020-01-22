'use strict';

// Shared logic
function btnAdjustConfigFile(notification, configPath) {
	return {
		text: 'Fix the linting configuration file',
		onDidClick: () => {
			atom.workspace.open(configPath);
			notification().dismiss();
		}
	};
}

function btnAdjustSettings(notification) {
	return {
		text: 'Adjust the python-linters setting',
		onDidClick: () => {
			atom.workspace.open('atom://config/packages/python-linters');
			notification().dismiss();
		}
	};
}

function btnDeactivate(notification, moduleName) {
	return {
		text: 'Deactivate linting with ' + moduleName,
		onDidClick: () => {
			atom.config.set('python-linters.lintTrigger.' + moduleName, 'Never');
			notification().dismiss();
		}
	};
}

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
				btnAdjustSettings(() => notification)
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
				btnAdjustSettings(() => notification),
				btnDeactivate(() => notification, 'mypy')
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
				btnAdjustSettings(() => notification),
				btnDeactivate(() => notification, missingModuleName)
			],
			dismissable: true
		}
	);
}

function failModuleOld(pythonExecutablePath, oldModuleName) {
	const notification = atom.notifications.addWarning(
		'The python module <strong>' + oldModuleName + '</strong> does not understand provided parameters.<br />Make sure the latest version is installed with ' + pythonExecutablePath + ' -m pip install -U ' + oldModuleName + ('mypy' === oldModuleName ? ' typed-ast' : ''),
		{
			buttons: [
				btnAdjustSettings(() => notification),
				btnDeactivate(() => notification, oldModuleName)
			],
			dismissable: true
		}
	);
}

function failUnknown(message) {
	// An unknown bad thing occured.
	atom.notifications.addError(JSON.stringify(message));
	throw message;
}

function failConfigFileInvalid(configPath, moduleName, detail) {
	const notification = atom.notifications.addWarning(
		'The configuration file is invalid for ' + moduleName + ': ' + configPath + '<br><strong>' + detail + '<strong>',
		{
			buttons: [
				btnAdjustSettings(() => notification),
				btnDeactivate(() => notification, moduleName),
				btnAdjustConfigFile(() => notification, configPath)
			],
			dismissable: true
		}
	);
}

module.exports = {failToLaunchPython, failMissingPythonModule, failMissingPythonModuleTypeAst, failModuleOld, failConfigFileInvalid, failUnknown};
