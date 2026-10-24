# samaWA

A wedding invitation that arrives as a WhatsApp conversation.

**Live:** [samawa.xsrazy.web.id](https://samawa.xsrazy.web.id)

![samaWA](assets/img/og.jpg)

## About

samaWA is a digital wedding invitation built to look and behave like WhatsApp, not like a regular web page. Guests open a familiar chat list, tap the couple's chat, and the invitation itself plays out as a conversation: bubbles arrive one by one with a typing indicator, the soundtrack arrives as a voice note, attendance is confirmed through a native-style poll, and the guest book is a WhatsApp group chat guests can actually write in.

The demo content is a fictional wedding (Usra & Zee, Monday, 17 January 2050 at Jam Gadang, Bukittinggi). Every text, photo, and the whole conversation script can be replaced from the admin dashboard, no code changes needed.

## Features

- Chat list home styled after WhatsApp, with a Status row and an unread badge on the couple's chat
- The invitation plays as a one-to-one chat thread with the couple's shared account: a plain typing indicator, a WhatsApp-style incoming chat tone for every bubble, and a replay option. Sender names appear only in the reception group chat, as in any WhatsApp group
- Bubble types: personalised text (the guest's name is inserted automatically), photo, wide live countdown to the wedding date whose numbers are filled in the moment the bubble arrives, wide landscape location card with a maps link, verse, voice note, digital envelope (gift accounts with copy buttons), RSVP poll, and a group invite card
- Voice note player with the real soundtrack: play/pause, waveform progress, and 1x / 1.5x / 2x playback speed
- RSVP poll: one vote per guest name, changeable at any time, with live counts shown after voting
- Group chat guest book: guests join with their name and post congratulations; new messages appear instantly and the view refreshes itself. Once joined, the group also appears in the guest's chat list with a last-message preview and an unread badge
- Status viewer with segments, progress bars, tap zones, and a blurred backdrop, showing the couple, groom, and bride
- Couple profile page with photo, bio, date, venue, and group rows
- Guest identity comes from a personal `?to=Guest+Name` link or a one-time name prompt, stored in the browser; there is no access key to type
- All couple photography is always shown whole, never cropped, in avatars, bubbles, profile, and status
- Responsive: on phones it follows the WhatsApp for iPhone look (white headers, blue back chevron, well-rounded bubbles, grey search field, circular header buttons, and a bottom tab bar with Status, Calls, Communities, Chats, and Settings); on wide screens it switches to a WhatsApp Web layout with the chat list and the open conversation side by side
- Bubble timestamps follow the visitor's real clock, so the conversation always looks like it just happened
- Admin dashboard styled after WhatsApp Web: a summary overview with stat cards and poll bars, chat-style RSVP and guest book views with moderation, a conversation script editor (reorder, add, and remove bubbles) with a live phone preview, site settings, poll question editing, and password change

## Architecture

- **Frontend:** static HTML, CSS, and vanilla JavaScript (`index.html` for guests, `admin.html` for the dashboard). No framework, no build step.
- **Backend:** zero-dependency Node.js Vercel Functions in `api/`. State lives in a single versioned JSON document in a private Vercel Blob store; writes create a new immutable version and reads take the newest, so stale caches can never shadow fresh data.
- **Auth:** admin login issues an HS256 JWT (with token-version revocation); passwords are hashed with scrypt. Guests are identified only by the name they enter.
- **Hosting:** Vercel. The production domain redirects the default `*.vercel.app` hostname to the custom domain.

## API

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/state` | GET | Public | Settings, conversation script, poll counts, group info |
| `/api/rsvp` | POST | Guest name in body | Cast or change a poll vote (one per guest name) |
| `/api/messages` | GET | Public | Latest 80 group messages |
| `/api/messages` | POST | Guest name in body | Post a group message (max 400 characters) |
| `/api/session` | POST | Admin credentials | Log in, returns a JWT |
| `/api/admin` | GET | Bearer JWT | Votes, messages, and script for the dashboard |
| `/api/content` | PATCH | Bearer JWT | Update settings, conversation script, or poll question |
| `/api/message-delete` | DELETE | Bearer JWT | Delete one group message by id |
| `/api/password` | POST | Bearer JWT | Change the admin password |

## Environment Variables

Names only; values live in the Vercel project settings.

| Name | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs admin JWTs |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Seed admin password (used until changed from the dashboard) |
| `INITIAL_ACCESS_KEY` | Reserved for parity with the shared backend pattern; samaWA guests do not use an access key |
| `BLOB_READ_WRITE_TOKEN` | Injected by Vercel when the Blob store is connected |

## Notes

- The gift account numbers on the demo site are dummy data with working copy buttons; replace them from the dashboard before real use.
- Guest names from the `?to=` parameter are stored in `localStorage`, so a guest who voted or joined the group is recognised on their next visit.

## Credits

Designed and built by Rahmatul Usra. The layout is an original homage to WhatsApp's interface; WhatsApp is a trademark of Meta Platforms, Inc., and this project is not affiliated with or endorsed by Meta.

## License

MIT, Copyright (c) 2026 Rahmatul Usra. See [LICENSE](LICENSE).
