import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEYS = {
  alarmEnabled: 'mmi_alarm_enabled',
  alarmTime: 'mmi_alarm_time',
  customPrayer: 'mmi_custom_prayer',
  voiceProfile: 'mmi_voice_profile',
};

const DEFAULT_PRAYER =
  'Lord, thank You for this new morning. Fill me with Your peace, strengthen me for this day, and let Your presence guide every step I take. In Jesus’ name, Amen.';

const VERSES = [
  {
    reference: 'Psalm 23:1-3',
    text: 'The Lord is my shepherd; I shall not want. He makes me to lie down in green pastures; He leads me beside the still waters. He restores my soul; He leads me in the paths of righteousness for His name’s sake.',
  },
  {
    reference: 'Isaiah 41:10',
    text: 'Fear not, for I am with you; be not dismayed, for I am your God. I will strengthen you, yes, I will help you, I will uphold you with My righteous right hand.',
  },
  {
    reference: 'Lamentations 3:22-23',
    text: 'Through the Lord’s mercies we are not consumed, because His compassions fail not. They are new every morning; great is Your faithfulness.',
  },
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through Christ who strengthens me.',
  },
  {
    reference: 'Joshua 1:9',
    text: 'Be strong and of good courage; do not be afraid, nor be dismayed, for the Lord your God is with you wherever you go.',
  },
  {
    reference: 'Romans 15:13',
    text: 'Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope by the power of the Holy Spirit.',
  },
  {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the Lord with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He shall direct your paths.',
  },
  {
    reference: '2 Timothy 1:7',
    text: 'For God has not given us a spirit of fear, but of power and of love and of a sound mind.',
  },
  {
    reference: 'Psalm 46:10',
    text: 'Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth!',
  },
  {
    reference: 'Psalm 91:1-2',
    text: 'He who dwells in the secret place of the Most High shall abide under the shadow of the Almighty. I will say of the Lord, He is my refuge and my fortress; my God, in Him I will trust.',
  },
];

const VOICE_PROFILES = [
  { label: 'Gentle', rate: 0.8, pitch: 1.0 },
  { label: 'Warm', rate: 0.9, pitch: 1.05 },
  { label: 'Strong', rate: 1.0, pitch: 1.1 },
  { label: 'Calm', rate: 0.75, pitch: 0.95 },
];

function getDailyVerse() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) /
      86400000,
  );
  return VERSES[dayOfYear % VERSES.length];
}

function formatClock(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export default function App() {
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmTime, setAlarmTime] = useState(new Date(2025, 0, 1, 6, 30));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dailyVerse, setDailyVerse] = useState(getDailyVerse());
  const [customPrayer, setCustomPrayer] = useState(DEFAULT_PRAYER);
  const [voiceProfileIndex, setVoiceProfileIndex] = useState(0);
  const [status, setStatus] = useState('Preparing your morning scripture and prayer...');
  const [isReady, setIsReady] = useState(false);

  const voiceProfile = useMemo(() => VOICE_PROFILES[voiceProfileIndex], [voiceProfileIndex]);

  useEffect(() => {
    loadSavedSettings();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    saveSettings();
    scheduleAlarm();
  }, [alarmEnabled, alarmTime, customPrayer, voiceProfileIndex, isReady]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      setStatus('A fresh word of God is here for you this morning.');
      speakVerse();
    });

    return () => subscription.remove();
  }, [dailyVerse, voiceProfile]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      setStatus('Morning grace is active. Receive the Word and prayer.');
      speakVerse();
    });

    return () => subscription.remove();
  }, [dailyVerse, voiceProfile]);

  async function loadSavedSettings() {
    try {
      const savedTime = await AsyncStorage.getItem(STORAGE_KEYS.alarmTime);
      const savedEnabled = await AsyncStorage.getItem(STORAGE_KEYS.alarmEnabled);
      const savedPrayer = await AsyncStorage.getItem(STORAGE_KEYS.customPrayer);
      const savedVoiceProfile = await AsyncStorage.getItem(STORAGE_KEYS.voiceProfile);

      if (savedTime) {
        const parsed = new Date(savedTime);
        if (!Number.isNaN(parsed.getTime())) {
          setAlarmTime(parsed);
        }
      }

      if (savedEnabled !== null) {
        setAlarmEnabled(savedEnabled === 'true');
      }

      if (savedPrayer) {
        setCustomPrayer(savedPrayer);
      }

      if (savedVoiceProfile) {
        const index = Number(savedVoiceProfile);
        if (!Number.isNaN(index) && index >= 0 && index < VOICE_PROFILES.length) {
          setVoiceProfileIndex(index);
        }
      }

      const { status: notificationStatus } = await Notifications.getPermissionsAsync();
      if (notificationStatus !== 'granted') {
        const permissionResult = await Notifications.requestPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          setStatus('Notification permission is needed for the wake-up alarm.');
        }
      }
    } catch (error) {
      console.warn('Could not load saved settings:', error);
    } finally {
      setIsReady(true);
    }
  }

  async function saveSettings() {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.alarmEnabled, String(alarmEnabled)],
        [STORAGE_KEYS.alarmTime, alarmTime.toISOString()],
        [STORAGE_KEYS.customPrayer, customPrayer],
        [STORAGE_KEYS.voiceProfile, String(voiceProfileIndex)],
      ]);
    } catch (error) {
      console.warn('Could not save settings:', error);
    }
  }

  async function scheduleAlarm() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (!alarmEnabled) {
        setStatus('Wake-up alarm is turned off.');
        return;
      }

      const trigger = {
        hour: alarmTime.getHours(),
        minute: alarmTime.getMinutes(),
        second: 0,
        repeats: true,
      };

      const message = `${dailyVerse.reference} — ${dailyVerse.text}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Mizpah Miracle Church',
          body: message,
          sound: 'default',
        },
        trigger,
      });

      setStatus(`Wake-up alarm is set for ${formatClock(alarmTime)}.`);
    } catch (error) {
      console.warn('Notification scheduling failed:', error);
      setStatus('Your device may need notification permission for the wake-up alarm.');
    }
  }

  function speakVerse() {
    Speech.speak(`${dailyVerse.reference}. ${dailyVerse.text}`, {
      language: 'en-US',
      rate: voiceProfile.rate,
      pitch: voiceProfile.pitch,
    });
  }

  function speakPrayer() {
    Speech.speak(customPrayer, {
      language: 'en-US',
      rate: voiceProfile.rate,
      pitch: voiceProfile.pitch,
    });
    setStatus('Daily prayer is speaking to your heart.');
  }

  function handleTimeChange(_, selectedDate) {
    setShowTimePicker(false);
    if (selectedDate) {
      setAlarmTime(selectedDate);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.brand}>Mizpah Miracle Church</Text>
          <Text style={styles.title}>Bible Verse Alarm</Text>
          <Text style={styles.subtitle}>Daily hope, peace, and God’s presence.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Wake-up Time</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.timeText}>{formatClock(alarmTime)}</Text>
            <Switch
              value={alarmEnabled}
              onValueChange={setAlarmEnabled}
              trackColor={{ false: '#dfe6e9', true: '#3F7B52' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.secondaryButtonText}>Choose time</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verse of the Day</Text>
          <Text style={styles.reference}>{dailyVerse.reference}</Text>
          <Text style={styles.verseText}>{dailyVerse.text}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={speakVerse}>
            <Text style={styles.primaryButtonText}>Hear the verse</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Prayer</Text>
          <TextInput
            style={styles.prayerInput}
            multiline
            value={customPrayer}
            onChangeText={setCustomPrayer}
            placeholder="Write your morning prayer..."
            placeholderTextColor="#7a8f88"
          />

          <TouchableOpacity style={styles.primaryButton} onPress={speakPrayer}>
            <Text style={styles.primaryButtonText}>Pray now</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Voice Style</Text>
          <View style={styles.voiceRow}>
            {VOICE_PROFILES.map((profile, index) => (
              <TouchableOpacity
                key={profile.label}
                style={[styles.voiceChip, index === voiceProfileIndex && styles.voiceChipActive]}
                onPress={() => setVoiceProfileIndex(index)}
              >
                <Text style={[styles.voiceChipText, index === voiceProfileIndex && styles.voiceChipTextActive]}>
                  {profile.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </ScrollView>

      {showTimePicker && (
        <DateTimePicker
          value={alarmTime}
          mode="time"
          display="spinner"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E9',
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  headerCard: {
    backgroundColor: '#2F5D4B',
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#DCEADF',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#EEF7EF',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#23372F',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2B2A',
  },
  primaryButton: {
    backgroundColor: '#2F5D4B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#EAF1EE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#214535',
    fontSize: 15,
    fontWeight: '700',
  },
  reference: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A6B5D',
    marginBottom: 8,
  },
  verseText: {
    fontSize: 18,
    lineHeight: 29,
    color: '#1A2A24',
  },
  prayerInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#D7E2DA',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    lineHeight: 24,
    color: '#1F2E2A',
    textAlignVertical: 'top',
    backgroundColor: '#F7FAF8',
  },
  voiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D7CF',
    backgroundColor: '#F3F8F5',
    marginRight: 8,
    marginBottom: 8,
  },
  voiceChipActive: {
    backgroundColor: '#2F5D4B',
    borderColor: '#2F5D4B',
  },
  voiceChipText: {
    color: '#264637',
    fontWeight: '600',
  },
  voiceChipTextActive: {
    color: '#fff',
  },
  statusCard: {
    backgroundColor: '#EEF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D8E7FF',
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3F62',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 15,
    color: '#204B67',
    lineHeight: 24,
  },
});
