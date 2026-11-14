import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADVISORY_QUESTIONS,
  buildAdvisory,
  buildAdvisoryRequest,
  callJev,
  redactedEvidence,
  runJevAdvisory,
  validateJevResponse,
} from '../lib/jev.mjs';

const STATE = {task: 'small routing example', scope: 'docs only'};

function validResponse(overrides = {}) {
  return {
    model: 'jev-test-1.0.0',
    answers: {
      route: {
        type: 'choice',
        choice: 'implementation',
        confidence: 0.9,
        probabilities: {
          implementation: 0.9,
          research: 0.05,
          review: 0.03,
          principal_decision: 0.02,
        },
      },
      research_needed: {type: 'noul', noul: 0.2},
      evidence_sufficient: {type: 'noul', noul: 0.9},
      review_risk: {
        type: 'score',
        score: 0.4,
        confidence: 0.8,
        legend: {0: 'Low', 1: 'Moderate', 2: 'High'},
        probabilities: {0: 0.6, 1: 0.4, 2: 0},
      },
      ...overrides,
    },
    usage: {input_tokens: 100, output_tokens: 10},
  };
}

test('request batches the four independent advisory questions in one request', () => {
  const request = buildAdvisoryRequest(STATE);
  assert.equal(request.model, 'jev-latest');
  assert.deepEqual(Object.keys(request.questions), [
    'route',
    'research_needed',
    'evidence_sufficient',
    'review_risk',
  ]);
  assert.equal(request.questions.route.type, 'choice');
  assert.equal(request.questions.research_needed.type, 'noul');
  assert.equal(request.questions.review_risk.type, 'score');
  assert.equal(request.questions.route.criteria.implementation.includes('Only that worker'), true);
  assert.deepEqual(request, buildAdvisoryRequest(STATE)); // deterministic shape
});

test('valid typed response yields an advisory with the OpenCode principal as the only decision owner', () => {
  const request = buildAdvisoryRequest(STATE);
  const response = validResponse();
  const result = buildAdvisory(request, response);
  assert.equal(result.status, 'ok');
  assert.equal(result.escalate, false);
  assert.equal(result.advisory.route.choice, 'implementation');
  assert.equal(result.advisory.route.confidence, 0.9);
  assert.equal(result.advisory.route.probability, 0.9);
  assert.equal(result.advisory.editsApp, 'implementation-worker-only');
  assert.equal(result.advisory.researchMayEditApp, false);
  assert.equal(result.advisory.authorization, 'none');
  assert.equal(result.advisory.requiresPrincipalDecision, true);
  assert.equal(result.advisory.confidenceIsPermission, false);
  assert.deepEqual(result.advisory.commands, []);
  assert.match(result.advisory.note, /confidence is not permission/i);
});

test('low confidence or low top probability escalates but never authorizes', () => {
  const request = buildAdvisoryRequest(STATE);
  const response = validResponse({
    route: {
      type: 'choice',
      choice: 'implementation',
      confidence: 0.2,
      probabilities: {implementation: 0.4, research: 0.3, review: 0.2, principal_decision: 0.1},
    },
  });
  const result = buildAdvisory(request, response);
  assert.equal(result.status, 'ok');
  assert.equal(result.escalate, true);
  assert.equal(result.advisory.authorization, 'none');
  assert.ok(result.escalationReasons.some(reason => reason.includes('confidence')));
  assert.ok(result.escalationReasons.some(reason => reason.includes('probability')));
});

test('missing evidence escalates to the OpenCode principal', () => {
  const request = buildAdvisoryRequest(STATE);
  const response = validResponse({evidence_sufficient: {type: 'noul', noul: 0.2}});
  const result = buildAdvisory(request, response);
  assert.equal(result.escalate, true);
  assert.ok(result.escalationReasons.some(reason => reason.includes('evidence_sufficient')));
});

test('research-needed plus implementation escalates instead of silently implementing', () => {
  const request = buildAdvisoryRequest(STATE);
  const response = validResponse({research_needed: {type: 'noul', noul: 0.95}});
  const result = buildAdvisory(request, response);
  assert.equal(result.escalate, true);
  assert.ok(result.escalationReasons.some(reason => reason.includes('research')));
});

test('high review risk escalates to the principal', () => {
  const request = buildAdvisoryRequest(STATE);
  const response = validResponse({
    review_risk: {
      type: 'score',
      score: 1.8,
      confidence: 0.9,
      legend: {0: 'Low', 1: 'Moderate', 2: 'High'},
      probabilities: {0: 0.1, 1: 0.0, 2: 0.9},
    },
  });
  const result = buildAdvisory(request, response);
  assert.equal(result.escalate, true);
  assert.ok(result.escalationReasons.some(reason => reason.includes('review_risk')));
});

test('schema validation rejects wrong types, bad probabilities, and extra answers', () => {
  const request = buildAdvisoryRequest(STATE);
  const cases = [
    [validResponse({route: {...validResponse().answers.route, type: 'noul'}}), /type must be choice/],
    [
      validResponse({
        route: {...validResponse().answers.route, probabilities: {implementation: 1.2}},
      }),
      /probabilities keys/,
    ],
    [
      validResponse({
        route: {
          ...validResponse().answers.route,
          probabilities: {implementation: 0.5, research: 0.1, review: 0.1, principal_decision: 0.1},
        },
      }),
      /sum to approximately 1/,
    ],
    [
      validResponse({
        review_risk: {...validResponse().answers.review_risk, score: 7},
      }),
      /score must be a number/,
    ],
    [
      {
        ...validResponse(),
        answers: {...validResponse().answers, extra: {type: 'noul', noul: 1}},
      },
      /keys must be exactly/,
    ],
  ];
  for (const [response, pattern] of cases) {
    const result = validateJevResponse(request, response);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), pattern);
  }
});

test('callJev batches all questions into one fetch and returns typed answers', async () => {
  const request = buildAdvisoryRequest(STATE);
  let calls = 0;
  let body = null;
  const fetchImpl = async (url, init) => {
    calls += 1;
    body = JSON.parse(init.body);
    return {ok: true, status: 200, json: async () => validResponse()};
  };
  const result = await callJev({request, apiKey: 'test-key', fetchImpl});
  assert.equal(result.status, 'ok');
  assert.equal(calls, 1);
  assert.equal(Object.keys(body.questions).length, 4);
  assert.equal(result.response.answers.route.choice, 'implementation');
});

test('network, auth, timeout, and malformed responses become escalations, not throws', async () => {
  const request = buildAdvisoryRequest(STATE);
  const cases = [
    [
      async () => {
        throw Object.assign(new Error('boom'), {name: 'TypeError'});
      },
      'unavailable',
      /failed before a response/,
    ],
    [
      async () => ({ok: false, status: 401, json: async () => ({})}),
      'unavailable',
      /HTTP 401/,
    ],
    [
      async () => ({ok: true, status: 200, json: async () => { throw new Error('bad'); }}),
      'invalid_response',
      /not valid JSON/,
    ],
    [
      async () => ({ok: true, status: 200, json: async () => ({model: 'x', answers: {}})}),
      'invalid_response',
      /typed validation/,
    ],
  ];
  for (const [fetchImpl, status, pattern] of cases) {
    const result = await callJev({request, apiKey: 'test-key', fetchImpl});
    assert.equal(result.status, status);
    assert.match(result.error.message, pattern);
  }
});

test('runJevAdvisory supports offline fallback without a network call', async () => {
  let called = false;
  const result = await runJevAdvisory({
    state: STATE,
    apiKey: 'test-key',
    offline: true,
    fetchImpl: async () => {
      called = true;
      throw new Error('should not run');
    },
  });
  assert.equal(called, false);
  assert.equal(result.status, 'offline');
  assert.equal(result.escalate, true);
  assert.equal(result.advisory, null);
  assert.equal(result.requiresPrincipalDecision, true);
});

test('runJevAdvisory with a valid response returns one batch and an advisory', async () => {
  let calls = 0;
  const result = await runJevAdvisory({
    state: STATE,
    apiKey: 'test-key',
    keySource: 'file',
    fetchImpl: async () => {
      calls += 1;
      return {ok: true, status: 200, json: async () => validResponse()};
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'ok');
  assert.equal(result.keySource, 'file');
  assert.equal(result.call.response.answers.route.probabilities.implementation, 0.9);
});

test('redacted evidence carries model/probabilities/confidence but no key', () => {
  const request = buildAdvisoryRequest(STATE);
  const response = validResponse();
  const result = {
    status: 'ok',
    escalate: false,
    advisory: buildAdvisory(request, response).advisory,
    request,
    call: {status: 'ok', response},
    keySource: 'file',
  };
  const evidence = redactedEvidence({result});
  const text = JSON.stringify(evidence);
  assert.equal(evidence.response.model, 'jev-test-1.0.0');
  assert.equal(evidence.response.answers.route.confidence, 0.9);
  assert.equal(evidence.response.answers.route.probabilities.implementation, 0.9);
  assert.equal(evidence.apiKeySource, 'file');
  assert.equal(text.includes('test-key'), false);
  assert.equal(text.includes('TYPESAFE_API_KEY'), false);
  assert.equal(text.includes('Authorization'), false);
});

test('review risk options are exactly the three ordered levels', () => {
  assert.equal(ADVISORY_QUESTIONS.review_risk.criteria.length, 3);
  assert.match(ADVISORY_QUESTIONS.review_risk.criteria[0], /^Low:/);
  assert.match(ADVISORY_QUESTIONS.review_risk.criteria[2], /^High:/);
});
