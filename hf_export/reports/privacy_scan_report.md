# Meaninglib privacy scan report

Generated: 2026-07-22T03:56:22.330Z

Failures: 0
Warnings: 5

## Failures

- None

## Warnings

- hf_export/data/cc/campaigncodex.jsonl: North American phone-like string pattern found (200)
- hf_export/data/mc/modulecanon.jsonl: North American phone-like string pattern found (26)
- hf_export/data/ml/sections/citation.jsonl: North American phone-like string pattern found (42)
- hf_export/data/ml/sections/idiomary.jsonl: North American phone-like string pattern found (2)
- hf_export/data/ml/sections/methodology.jsonl: North American phone-like string pattern found (6)

## Scan notes

- Email addresses are upload-blocking failures.
- Hugging Face tokens, OpenAI keys, GitHub tokens, AWS keys, and explicit token assignments are upload-blocking failures.
- Phone-like warnings are conservative and commonly catch ISBNs, DOIs, archive IDs, and library/catalogue numbers.
- source_hash checksum values are ignored during pattern scanning because they can resemble phone numbers.