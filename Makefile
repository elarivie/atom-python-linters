#!/usr/bin/make -f

APM=apm
ATOM=atom
CAT=cat
CUT=cut
ECHO=echo
GIT=git
GREP=grep
NPM=npm
RM=rm
SED=sed
SORT=sort
UNIQ=uniq

+THENAME:=$(shell $(CAT) NAME)


.PHONY: clean
clean:	## Clean the project folder
	${GIT} clean -f -x -d;

.PHONY: npmInstall
npmInstall:	## Install node_modules dependencies
	${RM} -f package-lock.json;
	- [ ! -d "./node_modules" ] && ${NPM} install;

.PHONY: lint
lint: npmInstall	## Lint source code
	${NPM} run lint;

.PHONY: test
test: npmInstall	## Run unit-tests
	${NPM} run test;

.PHONY: AUTHORS
AUTHORS:	## Update the authors list
	${ECHO} "Authors\n=======\nWe'd like to thank the following people for their contributions.\n\n" > AUTHORS.md;
	${GIT} log --raw | ${GREP} "^Author: " | ${SORT} | ${UNIQ} | ${GREP} -v "@users.noreply.github.com" | ${CUT} -d ' ' -f2- | ${SED} 's/^/- /' >> AUTHORS.md;
	${GIT} add AUTHORS.md;

HEARTBEAT:	## Update the HEARTBEAT
	${DATE} --utc +%Y-%m > HEARTBEAT;
	${GIT} add HEARTBEAT;

.PHONY: gitcommit
gitcommit: AUTHORS HEARTBEAT	## Create a git commit
	- ${GIT} commit;

.PHONY: gitpull
gitpull:	## Do a git pull
	${GIT} pull --rebase;

.PHONY: gitpush	## Do a safe git push
gitpush: lint test
	${GIT} push;

.PHONY: atomPublishMajor
atomPublishMajor: gitcommit	## Publish a new major version X.#.# of the package
	${APM} publish major;
.PHONY: atomPublishMinor
atomPublishMinor: gitcommit	## Publish a new minor version #.X.# of the package
	${APM} publish minor;
.PHONY: atomPublishPatch
atomPublishPatch: gitcommit	## Publish a new patch version #.#.X of the package
	${APM} publish patch;
.PHONY: atomPublishBuild
atomPublishBuild: gitcommit;	## (Never use)
	${APM} publish build;

.PHONY: develop
develop:	## Launch an atom instance in a ready to go development mode of the current package.
	[ -d ~/.atom/dev/packages/${THENAME} ] || ${APM} develop "${THENAME}";
	${ATOM} -d "~/.atom/dev/packages/${THENAME}";

.PHONY: help
help:	## Show the list of available targets
	@ ${GREP} -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}';

.DEFAULT_GOAL := help
