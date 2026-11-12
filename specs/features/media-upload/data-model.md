# Tải ảnh và voice — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

There is no separate MongoDB upload-ticket model. The ticket response/public key and optional Redis media metadata are described in [contracts](contracts.md). Legacy images use `chat/<conversationId>/<userId>/<UUID>.<extension>`; generalized images/voice use `chats/<conversationId>/<userId>/<UUID>.<extension>`. Storage configuration determines the public prefix and limits. Key validation does not prove a ticket was issued or remote bytes exist. Persisted attachment/voice fields belong to [ChatMessage](../chat/data-model.md).
