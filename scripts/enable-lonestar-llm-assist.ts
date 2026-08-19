/**
 * Enable Stagehand LLM assist on Lonestar's Availity eligibility practice playbook.
 *
 *   npx tsx scripts/enable-lonestar-llm-assist.ts
 */
import { prisma } from '../src/lib/db'
import {
  AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
  getOrCreatePracticePlaybook,
  normalizeAvailityEligibilityConfig,
  updatePracticePlaybookConfig,
} from '../src/lib/browser-agent/practice-playbook'

const LONESTAR_PRACTICE_ID = '8a48db6f-5e3c-461a-bdb9-7eca3d6acb75'

async function main() {
  const existing = await getOrCreatePracticePlaybook(
    LONESTAR_PRACTICE_ID,
    AVAILITY_ELIGIBILITY_PLAYBOOK_KEY
  )
  const next = normalizeAvailityEligibilityConfig({
    ...existing.config,
    llmAssist: {
      enabled: true,
      model: existing.config.llmAssist?.model || 'openai/gpt-4.1-mini',
    },
  })
  const updated = await updatePracticePlaybookConfig({
    practiceId: LONESTAR_PRACTICE_ID,
    playbookKey: AVAILITY_ELIGIBILITY_PLAYBOOK_KEY,
    config: next,
    isActive: true,
  })
  console.log(
    JSON.stringify(
      {
        id: updated.id,
        practiceId: updated.practiceId,
        llmAssist: updated.config.llmAssist,
        inquiry: updated.config.inquiry,
      },
      null,
      2
    )
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
