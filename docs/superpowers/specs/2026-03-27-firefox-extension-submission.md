# Firefox Extension Submission Prep

## Package
- Build Firefox target:
  - `npm --prefix extension run build:firefox`
- Package signed-submission artifact:
  - `npm --prefix extension run package:firefox`
- Output artifact:
  - `extension/release/send-to-grain-firefox.xpi`

## Submission Type
- Recommended first step: `Unlisted`
  - gets a signed installable package without public AMO listing pressure
- Public release later: `Listed`

## Add-on Summary
Send to Grain captures the current page, links, and images from the browser into the user’s Grain workspace.

## Description
Send to Grain helps users collect visual references and links while browsing. From the toolbar popup or right-click menu, users can send the current page, a selected link, or a selected image into Grain. Captures are queued to the user’s private Grain canvas and appear the next time Grain syncs pending items.

## Suggested AMO Listing Copy
### Short summary
Capture links, images, and pages directly into Grain.

### Full description
Send to Grain lets you save inspiration to Grain without breaking browsing flow.

Features:
- Send the current page from the toolbar popup
- Right-click any link to send it to Grain
- Right-click any image to send it to Grain
- Works with your signed-in Grain account

Captured items are sent to your private Grain canvas, where they can be organized alongside boards, images, and AI notes.

## Permissions Rationale
### `contextMenus`
Used to provide “Send to Grain” actions when right-clicking pages, links, and images.

### `tabs`
Used to read the current active tab URL/title for “Send current page”.

### `activeTab`
Used during the connect flow to read the current signed-in Grain tab.

### `scripting`
Used to read the authenticated Grain session token from the active Grain tab during the connect flow.

### `storage`
Used to store the Grain connection configuration locally in the extension.

### Site access / broad host access
Used so the extension can offer context-menu capture on arbitrary websites and send those selected URLs or image URLs to Grain.

## Data Collection / Transmission Notes
The extension sends the following data to Grain when the user explicitly triggers a capture:
- Grain authentication token from a signed-in Grain tab during connect
- current page URL and title
- selected link URL
- selected image URL

This data is transmitted only to the user’s Grain backend for capture and sync. The extension does not perform passive browsing analytics.

## Firefox Manifest Notes
Current `browser_specific_settings.gecko.data_collection_permissions.required`:
- `authenticationInfo`
- `websiteActivity`

This matches the extension’s explicit connect flow and capture behavior.

## What To Upload
- Upload `extension/release/send-to-grain-firefox.xpi` to AMO.

## Manual Submission Steps
1. Go to `https://addons.mozilla.org/developers/`
2. Sign in / create developer account
3. Choose:
   - `Submit a New Add-on`
4. Start with:
   - `Unlisted`
5. Upload:
   - `extension/release/send-to-grain-firefox.xpi`
6. Use the listing copy and permission notes above
7. Add your privacy policy URL if you publish publicly

## Follow-up Before Public Listed Release
- Replace the local gecko id if needed with your final production add-on id
- Add final public Grain domain(s) instead of local-only assumptions where applicable
- Publish a real privacy policy page on the Grain site
