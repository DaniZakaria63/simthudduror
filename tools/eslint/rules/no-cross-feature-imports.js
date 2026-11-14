'use strict';

/**
 * Feature-boundary rule for this repository.
 *
 * Layers:
 * - `src/features/<name>` is a leaf. It may import its own internals, `src/shared`
 *   and navigation *types*, but never a sibling feature, the app shell or
 *   navigation runtime.
 * - `src/shared` is the bottom layer. It never imports a feature, the app shell
 *   or navigation.
 * - `src/app` and `src/navigation` are composition roots. They may consume a
 *   feature only through that feature's public index.
 *
 * Import specifiers are resolved from relative paths and from aliases configured
 * in the rule options (so a future tsconfig `paths` mapping can be mirrored
 * without regex-matching source text).
 */

const path = require('node:path');

const DEFAULT_OPTIONS = {
  featuresDir: 'src/features',
  sharedDir: 'src/shared',
  appDir: 'src/app',
  navigationDir: 'src/navigation',
  navigationTypes: 'src/navigation/types',
};

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function stripExtension(value) {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/, '');
}

function normalizeRelative(value) {
  return toPosix(path.posix.normalize(value)).replace(/^\.\//, '');
}

function classify(relativePath, options) {
  const features = normalizeRelative(options.featuresDir);
  if (relativePath === features) {
    return { kind: 'features' };
  }
  if (relativePath.startsWith(`${features}/`)) {
    const [name, ...rest] = relativePath.slice(features.length + 1).split('/');
    return { kind: 'feature', name, rest: rest.join('/') };
  }

  const shared = normalizeRelative(options.sharedDir);
  if (relativePath === shared || relativePath.startsWith(`${shared}/`)) {
    return { kind: 'shared' };
  }

  const app = normalizeRelative(options.appDir);
  if (relativePath === app || relativePath.startsWith(`${app}/`)) {
    return { kind: 'app' };
  }

  const navigation = normalizeRelative(options.navigationDir);
  if (
    relativePath === navigation ||
    relativePath.startsWith(`${navigation}/`)
  ) {
    return {
      kind: 'navigation',
      isTypes:
        stripExtension(relativePath) ===
        stripExtension(normalizeRelative(options.navigationTypes)),
    };
  }

  return null;
}

function resolveSpecifier(specifier, filename, root, aliases) {
  if (specifier.startsWith('.')) {
    return normalizeRelative(
      path.relative(root, path.resolve(path.dirname(filename), specifier)),
    );
  }

  const prefixes = Object.keys(aliases).sort(
    (left, right) => right.length - left.length,
  );
  for (const prefix of prefixes) {
    if (specifier === prefix || specifier.startsWith(`${prefix}/`)) {
      const rest = specifier.slice(prefix.length).replace(/^\/+/, '');
      return normalizeRelative(path.posix.join(aliases[prefix], rest));
    }
  }

  return null;
}

function isPublicFeatureIndex(target) {
  if (target.kind !== 'feature') {
    return false;
  }
  const rest = stripExtension(target.rest);
  return rest === '' || rest === 'index';
}

function describeTarget(target) {
  if (target.kind === 'features') {
    return 'the src/features aggregate';
  }
  if (target.kind === 'feature') {
    return `feature "${target.name}"`;
  }
  if (target.kind === 'navigation' && target.isTypes) {
    return 'navigation types';
  }
  if (target.kind === 'navigation') {
    return 'navigation runtime';
  }
  if (target.kind === 'app') {
    return 'the app shell';
  }
  return 'shared code';
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce leaf feature, shared, and composition-root import boundaries.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          root: { type: 'string' },
          featuresDir: { type: 'string' },
          sharedDir: { type: 'string' },
          appDir: { type: 'string' },
          navigationDir: { type: 'string' },
          navigationTypes: { type: 'string' },
          aliases: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      siblingFeature:
        'Feature "{{importer}}" must not import sibling {{target}} from "{{source}}". Move shared code to src/shared or pass data through navigation params/props.',
      featureApp:
        'Feature "{{importer}}" must not import {{target}} from "{{source}}". Only src/app and src/navigation compose features.',
      featureNavigation:
        'Feature "{{importer}}" must not import {{target}} from "{{source}}". Features may import navigation types only.',
      sharedBoundary:
        'Shared modules must not import {{target}} from "{{source}}". Shared code is the bottom layer.',
      compositionInternal:
        'Composition roots must import {{target}} through its public index from "{{source}}", not a feature-internal module.',
    },
  },

  create(context) {
    const options = { ...DEFAULT_OPTIONS, ...(context.options[0] || {}) };
    const cwd = context.getCwd();
    const root = options.root ? path.resolve(cwd, options.root) : cwd;
    const aliases = options.aliases || {};

    const relativeFile = normalizeRelative(
      path.relative(root, path.resolve(cwd, context.getFilename())),
    );
    const importer = classify(relativeFile, options);

    if (
      importer === null ||
      importer.kind === 'features' ||
      importer.kind === 'other'
    ) {
      return {};
    }

    function report(node, messageId, target, source) {
      context.report({
        node,
        messageId,
        data: {
          importer: importer.name,
          target: describeTarget(target),
          source,
        },
      });
    }

    function checkResolved(node, source) {
      const resolved = resolveSpecifier(
        source,
        path.resolve(cwd, context.getFilename()),
        root,
        aliases,
      );
      if (resolved === null || resolved.startsWith('../')) {
        return;
      }
      const target = classify(resolved, options);
      if (target === null) {
        return;
      }

      if (importer.kind === 'feature') {
        if (
          target.kind === 'features' ||
          (target.kind === 'feature' && target.name !== importer.name)
        ) {
          report(node, 'siblingFeature', target, source);
          return;
        }
        if (target.kind === 'app') {
          report(node, 'featureApp', target, source);
          return;
        }
        if (target.kind === 'navigation' && !target.isTypes) {
          report(node, 'featureNavigation', target, source);
        }
        return;
      }

      if (importer.kind === 'shared') {
        if (
          target.kind === 'feature' ||
          target.kind === 'features' ||
          target.kind === 'app' ||
          target.kind === 'navigation'
        ) {
          report(node, 'sharedBoundary', target, source);
        }
        return;
      }

      if (importer.kind === 'app' || importer.kind === 'navigation') {
        if (
          (target.kind === 'feature' || target.kind === 'features') &&
          !isPublicFeatureIndex(target)
        ) {
          report(node, 'compositionInternal', target, source);
        }
      }
    }

    function checkDeclaration(node) {
      const source = node.source && node.source.value;
      if (typeof source === 'string') {
        checkResolved(node, source);
      }
    }

    function checkLiteralCall(node) {
      if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') {
        return;
      }
      const argument = node.arguments[0];
      if (
        argument &&
        argument.type === 'Literal' &&
        typeof argument.value === 'string'
      ) {
        checkResolved(argument, argument.value);
      }
    }

    function checkDynamicImport(node) {
      const source = node.source;
      if (
        source &&
        source.type === 'Literal' &&
        typeof source.value === 'string'
      ) {
        checkResolved(source, source.value);
      }
    }

    function checkImportEquals(node) {
      const reference = node.moduleReference;
      if (
        reference &&
        reference.type === 'TSExternalModuleReference' &&
        reference.expression &&
        typeof reference.expression.value === 'string'
      ) {
        checkResolved(reference.expression, reference.expression.value);
      }
    }

    return {
      ImportDeclaration: checkDeclaration,
      ExportNamedDeclaration: checkDeclaration,
      ExportAllDeclaration: checkDeclaration,
      CallExpression: checkLiteralCall,
      ImportExpression: checkDynamicImport,
      TSImportEqualsDeclaration: checkImportEquals,
    };
  },
};
