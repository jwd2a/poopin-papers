#!/bin/bash
#
# Test the full weekly delivery pipeline locally.
#
# Prerequisites:
#   1. supabase start
#   2. npm run dev (running on port 3000)
#   3. At least one user signed up with a paper
#
# Usage:
#   ./scripts/test-pipeline.sh [step]
#
# Steps:
#   all       - Run entire pipeline (default)
#   generate  - Wednesday: generate shared edition
#   preview   - Saturday: compose + send preview emails
#   deliver   - Sunday: compose + PDF + send final emails
#   status    - Show current state of editions/papers
#

set -e

BASE_URL="http://localhost:3000"
CRON_SECRET="local-dev-secret"
AUTH="Authorization: Bearer $CRON_SECRET"

step="${1:-all}"

green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }
blue() { echo -e "\033[34m$1\033[0m"; }

status() {
  blue "── Current State ──────────────────────────────────────"
  echo ""
  yellow "Weekly Editions:"
  psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -c \
    "SELECT id::text, week_start, issue_number, status, approved_at IS NOT NULL as approved FROM weekly_editions ORDER BY week_start DESC LIMIT 3;" 2>/dev/null || echo "  (could not connect to DB)"
  echo ""
  yellow "Papers:"
  psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -c \
    "SELECT p.id::text, pr.family_name, p.week_start, p.status, p.composed_html IS NOT NULL as has_html FROM papers p JOIN profiles pr ON p.user_id = pr.id ORDER BY p.week_start DESC LIMIT 5;" 2>/dev/null || echo "  (could not connect to DB)"
  echo ""
  yellow "Profiles:"
  psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -c \
    "SELECT id::text, email, family_name, timezone, subscription_status, is_admin FROM profiles LIMIT 5;" 2>/dev/null || echo "  (could not connect to DB)"
  echo ""
}

generate() {
  blue "── Step 1: Generate Edition (Wednesday) ───────────────"
  echo "Generating shared content (coaching, fun zone, brain fuel, this week)..."
  echo "This takes 1-3 minutes (AI generation + composition + vision QA)..."
  echo ""

  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/cron/generate-edition" \
    -H "$AUTH")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    green "✓ Edition generated successfully"
    echo "  $body"
  else
    red "✗ Failed (HTTP $http_code)"
    echo "  $body"
    return 1
  fi
  echo ""
}

preview() {
  blue "── Step 2: Saturday Preview ───────────────────────────"
  echo ""
  yellow "⚠  The saturday-preview cron checks if it's Saturday 8 AM"
  yellow "   in each user's timezone. If it's not, it will skip everyone."
  yellow "   To force-test, temporarily patch isTargetHour() to return true,"
  yellow "   or set your profile timezone to match the current time."
  echo ""
  echo "Hitting the endpoint anyway..."

  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/cron/saturday-preview" \
    -H "$AUTH")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    green "✓ Saturday preview completed"
    echo "  $body"
    processed=$(echo "$body" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*')
    if [ "$processed" = "0" ]; then
      yellow "  ⚠  0 users processed (likely timezone mismatch — see note above)"
    fi
  else
    red "✗ Failed (HTTP $http_code)"
    echo "  $body"
    return 1
  fi
  echo ""
}

deliver() {
  blue "── Step 3: Sunday Delivery ────────────────────────────"
  echo ""
  yellow "⚠  Same timezone gate as Saturday — see note above."
  echo ""
  echo "Hitting the endpoint..."

  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/cron/sunday-deliver" \
    -H "$AUTH")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    green "✓ Sunday delivery completed"
    echo "  $body"
    processed=$(echo "$body" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*')
    if [ "$processed" = "0" ]; then
      yellow "  ⚠  0 users processed (likely timezone mismatch)"
    fi
  else
    red "✗ Failed (HTTP $http_code)"
    echo "  $body"
    return 1
  fi
  echo ""
}

echo ""
blue "🧻 Poopin' Papers — Pipeline Test"
blue "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

case "$step" in
  status)
    status
    ;;
  generate)
    generate
    status
    ;;
  preview)
    preview
    status
    ;;
  deliver)
    deliver
    status
    ;;
  all)
    status
    generate
    echo "Waiting 2s before next step..."
    sleep 2
    preview
    echo "Waiting 2s before next step..."
    sleep 2
    deliver
    echo ""
    green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    green "Pipeline complete! Check:"
    green "  • Mailpit: http://127.0.0.1:54334"
    green "  • Paper:   http://localhost:3000/paper"
    green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    ;;
  *)
    red "Unknown step: $step"
    echo "Usage: $0 [all|generate|preview|deliver|status]"
    exit 1
    ;;
esac
