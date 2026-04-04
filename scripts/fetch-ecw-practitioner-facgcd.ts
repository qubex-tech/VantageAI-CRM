/**
 * OAuth + FHIR Practitioner / PractitionerRole reads (eCW USCDI — same interactions as Connect docs):
 * https://fhir.eclinicalworks.com/ecwopendev/documentation/v3-read-resources?name=Practitioner
 * https://fhir.eclinicalworks.com/ecwopendev/documentation/v3-read-resources?name=PractitionerRole
 *
 * Uses curl for HTTP — Node fetch/undici often hangs to eclinicalworks from some networks.
 *   node --env-file=…/.env.local --import tsx scripts/fetch-ecw-practitioner-facgcd.ts
 */
import { execFileSync } from 'child_process'
import { createClientAssertion } from '../src/lib/integrations/ehr/smartEngine'
import { getEcwClientAssertionAud, getPrivateKeyJwtConfig } from '../src/lib/integrations/ehr/server'

const ISSUER = 'https://fhir4.eclinicalworks.com/fhir/r4/FACGCD'
const CLIENT_ID = 'nsrtN6cgGskw8RcEMcXifn_Y8h3rJ4BnVYOqJOID_Mk'
const PRACTITIONER_ID = 'W6s8TGka96L4tHbCRoQU8YMH.WUkwA2pU9wsHWwur0c'
const SCOPES = 'system/Practitioner.read system/PractitionerRole.read'

function curl(args: string[], inputBody?: string): string {
  const full = ['curl', '-sS', '--max-time', '120', ...args]
  return execFileSync(full[0], full.slice(1), {
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
    input: inputBody,
  })
}

function discover(): { tokenEndpoint: string; fhirBaseUrl: string } {
  const wellKnown = `${ISSUER}/.well-known/smart-configuration`
  const text = curl(['-H', 'Accept: application/json', wellKnown])
  const j = JSON.parse(text) as { token_endpoint?: string; fhir_base_url?: string }
  if (!j.token_endpoint) throw new Error('SMART config missing token_endpoint')
  const fhirBase = (j.fhir_base_url || ISSUER).replace(/\/+$/g, '')
  return { tokenEndpoint: j.token_endpoint, fhirBaseUrl: fhirBase }
}

function exchangeToken(tokenEndpoint: string, clientAssertion: string): { access_token: string } {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    scope: SCOPES,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
  })
  const text = curl(
    ['-X', 'POST', '-H', 'Content-Type: application/x-www-form-urlencoded', tokenEndpoint],
    body.toString()
  )
  const j = JSON.parse(text) as { access_token?: string; error?: string; error_description?: string }
  if (!j.access_token) {
    throw new Error(`Token error: ${j.error || 'unknown'} ${j.error_description || text.slice(0, 500)}`)
  }
  return { access_token: j.access_token }
}

function fhirJson(url: string, accessToken: string) {
  const text = curl([
    '-H',
    'Accept: application/fhir+json',
    '-H',
    `Authorization: Bearer ${accessToken}`,
    url,
  ])
  return JSON.parse(text)
}

async function main() {
  console.error('[1] discovery (curl)…')
  const { tokenEndpoint, fhirBaseUrl } = discover()

  const pk = getPrivateKeyJwtConfig('ecw_write')
  if (!pk?.keyId) throw new Error('Missing EHR_JWT_PRIVATE_KEY / EHR_JWT_KEY_ID')

  const assertion = createClientAssertion({
    clientId: CLIENT_ID,
    tokenEndpoint,
    privateKeyPem: pk.privateKeyPem,
    keyId: pk.keyId,
    audience: getEcwClientAssertionAud(ISSUER),
  })

  console.error('[2] token (curl)…')
  const { access_token } = exchangeToken(tokenEndpoint, assertion)

  const practitionerUrl = `${fhirBaseUrl}/Practitioner?_id=${encodeURIComponent(PRACTITIONER_ID)}&_count=1`
  const roleUrl = new URL(`${fhirBaseUrl}/PractitionerRole`)
  roleUrl.searchParams.set('practitioner', `Practitioner/${PRACTITIONER_ID}`)
  roleUrl.searchParams.set('_count', '10')

  console.error('[3] Practitioner + PractitionerRole…')
  const practitioner = fhirJson(practitionerUrl, access_token)
  const practitionerRole = fhirJson(roleUrl.toString(), access_token)

  console.log(
    JSON.stringify(
      {
        requests: { practitionerUrl, practitionerRoleUrl: roleUrl.toString() },
        practitioner,
        practitionerRole,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
