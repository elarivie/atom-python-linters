[Atom-Python-Linters](https://atom.io/packages/python-linters)
===================

**KISS solution to lint python code within Atom.**

[![repo status Active](https://www.repostatus.org/badges/latest/active.svg "repo status Active")](https://www.repostatus.org/#active)
[![last commit](https://img.shields.io/github/last-commit/elarivie/atom-python-linters)](https://github.com/elarivie/atom-python-linters/commits/master)

[![python-linters_BugTracker](https://img.shields.io/github/issues/elarivie/atom-python-linters.svg)][python-linters_BugTracker]
[![Build Status](https://travis-ci.org/elarivie/atom-python-linters.svg?branch=master)](https://travis-ci.org/elarivie/atom-python-linters)

This [atom][atom homepage] package is a All-In-One linter for [python][python homepage] code, it internally use multiple linting tools:

- [flake8][flake8 homepage]
- [mypy][mypy homepage]
- [pydocstyle][pydocstyle homepage]
- [pylint][pylint homepage]

To keep it simple, the only supported configuration file format is setup.cfg <a href="http://renesd.blogspot.com/2017/02/setupcfg-solution-to-python-config-file.html">which is supported by all of the above lint tool</a>.

## Prerequisites

- [atom](https://atom.io/) must be installed which will provide the apm command aka *Atom Package Manager*.


## Installation steps

	apm install python-linters

## ⎇ Alternatives

Use the following atom linting packages:
- https://atom.io/packages/linter-flake8
- https://atom.io/packages/linter-mypy
- https://atom.io/packages/linter-pydocstyle
- https://atom.io/packages/linter-pylint

## ⚖️ License

This project is licensed under the MIT License - see the [LICENSE.txt](LICENSE.txt) file for details

## 👩👨
* [You want to contribute?](CONTRIBUTING.md)
* [You need support?](SUPPORT.md)

[atom homepage]: https://atom.io/
[python homepage]: https://www.python.org
[flake8 homepage]: http://flake8.pycqa.org/
[mypy homepage]: http://www.mypy-lang.org/
[pydocstyle homepage]: https://pypi.org/project/pydocstyle/
[pylint homepage]: https://www.pylint.org/

[python-linters_BugTracker]: https://github.com/elarivie/atom-python-linters/issues
