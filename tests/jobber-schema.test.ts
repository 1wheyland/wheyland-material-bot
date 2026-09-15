import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobDetails } from '../src/jobber/data';
import type { GraphQL } from '../src/jobber/client';
import { sourcesFor } from '../src/materials/sources';

const page = () => ({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } });
const job = (quoteNumber: unknown) => ({
  id: 'job', jobNumber: 123, title: null, instructions: null, jobStatus: 'active',
  lineItems: page(), notes: page(), request: null,
  quote: { id: 'quote', quoteNumber, title: null, message: null,
    quoteStatus: 'APPROVED', lineItems: page(), request: null },
});

test('nullable recommendation flags survive pagination and remain unknown in source evidence', async () => {
  const item = { id: 'line1', name: 'GFCI', description: null, quantity: 1, optional: true, recommended: null };
  const payload = { ...job('001'), quote: { ...job('001').quote,
    lineItems: { nodes: [item], pageInfo: { hasNextPage: true, endCursor: 'next' } } } };
  const gql: GraphQL = async <T>(query: string) => (query.includes('JobMaterialDetails')
    ? { job: payload }
    : { job: { quote: { lineItems: { ...page(), nodes: [{ ...item, id: 'line2' }] } } } }) as T;
  const result = await jobDetails(gql, 'job');
  assert.equal(result.quote?.lineItems.nodes.length, 2);
  assert.ok(result.quote?.lineItems.nodes.every(item => item.recommended === null));
  const lines = sourcesFor([], result, []).filter(source => source.id.startsWith('quote-line:'));
  assert.equal(lines.length, 2);
  assert.ok(lines.every(source => source.optional && source.kind.includes('recommended unknown')));
});

test('recommendation flags preserve booleans and reject malformed text', async () => {
  for (const recommended of [true, false, 'yes']) {
    const item = { id: 'line', name: null, description: null, quantity: null, optional: false, recommended };
    const payload = { ...job('001'), quote: { ...job('001').quote, lineItems: { ...page(), nodes: [item] } } };
    const gql: GraphQL = async <T>() => ({ job: payload }) as T;
    if (typeof recommended === 'boolean') {
      assert.equal((await jobDetails(gql, 'job')).quote?.lineItems.nodes[0].recommended, recommended);
    } else {
      await assert.rejects(jobDetails(gql, 'job'), /JOBBER_SCHEMA_JOB_QUOTE_ITEMS_RECOMMENDED_TEXT/);
    }
  }
});

test('Jobber quote numbers are strings and retain prefixes and leading zeros', async () => {
  for (const quoteNumber of ['123', '000123', 'WE-123']) {
    const gql: GraphQL = async <T>() => ({ job: job(quoteNumber) }) as T;
    const result = await jobDetails(gql, 'job');
    assert.equal(result.quote?.quoteNumber, quoteNumber);
    assert.equal(result.jobNumber, 123);
  }
});

test('invalid quote numbers still fail validation', async () => {
  for (const quoteNumber of [null, {}, 123]) {
    const gql: GraphQL = async <T>() => ({ job: job(quoteNumber) }) as T;
    await assert.rejects(jobDetails(gql, 'job'), /JOBBER_SCHEMA_JOB_QUOTE_QUOTENUMBER_(NULL|OBJECT|NUMBER)/);
  }
});

test('schema diagnostics identify the field and type without customer values', async () => {
  const payload = { ...job('001'), jobNumber: 'private customer text' };
  const gql: GraphQL = async <T>() => ({ job: payload }) as T;
  await assert.rejects(jobDetails(gql, 'job'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'JOBBER_SCHEMA_JOB_JOBNUMBER_TEXT');
    assert.match(error.message, /^[A-Z][A-Z0-9_]{2,60}$/);
    assert.ok(!error.message.includes('private'));
    return true;
  });
});
