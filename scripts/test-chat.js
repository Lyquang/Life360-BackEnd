/**
 * Test chat giữa 2 người dùng thực tế
 * Chạy: node scripts/test-chat.js
 *
 * Yêu cầu: server đang chạy tại http://localhost:3000
 */

const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000/api/v1';
const SERVER = 'http://localhost:3000';

// ─── Helper: gọi REST API ────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`[${res.status}] ${path}: ${JSON.stringify(json)}`);
  return json;
}

// ─── Helper: connect Socket và đợi session:ready ─────────────────────────────
function connectSocket(token, name) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER, { auth: { token } });
    socket.on('session:ready', () => {
      console.log(`🔌 ${name} connected (socket: ${socket.id})`);
      resolve(socket);
    });
    socket.on('connect_error', (err) => reject(new Error(`${name} connect error: ${err.message}`)));
    setTimeout(() => reject(new Error(`${name} session:ready timeout`)), 8000);
  });
}

// ─── Helper: emit với ack ────────────────────────────────────────────────────
function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack) => {
      if (ack?.success) resolve(ack.data);
      else reject(new Error(`${event} failed: ${JSON.stringify(ack)}`));
    });
    setTimeout(() => reject(new Error(`${event} timeout`)), 5000);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📋 BƯỚC 1 — Đăng ký / đăng nhập 2 user\n');

  // Đăng ký (bỏ qua lỗi "email đã tồn tại")
  for (const u of [
    { name: 'Alice', email: 'alice@test.com', password: 'password123' },
    { name: 'Bob',   email: 'bob@test.com',   password: 'password123' },
  ]) {
    try { await api('POST', '/auth/register', u); console.log(`✅ Registered ${u.name}`); }
    catch { console.log(`ℹ️  ${u.name} already exists`); }
  }

  const { data: { token: tokenA, user: alice } } = await api('POST', '/auth/login', { email: 'alice@test.com', password: 'password123' });
  const { data: { token: tokenB, user: bob   } } = await api('POST', '/auth/login', { email: 'bob@test.com',   password: 'password123' });
  console.log(`🔑 Alice id: ${alice.id}`);
  console.log(`🔑 Bob   id: ${bob.id}`);

  // ── Bước 2: Cùng nhóm (cần để mở DM) ───────────────────────────────────────
  console.log('\n📋 BƯỚC 2 — Tạo nhóm chung (Alice tạo, Bob join)\n');
  let inviteCode;
  try {
    const g = await api('POST', '/groups', { name: 'Test Family' }, tokenA);
    inviteCode = g.data.inviteCode;
    console.log(`✅ Group created: "${g.data.name}" | invite: ${inviteCode}`);
  } catch (e) {
    const groups = await api('GET', '/groups', null, tokenA);
    inviteCode = groups.data[0].group.inviteCode;
    console.log(`ℹ️  Using existing group | invite: ${inviteCode}`);
  }

  try {
    await api('POST', '/groups/join', { inviteCode }, tokenB);
    console.log(`✅ Bob joined the group`);
  } catch (e) {
    console.log(`ℹ️  Bob already in group`);
  }

  // ── Bước 3: Mở conversation DM ─────────────────────────────────────────────
  console.log('\n📋 BƯỚC 3 — Mở cuộc trò chuyện 1-1\n');
  const convData = await api('POST', '/conversations/direct', { userId: bob.id }, tokenA);
  const conversationId = convData.data.id;
  console.log(`✅ Conversation ID: ${conversationId}`);

  // ── Bước 4: Kết nối Socket ──────────────────────────────────────────────────
  console.log('\n📋 BƯỚC 4 — Kết nối Socket.IO\n');
  const [socketA, socketB] = await Promise.all([
    connectSocket(tokenA, 'Alice'),
    connectSocket(tokenB, 'Bob'),
  ]);

  // ── Bước 5: Bob lắng nghe tin nhắn ─────────────────────────────────────────
  console.log('\n📋 BƯỚC 5 — Test gửi tin nhắn\n');
  const received = new Promise((resolve) => {
    socketB.on('chat:new_message', (msg) => {
      console.log(`\n📩 Bob nhận được: "${msg.content}" từ ${msg.senderName}`);
      resolve(msg);
    });
  });

  // Alice gửi "Hello"
  const sent = await emit(socketA, 'chat:send_message', {
    conversationId,
    type: 'text',
    content: 'Hello Bob! 👋',
  });
  console.log(`📤 Alice gửi: "${sent.content}" (id: ${sent.id})`);

  // Chờ Bob nhận
  await received;

  // ── Bước 6: Bob reply ───────────────────────────────────────────────────────
  const received2 = new Promise((resolve) => {
    socketA.on('chat:new_message', (msg) => {
      console.log(`\n📩 Alice nhận được: "${msg.content}" từ ${msg.senderName}`);
      resolve(msg);
    });
  });

  const reply = await emit(socketB, 'chat:send_message', {
    conversationId,
    type: 'text',
    content: 'Hello Alice! 🎉',
  });
  console.log(`📤 Bob reply: "${reply.content}" (id: ${reply.id})`);
  await received2;

  // ── Bước 7: Lấy lịch sử ────────────────────────────────────────────────────
  console.log('\n📋 BƯỚC 6 — Lịch sử tin nhắn\n');
  const history = await api('GET', `/conversations/${conversationId}/messages`, null, tokenA);
  console.log(`📚 ${history.count} tin nhắn trong cuộc trò chuyện:`);
  history.data.forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.senderName}]: ${m.content}`);
  });

  console.log('\n✅ TEST HOÀN THÀNH!\n');
  socketA.disconnect();
  socketB.disconnect();
}

main().catch((err) => {
  console.error('\n❌ LỖI:', err.message);
  process.exit(1);
});
