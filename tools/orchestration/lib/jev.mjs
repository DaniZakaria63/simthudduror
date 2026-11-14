import {canonicalJson, sha256, truncate} from './util.mjs';

export const ADVISORY_MODEL = 'jev-latest';
export const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const ADVISORY_VERSION = 1;

export const ADVISORY_QUESTIONS = Object.freeze({
  route: {
    type: 'choice',
    instructions:
      'Which kind of next step should the OpenCode principal consider for this task? Choose exactly one.',
    criteria: {
      implementation:
        'A single Codex implementation worker should make a scoped change in the app repository. Only that worker may edit app code.',
      research:
        'External documentation, web research, or CLI behavior must be gathered first. Research never edits app code.',
      review:
        'An existing implementation or plan needs independent review before acceptance. Review never edits app code.',
      principal_decision:
        'The OpenCode principal must decide, clarify scope, or escalate; do not delegate yet.',
    },
  },
  research_needed: {
    type: 'noul',
    instructions:
      'Does this task require new external evidence, such as live documentation or observed CLI behavior, before the principal can safely decide?',
    criteria: {
      true: 'New external evidence is required before a safe decision.',
      false: 'The available repository evidence is enough for the next step.',
    },
  },
  evidence_sufficient: {
    type: 'noul',
    instructions:
      'Is the evidence in the supplied state sufficient and unambiguous for a safe next step without further clarification?',
    criteria: {
      true: 'The evidence is sufficient and unambiguous for a safe next step.',
      false: 'Evidence is missing, contradictory, or too ambiguous to proceed without principal review.',
    },
  },
  review_risk: {
    type: 'score',
    instructions:
      'How much review risk does the proposed next step carry, considering app behavior, secrets, shared configuration, and reversibility?',
    criteria: [
      'Low: docs or tooling only, no app behavior change and no shared configuration.',
      'Moderate: implementation may touch app behavior, tests, or project configuration.',
      'High: security, secrets, data loss, global configuration, or an unclear rollback path.',
    ],
  },
});

export const ADVISORY_QUESTION_IDS = Object.keys(ADVISORY_QUESTIONS);
export const ROUTE_OPTIONS = Object.keys(ADVISORY_QUESTIONS.route.criteria);
export const REVIEW_LEVELS = ADVISORY_QUESTIONS.review_risk.criteria.length;

export const DEFAULT_THRESHOLDS = Object.freeze({
  minConfidence: 0.55,
  minChoiceProbability: 0.6,
  minEvidence: 0.7,
  maxReviewRisk: 1.5,
  researchNeeded: 0.7,
});

export const EXAMPLE_STATE = Object.freeze({
  project: 'simthudduror',
  task: 'Add a small reusable Orca orchestration harness without changing app behavior.',
  scope: 'AGENTS.md, tools/orchestration, docs/orchestration, and a narrowly scoped Jev README link.',
  evidence:
    'The implementation worker will provide commands, offline tests, a live Jev smoke result, and model/effort session evidence.',
  constraints: [
    'The OpenCode principal decides architecture, delegation, review, and acceptance.',
    'Only the Codex implementation worker edits app code.',
    'Research never edits app code and reports evidence to the OpenCode principal.',
    'Jev is advisory; confidence is not permission and its output is never executed as commands.',
    'Use native Orca mailbox supervision; no polling scheduler.',
  ],
  uncertainties: [
    'Orca does not accept launch-time model or effort selection for opencode2, so the principal launch uses a controlled OpenCode config wrapper and verifies the created session.',
    'The harness is explicitly opt-in and must not coerce unrelated tasks.',
  ],
});

export function buildAdvisoryRequest(state, {model = ADVISORY_MODEL} = {}) {
  return {
    model,
    state,
    questions: JSON.parse(JSON.stringify(ADVISORY_QUESTIONS)),
  };
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isFiniteNumberInRange(value, min = 0, max = 1) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function probabilityMapFor(question) {
  if (question.type === 'choice') return Object.keys(question.criteria);
  if (question.type === 'score') return question.criteria.map((_, index) => String(index));
  return null;
}

/**
 * Validate the typed response before any policy sees it. Invalid input never
 * produces an advisory and never becomes a command.
 */
export function validateJevResponse(request, response) {
  const errors = [];
  if (!isPlainObject(request) || !isPlainObject(request.questions)) {
    return {ok: false, errors: ['request.questions must be an object']};
  }
  if (!isPlainObject(response)) {
    return {ok: false, errors: ['response must be an object']};
  }
  if (typeof response.model !== 'string' || response.model.length === 0) {
    errors.push('response.model must be a non-empty string');
  }
  if (!isPlainObject(response.answers)) {
    errors.push('response.answers must be an object');
    return {ok: false, errors};
  }

  const expected = Object.keys(request.questions).sort();
  const actual = Object.keys(response.answers).sort();
  if (arrEq(expected, actual) === false) {
    errors.push(`response.answers keys must be exactly: ${expected.join(', ')}`);
  }

  for (const id of expected) {
    const question = request.questions[id];
    const answer = response.answers[id];
    if (!isPlainObject(answer)) {
      errors.push(`answers.${id} must be an object`);
      continue;
    }
    if (answer.type !== question.type) {
      errors.push(`answers.${id}.type must be ${question.type}`);
      continue;
    }

    if (question.type === 'choice') {
      const options = Object.keys(question.criteria);
      if (!options.includes(answer.choice)) {
        errors.push(`answers.${id}.choice must be one of: ${options.join(', ')}`);
      }
      if (!isFiniteNumberInRange(answer.confidence)) {
        errors.push(`answers.${id}.confidence must be a number from 0 to 1`);
      }
      validateProbabilities(errors, id, answer.probabilities, options);
    } else if (question.type === 'noul') {
      if (!isFiniteNumberInRange(answer.noul)) {
        errors.push(`answers.${id}.noul must be a number from 0 to 1`);
      }
    } else if (question.type === 'score') {
      const levels = question.criteria.length;
      if (
        typeof answer.score !== 'number' ||
        !Number.isFinite(answer.score) ||
        answer.score < 0 ||
        answer.score > levels - 1
      ) {
        errors.push(`answers.${id}.score must be a number from 0 to ${levels - 1}`);
      }
      if (!isFiniteNumberInRange(answer.confidence)) {
        errors.push(`answers.${id}.confidence must be a number from 0 to 1`);
      }
      validateProbabilities(errors, id, answer.probabilities, probabilityMapFor(question));
    } else {
      errors.push(`answers.${id}.type is unsupported: ${question.type}`);
    }
  }

  if (response.usage !== undefined) {
    if (!isPlainObject(response.usage)) {
      errors.push('response.usage must be an object when present');
    } else {
      for (const key of ['input_tokens', 'output_tokens']) {
        if (
          response.usage[key] !== undefined &&
          (!Number.isInteger(response.usage[key]) || response.usage[key] < 0)
        ) {
          errors.push(`response.usage.${key} must be a non-negative integer`);
        }
      }
    }
  }

  return {ok: errors.length === 0, errors};
}

function validateProbabilities(errors, id, probabilities, expectedKeys) {
  if (!isPlainObject(probabilities)) {
    errors.push(`answers.${id}.probabilities must be an object`);
    return;
  }
  const actual = Object.keys(probabilities).sort();
  const expected = [...expectedKeys].sort();
  if (arrEq(actual, expected) === false) {
    errors.push(`answers.${id}.probabilities keys must be exactly: ${expected.join(', ')}`);
    return;
  }
  let sum = 0;
  for (const key of expectedKeys) {
    const value = probabilities[key];
    if (!isFiniteNumberInRange(value)) {
      errors.push(`answers.${id}.probabilities.${key} must be a number from 0 to 1`);
      return;
    }
    sum += value;
  }
  if (Math.abs(sum - 1) > 0.02) {
    errors.push(`answers.${id}.probabilities must sum to approximately 1 (got ${sum.toFixed(4)})`);
  }
}

function arrEq(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function choiceAnswer(response, id) {
  const answer = response.answers[id];
  return {
    type: answer.type,
    choice: answer.choice,
    confidence: answer.confidence,
    probabilities: answer.probabilities,
    probability: answer.probabilities[answer.choice],
  };
}

function noulAnswer(response, id) {
  return {type: 'noul', noul: response.answers[id].noul};
}

function scoreAnswer(response, id) {
  const answer = response.answers[id];
  return {
    type: 'score',
    score: answer.score,
    confidence: answer.confidence,
    probabilities: answer.probabilities,
    legend: answer.legend,
  };
}

/**
 * Turn a validated answer into an advisory. The OpenCode principal remains the
 * decision owner; confidence only controls whether the principal must look
 * before acting.
 */
export function buildAdvisory(request, response, {thresholds = DEFAULT_THRESHOLDS} = {}) {
  const validation = validateJevResponse(request, response);
  if (!validation.ok) {
    return {
      status: 'invalid_response',
      escalate: true,
      advisory: null,
      validationErrors: validation.errors,
      requiresPrincipalDecision: true,
      authorization: 'none',
      note: 'Invalid Jev response. No decision or command was derived.',
    };
  }

  const route = choiceAnswer(response, 'route');
  const researchNeeded = noulAnswer(response, 'research_needed');
  const evidenceSufficient = noulAnswer(response, 'evidence_sufficient');
  const reviewRisk = scoreAnswer(response, 'review_risk');

  const reasons = [];
  if (route.confidence < thresholds.minConfidence) {
    reasons.push(`route confidence ${route.confidence.toFixed(2)} is below ${thresholds.minConfidence}`);
  }
  if (route.probability < thresholds.minChoiceProbability) {
    reasons.push(
      `route probability ${route.probability.toFixed(2)} is below ${thresholds.minChoiceProbability}`,
    );
  }
  if (evidenceSufficient.noul < thresholds.minEvidence) {
    reasons.push(
      `evidence_sufficient ${evidenceSufficient.noul.toFixed(2)} is below ${thresholds.minEvidence}`,
    );
  }
  if (reviewRisk.score >= thresholds.maxReviewRisk) {
    reasons.push(
      `review_risk score ${reviewRisk.score.toFixed(2)} is at or above ${thresholds.maxReviewRisk}`,
    );
  }
  if (researchNeeded.noul >= thresholds.researchNeeded && route.choice === 'implementation') {
    reasons.push('research is likely needed before implementation');
  }
  if (route.choice === 'principal_decision') {
    reasons.push('the model selected principal_decision');
  }

  const editsApp =
    route.choice === 'implementation' ? 'implementation-worker-only' : false;

  return {
    status: 'ok',
    advisory: {
      route,
      researchNeeded,
      evidenceSufficient,
      reviewRisk,
      editsApp,
      researchMayEditApp: false,
      authorization: 'none',
      requiresPrincipalDecision: true,
      confidenceIsPermission: false,
      commands: [],
      note:
        'Advisory only. The OpenCode principal decides. Confidence is not permission. No model-provided command is executed.',
    },
    escalate: reasons.length > 0,
    escalationReasons: reasons,
    threshold: thresholds,
    requiresPrincipalDecision: true,
    authorization: 'none',
    note:
      'Advisory only. The OpenCode principal decides. Confidence is not permission. No model-provided command is executed.',
  };
}

export async function callJev({
  request,
  apiKey,
  fetchImpl = globalThis.fetch,
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = 30_000,
} = {}) {
  if (!apiKey) {
    return {
      status: 'unavailable',
      error: {code: 'missing_key', message: 'No TypeSafe API key is available.'},
    };
  }
  if (typeof fetchImpl !== 'function') {
    return {
      status: 'unavailable',
      error: {code: 'fetch_unavailable', message: 'No fetch implementation is available.'},
    };
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: timeoutSignal(timeoutMs),
    });
  } catch (error) {
    const timeout = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      status: 'unavailable',
      error: {
        code: timeout ? 'timeout' : 'network_error',
        message: timeout
          ? `TypeSafe request timed out after ${timeoutMs} ms.`
          : 'TypeSafe request failed before a response was received.',
      },
    };
  }

  if (!response || typeof response.ok !== 'boolean' || !response.ok) {
    const status = typeof response?.status === 'number' ? response.status : null;
    const code =
      status === 401 || status === 403
        ? 'unauthorized'
        : status === 429
          ? 'rate_limited'
          : status !== null && status >= 500
            ? 'server_error'
            : 'http_error';
    return {
      status: 'unavailable',
      httpStatus: status,
      error: {code, message: status === null ? 'TypeSafe returned no HTTP response.' : `TypeSafe returned HTTP ${status}.`},
    };
  }

  let json;
  try {
    json = await response.json();
  } catch {
    return {
      status: 'invalid_response',
      error: {code: 'invalid_json', message: 'TypeSafe returned a response that was not valid JSON.'},
    };
  }

  const validation = validateJevResponse(request, json);
  if (!validation.ok) {
    return {
      status: 'invalid_response',
      httpStatus: response.status ?? 200,
      error: {code: 'schema_invalid', message: 'TypeSafe returned a response that failed typed validation.'},
      validationErrors: validation.errors,
    };
  }

  return {status: 'ok', httpStatus: response.status ?? 200, response: json};
}

function timeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

/**
 * Single entry point used by the CLI and tests. It never throws for network,
 * auth, or malformed-response failures; it returns an escalation instead.
 */
export async function runJevAdvisory({
  state,
  apiKey,
  keySource = null,
  fetchImpl,
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = 30_000,
  offline = false,
  thresholds = DEFAULT_THRESHOLDS,
  model = ADVISORY_MODEL,
} = {}) {
  const request = buildAdvisoryRequest(state, {model});
  if (offline) {
    return {
      status: 'offline',
      escalate: true,
      advisory: null,
      requiresPrincipalDecision: true,
      authorization: 'none',
      reason: 'offline mode requested; no network call was made',
      request,
      call: {status: 'offline'},
      keySource,
    };
  }
  if (!apiKey) {
    return {
      status: 'unavailable',
      escalate: true,
      advisory: null,
      requiresPrincipalDecision: true,
      authorization: 'none',
      reason: 'missing TypeSafe API key',
      request,
      call: {status: 'unavailable', error: {code: 'missing_key'}},
      keySource,
    };
  }

  const call = await callJev({request, apiKey, fetchImpl, endpoint, timeoutMs});
  if (call.status !== 'ok') {
    return {
      status: call.status,
      escalate: true,
      advisory: null,
      requiresPrincipalDecision: true,
      authorization: 'none',
      reason: call.error?.message ?? 'TypeSafe did not produce a usable response.',
      error: call.error,
      validationErrors: call.validationErrors,
      request,
      call,
      keySource,
    };
  }

  const policy = buildAdvisory(request, call.response, {thresholds});
  return {
    ...policy,
    request,
    call,
    keySource,
  };
}

export function redactedEvidence({result, endpoint = DEFAULT_ENDPOINT, capturedAt = new Date().toISOString()}) {
  const request = result.request ?? null;
  const call = result.call ?? {status: result.status};
  const base = {
    version: ADVISORY_VERSION,
    capturedAt,
    endpoint,
    apiKeySource: result.keySource ?? null,
    request: request
      ? {
          model: request.model,
          stateSha256: sha256(canonicalJson(request.state)),
          stateExcerpt: truncate(JSON.stringify(request.state), 800),
          questions: request.questions,
        }
      : null,
    result: {
      status: result.status,
      escalate: result.escalate,
      advisory: result.advisory ?? null,
      escalationReasons: result.escalationReasons ?? [],
      reason: result.reason ?? null,
      error: result.error ?? null,
      validationErrors: result.validationErrors ?? null,
      requiresPrincipalDecision: true,
      authorization: 'none',
    },
    response:
      call.status === 'ok'
        ? {
            model: call.response.model,
            answers: call.response.answers,
            usage: call.response.usage ?? null,
          }
        : null,
  };
  return JSON.parse(JSON.stringify(base));
}
