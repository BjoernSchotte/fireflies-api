# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## 0.5.0 (2026-01-28)


### Features

* **action-items:** add multi-transcript export with markdown formatting ([7af76c0](https://github.com/BjoernSchotte/fireflies-api/commit/7af76c0f2e1fd8a9b6b13748ff48f15025384c62))
* **cli:** add additional transcript filters ([fe2479b](https://github.com/BjoernSchotte/fireflies-api/commit/fe2479b9070868f9b7dea7989dddb0660fc2463a))
* **cli:** add audio upload, bites create, and users set-role commands ([734db41](https://github.com/BjoernSchotte/fireflies-api/commit/734db41ccb19eabd132a3dda83972fe8e863f345))
* **cli:** add human-readable duration format for transcripts list ([5926cb5](https://github.com/BjoernSchotte/fireflies-api/commit/5926cb57089ba8d2f8731a920ac893fb98950ca2))
* **cli:** add jsonl and tsv output formats for pipe-friendly CLI ([3eb78b2](https://github.com/BjoernSchotte/fireflies-api/commit/3eb78b2f6ff0f26d189a6bd89cc6ee01f1873646))
* **cli:** add npx fireflies CLI tool ([19606cf](https://github.com/BjoernSchotte/fireflies-api/commit/19606cf45c4027cb7931ccda8ad80d2d74642561))
* **cli:** add speaker analytics commands ([667e76e](https://github.com/BjoernSchotte/fireflies-api/commit/667e76e8c72c17bd31cfd08aa35ef1350188d76f))
* **core:** implement M1 foundation with transcripts API ([22cf19d](https://github.com/BjoernSchotte/fireflies-api/commit/22cf19d49cd7dc423ce2edd452d286f5482b6e4c))
* **graphql:** add full GraphQL coverage (M3) ([b5fbcac](https://github.com/BjoernSchotte/fireflies-api/commit/b5fbcacb63f6cd259c2628f27c958cf9e810b8cc))
* **helpers:** add analyzeSpeakers for speaker participation metrics ([236adc5](https://github.com/BjoernSchotte/fireflies-api/commit/236adc5e396b1c03531ca71ad748ca97fb66fe52))
* **helpers:** add batch normalize and Zod schema validation ([bdf9f4f](https://github.com/BjoernSchotte/fireflies-api/commit/bdf9f4f40d416d2533b3f4d6472a144022649f6b))
* **helpers:** add convenience helpers for power users (M4) ([584ac71](https://github.com/BjoernSchotte/fireflies-api/commit/584ac7111b615b80820e7e97386c7bc627762da7))
* **helpers:** add extractActionItems for structured action item parsing ([f4bdd63](https://github.com/BjoernSchotte/fireflies-api/commit/f4bdd63415d155124be656845d308c25de1f5b7c))
* **helpers:** add markdown export for transcripts and realtime chunks ([a4bd004](https://github.com/BjoernSchotte/fireflies-api/commit/a4bd004ea60e07675bb1e478b4becd66975c26b4))
* **helpers:** add normalizeTranscript for provider-agnostic format ([1534429](https://github.com/BjoernSchotte/fireflies-api/commit/1534429be2838f249230951c00052ada4427f32d))
* **helpers:** add TranscriptAccumulator for realtime stream aggregation ([5aeb3bd](https://github.com/BjoernSchotte/fireflies-api/commit/5aeb3bded77fcde6567112c5ee2ece59d32d2b42))
* **insights:** add meeting insights aggregation with external filtering ([cc8b88f](https://github.com/BjoernSchotte/fireflies-api/commit/cc8b88fb024ca85c66bbb3004133f70f2a61b422))
* **middleware:** add webhook handlers for Express, Fastify, and Hono ([29faff6](https://github.com/BjoernSchotte/fireflies-api/commit/29faff64d5d63642fa65d4ac00b3271ff5edbda4))
* **rateLimit:** add rate limit tracking and adaptive throttling ([9aeea35](https://github.com/BjoernSchotte/fireflies-api/commit/9aeea35516c6d2fdd300e5a61449a2b7400b6ca0))
* **realtime:** add live transcription streaming via Socket.IO ([67a296b](https://github.com/BjoernSchotte/fireflies-api/commit/67a296b5c1a598855fa3aa620b6442a7653cb4e1))
* **schemas:** add Zod schemas for raw Transcript and helper types ([786a58b](https://github.com/BjoernSchotte/fireflies-api/commit/786a58b613a116cf09c401fa45794ce36467e680))
* **search:** add transcript search with sentence-level matching ([457e3ba](https://github.com/BjoernSchotte/fireflies-api/commit/457e3ba1da88d37ecd8396160e5cb3b2606ba9de))
* **transcripts:** add TranscriptGetParams to optimize get() calls ([9c2387c](https://github.com/BjoernSchotte/fireflies-api/commit/9c2387c08c7ca1958446fa05d0f9f998eb923903))
* **webhooks:** add webhook parsing and signature verification ([ec28471](https://github.com/BjoernSchotte/fireflies-api/commit/ec284718c6c3db133f8aa98072ec39856c0438ed))


### Bug Fixes

* **api:** correct types and queries to match real Fireflies API ([b1083bb](https://github.com/BjoernSchotte/fireflies-api/commit/b1083bb29adb3179e713d3016e3c9907fe857e2b))
* **bites:** correct GraphQL mutation field names for createBite ([5be378e](https://github.com/BjoernSchotte/fireflies-api/commit/5be378e570b503bf7501e198bd51b47983dc5324))
* **cli:** correct duration unit from API (minutes, not seconds) ([dacc3a7](https://github.com/BjoernSchotte/fireflies-api/commit/dacc3a7e84cdb5d92b0ec3072cb5801d24bc489d))
* **exports:** export domain-utils helpers from public API ([d32d6e6](https://github.com/BjoernSchotte/fireflies-api/commit/d32d6e62af27bf9c1417f7de0ba5ffa8a2f056bd))
* **graphql:** add missing analytics and extended_sections fields ([63284ee](https://github.com/BjoernSchotte/fireflies-api/commit/63284ee6df7e45c82f78c05089131ce16b321e95))
* **graphql:** add missing user.plan and channels.members fields ([0625f9d](https://github.com/BjoernSchotte/fireflies-api/commit/0625f9d6ba77f703952d3bdaa46199e570c8ebcc))
* **helpers:** add video_url to list fields and fix retryAfter unit ([588163f](https://github.com/BjoernSchotte/fireflies-api/commit/588163f61c75ffaa5eed1b3a406987cf895e7ff5))
* **rateLimit:** add validation and improve test coverage ([8f2247b](https://github.com/BjoernSchotte/fireflies-api/commit/8f2247b7576f26fa82e7aff5c62b90d4d4005895))
* **test:** replace non-null assertions with safer patterns ([9734b28](https://github.com/BjoernSchotte/fireflies-api/commit/9734b28389d3801be90c43c90d2656694b74409b))


### Documentation

* add comprehensive documentation (M5) ([b734788](https://github.com/BjoernSchotte/fireflies-api/commit/b734788937bd979e91c999b1bfd04f4b156ae0a4))
* add TypeDoc API documentation generation ([b76c3a4](https://github.com/BjoernSchotte/fireflies-api/commit/b76c3a4a26729313c9d880565b9122f650ab0d5f))
* **ci:** add NPM_TOKEN setup instructions to publish workflow ([3efbcc9](https://github.com/BjoernSchotte/fireflies-api/commit/3efbcc98cf47bd9a93e7f11b90259c1d8e75d9f2))
* **claude:** add SDK-first architecture principle ([b6933ea](https://github.com/BjoernSchotte/fireflies-api/commit/b6933eaa5cc11bde353358627bc19c0b23ffb381))
* **claude:** expand CLAUDE.md with critical rules and quality gates ([cfda118](https://github.com/BjoernSchotte/fireflies-api/commit/cfda1187c95ed926bd1e141c00e1889c8dfa172d))
* **claude:** expand SDK-first architecture principle ([f16bf93](https://github.com/BjoernSchotte/fireflies-api/commit/f16bf9331a34990bb425e8aec94d161ebe56291f))
* **cli:** update --output help text with all available formats ([bb3ad93](https://github.com/BjoernSchotte/fireflies-api/commit/bb3ad939e2897026aa6f43a0a5629847888133ab))
* **examples:** add SDK usage examples for basic, realtime, and multi-user operations ([1d381f8](https://github.com/BjoernSchotte/fireflies-api/commit/1d381f857c3cb868a02c8ea9c126bff092597690))
* **guidelines:** add boy scout rule for pre-existing lint issues ([50afdc9](https://github.com/BjoernSchotte/fireflies-api/commit/50afdc9d24b5b775b5c7651b056b308711c44e96))
* **guidelines:** add TDD requirements and enhanced code style rules ([fbe40d4](https://github.com/BjoernSchotte/fireflies-api/commit/fbe40d471f13b1a78076839388e57f0e0c125af0))
* **helpers:** fix inaccurate JSDoc comments ([dd60948](https://github.com/BjoernSchotte/fireflies-api/commit/dd6094805dd6de015d5ab9cd28ec67601f01d1f1))
* **roadmap:** mark webhook middleware as complete ([00843e9](https://github.com/BjoernSchotte/fireflies-api/commit/00843e93f24911e7c15c6369a1140c4d1eb71fa2))


### Tests

* add unit tests for pagination and GraphQL client ([658ff06](https://github.com/BjoernSchotte/fireflies-api/commit/658ff068b54c1c65f845d0768ff3e0ba047a9dcc))
* **cli:** add unit tests for CLI utilities ([9fed96b](https://github.com/BjoernSchotte/fireflies-api/commit/9fed96b150643ccd1e8e063fb8f4f9a441356b09))
