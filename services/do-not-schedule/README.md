# Do Not Schedule lookup (Retell custom function)

A small standalone Express service that Retell calls as a **custom function**
during a live phone call. It answers a single yes/no question: *is this caller
on our Do Not Schedule list?*

## Endpoint

```
POST /check-do-not-schedule
```

### Request (sent by Retell)

- Header `X-Retell-Signature` — verified against `RETELL_API_KEY`.
- Header `Content-Type: application/json`.
- Body:

```json
{
  "name": "check_do_not_schedule",
  "call": { "...": "Retell call object (ignored)" },
  "args": {
    "first_name": "Jane",
    "last_name": "Smith",
    "date_of_birth": "1990-04-25"
  }
}
```

`date_of_birth` is spoken aloud, so it may arrive as `04/25/1990`,
`April 25 1990`, `1990-04-25`, etc. It is normalized to `YYYY-MM-DD` before
comparison, and may be missing.

### Response

Always HTTP 200 (on a valid, well-formed request):

```json
{ "on_do_not_schedule_list": true }
```

Retell stringifies this body and feeds it back to the LLM.

## Matching rules

- Case-insensitive; ignores extra whitespace, punctuation, and middle
  initials/names (e.g. `Earl R. Knight` matches `Earl Knight`).
- A caller is on the list only if **first + last name AND date of birth** match
  an entry — except for entries with no DOB on file (`Jocelyn Nichols`,
  `Linda Smart`), which match on **name alone**.
- `Theresa Compean/Castillo` matches either surname with that DOB.

## Behavior notes

- **Fail open:** a malformed body or missing `first_name`/`last_name` returns
  `{ "on_do_not_schedule_list": false }` (with a warning logged) so that a bad
  request never blocks scheduling.
- **Invalid signature** → HTTP 401.
- **No PII in logs:** only the boolean outcome is logged, never names or DOBs.
- Retell retries failed requests up to 2 times; default timeout is 2 minutes.

## Configuration

| Variable         | Required | Description                                            |
| ---------------- | -------- | ------------------------------------------------------ |
| `RETELL_API_KEY` | yes      | Used to verify the `X-Retell-Signature` header.        |
| `PORT`           | no       | Port to listen on (defaults to `3000`).                |

See `.env.example`.

## Running

```bash
npm install
npm run dev      # watch mode (tsx)

# or for production
npm run build
npm start
```

> **Sensitive data:** `src/do-not-schedule-list.ts` contains patient PII. Handle
> it accordingly — do not copy it elsewhere or log its contents.
