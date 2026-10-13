# Live release evidence

I published and independently checked this concept on 13 October 2026. All people, numbers and scenarios are synthetic. It is an independent portfolio concept, not an affiliated product or production service.

- Live demo: https://terra-operating-cadence-proof.ayoahmed-49d.workers.dev
- Voiced public walkthrough: https://drive.google.com/file/d/1zzT29lCpgFMcRPvnA_19Kk4FY8gBul54/view
- The video is a 98.4-second recording of the real public demo, not a mockup. It has pointer movement, narration and captions.
- Video access: anyone with the link can view, verified after upload.
- Reviewed code commit: `e954eb6fbd1fa4dd32d5b449afc075554434beb6`
- Deployment version: `d4bd90a2-dedb-4c48-b31c-5bf8e48d2f26`
- Hosting plan: Free, verified on deployment day. No paid plan or payment setup was used.

## Checks I ran

59 unit; 20 evaluations; negative control caught 6 defects; 38/38 clean live API checks.

I checked sampled final video frames for readable states and captions, and checked the narration transcript against the demonstrated flow. The narration is a rough synthetic voice, not my own voice recording. These checks are not a substitute for a full recipient review of the cut.

## Limits

The first post-deployment API run had transient 1042/500 responses (30/38). A fresh clean re-run passed 38/38 after propagation. This remains a recorded limitation, not a production SLA.

No outreach or application was sent as part of this release. The walkthrough is a review cut. Earlier source-only deployment/video notes describe the pre-release state; this record supersedes those publication claims.
