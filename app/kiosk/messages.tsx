// Messages screen for employees - Full conversation view
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import * as StorageService from '@/services/storageService';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Message } from '@/types';
import { formatDateTime12Hour } from '@/utils/timeFormat';

export default function MessagesScreen() {
  const router = useRouter();
  const { currentUser, employees, messages, loadData } = useApp();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const myMessages = messages.filter(m => 
    m.isGroupMessage || m.recipientIds.includes(currentUser!.id) || m.senderId === currentUser!.id
  );

  // Group messages by conversation
  const conversations = React.useMemo(() => {
    const convMap = new Map<string, Message[]>();
    
    myMessages.forEach(msg => {
      if (msg.isGroupMessage) {
        const key = 'group';
        if (!convMap.has(key)) convMap.set(key, []);
        convMap.get(key)!.push(msg);
      } else {
        const otherPerson = msg.senderId === currentUser!.id
          ? msg.recipientIds[0]
          : msg.senderId;
        if (!convMap.has(otherPerson)) convMap.set(otherPerson, []);
        convMap.get(otherPerson)!.push(msg);
      }
    });
    
    return convMap;
  }, [myMessages, currentUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (selectedConversation && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [selectedConversation, conversations]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser!.id,
      senderName: `${currentUser!.firstName} ${currentUser!.lastName}`,
      recipientIds: selectedConversation === 'group' ? [] : [selectedConversation],
      content: replyText,
      timestamp: new Date().toISOString(),
      readBy: [currentUser!.id],
      reactions: {},
      isGroupMessage: selectedConversation === 'group',
    };

    await StorageService.addMessage(message);
    await loadData();
    setReplyText('');
  };

  const sendNewMessage = async () => {
    if (!newMessage.trim() || !selectedRecipient) return;

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser!.id,
      senderName: `${currentUser!.firstName} ${currentUser!.lastName}`,
      recipientIds: selectedRecipient === 'group' ? [] : [selectedRecipient],
      content: newMessage,
      timestamp: new Date().toISOString(),
      readBy: [currentUser!.id],
      reactions: {},
      isGroupMessage: selectedRecipient === 'group',
    };

    await StorageService.addMessage(message);
    await loadData();
    setNewMessage('');
    setShowCompose(false);
    setSelectedRecipient('');
    // Open the new conversation
    setSelectedConversation(selectedRecipient);
  };

  const markAsRead = async (messageId: string) => {
    await StorageService.markMessageAsRead(messageId, currentUser!.id);
    await loadData();
  };

  if (selectedConversation) {
    const msgs = selectedConversation === 'group'
      ? conversations.get('group')!
      : conversations.get(selectedConversation)!;

    const conversationName = selectedConversation === 'group'
      ? 'All Employees'
      : (() => {
          const otherPerson = employees.find(e => e.id === selectedConversation);
          return otherPerson ? `${otherPerson.firstName} ${otherPerson.lastName}` : 'Unknown';
        })();

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => setSelectedConversation(null)} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{conversationName}</Text>
              {selectedConversation === 'group' && (
                <Text style={styles.headerSubtitle}>Group Message</Text>
              )}
            </View>
          </View>

          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.messageList}
          >
            {msgs.map(msg => {
              const isMe = msg.senderId === currentUser!.id;
              
              // Mark as read
              if (!isMe && !msg.readBy.includes(currentUser!.id)) {
                markAsRead(msg.id);
              }

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    isMe ? styles.myMessage : styles.theirMessage,
                  ]}
                >
                  {!isMe && selectedConversation === 'group' && (
                    <Text style={styles.messageSender}>{msg.senderName}</Text>
                  )}
                  <Text style={[
                    styles.messageText,
                    isMe && styles.myMessageText,
                  ]}>
                    {msg.content}
                  </Text>
                  <View style={styles.messageFooter}>
                    <Text style={[
                      styles.messageTime,
                      isMe && styles.myMessageTime,
                    ]}>
                      {formatDateTime12Hour(msg.timestamp)}
                    </Text>
                    {/* Read Status */}
                    {selectedConversation === 'group' && msg.readBy.length > 1 && (
                      <Text style={[
                        styles.readStatus,
                        isMe && styles.myReadStatus,
                      ]}>
                        Read by {msg.readBy.length - 1}
                      </Text>
                    )}
                    {selectedConversation !== 'group' && !isMe && msg.readBy.includes(currentUser!.id) && (
                      <MaterialIcons name="done-all" size={14} color="#4CAF50" />
                    )}
                    {selectedConversation !== 'group' && isMe && msg.readBy.length > 1 && (
                      <MaterialIcons name="done-all" size={14} color="rgba(255, 255, 255, 0.9)" />
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Reply Input */}
          <View style={styles.replyContainer}>
            <TextInput
              style={styles.replyInput}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Type a reply..."
              multiline
              maxLength={500}
            />
            <Pressable
              style={[
                styles.sendButton,
                !replyText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={sendReply}
              disabled={!replyText.trim()}
            >
              <MaterialIcons 
                name="send" 
                size={24} 
                color={replyText.trim() ? LOWES_THEME.primary : '#CCCCCC'} 
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Conversation list view
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Messages</Text>
          <Pressable
            style={styles.newMessageButton}
            onPress={() => setShowCompose(!showCompose)}
          >
            <MaterialIcons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newMessageButtonText}>New Message</Text>
          </Pressable>
        </View>

        {/* Compose New Message */}
        {showCompose && (
          <View style={styles.composeContainer}>
            <Text style={styles.composeTitle}>New Message</Text>
            
            {/* Recipient Selection */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipientScroll}>
              <Pressable
                style={[
                  styles.recipientChip,
                  selectedRecipient === 'group' && styles.recipientSelected,
                ]}
                onPress={() => setSelectedRecipient('group')}
              >
                <MaterialIcons name="group" size={16} color="#FFFFFF" />
                <Text style={styles.recipientText}>All Staff</Text>
              </Pressable>
              
              {employees
                .filter(e => e.id !== currentUser!.id && e.status === 'active' && (e.role === 'admin' || e.role === 'manager'))
                .map(emp => (
                  <Pressable
                    key={emp.id}
                    style={[
                      styles.recipientChip,
                      selectedRecipient === emp.id && styles.recipientSelected,
                    ]}
                    onPress={() => setSelectedRecipient(emp.id)}
                  >
                    <Text style={styles.recipientText}>
                      {emp.firstName} {emp.lastName}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>

            {/* Message Input */}
            <TextInput
              style={styles.composeInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type your message..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.composeActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowCompose(false);
                  setNewMessage('');
                  setSelectedRecipient('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.sendMessageButton,
                  (!selectedRecipient || !newMessage.trim()) && styles.sendMessageButtonDisabled,
                ]}
                onPress={sendNewMessage}
                disabled={!selectedRecipient || !newMessage.trim()}
              >
                <Text style={styles.sendMessageButtonText}>Send</Text>
              </Pressable>
            </View>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content}>
          {conversations.size === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="mail-outline" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No messages</Text>
            </View>
          ) : (
            <View style={styles.conversationList}>
              {/* Group Messages */}
              {conversations.has('group') && (
                <Pressable
                  style={styles.conversationCard}
                  onPress={() => setSelectedConversation('group')}
                >
                  <View style={[styles.avatar, { backgroundColor: LOWES_THEME.primary }]}>
                    <MaterialIcons name="group" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationName}>All Employees</Text>
                      <View style={styles.groupBadge}>
                        <Text style={styles.groupText}>Group</Text>
                      </View>
                    </View>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {conversations.get('group')![conversations.get('group')!.length - 1].content}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
                </Pressable>
              )}

              {/* Direct Messages */}
              {Array.from(conversations.entries())
                .filter(([key]) => key !== 'group')
                .map(([personId, msgs]) => {
                  const person = employees.find(e => e.id === personId);
                  if (!person) return null;
                  
                  const unreadCount = msgs.filter(m => 
                    m.senderId !== currentUser!.id && !m.readBy.includes(currentUser!.id)
                  ).length;

                  return (
                    <Pressable
                      key={personId}
                      style={[
                        styles.conversationCard,
                        unreadCount > 0 && styles.unreadCard,
                      ]}
                      onPress={() => setSelectedConversation(personId)}
                    >
                      <View style={[styles.avatar, { backgroundColor: '#FF9800' }]}>
                        <Text style={styles.avatarText}>
                          {person.firstName[0]}{person.lastName[0]}
                        </Text>
                      </View>
                      <View style={styles.conversationInfo}>
                        <Text style={styles.conversationName}>
                          {person.firstName} {person.lastName}
                        </Text>
                        <Text style={styles.lastMessage} numberOfLines={1}>
                          {msgs[msgs.length - 1].content}
                        </Text>
                      </View>
                      <View style={styles.rightInfo}>
                        {unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{unreadCount}</Text>
                          </View>
                        )}
                        <MaterialIcons name="chevron-right" size={24} color="#CCCCCC" />
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOWES_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  content: {
    padding: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: LOWES_THEME.textSubtle,
  },
  conversationList: {
    gap: SPACING.sm,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 12,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.primary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  conversationName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  groupBadge: {
    backgroundColor: LOWES_THEME.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  groupText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  lastMessage: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  rightInfo: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  unreadBadge: {
    backgroundColor: LOWES_THEME.error,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  messageList: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: SPACING.md,
    borderRadius: 16,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: LOWES_THEME.primary,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  messageSender: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginBottom: 4,
  },
  messageText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  messageTime: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  readStatus: {
    fontSize: FONTS.sizes.xs,
    color: '#4CAF50',
    fontWeight: '600',
  },
  myReadStatus: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  newMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOWES_THEME.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  newMessageButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  composeContainer: {
    backgroundColor: '#F0F7FF',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  composeTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  recipientScroll: {
    flexGrow: 0,
  },
  recipientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#CCCCCC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginRight: SPACING.sm,
  },
  recipientSelected: {
    backgroundColor: LOWES_THEME.primary,
  },
  recipientText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  composeInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composeActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  cancelButtonText: {
    color: LOWES_THEME.text,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  sendMessageButton: {
    backgroundColor: LOWES_THEME.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  sendMessageButtonDisabled: {
    opacity: 0.5,
  },
  sendMessageButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    backgroundColor: '#FFFFFF',
  },
  replyInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md,
  },
  sendButton: {
    padding: SPACING.sm,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
