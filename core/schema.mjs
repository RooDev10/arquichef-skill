// A small, dependency-free JSON Schema validator.
//
// It supports the subset of draft 2020-12 that ArquiChef schemas use. Unknown
// keywords make the schema itself invalid, so a typo in a schema can never
// silently switch a rule off.

const ANNOTATION_KEYWORDS = new Set([
  '$schema', '$id', '$comment', 'title', 'description', 'default', 'examples',
]);

const SUPPORTED_KEYWORDS = new Set([
  ...ANNOTATION_KEYWORDS,
  '$defs', '$ref', 'type', 'enum', 'const', 'required', 'properties',
  'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength',
  'maxLength', 'pattern', 'minimum', 'maximum', 'oneOf', 'anyOf',
]);

const MAX_DEPTH = 64;

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function pointer(path) {
  return path.length === 0 ? '(root)' : path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('').replace(/^\./, '');
}

/** Throw if the schema uses keywords this validator does not understand. */
export function assertSupportedSchema(schema, where = '#') {
  if (typeof schema === 'boolean') return;
  if (typeOf(schema) !== 'object') throw new Error(`Schema at ${where} must be an object or boolean.`);
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) throw new Error(`Unsupported schema keyword "${key}" at ${where}.`);
  }
  for (const [key, sub] of Object.entries(schema.properties ?? {})) assertSupportedSchema(sub, `${where}/properties/${key}`);
  for (const [key, sub] of Object.entries(schema.$defs ?? {})) assertSupportedSchema(sub, `${where}/$defs/${key}`);
  if (schema.items !== undefined) assertSupportedSchema(schema.items, `${where}/items`);
  if (typeOf(schema.additionalProperties) === 'object') assertSupportedSchema(schema.additionalProperties, `${where}/additionalProperties`);
  for (const k of ['oneOf', 'anyOf']) (schema[k] ?? []).forEach((s, i) => assertSupportedSchema(s, `${where}/${k}/${i}`));
}

function resolveRef(root, ref) {
  const match = /^#\/\$defs\/([A-Za-z0-9_-]+)$/.exec(ref);
  if (!match || !root.$defs || !(match[1] in root.$defs)) throw new Error(`Unresolvable $ref "${ref}".`);
  return root.$defs[match[1]];
}

function validateNode(root, schema, value, path, errors, depth) {
  if (depth > MAX_DEPTH) {
    errors.push({ path: pointer(path), message: 'nesting is too deep' });
    return;
  }
  if (schema === true) return;
  if (schema === false) {
    errors.push({ path: pointer(path), message: 'value is not allowed here' });
    return;
  }
  if (schema.$ref) {
    validateNode(root, resolveRef(root, schema.$ref), value, path, errors, depth + 1);
    return;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push({ path: pointer(path), message: `expected ${types.join(' or ')}, got ${typeOf(value)}` });
      return;
    }
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path: pointer(path), message: `must be ${JSON.stringify(schema.const)}` });
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ path: pointer(path), message: `must be one of: ${schema.enum.join(', ')}` });
  }

  if (typeof value === 'string') {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) errors.push({ path: pointer(path), message: `must have at least ${schema.minLength} characters` });
    if (schema.maxLength !== undefined && length > schema.maxLength) errors.push({ path: pointer(path), message: `must have at most ${schema.maxLength} characters (has ${length})` });
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) errors.push({ path: pointer(path), message: `must match ${schema.pattern}` });
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push({ path: pointer(path), message: `must be >= ${schema.minimum}` });
    if (schema.maximum !== undefined && value > schema.maximum) errors.push({ path: pointer(path), message: `must be <= ${schema.maximum}` });
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push({ path: pointer(path), message: `must have at least ${schema.minItems} items` });
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push({ path: pointer(path), message: `must have at most ${schema.maxItems} items (has ${value.length})` });
    if (schema.items !== undefined) value.forEach((item, i) => validateNode(root, schema.items, item, [...path, i], errors, depth + 1));
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path: pointer(path), message: `missing required property "${key}"` });
    }
    const props = schema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (key in props) {
        validateNode(root, props[key], child, [...path, key], errors, depth + 1);
      } else if (schema.additionalProperties === false) {
        errors.push({ path: pointer(path), message: `unknown property "${key}"` });
      } else if (typeOf(schema.additionalProperties) === 'object') {
        validateNode(root, schema.additionalProperties, child, [...path, key], errors, depth + 1);
      }
    }
  }

  for (const keyword of ['oneOf', 'anyOf']) {
    if (!schema[keyword]) continue;
    const results = schema[keyword].map((sub) => {
      const subErrors = [];
      validateNode(root, sub, value, path, subErrors, depth + 1);
      return subErrors;
    });
    const passing = results.filter((r) => r.length === 0).length;
    const ok = keyword === 'oneOf' ? passing === 1 : passing >= 1;
    if (!ok) {
      if (passing > 1) {
        errors.push({ path: pointer(path), message: 'matches more than one allowed shape' });
      } else {
        // Report the alternative that came closest. The one whose errors sit
        // deepest in the value is the shape the author meant (its top-level
        // structure matched); ties go to the one with fewer errors.
        const depthOf = (errs) => Math.max(...errs.map((e) => e.path.split(/[.[]/).length));
        const closest = results.reduce((a, b) => {
          const da = depthOf(a);
          const db = depthOf(b);
          if (db !== da) return db > da ? b : a;
          return b.length < a.length ? b : a;
        });
        errors.push(...closest);
      }
    }
  }
}

/** Validate a value. Returns an array of { path, message }; empty means valid. */
export function validate(schema, value) {
  assertSupportedSchema(schema);
  const errors = [];
  validateNode(schema, schema, value, [], errors, 0);
  return errors;
}
