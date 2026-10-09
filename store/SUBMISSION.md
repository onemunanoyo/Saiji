# Store submission handoff

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run package:store`. Upload `release/Saiji-1.0.0-store.zip` (manifest is at ZIP root). `release/extension` is its unpacked equivalent. It contains no model weights, Python, environments, logs, datasets or source maps. The regular dist build can still include local model files.

Use listing-ja/en/ko.txt for translated listings. Category: Productivity (suggested). Single purpose: filter comments on YouTube and Twitch using local rules and an optional experimental Japanese classifier.

## Permission justification draft

- storage: locally store settings, NG words, muted user identifiers and filter counters.
- alarms: reset violation counters and periodically clear the blacklist.
- webNavigation: remount comment observers on site SPA navigation.
- offscreen: host one shared inference worker; close it when target tabs disappear or filtering stops.
- unlimitedStorage: persist the approximately 650 MB model cache, avoiding repeated downloads. This does not mean unlimited RAM allocation.
- YouTube/Twitch host access: read and hide comments on these sites and identify eligible tabs. No browsing-history log is kept. The broad tabs permission has been removed.
- Hugging Face / hf.co host access: fetch fixed, hash-verified model/tokenizer files and follow model delivery redirects. Comment text is never sent there.

## External resources and review notes

All JavaScript, tokenizer implementation and ONNX Runtime WASM/MJS code is inside the ZIP. No remotely hosted JS/WASM scripts are loaded. The external ONNX file contains the classification graph and weights, plus tokenizer JSON data. Do not hide this download from the reviewer or automatically claim Store approval. Explain the fixed model task, revision and hashes in src/inference/model-assets.ts. Review may require clarification of how these external model assets are treated under the MV3 remote-logic policy.

Model: https://huggingface.co/j-llm/Saiji-toxic_v2/tree/3530d6bb0492c4038f61092c7c2db0598747b424/browser
Primary guidance: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
Privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

## Before submitting in the dashboard

Publish PRIVACY.md at a publicly reachable URL controlled by the maintainer and enter that URL in the dashboard. The package also contains privacy.html. Match dashboard disclosures to local processing of comment content, user identifiers and target-tab URLs; distinguish local processing from external transmission. HF receives model download connection metadata. No analytics, advertising, sale or remote comment processing is present. Read and certify the dashboard fields yourself rather than treating a template as an automatic certification.

Add accurate screenshots (1280×800 or 640×400) and required dashboard artwork; use actual UI and do not imply other-language model support. Confirm contact/support URL, developer account details, release version, test in ordinary Chrome and on the M5 device, and submit for review. This task does not upload or publish to the Chrome Web Store.

Licenses: Saiji source MIT; downloaded model Apache-2.0; bundled dependencies have their own notices. See LICENSE.txt, THIRD_PARTY_NOTICES.txt and licenses/ in the package.

The existing GitHub repository returned 404 to anonymous requests during preparation. Do not use a private GitHub policy/support URL for the Store. Host PRIVACY.md publicly and select a publicly reachable support/contact destination before submission. The current maintainer support URL in the policy is a draft and must be confirmed/replaced if inaccessible to users.

Validation: 22 tests and typecheck passed. The production model-free package loaded in isolated headless Edge (WebGPU test flag), downloaded the model from HF, classified a Japanese comment, and released its offscreen host after the last target tab closed. Native English UI and Japanese/Korean message fixtures rendered their notices. Screenshots are in release/screenshot-*-1280x800.png. Browser review evidence is logs/store-browser-receipt.json (not shipped). Ordinary Chrome and M5 acceptance should be checked before submitting. The maintainer will manually handle public policy hosting and dashboard contact fields.
