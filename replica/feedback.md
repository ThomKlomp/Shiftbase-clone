# Feedback from the original's users

**Sample size: 0 verbatim reviews.** Every review source was blocked by this environment's network policy (checked 2026-10-03): Apple RSS, Google Play, Trustpilot, Capterra, G2, OMR, SelectHub, Software Advice, Reddit, Hacker News Algolia, Shiftbase's own feedback board. `reviews.py` refuses an empty sheet, and no review was invented.

What this means: nothing below is evidence. It is a list of hypotheses to verify, and `fixes.md` treats it that way.

## Unverified signals (one source: a web-search summary, paraphrased by the search engine, not quotes)

Search: "Shiftbase review complaints cons". The summary cited these pages, which I could not open to read the original wording:
- https://unrubble.com/blog/shiftbase
- https://www.capterra.com/p/177706/ShiftTime/reviews/
- https://www.selecthub.com/p/employee-scheduling-software/shiftbase/
- https://omr.com/en/reviews/product/shiftbase
- https://www.softwareadvice.com/hr/shifttime-profile/

Claims the summary attributed to users (all unverified, one source, thin by the tool's own rule):

| # | claim as summarised | check against first-party docs |
| --- | --- | --- |
| H1 | setup is not intuitive, takes 2 to 3 days | cannot check |
| H2 | too much scrolling to see who works where across locations or long shifts | plausible: the schedule is a team-grouped grid |
| H3 | admins cannot edit shifts on mobile and must use a desktop | contradicted for the app: the help article "Mobile app: Schedule" describes plus, pencil and delete for planners. May apply to plans or older versions |
| H4 | the mobile app cannot copy last week's availability | partly contradicted: the web "Specify availability" article has "copy from previous week"; the mobile article was not checked for it |
| H5 | cannot print clean schedules, or copy full weeks | contradicted for copying: "Copy schedule" is a help article. Printing: "Printing the work schedule" exists, quality unknown |
| H6 | no custom fields, rigid report templates | **contradicted**: the help centre has "Custom fields (schedule & timesheet)" and "Custom fields (Employees)". This shows the summary is unreliable |
| H7 | no clear record of who removed or changed shifts | cannot check; no audit-log article appears in the help centre index |
| H8 | forgotten clock-outs force manual correction | plausible; the help centre has clock boundaries, which suggests the problem is known |

Only H7 and H8 are both unrefuted and cheap to address, so they are the only ones used in the fix plan.

## To collect (needs the user, in a normal browser)

Open each source, copy 100+ rows into `replica/reviews.csv` (`source,url,date,rating,text`, text exactly as written), include 3 and 4 star reviews, then run `python3 .claude/skills/replica-entrepreneur/reviews.py replica/reviews.csv --out replica/feedback.md`. Then redo `fixes.md` from real data.
