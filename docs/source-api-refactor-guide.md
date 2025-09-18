# Source API Refactor Guide

This document summarizes the Source API (https://docs.da.live/developers/api/source) and maps it to the responsibilities implemented in `src/document-store.js`. Use it to plan the migration from the current `/documents` service to the Source API.

## Current DocumentStore Surface

`DocumentStore` encapsulates all content CRUD, folder operations, sharing, versioning, publishing, and link graph features for the editor experience (see `src/document-store.js`). Today it calls a JSON REST service mounted under `/documents` and expects URN-based identifiers plus structured responses that bundle HTML, metadata, comments, and sharing ACLs.

## Source API Overview

- **Purpose**: Manage raw source files (folders, media, documents) within a Document Authoring project.
- **Base host**: `https://admin.da.live`.
- **Base path**: `/source/{org}/{site}/{branch-or-root}/{...path}[.extension]`.
- **Audience**: Requires an authenticated Document Authoring IMS user.
- **Use cases**: Direct upload or download of source assets; retrieving environment-specific URLs (preview/live/edit/code).

## Authentication and Headers

- The API expects an **Authorization** header with an IMS JWT bearer token (`Authorization: Bearer {IMS_TOKEN}`), per the headers fragment referenced in the docs.
- Other headers (Content-Type, Accept) are controlled by the HTTP method you call (see below). The service accepts standard browser user agents; no additional custom headers are documented.

`DocumentStore.getAccessToken()` already retrieves IMS tokens (either via `adobeid.authorize()` or `adobeIMS.getAccessToken()`), so the same helper can be reused when calling Source endpoints.

## Path Construction

The path fragment (`https://main--docket--da-pilot.aem.page/fragments/api/path`) defines four components:

1. `org` (required): Project organization/tenant (e.g., `geometrixx`).
2. `site` (required): Site or repository slug (e.g., `outdoors`).
3. `path` (required): The folder path to the asset (e.g., `drafts/cmillar/hello-world`). Sub-folders are represented by slashes.
4. `extension` (optional): File extension (e.g., `.html`, `.json`).

In the canonical examples, the branch/environment (`drafts`) is expressed as part of the `path` segment. Confirm whether the deployment uses fixed branch names (such as `main`, `drafts`, `live`) or allows arbitrary refs, and establish how existing URNs in `DocumentStore` translate to Source paths.

In this proof-of-concept we treat each document URN as a technical, human-readable name. The DocumentStore slugifies that URN into a file-safe path before issuing Source API requests, so avoid characters that would be stripped by that transformation.

The current implementation persists each document as plain HTML without supplemental metadata; features such as comments, references, or structured JSON payloads are intentionally ignored for this spike.

## Operations

### GET `/source/{org}/{site}/{path}`

- **Request**: Standard `GET` with the authorization header. Example from the docs:

  ```bash
  curl -X GET \
    'https://admin.da.live/source/geometrixx/outdoors/drafts/cmillar/hello-world.html' \
    --header 'Authorization: Bearer {IMS_TOKEN}'
  ```

- **Response**: JSON metadata describing multiple environments. Representative payload:

  ```json
  {
    "webPath": "/en/2021/blog",
    "resourcePath": "/en/2021/blog.md",
    "live": {
      "status": 200,
      "url": "https://main--site--org.aem.live/en/2021/blog",
      "lastModified": "2021-05-29T22:00:00Z",
      "lastModifiedBy": "someone@example.com",
      "contentBusId": "helix-content-bu/.../live/en/2021/blog.md",
      "permissions": ["read"]
    },
    "preview": {
      "status": 200,
      "url": "https://main--site--org.aem.page/en/2021/blog",
      "lastModified": "2021-05-31T23:00:00Z",
      "lastModifiedBy": "anonymous",
      "contentBusId": "helix-content-bu/.../preview/en/2021/blog.md",
      "permissions": ["read", "write"]
    },
    "edit": {
      "status": 200,
      "url": "https://adobe.sharepoint.com/",
      "sourceLocation": "onedrive:/...",
      "lastModified": "2021-05-29T21:00:00Z"
    },
    "code": {
      "status": 404,
      "codeBusId": "helix-code-bus/...",
      "permissions": ["read"]
    },
    "links": {
      "status": "https://admin.hlx.page/status/...",
      "preview": "https://admin.hlx.page/preview/...",
      "live": "https://admin.hlx.page/live/...",
      "code": "https://admin.hlx.page/code/..."
    }
  }
  ```

- **Content retrieval**: The response does **not** embed the file contents. To render or edit the asset you typically fetch the `preview.url` (for HTML), the `resourcePath` (for raw markdown), or the `edit.sourceLocation` (SharePoint/OneDrive pointer). Decide which representation the editor needs.

- **Status codes**: 200 on success; other examples include 201 (created), 400 (bad request), 500 (server error).

### POST `/source/{org}/{site}/{path}`

- **Request**: Multipart form-data upload with a `data` part that contains the file payload. Example from the docs:

  ```bash
  curl -X POST \
    'https://admin.da.live/source/geometrixx/outdoors/drafts/cmillar/test.json' \
    --header 'Authorization: Bearer {IMS_TOKEN}' \
    --form 'data=@/local/path/my-file.json'
  ```

- **Behavior**: Creates or overwrites the asset at the target path. The docs do not differentiate between “create” and “update”; treat POST as an upsert operation.

- **Response**: Reuses the metadata structure shown above (webPath, resourcePath, live/preview/edit/code, links) with the new state reflected. Expect HTTP 201 for new files and 200 for updates.

- **Payload format**: Ensure the editor provides the exact bytes (`text/html`, `application/json`, etc.) that Source should persist. For multipart uploads, set the individual part’s `Content-Type` if necessary.

### Undocumented Operations

The public page only documents GET and POST. There is no published contract for `PUT`, `PATCH`, `DELETE`, listings, sharing, or versioning. If additional endpoints exist (for example to list folder contents or delete files) they are not covered by the available documentation and need to be confirmed with the Source API team.

## Mapping DocumentStore Responsibilities to Source API

| Responsibility (DocumentStore) | Current `/documents` usage | Source API status | Notes |
| --- | --- | --- | --- |
| Fetch single document (`getDocument`, `deserializeElement`) | `GET /documents/{urn}` returns HTML + metadata | **Partial**: `GET /source/...` returns metadata, not inline HTML | Must decide whether to follow `preview.url`, `resourcePath`, or another endpoint to retrieve actual content. URN → path translation required. |
| Create/update document (`saveDocument`) | `POST /documents` with JSON payload including `html`, `json`, comments, references | **Requires redesign** | Source POST accepts a single file upload; no support for embedded JSON metadata or references. Consider storing structured metadata in companion files or separate services. |
| Folder CRUD (`createFolder`, `updateFolderName`, `updateDocumentParent`, `copyDocuments`, `moveDocuments`) | `/documents` endpoints with `is_folder`, `parent_urn` fields | **Unknown** | Source docs do not describe folder APIs. Need confirmation whether folders are implicit (via path prefixes) or require separate calls. |
| Listings (`getDocuments`, `getRecentDocuments`, `getAllDocuments`, `loadAllElementsInto`) | `GET /documents?order=&parent=` returns typed objects | **Unknown** | No list endpoint is documented. May need to enumerate via a different API or maintain a manifest. |
| Sharing (`getShares`, `upsertShare`, `deleteShare`) | `/documents/{urn}/shares` endpoints | **Not covered** | No sharing endpoints exist in Source docs; requires alternative access-control strategy. |
| Versioning (`getVersions`, `createVersion`, `restoreVersion`, `renameVersion`) | `/documents/{urn}/versions` suite | **Not covered** | Source API does not mention version management. Rely on repository history or introduce a new service. |
| Publishing (`publishDocument`, `unpublishDocument`) | `/documents/{urn}/publish` and `/unpublish` | **Potentially indirect** | Source metadata exposes `live`/`preview` URLs but no explicit publish triggers. Need to clarify publish workflow in Source. |
| Link graph (`getDocumentLinks`, `getDocumentReferrers`) | `/documents/{urn}/links` and `/referrers` | **Not covered** | Requires replacement service if link intelligence is still needed. |
| Reference extraction (`#extractReferencesMap`) | Local HTML parsing + `/documents` references field | **Local only** | Source POST upload would need manual side-channel to persist references if still required. |
| Comments (`saveDocument` payload, `doc.comments`) | Stored in `/documents` JSON | **Not covered** | Source API does not expose per-document comments. Decide whether to drop, migrate, or store elsewhere. |

## Refactor Considerations

1. **Identifier strategy**: Current code assumes URNs (`urn:eeid:...`). Define a reversible mapping between URNs and Source paths, or migrate the application to path-based identifiers end-to-end.
2. **Data model split**: Source persists raw files only. Determine where to keep structured metadata (name, comments, references, folder flags). Options include sidecar JSON files, a separate metadata service, or embedding structured front matter.
3. **Folder semantics**: If folders are purely hierarchical paths, reimplement folder creation by writing placeholder marker files or relying on client-side structure. Validate with API owners.
4. **Listings and search**: Without a documented list endpoint, the UI may need to index assets through another service (GraphQL? Search API?). Clarify before ripping out existing `/documents` queries.
5. **Publishing workflow**: Understand how Source changes propagate to preview/live. If publication is automatic, adjust UI flows; if not, identify the replacement API.
6. **Error handling**: Replace the existing JSON error parsing with logic that handles HTTP 4xx/5xx from Source and surfaces actionable messages in the UI.
7. **Testing strategy**: Integration tests should exercise GET and POST against a staging Source project, verifying metadata fields and file content visibility via preview URLs.

## Open Questions for the Source API Team

- Is there an official spec for listing, deleting, or moving assets, or is Source intentionally file-only?
- How should clients discover folders and child items without a list endpoint?
- What is the recommended approach for version history and restoration?
- Are there hooks for sharing/permissions beyond IMS authentication?
- Does a successful POST automatically trigger preview/live updates, or is an explicit publish step required?
- Are there rate limits or size limits for uploads we need to enforce client-side?

Answering these questions will determine how much of `DocumentStore` can be replaced by direct Source API calls versus auxiliary services.
