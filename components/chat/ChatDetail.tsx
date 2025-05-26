import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import {
  Appbar,
  Button,
  Surface,
  Text,
  TextInput,
  useTheme,
  Divider,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatItem } from '@/app/(tabs)/chat';
import { RequestItem } from '@/components/chat/ChatRequests';
import { ChatService, FirebaseChatMessage } from '@/services/chatService';
import { useAuth } from '@/app/_layout';
import { Timestamp } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isCurrentUser: boolean;
  type?: 'text' | 'system';
}

// Chat Detail Component
export const ChatDetail: React.FC<{
  chat: ChatItem;
  onBack: () => void;
  onMessageSent?: (chatId: string, messageText: string) => void;
  requestData?: RequestItem;
}> = ({ chat, onBack, onMessageSent, requestData }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [requestHandled, setRequestHandled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [processingRequest, setProcessingRequest] = useState<boolean>(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const { user: authUser } = useAuth();
  const theme = useTheme();

  // Format project ID for display
  const formatProjectName = (projectId: string): string => {
    return projectId.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Convert Firebase message to local message format
  const convertFirebaseMessage = (firebaseMsg: FirebaseChatMessage): Message => {
    return {
      id: firebaseMsg.id,
      text: firebaseMsg.text,
      sender: firebaseMsg.senderName,
      timestamp: firebaseMsg.timestamp.toDate().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      isCurrentUser: firebaseMsg.senderId === authUser?.uid,
      type: 'text'
    };
  };

  const markMessagesAsRead = async (latestMessageId: string) => {
    if (chat.type === 'group' && authUser?.uid && latestMessageId) {
      try {
        await ChatService.markMessagesAsRead(chat.id, authUser.uid, latestMessageId);
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!authUser || !chat.id) return;

    setLoading(true);
    
    if (chat.type === 'group') {
      const unsubscribe = ChatService.subscribeToGroupChatMessages(
        chat.id,
        async (firebaseMessages: FirebaseChatMessage[]) => {
          const convertedMessages = firebaseMessages.map(convertFirebaseMessage);
          setMessages(convertedMessages);
          
          // Mark messages as read if there are any messages
          if (firebaseMessages.length > 0) {
            const latestMessage = firebaseMessages[firebaseMessages.length - 1];
            setLastMessageId(latestMessage.id);
            
            // Mark as read after a short delay to ensure UI is ready
            setTimeout(() => {
              markMessagesAsRead(latestMessage.id);
            }, 500);
          }
          
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } 
    else if (chat.type === 'direct') {
      // Handle direct messages as before
      if (chat.requestId && messages.length === 0) {
        const initialMessage: Message = {
          id: Date.now().toString(),
          text: `Hello! I wanted to discuss your request to join ${formatProjectName(chat.projectId || '')} before making a decision.`,
          sender: 'Me',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCurrentUser: true,
          type: 'text'
        };
        
        setMessages([initialMessage]);
      }
      setLoading(false);
    }
  }, [chat.id, chat.type, authUser]);
  

  useEffect(() => {
    if (chat.type === 'group' && lastMessageId && authUser?.uid) {
      markMessagesAsRead(lastMessageId);
    }
  }, [lastMessageId, chat.type, authUser?.uid]);

  // Updated handleSendMessage to mark own message as read
  const handleSendMessage = async (): Promise<void> => {
    if (inputText.trim() === '' || !authUser) return;
    
    setSendingMessage(true);
    
    try {
      if (chat.type === 'group') {
        const success = await ChatService.sendGroupChatMessage(
          chat.id,
          authUser.uid,
          authUser.displayName || 'Anonymous',
          inputText.trim()
        );

        if (!success) {
          Alert.alert('Error', 'Failed to send message. Please try again.');
          return;
        }

        // The message will be automatically marked as read through the subscription
      } else {
        // For direct messages, add to local state
        const newMessage: Message = {
          id: Date.now().toString(),
          text: inputText,
          sender: 'Me',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCurrentUser: true,
          type: 'text'
        };
        
        setMessages(prev => [...prev, newMessage]);
      }

      setInputText('');
      
      if (onMessageSent) {
        onMessageSent(chat.id, inputText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle accepting a request
  const handleAcceptRequest = async (): Promise<void> => {
    if (!chat.requestId) return;
    
    setProcessingRequest(true);
    
    try {
      const success = await ChatService.acceptProjectRequest(chat.requestId);
      
      if (success) {
        // Add a system message to indicate the request was accepted
        const systemMessage: Message = {
          id: Date.now().toString(),
          text: "✅ You've accepted this request. The user has been added to the project.",
          sender: 'System',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCurrentUser: false,
          type: 'system'
        };
        
        setMessages(prev => [...prev, systemMessage]);
        setRequestHandled(true);
        
        Alert.alert('Success', 'Request accepted! The user has been added to the project.');
      } else {
        Alert.alert('Error', 'Failed to accept request. Please try again.');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    } finally {
      setProcessingRequest(false);
    }
  };
  
  // Handle declining a request
  const handleDeclineRequest = async (): Promise<void> => {
    if (!chat.requestId) return;
    
    setProcessingRequest(true);
    
    try {
      const success = await ChatService.declineProjectRequest(chat.requestId);
      
      if (success) {
        // Add a system message to indicate the request was declined
        const systemMessage: Message = {
          id: Date.now().toString(),
          text: "❌ You've declined this request.",
          sender: 'System',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isCurrentUser: false,
          type: 'system'
        };
        
        setMessages(prev => [...prev, systemMessage]);
        setRequestHandled(true);
        
        Alert.alert('Request Declined', 'The request has been declined.');
      } else {
        Alert.alert('Error', 'Failed to decline request. Please try again.');
      }
    } catch (error) {
      console.error('Error declining request:', error);
      Alert.alert('Error', 'Failed to decline request. Please try again.');
    } finally {
      setProcessingRequest(false);
    }
  };

  // Render a message bubble
  const renderMessage = ({ item }: { item: Message }): JSX.Element => {
    const isSystemMessage = item.type === 'system' || item.sender === 'System';
    
    return (
      <View 
        style={[
          styles.messageContainer,
          item.isCurrentUser ? styles.userMessageContainer : styles.otherMessageContainer,
          isSystemMessage && styles.systemMessageContainer
        ]}
      >
        <Surface 
          style={[
            styles.messageBubble,
            item.isCurrentUser 
              ? { backgroundColor: theme.colors.primary } 
              : isSystemMessage
                ? { backgroundColor: 'rgba(0, 0, 0, 0.05)' }
                : { backgroundColor: theme.colors.surfaceVariant }
          ]}
          elevation={1}
        >
          {!item.isCurrentUser && !isSystemMessage && (
            <Text variant="labelSmall" style={styles.senderName}>{item.sender}</Text>
          )}
          <Text 
            style={[
              styles.messageText,
              item.isCurrentUser 
                ? { color: theme.colors.onPrimary } 
                : isSystemMessage
                  ? { color: '#666', fontStyle: 'italic' }
                  : { color: theme.colors.onSurfaceVariant }
            ]}
          >
            {item.text}
          </Text>
        </Surface>
        <Text variant="labelSmall" style={styles.timestamp}>{item.timestamp}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Loading messages...</Text>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content 
          title={chat.name}
          subtitle={chat.type === 'direct' ? 'Direct Message' : `${chat.memberCount || 0} members`}
        />
        <Appbar.Action icon="information" onPress={() => console.log('Info')} />
      </Appbar.Header>

      <ThemedView style={styles.container}>
        <Divider />

        {/* Project request info for direct messages */}
        {chat.type === 'direct' && chat.projectId && (
          <Surface style={styles.projectInfoContainer}>
            <View style={styles.projectInfoContent}>
              <Text style={styles.projectInfoText}>
                Discussing request for:
              </Text>
              <Chip 
                icon="folder" 
                style={styles.projectChip}
              >
                {formatProjectName(chat.projectId)}
              </Chip>
            </View>
            
            {/* Action buttons for request */}
            {chat.requestId && !requestHandled && (
              <View style={styles.requestActions}>
                <Button 
                  mode="outlined" 
                  compact 
                  icon="close" 
                  onPress={handleDeclineRequest}
                  disabled={processingRequest}
                  loading={processingRequest}
                  style={[styles.requestActionButton, styles.declineButton]}
                  labelStyle={styles.requestButtonLabel}
                >
                  Decline
                </Button>
                <Button 
                  mode="outlined" 
                  compact 
                  icon="check" 
                  onPress={handleAcceptRequest}
                  disabled={processingRequest}
                  loading={processingRequest}
                  style={[styles.requestActionButton, styles.acceptButton]}
                  labelStyle={styles.requestButtonLabel}
                >
                  Accept
                </Button>
              </View>
            )}
          </Surface>
        )}

        {/* Messages List */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
        
        {/* Input Area */}
        <Surface style={styles.inputContainer} elevation={1}>
          <TextInput
            mode="outlined"
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="New message..."
            outlineStyle={styles.inputOutline}
            disabled={sendingMessage}
          />
          <Button 
            mode="contained" 
            onPress={handleSendMessage}
            disabled={inputText.trim() === '' || sendingMessage}
            loading={sendingMessage}
            style={styles.sendButton}
          >
            Send
          </Button>
        </Surface>
      </ThemedView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    maxWidth: '90%',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
  },
  senderName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 2,
    alignSelf: 'flex-end',
    color: '#888',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginBottom: 49,
  },
  input: {
    flex: 1,
    marginRight: 8,
    backgroundColor: 'transparent',
  },
  inputOutline: {
    borderRadius: 20,
  },
  sendButton: {
    justifyContent: 'center',
    borderRadius: 20,
    alignSelf: 'center',
  },
  projectInfoContainer: {
    flexDirection: 'column',
    padding: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  projectInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectInfoText: {
    fontSize: 14,
    marginRight: 8,
  },
  projectChip: {
    height: 32,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  requestActionButton: {
    marginLeft: 8,
    height: 36,
  },
  requestButtonLabel: {
    fontSize: 12,
    lineHeight: 12,
    paddingTop: 2,
    margin: 0,
  },
  declineButton: {
    borderColor: 'rgba(244, 67, 54, 0.5)',
  },
  acceptButton: {
    borderColor: 'rgba(76, 175, 80, 0.5)',
  },
});