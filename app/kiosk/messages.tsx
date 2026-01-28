// Modern iPhone Messages-style UI for employee messaging
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import * as StorageService from '@/services/storageService';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Message } from '@/types';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, employees, messages, loadData } = useApp();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const myMessages = messages.filter(m => 
    m.isGroupMessage || m.recipientIds.includes(currentUser!.id) || m.senderId === currentUser!.id
  );

  // Group messages by conversation
  const conversations = React.useMemo(() => {
    const convMap = new Map<string, Message[]>();
    
    myMessages.forEach(msg => {
      if (msg.isGroupMessage) {
        if (!convMap.has('group')) convMap.set('group', []);
        convMap.get('group')!.push(msg);
      } else {
        const otherPerson = msg.senderId === currentUser!.id
          ? msg.recipientIds[0]
          : msg.senderId;
        if (!convMap.has(otherPerson)) convMap.set(otherPerson, []);
        convMap.get(otherPerson)!.push(msg);
      }
    });
    
    // Sort messages by timestamp within each conversation
    convMap.forEach((msgs) => {
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
    
    return convMap;
  }, [myMessages, currentUser]);

  // Auto-scroll to bottom when opening conversation or new message arrives
  useEffect(() => {
    if (selectedConversation && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [selectedConversation, conversations]);

  // Mark messages as read
  useEffect(() => {
    if (selectedConversation) {
      const msgs = conversations.get(selectedConversation) || [];
      msgs.forEach(msg => {
        if (msg.senderId !== currentUser!.id && !msg.readBy.includes(currentUser!.id)) {
          StorageService.markMessageAsRead(msg.id, currentUser!.id);
        }
      });
      loadData();
    }
  }, [selectedConversation]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    const message: Message = {
      id: Date.now().toString(),
      senderId: currentUser!.id,
      senderName: `${currentUser!.firstName} ${currentUser!.lastName}`,
      recipientIds: selectedConversation === 'group' ? [] : [selectedConversation],
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
      readBy: [currentUser!.id],
      reactions: {},
      isGroupMessage: selectedConversation === 'group',
    };

    await StorageService.addMessage(message);
    await loadData();
    setMessageText('');
    Keyboard.dismiss();
    
    // Scroll to bottom after sending
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${minutes} ${ampm}`;
  };

  // Conversation View
  if (selectedConversation) {
    const msgs = conversations.get(selectedConversation) || [];
    const conversationName = selectedConversation === 'group'
      ? 'All Employees'
      : (() => {
          const person = employees.find(e => e.id === selectedConversation);
          return person ? `${person.firstName} ${person.lastName}` : 'Unknown';
        })();

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* iPhone-style Header */}
          <View style={styles.conversationHeader}>
            <Pressable 
              onPress={() => setSelectedConversation(null)}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="chevron-left" size={32} color="#007AFF" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            
            <View style={styles.conversationTitle}>
              <Text style={styles.conversationName} numberOfLines={1}>
                {conversationName}
              </Text>
              {selectedConversation === 'group' && (
                <Text style={styles.conversationSubtitle}>
                  {employees.length} members
                </Text>
              )}
            </View>
            
            <View style={styles.headerRight} />
          </View>

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={msgs}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.messagesList,
              { paddingBottom: insets.bottom + 60 }
            ]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item: msg, index }) => {
              const isMe = msg.senderId === currentUser!.id;
              const showSender = selectedConversation === 'group' && !isMe;
              const prevMsg = index > 0 ? msgs[index - 1] : null;
              const showTimestamp = !prevMsg || 
                new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 5 * 60 * 1000;

              return (
                <View>
                  {showTimestamp && (
                    <View style={styles.timestampContainer}>
                      <Text style={styles.timestamp}>{formatTime(msg.timestamp)}</Text>
                    </View>
                  )}
                  
                  <View style={[
                    styles.messageBubbleContainer,
                    isMe ? styles.myMessageContainer : styles.theirMessageContainer
                  ]}>
                    <View style={[
                      styles.messageBubble,
                      isMe ? styles.myBubble : styles.theirBubble
                    ]}>
                      {showSender && (
                        <Text style={styles.senderName}>{msg.senderName}</Text>
                      )}
                      <Text style={[
                        styles.messageText,
                        isMe ? styles.myMessageText : styles.theirMessageText
                      ]}>
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* iPhone-style Input Bar */}
          <View style={[
            styles.inputBar,
            { paddingBottom: Math.max(insets.bottom, SPACING.sm) }
          ]}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Message"
                placeholderTextColor="#8E8E93"
                multiline
                maxLength={1000}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={sendMessage}
              />
              
              <Pressable
                onPress={() => {
                  if (messageText.trim()) {
                    sendMessage();
                  }
                }}
                disabled={!messageText.trim()}
                style={[
                  styles.sendButton,
                  !messageText.trim() && styles.sendButtonDisabled
                ]}
              >
                <MaterialIcons 
                  name="arrow-upward" 
                  size={20} 
                  color="#FFFFFF" 
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Conversations List View
  const conversationsList = Array.from(conversations.entries()).map(([key, msgs]) => {
    const lastMsg = msgs[msgs.length - 1];
    const unreadCount = msgs.filter(m => 
      m.senderId !== currentUser!.id && !m.readBy.includes(currentUser!.id)
    ).length;
    
    if (key === 'group') {
      return {
        id: 'group',
        name: 'All Employees',
        subtitle: `${employees.length} members`,
        avatar: '👥',
        lastMessage: lastMsg.content,
        timestamp: lastMsg.timestamp,
        unreadCount,
        isGroup: true,
      };
    } else {
      const person = employees.find(e => e.id === key);
      if (!person) return null;
      
      return {
        id: key,
        name: `${person.firstName} ${person.lastName}`,
        subtitle: person.role,
        avatar: `${person.firstName[0]}${person.lastName[0]}`,
        lastMessage: lastMsg.content,
        timestamp: lastMsg.timestamp,
        unreadCount,
        isGroup: false,
      };
    }
  }).filter(Boolean).sort((a, b) => 
    new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime()
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* iPhone-style Header */}
      <View style={styles.listHeader}>
        <Pressable 
          onPress={() => router.back()}
          style={styles.headerBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="chevron-left" size={32} color="#007AFF" />
        </Pressable>
        
        <Text style={styles.listTitle}>Messages</Text>
        
        <View style={styles.headerRight} />
      </View>

      {conversationsList.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="chat-bubble-outline" size={64} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>No Messages</Text>
          <Text style={styles.emptySubtitle}>
            You don't have any messages yet.{'\n'}Start a conversation with your team.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversationsList}
          keyExtractor={item => item!.id}
          contentContainerStyle={styles.conversationsContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item: conv }) => {
            if (!conv) return null;
            
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.conversationRow,
                  pressed && styles.conversationRowPressed
                ]}
                onPress={() => setSelectedConversation(conv.id)}
              >
                {/* Avatar */}
                <View style={[
                  styles.avatar,
                  conv.isGroup && styles.groupAvatar
                ]}>
                  <Text style={styles.avatarText}>{conv.avatar}</Text>
                </View>

                {/* Conversation Info */}
                <View style={styles.conversationContent}>
                  <View style={styles.conversationTop}>
                    <Text style={styles.conversationNameText} numberOfLines={1}>
                      {conv.name}
                    </Text>
                    <Text style={styles.conversationTime}>
                      {formatTime(conv.timestamp)}
                    </Text>
                  </View>
                  
                  <View style={styles.conversationBottom}>
                    <Text 
                      style={[
                        styles.lastMessageText,
                        conv.unreadCount > 0 && styles.unreadMessageText
                      ]}
                      numberOfLines={2}
                    >
                      {conv.lastMessage}
                    </Text>
                    
                    {conv.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>{conv.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Chevron */}
                <MaterialIcons 
                  name="chevron-right" 
                  size={20} 
                  color="#C7C7CC" 
                  style={styles.chevron}
                />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // List View Styles
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
    backgroundColor: '#F9F9F9',
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 80,
  },
  conversationsContent: {
    paddingBottom: SPACING.lg,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  conversationRowPressed: {
    backgroundColor: '#F2F2F7',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 88,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  groupAvatar: {
    backgroundColor: '#34C759',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
    gap: 4,
  },
  conversationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationNameText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  conversationTime: {
    fontSize: 15,
    color: '#8E8E93',
    marginLeft: SPACING.sm,
  },
  conversationBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  lastMessageText: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
    lineHeight: 20,
  },
  unreadMessageText: {
    fontWeight: '500',
    color: '#000000',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: SPACING.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 100,
  },
  emptyIcon: {
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Conversation View Styles
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
    backgroundColor: '#F9F9F9',
    minHeight: 44,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.sm,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: 4,
  },
  conversationTitle: {
    flex: 1,
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  conversationSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  timestampContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageBubbleContainer: {
    marginVertical: 2,
    maxWidth: '75%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#E9E9EB',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#000000',
  },
  
  // Input Bar Styles
  inputBar: {
    backgroundColor: '#F9F9F9',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    minHeight: 36,
    maxHeight: 100,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    maxHeight: 80,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    marginBottom: 2,
    minHeight: 44, // Ensure minimum touch target
    minWidth: 44,
  },
  sendButtonDisabled: {
    opacity: 0.4,
    backgroundColor: '#C7C7CC',
  },
});
