# Network failure toast QA

Steps to verify toasts appear when network requests fail.

## Session start failure
1. Open developer tools and block the `/api/session/start` endpoint.
2. Attempt to send a message.
3. Toast appears with title **Session failed** and the error message.
4. Console logs `Error starting session` with details.

## Message persistence failure
1. Allow session start but block `/api/session/message`.
2. Send a message so the app attempts to persist it.
3. Toast appears with title **Persist failed** and the error message.
4. Console logs `Error persisting message` with details.

## Stream failure
1. After starting a session, block `/api/chat` mid‑conversation.
2. Send a message to trigger streaming.
3. Toast appears with title **Stream failed** and the error message.
4. Console logs `Stream failed` with details.
