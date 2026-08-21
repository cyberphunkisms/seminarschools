#!/usr/bin/env node
'use strict';

/**
 * Validate both legacy festival families and the generalized series/program
 * graph used by the current Polymythcal schema.
 *
 * `is_parent_festival` is retained for legacy festival-family compatibility,
 * but `record_kind`, `series_role`, `parent_id`, and their Set 15 overlay are
 * the authoritative relationship fields for the full Sets 1–15 corpus.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const data = readJson('polymythseminars/events.json');
const schema = readJson('data/polymythcal-event-schema-v2.json');
const events = data.events;
const problems = [];
const fail = message => problems.push(message);

const schemaProperties = schema.properties || {};
const typeAllows = (definition, expected) => {
  const declared = definition?.type;
  return declared === expected || (Array.isArray(declared) && declared.includes(expected));
};
const requireSchema = (condition, message) => {
  if (!condition) fail(`schema contract: ${message}`);
};

requireSchema(Array.isArray(schemaProperties.record_kind?.enum), 'record_kind must be an enum');
requireSchema(schemaProperties.record_kind?.enum?.includes('festival'), 'record_kind must recognize festival');
requireSchema(typeAllows(schemaProperties.parent_id, 'string') && typeAllows(schemaProperties.parent_id, 'null'), 'parent_id must be nullable text');
requireSchema(typeAllows(schemaProperties.series_role, 'string') && typeAllows(schemaProperties.series_role, 'null'), 'series_role must be nullable text');
requireSchema(schemaProperties.child_ids?.type === 'array' && schemaProperties.child_ids?.items?.type === 'string', 'child_ids must be a text array');
requireSchema(['parent', 'child', 'standalone'].every(role => schemaProperties.set15_series_role?.enum?.includes(role)), 'set15_series_role must recognize parent, child, and standalone');
requireSchema(typeAllows(schemaProperties.set15_parent_id, 'string') && typeAllows(schemaProperties.set15_parent_id, 'null'), 'set15_parent_id must be nullable text');
requireSchema(schemaProperties.set15_child_ids?.type === 'array' && schemaProperties.set15_child_ids?.items?.type === 'string', 'set15_child_ids must be a text array');

if (!Array.isArray(events)) {
  fail('polymythseminars/events.json must contain an events array');
}

const rows = Array.isArray(events) ? events : [];
const ids = new Map();
for (const [index, event] of rows.entries()) {
  const id = typeof event?.id === 'string' ? event.id.trim() : '';
  if (!id) {
    fail(`record ${index + 1} has no non-empty id`);
    continue;
  }
  if (ids.has(id)) fail(`duplicate id ${id}`);
  else ids.set(id, event);
}

const ALLOWED_ROLES = new Set(['parent', 'child', 'standalone']);
const optionalText = (event, field) => {
  const value = event[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${event.id || '<missing-id>'}: ${field} must be non-empty text or null`);
    return null;
  }
  return value.trim();
};
const normalizedList = (event, field) => {
  if (event[field] === undefined) return null;
  if (!Array.isArray(event[field])) {
    fail(`${event.id || '<missing-id>'}: ${field} must be an array when present`);
    return [];
  }
  const values = [];
  const seen = new Set();
  for (const value of event[field]) {
    if (typeof value !== 'string' || !value.trim()) {
      fail(`${event.id || '<missing-id>'}: ${field} must contain only non-empty text IDs`);
      continue;
    }
    const childId = value.trim();
    if (seen.has(childId)) fail(`${event.id}: ${field} repeats ${childId}`);
    else {
      seen.add(childId);
      values.push(childId);
    }
  }
  return values;
};
const sameMembers = (left, right) => left.length === right.length && left.every(value => right.includes(value));

const relations = new Map();
for (const event of rows) {
  const id = typeof event.id === 'string' ? event.id.trim() : '';
  if (!id) continue;

  if (event.is_parent_festival !== undefined && typeof event.is_parent_festival !== 'boolean') {
    fail(`${id}: is_parent_festival must be boolean when present`);
  }
  if (!schemaProperties.record_kind?.enum?.includes(event.record_kind)) {
    fail(`${id}: record_kind ${JSON.stringify(event.record_kind)} is outside the schema enum`);
  }

  const genericRole = optionalText(event, 'series_role');
  const set15Role = optionalText(event, 'set15_series_role');
  for (const [field, role] of [['series_role', genericRole], ['set15_series_role', set15Role]]) {
    if (role && !ALLOWED_ROLES.has(role)) fail(`${id}: ${field} has unrecognized marker ${JSON.stringify(role)}`);
  }
  if (genericRole && set15Role && genericRole !== set15Role) {
    fail(`${id}: ambiguous role markers (${genericRole} versus ${set15Role})`);
  }

  const genericParent = optionalText(event, 'parent_id');
  const set15Parent = optionalText(event, 'set15_parent_id');
  if (genericParent && set15Parent && genericParent !== set15Parent) {
    fail(`${id}: ambiguous parent markers (${genericParent} versus ${set15Parent})`);
  }

  const genericChildren = normalizedList(event, 'child_ids');
  const set15Children = normalizedList(event, 'set15_child_ids');
  if (genericChildren && set15Children && !sameMembers(genericChildren, set15Children)) {
    fail(`${id}: child_ids and set15_child_ids identify different children`);
  }

  relations.set(id, {
    role: genericRole || set15Role,
    parentId: genericParent || set15Parent,
    genericChildren,
    set15Children,
    declaredChildren: genericChildren || set15Children || null,
  });
}

const incoming = new Map();
for (const [id, relation] of relations) {
  if (!relation.parentId) continue;
  if (relation.parentId === id) {
    fail(`${id}: self-referential parent relationship`);
    continue;
  }
  if (!ids.has(relation.parentId)) {
    fail(`${id}: references missing parent ${relation.parentId}`);
    continue;
  }
  const children = incoming.get(relation.parentId) || [];
  children.push(id);
  incoming.set(relation.parentId, children);
}

for (const [id, relation] of relations) {
  const incomingChildren = incoming.get(id) || [];
  if (relation.role === 'child' && !relation.parentId) {
    fail(`${id}: child marker has no parent_id or set15_parent_id`);
  }
  if (relation.role === 'parent' && relation.parentId) {
    fail(`${id}: parent marker also declares parent ${relation.parentId}`);
  }
  if (relation.role === 'standalone' && (relation.parentId || relation.declaredChildren || incomingChildren.length)) {
    fail(`${id}: standalone marker conflicts with a parent or child relationship`);
  }
  if (relation.parentId && relation.role && relation.role !== 'child') {
    fail(`${id}: ${relation.role} marker conflicts with child relationship to ${relation.parentId}`);
  }
  if (incomingChildren.length && relation.role === 'child') {
    fail(`${id}: child marker also has incoming children`);
  }
  if (relation.declaredChildren && relation.role !== 'parent') {
    fail(`${id}: declared child list requires a parent marker`);
  }

  for (const childId of relation.declaredChildren || []) {
    if (childId === id) {
      fail(`${id}: declared child list contains itself`);
      continue;
    }
    if (!ids.has(childId)) {
      fail(`${id}: declared child ${childId} does not exist`);
      continue;
    }
    const childParent = relations.get(childId)?.parentId;
    if (childParent !== id) {
      fail(`${id}: declared child ${childId} points to ${childParent || 'no parent'}`);
    }
  }
  if (relation.declaredChildren && !sameMembers(relation.declaredChildren, incomingChildren)) {
    const missing = incomingChildren.filter(childId => !relation.declaredChildren.includes(childId));
    const extra = relation.declaredChildren.filter(childId => !incomingChildren.includes(childId));
    fail(`${id}: declared child list disagrees with backlinks` +
      `${missing.length ? `; missing ${missing.join(', ')}` : ''}` +
      `${extra.length ? `; unlinked ${extra.join(', ')}` : ''}`);
  }
}

// A child-to-parent graph must be acyclic. Following at most one effective
// parent per record makes a three-state walk sufficient and gives a useful path.
const visitState = new Map();
const stack = [];
const visit = id => {
  const state = visitState.get(id) || 0;
  if (state === 2) return;
  if (state === 1) {
    const start = stack.indexOf(id);
    fail(`parent cycle: ${[...stack.slice(start), id].join(' -> ')}`);
    return;
  }
  visitState.set(id, 1);
  stack.push(id);
  const parentId = relations.get(id)?.parentId;
  if (parentId && ids.has(parentId) && parentId !== id) visit(parentId);
  stack.pop();
  visitState.set(id, 2);
};
for (const id of ids.keys()) visit(id);

let festivalParents = 0;
let festivalChildren = 0;
let generalizedParents = 0;
for (const [id, event] of ids) {
  const relation = relations.get(id);
  const isFestivalParent = event.record_kind === 'festival' && event.is_parent_festival === true;

  if (relation?.role === 'parent') generalizedParents += 1;
  if (event.record_kind === 'festival' && relation?.role === 'parent' && !isFestivalParent) {
    fail(`${id}: festival parent marker requires is_parent_festival=true`);
  }
  if (isFestivalParent) {
    festivalParents += 1;
    if (event.type !== 'festival') fail(`${id}: festival parent has type ${JSON.stringify(event.type)}, expected "festival"`);
    if (relation.parentId) fail(`${id}: festival parent cannot itself be a child`);
    if (relation.role && relation.role !== 'parent') fail(`${id}: festival parent has conflicting ${relation.role} marker`);
  } else if (event.is_parent_festival === true) {
    // Sets 1–15 generalized several historical festival-series records. The
    // legacy flag remains valid only when the schema-backed relationship data
    // unambiguously describes a generalized parent.
    if (relation.role !== 'parent') fail(`${id}: non-festival legacy parent flag requires series_role=parent`);
    if (relation.parentId) fail(`${id}: non-festival legacy parent flag cannot also declare a parent`);
  }

  if (relation?.parentId) {
    const parent = ids.get(relation.parentId);
    const parentIsFestival = parent?.record_kind === 'festival' && parent?.is_parent_festival === true;
    if (parent?.record_kind === 'festival' && !parentIsFestival) {
      fail(`${id}: festival target ${parent.id} is not a canonical festival parent`);
    } else if (parentIsFestival) {
      festivalChildren += 1;
      if (event.is_parent_festival === true) fail(`${id}: festival child is also marked as a festival parent`);
      if (relation.role && relation.role !== 'child') fail(`${id}: festival child has conflicting ${relation.role} marker`);
    }
  }
}

if (problems.length) {
  console.error('FESTIVAL / SERIES PARENT TAXONOMY FAILED');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `FESTIVAL / SERIES PARENT TAXONOMY OK — ${festivalParents} festival parents, ` +
  `${festivalChildren} festival children, ${generalizedParents} schema-marked parents, ` +
  `${[...relations.values()].filter(relation => relation.parentId).length} linked records.`
);
