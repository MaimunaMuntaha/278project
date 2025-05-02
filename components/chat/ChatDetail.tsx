import React, { useState } from 'react';
import { StyleSheet, FlatList, View, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Appbar,
  Button,
  Surface,
  Text,
  TextInput,
  useTheme,
  Divider,
} from 'react-native-paper';
import { ThemedView } from '@/components/ThemedView';
import { ChatItem } from '@/app/(tabs)/chat';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isCurrentUser: boolean;
}

// Sample messages mapped by chat ID
const messagesByChatId: Record<string, Message[]> = {
  '1': [
    {
      id: '1-1',
      text: 'Dolphin related stuff',
      sender: 'JD',
      timestamp: '10:30 AM',
      isCurrentUser: true,
    },
    {
      id: '1-2',
      text: 'We need to do a lot of important work on the dolphin',
      sender: 'CP',
      timestamp: '10:32 AM',
      isCurrentUser: false,
    },
  ],
  '2': [
    {
      id: '2-1',
      text: 'How is the spider robot project going?',
      sender: 'Me',
      timestamp: '2:15 PM',
      isCurrentUser: true,
    },
    {
      id: '2-2',
      text: 'Making good progress on the leg mechanisms',
      sender: 'Chris',
      timestamp: '2:20 PM',
      isCurrentUser: false,
    },
  ],
  '3': [
    {
      id: '3-1',
      text: 'I have some ideas for our collaborative essay',
      sender: 'Me',
      timestamp: '9:45 AM',
      isCurrentUser: true,
    },
    {
      id: '3-2',
      text: 'Great, let me know what youre thinking!',
      sender: 'FamousWriter123',
      timestamp: '10:02 AM',
      isCurrentUser: false,
    },
  ],
};

// Chat Detail Component
export const ChatDetail: React.FC<{
  chat: ChatItem;
  onBack: () => void;
}> = ({ chat, onBack }) => {
  const [messages, setMessages] = useState<Message[]>(
    messagesByChatId[chat.id] || []
  );
  const [inputText, setInputText] = useState<string>('');
  const theme = useTheme();

  // Handle sending a new message
  const handleSendMessage = (): void => {
    if (inputText.trim() === '') return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'Me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isCurrentUser: true,
    };
    
    setMessages([...messages, newMessage]);
    setInputText('');
  };

  // Render a message bubble
  const renderMessage = ({ item }: { item: Message }): JSX.Element => (
    <View 
      style={[
        styles.messageContainer,
        item.isCurrentUser ? styles.userMessageContainer : styles.otherMessageContainer
      ]}
    >
      <Surface 
        style={[
          styles.messageBubble,
          item.isCurrentUser 
            ? { backgroundColor: theme.colors.primary } 
            : { backgroundColor: theme.colors.surfaceVariant }
        ]}
        elevation={1}
      >
        {!item.isCurrentUser && (
          <Text variant="labelSmall" style={styles.senderName}>{item.sender}</Text>
        )}
        <Text 
          style={[
            styles.messageText,
            item.isCurrentUser 
              ? { color: theme.colors.onPrimary } 
              : { color: theme.colors.onSurfaceVariant }
          ]}
        >
          {item.text}
        </Text>
      </Surface>
      <Text variant="labelSmall" style={styles.timestamp}>{item.timestamp}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <Appbar.Header>
          <Appbar.BackAction onPress={onBack} />
          <Appbar.Content title={chat.name} />
          <Appbar.Action icon="information" onPress={() => console.log('Info')} />
        </Appbar.Header>

        <Divider />

        {/* Messages List */}
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
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
          />
          <Button 
            mode="contained" 
            onPress={handleSendMessage}
            disabled={inputText.trim() === ''}
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
  placeholderText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#888',
  },
});