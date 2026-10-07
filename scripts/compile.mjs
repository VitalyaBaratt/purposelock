import fs from 'node:fs';
import solc from 'solc';
const sources = {};
for (const file of ['contracts/PurposeLock.sol', 'contracts/test/MockUSDC.sol']) sources[file] = {content: fs.readFileSync(file, 'utf8')};
const input = {language:'Solidity', sources, settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences','metadata']}}}};
const output = JSON.parse(solc.compile(JSON.stringify(input), {import: path => {
  const content = fs.readFileSync(`node_modules/${path}`, 'utf8');
  sources[path] = {content};
  return {contents:content};
}}));
for (const e of output.errors ?? []) console[e.severity === 'error' ? 'error' : 'warn'](e.formattedMessage);
if (output.errors?.some(e => e.severity === 'error')) process.exit(1);
fs.mkdirSync('artifacts', {recursive:true});
fs.mkdirSync('src/generated', {recursive:true});
for (const [file, name] of [['contracts/PurposeLock.sol','PurposeLock'],['contracts/test/MockUSDC.sol','MockUSDC']]) {
 const c = output.contracts[file][name];
 fs.writeFileSync(`artifacts/${name}.json`, JSON.stringify({contractName:name,abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`,deployedBytecode:`0x${c.evm.deployedBytecode.object}`,immutableReferences:c.evm.deployedBytecode.immutableReferences,compiler:solc.version()}, null, 2));
 if (name === 'PurposeLock') fs.writeFileSync('src/generated/abi.json', JSON.stringify(c.abi));
}
// Complete Standard JSON input for explorer verification, including imported sources.
fs.writeFileSync('artifacts/standard-input.json', JSON.stringify(input, null, 2));
console.log(`Compiled PurposeLock with ${solc.version()} (Shanghai, optimizer 200).`);
