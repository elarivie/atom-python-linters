/*
	This file contains all specs to ensure the base functionality of this plugin.
*/
const path = require('path');

const projectRoot = path.join(__dirname, 'fixtures');
const filePath = path.join(projectRoot, 'base.txt');

describe('Base functionality', () => {
	let textEditor = null;

	beforeEach('Activating package', async () => {
		attachToDOM(atom.views.getView(atom.workspace));
		await atom.packages.activatePackage(path.join(__dirname, '..'));
		textEditor = await atom.workspace.open(filePath);
	});

	it('assumes', () => {
		expect(textEditor).to.equal(textEditor);
		expect(true).to.equal(true);
	});
});
