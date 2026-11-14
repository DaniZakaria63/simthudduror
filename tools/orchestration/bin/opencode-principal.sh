#!/bin/sh
# Private OpenCode launcher for the Orca principal.
#
# Orca does not accept launch-time --model or --effort for opencode2.
# OPENCODE_CONFIG_CONTENT is applied to this private --standalone server, so
# the build agent starts at the requested high variant without changing the
# user's global OpenCode configuration.
#
# The principal still uses the normal HOME/XDG data and credentials, including
# the OpenCode Go auth in the user's OpenCode data directory. MCP servers are
# disabled only for this process because a failing MCP startup modal blocks the
# composer; prompts typed into that modal are not submitted.
#
# Verify the actual assistant-message model after dispatch:
#   orca-team verify-session --session <id>
set -eu

export ORCA_HARNESS_ACTIVE_ROLE=principal

default_config='{"default_agent":"build","agents":{"build":{"model":{"providerID":"opencode-go","model":"deepseek-v4.1-flash","variant":"high"}}}}'
config_script="$(dirname "$0")/opencode-principal-config.mjs"

if [ -n "${ORCA_HARNESS_OPENCODE_CONFIG:-}" ]; then
  export OPENCODE_CONFIG_CONTENT="$ORCA_HARNESS_OPENCODE_CONFIG"
elif [ -x "$config_script" ] && command -v node >/dev/null 2>&1; then
  generated_config="$(node "$config_script" 2>/dev/null || true)"
  export OPENCODE_CONFIG_CONTENT="${generated_config:-$default_config}"
else
  export OPENCODE_CONFIG_CONTENT="$default_config"
fi
export OPENCODE_DISABLE_AUTOUPDATE=true

exec opencode2 --standalone "$@"
