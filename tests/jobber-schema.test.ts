import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobDetails } from '../src/jobber/data';
import type { GraphQL } from '../src/jobber/client';

const page = () => ({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } });
const job = (quoteNumber: unknown) => ({
  id: 'job', jobNumber: 123, title: null, instructions: null, jobStatus: 'active',
  lineItems: page(), notes: page(), request: null,
  quote: { id: 'quote', quoteNumber, title: null, message: null,
    quoteStatus: 'APPROVED', lineItems: page(), request: null },
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
