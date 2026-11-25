#!/usr/bin/env bash
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
net="kanto-runtime-ci"
tls=$(mktemp -d)
cleanup() {
  docker rm -f kanto-rt-gateway kanto-rt-edge kanto-rt-web kanto-rt-api >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  rm -rf "$tls"
}
trap cleanup EXIT
# No external internet, public domains or credentials in this Docker network.
docker network create --internal "$net" >/dev/null
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=web-ci.up.railway.app' \
  -addext 'subjectAltName=DNS:web-ci.up.railway.app' -keyout "$tls/key.pem" -out "$tls/cert.pem" 2>/dev/null
chmod 755 "$tls"
chmod 644 "$tls/cert.pem"
sign=$(openssl rand -hex 32)
subject=$(openssl rand -hex 32)
echo "::add-mask::$sign"
echo "::add-mask::$subject"
common=(--network "$net" -v "$PWD:/repo:ro" -w /repo -e GITHUB_ACTIONS=true -e GATEWAY_RUNTIME_SMOKE=ci)
docker run -d --name kanto-rt-api --network-alias api.railway.internal "${common[@]}" \
  -e SMOKE_KEY="$sign" node:22-alpine node tests/gateway-runtime-smoke-fixture.mjs receiver >/dev/null
docker run -d --name kanto-rt-web --network-alias web "${common[@]}" \
  -e NODE_ENV=production -e PORT=3000 -e ONLINE_GATEWAY_FORWARD_MODE=reviewed \
  -e ONLINE_RELEASE_MODE=reviewed -e ONLINE_PUBLIC_SAVES_ENABLED=true \
  -e ONLINE_API_INTERNAL_URL=http://api.railway.internal:3001/ node:22-alpine node server.mjs >/dev/null
docker run -d --name kanto-rt-edge --network-alias web-ci.up.railway.app "${common[@]}" \
  -v "$tls:/tls:ro" node:22-alpine node tests/gateway-runtime-smoke-fixture.mjs edge >/dev/null
review='{"ingress":{"projectId":"11111111-1111-4111-8111-111111111111","environmentId":"22222222-2222-4222-8222-222222222222","serviceId":"33333333-3333-4333-8333-333333333333","commitSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publicDomain":"gateway-ci.up.railway.app","serviceCount":1,"replicaCount":1,"tcpProxyCount":0,"publicDomainCount":1,"privateCallersExcluded":true,"changeControlReviewed":true,"reviewReference":"synthetic CI only"},"upstreamOrigin":"https://web-ci.up.railway.app"}'
docker run -d --name kanto-rt-gateway --network "$net" --network-alias gateway \
  -v "$tls/cert.pem:/tls/cert.pem:ro" -e NODE_EXTRA_CA_CERTS=/tls/cert.pem \
  -e ONLINE_RELEASE_MODE=reviewed -e ONLINE_PUBLIC_SAVES_ENABLED=true \
  -e GATEWAY_RUNTIME_MODE=reviewed -e GATEWAY_REVIEW_JSON="$review" \
  -e GATEWAY_UPSTREAM_ORIGIN=https://web-ci.up.railway.app -e GATEWAY_SUBJECT_POLICY=ipv6-prefix64-v2 \
  -e GATEWAY_SIGNING_HEX="$sign" -e GATEWAY_SUBJECT_HEX="$subject" \
  -e RAILWAY_PROJECT_ID=11111111-1111-4111-8111-111111111111 \
  -e RAILWAY_ENVIRONMENT_ID=22222222-2222-4222-8222-222222222222 \
  -e RAILWAY_SERVICE_ID=33333333-3333-4333-8333-333333333333 \
  -e RAILWAY_GIT_COMMIT_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  -e RAILWAY_PUBLIC_DOMAIN=gateway-ci.up.railway.app -e PORT=3000 kanto-auth-gateway-ci >/dev/null
docker run --rm "${common[@]}" node:22-alpine node tests/gateway-runtime-smoke-fixture.mjs client
