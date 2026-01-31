# Executive Summary
**Weekly Meeting Report: {{period.from}} to {{period.to}}**

## Key Metrics
| Metric | Value |
|--------|-------|
| Total Meetings | {{totalMeetings}} |
| Total Time | {{totalDuration | duration}} |
| Action Items | {{actionItems.total}} |

## Top Highlights
{{#highlights}}
- **{{meetingTitle}}**: {{#keyPoints}}{{.}} {{/keyPoints}}
{{/highlights}}

## Outstanding Action Items
{{#actionItems.unassigned}}
- {{text}}
{{/actionItems.unassigned}}

---
*Executive Summary generated with fireflies-api*
