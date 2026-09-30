/**
 * seed-fake-user.js
 * ─────────────────────────────────────────────────────────────
 * Tạo một user giả "Quang (Bot)" luôn online tại Hà Nội.
 * User này sẽ được thêm vào group của bạn (qua invite code).
 *
 * Cách dùng:
 *   node seed-fake-user.js
 *
 * Sau khi chạy, script in ra:
 *   - Email / Password để login nếu cần
 *   - Invite code để join group (hoặc tự tạo group mới)
 *   - Hướng dẫn thêm bot vào group của bạn
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Group = require('./models/Group');

// ─── Địa điểm Hà Nội (Hồ Hoàn Kiếm) ────────────────────────
const HANOI_LOCATION = {
  latitude: 21.0285,
  longitude: 105.8542,
  name: 'Hồ Hoàn Kiếm, Hà Nội',
};

// ─── Thông tin user giả ──────────────────────────────────────
const FAKE_USER = {
  name: 'Quang (Bot)',
  email: 'quang.bot@familytracker.test',
  password: 'bot123456',
};

async function seed() {
  // 1. Kết nối DB
  console.log('📦 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/location-sharing-app');
  console.log('✅ MongoDB connected\n');

  // 2. Tạo hoặc tìm user giả
  let botUser = await User.findOne({ email: FAKE_USER.email });

  if (botUser) {
    console.log(`ℹ️  Bot user đã tồn tại: ${botUser.name} (${botUser._id})`);
  } else {
    botUser = new User({
      name: FAKE_USER.name,
      email: FAKE_USER.email,
      password: FAKE_USER.password,
      batteryLevel: 85,
      isOnline: true,
      lastSeenAt: new Date(),
      lastKnownLocation: {
        type: 'Point',
        coordinates: [HANOI_LOCATION.longitude, HANOI_LOCATION.latitude],
        updatedAt: new Date(),
        durationMinutes: 30, // Giả sử đã ở đây 30 phút
      },
    });
    await botUser.save();
    console.log(`✅ Bot user tạo thành công: ${botUser.name} (${botUser._id})`);
  }

  // 3. Cập nhật trạng thái luôn online + vị trí Hà Nội
  await User.findByIdAndUpdate(botUser._id, {
    isOnline: true,
    lastSeenAt: new Date(),
    'lastKnownLocation.coordinates': [HANOI_LOCATION.longitude, HANOI_LOCATION.latitude],
    'lastKnownLocation.updatedAt': new Date(),
    'lastKnownLocation.durationMinutes': 30,
    batteryLevel: 85,
  });
  console.log(`📍 Vị trí: ${HANOI_LOCATION.name} (${HANOI_LOCATION.latitude}, ${HANOI_LOCATION.longitude})`);

  // 4. Liệt kê các group hiện có để user có thể chọn add bot vào
  const allGroups = await Group.find({}).populate('admin', 'name email');
  console.log(`\n📋 Các group đang có trong DB: ${allGroups.length}`);

  if (allGroups.length === 0) {
    // Không có group → tạo group mới với bot là admin
    const newGroup = await Group.create({
      name: 'Test Group (Hà Nội)',
      admin: botUser._id,
      members: [botUser._id],
      notificationIntervalMinutes: 1, // 1 phút để test nhanh
    });
    console.log(`\n🆕 Đã tạo group mới: "${newGroup.name}"`);
    console.log(`   Invite Code: ${newGroup.inviteCode}`);
    console.log(`   ✅ Bot đã được thêm vào group này`);
    console.log(`\n👉 Dùng invite code "${newGroup.inviteCode}" để join group này từ app`);
  } else {
    for (const group of allGroups) {
      const isMember = group.members.some((m) => m.toString() === botUser._id.toString());
      if (!isMember) {
        // Thêm bot vào group này
        await Group.findByIdAndUpdate(group._id, {
          $push: { members: botUser._id },
          notificationIntervalMinutes: group.notificationIntervalMinutes || 1,
        });
        console.log(`   ✅ Bot added to: "${group.name}" (invite: ${group.inviteCode})`);
      } else {
        console.log(`   ℹ️  Bot đã có trong: "${group.name}"`);
      }
    }

    // Set interval = 1 phút cho tất cả group để test nhanh
    await Group.updateMany(
      { _id: { $in: allGroups.map((g) => g._id) } },
      { notificationIntervalMinutes: 1 }
    );
    console.log('\n⚡ Đã set tất cả group về 1 phút để test nhanh');
  }

  // 5. In summary
  console.log('\n' + '═'.repeat(55));
  console.log('🤖 BOT USER SUMMARY');
  console.log('═'.repeat(55));
  console.log(`  Name     : ${FAKE_USER.name}`);
  console.log(`  Email    : ${FAKE_USER.email}`);
  console.log(`  Password : ${FAKE_USER.password}`);
  console.log(`  Location : ${HANOI_LOCATION.name}`);
  console.log(`  Status   : 🟢 Online`);
  console.log(`  Duration : 30 phút tại địa điểm này`);
  console.log('═'.repeat(55));
  console.log('\n✅ Done! Khởi động lại Backend (npm run dev) để digest scheduler chạy.');
  console.log('   Sau ~1 phút, nhóm sẽ nhận được digest đầu tiên.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
