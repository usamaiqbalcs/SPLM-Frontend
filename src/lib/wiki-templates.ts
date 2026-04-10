export const WIKI_TEMPLATES = [
  {
    category: 'Meeting',
    name: 'Meeting Notes',
    icon: '📝',
    content: `# Meeting Notes

**Date:** ${new Date().toISOString().split('T')[0]}
**Attendees:** @name1, @name2
**Facilitator:**

---

## Agenda
1. Item 1
2. Item 2
3. Item 3

## Discussion Notes

### Topic 1
- Key points discussed
- Decisions made

### Topic 2
- Key points discussed
- Decisions made

## Action Items
- [ ] Action item 1 — Owner: @name — Due: YYYY-MM-DD
- [ ] Action item 2 — Owner: @name — Due: YYYY-MM-DD

## Next Steps
- Follow-up meeting scheduled for:
`,
  },
  {
    category: 'Project',
    name: 'Project Plan',
    icon: '📋',
    content: `# Project Plan: [Project Name]

## Overview
Brief description of the project goals and scope.

## Objectives
- Objective 1
- Objective 2
- Objective 3

## Timeline
| Phase | Start | End | Status |
|-------|-------|-----|--------|
| Planning | YYYY-MM-DD | YYYY-MM-DD | ✅ Done |
| Development | YYYY-MM-DD | YYYY-MM-DD | 🔄 In Progress |
| Testing | YYYY-MM-DD | YYYY-MM-DD | ⏳ Pending |
| Launch | YYYY-MM-DD | YYYY-MM-DD | ⏳ Pending |

## Team
| Role | Name |
|------|------|
| Project Lead | @name |
| Engineering | @name |
| QA | @name |

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High | Mitigation strategy |

## Success Metrics
- Metric 1: Target
- Metric 2: Target
`,
  },
  {
    category: 'Decision',
    name: 'Decision Log',
    icon: '⚖️',
    content: `# Decision: [Title]

**Status:** 🟡 Proposed / 🟢 Approved / 🔴 Rejected
**Date:** ${new Date().toISOString().split('T')[0]}
**Decision Maker:** @name
**Stakeholders:** @name1, @name2

---

## Context
What is the issue or question we need to decide on?

## Options Considered

### Option A: [Name]
- **Pros:** List advantages
- **Cons:** List disadvantages
- **Effort:** Low / Medium / High

### Option B: [Name]
- **Pros:** List advantages
- **Cons:** List disadvantages
- **Effort:** Low / Medium / High

## Decision
Which option was chosen and why.

## Consequences
What are the implications of this decision?

## Action Items
- [ ] Item 1 — @owner
- [ ] Item 2 — @owner
`,
  },
  {
    category: 'Operations',
    name: 'Runbook',
    icon: '🔧',
    content: `# Runbook: [Service/Process Name]

## Overview
Brief description of what this runbook covers.

## Prerequisites
- Access to production servers
- Required tools installed
- Permissions needed

## Procedure

### Step 1: [Action]
\`\`\`bash
# Command to run
\`\`\`
Expected output: Description

### Step 2: [Action]
\`\`\`bash
# Command to run
\`\`\`
Expected output: Description

### Step 3: [Verification]
\`\`\`bash
# Verification command
\`\`\`

## Rollback Steps
If something goes wrong:
1. Step 1
2. Step 2

## Escalation
- **L1:** @oncall-engineer
- **L2:** @team-lead
- **L3:** @vp-engineering

## Related Resources
- [Link to dashboard]()
- [Link to monitoring]()
`,
  },
  {
    category: 'Retrospective',
    name: 'Sprint Retrospective',
    icon: '🔄',
    content: `# Sprint Retrospective: [Sprint Name]

**Date:** ${new Date().toISOString().split('T')[0]}
**Facilitator:** @name
**Team:** @name1, @name2, @name3

---

## 🟢 What Went Well
- Item 1
- Item 2
- Item 3

## 🔴 What Didn't Go Well
- Item 1
- Item 2
- Item 3

## 💡 Ideas for Improvement
- Idea 1
- Idea 2
- Idea 3

## 🎯 Action Items for Next Sprint
- [ ] Action 1 — Owner: @name
- [ ] Action 2 — Owner: @name

## 📊 Sprint Metrics
- **Velocity:** X story points
- **Planned vs Completed:** X / Y
- **Bugs Found:** X
- **Customer Issues:** X
`,
  },
];
