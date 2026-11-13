# Saved places — model ownership, 2026-11-13

Implemented backend slice. [Contract](contracts.md); schema declarations are not
proof of production-index rollout. Models init during normal DB startup.

## FavoritePlace — favoriteplaces

Required groupId/name/category/location/addedBy unchanged. category:
restaurant/entertainment/cafe/shopping/other. GeoJSON Point [longitude,latitude],
coordinates bounded lon [-180,180], lat [-90,90]. New revision Number min0/default0;
JSON treats legacy missing field as zero. Atomic expected-revision update increments
it. timestamps and id/flattened latitude/longitude transform retained. No shared
purpose field, provider detail persistence, radius or presence projection added.
Indexes: groupId ascending and location 2dsphere, unchanged.

## MemberPlaceLabel — memberplacelabels

Required groupId,userId,placeId ObjectId references; label home/work/leisure/custom;
customLabel nullable trimmed String max50, API requires nonempty text iff custom.
Timestamps; JSON id replaces _id, no __v. Unique `(groupId,userId,label)`; secondary
`(groupId,placeId)` supports cascades. One key per user/Circle, replacement is
last-write-wins. All read/write access requires current membership; retention across
leave permits rejoin recovery, without granting access while departed. Deleting
shared place removes all associated labels in same transaction. No TTL/visit history.

## Group collaboration guard

Group.placeGuardVersion is a hidden optional Number incremented on new place/label
mutations inside a real transaction. Group removal/membership writes conflict on
the same Group document. Not a client revision, membership cache or distributed GPS
lock. Layer wiring uses existing placeRepo/unitOfWork, no new container dependency.


## PlacePresence — placepresences (revision B)

Unique `(groupId,userId)` current projection, not a visit history. Required
sourceFixAt/expiresAt, privacyVersion/membershipVersion; privacyUpdatedAt nullable;
placeId/placeRevision/labelId/labelUpdatedAt/candidateSince nullable; confirmed false
default; timestamps. No raw coordinates. TTL on expiresAt with expireAfterSeconds0
cleans storage; authorization/freshness always checked on read, without relying on
TTL timing. History/notification retention rules are separate.

Hidden User.placePrivacyVersion increments atomically with every locationSharing
update; Group.placeMembershipVersion and placeMembershipUpdatedAt increment/set
on join/remove. Legacy missing versions normalize to0. Group.placeGuardVersion
writes no longer change Group.updatedAt; it remains a hidden transaction guard.
MemberPlaceLabel adds `(userId,groupId)` index for finding projection groups.
Snapshot binds current label identity/place ID/revision/timestamps to projection;
state resets on epoch changes and ignores old/equal source timestamps.
