Atom-Python-Linters
==================

[![WIP](https://www.repostatus.org/badges/latest/wip.svg "WIP")](https://www.repostatus.org/#wip)

**KISS solution to lint python code within Atom.**

This [atom](https://atom.io/) package is a All-In-One linter for python code, it internally use multiple linting tools:

- [Flake8](https://pypi.org/project/flake8/)
- [Mypy](https://pypi.org/project/mypy/)
- [Pydocstyle](https://pypi.org/project/pydocstyle/)
- [Pylint](https://pypi.org/project/pylint/)

To keep it simple, the only supported configuration file format is setup.cfg <a href="http://renesd.blogspot.com/2017/02/setupcfg-solution-to-python-config-file.html">which is supported by all of the above lint tool</a>.

## Prerequisites

- [atom](https://atom.io/) must be installed which will provide the apm command aka *Atom Package Manager*.


## Installation steps

	apm install python-linters

## Alternatives

Use the following atom linting packages:
- https://atom.io/packages/linter-flake8
- https://atom.io/packages/linter-mypy
- https://atom.io/packages/linter-pydocstyle
- https://atom.io/packages/linter-pylint

## License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details

## 👩👨
* [You want to contribute?](CONTRIBUTING.md)
* [You need support?](SUPPORT.md)
