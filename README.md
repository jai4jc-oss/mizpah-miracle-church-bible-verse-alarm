
const VERSES = [
  {
    reference: 'Psalm 23:1-3',
    text: 'The Lord is my shepherd; I shall not want. He makes me to lie down in green pastures; He leads me beside the still waters. He restores my soul; He leads me in the paths of righteousness for His name’s sake.'
  },
  {
    reference: 'Isaiah 41:10',
    text: 'Fear not, for I am with you; be not dismayed, for I am your God. I will strengthen you, yes, I will help you, I will uphold you with My righteous right hand.'
  },
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through Christ who strengthens me.'
  },
  {
    reference: 'Joshua 1:9',
    text: 'Be strong and of good courage; do not be afraid, nor be dismayed, for the Lord your God is with you wherever you go.'
  },
  {
    reference: 'Psalm 46:10',
    text: 'Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth!'
  },
  {
    reference: 'Romans 15:13',
    text: 'Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope by the power of the Holy Spirit.'
  },
  {
    reference: 'Lamentations 3:22-23',
    text: 'Through the Lord’s mercies we are not consumed, because His compassions fail not. They are new every morning; great is Your faithfulness.'
  },
  {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the Lord with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He shall direct your paths.'
  },
  {
    reference: '2 Timothy 1:7',
    text: 'For God has not given us a spirit of fear, but of power and of love and of a sound mind.'
  },
  {
    reference: 'Psalm 91:1-2',
    text: 'He who dwells in the secret place of the Most High shall abide under the shadow of the Almighty. I will say of the Lord, He is my refuge and my fortress; my God, in Him I will trust.'
  }
];

const STORAGE_KEYS = {
  ALARM_ENABLED: 'bva_alarm_enabled',
  ALARM_TIME: 'bva_alarm_time'
};

function getDailyVerse() {
  const dayOfYear = new Date().getDate();
  return VERSES[dayOfYear % VERSES.length];
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getFriendlyTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export default function App() {
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [time, setTime] = useState(new Date(2025, 0, 1, 6, 30));
  const [showPicker, setShowPicker] = useState(false);
  const [dailyVerse, setDailyVerse] = useState(getDailyVerse());
  const [status, setStatus] = useState('Preparing your daily wake-up reminder...');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const storedTime = await AsyncStorage.getItem(STORAGE_KEYS.ALARM_TIME);
        const storedEnabled = await AsyncStorage.getItem(STORAGE_KEYS.ALARM_ENABLED);

        if (storedTime) {
          const parsed = new Date(storedTime);
          if (!isNaN(parsed.getTime())) {
            setTime(parsed);
          }
        }

        if (storedEnabled !== null) {
          setAlarmEnabled(storedEnabled === 'true');
        }

        await requestNotificationPermissions();
      } catch (error) {
        console.warn('Unable to load settings', error);
      } finally {
        setIsReady(true);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    AsyncStorage.setItem(STORAGE_KEYS.ALARM_TIME, time.toISOString());
    AsyncStorage.setItem(STORAGE_KEYS.ALARM_ENABLED, String(alarmEnabled));
    scheduleAlarm();
  }, [time, alarmEnabled, isReady]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const body = notification.request.content.body || '';
      setStatus('The verse is speaking. Morning grace is here.');
      Speech.speak(body, {
        language: 'en-US',
        rate: 0.9,
        pitch: 1.0
      });
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      setStatus('A fresh word from God is ready for you.');
      Speech.speak(`${dailyVerse.reference}. ${dailyVerse.text}`, {
        language: 'en-US',
        rate: 0.88,
        pitch: 1.0
      });
    });

    return () => subscription.remove();
  }, [dailyVerse]);

  async function requestNotificationPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const permissionResult = await Notifications.requestPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        setStatus('Notification permission is required for the morning wake-up alarm.');
      }
    }
  }

  async function scheduleAlarm() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (!alarmEnabled) {
        setStatus('Wake-up alarm is now paused.');
        return;
      }

      const trigger = {
        hour: time.getHours(),
        minute: time.getMinutes(),
        second: 0,
        repeats: true,
      };

      const content = {
        title: 'Mizpah Miracle Church',
        body: `${dailyVerse.reference} — ${dailyVerse.text}`,
        sound: 'default'
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger
      });

      setStatus(`Wake-up alarm set for ${formatTime(time)}.`);
    } catch (error) {
      console.warn('Unable to schedule notification:', error);
      setStatus('Alarm is ready, but notification scheduling needs a device permission check.');
    }
  }

  function handleTimeChange(event, selectedDate) {
    setShowPicker(false);
    if (selectedDate) {
      setTime(selectedDate);
    }
  }

  function handleSpeakVerse() {
    Speech.speak(`${dailyVerse.reference}. ${dailyVerse.text}`, {
      language: 'en-US',
      rate: 0.9,
      pitch: 1.0
    });
    setStatus(`Speaking ${dailyVerse.reference}.`);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <Text style={styles.brand}>Mizpah Miracle Church</Text>
          <Text style={styles.title}>Bible Verse Alarm</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Wake Time</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.timeText}>{getFriendlyTime(time)}</Text>
            <Switch
              value={alarmEnabled}
              onValueChange={(value) => setAlarmEnabled(value)}
              trackColor={{ false: '#d9d9d9', true: '#6A9C73' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.buttonSecondary} onPress={() => setShowPicker(true)}>
            <Text style={styles.buttonSecondaryText}>Choose a time</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Verse of the Day</Text>
          <Text style={styles.reference}>{dailyVerse.reference}</Text>
          <Text style={styles.verseText}>{dailyVerse.text}</Text>

          <TouchableOpacity style={styles.buttonPrimary} onPress={handleSpeakVerse}>
            <Text style={styles.buttonPrimaryText}>Hear the verse</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={time}
          mode="time"
          display="spinner"
          onChange={handleTimeChange}
          themeVariant="light"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E9'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  headerCard: {
    backgroundColor: '#2E5B45',
    borderRadius: 18,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4
  },
  brand: {
    color: '#D8E7D6',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 8
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#203426',
    marginBottom: 12
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  timeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2B2A'
  },
  buttonPrimary: {
    backgroundColor: '#2E5B45',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 18
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  buttonSecondary: {
    backgroundColor: '#E7F0EA',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center'
  },
  buttonSecondaryText: {
    color: '#1A4330',
    fontSize: 15,
    fontWeight: '700'
  },
  reference: {
    color: '#536E5E',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10
  },
  verseText: {
    color: '#1B2B23',
    fontSize: 18,
    lineHeight: 28
  },
  statusCard: {
    backgroundColor: '#E8F1FF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D5E4FF'
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#173B59',
    marginBottom: 8
  },
  statusText: {
    fontSize: 15,
    color: '#1D3F5F',
    lineHeight: 24
  }
});

const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const Notifications = require('expo-notifications');
const Speech = require('expo-speech');
const { StatusBar } = require('expo-status-bar');
