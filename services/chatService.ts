import { 
  collection, 
  doc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot, 
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase';

// Enhanced type definitions
export interface ProjectRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  fromUserAvatar?: string;
  toUserId: string; // project owner or recipient
  projectId?: string;
  projectName: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  type: 'join_project' | 'start_dm';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RequestItem {
  id: string;
  name: string;
  project: string;
  avatar?: any;
  message?: string;
  startDM: boolean; // true for DM requests, false for project join requests
  fromUserId: string;
  timestamp: Date;
}

// Firebase data structures (keeping existing ones)
export interface FirebaseChatMember {
  userId: string;
  displayName: string;
  email: string;
  joinedAt: Timestamp;
  role: 'owner' | 'admin' | 'member';
  lastReadMessageId?: string;
  lastReadAt?: Timestamp;
}

export interface FirebaseChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Timestamp;
  type: 'text' | 'image' | 'file';
  edited?: boolean;
  editedAt?: Timestamp;
}

export interface FirebaseGroupChat {
  id: string;
  projectName: string;
  description?: string;
  memberIds: string[]; // NEW: Array of user IDs for efficient querying
  members: Record<string, FirebaseChatMember>; // userId -> member info
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
  };
  isActive: boolean;
  settings: {
    allowInvites: boolean;
    isPublic: boolean;
  };
}

export class ChatService {
  // Get all group chats where user is a member
  static async getUserGroupChats(userId: string): Promise<FirebaseGroupChat[]> {
    try {
      const chatsRef = collection(db, 'groupChats');
      const q = query(
        chatsRef,
        where('memberIds', 'array-contains', userId), // CHANGED: Use array-contains instead of dynamic field
        where('isActive', '==', true),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const chats: FirebaseGroupChat[] = [];
      
      querySnapshot.forEach((doc) => {
        chats.push({ id: doc.id, ...doc.data() } as FirebaseGroupChat);
      });
      
      return chats;
    } catch (error) {
      console.error('Error fetching user group chats:', error);
      return [];
    }
  }

  // Subscribe to real-time updates for user's group chats
  static subscribeToUserGroupChats(
    userId: string, 
    callback: (chats: FirebaseGroupChat[]) => void
  ): () => void {
    const chatsRef = collection(db, 'groupChats');
    const q = query(
      chatsRef,
      where('memberIds', 'array-contains', userId), // CHANGED: Use array-contains instead of dynamic field
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const chats: FirebaseGroupChat[] = [];
      querySnapshot.forEach((doc) => {
        chats.push({ id: doc.id, ...doc.data() } as FirebaseGroupChat);
      });
      callback(chats);
    }, (error) => {
      console.error('Error in chat subscription:', error);
    });

    return unsubscribe;
  }

  // Get unread message count for a chat
  static async getUnreadMessageCount(
    chatId: string, 
    userId: string, 
    lastReadMessageId?: string
  ): Promise<number> {
    try {
      if (!lastReadMessageId) {
        // If user has never read any messages, count all messages
        const messagesRef = collection(db, 'groupChats', chatId, 'messages');
        const querySnapshot = await getDocs(messagesRef);
        return querySnapshot.size;
      }

      // Count messages after the last read message
      const messagesRef = collection(db, 'groupChats', chatId, 'messages');
      const q = query(
        messagesRef,
        where('timestamp', '>', Timestamp.now()), // You'll need to store and compare with lastReadAt timestamp
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }
  }

  // Create a new group chat
  static async createGroupChat(
    projectName: string,
    description: string,
    creatorId: string,
    creatorName: string,
    creatorEmail: string
  ): Promise<string | null> {
    try {
      const chatsRef = collection(db, 'groupChats');
      const newChatRef = doc(chatsRef);
      
      const now = Timestamp.now();
      const newChat: Omit<FirebaseGroupChat, 'id'> = {
        projectName,
        description,
        memberIds: [creatorId], // NEW: Initialize with creator's ID
        members: {
          [creatorId]: {
            userId: creatorId,
            displayName: creatorName,
            email: creatorEmail,
            joinedAt: now,
            role: 'owner'
          }
        },
        createdAt: now,
        updatedAt: now,
        isActive: true,
        settings: {
          allowInvites: true,
          isPublic: false
        }
      };

      await setDoc(newChatRef, newChat);
      return newChatRef.id;
    } catch (error) {
      console.error('Error creating group chat:', error);
      return null;
    }
  }

  // ============ NEW REQUEST MANAGEMENT FUNCTIONS ============

  // Create a new project request
  static async createProjectRequest(
    fromUserId: string,
    fromUserName: string,
    fromUserEmail: string,
    toUserId: string,
    projectName: string,
    type: 'join_project' | 'start_dm',
    message?: string,
    projectId?: string
  ): Promise<string | null> {
    try {
      // Check if request already exists
      const existingRequest = await this.getExistingRequest(fromUserId, toUserId, projectName, type);
      if (existingRequest) {
        console.log('Request already exists');
        return existingRequest.id;
      }

      const requestsRef = collection(db, 'projectRequests');
      const now = Timestamp.now();
      
      const newRequest: Omit<ProjectRequest, 'id'> = {
        fromUserId,
        fromUserName,
        fromUserEmail,
        toUserId,
        projectId,
        projectName,
        message,
        status: 'pending',
        type,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(requestsRef, newRequest);
      return docRef.id;
    } catch (error) {
      console.error('Error creating project request:', error);
      return null;
    }
  }

  // Check if a request already exists
  private static async getExistingRequest(
    fromUserId: string,
    toUserId: string,
    projectName: string,
    type: 'join_project' | 'start_dm'
  ): Promise<ProjectRequest | null> {
    try {
      const requestsRef = collection(db, 'projectRequests');
      const q = query(
        requestsRef,
        where('fromUserId', '==', fromUserId),
        where('toUserId', '==', toUserId),
        where('projectName', '==', projectName),
        where('type', '==', type),
        where('status', '==', 'pending')
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as ProjectRequest;
      }
      return null;
    } catch (error) {
      console.error('Error checking existing request:', error);
      return null;
    }
  }

  // Get all pending requests for a user (requests TO them)
  static async getUserRequests(userId: string): Promise<ProjectRequest[]> {
    try {
      const requestsRef = collection(db, 'projectRequests');
      const q = query(
        requestsRef,
        where('toUserId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const requests: ProjectRequest[] = [];
      
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as ProjectRequest);
      });

      return requests;
    } catch (error) {
      console.error('Error fetching user requests:', error);
      return [];
    }
  }

  // Subscribe to real-time updates for user requests
  static subscribeToUserRequests(
    userId: string,
    callback: (requests: ProjectRequest[]) => void
  ): () => void {
    const requestsRef = collection(db, 'projectRequests');
    const q = query(
      requestsRef,
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const requests: ProjectRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as ProjectRequest);
      });
      callback(requests);
    }, (error) => {
      console.error('Error in requests subscription:', error);
    });

    return unsubscribe;
  }

  // Accept a project request
  static async acceptProjectRequest(requestId: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'projectRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        console.error('Request not found');
        return false;
      }

      const request = { id: requestDoc.id, ...requestDoc.data() } as ProjectRequest;

      // Update request status
      await updateDoc(requestRef, {
        status: 'accepted',
        updatedAt: Timestamp.now()
      });

      // If it's a join_project request, add user to the group chat
      if (request.type === 'join_project') {
        // Find the group chat by project name
        let groupChat = await this.getGroupChatByProjectName(request.projectName);
        
        if (!groupChat) {
          console.log(`No group chat found for project: ${request.projectName}. Creating one...`);
          
          // Find the project owner's details to create the group chat
          const projectOwner = await this.getProjectOwnerDetails(request.toUserId, request.projectName);
          
          if (projectOwner) {
            // Create a new group chat for this project
            const groupChatId = await this.createGroupChat(
              request.projectName,
              `Group chat for ${request.projectName}`,
              request.toUserId,
              projectOwner.displayName,
              projectOwner.email
            );
            
            if (groupChatId) {
              console.log(`Created new group chat ${groupChatId} for project ${request.projectName}`);
              // Fetch the newly created group chat
              groupChat = await this.getGroupChatByProjectName(request.projectName);
            }
          }
        }
        
        if (groupChat) {
          const success = await this.addUserToGroupChat(
            groupChat.id,
            request.fromUserId,
            request.fromUserName,
            request.fromUserEmail
          );
          
          if (!success) {
            console.error('Failed to add user to group chat');
            // Don't return false here, the request was still accepted
          }
        } else {
          console.error(`Failed to create or find group chat for project: ${request.projectName}`);
          // The request is still accepted even if we can't create/find the group chat
        }
      }

      return true;
    } catch (error) {
      console.error('Error accepting project request:', error);
      return false;
    }
  }

  // Helper method to get project owner details
  private static async getProjectOwnerDetails(
    ownerId: string, 
    projectName: string
  ): Promise<{ displayName: string; email: string } | null> {
    try {
      // First, try to get details from the users collection
      const userRef = doc(db, 'users', ownerId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          displayName: userData.displayName || userData.username || 'Anonymous',
          email: userData.email || ''
        };
      }
      
      // Fallback: Get details from the project post
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('uid', '==', ownerId),
        where('title', '==', projectName),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const postData = querySnapshot.docs[0].data();
        return {
          displayName: postData.username || 'Anonymous',
          email: '' // Posts don't store email, so we'll use empty string
        };
      }
      
      // Last resort: use the owner ID as display name
      return {
        displayName: 'Project Owner',
        email: ''
      };
    } catch (error) {
      console.error('Error fetching project owner details:', error);
      return {
        displayName: 'Project Owner',
        email: ''
      };
    }
  }

  // Decline a project request
  static async declineProjectRequest(requestId: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'projectRequests', requestId);
      await updateDoc(requestRef, {
        status: 'declined',
        updatedAt: Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error('Error declining project request:', error);
      return false;
    }
  }

  // Add user to an existing group chat
  static async addUserToGroupChat(
    chatId: string,
    userId: string,
    userName: string,
    userEmail: string
  ): Promise<boolean> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      const memberData: FirebaseChatMember = {
        userId,
        displayName: userName,
        email: userEmail,
        joinedAt: Timestamp.now(),
        role: 'member'
      };

      await updateDoc(chatRef, {
        [`members.${userId}`]: memberData,
        memberIds: arrayUnion(userId), // NEW: Add to memberIds array
        updatedAt: Timestamp.now()
      });

      return true;
    } catch (error) {
      console.error('Error adding user to group chat:', error);
      return false;
    }
  }

  // Remove user from group chat
  static async removeUserFromGroupChat(chatId: string, userId: string): Promise<boolean> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      await updateDoc(chatRef, {
        [`members.${userId}`]: null,
        memberIds: arrayRemove(userId), // NEW: Remove from memberIds array
        updatedAt: Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error('Error removing user from group chat:', error);
      return false;
    }
  }

  // Get group chat by project name (for finding existing chats)
  static async getGroupChatByProjectName(projectName: string): Promise<FirebaseGroupChat | null> {
    try {
      const chatsRef = collection(db, 'groupChats');
      const q = query(
        chatsRef,
        where('projectName', '==', projectName),
        where('isActive', '==', true),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as FirebaseGroupChat;
      }
      return null;
    } catch (error) {
      console.error('Error finding group chat by project name:', error);
      return null;
    }
  }

  // Check if user is owner/admin of a group chat
  static async isUserGroupChatAdmin(chatId: string, userId: string): Promise<boolean> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) return false;
      
      const chatData = chatDoc.data() as FirebaseGroupChat;
      const userMember = chatData.members[userId];
      
      return userMember && (userMember.role === 'owner' || userMember.role === 'admin');
    } catch (error) {
      console.error('Error checking user admin status:', error);
      return false;
    }
  }

  // Convert ProjectRequest to RequestItem for UI compatibility
  static convertProjectRequestToRequestItem(request: ProjectRequest): RequestItem {
    return {
      id: request.id,
      name: request.fromUserName,
      project: request.projectName,
      avatar: request.fromUserAvatar || null,
      message: request.message,
      startDM: request.type === 'start_dm',
      fromUserId: request.fromUserId,
      timestamp: request.createdAt.toDate()
    };
  }

  // Batch convert requests
  static convertProjectRequestsToRequestItems(requests: ProjectRequest[]): RequestItem[] {
    return requests.map(request => this.convertProjectRequestToRequestItem(request));
  }

  // Delete a request (useful for cleanup)
  static async deleteProjectRequest(requestId: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'projectRequests', requestId);
      await deleteDoc(requestRef);
      return true;
    } catch (error) {
      console.error('Error deleting project request:', error);
      return false;
    }
  }

  // Subscribe to real-time messages for a group chat
  static subscribeToGroupChatMessages(
    chatId: string,
    callback: (messages: FirebaseChatMessage[]) => void
  ): () => void {
    const messagesRef = collection(db, 'groupChats', chatId, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(100) // Limit to last 100 messages for performance
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const messages: FirebaseChatMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          type: data.type || 'text',
          edited: data.edited || false,
          editedAt: data.editedAt
        } as FirebaseChatMessage);
      });
      callback(messages);
    }, (error) => {
      console.error('Error in messages subscription:', error);
    });

    return unsubscribe;
  }

  // Send a message to a group chat
  static async sendGroupChatMessage(
    chatId: string,
    senderId: string,
    senderName: string,
    text: string,
    type: 'text' | 'image' | 'file' = 'text'
  ): Promise<boolean> {
    try {
      const messagesRef = collection(db, 'groupChats', chatId, 'messages');
      const now = Timestamp.now();
      
      const newMessage: Omit<FirebaseChatMessage, 'id'> = {
        senderId,
        senderName,
        text,
        timestamp: now,
        type,
        edited: false
      };

      // Add the message to the messages subcollection
      await addDoc(messagesRef, newMessage);

      // Update the group chat's last message
      const chatRef = doc(db, 'groupChats', chatId);
      await updateDoc(chatRef, {
        lastMessage: {
          text,
          senderId,
          senderName,
          timestamp: now
        },
        updatedAt: now
      });

      return true;
    } catch (error) {
      console.error('Error sending group chat message:', error);
      return false;
    }
  }

  // Get messages for a group chat (one-time fetch)
  static async getGroupChatMessages(
    chatId: string,
    messageLimit: number = 50
  ): Promise<FirebaseChatMessage[]> {
    try {
      const messagesRef = collection(db, 'groupChats', chatId, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(messageLimit)
      );

      const querySnapshot = await getDocs(q);
      const messages: FirebaseChatMessage[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          type: data.type || 'text',
          edited: data.edited || false,
          editedAt: data.editedAt
        } as FirebaseChatMessage);
      });

      // Reverse to get chronological order (oldest first)
      return messages.reverse();
    } catch (error) {
      console.error('Error fetching group chat messages:', error);
      return [];
    }
  }

  static async getGroupChatById(chatId: string): Promise<FirebaseGroupChat | null> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        return null;
      }
      
      return { id: chatDoc.id, ...chatDoc.data() } as FirebaseGroupChat;
    } catch (error) {
      console.error('Error fetching group chat by ID:', error);
      return null;
    }
  }

  // Mark messages as read for a user
  static async markMessagesAsRead(
    chatId: string,
    userId: string,
    lastMessageId: string
  ): Promise<boolean> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      await updateDoc(chatRef, {
        [`members.${userId}.lastReadMessageId`]: lastMessageId,
        [`members.${userId}.lastReadAt`]: Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  }

  // Delete a message (for message senders or admins)
  static async deleteMessage(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Check if user is the sender or an admin
      const isAdmin = await this.isUserGroupChatAdmin(chatId, userId);
      const messageRef = doc(db, 'groupChats', chatId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        return false;
      }
      
      const messageData = messageDoc.data();
      const isSender = messageData.senderId === userId;
      
      if (!isSender && !isAdmin) {
        console.error('User not authorized to delete this message');
        return false;
      }

      await deleteDoc(messageRef);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  // Edit a message (for message senders)
  static async editMessage(
    chatId: string,
    messageId: string,
    userId: string,
    newText: string
  ): Promise<boolean> {
    try {
      const messageRef = doc(db, 'groupChats', chatId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        return false;
      }
      
      const messageData = messageDoc.data();
      if (messageData.senderId !== userId) {
        console.error('User not authorized to edit this message');
        return false;
      }

      await updateDoc(messageRef, {
        text: newText,
        edited: true,
        editedAt: Timestamp.now()
      });
      
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      return false;
    }
  }
}