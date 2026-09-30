Act as a Senior Backend Engineer specializing in Node.js. I want to build a backend for a real-time location-sharing mobile application similar to Life360, integrated with social group features.

1. Required Tech Stack:
Node.js & Express.js (RESTful APIs).
MongoDB & Mongoose (Data storage, utilizing GeoJSON for geolocation data).
Socket.io (Real-time communication and Group/Room management).
JWT (JSON Web Token) for Authentication.
Bcrypt for password hashing.
2. Database Models:
User: name, email, password (hashed), avatar, batteryLevel (Number, %), isOnline (Boolean).
Group: name, inviteCode (6-digit string to join), members (Array of User ObjectIds), admin (User ObjectId).
LocationHistory: userId, location (GeoJSON Point), timestamp.
FavoritePlace: To store the group's favorite hangouts/restaurants. Includes groupId, name, category (e.g., restaurant, entertainment), location (GeoJSON Point), addedBy (User ObjectId).
3. RESTful API Endpoints:
Auth: Register, Login (returns JWT token).
Group: Create a group, Join a group via inviteCode, Get the list of members in a specific group.
Places: Add a new favorite place to a group, Get the list of favorite places for a group.
History: Get a specific user's location history for the current day.
4. Real-time Features (Socket.io):
Require JWT authentication upon socket connection.
join_group_room: When a user connects, automatically join them to the Socket.io Rooms corresponding to the Groups they belong to.
update_location: Client emits { latitude, longitude, batteryLevel }. The server must: 1) Update the user's batteryLevel. 2) Save the coordinates to the LocationHistory collection (implement a throttling/debouncing logic to optimize DB writes, e.g., only save if the distance has changed significantly or after a specific time interval). 3) Immediately broadcast the new location to all other members in the same Room.
sos_alert: When a user triggers an emergency, broadcast a real-time SOS alert to all members in their groups.
disconnect: Handle offline status (update user's isOnline = false).
5. Output Requirements:
Please apply Clean Code principles and modular architecture (e.g., controllers/, models/, routes/, sockets/, server.js).
Please provide:
The complete directory structure.
The package.json file with all required dependencies.
The detailed, production-ready code for the core files (Models, Socket.io event handler, and the main server entry point).
Brief instructions on how to run the server and test the real-time Socket.io flow.

run mongoDB: mongod --config /opt/homebrew/etc/mongod.conf
