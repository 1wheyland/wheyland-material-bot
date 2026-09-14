import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { analysisErrorCode } from '../src/materials/errors';

test('quota is distinguished from transient rate limits without returning provider text',()=>{
  const sensitive='private credential or scope';
  const error=(status:number,code:string,type='error')=>new OpenAI.APIError(status,{code,type,message:sensitive},sensitive,new Headers());
  assert.equal(analysisErrorCode(error(429,'insufficient_quota')),'OPENAI_QUOTA_EXCEEDED');
  assert.equal(analysisErrorCode(error(429,'project_spend_limit_exceeded')),'OPENAI_QUOTA_EXCEEDED');
  assert.equal(analysisErrorCode(error(429,'new_billing_code','insufficient_quota')),'OPENAI_QUOTA_EXCEEDED');
  assert.equal(analysisErrorCode(error(429,'rate_limit_exceeded')),'OPENAI_RATE_LIMITED');
  for(const [status,expected] of [[401,'OPENAI_KEY_INVALID'],[403,'OPENAI_PERMISSION_DENIED'],[404,'OPENAI_MODEL_UNAVAILABLE'],[400,'OPENAI_REQUEST_REJECTED'],[503,'OPENAI_SERVICE_UNAVAILABLE']] as const) {
    assert.equal(analysisErrorCode(error(status,sensitive)),expected);
  }
  assert.equal(analysisErrorCode(new Error(sensitive)),'AI_PROCESSING_ERROR');
  assert.equal(analysisErrorCode(new Error('AI_INVALID_EVIDENCE')),'AI_INVALID_EVIDENCE');
});
test('timeout and connection errors have distinct fixed codes',()=>{
  assert.equal(analysisErrorCode(new OpenAI.APIConnectionTimeoutError()),'OPENAI_TIMEOUT');
  assert.equal(analysisErrorCode(new OpenAI.APIConnectionError({message:'private URL'})),'OPENAI_CONNECTION_FAILED');
});
