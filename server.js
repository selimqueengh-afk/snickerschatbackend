const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Snickers Chat Backend API', 
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Send push notification
app.post('/api/send-notification', async (req, res) => {
  try {
    const { 
      receiverId, 
      senderId, 
      senderName, 
      message, 
      chatRoomId 
    } = req.body;

    if (!receiverId || !senderId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: receiverId, senderId, message' 
      });
    }

    // Get receiver's FCM token from RTDB (not Firestore)
    const rtdb = admin.database();
    console.log('DEBUG: Looking for FCM token in RTDB for user:', receiverId);
    const fcmTokenSnapshot = await rtdb.ref(`fcm_tokens/${receiverId}`).once('value');
    
    console.log('DEBUG: FCM token snapshot exists:', fcmTokenSnapshot.exists());
    
    if (!fcmTokenSnapshot.exists()) {
      console.log('No FCM token found in RTDB for user:', receiverId);
      return res.status(404).json({ error: 'FCM token not found' });
    }
    
    const fcmToken = fcmTokenSnapshot.val();
    console.log('DEBUG: FCM token found:', fcmToken ? 'YES' : 'NO');
    
    if (!fcmToken) {
      console.log('FCM token is null for user:', receiverId);
      return res.status(400).json({ error: 'FCM token is null' });
    }

    // Prepare notification message
    const notificationMessage = {
      notification: {
        title: senderName || 'Yeni Mesaj',
        body: message.length > 50 ? message.substring(0, 50) + '...' : message
      },
      data: {
        chatRoomId: chatRoomId || '',
        senderId: senderId,
        message: message,
        timestamp: new Date().toISOString()
      },
      token: fcmToken,
      android: {
        priority: 'high',
        notification: {
          channelId: 'snickers_chat_channel',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      }
    };

    console.log('DEBUG: Sending notification to FCM token:', fcmToken.substring(0, 20) + '...');

    // Send notification
    const response = await admin.messaging().send(notificationMessage);

    console.log('Notification sent successfully:', response);
    
    res.json({ 
      success: true, 
      messageId: response,
      message: 'Notification sent successfully' 
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ 
      error: 'Failed to send notification',
      details: error.message 
    });
  }
});

// Get user's FCM token endpoint
app.get('/api/user/:userId/token', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fcmToken = userDoc.data().fcmToken;
    
    res.json({ 
      userId, 
      fcmToken: fcmToken || null 
    });

  } catch (error) {
    console.error('Error getting user token:', error);
    res.status(500).json({ 
      error: 'Failed to get user token',
      details: error.message 
    });
  }
});

// Update user's FCM token endpoint
app.post('/api/user/:userId/token', async (req, res) => {
  try {
    const { userId } = req.params;
    const { fcmToken } = req.body;

  if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' });
    }

    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
      fcmToken: fcmToken,
      lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ 
      success: true, 
      message: 'FCM token updated successfully' 
    });

  } catch (error) {
    console.error('Error updating user token:', error);
    res.status(500).json({ 
      error: 'Failed to update user token',
      details: error.message 
    });
  }
});

// Check for app updates
app.get('/api/app/version', (req, res) => {
    try {
        // Current app version from package.json
        const currentVersion = "1.0.0";
        
        // Latest version info (you'll update this when releasing new versions)
        const latestVersion = {
            version: "1.0.2",
            versionCode: 3,
            downloadUrl: "https://github.com/selimqueengh-afk/SnickersChatv4/releases/download/snickerschat1/app-debug.apk",
            releaseNotes: [
                "🖕 Siksik eklendi OHOHooho",
                "🖕 Şaka maka bildirim geliyor artık",
                "🖕 Sorgulama işte yükleamina",
                "🖕 YARRRRRRRRRAK",
                "🖕 SNİCKERSCHAT",
                "🖕 ZenciMEEEEEEN"
            ],
            isForceUpdate: false,
            minVersion: "1.0.0"
        };
        
        res.json({
            success: true,
            currentVersion: currentVersion,
            latestVersion: latestVersion
        });
        
    } catch (error) {
        console.error('Error checking app version:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check app version',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Snickers Chat Backend running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/`);
  console.log(`🔔 Send notification: POST http://localhost:${PORT}/api/send-notification`);
});
