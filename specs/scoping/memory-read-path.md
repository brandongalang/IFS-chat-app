# Memory v2 — Read Path (flagged helpers)

This PR adds a small set of read helpers for file-first snapshots behind the existing storage adapter:

- readOverviewSections(userId): returns a section map by anchor → { heading, text }
- readPartProfileSections(userId, partId): same shape for part profiles
- readRelationshipProfileSections(userId, relId): same shape for relationship profiles

CLI validation
```bash
# Overview
IFS_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000 npm run read:snapshot -- overview

# Part profile
IFS_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000 npm run read:snapshot -- part <partId>

# Relationship profile
IFS_DEFAULT_USER_ID=00000000-0000-0000-0000-000000000000 npm run read:snapshot -- relationship <relId>
```

Notes
- These helpers do not touch the agent yet; they exist to support a future, optional read-path cutover behind the same Memory v2 flag.
- They read via the StorageAdapter so local vs Supabase storage is seamless.

