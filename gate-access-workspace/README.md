# Gate Access

A standalone gate access console. It has no IshuriHUB, school-management, attendance, or Supabase connection.

## Features

- Add and enable or disable people with an access ID or card number
- Show digital identity cards with student details and registered belongings
- Approve or deny entry, approve exits, and review who is currently inside
- Register visitors and create visitor passes
- Read visitor ID photos with in-browser OCR or enter visitor details manually
- Review gate movement by date

Data is saved in the current browser's local storage. It is not shared between browsers or devices and is not backed up to a server. Visitor OCR runs in the browser; the first scan downloads the English text recognition model.

## Run locally

1. Run `npm ci`.
2. Run `npm run dev`.
3. Open `http://localhost:3000`.

No environment file or external service account is needed.
