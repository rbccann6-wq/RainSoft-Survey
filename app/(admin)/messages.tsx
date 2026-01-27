// Admin messaging page - Full messaging system
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Message } from '@/types';
import { formatDateTime12Hour } from '@/utils/timeFormat';

export default function MessagesScreen() {
  const { currentUser, employees, messages, loadData } = useApp();
  const { showAlert } = useAlert();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');

  // Group messages by conversation
  const conversations = React.useMemo(() => {
    const convMap = new Map<string, Message[]>();
    
    messages.forEach(msg => {
      if (msg.isGroupMessage) {
        const key = 'group';
        if (!convMap.has(key)) convMap.set(key, []);
        convMap.get(key)!.push(msg);
      } else {
        // Direct message - create conversation key
        const otherPerson = msg.senderId === currentUser!.id
          ? msg.recipientIds[0]
          : msg.senderId;
        if (!convMap.has(otherPerson)) convMap.set(otherPerson, []);
        convMap.get(otherPerson)!.push(msg);
      }
    });
    
    return convMap;
  }, [messages, currentUser]);

  const sendMessage = async (isGroup: boolean, recipientId?: string) => {
    if (!newMessage.trim()) {
      showAlert('Error', 'Please enter a message');
      return;
    }

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser!.id,
      senderName: `${currentUser!.firstName} ${currentUser!.lastName}`,
      recipientIds: isGroup ? [] : [recipientId!],
      content: newMessage,
      timestamp: new Date().toISOString(),
      readBy: [currentUser!.id],
      reactions: {},
      isGroupMessage: isGroup,
    };

    await StorageService.addMessage(message);
    await loadData();
    setNewMessage('');
    setShowCompose(false);
  };

  const markAsRead = async (messageId: string) => {
    await StorageService.markMessageAsRead(messageId, currentUser!.id);
    await loadData();
  };

  const renderConversationList = () => {
    return (
      <View style={styles.conversationList}>
        {/* Group Messages */}
        {conversations.has('group') && (
          <Pressable
            style={[
              styles.conversationCard,
              selectedConversation === 'group' && styles.selectedCard,
            ]}
            onPress={() => setSelectedConversation('group')}
          >
            <View style={styles.conversationHeader}>
              <View style={[styles.avatar, { backgroundColor: LOWES_THEME.primary }]}>
                <MaterialIcons name="group" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.conversationInfo}>
                <Text style={styles.conversationName}>All Employees</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {conversations.get('group')![conversations.get('group')!.length - 1].content}
                </Text>
              </View>
            </View>
            <Text style={styles.messageCount}>
              {conversations.get('group')!.length}
            </Text>
          </Pressable>
        )}

        {/* Direct Messages */}
        {Array.from(conversations.entries())
          .filter(([key]) => key !== 'group')
          .map(([recipientId, msgs]) => {
            const recipient = employees.find(e => e.id === recipientId);
            if (!recipient) return null;
            
            const unreadCount = msgs.filter(m => !m.readBy.includes(currentUser!.id)).length;
            
            return (
              <Pressable
                key={recipientId}
                style={[
                  styles.conversationCard,
                  selectedConversation === recipientId && styles.selectedCard,
                ]}
                onPress={() => setSelectedConversation(recipientId)}
              >
                <View style={styles.conversationHeader}>
                  <View style={[styles.avatar, { backgroundColor: '#FF9800' }]}>
                    <Text style={styles.avatarText}>
                      {recipient.firstName[0]}{recipient.lastName[0]}
                    </Text>
                  </View>
                  <View style={styles.conversationInfo}>
                    <Text style={styles.conversationName}>
                      {recipient.firstName} {recipient.lastName}
                    </Text>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {msgs[msgs.length - 1].content}
                    </Text>
                  </View>
                </View>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
      </View>
    );
  };

  const renderMessages = () => {
    if (!selectedConversation) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="chat-bubble-outline" size={64} color="#CCCCCC" />
          <Text style={styles.emptyText}>Select a conversation</Text>
        </View>
      );
    }

    const msgs = selectedConversation === 'group'
      ? conversations.get('group')!
      : conversations.get(selectedConversation)!;

    return (
      <View style={styles.messageThread}>
        <ScrollView 
          contentContainerStyle={styles.messageList}
          ref={ref => ref?.scrollToEnd({ animated: true })}
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
                {!isMe && (
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
                  {/* Read Status for Group Messages */}
                  {selectedConversation === 'group' && msg.readBy.length > 0 && (
                    <Pressable onPress={() => {
                      const readers = employees.filter(e => msg.readBy.includes(e.id));
                      const readerNames = readers.map(r => `${r.firstName} ${r.lastName}`).join(', ');
                      alert(`Read by: ${readerNames}`);
                    }}>
                      <Text style={[
                        styles.readStatus,
                        isMe && styles.myReadStatus,
                      ]}>
                        {msg.readBy.length} read • tap for details
                      </Text>
                    </Pressable>
                  )}
                  {/* Read Status for Direct Messages */}
                  {selectedConversation !== 'group' && isMe && msg.readBy.length > 1 && (
                    <View style={styles.readIndicator}>
                      <MaterialIcons name="done-all" size={14} color="rgba(255, 255, 255, 0.9)" />
                      <Text style={styles.myReadStatus}>Read</Text>
                    </View>
                  )}
                  {selectedConversation !== 'group' && !isMe && msg.readBy.includes(currentUser!.id) && (
                    <MaterialIcons name="done-all" size={14} color="#4CAF50" />
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
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a reply..."
            multiline
            maxLength={500}
          />
          <Pressable
            style={[
              styles.sendButton,
              !newMessage.trim() && styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage(
              selectedConversation === 'group',
              selectedConversation !== 'group' ? selectedConversation : undefined
            )}
            disabled={!newMessage.trim()}
          >
            <MaterialIcons 
              name="send" 
              size={24} 
              color={newMessage.trim() ? LOWES_THEME.primary : '#CCCCCC'} 
            />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Pressable
          style={styles.composeButton}
          onPress={() => setShowCompose(!showCompose)}
        >
          <MaterialIcons name="edit" size={24} color={LOWES_THEME.primary} />
        </Pressable>
      </View>

      {/* Compose New Message */}
      {showCompose && (
        <View style={styles.composeContainer}>
          <Text style={styles.composeTitle}>New Message</Text>
          
          {/* Recipient Selection */}
          <View style={styles.recipientRow}>
            <Pressable
              style={[
                styles.recipientOption,
                selectedRecipient === 'group' && styles.recipientSelected,
              ]}
              onPress={() => setSelectedRecipient('group')}
            >
              <MaterialIcons name="group" size={20} color="#FFFFFF" />
              <Text style={styles.recipientText}>All Employees</Text>
            </Pressable>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {employees
                .filter(e => e.id !== currentUser!.id && e.status === 'active')
                .map(emp => (
                  <Pressable
                    key={emp.id}
                    style={[
                      styles.recipientOption,
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
          </View>

          {/* Message Input */}
          <TextInput
            style={styles.composeInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type your message..."
            multiline
            numberOfLines={4}
          />

          <View style={styles.composeActions}>
            <Button
              title="Cancel"
              onPress={() => {
                setShowCompose(false);
                setNewMessage('');
                setSelectedRecipient('');
              }}
              variant="outline"
            />
            <Button
              title="Send"
              onPress={() => sendMessage(
                selectedRecipient === 'group',
                selectedRecipient !== 'group' ? selectedRecipient : undefined
              )}
              backgroundColor={LOWES_THEME.primary}
              disabled={!selectedRecipient || !newMessage.trim()}
            />
          </View>
        </View>
      )}

      {/* Main Content */}
      <KeyboardAvoidingView 
        style={styles.mainContent}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Conversation List */}
        <View style={styles.leftPanel}>
          <Text style={styles.panelTitle}>Conversations</Text>
          {renderConversationList()}
        </View>

        {/* Message Thread */}
        <View style={styles.rightPanel}>
          {renderMessages()}
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  composeButton: {
    padding: SPACING.sm,
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
  recipientRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  recipientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#CCCCCC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  composeActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: LOWES_THEME.border,
  },
  rightPanel: {
    flex: 1,
  },
  panelTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  conversationList: {
    gap: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedCard: {
    backgroundColor: '#E3F2FD',
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  conversationInfo: {
    flex: 1,
    gap: 4,
  },
  conversationName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  lastMessage: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  messageCount: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: '#CCCCCC',
  },
  messageThread: {
    flex: 1,
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
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
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
    fontSize: FONTS.sizes.xs,
  },
  readIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
