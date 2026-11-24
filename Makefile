.PHONY: build package test watch serve start dev

build:
	npm run build

package:
	npm run package

test:
	npm test

watch:
	npm run dev

serve:
	npm start

start: serve

dev:
	npm run dev -- --servedir=. --serve=127.0.0.1:8081
