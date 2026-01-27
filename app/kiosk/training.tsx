// Training screen with modern UI
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, isTablet } from '@/constants/theme';

const SCRIPTS = [
  {
    id: 'opening',
    icon: 'wb-sunny',
    title: 'The Opening',
    subtitle: 'Make an unforgettable first impression',
    content: `"Hey there! Quick question — have you ever noticed anything weird with your tap water at home?

(Pause for their response, build rapport)

"We're doing a quick 60-second survey on local water quality right here in the store. Takes less than a minute, and everyone who completes it is eligible to win up to $500 in gift cards — we give them away every single month!"`,
  },
  {
    id: 'value',
    icon: 'card-giftcard',
    title: 'The Value Hook',
    subtitle: 'Why they should give you their info',
    content: `"At the end, I'll just need your contact info to make sure you're entered for the $500 gift card drawing. Winners are announced monthly, and it's 100% free to enter."

💡 Pro Tip: Emphasize "free," "no obligation," and "$500" throughout the conversation`,
  },
  {
    id: 'appointment',
    icon: 'event',
    title: 'The Appointment Close',
    subtitle: 'Getting them to schedule',
    content: `"Perfect! Based on your answers, you qualify for a free in-home water analysis. A specialist can come test your water, show you what's actually in it, and answer any questions you have — completely free, no obligation."

"Would [suggest specific time/day] work for you, or is [alternative time] better?"

💡 Pro Tip: Always give two options (assumptive close). Make it easy for them to say yes.`,
  },
];

const KEY_REMINDERS = [
  {
    number: '1',
    text: 'Stay energetic and friendly — your enthusiasm is contagious!',
  },
  {
    number: '2',
    text: 'Mention the $500 gift card multiple times',
  },
  {
    number: '3',
    text: 'Keep it conversational, not salesy',
  },
  {
    number: '4',
    text: 'Always end with scheduling the appointment (assumptive close)',
  },
];

const REBUTTALS = [
  {
    number: '1',
    objection: `"I'm not interested."`,
    response: `Totally fine 😊
It's just quick customer feedback on local water quality.
Takes less than a minute and you'll be eligible for a complimentary thank-you for participating.`,
  },
  {
    number: '2',
    objection: `"I don't have time."`,
    response: `No problem — it's fast!
Only 10 questions, usually under a minute.
Completing it makes you eligible for the thank-you gift.`,
  },
  {
    number: '3',
    objection: `"How much is this going to cost?"`,
    response: `Nothing at all — it's completely free.
We're just gathering feedback today.
There's no cost and no obligation to participate.`,
  },
  {
    number: '4',
    objection: `"You're going to try to sell me something."`,
    response: `Great question.
We actually don't sell anything here in the store.
You're never obligated to take anything further, even if you're contacted later.`,
  },
  {
    number: '5',
    objection: `"I don't give out my number."`,
    response: `Totally respect that.
We use it only to confirm participation so you stay eligible for the thank-you.
Your info is private and not shared or sold.`,
  },
  {
    number: '6',
    objection: `"I already have a softener/filter."`,
    response: `Nice — a lot of people here do!
Many still complete the survey to compare experiences or check performance.
And you're still eligible just for participating.`,
  },
  {
    number: '7',
    objection: `"My water is fine."`,
    response: `That's awesome!
We're just seeing what customers think and experience.
Takes a minute, and you'll be eligible for the thank-you either way.`,
  },
  {
    number: '8',
    objection: `"Are you selling something?"`,
    response: `Nope — we're just collecting customer input today.
No selling, no pressure, no obligation at all.
Completing the survey just makes you eligible for the complimentary offer.`,
  },
  {
    number: '9',
    objection: `"Let me think about it."`,
    response: `Sure!
Just so you know — we're only here for a short time.
It's the quickest way to qualify for the thank-you while you're already in the store.`,
  },
  {
    number: '10',
    objection: `"I don't want anyone coming to my house."`,
    response: `Totally understandable.
Doing the survey doesn't lock you into anything.
Someone may follow up just to share results — you decide what happens next.`,
  },
  {
    number: '11',
    objection: `"I already did the survey."`,
    response: `No problem — thank you for helping out!
Our system updates frequently and sometimes entries don't sync fully,
so we're double-checking participation today.
If you'll answer the quick questions again and confirm your info,
you'll still be eligible for the thank-you offer.

(Practice tip: warm smile + casual tone → makes it feel normal, not shady)`,
  },
  {
    number: '12',
    objection: `"What's the catch?"`,
    response: `No catch at all!
We're just gathering honest feedback about local water quality.
You get entered to win up to $500 in gift cards just for participating.`,
  },
];

const QUESTIONS_DATA = [
  { question: 'Do you buy bottled water?', type: 'Yes/No' },
  { question: 'Are you a homeowner or currently purchasing a home?', type: 'Yes/No' },
  { question: 'How would you rate your current water quality?', type: 'Good/Fair/Poor' },
  { question: 'What is your water source?', type: 'City/County or Well' },
  { question: 'Do you use any filters?', type: 'Yes/No' },
  { question: 'Do you notice any bad tastes or odors in your tap water?', type: 'Yes/No' },
  { question: 'What type of property do you live in?', type: 'House/Mobile Home/Apartment/Condo' },
  { question: 'Contact Information', type: 'Name, Phone, Zip' },
  { question: 'Customer Signature', type: 'Sign to confirm' },
];

export default function TrainingScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'script' | 'rebuttals' | 'questions'>('script');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#2d1b4e', '#3d2766']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            
            <View style={styles.headerCenter}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="school" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.headerTitle}>Training Center</Text>
              <Text style={styles.headerSubtitle}>Master your approach and handle any objection</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setActiveTab('script')}
              style={[styles.tab, activeTab === 'script' && styles.activeTab]}
            >
              <MaterialIcons 
                name="auto-awesome" 
                size={20} 
                color={activeTab === 'script' ? '#9D4EDD' : '#8B8B9E'} 
              />
              <Text style={[styles.tabText, activeTab === 'script' && styles.activeTabText]}>
                Script
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => setActiveTab('rebuttals')}
              style={[styles.tab, activeTab === 'rebuttals' && styles.activeTab]}
            >
              <MaterialIcons 
                name="chat" 
                size={20} 
                color={activeTab === 'rebuttals' ? '#9D4EDD' : '#8B8B9E'} 
              />
              <Text style={[styles.tabText, activeTab === 'rebuttals' && styles.activeTabText]}>
                Rebuttals
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => setActiveTab('questions')}
              style={[styles.tab, activeTab === 'questions' && styles.activeTab]}
            >
              <MaterialIcons 
                name="help-outline" 
                size={20} 
                color={activeTab === 'questions' ? '#9D4EDD' : '#8B8B9E'} 
              />
              <Text style={[styles.tabText, activeTab === 'questions' && styles.activeTabText]}>
                Questions
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={styles.content}>
            {activeTab === 'script' && (
              <View style={styles.scriptContainer}>
                {SCRIPTS.map((script) => (
                  <View key={script.id} style={styles.scriptCard}>
                    <View style={styles.scriptHeader}>
                      <View style={styles.scriptIcon}>
                        <MaterialIcons name={script.icon as any} size={28} color="#F59E0B" />
                      </View>
                      <View style={styles.scriptHeaderText}>
                        <Text style={styles.scriptTitle}>{script.title}</Text>
                        <Text style={styles.scriptSubtitle}>{script.subtitle}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.scriptContentBox}>
                      <Text style={styles.scriptContent}>{script.content}</Text>
                    </View>
                  </View>
                ))}
                
                {/* Key Reminders */}
                <View style={styles.remindersCard}>
                  <View style={styles.remindersHeader}>
                    <MaterialIcons name="emoji-objects" size={24} color="#F59E0B" />
                    <Text style={styles.remindersTitle}>🎯 Key Reminders</Text>
                  </View>
                  
                  {KEY_REMINDERS.map((reminder) => (
                    <View key={reminder.number} style={styles.reminderItem}>
                      <View style={styles.reminderNumber}>
                        <Text style={styles.reminderNumberText}>{reminder.number}</Text>
                      </View>
                      <Text style={styles.reminderText}>{reminder.text}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Demo Button */}
                <View style={styles.demoSection}>
                  <Button
                    title="Start Practice Demo"
                    onPress={() => router.push('/kiosk/demo-survey')}
                    backgroundColor="#9D4EDD"
                    size="large"
                    fullWidth
                    icon="play-arrow"
                  />
                  <Text style={styles.demoNote}>
                    Practice mode — no data saved or synced
                  </Text>
                </View>
              </View>
            )}

            {activeTab === 'rebuttals' && (
              <View style={styles.rebuttalsContainer}>
                {REBUTTALS.map((rebuttal) => (
                  <View key={rebuttal.number} style={styles.rebuttalCard}>
                    <View style={styles.rebuttalHeader}>
                      <View style={styles.rebuttalNumber}>
                        <Text style={styles.rebuttalNumberText}>{rebuttal.number}</Text>
                      </View>
                      <Text style={styles.objectionText}>{rebuttal.objection}</Text>
                    </View>
                    
                    <View style={styles.responseBox}>
                      <Text style={styles.responseText}>{rebuttal.response}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'questions' && (
              <View style={styles.questionsContainer}>
                <View style={styles.questionsInfo}>
                  <MaterialIcons name="info-outline" size={20} color="#9D4EDD" />
                  <Text style={styles.questionsInfoText}>
                    Survey questions in order (9 total)
                  </Text>
                </View>
                
                {QUESTIONS_DATA.map((item, index) => (
                  <View key={index} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <View style={styles.questionNumber}>
                        <Text style={styles.questionNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.questionContent}>
                        <Text style={styles.questionText}>{item.question}</Text>
                        <Text style={styles.questionType}>{item.type}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const isTabletDevice = isTablet();

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    padding: SPACING.sm,
    zIndex: 10,
  },
  headerCenter: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(157, 78, 221, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeTab: {
    backgroundColor: 'rgba(157, 78, 221, 0.2)',
  },
  tabText: {
    fontSize: 14,
    color: '#8B8B9E',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#9D4EDD',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 80,
    maxWidth: isTabletDevice ? 1000 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  scriptContainer: {
    gap: SPACING.lg,
  },
  scriptCard: {
    backgroundColor: 'rgba(45, 27, 78, 0.8)',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.2)',
  },
  scriptHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  scriptIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scriptHeaderText: {
    flex: 1,
    gap: 4,
  },
  scriptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scriptSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  scriptContentBox: {
    backgroundColor: 'rgba(20, 20, 40, 0.6)',
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.1)',
  },
  scriptContent: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
  },
  remindersCard: {
    backgroundColor: 'rgba(45, 27, 78, 0.8)',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.2)',
    gap: SPACING.md,
  },
  remindersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  remindersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reminderItem: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  reminderNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(157, 78, 221, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reminderText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
  },
  demoSection: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  demoNote: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  rebuttalsContainer: {
    gap: SPACING.md,
  },
  rebuttalCard: {
    backgroundColor: 'rgba(45, 27, 78, 0.8)',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.2)',
    gap: SPACING.md,
  },
  rebuttalHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  rebuttalNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(157, 78, 221, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rebuttalNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  objectionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  responseBox: {
    backgroundColor: 'rgba(20, 20, 40, 0.6)',
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    marginLeft: 44,
  },
  responseText: {
    fontSize: 14,
    color: 'rgba(139, 195, 74, 0.95)',
    lineHeight: 22,
  },
  questionsContainer: {
    gap: SPACING.md,
  },
  questionsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: 'rgba(157, 78, 221, 0.15)',
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  questionsInfoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  questionCard: {
    backgroundColor: 'rgba(45, 27, 78, 0.8)',
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 221, 0.2)',
  },
  questionHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  questionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(157, 78, 221, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  questionContent: {
    flex: 1,
    gap: 4,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  questionType: {
    fontSize: 13,
    color: 'rgba(157, 78, 221, 0.9)',
  },
});
