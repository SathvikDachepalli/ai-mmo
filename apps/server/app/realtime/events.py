"""Socket.IO wire event names sent to clients."""

# Presence / lifecycle
ROOM_JOINED = "room_joined"
MEMBER_JOINED = "member_joined"
MEMBER_LEFT = "member_left"
PRESENCE_UPDATE = "presence_update"
PLAYER_TYPING = "player_typing"

# Messaging
CHAT_MESSAGE = "chat_message"

# AI streaming (chat-room assistant, not narration)
AI_STREAM_START = "ai_stream_start"
AI_STREAM_CHUNK = "ai_stream_chunk"
AI_STREAM_END = "ai_stream_end"
AI_EMOTION = "ai_emotion"

# Room lifecycle
ROOM_CLOSED = "room_closed"
ROOM_SETTINGS_UPDATED = "room_settings_updated"

# Out-of-band
ERROR = "error"
