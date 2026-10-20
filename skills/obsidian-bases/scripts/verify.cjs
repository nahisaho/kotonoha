'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { spawn } = require('node:child_process');

const repository = path.resolve(__dirname, '..', '..', '..');
const docs = path.join(repository, 'docs', 'obsidian-bases');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const cases = read(path.join(docs, 'acceptance-cases.json'));
const boundaries = read(path.join(docs, 'boundary-cases.json'));
const measured = read(path.join(docs, 'boundary-verification.json'));
const correctedMeasurements = new Map(read(path.join(docs, 'boundary-correction-verification.json'))
  .cases.map(entry => [entry.id, entry]));
const contract = read(path.join(__dirname, '..', 'references', 'execution-contract.json'));
const Ajv = require(path.join(__dirname, 'node_modules', 'ajv', 'dist', '2020.js'));
const ajv = new Ajv({ strict: true, strictRequired: false, allErrors: true, allowUnionTypes: true, ownProperties: true });
const schema = Object.fromEntries(Object.entries(contract).filter(([key]) => !key.startsWith('x-')));
const validReport = ajv.compile({ ...schema, $ref: '#/$defs/Report' });
const validUsage = ajv.compile({ ...schema, $ref: '#/$defs/Usage' });
const checker = path.join(__dirname, 'check.cjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value) + '\n';
const B = 'views: [{type: table, name: A}]\n';
const E = expression => 'formulas:\n  x: ' + JSON.stringify(expression) + '\n' + B;
const request = (document = B, overrides = {}) =>
  ({ schema_version: 1, intent: 'inspect', document, application_version: '1.14.0', ...overrides });
const diagnostic = (code, category, at = [], related = [], line = null, column = null) =>
  ({ code, category, path: at, line, column, related });
const normalizeIssue = entry => diagnostic(entry.code, entry.category, entry.path,
  entry.related || [], entry.line ?? null, entry.column ?? null);

function expectedReport(input, expected) {
  const early = expected.structure === 'unprocessed';
  return {
    schema_version: 1,
    status: ({ 0: 'completed', 1: 'failed', 2: 'not_performed', 3: 'partial', 4: 'not_performed' })[expected.exit_code],
    exit_code: expected.exit_code,
    structure: expected.structure,
    source_sha256: early || expected.nullHash ? null : sha(Buffer.from(input.document, 'utf8')),
    static_checks_passed: expected.static_checks_passed,
    issues: expected.issues.map(normalizeIssue),
    unprocessed: expected.unprocessed || [],
    read_only: true,
    authorization: 'not_assessed',
    write_status: 'not_requested',
    render_check: 'not_performed',
    expression_evaluation: 'not_performed',
    proofread_gate: !early && input.intent === 'proofread' ? 'external_required' : 'not_requested',
    application_version: early ? null : input.application_version,
    application_version_source: 'user_declared'
  };
}

function earlyReport(code = 'invalid_input') {
  return expectedReport(null, {
    exit_code: code === 'dependency_missing' ? 4 : 1,
    structure: 'unprocessed', static_checks_passed: false,
    issues: [diagnostic(code, { invalid_input: 'input', dependency_missing: 'capability', runtime_error: 'runtime' }[code])]
  });
}

function run(input, args = ['--stdin'], entry = checker, options = {}) {
  const execution = spawnSync(process.execPath, [entry, ...args], {
    input: typeof input === 'string' || Buffer.isBuffer(input) ? input : JSON.stringify(input),
    encoding: 'utf8', maxBuffer: 3 * 1048576, timeout: 30000, ...options
  });
  assert.ifError(execution.error);
  assert.equal(execution.signal, null);
  assert.equal(execution.stderr, '');
  return execution;
}

function compare(execution, expected) {
  const actual = JSON.parse(execution.stdout);
  assert.equal(validReport(actual), true, JSON.stringify(validReport.errors));
  assert.equal(execution.status, expected.exit_code);
  assert.deepEqual(actual, expected);
  assert.equal(execution.stdout, canonical(expected));
  return actual;
}

const complete = () => ({ exit_code: 0, structure: 'supported', static_checks_passed: true, issues: [] });
const unsupported = (code, at) => ({
  exit_code: 3, structure: 'unsupported', static_checks_passed: false,
  issues: [diagnostic(code, 'unsupported', at)], unprocessed: [at]
});
const invalid = (code, at, related = [], category = 'format') => ({
  exit_code: 2, structure: 'invalid', static_checks_passed: false,
  issues: [diagnostic(code, category, at, related)]
});

for (const entry of cases.diagnostic_cases) {
  test(entry.id + ': independent diagnostic oracle', () => {
    let document = entry.raw ?? cases.documents[entry.document];
    for (const [before, after] of entry.replace || []) {
      assert.equal(document.split(before).length, 2, 'fixture replacement must occur exactly once');
      document = document.replace(before, after);
    }
    document = (entry.prefix || '') + document + (entry.append || '');
    const input = request(document, {
      intent: entry.intent || 'inspect',
      application_version: Object.prototype.hasOwnProperty.call(entry, 'application_version') ? entry.application_version : '1.14.0'
    });
    compare(run(input), expectedReport(input, entry.expected));
  });
}

// These constructors expand the approved notation; no product output is used.
const r01 = B + '#' + 'a'.repeat(1048576 - Buffer.byteLength(B) - 2) + '\n';
// Approved boundary-correction.json supersedes only R19/R20/R23 inputs and hashes.
const r19 = '? ' + 'a'.repeat(523997) + '\n: 0\n';
const materialized = [
  request(r01), request(r01 + ' '),
  request('x: ' + '['.repeat(63) + '0' + ']'.repeat(63) + '\n'),
  request('x: ' + '['.repeat(64) + '0' + ']'.repeat(64) + '\n'),
  request('x: [' + Array(9997).fill('0').join(',') + ']\n'),
  request('x: [' + Array(9998).fill('0').join(',') + ']\n'),
  request(E('"' + 'a'.repeat(4094) + '"')),
  request(E('"' + 'a'.repeat(4095) + '"')),
  request(E('[' + Array(1023).fill('1').join(',') + ']')),
  request(E('[' + Array(1024).fill('1').join(',') + ']')),
  request(E('1+'.repeat(63) + '1')), request(E('1+'.repeat(64) + '1')),
  request(E('('.repeat(64) + '1' + ')'.repeat(64))),
  request(E('('.repeat(65) + '1' + ')'.repeat(65))),
  request('formulas:\n' + Array.from({ length: 256 }, (_, i) => '  f' + i + ': "1"\n').join('') + B),
  request('formulas:\n' + Array.from({ length: 257 }, (_, i) => '  f' + i + ': "1"\n').join('') + B),
  request('views:\n' + '  - {type: table, name: A}\n'.repeat(257)),
  request('views:\n' + '  - {type: table, name: A}\n'.repeat(258)),
  request(r19), request(r19, { application_version: '01.14.0' }),
  request(), request(), request(r19 + 'views: [{type: table, name: true}]\n')
];
const stdinAtCap = JSON.stringify(request()).padEnd(16777216, ' ');
assert.equal(Buffer.byteLength(stdinAtCap), 16777216);
assert.equal(boundaries.cases.length, materialized.length);
for (let i = 0; i < materialized.length; i++) {
  const oracle = boundaries.cases[i];
  const evidence = correctedMeasurements.get(oracle.id) || measured.cases[i];
  test(oracle.id + ': actual inclusive resource boundary and independent report hash', () => {
    const input = materialized[i];
    let expected = complete();
    if (oracle.expected === 'resource') expected = unsupported('limit_exceeded', oracle.P);
    else if (oracle.id === 'R03' || oracle.id === 'R05') expected = unsupported('unknown_key', ['x']);
    else if (oracle.id === 'R17') expected.issues = Array.from({ length: 256 }, (_, index) =>
      diagnostic('duplicate_view_name', 'caution', ['views', index + 1, 'name'], ['0']));
    else if (oracle.id === 'R19') expected = unsupported('unknown_key', ['a'.repeat(523997)]);
    else if (oracle.id === 'R22') expected = {
      exit_code: 1, structure: 'unprocessed', static_checks_passed: false,
      issues: [diagnostic('invalid_input', 'input')]
    };
    else if (oracle.id === 'R23') expected = {
      ...unsupported('limit_exceeded', []), exit_code: 2, structure: 'invalid'
    };
    const wanted = expectedReport(input, expected);
    assert.equal(Buffer.byteLength(input.document), evidence.document_bytes);
    assert.equal(wanted.source_sha256, evidence.source_sha256);
    assert.equal(wanted.exit_code, evidence.expected_exit_code);
    assert.equal(wanted.structure, evidence.expected_structure);
    assert.equal(Buffer.byteLength(canonical(wanted)), evidence.expected_report_bytes);
    assert.equal(sha(canonical(wanted)), evidence.report_sha256, 'independent expected Report must match approved hash');
    const raw = oracle.id === 'R21' ? stdinAtCap : oracle.id === 'R22' ? stdinAtCap + ' ' : input;
    const execution = run(raw);
    compare(execution, wanted);
    assert.equal(sha(execution.stdout), evidence.report_sha256);
  });
}

test('original implicit overlong key remains invalid YAML under strict parsing', () => {
  const input = request('a'.repeat(523997) + ': 0\n');
  const expected = {
    ...invalid('invalid_yaml', []),
    issues: [diagnostic('invalid_yaml', 'format', [], [], 1, 1)]
  };
  compare(run(input), expectedReport(input, expected));
});

test('C01: valid request', () => compare(run(request()), expectedReport(request(), complete())));
test('output bytes: strict-valid explicit long key at exactly 1MiB, plus one metadata byte, and invalid dominance', () => {
  const key = 'a'.repeat(523997);
  const document = '? ' + key + '\n: 0\n';
  const atCap = request(document);
  const expected = expectedReport(atCap, unsupported('unknown_key', [key]));
  assert.equal(Buffer.byteLength(canonical(expected)), 1048576);
  compare(run(atCap), expected);
  const above = request(document, { application_version: '01.14.0' });
  const unbounded = expectedReport(above, unsupported('unknown_key', [key]));
  assert.equal(Buffer.byteLength(canonical(unbounded)), 1048577);
  compare(run(above), expectedReport(above, unsupported('limit_exceeded', [])));
  const mixed = request(document + 'views: [{type: table, name: true}]\n');
  compare(run(mixed), expectedReport(mixed, {
    ...unsupported('limit_exceeded', []), exit_code: 2, structure: 'invalid'
  }));
});
test('C02: help ignores stdin and does not require dependencies', () => {
  const execution = run('not JSON', ['--help']);
  assert.equal(execution.status, 0);
  assert.equal(validUsage(JSON.parse(execution.stdout)), true);
  assert.equal(execution.stdout, canonical(boundaries.command_reports.help));
});
const badArguments = [
  [], ['--std'], ['--stdin', '--stdin'], ['--path', '/must-not-open'],
  ['--stdin', 'extra'], ['--help', '--stdin'], ['--help', '--help'], ['--stdin=true'],
  ['--'], ['--unknown'], ['--STDIN']
];
for (const args of badArguments) test('C03-C07: rejected arguments ' + JSON.stringify(args), () =>
  compare(run('', args), earlyReport()));

const validJSON = JSON.stringify(request());
const badControls = [
  ['duplicate root key', validJSON.replace('"schema_version":1', '"schema_version":1,"schema_version":1')],
  ['duplicate nested key', validJSON.replace('"document":', '"unexpected":{"a":1,"a":2},"document":')],
  ['escaped duplicate key', validJSON.replace('"schema_version":1', '"schema_version":1,"schema_\\u0076ersion":1')],
  ['JSON comment', '/* no */' + validJSON],
  ['JSON trailing comma', validJSON.slice(0, -1) + ',}'],
  ['invalid UTF8', Buffer.from([0xc0, 0xaf])],
  ['truncated UTF8', Buffer.from([0xe3, 0x81])],
  ['encoded surrogate', Buffer.from([0xed, 0xa0, 0x80])],
  ['empty', ''], ['whitespace', ' \n\t'], ['literal null', 'null'],
  ['control BOM', '\uFEFF' + validJSON], ['extra JSON value', validJSON + '{}'],
  ['unknown key', JSON.stringify({ ...request(), vault_path: '/must-not-open' })],
  ['wrong document type', JSON.stringify(request(1))],
  ['wrong schema type', JSON.stringify(request(B, { schema_version: '1' }))],
  ['unsafe schema integer', validJSON.replace('"schema_version":1', '"schema_version":9007199254740993')],
  ['unsafe version number', JSON.stringify(request(B, { application_version: 9007199254740992 }))],
  ['wrong intent', JSON.stringify(request(B, { intent: 'save' }))],
  ['wrong version syntax', JSON.stringify(request(B, { application_version: 'v1.14.0' }))],
  ['oversized version component', JSON.stringify(request(B, { application_version: '1000.14.0' }))],
  ...['schema_version', 'intent', 'document', 'application_version'].map(key => {
    const input = request(); delete input[key]; return ['missing ' + key, JSON.stringify(input)];
  })
];
for (const [name, raw] of badControls) test('C08-C11: strict control ' + name, () =>
  compare(run(raw), earlyReport()));

function fixture(callback, { dependencies = false } = {}) {
  const directory = path.join(__dirname, 'node_modules', '.bases-verify-' + randomUUID());
  fs.mkdirSync(path.join(directory, 'scripts'), { recursive: true });
  const entry = path.join(directory, 'scripts', 'check.cjs');
  fs.copyFileSync(checker, entry);
  if (dependencies) {
    fs.mkdirSync(path.join(directory, 'scripts', 'node_modules'));
    for (const name of Object.keys(contract['x-runtime'].dependencies)) {
      fs.symlinkSync(path.join(__dirname, 'node_modules', name),
        path.join(directory, 'scripts', 'node_modules', name), 'dir');
    }
    fs.mkdirSync(path.join(directory, 'references'));
    fs.copyFileSync(path.join(__dirname, '..', 'references', 'execution-contract.json'),
      path.join(directory, 'references', 'execution-contract.json'));
  }
  try { return callback(entry, directory); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('C12: actual isolated copy without local dependencies never uses ancestors or NODE_PATH', () => {
  fixture(entry => {
    compare(run(request(), ['--stdin'], entry, { env: { ...process.env, NODE_PATH: path.join(__dirname, 'node_modules') } }),
      earlyReport('dependency_missing'));
    compare(run('not JSON', ['--stdin'], entry), earlyReport('dependency_missing'));
    compare(run('', [], entry), earlyReport());
    const execution = run('not JSON', ['--help'], entry);
    assert.equal(execution.status, 0);
    assert.equal(execution.stdout, canonical(boundaries.command_reports.help));
  });
});

for (const name of Object.keys(contract['x-runtime'].dependencies)) {
  for (const state of ['missing', 'wrong version']) {
    test('C12: actual local ' + name + ' ' + state, () => {
      fixture((entry, directory) => {
        const dependency = path.join(directory, 'scripts', 'node_modules', name);
        fs.unlinkSync(dependency);
        if (state === 'wrong version') {
          fs.mkdirSync(dependency);
          fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ name, version: '0.0.0' }));
        }
        compare(run(request(), ['--stdin'], entry), earlyReport('dependency_missing'));
      }, { dependencies: true });
    });
  }
}

test('unexpected parser RangeError and corrupt contract clear all document metadata', () => {
  fixture((entry, directory) => {
    const dependency = path.join(directory, 'scripts', 'node_modules', 'yaml');
    fs.unlinkSync(dependency);
    fs.mkdirSync(dependency);
    fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ version: '2.9.1', main: 'index.cjs' }));
    fs.writeFileSync(path.join(dependency, 'index.cjs'),
      'exports.parseAllDocuments = () => { throw new RangeError("do not expose source"); };');
    compare(run(request('SECRET', { intent: 'proofread', application_version: '1.2.3' }), ['--stdin'], entry),
      earlyReport('runtime_error'));
    fs.writeFileSync(path.join(directory, 'references', 'execution-contract.json'), 'invalid');
    compare(run(request(), ['--stdin'], entry), earlyReport('runtime_error'));
  }, { dependencies: true });
});

test('stdin stream errors return exact invalid_control without leaking input', async () => {
  let directory;
  // Keep this fixture alive until the child closes; synchronous fixture cleanup is unsuitable here.
  directory = path.join(__dirname, 'node_modules', '.bases-verify-' + randomUUID());
  fs.mkdirSync(directory);
  const preload = path.join(directory, 'stream.cjs');
  fs.writeFileSync(preload, 'process.nextTick(() => process.stdin.emit("error", new Error("SECRET")));');
  try {
    const child = spawn(process.execPath, ['--require', preload, checker, '--stdin'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.stdin.on('error', () => {});
    child.stdin.end(validJSON);
    const [code, signal] = await once(child, 'close');
    compare({ stdout, stderr, status: code, signal }, earlyReport());
    assert.equal(stderr, '');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

const expressionCases = [
  ['quoted delimiters and commas are data', '["(((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((((", ",]"]', null],
  ['static computed index', 'note.items[0]', null],
  ['direct formula bracket reference', 'formula["ghost"]', 'formula_missing'],
  ['literal does not reference formula', '"formula.ghost"', null],
  ['null literal', 'null', 'unsupported_expression'],
  ['sparse middle', '[1,,2]', 'unsupported_expression'],
  ['sparse first', '[,1]', 'unsupported_expression'],
  ['optional chain', 'note?.name', 'unsupported_expression'],
  ['computed function target', 'note["lower"]()', 'unsupported_expression'],
  ['dynamic index', 'note[index]', 'unsupported_expression'],
  ['negative index', 'note[-1]', 'unsupported_expression'],
  ['compound', 'a;b', 'unsupported_expression'],
  ['assignment', 'a = 1', 'unsupported_expression'],
  ['unsupported unary', '~a', 'unsupported_operator'],
  ['unsupported binary', 'a === b', 'unsupported_operator'],
  ['unlisted documented call', 'note.isEmpty()', 'unsupported_function'],
  ['unlisted startsWith', 'note.startsWith("a")', 'unsupported_function'],
  ['bad global arity', 'today(1)', 'unsupported_function'],
  ['bad method arity', 'note.lower(1)', 'unsupported_function'],
  ['method call lower bound', 'note.hasTag()', 'unsupported_function'],
  ['method call upper bound', 'note.hasTag(' + Array(129).fill('"x"').join(',') + ')', 'unsupported_function'],
  ['nonfinite number', '1e999', 'unsupported_number'],
  ['unparsed nondecimal number', '0x10', 'unsupported_expression'],
  ['no runtime evaluation of division', '1 / 0', null],
  ['this does not fetch an active file', 'this.file.name', null],
  ['no execution of process call', 'process.exit(91)', 'unsupported_function'],
  ['no module loading from expressions', 'require("node:fs")', 'unsupported_function'],
  ['unsupported AST never invents missing refs', 'formula.ghost ? 1 : 2', 'unsupported_expression'],
  ['unsupported call never invents missing refs', 'fetch(formula.ghost)', 'unsupported_function'],
  ['identifier Unicode', '価格 * 数量', null],
  ['identifier not arbitrary nonASCII', '😀', 'unsupported_expression']
];
for (const [name, expression, code] of expressionCases) {
  test('expression: ' + name, () => {
    const input = request(E(expression));
    const expected = code === 'formula_missing' ? invalid(code, ['formulas', 'x'], ['ghost'], 'expression') :
      code ? unsupported(code, ['formulas', 'x']) : complete();
    compare(run(input), expectedReport(input, expected));
  });
}

const numericCases = [
  ['20e0', null], ['2e1', null], ['200e-1', null], ['0.2e2', null],
  ['20.000000000000000000', null],
  ['20.000000000000000001', 'invalid_type'],
  ['1e-999', 'invalid_type'], ['9007199254740992', 'unsupported_number'],
  ['90071992547409920e-1', 'unsupported_number'], ['0x14', 'unsupported_number'],
  ['0o24', 'unsupported_number'], ['.inf', 'unsupported_number'], ['.nan', 'unsupported_number'],
  ['0', 'unsupported_value'], ['-1', 'unsupported_value'], ['1000001', 'unsupported_value'],
  ['1', null], ['1000000', null], ['false', 'invalid_type'], ['"20"', 'invalid_type']
];
for (const [lexeme, code] of numericCases) test('exact numeric lexeme: ' + lexeme, () => {
  const input = request('views: [{type: table, name: A, limit: ' + lexeme + '}]\n');
  const expected = !code ? complete() : code === 'invalid_type' ? invalid(code, ['views', 0, 'limit']) :
    unsupported(code, ['views', 0, 'limit']);
  compare(run(input), expectedReport(input, expected));
});

const extraCases = [
  ['empty document', '', invalid('invalid_type', [])],
  ['sequence root', '[]\n', invalid('invalid_type', [])],
  ['scalar root', 'null\n', invalid('invalid_type', [])],
  ['nonstring map key', '1: {}\n', invalid('invalid_type', [])],
  ['explicit core tag', 'views: !!seq []\n', unsupported('unsupported_yaml_feature', [])],
  ['YAML directive', '%YAML 1.2\n---\n' + B, unsupported('unsupported_yaml_feature', [])],
  ['TAG directive', '%TAG !e! tag:example.invalid,2026:\n---\n' + B, unsupported('unsupported_yaml_feature', [])],
  ['unknown directive', '%PRIVATE data\n---\n' + B, unsupported('unsupported_yaml_feature', [])],
  ['prototype user dictionaries', 'summaries: {__proto__: "values.mean()"}\nproperties: {constructor: {displayName: A}}\n' +
    'views: [{type: table, name: A, summaries: {prototype: __proto__}}]\n', complete()],
  ['unknown key with no views has no operation issue', 'extension: {}\n', unsupported('unknown_key', ['extension'])],
  ['known unsupported expression definition is still known', 'formulas: {x: "fetch()", y: "formula.x"}\n' + B,
    unsupported('unsupported_function', ['formulas', 'x'])],
  ['unsupported namespace suppresses missing refs', 'formulas: []\nviews: [{type: table, name: A, order: [formula.ghost]}]\n',
    invalid('invalid_type', ['formulas'])],
  ['self cycle', E('formula.x'), invalid('formula_cycle', ['formulas'], ['x'], 'expression')],
  ['per-expression cap suppresses references/version', E('formula.ghost+' + '1+'.repeat(2048) + '1'),
    unsupported('limit_exceeded', ['formulas', 'x'])],
  ['lone high surrogate', B + '# \ud800', { ...unsupported('unsupported_unicode', []), nullHash: true }],
  ['lone low surrogate', B + '# \udfff', { ...unsupported('unsupported_unicode', []), nullHash: true }],
  ['valid astral Unicode', 'views: [{type: table, name: "😀"}]\n', complete()],
  ['noninitial FEFF is a string character, not a byte-order mark', 'views: [{type: table, name: "A\uFEFFB"}]\n', complete()],
  ['no mutation of quoted document text', B + '# %YAML 1.2 &anchor !tag << *alias\n', complete()],
  ['CRLF source is hashed exactly', B.replace(/\n/g, '\r\n'), complete()]
];
for (const [name, document, expected] of extraCases) test('structure: ' + name, () => {
  const input = request(document);
  compare(run(input), expectedReport(input, expected));
});

for (const intent of ['inspect', 'create', 'edit', 'proofread']) {
  test('validated metadata and empty views operation: ' + intent, () => {
    const input = request('views: []\n', { intent });
    const expected = intent === 'inspect' ?
      { ...complete(), static_checks_passed: false, issues: [diagnostic('no_views', 'caution', ['views'])] } :
      { exit_code: 2, structure: 'supported', static_checks_passed: false,
        issues: [diagnostic('missing_required', 'format', ['views'])] };
    compare(run(input), expectedReport(input, expected));
    const supported = request(B, { intent });
    compare(run(supported), expectedReport(supported, complete()));
    compare(run({ ...supported, unknown: true }), earlyReport());
  });
}

test('read-only/no-fetch execution tripwires (not an arbitrary-host sandbox)', () => {
  fixture((entry, directory) => {
    const preload = path.join(directory, 'tripwire.cjs');
    fs.writeFileSync(preload, `
      const fs = require('node:fs'), path = require('node:path');
      const read = fs.readFileSync;
      fs.readFileSync = function(file, ...args) {
        const p = path.resolve(String(file));
        if (!(p === ${JSON.stringify(entry)} || p.startsWith(${JSON.stringify(path.join(__dirname, 'node_modules') + path.sep)}) ||
          p.startsWith(${JSON.stringify(path.join(directory, 'references') + path.sep)}))) throw Error('forbidden read');
        return read.call(this, file, ...args);
      };
      const blocked = () => { throw Error('forbidden side effect'); };
      for (const key of ['writeFile','writeFileSync','appendFile','appendFileSync','mkdir','mkdirSync','unlink','unlinkSync',
        'rename','renameSync','rm','rmSync','createWriteStream']) fs[key] = blocked;
      for (const name of ['node:net','node:http','node:https','node:dns','node:child_process']) {
        const api = require(name);
        for (const key of ['connect','createConnection','request','get','lookup','resolve','spawn','spawnSync','exec','execSync',
          'execFile','execFileSync','fork']) if (key in api) api[key] = blocked;
      }
      global.fetch = blocked;
    `);
    const input = request(cases.documents.table, { intent: 'proofread' });
    compare(run(input, ['--stdin'], entry, { env: { ...process.env, NODE_OPTIONS: '--require=' + preload } }),
      expectedReport(input, complete()));
    compare(run({ ...input, path: '/must-not-open' }, ['--stdin'], entry,
      { env: { ...process.env, NODE_OPTIONS: '--require=' + preload } }), earlyReport());
  }, { dependencies: true });
});
