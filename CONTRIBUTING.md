# **☮** Thanks for considering contributing to the project.

Every pull request will be acted upon in a timely manner.

This document will help you get up to speed.

## Recurring actions

A Makefile which provide recurring actions shortcut is present at the root of the project.

You can call 'make' without target name to get a list and description of available actions.

## Project structure
* **./index.js**
	* Project entry point
	* Should be kept as slim as possible
* **./lib/***
	* Project source code
* **./spec/***
	* Project unit tests
* **./spec/fixtures/***
	* Project unit tests data files

## Development

### Development environment

There are no restriction about the development environment to use but You should use the [atom](https://atom.io/) editor with the following package:
* apm install [editorconfig](https://atom.io/packages/editorconfig)
* apm install [linter-xo](https://atom.io/packages/linter-xo)

You should then use:

		make develop

This last command will launch an atom editor in development mode, with the project open for edition and loaded for live testing.  Unit tests can manually be triggered through the atom menu:

	View > Developer> Run Package Specs

**Note:** You will have to close atom and redo 'make develop' to reload your latest changes to ./index.js and ./lib/*


When developing you should adhere to the rules defined within [.editorconfig](./.editorconfig), the lint tool and existing unit‑test must pass.

 Writing new unit‑tests is encouraged but optional.  Don't be afraid to write some to validate your modifications.

**Hint:** Other make commands are available but while developing you should probably use the following commands:
* make lint
* make test
* make gitpull
* make gitpush

## Git Commits

Git commit message should be the completion of the sentence "This git commit **…**"

Once your changes are done, you are encouraged to clean git history with

		git rebase -i
