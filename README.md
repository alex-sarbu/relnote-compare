## Usage

### Extract from Excel release notes

- copy all xlsx files to ./input/
- run `node main.js`
- json will be saved to ./relnote-viewer/src/assets/relnotes.json

### Anonymize json

requires [jsonymize](https://github.com/cameronhunter/jsonymize)

run in ./relnote-viewer/src/assets/:
`cat relnotes.json | jsonymize -c ../../../jsonymize.config.json > relnotes.json.tmp && mv relnotes.json.tmp relnotes.json`