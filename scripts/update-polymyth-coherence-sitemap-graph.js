#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'polymyth/sitemap/graph/index.html');
const before = fs.readFileSync(file, 'utf8');
const pattern = /(<script id="graph-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
const match = before.match(pattern);
if (!match) throw new Error('Missing #graph-data payload');

const graph = JSON.parse(match[2]);
const coherenceId = '/polymyth/coherence/';
const obsoleteMarginaliaReviewId = '/marginalia/example-review/';
graph.nodes = graph.nodes.filter(node => node.id !== obsoleteMarginaliaReviewId);
graph.edges = graph.edges.filter(edge => (
  edge.source !== obsoleteMarginaliaReviewId
  && edge.target !== obsoleteMarginaliaReviewId
));
const existing = graph.nodes.find(node => node.id === coherenceId);
const coherence = {
  id: coherenceId,
  title: 'Polymyth Coherence',
  desc: 'Blank Internal–Mezo–External assessment instrument with a model-neutral application protocol; case results remain separate.',
  category: 'framework',
  in: 2,
  out: 2,
};
if (existing) Object.assign(existing, coherence);
else graph.nodes.push(coherence);

const countUpdates = new Map([
  ['/', {in: 23}],
  ['/florilegium/', {in: 10}],
  ['/marginalia/', {in: 8}],
  ['/polymyth/methodologylist/', {in: 11, out: 8}],
  ['/polymyth/sitemap/', {in: 14, out: 40}],
  ['/polymyth/sitemap/graph/', {out: 39}],
]);
for (const node of graph.nodes) {
  const update = countUpdates.get(node.id);
  if (update) Object.assign(node, update);
}

const additions = [
  ['/polymyth/methodologylist/', coherenceId],
  [coherenceId, '/polymyth/methodologylist/'],
  ['/polymyth/sitemap/', coherenceId],
  [coherenceId, '/polymyth/sitemap/'],
  ['/polymyth/sitemap/graph/', coherenceId],
];
const seen = new Set(graph.edges.map(edge => `${edge.source}\u0000${edge.target}`));
for (const [source, target] of additions) {
  const key = `${source}\u0000${target}`;
  if (!seen.has(key)) {
    graph.edges.push({source, target});
    seen.add(key);
  }
}

graph.nodes.sort((left, right) => left.id.localeCompare(right.id));
graph.edges.sort((left, right) => {
  const source = left.source.localeCompare(right.source);
  return source || left.target.localeCompare(right.target);
});
const after = before.replace(pattern, `$1${JSON.stringify(graph)}$3`);
if (after !== before) fs.writeFileSync(file, after, 'utf8');
console.log(`POLYMYTH COHERENCE GRAPH UPDATED — ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);
