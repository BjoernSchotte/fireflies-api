# Weekly Meeting Digest
**{{period.from}} to {{period.to}}**

## Overview
- **{{totalMeetings}}** meetings
- **{{totalDuration | duration}}** total time
- **{{actionItems.total}}** action items

## Meeting Stats

Busiest day: **{{stats.busiestDay}}**
Average duration: **{{stats.averageDuration | duration}}**

## Meetings & Action Items

{{#actionItems.byMeeting}}
### {{title}}
**{{date | date}}** | {{duration | duration}} | {{participantEmails.length}} participants

**Participants:** {{participantEmails | join}}

{{#items}}
- [ ] {{text}}{{#assignee}} *({{assignee}})*{{/assignee}}
{{/items}}

{{/actionItems.byMeeting}}

## Highlights
{{#highlights}}
### {{meetingTitle}} ({{meetingDate | date}})
{{#keyPoints}}
- {{.}}
{{/keyPoints}}
{{/highlights}}

## Participants
{{#participants}}
- {{email}} ({{meetingCount}} meetings, {{totalMinutes | duration}})
{{/participants}}

---
*Generated with fireflies-api*
