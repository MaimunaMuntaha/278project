import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';

// Constants for styling - matching the existing app styles
const LIGHT_PURPLE = '#e7e0ec';
const DARK_PURPLE = '#6750a4';

interface ProjectRequestModalProps {
  visible: boolean;
  projectTitle: string;
  onClose: () => void;
  onSend: (message: string) => void;
}

const ProjectRequestModal: React.FC<ProjectRequestModalProps> = ({
  visible,
  projectTitle,
  onClose,
  onSend,
}) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() === '') return;
    onSend(message);
    setMessage(''); // Clear message after sending
  };

  const handleCancel = () => {
    setMessage(''); // Clear message when canceling
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <ThemedText type="title" style={styles.title}>
            Join "{projectTitle}"
          </ThemedText>
          
          <ThemedText style={styles.subtitle}>
            Tell the project creator about your experience and why you'd like to join.
          </ThemedText>
          
          <TextInput
            placeholder="Share your relevant experience or why you're interested..."
            value={message}
            onChangeText={setMessage}
            multiline
            style={styles.messageInput}
            autoFocus
          />
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button, 
                styles.sendButton,
                message.trim() === '' && styles.disabledButton
              ]}
              onPress={handleSend}
              disabled={message.trim() === ''}
            >
              <ThemedText style={styles.buttonText}>Send Request</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  modalContent: {
    width: '90%',
    backgroundColor: LIGHT_PURPLE,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: 16,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: DARK_PURPLE,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '48%',
  },
  cancelButton: {
    backgroundColor: '#eeeeee',
  },
  sendButton: {
    backgroundColor: DARK_PURPLE,
  },
  disabledButton: {
    backgroundColor: DARK_PURPLE,
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_PURPLE,
  }
});

export default ProjectRequestModal;