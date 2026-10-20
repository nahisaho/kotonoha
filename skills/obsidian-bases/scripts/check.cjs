'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { TextDecoder } = require('node:util');

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const mapping = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const stringify = value => JSON.stringify(value) + '\n';
const issue = (code, category, at = [], related = [], line = null, column = null) =>
  ({ code, category, path: at, line, column, related });

function report() {
  return {
    schema_version: 1,
    status: 'failed',
    exit_code: 1,
    structure: 'unprocessed',
    source_sha256: null,
    static_checks_passed: false,
    issues: [],
    unprocessed: [],
    read_only: true,
    authorization: 'not_assessed',
    write_status: 'not_requested',
    render_check: 'not_performed',
    expression_evaluation: 'not_performed',
    proofread_gate: 'not_requested',
    application_version: null,
    application_version_source: 'user_declared'
  };
}

function early(code) {
  const result = report();
  result.issues = [issue(code, {
    invalid_input: 'input', dependency_missing: 'capability', runtime_error: 'runtime'
  }[code])];
  if (code === 'dependency_missing') {
    result.status = 'not_performed';
    result.exit_code = 4;
  }
  return result;
}

function loadDependencies() {
  const modules = Object.create(null);
  const versions = { yaml: '2.9.1', jsep: '1.4.0', ajv: '8.20.0', 'jsonc-parser': '3.3.1' };
  for (const [name, version] of Object.entries(versions)) {
    const directory = path.join(__dirname, 'node_modules', name);
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (metadata.version !== version) throw new Error('dependency');
    modules[name] = require(name === 'ajv' ? path.join(directory, 'dist', '2020.js') : directory);
  }
  return modules;
}

function validators(contract, Ajv) {
  const schema = Object.fromEntries(Object.entries(contract).filter(([key]) => !key.startsWith('x-')));
  const ajv = new Ajv({ strict: true, strictRequired: false, allErrors: true,
    allowUnionTypes: true, ownProperties: true });
  return Object.fromEntries(['Request', 'Document', 'Report'].map(name =>
    [name, ajv.compile({ ...schema, $ref: '#/$defs/' + name })]));
}

function readControl(maximum) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      process.stdin.pause();
      reject(new Error('input'));
    };
    process.stdin.on('error', fail);
    process.stdin.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > maximum) return fail();
      chunks.push(chunk);
    });
    process.stdin.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });
  });
}

function parseControl(bytes, jsonc, validate) {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const errors = [];
  const tree = jsonc.parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (!tree || errors.length) throw new Error('input');
  const stack = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === 'object') {
      const keys = new Set();
      for (const property of node.children || []) {
        const key = property.children[0].value;
        if (keys.has(key)) throw new Error('input');
        keys.add(key);
      }
    }
    if (node.children) stack.push(...node.children);
  }
  const request = JSON.parse(text);
  if (!validate(request)) throw new Error('input');
  return request;
}

function compareString(a, b) {
  const left = Array.from(a, x => x.codePointAt(0));
  const right = Array.from(b, x => x.codePointAt(0));
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}

function comparePath(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (typeof a[i] !== typeof b[i]) return typeof a[i] === 'string' ? -1 : 1;
    return typeof a[i] === 'number' ? a[i] - b[i] : compareString(a[i], b[i]);
  }
  return a.length - b.length;
}

function outputExceeds(value, maximum) {
  let size = 1; // The trailing LF is part of the output cap.
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      size += 2 + Math.max(0, current.length - 1);
      pending.push(...current);
    } else if (mapping(current)) {
      const entries = Object.entries(current);
      size += 2 + Math.max(0, entries.length - 1) + entries.length;
      for (const [key, child] of entries) pending.push(key, child);
    } else size += Buffer.byteLength(JSON.stringify(current));
    if (size > maximum) return true;
  }
  return false;
}

function numericFact(node) {
  if (!node || (typeof node.value !== 'number' && typeof node.value !== 'bigint')) return null;
  const source = node.source;
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(source);
  if (!match || !Number.isFinite(Number(source))) return { unsupported: true };
  let digits = (match[2] + (match[3] || '')).replace(/^0+/, '');
  if (!digits) return { integral: true, value: 0 };
  const exponent = Number(match[4] || 0) - (match[3] || '').length;
  if (exponent < 0) {
    const needed = -exponent;
    if (needed > digits.length || !/^0*$/.test(digits.slice(-needed))) {
      return { integral: false, value: Number(source) };
    }
    digits = digits.slice(0, digits.length - needed);
  } else {
    if (digits.length + exponent > 16) return { unsupported: true };
    digits += '0'.repeat(exponent);
  }
  digits = digits.replace(/^0+/, '') || '0';
  if (digits.length > 16 || (digits.length === 16 && digits > '9007199254740991')) {
    return { unsupported: true };
  }
  return { integral: true, value: Number((match[1] === '-' ? '-' : '') + digits) };
}

function expression(text, context, jsep, contract) {
  const limits = contract['x-limits'];
  if (text.length > limits.expression_chars) return { codes: ['limit_exceeded'] };
  let quote = '';
  let nesting = 0;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quote) {
      if (character === '\\') i++;
      else if (character === quote) quote = '';
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '(' || character === '[') {
      if (++nesting > 64) return { codes: ['limit_exceeded'] };
    } else if (character === ')' || character === ']') nesting--;
  }
  let ast;
  try {
    ast = jsep(text);
  } catch (error) {
    if (error instanceof RangeError) throw error;
    return { codes: ['unsupported_expression'] };
  }
  const nodes = [];
  const stack = [[ast, 1, null, null]];
  while (stack.length) {
    const [node, depth, parent, field] = stack.pop();
    if (!node || typeof node.type !== 'string') continue;
    nodes.push([node, parent, field]);
    if (nodes.length > limits.expression_nodes || depth > limits.expression_depth) {
      return { codes: ['limit_exceeded'] };
    }
    for (const [key, child] of Object.entries(node)) {
      if (Array.isArray(child)) {
        for (let i = child.length - 1; i >= 0; i--) {
          if (child[i] && typeof child[i] === 'object') stack.push([child[i], depth + 1, node, key]);
        }
      } else if (child && typeof child === 'object') stack.push([child, depth + 1, node, key]);
    }
  }
  const grammar = contract['x-expression'];
  const codes = new Set();
  const refs = new Set();
  const unsupported = code => codes.add(code || 'unsupported_expression');
  for (const [node, parent, field] of nodes) {
    if (!grammar.ast.includes(node.type) || node.optional) {
      unsupported();
      continue;
    }
    switch (node.type) {
      case 'Literal':
        if (!grammar.literal_types.includes(typeof node.value) || node.value === null) unsupported();
        else if (typeof node.value === 'number' && (!Number.isFinite(node.value) ||
          /^0[xob]/i.test(node.raw || ''))) unsupported('unsupported_number');
        break;
      case 'Identifier': {
        if (!/^[$_\p{ID_Start}][$\u200c\u200d_\p{ID_Continue}]*$/u.test(node.name)) unsupported();
        const property = parent && parent.type === 'MemberExpression' && field === 'property' && !parent.computed;
        if (node.name === 'values' && context !== 'summary' && !property) unsupported();
        break;
      }
      case 'UnaryExpression':
        if (!grammar.unary.includes(node.operator)) unsupported('unsupported_operator');
        break;
      case 'BinaryExpression':
        if (!grammar.binary.includes(node.operator)) unsupported('unsupported_operator');
        break;
      case 'ArrayExpression':
        if (node.elements.some(element => element == null)) unsupported();
        break;
      case 'MemberExpression': {
        const directFormula = node.object.type === 'Identifier' && node.object.name === 'formula';
        let name;
        if (node.computed) {
          if (node.property.type !== 'Literal' || !(typeof node.property.value === 'string' ||
            (!directFormula && Number.isSafeInteger(node.property.value) && node.property.value >= 0))) unsupported();
          else name = node.property.value;
        } else if (node.property.type !== 'Identifier') unsupported();
        else name = node.property.name;
        if (directFormula && typeof name === 'string') refs.add(name);
        break;
      }
      case 'CallExpression': {
        const callee = node.callee;
        let arity;
        if (callee.type === 'Identifier') {
          arity = own(grammar.global_calls, callee.name) ? grammar.global_calls[callee.name] : null;
          if (!arity) unsupported('unsupported_function');
        } else if (callee.type === 'MemberExpression' && !callee.computed && !callee.optional &&
                   callee.property.type === 'Identifier') {
          const name = callee.property.name;
          arity = own(grammar.method_calls, name) ? grammar.method_calls[name] : null;
          if (name === 'mean' && !(context === 'summary' &&
            callee.object.type === 'Identifier' && callee.object.name === 'values')) {
            unsupported();
            arity = null;
          } else if (!arity) unsupported('unsupported_function');
        } else unsupported();
        if (arity && (node.arguments.length < arity[0] || node.arguments.length > arity[1])) {
          unsupported('unsupported_function');
        }
        break;
      }
    }
  }
  return { codes: [...codes], refs };
}

function validateDocument(request, modules, contract, guards) {
  const result = report();
  result.application_version = request.application_version;
  result.proofread_gate = request.intent === 'proofread' ? 'external_required' : 'not_requested';
  const findings = new Map();
  let invalid = false;
  let resource = false;
  let operationMissing = false;
  const add = (code, category, at = [], related = [], line = null, column = null) => {
    const entry = issue(code, category, at, [...new Set(related)].sort(compareString), line, column);
    findings.set(JSON.stringify(entry), entry);
    if (category === 'format' || category === 'expression') invalid = true;
    if (code === 'limit_exceeded') resource = true;
  };
  const bad = (code, at) => add(code, 'format', at);
  const unsupported = (code, at) => add(code, 'unsupported', at);
  const hasUnsupported = () => [...findings.values()].some(item => item.category === 'unsupported');
  const finish = (hasViews = false) => {
    result.issues = [...findings.values()].sort((a, b) =>
      comparePath(a.path, b.path) || compareString(a.code, b.code) || comparePath(a.related, b.related));
    const unprocessed = new Map(result.issues.filter(item => item.category === 'unsupported')
      .map(item => [JSON.stringify(item.path), item.path]));
    result.unprocessed = [...unprocessed.values()].sort(comparePath);
    result.structure = invalid && !operationMissing ? 'invalid' : hasUnsupported() ? 'unsupported' : 'supported';
    result.exit_code = invalid ? 2 : hasUnsupported() ? 3 :
      result.issues.some(item => item.code === 'application_version_insufficient') ? 4 :
        result.issues.some(item => item.code === 'application_version_unknown') ? 3 : 0;
    result.status = ({ 0: 'completed', 2: 'not_performed', 3: 'partial', 4: 'not_performed' })[result.exit_code];
    result.static_checks_passed = result.exit_code === 0 && hasViews;
    if (result.issues.length > contract['x-limits'].diagnostics ||
        outputExceeds(result, contract['x-limits'].output_bytes)) {
      result.issues = [issue('limit_exceeded', 'unsupported')];
      result.unprocessed = [[]];
      result.static_checks_passed = false;
      result.structure = invalid ? 'invalid' : 'unsupported';
      result.exit_code = invalid ? 2 : 3;
      result.status = invalid ? 'not_performed' : 'partial';
    }
    if (!guards.Report(result)) throw new Error('report');
    return result;
  };

  const text = request.document;
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) {
    unsupported('unsupported_unicode', []);
    return finish();
  }
  const bytes = Buffer.from(text, 'utf8');
  result.source_sha256 = hash(bytes);
  if (text.startsWith('\uFEFF')) {
    unsupported('unsupported_unicode', []);
    return finish();
  }
  if (bytes.length > contract['x-limits'].document_bytes) {
    unsupported('limit_exceeded', []);
    return finish();
  }
  const yaml = modules.yaml;
  const documents = yaml.parseAllDocuments(text, { version: '1.2', schema: 'core',
    uniqueKeys: true, strict: true, keepSourceTokens: true, intAsBigInt: true });
  const errors = documents.flatMap(document => document.errors).sort((a, b) => a.pos[0] - b.pos[0]);
  if (errors.length) {
    const error = errors[0];
    const before = text.slice(0, error.pos[0]);
    const line = before.split('\n').length;
    const column = error.pos[0] - before.lastIndexOf('\n');
    add(error.code === 'DUPLICATE_KEY' ? 'duplicate_yaml_key' : 'invalid_yaml', 'format', [], [], line, column);
    return finish();
  }
  if (documents.length > 1) {
    unsupported('multiple_yaml_documents', []);
    return finish();
  }
  for (const token of new yaml.Parser().parse(text)) {
    if (token.type === 'directive') {
      unsupported('unsupported_yaml_feature', []);
      return finish();
    }
  }
  const root = documents[0] ? documents[0].contents : null;
  const stack = [[root, 0]];
  let count = 0;
  let over = false;
  let feature = false;
  while (stack.length) {
    const [node, parentDepth] = stack.pop();
    count++;
    const collection = yaml.isMap(node) || yaml.isSeq(node);
    const depth = parentDepth + (collection ? 1 : 0);
    if (count > contract['x-limits'].yaml_nodes || depth > contract['x-limits'].yaml_depth) over = true;
    if (node && (node.anchor || node.tag || yaml.isAlias(node))) feature = true;
    if (yaml.isMap(node)) {
      for (let i = node.items.length - 1; i >= 0; i--) {
        const pair = node.items[i];
        if (yaml.isScalar(pair.key) && pair.key.value === '<<') feature = true;
        stack.push([pair.value, depth], [pair.key, depth]);
      }
    } else if (yaml.isSeq(node)) {
      for (let i = node.items.length - 1; i >= 0; i--) stack.push([node.items[i], depth]);
    }
    if (feature) break;
  }
  if (feature || over) {
    unsupported(feature ? 'unsupported_yaml_feature' : 'limit_exceeded', []);
    return finish();
  }
  const numeric = new Map();
  const conversion = [[root, [], null, null]];
  let data;
  while (conversion.length) {
    const [node, at, parent, key] = conversion.pop();
    let value;
    if (yaml.isMap(node)) {
      value = Object.create(null);
      for (let i = node.items.length - 1; i >= 0; i--) {
        const pair = node.items[i];
        if (!yaml.isScalar(pair.key) || typeof pair.key.value !== 'string') bad('invalid_type', at);
        else conversion.push([pair.value, [...at, pair.key.value], value, pair.key.value]);
      }
    } else if (yaml.isSeq(node)) {
      value = new Array(node.items.length);
      for (let i = node.items.length - 1; i >= 0; i--) conversion.push([node.items[i], [...at, i], value, i]);
    } else {
      value = node ? node.value : null;
      const fact = numericFact(node);
      if (fact) {
        numeric.set(JSON.stringify(at), fact);
        value = fact.unsupported ? null : fact.value;
      }
    }
    if (parent) parent[key] = value;
    else data = value;
  }
  const numberUnsupported = at => {
    const fact = numeric.get(JSON.stringify(at));
    if (!fact || !fact.unsupported) return false;
    unsupported('unsupported_number', at);
    return true;
  };
  const type = (value, kind, at) => {
    if (numberUnsupported(at)) return false;
    const valid = kind === 'object' ? mapping(value) : kind === 'array' ? Array.isArray(value) : typeof value === kind;
    if (!valid) bad('invalid_type', at);
    return valid;
  };
  const string = (value, at) => {
    if (!type(value, 'string', at)) return false;
    if (!value.length) {
      unsupported('unsupported_value', at);
      return false;
    }
    return true;
  };
  const keys = (value, allowed, at) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) unsupported('unknown_key', [...at, key]);
  };
  const expressions = [];
  const references = [];
  const summaryReferences = [];
  let formulaNames = new Set();
  let summaryNames = new Set();
  let formulaComplete = true;
  let summaryComplete = true;
  const propertyRef = (name, at) => {
    if (name.startsWith('formula.')) references.push({ path: at, refs: new Set([name.slice(8)]) });
  };
  const filter = (value, at) => {
    const pending = [[value, at]];
    while (pending.length) {
      const [current, location] = pending.pop();
      if (typeof current === 'string') {
        if (string(current, location)) expressions.push({ text: current, path: location, context: 'filter' });
      } else if (type(current, 'object', location)) {
        const names = Object.keys(current);
        if (names.length !== 1) unsupported('unsupported_value', location);
        keys(current, ['and', 'or', 'not'], location);
        for (const name of names) {
          if (!['and', 'or', 'not'].includes(name)) continue;
          const child = [...location, name];
          if (type(current[name], 'array', child)) {
            for (let i = current[name].length - 1; i >= 0; i--) pending.push([current[name][i], [...child, i]]);
          }
        }
      }
    }
  };
  if (!type(data, 'object', [])) return finish();
  keys(data, Object.keys(contract.$defs.Document.properties), []);
  if (own(data, 'formulas') && mapping(data.formulas) &&
      Object.keys(data.formulas).length > contract['x-limits'].formulas) {
    unsupported('limit_exceeded', ['formulas']);
    return finish();
  }
  for (const name of ['formulas', 'summaries']) {
    if (!own(data, name)) continue;
    if (!type(data[name], 'object', [name])) {
      if (name === 'formulas') formulaComplete = false;
      else summaryComplete = false;
      continue;
    }
    const names = new Set(Object.keys(data[name]));
    if (name === 'formulas') formulaNames = names;
    else summaryNames = names;
    for (const key of names) {
      const at = [name, key];
      const validName = string(key, at);
      const validValue = string(data[name][key], at);
      if (!validName) {
        if (name === 'formulas') formulaComplete = false;
        else summaryComplete = false;
      }
      if (validName && validValue) expressions.push({
        text: data[name][key], path: at, context: name === 'summaries' ? 'summary' : 'formula', name: key
      });
    }
  }
  if (own(data, 'filters')) filter(data.filters, ['filters']);
  if (own(data, 'properties') && type(data.properties, 'object', ['properties'])) {
    for (const [key, value] of Object.entries(data.properties)) {
      const at = ['properties', key];
      if (string(key, at)) propertyRef(key, at);
      if (!type(value, 'object', at)) continue;
      keys(value, ['displayName'], at);
      if (own(value, 'displayName')) string(value.displayName, [...at, 'displayName']);
    }
  }
  const views = [];
  if (own(data, 'views') && type(data.views, 'array', ['views'])) {
    const names = new Map();
    for (let i = 0; i < data.views.length; i++) {
      const view = data.views[i];
      const at = ['views', i];
      if (!type(view, 'object', at)) continue;
      views.push([view, at]);
      keys(view, Object.keys(contract.$defs.View.properties), at);
      for (const key of ['type', 'name']) if (!own(view, key)) bad('missing_required', [...at, key]);
      if (own(view, 'type') && type(view.type, 'string', [...at, 'type']) &&
          !own(contract['x-minimum-app'], view.type)) unsupported('unsupported_view', [...at, 'type']);
      if (own(view, 'name') && string(view.name, [...at, 'name'])) {
        if (names.has(view.name)) add('duplicate_view_name', 'caution', [...at, 'name'], [String(names.get(view.name))]);
        else names.set(view.name, i);
      }
      if (view.type === 'kanban' && !own(view, 'groupBy')) bad('missing_required', [...at, 'groupBy']);
      else if (own(view, 'groupOrder') && !own(view, 'groupBy')) unsupported('unsupported_value', [...at, 'groupOrder']);
      if (own(view, 'filters')) filter(view.filters, [...at, 'filters']);
      if (own(view, 'order') && type(view.order, 'array', [...at, 'order'])) {
        view.order.forEach((name, index) => {
          const location = [...at, 'order', index];
          if (string(name, location)) propertyRef(name, location);
        });
      }
      if (own(view, 'limit')) {
        const location = [...at, 'limit'];
        if (!numberUnsupported(location)) {
          const fact = numeric.get(JSON.stringify(location));
          if (!fact || !fact.integral) bad('invalid_type', location);
          else if (fact.value < 1 || fact.value > 1000000) unsupported('unsupported_value', location);
        }
      }
      if (own(view, 'groupBy') && type(view.groupBy, 'object', [...at, 'groupBy'])) {
        const group = view.groupBy;
        const location = [...at, 'groupBy'];
        keys(group, ['property', 'direction'], location);
        if (!own(group, 'property')) bad('missing_required', [...location, 'property']);
        else if (string(group.property, [...location, 'property'])) propertyRef(group.property, [...location, 'property']);
        if (own(group, 'direction')) {
          if (type(group.direction, 'string', [...location, 'direction']) &&
              !['ASC', 'DESC'].includes(group.direction)) bad('invalid_enum', [...location, 'direction']);
        }
      }
      if (own(view, 'groupOrder') && type(view.groupOrder, 'array', [...at, 'groupOrder'])) {
        view.groupOrder.forEach((value, index) => {
          const location = [...at, 'groupOrder', index];
          if (!numberUnsupported(location) && value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
            bad('invalid_type', location);
          }
        });
      }
      if (own(view, 'summaries') && type(view.summaries, 'object', [...at, 'summaries'])) {
        for (const [target, name] of Object.entries(view.summaries)) {
          const location = [...at, 'summaries', target];
          if (string(target, location)) propertyRef(target, location);
          if (string(name, location)) summaryReferences.push({ name, path: location });
        }
      }
    }
  }
  const accepted = [];
  for (const entry of expressions) {
    const parsed = expression(entry.text, entry.context, modules.jsep, contract);
    if (parsed.codes.length) {
      for (const code of parsed.codes) unsupported(code, entry.path);
    } else accepted.push({ ...entry, refs: parsed.refs });
  }
  if (!resource && formulaComplete) {
    for (const entry of [...accepted, ...references]) {
      const missing = [...entry.refs].filter(name => !formulaNames.has(name));
      if (missing.length) add('formula_missing', 'expression', entry.path, missing);
    }
    if (!resource && summaryComplete) {
      for (const entry of summaryReferences) {
        if (!summaryNames.has(entry.name) && !contract['x-summary-names'].includes(entry.name)) {
          add('summary_missing', 'expression', entry.path, [entry.name]);
        }
      }
    }
    const graph = new Map(accepted.filter(entry => entry.context === 'formula').map(entry => [entry.name, entry.refs]));
    const visited = new Set();
    const order = [];
    for (const name of graph.keys()) {
      if (visited.has(name)) continue;
      const pending = [[name, false]];
      while (pending.length) {
        const [current, done] = pending.pop();
        if (done) { order.push(current); continue; }
        if (visited.has(current)) continue;
        visited.add(current);
        pending.push([current, true]);
        for (const next of graph.get(current)) if (graph.has(next) && !visited.has(next)) pending.push([next, false]);
      }
    }
    const reverse = new Map([...graph.keys()].map(name => [name, []]));
    for (const [name, refs] of graph) for (const next of refs) if (reverse.has(next)) reverse.get(next).push(name);
    visited.clear();
    for (const name of order.reverse()) {
      if (visited.has(name)) continue;
      const component = [];
      const pending = [name];
      while (pending.length) {
        const current = pending.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        component.push(current);
        pending.push(...reverse.get(current).filter(next => !visited.has(next)));
      }
      if (component.length > 1 || graph.get(name).has(name)) add('formula_cycle', 'expression', ['formulas'], component);
    }
  }
  if (!invalid && !hasUnsupported()) {
    if (!guards.Document(data)) throw new Error('document');
    if (!views.length) {
      if (request.intent === 'inspect') add('no_views', 'caution', ['views']);
      else {
        bad('missing_required', ['views']);
        operationMissing = true;
      }
    } else {
      const version = value => value.split('.').map(Number).concat([0]).slice(0, 3);
      const compareVersion = (a, b) => {
        const x = version(a), y = version(b);
        return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
      };
      const minimum = views.map(([view]) => contract['x-minimum-app'][view.type]).sort(compareVersion).pop();
      if (request.application_version === null) add('application_version_unknown', 'capability', [], [minimum]);
      else for (const [view, at] of views) {
        const needed = contract['x-minimum-app'][view.type];
        if (compareVersion(request.application_version, needed) < 0) {
          add('application_version_insufficient', 'capability', [...at, 'type'], [needed]);
        }
      }
    }
  }
  return finish(views.length > 0);
}

function emit(value) {
  process.stdout.write(stringify(value));
  process.exitCode = value.exit_code || 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    emit({ usage: 'node <bases-dir>/scripts/check.cjs --stdin', read_only: true });
    return;
  }
  if (args.length !== 1 || args[0] !== '--stdin') {
    emit(early('invalid_input'));
    return;
  }
  let modules;
  try {
    modules = loadDependencies();
  } catch {
    emit(early('dependency_missing'));
    return;
  }
  try {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', 'execution-contract.json'), 'utf8'));
    const guards = validators(contract, modules.ajv);
    let request;
    try {
      request = parseControl(await readControl(contract['x-commands']['--stdin'].stdin_max_bytes),
        modules['jsonc-parser'], guards.Request);
    } catch {
      emit(early('invalid_input'));
      return;
    }
    emit(validateDocument(request, modules, contract, guards));
  } catch {
    emit(early('runtime_error'));
  }
}

main().catch(() => emit(early('runtime_error')));
