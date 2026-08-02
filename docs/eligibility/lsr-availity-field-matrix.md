# Lonestar OV Benefit Fields × Availity Capability Matrix

Source: LSR Eligibility Manual (June 2026) vs Vantage Availity API + portal RPA (Aug 2026).

**Security:** Do not store portal passwords from the staff manual in git. Use CRM `BrowserCredential` vault only.

## Verification modes

| Mode | LSR form | v1 automation target |
|------|----------|----------------------|
| `office_visit` | OV Benefit Verification | Primary (Availity API + RPA) |
| `ultrasound` | Ultrasound form | Partial + **call required** |
| `cimzia` | Cimzia form | Stub / voice |
| `injectable_bone` | Evenity / Jubbonti / Prolia | Stub / voice |

## Field matrix (office visit)

| LSR field | `availity_api` | `availity_rpa` | `voice` | Notes |
|-----------|----------------|----------------|---------|-------|
| Active / inactive | Yes | Yes | Yes | Core status |
| Plan type (PPO/HMO/MA/…) | Often (`insuranceType`) | Heuristic from page text | Yes | |
| Network INN/ONN | Partial | Heuristic | Yes | Depends on NPI/TIN in inquiry |
| Specialist copay | Yes (`amounts.coPayment`) | Regex scrape | Yes | Prefer specialist benefit row |
| Deductible total / met / remaining | Yes | Regex scrape | Yes | API previously discarded amounts — now parsed |
| Coinsurance % | Yes (`coInsurance`) | Regex scrape | Yes | |
| OOP max / remaining | Yes (`outOfPocket`) | Regex scrape | Yes | |
| Referral required | Sometimes (messages) | Heuristic | Yes | |
| Prior auth / pre-cert | Sometimes | Heuristic | Yes | |
| Telehealth allowed | Sometimes | Heuristic | Yes | TV SOP still requires call |
| CPT checklist (99205, …) | Rare | Rare | Preferred | Out of v1 auto-complete |
| Claims address / Epayer / timely filing | No | No | Possible | Different portal area |
| Buy & Bill (drugs) | No | No | Preferred | Cimzia / injectables |

## Appointment-type gates

**Run eligibility:** NP, TVNP, FUV, 2nd FU, TV FU, US  

**Do not run:** S-NP, S-TVNP, S-FU, S-2nd FU, S-TVFU, CMA-Admin Injections, Infusion, Vit IM-IV Infusion  

**Call required (even if EB succeeds):** all Televisit + Ultrasound (`lsr-gates.ts`)

**Medicare of Texas NON-PAR:** skip Availity; apply fixed copays (`$226.76` NP OV/TV, `$121.80` est OV, `$91.90` est TV) when `medicareTxNonPar` / `LSR_MEDICARE_TX_NONPAR=1` and payer name matches.

## Portal routing (beyond Availity)

| Book | Portal | Vantage path today |
|------|--------|--------------------|
| BCBS, Aetna, Humana, Wellcare, Allegiance, Wellpoint | Availity | API → RPA → voice |
| UHC, AARP, WellMed | One Healthcare ID | Voice / future playbook |
| UMR | UMR portal | Voice / future |
| Community Health Choice | CHC portal | Voice / future |
| Medicare + many commercial | Trizetto | Voice / future |
| Participating commercial | NaviNet | Voice / future |

## Live capture checklist (ops)

1. Run Availity API mock / demo coverage and confirm `parsedSummary.rheum` populated.
2. Run Lonestar portal RPA probe; store `pageSnippet` artifact; compare scrape hits vs screenshot.
3. For each of Aetna / BCBS / Humana test patients, mark matrix cells Yes / Partial / No from real payloads.
4. Update this doc’s “Live notes” section with dates.

### Live notes

| Date | Payer | Path | Fields filled | Gaps |
|------|-------|------|---------------|------|
| 2026-08-02 | Aetna (Lonestar Cynthia Burlingame) | RPA | active status | Pre-rheum scrape; re-run to validate amount scrape |
| 2026-08-02 | Mock Health Plan | API mock | copay, deductible, coins, OOP, PPO | N/A |

## Code map

- Packet: `src/lib/eligibility/rheum-packet.ts`
- API amounts: `src/lib/eligibility/parse-availity-amounts.ts`
- RPA scrape: `src/lib/eligibility/scrape-rpa-benefits.ts`
- Gates: `src/lib/eligibility/lsr-gates.ts`
- UI: `src/components/patients/EligibilityOvPanel.tsx` on Insurance tab
